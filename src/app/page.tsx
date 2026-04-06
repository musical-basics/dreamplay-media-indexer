'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  SUBJECT_PRESETS,
  SHOT_TYPE_PRESETS,
  MOOD_PRESETS,
  CAMPAIGN_PRESETS,
  OUTPUT_FORMAT_PRESETS,
  DS_MODELS,
} from '@/lib/brand-config';
import type { PromptGenerateRequest } from '@/app/api/prompt-generate/route';
import type { StoryBuildRequest, StoryBuildResponse, StoryboardClip, MusicSuggestion } from '@/app/api/story-build/route';

// ── Types ───────────────────────────────────────────────────────────────────
interface Asset {
  id: string; filePath: string; fileName: string; fileSize: number;
  mediaType: 'video' | 'image'; durationSeconds: number | null;
  subject: string; handZone: string | null; dsModel: string | null;
  purpose: string; campaign: string; shotType: string; finalStatus: string;
  colorLabel: string | null; priority: string; mood: string; colorGrade: string;
  aiDescription: string; aiKeywords: string; thumbPath: string | null;
  orientation: string | null; aspectRatio: string | null;
  width: number | null; height: number | null; codec: string | null;
  fps: number | null; updatedAt: number;
}
interface Stats { total: number; finals: number; highPriority: number; }
interface DraftMeta { id: string; name: string; createdAt: number; updatedAt: number; }

// ── Constants ───────────────────────────────────────────────────────────────
const COLOR_CHIPS: Record<string, { bg: string; label: string }> = {
  red: { bg: '#ef4444', label: 'Red' }, orange: { bg: '#f97316', label: 'Orange' },
  yellow: { bg: '#eab308', label: 'Yellow' }, green: { bg: '#22c55e', label: 'Green' },
  blue: { bg: '#3b82f6', label: 'Blue' }, purple: { bg: '#a855f7', label: 'Purple' },
  gray: { bg: '#6b7280', label: 'Gray' },
};
const SUBJECTS = ['hands', 'piano-keys', 'piano-full', 'talking-head', 'lifestyle', 'product', 'abstract', 'mixed'];
const PURPOSES = ['education', 'marketing', 'social-reel', 'product-demo', 'testimonial', 'b-roll'];
const CAMPAIGNS = ['CEO Spotlight', 'Piano Comparison', 'Handspan Measurement', 'La Campanella', 'NAMM', 'Duel Piano', 'Other'];
const SHOT_TYPES = ['close-up', 'medium', 'wide', 'overhead', 'POV', 'detail'];
const ROLE_COLORS: Record<string, string> = {
  hook: '#ef4444', proof: '#3b82f6', demo: '#a855f7', emotion: '#f97316', cta: '#22c55e',
};
const FORMATS = [
  { id: 'instagram-reel', label: '📱 Instagram Reel', sec: 30 },
  { id: 'tiktok', label: '🎵 TikTok', sec: 30 },
  { id: 'youtube-short', label: '▶️ YouTube Short', sec: 45 },
  { id: 'facebook-ad', label: '📢 Facebook Ad', sec: 20 },
  { id: 'custom', label: '🎬 Custom', sec: 60 },
];

function formatDuration(s: number | null): string {
  if (!s) return ''; if (s < 60) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}
function formatBytes(b: number): string {
  if (b > 1e9) return `${(b / 1e9).toFixed(1)} GB`;
  if (b > 1e6) return `${(b / 1e6).toFixed(1)} MB`;
  return `${(b / 1e3).toFixed(0)} KB`;
}
function thumbUrl(asset: Asset | { thumbPath: string | null }): string {
  if (asset.thumbPath) return `/api/thumb?path=${encodeURIComponent(asset.thumbPath)}`;
  return '';
}

// ── Multi-select chip helper ─────────────────────────────────────────────────
function MultiChip({ id, label, selected, onToggle, colorClass }: {
  id: string; label: string; selected: boolean; onToggle: (id: string) => void; colorClass?: string;
}) {
  return (
    <button
      className={`preset-chip ${colorClass ?? ''} ${selected ? 'active' : ''}`}
      onClick={() => onToggle(id)}
    >{label}</button>
  );
}

