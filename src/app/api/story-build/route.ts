import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { queryAssets } from '@/lib/db';
import { AssetRecord } from '@/lib/taxonomy';

let _ai: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!_ai) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY not set');
    _ai = new GoogleGenAI({ apiKey: key });
  }
  return _ai;
}

export interface StoryboardClip {
  assetId: string;
  order: number;
  role: 'hook' | 'proof' | 'demo' | 'emotion' | 'cta';
  suggestedStartSec: number;
  suggestedEndSec: number;
  scriptLine: string;
  overlayText: string;
  overlayPlacement: 'top' | 'center' | 'bottom';
  overlayStyle: 'headline' | 'caption' | 'stat' | 'none';
  transitionNote: string;
}

export interface TextOverlay {
  clipOrder: number;
  text: string;
  placement: string;
  style: string;
  timing: string;
}

export interface MusicSuggestion {
  mood: string;
  bpm: number;
  bpmRange: string;
  energy: 'low' | 'medium' | 'high';
  genres: string[];
  trendingSongs: { title: string; artist: string; why: string }[];
  productionNotes: string;
}

export interface StoryBuildResponse {
  storyboard: StoryboardClip[];
  fullScript: string;
  voiceoverLines: string[];
  hookLine: string;
  callToAction: string;
  textOverlayPlan: TextOverlay[];
  musicSuggestion: MusicSuggestion;
  selectedAssetIds: string[];
  totalEstimatedDuration: number;
  directorNotes: string;
}

export interface StoryBuildRequest {
  intent: string;
  format: 'instagram-reel' | 'tiktok' | 'youtube-short' | 'facebook-ad' | 'custom';
  targetDurationSec: number;
  dsModel?: string;
  campaign?: string;
  subjects?: string[];
  shotTypes?: string[];
  moods?: string[];
  customNotes?: string;
}

const FORMAT_CONTEXT: Record<string, string> = {
  'instagram-reel': 'Instagram Reel (9:16 vertical, max 90s, hook in first 1-2s, fast-paced cuts, trending audio)',
  'tiktok': 'TikTok (9:16 vertical, max 60s, extremely fast hook, pattern interrupts, native-feeling text)',
  'youtube-short': 'YouTube Short (9:16 vertical, max 60s, slightly slower pace than TikTok, subscribe CTA)',
  'facebook-ad': 'Facebook/Instagram Ad (square or 9:16, first 3s critical, clear value prop, strong CTA)',
  'custom': 'Custom format',
};

const SYSTEM_INSTRUCTION = `You are an elite short-form video director and editor for DreamPlay Pianos.
You specialize in high-retention social media content that stops the scroll and drives conversions.
You understand music, emotion, pacing, psychology, and the piano enthusiast audience.
Always return valid JSON only. No markdown, no explanation outside the JSON.`;

export async function POST(req: NextRequest) {
  try {
    const body: StoryBuildRequest = await req.json();
    const { intent, format, targetDurationSec, dsModel, campaign, subjects, shotTypes, moods, customNotes } = body;

    // Fetch best assets from DB
    const { assets: allAssets } = queryAssets({
      dsModel: dsModel || undefined,
      campaign: campaign || undefined,
      limit: 80,
    });

    // Score assets: finals > high priority > others; vary subjects
    const scored = allAssets
      .map(a => ({
        asset: a,
        score:
          (a.finalStatus === 'final' ? 100 : a.finalStatus === 'intermediate' ? 50 : 10) +
          (a.priority === 'high' ? 60 : 0) +
          (subjects?.includes(a.subject) ? 40 : 0) +
          (shotTypes?.includes(a.shotType) ? 20 : 0) +
          (a.durationSeconds && a.durationSeconds > 2 && a.durationSeconds < 30 ? 20 : 0),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    const assetSummaries = scored.map((s, i) => {
      const a = s.asset;
      const dur = a.durationSeconds ? `${a.durationSeconds.toFixed(1)}s` : '?s';
      // Keep descriptions short to reduce token usage
      const shortDesc = (a.aiDescription || '').slice(0, 80);
      return `[${i}] id:${a.id} subject:${a.subject} shot:${a.shotType} model:${a.dsModel ?? '-'} dur:${dur} status:${a.finalStatus} priority:${a.priority} desc:"${shortDesc}"`;
    }).join('\n');

    const formatDesc = FORMAT_CONTEXT[format] || FORMAT_CONTEXT['custom'];

    const prompt = `You are building a short-form video for DreamPlay Pianos.

FORMAT: ${formatDesc}
TARGET DURATION: ${targetDurationSec} seconds
INTENT: ${intent || 'Showcase the DreamPlay piano and drive interest'}
DS MODEL FOCUS: ${dsModel || 'Any'}
CAMPAIGN: ${campaign || 'General'}
MOOD DIRECTION: ${moods?.join(', ') || 'cinematic, aspirational'}
${customNotes ? `ADDITIONAL NOTES: ${customNotes}` : ''}

AVAILABLE CLIPS (pick the best ones):
${assetSummaries}

Pick 4–8 clips. Each clip should play 2–6 seconds. Assign roles: hook (first clip, most attention-grabbing), proof (shows the product/hands), demo (demonstrates value), emotion (creates feeling), cta (call to action, last clip).

Return ONLY this JSON structure:
{
  "selectedAssetIds": ["id1", "id2", ...],
  "storyboard": [
    {
      "assetId": "...",
      "order": 1,
      "role": "hook",
      "suggestedStartSec": 0,
      "suggestedEndSec": 3,
      "scriptLine": "One sentence voiceover for this clip",
      "overlayText": "Short snappy text to show on screen (max 6 words)",
      "overlayPlacement": "bottom",
      "overlayStyle": "headline",
      "transitionNote": "cut / smash cut / dissolve / etc"
    }
  ],
  "hookLine": "The opening line that stops the scroll (max 8 words)",
  "callToAction": "The final CTA text",
  "fullScript": "Full voiceover script as one continuous paragraph",
  "voiceoverLines": ["line per clip in order"],
  "textOverlayPlan": [
    { "clipOrder": 1, "text": "...", "placement": "bottom", "style": "headline", "timing": "0s–2s" }
  ],
  "musicSuggestion": {
    "mood": "dark cinematic luxury",
    "bpm": 95,
    "bpmRange": "85–110",
    "energy": "high",
    "genres": ["cinematic trap", "ambient electronic"],
    "trendingSongs": [
      { "title": "Song Name", "artist": "Artist", "why": "Why this fits" }
    ],
    "productionNotes": "Build in first 5s, peak at 15s, fade out last 3s"
  },
  "totalEstimatedDuration": 30,
  "directorNotes": "Overall creative direction note for the editor"
}`;

    const ai = getAI();

    async function callGemini(promptText: string): Promise<string> {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: promptText }] }],
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.6,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',  // Forces Gemini to return clean JSON
        },
      });
      return response.text?.trim() ?? '';
    }

    function extractJSON(raw: string): StoryBuildResponse {
      // Strip markdown fences if present
      let text = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
      // Find outermost JSON object
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        text = text.slice(start, end + 1);
      }
      return JSON.parse(text) as StoryBuildResponse;
    }

    let parsed: StoryBuildResponse;
    try {
      const raw = await callGemini(prompt);
      parsed = extractJSON(raw);
    } catch (firstErr) {
      console.warn('[story-build] First attempt failed, retrying once…', String(firstErr));
      // Retry with a slightly simplified prompt to reduce chance of truncation
      try {
        const retryPrompt = prompt + '\n\nIMPORTANT: Respond with ONLY valid JSON. No explanations, no markdown. Start with { and end with }.';
        const raw2 = await callGemini(retryPrompt);
        parsed = extractJSON(raw2);
      } catch (retryErr) {
        console.error('[story-build] Retry also failed:', String(retryErr));
        throw new Error(`Story generation failed after retry. Please try again. (${String(retryErr)})`);
      }
    }

    // Attach full asset records for selected clips
    const selectedIds = new Set(parsed.selectedAssetIds);
    const selectedAssets = scored.filter(s => selectedIds.has(s.asset.id)).map(s => s.asset);

    return NextResponse.json({ ...parsed, assets: selectedAssets });
  } catch (err) {
    console.error('[story-build]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