// ── Prompt Box (multi-select) ────────────────────────────────────────────────
function PromptBox() {
  const [isOpen, setIsOpen] = useState(false);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [shots, setShots] = useState<string[]>([]);
  const [moods, setMoods] = useState<string[]>([]);
  const [campaigns, setCampaigns] = useState<string[]>([]);
  const [dsModels, setDsModels] = useState<string[]>([]);
  const [formats, setFormats] = useState<string[]>([]);
  const [customNotes, setCustomNotes] = useState('');
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copyMsg, setCopyMsg] = useState('');
  const [error, setError] = useState('');

  function toggle(arr: string[], setArr: (v: string[]) => void, id: string) {
    setArr(arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]);
  }

  async function handleGenerate() {
    setIsGenerating(true); setError(''); setGeneratedPrompt('');
    const body: PromptGenerateRequest = {
      subjectPrompt: subjects.map(id => SUBJECT_PRESETS.find(p => p.id === id)?.prompt ?? '').filter(Boolean).join('; '),
      shotTypePrompt: shots.map(id => SHOT_TYPE_PRESETS.find(p => p.id === id)?.prompt ?? '').filter(Boolean).join('; '),
      moodPrompt: moods.map(id => MOOD_PRESETS.find(p => p.id === id)?.prompt ?? '').filter(Boolean).join('; '),
      campaignPrompt: campaigns.filter(id => id !== 'none').map(id => CAMPAIGN_PRESETS.find(p => p.id === id)?.prompt ?? '').filter(Boolean).join('; '),
      dsModel: dsModels.join(', '),
      dsModelDescription: dsModels.map(k => DS_MODELS[k as keyof typeof DS_MODELS]?.description ?? '').filter(Boolean).join('; '),
      outputFormat: formats.map(id => OUTPUT_FORMAT_PRESETS.find(p => p.id === id)?.prompt ?? '').filter(Boolean).join('; '),
      customNotes,
    };
    try {
      const res = await fetch('/api/prompt-generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setGeneratedPrompt(data.prompt);
    } catch (err) { setError(String(err)); }
    setIsGenerating(false);
  }

  function handleReset() {
    setSubjects([]); setShots([]); setMoods([]); setCampaigns([]);
    setDsModels([]); setFormats([]); setCustomNotes(''); setGeneratedPrompt(''); setError('');
  }

  const hasSelections = subjects.length || shots.length || moods.length || dsModels.length;

  return (
    <div className={`prompt-box ${isOpen ? 'open' : ''}`}>
      <button className="prompt-toggle" onClick={() => setIsOpen(v => !v)}>
        <span className="prompt-toggle-left">
          <span className="prompt-icon">✨</span>
          <span className="prompt-toggle-title">Prompt Builder</span>
          <span className="prompt-toggle-sub">Generate brand-accurate AI prompts — multi-select any category</span>
        </span>
        <span className="prompt-toggle-chevron">{isOpen ? '▲' : '▼'}</span>
      </button>
      {isOpen && (
        <div className="prompt-body">
          <div className="prompt-presets-grid">
            <div className="preset-group">
              <div className="preset-label">Subject {subjects.length > 1 && <span className="preset-count">{subjects.length}</span>}</div>
              <div className="preset-chips">{SUBJECT_PRESETS.map(p => <MultiChip key={p.id} id={p.id} label={p.label} selected={subjects.includes(p.id)} onToggle={id => toggle(subjects, setSubjects, id)} />)}</div>
            </div>
            <div className="preset-group">
              <div className="preset-label">DS Model {dsModels.length > 1 && <span className="preset-count">{dsModels.length}</span>}</div>
              <div className="preset-chips">{Object.entries(DS_MODELS).map(([key, val]) => <MultiChip key={key} id={key} label={val.label} selected={dsModels.includes(key)} onToggle={id => toggle(dsModels, setDsModels, id)} colorClass="ds" />)}</div>
            </div>
            <div className="preset-group">
              <div className="preset-label">Shot Type {shots.length > 1 && <span className="preset-count">{shots.length}</span>}</div>
              <div className="preset-chips">{SHOT_TYPE_PRESETS.map(p => <MultiChip key={p.id} id={p.id} label={p.label} selected={shots.includes(p.id)} onToggle={id => toggle(shots, setShots, id)} />)}</div>
            </div>
            <div className="preset-group">
              <div className="preset-label">Mood / Style {moods.length > 1 && <span className="preset-count">{moods.length}</span>}</div>
              <div className="preset-chips">{MOOD_PRESETS.map(p => <MultiChip key={p.id} id={p.id} label={p.label} selected={moods.includes(p.id)} onToggle={id => toggle(moods, setMoods, id)} />)}</div>
            </div>
            <div className="preset-group">
              <div className="preset-label">Campaign {campaigns.length > 1 && <span className="preset-count">{campaigns.length}</span>}</div>
              <div className="preset-chips">{CAMPAIGN_PRESETS.map(p => <MultiChip key={p.id} id={p.id} label={p.label} selected={campaigns.includes(p.id)} onToggle={id => toggle(campaigns, setCampaigns, id)} />)}</div>
            </div>
            <div className="preset-group">
              <div className="preset-label">Output Format {formats.length > 1 && <span className="preset-count">{formats.length}</span>}</div>
              <div className="preset-chips">{OUTPUT_FORMAT_PRESETS.map(p => <MultiChip key={p.id} id={p.id} label={p.label} selected={formats.includes(p.id)} onToggle={id => toggle(formats, setFormats, id)} />)}</div>
            </div>
          </div>
          <div className="prompt-notes-row">
            <textarea className="prompt-notes" placeholder="Extra context… (e.g. 'show the sustain pedal', 'blue ambient lighting')" value={customNotes} onChange={e => setCustomNotes(e.target.value)} rows={2} />
          </div>
          <div className="prompt-actions">
            <button className="prompt-generate-btn" onClick={handleGenerate} disabled={isGenerating || !hasSelections}>
              {isGenerating ? <><span className="prompt-spinner" />Generating…</> : '✨ Generate Prompt'}
            </button>
            {(hasSelections || generatedPrompt) && <button className="prompt-reset-btn" onClick={handleReset}>↺ Reset</button>}
          </div>
          {isGenerating && <div className="prompt-output-shimmer"><div className="shimmer-bar w80" /><div className="shimmer-bar w60" /><div className="shimmer-bar w90" /><div className="shimmer-bar w50" /></div>}
          {error && <div className="prompt-error">⚠ {error}</div>}
          {generatedPrompt && !isGenerating && (
            <div className="prompt-output-wrap">
              <div className="prompt-output-header">
                <span className="prompt-output-label">Generated Prompt</span>
                <button className="prompt-copy-btn" onClick={() => { navigator.clipboard.writeText(generatedPrompt); setCopyMsg('Copied!'); setTimeout(() => setCopyMsg(''), 2000); }}>{copyMsg || '📋 Copy'}</button>
              </div>
              <textarea className="prompt-output" readOnly value={generatedPrompt} rows={5} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sequential Video Player (Spotify edition) ──────────────────────────────
interface SeqClip { clip: { role: string; suggestedStartSec: number; suggestedEndSec: number; overlayText?: string }; asset: Asset | undefined; }

interface SpotifyTrack { name: string; artist: string; previewUrl: string | null; albumArt: string | null; spotifyUrl: string | null; }

function SequentialPlayer({ clips: initialClips, musicQuery }: { clips: SeqClip[]; musicQuery?: string }) {
  const [clips, setClips] = useState(initialClips);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [spotifyConnected, setSpotifyConnected] = useState<boolean | null>(null);
  const [spotifyTrack, setSpotifyTrack] = useState<SpotifyTrack | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Sync clip list with props (for live edits from parent)
  useEffect(() => { setClips(initialClips); }, [initialClips]);

  const current = clips[idx];
  const streamUrl = current?.asset?.filePath
    ? `/api/stream?path=${encodeURIComponent(current.asset.filePath)}`
    : null;

  // Fetch Spotify track on mount
  useEffect(() => {
    async function fetchTrack() {
      try {
        const q = musicQuery ?? 'cinematic ambient';
        const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setSpotifyConnected(data.connected);
        if (data.track) setSpotifyTrack(data.track);
      } catch { setSpotifyConnected(false); }
    }
    fetchTrack();
  }, [musicQuery]);

  // When clip changes, reload video
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !streamUrl) return;
    v.load();
    if (playing) v.play().catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, streamUrl]);

  function syncAudio(shouldPlay: boolean) {
    const a = audioRef.current;
    if (!a) return;
    if (shouldPlay && a.paused) a.play().catch(() => {});
    else if (!shouldPlay && !a.paused) a.pause();
  }

  function onEnded() {
    if (idx < clips.length - 1) { setIdx(i => i + 1); }
    else { setPlaying(false); syncAudio(false); setIdx(0); }
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play().catch(() => {}); syncAudio(true); setPlaying(true); }
    else { v.pause(); syncAudio(false); setPlaying(false); }
  }

  function jumpTo(i: number) {
    setIdx(i); setPlaying(false); syncAudio(false);
    if (audioRef.current) audioRef.current.currentTime = 0;
  }

  function removeClip(i: number) {
    setClips(prev => prev.filter((_, ci) => ci !== i));
    if (idx >= i && idx > 0) setIdx(j => j - 1);
  }

  function moveClip(from: number, to: number) {
    setClips(prev => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  if (!streamUrl || clips.length === 0) return (
    <div className="preview-no-video">No video clips — add video assets in Step 2.</div>
  );

  return (
    <div className="seq-player">
      {/* Hidden Spotify audio */}
      {spotifyTrack?.previewUrl && (
        <audio ref={audioRef} src={spotifyTrack.previewUrl} loop preload="auto" />
      )}

      <div className="seq-layout">
        {/* Left: video */}
        <div className="seq-left">
          <div className="seq-video-wrap">
            <video ref={videoRef} className="seq-video" onEnded={onEnded} onClick={togglePlay}
              src={streamUrl} playsInline controls={false} style={{ cursor: 'pointer' }} />
            {current?.clip?.overlayText && (
              <div className="seq-overlay-text">{current.clip.overlayText}</div>
            )}
            {!playing && (
              <div className="seq-play-btn" onClick={togglePlay}>
                <svg viewBox="0 0 24 24" fill="currentColor" width="40" height="40"><polygon points="5,3 19,12 5,21"/></svg>
              </div>
            )}
            <div className="seq-clip-counter">{idx + 1} / {clips.length} · {current?.clip?.role}</div>
          </div>

          {/* Spotify bar */}
          <div className="spotify-bar">
            {spotifyConnected === false && (
              <a href="/api/spotify/login" className="spotify-connect-btn">
                <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
                Connect Spotify
              </a>
            )}
            {spotifyConnected === true && !spotifyTrack && (
              <span className="spotify-searching">Searching Spotify…</span>
            )}
            {spotifyTrack && (
              <>
                {spotifyTrack.albumArt && <img src={spotifyTrack.albumArt} alt="" className="spotify-art" />}
                <div className="spotify-info">
                  <span className="spotify-track-name">{spotifyTrack.name}</span>
                  <span className="spotify-artist">{spotifyTrack.artist}</span>
                </div>
                <span className="spotify-badge">30s preview</span>
                {spotifyTrack.spotifyUrl && (
                  <a href={spotifyTrack.spotifyUrl} target="_blank" rel="noreferrer" className="spotify-open-link">Open ↗</a>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right: live-edit clip list */}
        <div className="seq-edit-panel">
          <div className="seq-edit-title">Edit Clips</div>
          {clips.map((c, i) => (
            <div key={i} className={`seq-edit-row ${i === idx ? 'active' : ''}`} onClick={() => jumpTo(i)}>
              <div className="seq-edit-num">{i + 1}</div>
              {c.asset?.thumbPath
                ? <img src={`/api/thumb?path=${encodeURIComponent(c.asset.thumbPath)}`} alt="" className="seq-edit-thumb" />
                : <div className="seq-edit-thumb-placeholder">🎬</div>
              }
              <div className="seq-edit-info">
                <div className="seq-edit-role" style={{ color: ROLE_COLORS[c.clip.role] ?? '#aaa' }}>{c.clip.role}</div>
                <div className="seq-edit-name">{c.asset?.fileName ?? '—'}</div>
                <div className="seq-edit-dur">{c.clip.suggestedEndSec - c.clip.suggestedStartSec}s</div>
              </div>
              <div className="seq-edit-actions">
                <button className="seq-edit-btn" title="Move up" disabled={i === 0} onClick={e => { e.stopPropagation(); moveClip(i, i - 1); }}>↑</button>
                <button className="seq-edit-btn" title="Move down" disabled={i === clips.length - 1} onClick={e => { e.stopPropagation(); moveClip(i, i + 1); }}>↓</button>
                <button className="seq-edit-btn danger" title="Remove" onClick={e => { e.stopPropagation(); removeClip(i); }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filmstrip scrubber */}
      <div className="seq-filmstrip">
        {clips.map((c, i) => (
          <div key={i} className={`seq-frame ${i === idx ? 'active' : ''}`} onClick={() => jumpTo(i)}>
            {c.asset?.thumbPath
              ? <img src={`/api/thumb?path=${encodeURIComponent(c.asset.thumbPath)}`} alt="" className="seq-frame-img" />
              : <div className="seq-frame-placeholder">🎬</div>
            }
            <div className="seq-frame-role" style={{ background: ROLE_COLORS[c.clip.role] ?? '#555' }}>{c.clip.role}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Story Builder Overlay ────────────────────────────────────────────────────
interface StoryBuilderProps { onClose: () => void; }

function StoryBuilder({ onClose }: StoryBuilderProps) {
  const [step, setStep] = useState(1);
  const [format, setFormat] = useState('instagram-reel');
  const [targetSec, setTargetSec] = useState(30);
  const [intent, setIntent] = useState('');
  const [dsModel, setDsModel] = useState('');
  const [campaign, setCampaign] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [moods, setMoods] = useState<string[]>([]);
  const [customNotes, setCustomNotes] = useState('');

  const [isBuilding, setIsBuilding] = useState(false);
  const [result, setResult] = useState<(StoryBuildResponse & { assets: Asset[] }) | null>(null);
  const [storyboard, setStoryboard] = useState<StoryboardClip[]>([]);
  const [error, setError] = useState('');

  const [drafts, setDrafts] = useState<DraftMeta[]>([]);
  const [draftName, setDraftName] = useState('');
  const [savingDraft, setSavingDraft] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [showDrafts, setShowDrafts] = useState(false);

  const SUBJECTS_BUILD = ['hands', 'piano-keys', 'piano-full', 'talking-head', 'lifestyle', 'product'];

  useEffect(() => { fetchDrafts(); }, []);

  async function fetchDrafts() {
    try {
      const res = await fetch('/api/drafts');
      const data = await res.json();
      setDrafts(data.drafts ?? []);
    } catch {}
  }

  async function handleBuild() {
    setIsBuilding(true); setError(''); setResult(null);
    const body: StoryBuildRequest = { intent, format: format as StoryBuildRequest['format'], targetDurationSec: targetSec, dsModel: dsModel || undefined, campaign: campaign || undefined, subjects, moods, customNotes };
    try {
      const res = await fetch('/api/story-build', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
      setStoryboard(data.storyboard ?? []);
      setStep(2);
      setDraftName(`${FORMATS.find(f => f.id === format)?.label ?? 'Reel'} — ${new Date().toLocaleDateString()}`);
    } catch (err) { setError(String(err)); }
    setIsBuilding(false);
  }

  async function handleSaveDraft() {
    if (!result || !draftName.trim()) return;
    setSavingDraft(true);
    try {
      const res = await fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: draftName, data: { brief: { format, targetSec, intent, dsModel, campaign, subjects, moods, customNotes }, storyboard, result } }),
      });
      if (res.ok) { setSavedMsg('Saved!'); setTimeout(() => setSavedMsg(''), 2000); fetchDrafts(); }
    } catch {}
    setSavingDraft(false);
  }

  async function handleLoadDraft(id: string) {
    try {
      const res = await fetch(`/api/drafts?id=${id}`);
      const data = await res.json();
      const { brief, storyboard: sb, result: r } = data.data;
      setFormat(brief.format); setTargetSec(brief.targetSec); setIntent(brief.intent);
      setDsModel(brief.dsModel ?? ''); setCampaign(brief.campaign ?? '');
      setSubjects(brief.subjects ?? []); setMoods(brief.moods ?? []); setCustomNotes(brief.customNotes ?? '');
      setResult(r); setStoryboard(sb); setStep(2); setShowDrafts(false);
    } catch {}
  }

  async function handleDeleteDraft(id: string) {
    await fetch(`/api/drafts?id=${id}`, { method: 'DELETE' });
    fetchDrafts();
  }

  function toggleSubj(s: string) { setSubjects(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]); }
  function toggleMood(m: string) { setMoods(p => p.includes(m) ? p.filter(x => x !== m) : [...p, m]); }

  const selectedAsset = (id: string) => result?.assets?.find(a => a.id === id);

  return (
    <div className="story-overlay" onClick={e => { if ((e.target as HTMLElement).classList.contains('story-overlay')) onClose(); }}>
      <div className="story-panel">
        {/* Header */}
        <div className="story-header">
          <div className="story-header-left">
            <span className="story-icon">🎬</span>
            <div>
              <div className="story-title">Story Builder</div>
              <div className="story-subtitle">AI-powered reel planner — clips, script, music & preview</div>
            </div>
          </div>
          <div className="story-header-right">
            <button className="story-drafts-btn" onClick={() => setShowDrafts(v => !v)}>
              📁 Drafts {drafts.length > 0 && <span className="story-draft-count">{drafts.length}</span>}
            </button>
            <button className="story-close-btn" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Drafts panel */}
        {showDrafts && (
          <div className="story-drafts-panel">
            {drafts.length === 0 ? (
              <div className="story-drafts-empty">No saved drafts yet</div>
            ) : drafts.map(d => (
              <div key={d.id} className="story-draft-row">
                <div className="story-draft-info">
                  <div className="story-draft-name">{d.name}</div>
                  <div className="story-draft-date">{new Date(d.updatedAt).toLocaleDateString()}</div>
                </div>
                <div className="story-draft-actions">
                  <button className="story-draft-load" onClick={() => handleLoadDraft(d.id)}>Load</button>
                  <button className="story-draft-del" onClick={() => handleDeleteDraft(d.id)}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stepper */}
        <div className="story-stepper">
          {['Brief', 'Clips', 'Story', 'Music', 'Preview'].map((s, i) => (
            <button
              key={s}
              className={`story-step ${step === i + 1 ? 'active' : ''} ${result && i > 0 ? 'enabled' : i === 0 ? 'enabled' : 'disabled'}`}
              onClick={() => { if (i === 0 || result) setStep(i + 1); }}
            >
              <span className="story-step-num">{i + 1}</span>
              <span className="story-step-label">{s}</span>
            </button>
          ))}
        </div>

        {/* Step Content */}
        <div className="story-content">

          {/* ── Step 1: Brief ── */}
          {step === 1 && (
            <div className="story-step-content">
              <div className="story-section-title">What are we making?</div>

              <div className="story-field">
                <div className="story-field-label">Format</div>
                <div className="story-format-chips">
                  {FORMATS.map(f => (
                    <button key={f.id} className={`story-format-chip ${format === f.id ? 'active' : ''}`}
                      onClick={() => { setFormat(f.id); setTargetSec(f.sec); }}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="story-field">
                <div className="story-field-label">Target Length</div>
                <div className="story-duration-row">
                  {[15, 20, 30, 45, 60, 90].map(s => (
                    <button key={s} className={`story-dur-chip ${targetSec === s ? 'active' : ''}`} onClick={() => setTargetSec(s)}>{s}s</button>
                  ))}
                </div>
              </div>

              <div className="story-field">
                <div className="story-field-label">Intent / Goal</div>
                <textarea className="story-intent-input" placeholder="e.g. Showcase the DS6.0 for small-handed pianists, drive link in bio clicks, emotional hook using La Campanella performance…" value={intent} onChange={e => setIntent(e.target.value)} rows={3} />
              </div>

              <div className="story-two-col">
                <div className="story-field">
                  <div className="story-field-label">DS Model Focus</div>
                  <div className="story-chip-row">
                    {['', 'DS5.5', 'DS6.0', 'DS6.5'].map(m => (
                      <button key={m} className={`story-chip ${dsModel === m ? 'active' : ''}`} onClick={() => setDsModel(m)}>{m || 'Any'}</button>
                    ))}
                  </div>
                </div>
                <div className="story-field">
                  <div className="story-field-label">Campaign</div>
                  <div className="story-chip-row">
                    {['', 'CEO Spotlight', 'Piano Comparison', 'La Campanella', 'NAMM', 'Handspan Measurement'].map(c => (
                      <button key={c} className={`story-chip ${campaign === c ? 'active' : ''}`} onClick={() => setCampaign(c)}>{c || 'Any'}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="story-two-col">
                <div className="story-field">
                  <div className="story-field-label">Include Subjects</div>
                  <div className="story-chip-row wrap">
                    {SUBJECTS_BUILD.map(s => (
                      <button key={s} className={`story-chip ${subjects.includes(s) ? 'active' : ''}`} onClick={() => toggleSubj(s)}>{s}</button>
                    ))}
                  </div>
                </div>
                <div className="story-field">
                  <div className="story-field-label">Mood Direction</div>
                  <div className="story-chip-row wrap">
                    {MOOD_PRESETS.map(m => (
                      <button key={m.id} className={`story-chip ${moods.includes(m.id) ? 'active' : ''}`} onClick={() => toggleMood(m.id)}>{m.label}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="story-field">
                <div className="story-field-label">Additional Notes</div>
                <textarea className="story-intent-input" placeholder="Anything else for the AI director…" value={customNotes} onChange={e => setCustomNotes(e.target.value)} rows={2} />
              </div>

              {error && <div className="prompt-error">⚠ {error}</div>}

              <button className="story-build-btn" onClick={handleBuild} disabled={isBuilding || !intent.trim()}>
                {isBuilding ? <><span className="prompt-spinner" /> Analyzing library & building story…</> : '🎬 Generate Story'}
              </button>
              {isBuilding && (
                <div className="story-building-status">
                  <div className="shimmer-bar w90" /><div className="shimmer-bar w70" /><div className="shimmer-bar w80" />
                  <div className="story-building-label">Gemini is selecting your best clips and scripting the reel…</div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Clips ── */}
          {step === 2 && result && (
            <div className="story-step-content">
              <div className="story-section-title">Selected Clips <span className="story-section-sub">— reorder or swap by revisiting the library</span></div>
              <div className="story-hook-banner">
                <span className="story-hook-label">🎯 Hook Line</span>
                <span className="story-hook-text">{result.hookLine}</span>
              </div>
              <div className="storyboard-list">
                {storyboard.map((clip, idx) => {
                  const asset = selectedAsset(clip.assetId);
                  return (
                    <div key={clip.assetId + idx} className="storyboard-card">
                      <div className="storyboard-num">{clip.order}</div>
                      <div className="storyboard-thumb">
                        {asset?.thumbPath
                          ? <img src={thumbUrl(asset)} alt={asset.fileName} className="storyboard-thumb-img" />
                          : <div className="storyboard-thumb-placeholder">{asset?.mediaType === 'video' ? '🎬' : '🖼'}</div>}
                        <div className="storyboard-role-badge" style={{ background: ROLE_COLORS[clip.role] ?? '#666' }}>{clip.role}</div>
                      </div>
                      <div className="storyboard-info">
                        <div className="storyboard-filename">{asset?.fileName ?? clip.assetId}</div>
                        <div className="storyboard-timing">{clip.suggestedStartSec}s – {clip.suggestedEndSec}s · {clip.suggestedEndSec - clip.suggestedStartSec}s</div>
                        <div className="storyboard-script">"{clip.scriptLine}"</div>
                        {clip.overlayText && (
                          <div className="storyboard-overlay">
                            <span className="storyboard-overlay-badge">{clip.overlayStyle}</span> "{clip.overlayText}" <span className="storyboard-overlay-pos">— {clip.overlayPlacement}</span>
                          </div>
                        )}
                        <div className="storyboard-transition">→ {clip.transitionNote}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Step 3: Story / Script ── */}
          {step === 3 && result && (
            <div className="story-step-content">
              <div className="story-section-title">Script & Text Overlays</div>
              <div className="story-script-block">
                <div className="story-script-label">Full Voiceover Script</div>
                <div className="story-script-text">{result.fullScript}</div>
              </div>
              <div className="story-script-label" style={{ marginTop: 20 }}>Line by Line</div>
              <div className="story-voiceover-list">
                {result.voiceoverLines?.map((line, i) => (
                  <div key={i} className="story-vo-row">
                    <span className="story-vo-num">{i + 1}</span>
                    <span className="story-vo-line">{line}</span>
                  </div>
                ))}
              </div>
              <div className="story-script-label" style={{ marginTop: 20 }}>Text Overlay Plan</div>
              <div className="story-overlay-list">
                {result.textOverlayPlan?.map((t, i) => (
                  <div key={i} className="story-overlay-row">
                    <span className="story-overlay-clip">Clip {t.clipOrder}</span>
                    <span className="story-overlay-text">"{t.text}"</span>
                    <span className="story-overlay-meta">{t.style} · {t.placement} · {t.timing}</span>
                  </div>
                ))}
              </div>
              <div className="story-cta-block">
                <span className="story-cta-label">CTA →</span>
                <span className="story-cta-text">{result.callToAction}</span>
              </div>
              {result.directorNotes && (
                <div className="story-director-notes">
                  <span className="story-director-label">🎬 Director Notes</span>
                  <span className="story-director-text">{result.directorNotes}</span>
                </div>
              )}
            </div>
          )}

          {/* ── Step 4: Music ── */}
          {step === 4 && result?.musicSuggestion && (
            <div className="story-step-content">
              <div className="story-section-title">Music Direction</div>
              {(() => {
                const m: MusicSuggestion = result.musicSuggestion;
                return (
                  <>
                    <div className="music-meta-row">
                      <div className="music-meta-card">
                        <div className="music-meta-label">Mood</div>
                        <div className="music-meta-val">{m.mood}</div>
                      </div>
                      <div className="music-meta-card">
                        <div className="music-meta-label">BPM Range</div>
                        <div className="music-meta-val">{m.bpmRange}</div>
                      </div>
                      <div className="music-meta-card">
                        <div className="music-meta-label">Energy</div>
                        <div className={`music-meta-val energy-${m.energy}`}>{m.energy.toUpperCase()}</div>
                      </div>
                    </div>
                    <div className="music-genres">
                      {m.genres?.map((g, i) => <span key={i} className="music-genre-chip">{g}</span>)}
                    </div>
                    <div className="story-script-label" style={{ marginTop: 20 }}>Trending Song Suggestions</div>
                    <div className="music-songs-list">
                      {m.trendingSongs?.map((s, i) => (
                        <div key={i} className="music-song-card">
                          <div className="music-song-top">
                            <span className="music-song-num">{i + 1}</span>
                            <span className="music-song-title">{s.title}</span>
                            <span className="music-song-artist">— {s.artist}</span>
                            <a href={`https://open.spotify.com/search/${encodeURIComponent(s.title + ' ' + s.artist)}`} target="_blank" rel="noreferrer" className="music-spotify-link">Spotify ↗</a>
                          </div>
                          <div className="music-song-why">{s.why}</div>
                        </div>
                      ))}
                    </div>
                    {m.productionNotes && (
                      <div className="story-director-notes" style={{ marginTop: 16 }}>
                        <span className="story-director-label">🎚 Production Notes</span>
                        <span className="story-director-text">{m.productionNotes}</span>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {/* \u2500\u2500 Step 5: Preview \u2500\u2500 */}
          {step === 5 && result && (() => {
            const videoClips = storyboard
              .map(clip => ({ clip, asset: selectedAsset(clip.assetId) }))
              .filter(({ asset }) => asset?.mediaType === 'video' && asset?.filePath);
            return (
              <div className="story-step-content">
                <div className="story-section-title">Reel Preview
                  <span className="story-section-sub"> — {videoClips.length} clips · plays in sequence</span>
                </div>

                {/* Sequential video player */}
                {videoClips.length > 0
                  ? <SequentialPlayer clips={videoClips} musicQuery={result.musicSuggestion ? `${result.musicSuggestion.trendingSongs?.[0]?.title ?? ''} ${result.musicSuggestion.trendingSongs?.[0]?.artist ?? ''}`.trim() || result.musicSuggestion.mood : undefined} />
                  : (
                    <div className="preview-no-video">
                      <span>No video clips selected — add video assets in Step 2 to preview.</span>
                    </div>
                  )
                }

                {/* Full script preview */}
                <div className="story-preview-script">
                  <div className="story-script-label">📝 Full Script</div>
                  <div className="story-script-text">{result.fullScript}</div>
                </div>

                {/* Music quick-ref */}
                {result.musicSuggestion && (
                  <div className="story-preview-music">
                    <span className="story-preview-music-label">🎵 Music</span>
                    <span>{result.musicSuggestion.mood} · {result.musicSuggestion.bpmRange} BPM · {result.musicSuggestion.energy} energy</span>
                    {result.musicSuggestion.trendingSongs?.[0] && (
                      <span className="story-preview-song">Try: &quot;{result.musicSuggestion.trendingSongs[0].title}&quot; — {result.musicSuggestion.trendingSongs[0].artist}</span>
                    )}
                  </div>
                )}

                {/* Save draft */}
                <div className="story-save-row">
                  <input className="story-draft-name-input" placeholder="Draft name…" value={draftName} onChange={e => setDraftName(e.target.value)} />
                  <button className="story-save-btn" onClick={handleSaveDraft} disabled={savingDraft || !draftName.trim()}>
                    {savingDraft ? 'Saving…' : savedMsg || '💾 Save Draft'}
                  </button>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Footer nav */}
        {result && (
          <div className="story-footer">
            <button className="story-nav-btn" onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1}>← Back</button>
            <div className="story-footer-center">
              <input className="story-draft-name-input small" placeholder="Draft name…" value={draftName} onChange={e => setDraftName(e.target.value)} />
              <button className="story-save-btn small" onClick={handleSaveDraft} disabled={savingDraft || !draftName.trim()}>
                {savedMsg || '💾 Save'}
              </button>
            </div>
            <button className="story-nav-btn next" onClick={() => setStep(s => Math.min(5, s + 1))} disabled={step === 5}>Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function MediaIndexer() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, finals: 0, highPriority: 0 });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<Asset | null>(null);
  const [exporting, setExporting] = useState(false);
  const [copyMsg, setCopyMsg] = useState('');
  const [showStoryBuilder, setShowStoryBuilder] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(180);
  const [scanStatus, setScanStatus] = useState<{ status: 'idle' | 'scanning'; lastScan: number | null }>({ status: 'idle', lastScan: null });
  const [scanning, setScanning] = useState(false);
  const [sidebarW, setSidebarW] = useState(210);
  const isDraggingRef = useRef(false);
  const lastClickedRef = useRef<string | null>(null);

  // Draggable sidebar resizer
  function startSidebarDrag(e: React.MouseEvent) {
    e.preventDefault();
    isDraggingRef.current = true;
    const startX = e.clientX;
    const startW = sidebarW;
    function onMove(ev: MouseEvent) {
      if (!isDraggingRef.current) return;
      const next = Math.max(140, Math.min(400, startW + ev.clientX - startX));
      setSidebarW(next);
    }
    function onUp() {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  // Poll scan status every 10s
  useEffect(() => {
    async function pollStatus() {
      try {
        const res = await fetch('/api/ingest');
        const data = await res.json();
        setScanStatus(data);
        if (data.status === 'idle' && scanning) {
          setScanning(false);
          fetchAssets(); // refresh grid after scan completes
        }
      } catch { /* ignore */ }
    }
    pollStatus();
    const id = setInterval(pollStatus, 10_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  const [filters, setFilters] = useState({
    search: '', finalStatus: '', priority: '', subject: '', handZone: '',
    dsModel: '', purpose: '', campaign: '', shotType: '', colorLabel: '',
    mediaType: '', orientation: '',
  });

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
    try {
      const res = await fetch(`/api/assets?${params}`);
      const data = await res.json();
      setAssets(data.assets ?? []);
      setTotal(data.total ?? 0);
      setStats(data.stats ?? { total: 0, finals: 0, highPriority: 0 });
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [filters]);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  // Keyboard shortcuts: Space → preview last selected, Escape → close, Cmd+0 → reset
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        const id = lastClickedRef.current;
        if (id) {
          setDetail(prev => {
            if (prev) return null;
            return assets.find(a => a.id === id) ?? null;
          });
        }
      }
      if (e.code === 'Escape') setDetail(null);
      // Cmd+0 → reset all panel sizes and zoom
      if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        e.preventDefault();
        setSidebarW(210);
        setZoomLevel(180);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [assets]);

  function setFilter(key: string, value: string) {
    setFilters(prev => ({ ...prev, [key]: prev[key as keyof typeof prev] === value ? '' : value }));
  }

  function handleAssetClick(asset: Asset, e: React.MouseEvent) {
    if (e.shiftKey && lastClickedRef.current) {
      const ids = assets.map(a => a.id);
      const lastIdx = ids.indexOf(lastClickedRef.current);
      const curIdx = ids.indexOf(asset.id);
      const [start, end] = lastIdx < curIdx ? [lastIdx, curIdx] : [curIdx, lastIdx];
      setSelected(prev => { const next = new Set(prev); ids.slice(start, end + 1).forEach(id => next.add(id)); return next; });
    } else if (e.metaKey || e.ctrlKey) {
      setSelected(prev => { const next = new Set(prev); if (next.has(asset.id)) next.delete(asset.id); else next.add(asset.id); return next; });
    } else if (e.altKey) {
      setDetail(asset);
    } else {
      setSelected(prev => { const next = new Set(prev); if (next.has(asset.id)) next.delete(asset.id); else { next.clear(); next.add(asset.id); } return next; });
    }
    lastClickedRef.current = asset.id;
  }

  async function handleExport(format: 'davinci' | 'fcpxml') {
    if (!selected.size) return;
    setExporting(true);
    try {
      const res = await fetch('/api/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: Array.from(selected), format, timelineName: 'DreamPlay Timeline' }) });
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') ?? '';
      const fnMatch = cd.match(/filename="(.+)"/);
      const filename = fnMatch ? fnMatch[1] : `timeline.${format === 'fcpxml' ? 'fcpxml' : 'xml'}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error(e); }
    setExporting(false);
  }

  async function handleScanNow() {
    if (scanning) return;
    setScanning(true);
    await fetch('/api/ingest', { method: 'POST' });
  }

  const selectedAssets = assets.filter(a => selected.has(a.id));
  const totalSelectedDuration = selectedAssets.reduce((sum, a) => sum + (a.durationSeconds ?? 0), 0);

  const lastScanLabel = scanStatus.lastScan
    ? new Date(scanStatus.lastScan).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <div className="logo-mark">🎹</div>
          <div>
            <div className="app-title">DreamPlay Media Indexer</div>
          </div>
        </div>
        {/* Prominent center search bar */}
        <input
          className="header-search"
          placeholder="Search assets, keywords, descriptions…"
          value={filters.search}
          onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
        />
        <div className="header-stats">
          <div className="stat-pill"><span className="stat-num">{stats.total.toLocaleString()}</span><span className="stat-label">Total</span></div>
          <div className="stat-pill"><span className="stat-num">{stats.finals.toLocaleString()}</span><span className="stat-label">Finals</span></div>
          <div className="stat-pill high"><span className="stat-num">{stats.highPriority.toLocaleString()}</span><span className="stat-label">Priority</span></div>
          <div className="scan-controls">
            {/* Broadcast live indicator */}
            <div className={`scan-indicator ${scanStatus.status === 'scanning' ? 'scanning' : 'idle'}`} title={scanStatus.status === 'scanning' ? 'Scanning…' : lastScanLabel ? `Last scan ${lastScanLabel}` : 'Idle'}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5.636 5.636a9 9 0 1 0 12.728 0M8.464 8.464a5 5 0 1 0 7.072 0M12 12m0 0v.01" />
              </svg>
            </div>
            {/* Refresh button — minimalist */}
            <button className="scan-refresh-btn" onClick={handleScanNow} disabled={scanning} title="Scan now">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={scanning ? 'spinning' : ''}>
                <path d="M21 12a9 9 0 0 0-9-9 9 9 0 0 0-6.36 2.64L3 8" />
                <path d="M3 3v5h5" />
                <path d="M3 12a9 9 0 0 0 9 9 9 9 0 0 0 6.36-2.64L21 16" />
                <path d="M16 16h5v5" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div className="app-body">
        <aside className="sidebar" style={{ width: sidebarW, minWidth: sidebarW }}>
          <div className="filter-section">
            <div className="filter-label">Quick Filters</div>
            <div className="chip-row">
              <button className={`chip ${filters.priority === 'high' ? 'active' : ''}`} onClick={() => setFilter('priority', 'high')}>⚡ Priority</button>
              <button className={`chip ${filters.finalStatus === 'final' ? 'active' : ''}`} onClick={() => setFilter('finalStatus', 'final')}>✅ Finals Only</button>
              <button className={`chip ${filters.mediaType === 'video' ? 'active' : ''}`} onClick={() => setFilter('mediaType', 'video')}>🎬 Video</button>
              <button className={`chip ${filters.mediaType === 'image' ? 'active' : ''}`} onClick={() => setFilter('mediaType', 'image')}>🖼 Photo</button>
            </div>
          </div>
          <div className="filter-section">
            {/* Search duplicate removed — now in header */}
          </div>
          <div className="filter-section">
            <div className="filter-label">Color Label</div>
            <div className="color-chip-row">
              {Object.entries(COLOR_CHIPS).map(([key, { bg, label }]) => (
                <button key={key} className={`color-chip ${filters.colorLabel === key ? 'active' : ''}`} style={{ background: bg }} title={label} onClick={() => setFilter('colorLabel', key)} />
              ))}
            </div>
          </div>
          <div className="filter-section">
            <div className="filter-label">Hand Zone</div>
            <div className="chip-row">
              {['Zone A', 'Zone B', 'Zone C'].map(z => (
                <button key={z} className={`chip ${filters.handZone === z ? 'active' : ''}`} onClick={() => setFilter('handZone', z)}>{z} {z === 'Zone A' ? '(DS5.5)' : z === 'Zone B' ? '(DS6.0)' : '(DS6.5)'}</button>
              ))}
            </div>
          </div>
          <div className="filter-section">
            <div className="filter-label">DS Model</div>
            <div className="chip-row">
              {['DS5.5', 'DS6.0', 'DS6.5'].map(m => (<button key={m} className={`chip ${filters.dsModel === m ? 'active' : ''}`} onClick={() => setFilter('dsModel', m)}>{m}</button>))}
            </div>
          </div>
          <div className="filter-section">
            <div className="filter-label">Subject</div>
            <div className="chip-row wrap">{SUBJECTS.map(s => (<button key={s} className={`chip ${filters.subject === s ? 'active' : ''}`} onClick={() => setFilter('subject', s)}>{s}</button>))}</div>
          </div>
          <div className="filter-section">
            <div className="filter-label">Purpose</div>
            <div className="chip-row wrap">{PURPOSES.map(p => (<button key={p} className={`chip ${filters.purpose === p ? 'active' : ''}`} onClick={() => setFilter('purpose', p)}>{p}</button>))}</div>
          </div>
          <div className="filter-section">
            <div className="filter-label">Campaign</div>
            <div className="chip-row wrap">{CAMPAIGNS.map(c => (<button key={c} className={`chip ${filters.campaign === c ? 'active' : ''}`} onClick={() => setFilter('campaign', c)}>{c}</button>))}</div>
          </div>
          <div className="filter-section">
            <div className="filter-label">Shot Type</div>
            <div className="chip-row wrap">{SHOT_TYPES.map(s => (<button key={s} className={`chip ${filters.shotType === s ? 'active' : ''}`} onClick={() => setFilter('shotType', s)}>{s}</button>))}</div>
          </div>
          <div className="filter-section">
            <div className="filter-label">Status</div>
            <div className="chip-row">{['final', 'raw', 'intermediate'].map(s => (<button key={s} className={`chip ${filters.finalStatus === s ? 'active' : ''}`} onClick={() => setFilter('finalStatus', s)}>{s}</button>))}</div>
          </div>
          <div className="filter-section">
            <div className="filter-label">Orientation</div>
            <div className="chip-row">{['landscape', 'portrait', 'square'].map(o => (<button key={o} className={`chip ${filters.orientation === o ? 'active' : ''}`} onClick={() => setFilter('orientation', o)}>{o}</button>))}</div>
          </div>
          {Object.values(filters).some(v => v) && (
            <button className="reset-btn" onClick={() => setFilters({ search: '', finalStatus: '', priority: '', subject: '', handZone: '', dsModel: '', purpose: '', campaign: '', shotType: '', colorLabel: '', mediaType: '', orientation: '' })}>✕ Clear All Filters</button>
          )}
        </aside>
        <div className="sidebar-resize-handle" onMouseDown={startSidebarDrag} title="Drag to resize" />
        <main className="main-content">
          <PromptBox />
          <div className="grid-header">
            <div className="grid-info">
              {loading ? 'Loading…' : `${total.toLocaleString()} assets`}
              {selected.size > 0 && <span className="selected-badge">{selected.size} selected</span>}
              <div className="zoom-slider-wrap">
                <span className="zoom-icon">🔍</span>
                <input type="range" className="zoom-slider" min="60" max="360" step="10" value={zoomLevel} onChange={e => setZoomLevel(Number(e.target.value))} title="Adjust thumbnail size" />
              </div>
            </div>
            <div className="grid-actions">
              <button className="story-builder-btn" onClick={() => setShowStoryBuilder(true)}>🎬 Build Story</button>
              {selected.size > 0 && (
                <>
                  <button className="btn-ghost" onClick={() => setSelected(new Set())}>Deselect All</button>
                  <button className="btn-ghost" onClick={() => setSelected(new Set(assets.map(a => a.id)))}>Select All ({assets.length})</button>
                </>
              )}
            </div>
          </div>

          <div className={`asset-grid ${zoomLevel < 120 ? 'dense' : ''}`} style={{ gridTemplateColumns: `repeat(auto-fill, minmax(max(${zoomLevel}px, 6.5%), 1fr))` }}>
            {assets.map(asset => {
              const isSelected = selected.has(asset.id);
              const thumb = thumbUrl(asset);
              const keywords = (() => { try { return JSON.parse(asset.aiKeywords) as string[]; } catch { return []; } })();
              return (
                <div key={asset.id} className={`asset-card ${isSelected ? 'selected' : ''} ${asset.priority === 'high' ? 'priority' : ''} ${asset.orientation === 'portrait' ? 'portrait' : ''}`} onClick={(e) => handleAssetClick(asset, e)} onDoubleClick={() => setDetail(asset)}>
                  <div className="asset-thumb-wrap" style={{ aspectRatio: asset.orientation === 'portrait' ? '9/16' : asset.orientation === 'square' ? '1/1' : '16/9' }}>
                    {thumb ? <img src={thumb} alt={asset.fileName} className="asset-thumb" loading="lazy" /> : <div className="asset-thumb-placeholder">{asset.mediaType === 'video' ? '🎬' : '🖼'}</div>}
                    {asset.mediaType === 'video' && (<div className="video-overlay"><span className="play-icon">▶</span>{asset.durationSeconds && <span className="duration-badge">{formatDuration(asset.durationSeconds)}</span>}</div>)}
                    {asset.finalStatus === 'final' && <div className="final-badge">FINAL</div>}
                    {asset.priority === 'high' && <div className="priority-dot" style={{ background: asset.colorLabel ? COLOR_CHIPS[asset.colorLabel]?.bg : '#ef4444' }} />}
                    {isSelected && <div className="selected-checkmark">✓</div>}
                  </div>
                  <div className="asset-info">
                    <div className="asset-name" title={asset.fileName}>{asset.fileName}</div>
                    <div className="asset-desc">{asset.aiDescription || '—'}</div>
                    <div className="asset-tags">
                      {asset.subject !== 'unknown' && <span className="tag">{asset.subject}</span>}
                      {asset.handZone && <span className="tag zone">{asset.handZone}</span>}
                      {asset.dsModel && <span className="tag ds">{asset.dsModel}</span>}
                      {asset.purpose !== 'unknown' && <span className="tag">{asset.purpose}</span>}
                      {keywords.slice(0, 2).map((k, i) => <span key={i} className="tag muted">{k}</span>)}
                    </div>
                  </div>
                </div>
              );
            })}
            {!loading && assets.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">🎹</div>
                <div className="empty-title">No assets found</div>
                <div className="empty-msg">{stats.total === 0 ? 'Run the ingestion script to index your DreamPlay assets:\npnpm ingest' : 'Try adjusting your filters'}</div>
              </div>
            )}
          </div>
        </main>
      </div>

      {selected.size > 0 && (
        <div className="export-tray">
          <div className="tray-info">
            <span className="tray-count">{selected.size} clips selected</span>
            {totalSelectedDuration > 0 && <span className="tray-duration">· {formatDuration(totalSelectedDuration)} total</span>}
          </div>
          <div className="tray-actions">
            <button className="btn-ghost tray-btn" onClick={() => { const sa = assets.filter(a => selected.has(a.id)); navigator.clipboard.writeText(sa.map(a => a.filePath).join('\n')); setCopyMsg('Copied!'); setTimeout(() => setCopyMsg(''), 2000); }}>{copyMsg || '📋 Copy Paths'}</button>
            <button className="btn-export fcp" onClick={() => handleExport('fcpxml')} disabled={exporting}>{exporting ? '…' : '🎬 Export FCPXML'}</button>
            <button className="btn-export davinci" onClick={() => handleExport('davinci')} disabled={exporting}>{exporting ? '…' : '🎨 Export DaVinci XML'}</button>
          </div>
        </div>
      )}

      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="preview-panel" onClick={e => e.stopPropagation()}>

            {/* Left — large thumbnail */}
            <div className="preview-media">
              {detail.thumbPath
                ? <img src={thumbUrl(detail)} alt={detail.fileName} className="preview-thumb" />
                : <div className="preview-thumb-placeholder">{detail.mediaType === 'video' ? '🎬' : '🖼'}</div>
              }
              {detail.mediaType === 'video' && detail.durationSeconds && (
                <div className="preview-duration">{formatDuration(detail.durationSeconds)}</div>
              )}
              {detail.finalStatus === 'final' && <div className="preview-final-badge">FINAL</div>}
            </div>

            {/* Right — info */}
            <div className="preview-info">
              <div className="preview-header">
                <div className="preview-filename">{detail.fileName}</div>
                <button className="modal-close" onClick={() => setDetail(null)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>

              <div className="preview-desc">{detail.aiDescription || '—'}</div>

              <div className="preview-meta-grid">
                {[
                  ['Status', <span key="s" className={`status-badge ${detail.finalStatus}`}>{detail.finalStatus}</span>],
                  ['Priority', detail.priority],
                  ['Subject', detail.subject],
                  ['DS Model', detail.dsModel ?? '—'],
                  ['Shot Type', detail.shotType],
                  ['Orientation', detail.orientation ?? '—'],
                  ['Duration', formatDuration(detail.durationSeconds)],
                  ['Resolution', detail.width && detail.height ? `${detail.width}×${detail.height}` : '—'],
                  ['FPS', detail.fps?.toFixed(2) ?? '—'],
                  ['Codec', detail.codec ?? '—'],
                  ['File Size', formatBytes(detail.fileSize)],
                  ['Campaign', detail.campaign ?? '—'],
                  ['Mood', detail.mood || '—'],
                  ['Color Grade', detail.colorGrade || '—'],
                ].map(([label, val]) => (
                  <div key={String(label)} className="preview-meta-row">
                    <span className="preview-meta-label">{label}</span>
                    <span className="preview-meta-val">{val}</span>
                  </div>
                ))}
              </div>

              <div className="preview-keywords">
                {(() => { try { return JSON.parse(detail.aiKeywords) as string[]; } catch { return []; } })()
                  .map((k, i) => <span key={i} className="tag">{k}</span>)}
              </div>

              <div className="preview-path-row">
                <span className="preview-path">{detail.filePath}</span>
                <button className="preview-icon-btn" title="Copy path" onClick={() => { navigator.clipboard.writeText(detail.filePath); setCopyMsg('Copied!'); setTimeout(() => setCopyMsg(''), 1500); }}>
                  {copyMsg === 'Copied!'
                    ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M20 6L9 17l-5-5"/></svg>
                    : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  }
                </button>
              </div>

              <div className="preview-actions">
                <button className="preview-reveal-btn" onClick={async () => {
                  await fetch('/api/reveal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: detail.filePath }) });
                }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                  Reveal in Finder
                </button>
                <button className="preview-select-btn" onClick={() => { setSelected(prev => { const n = new Set(prev); n.add(detail.id); return n; }); setDetail(null); }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg>
                  Add to Selection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showStoryBuilder && <StoryBuilder onClose={() => setShowStoryBuilder(false)} />}
    </div>
  );
}
