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

interface Asset {
  id: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  mediaType: 'video' | 'image';
  durationSeconds: number | null;
  subject: string;
  handZone: string | null;
  dsModel: string | null;
  purpose: string;
  campaign: string;
  shotType: string;
  finalStatus: string;
  colorLabel: string | null;
  priority: string;
  mood: string;
  colorGrade: string;
  aiDescription: string;
  aiKeywords: string;
  thumbPath: string | null;
  orientation: string | null;
  aspectRatio: string | null;
  width: number | null;
  height: number | null;
  codec: string | null;
  fps: number | null;
  updatedAt: number;
}

interface Stats { total: number; finals: number; highPriority: number; }

const COLOR_CHIPS: Record<string, { bg: string; label: string }> = {
  red: { bg: '#ef4444', label: 'Red' },
  orange: { bg: '#f97316', label: 'Orange' },
  yellow: { bg: '#eab308', label: 'Yellow' },
  green: { bg: '#22c55e', label: 'Green' },
  blue: { bg: '#3b82f6', label: 'Blue' },
  purple: { bg: '#a855f7', label: 'Purple' },
  gray: { bg: '#6b7280', label: 'Gray' },
};

const SUBJECTS = ['hands', 'piano-keys', 'piano-full', 'talking-head', 'lifestyle', 'product', 'abstract', 'mixed'];
const PURPOSES = ['education', 'marketing', 'social-reel', 'product-demo', 'testimonial', 'b-roll'];
const CAMPAIGNS = ['CEO Spotlight', 'Piano Comparison', 'Handspan Measurement', 'La Campanella', 'NAMM', 'Duel Piano', 'Other'];
const SHOT_TYPES = ['close-up', 'medium', 'wide', 'overhead', 'POV', 'detail'];

function formatDuration(s: number | null): string {
  if (!s) return '';
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

function formatBytes(b: number): string {
  if (b > 1e9) return `${(b / 1e9).toFixed(1)} GB`;
  if (b > 1e6) return `${(b / 1e6).toFixed(1)} MB`;
  return `${(b / 1e3).toFixed(0)} KB`;
}

function thumbUrl(asset: Asset): string {
  if (asset.thumbPath) return `/api/thumb?path=${encodeURIComponent(asset.thumbPath)}`;
  return '';
}

// ── Prompt Box Component ────────────────────────────────────────────────────

function PromptBox() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedShot, setSelectedShot] = useState('');
  const [selectedMood, setSelectedMood] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState('none');
  const [selectedDsModel, setSelectedDsModel] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('');
  const [customNotes, setCustomNotes] = useState('');
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copyMsg, setCopyMsg] = useState('');
  const [error, setError] = useState('');

  async function handleGenerate() {
    setIsGenerating(true);
    setError('');
    setGeneratedPrompt('');

    const subjectPreset = SUBJECT_PRESETS.find(p => p.id === selectedSubject);
    const shotPreset = SHOT_TYPE_PRESETS.find(p => p.id === selectedShot);
    const moodPreset = MOOD_PRESETS.find(p => p.id === selectedMood);
    const campaignPreset = CAMPAIGN_PRESETS.find(p => p.id === selectedCampaign);
    const dsModelData = DS_MODELS[selectedDsModel as keyof typeof DS_MODELS];
    const formatPreset = OUTPUT_FORMAT_PRESETS.find(p => p.id === selectedFormat);

    const body: PromptGenerateRequest = {
      subjectPrompt: subjectPreset?.prompt ?? '',
      shotTypePrompt: shotPreset?.prompt ?? '',
      moodPrompt: moodPreset?.prompt ?? '',
      campaignPrompt: campaignPreset?.id !== 'none' ? (campaignPreset?.prompt ?? '') : '',
      dsModel: selectedDsModel,
      dsModelDescription: dsModelData?.description ?? '',
      outputFormat: formatPreset?.prompt ?? '',
      customNotes,
    };

    try {
      const res = await fetch('/api/prompt-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setGeneratedPrompt(data.prompt);
    } catch (err) {
      setError(String(err));
    }
    setIsGenerating(false);
  }

  function handleCopy() {
    if (!generatedPrompt) return;
    navigator.clipboard.writeText(generatedPrompt);
    setCopyMsg('Copied!');
    setTimeout(() => setCopyMsg(''), 2000);
  }

  function handleReset() {
    setSelectedSubject('');
    setSelectedShot('');
    setSelectedMood('');
    setSelectedCampaign('none');
    setSelectedDsModel('');
    setSelectedFormat('');
    setCustomNotes('');
    setGeneratedPrompt('');
    setError('');
  }

  const hasSelections = selectedSubject || selectedShot || selectedMood || selectedDsModel;

  return (
    <div className={`prompt-box ${isOpen ? 'open' : ''}`}>
      {/* Toggle header */}
      <button className="prompt-toggle" onClick={() => setIsOpen(v => !v)}>
        <span className="prompt-toggle-left">
          <span className="prompt-icon">✨</span>
          <span className="prompt-toggle-title">Prompt Builder</span>
          <span className="prompt-toggle-sub">Generate brand-accurate AI prompts from presets</span>
        </span>
        <span className="prompt-toggle-chevron">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="prompt-body">
          {/* Preset rows */}
          <div className="prompt-presets-grid">
            {/* Subject */}
            <div className="preset-group">
              <div className="preset-label">Subject</div>
              <div className="preset-chips">
                {SUBJECT_PRESETS.map(p => (
                  <button
                    key={p.id}
                    className={`preset-chip ${selectedSubject === p.id ? 'active' : ''}`}
                    onClick={() => setSelectedSubject(v => v === p.id ? '' : p.id)}
                  >{p.label}</button>
                ))}
              </div>
            </div>

            {/* DS Model */}
            <div className="preset-group">
              <div className="preset-label">DS Model</div>
              <div className="preset-chips">
                {Object.entries(DS_MODELS).map(([key, val]) => (
                  <button
                    key={key}
                    className={`preset-chip ds ${selectedDsModel === key ? 'active' : ''}`}
                    onClick={() => setSelectedDsModel(v => v === key ? '' : key)}
                  >{val.label}</button>
                ))}
              </div>
            </div>

            {/* Shot Type */}
            <div className="preset-group">
              <div className="preset-label">Shot Type</div>
              <div className="preset-chips">
                {SHOT_TYPE_PRESETS.map(p => (
                  <button
                    key={p.id}
                    className={`preset-chip ${selectedShot === p.id ? 'active' : ''}`}
                    onClick={() => setSelectedShot(v => v === p.id ? '' : p.id)}
                  >{p.label}</button>
                ))}
              </div>
            </div>

            {/* Mood */}
            <div className="preset-group">
              <div className="preset-label">Mood / Style</div>
              <div className="preset-chips">
                {MOOD_PRESETS.map(p => (
                  <button
                    key={p.id}
                    className={`preset-chip ${selectedMood === p.id ? 'active' : ''}`}
                    onClick={() => setSelectedMood(v => v === p.id ? '' : p.id)}
                  >{p.label}</button>
                ))}
              </div>
            </div>

            {/* Campaign */}
            <div className="preset-group">
              <div className="preset-label">Campaign Context</div>
              <div className="preset-chips">
                {CAMPAIGN_PRESETS.map(p => (
                  <button
                    key={p.id}
                    className={`preset-chip ${selectedCampaign === p.id ? 'active' : ''}`}
                    onClick={() => setSelectedCampaign(v => v === p.id ? 'none' : p.id)}
                  >{p.label}</button>
                ))}
              </div>
            </div>

            {/* Output Format */}
            <div className="preset-group">
              <div className="preset-label">Output Format</div>
              <div className="preset-chips">
                {OUTPUT_FORMAT_PRESETS.map(p => (
                  <button
                    key={p.id}
                    className={`preset-chip ${selectedFormat === p.id ? 'active' : ''}`}
                    onClick={() => setSelectedFormat(v => v === p.id ? '' : p.id)}
                  >{p.label}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Custom notes */}
          <div className="prompt-notes-row">
            <textarea
              className="prompt-notes"
              placeholder="Extra context or details… (e.g. 'show the sustain pedal', 'blue ambient lighting', 'two hands technique')"
              value={customNotes}
              onChange={e => setCustomNotes(e.target.value)}
              rows={2}
            />
          </div>

          {/* Action row */}
          <div className="prompt-actions">
            <button
              className="prompt-generate-btn"
              onClick={handleGenerate}
              disabled={isGenerating || !hasSelections}
            >
              {isGenerating ? (
                <><span className="prompt-spinner" />Generating…</>
              ) : '✨ Generate Prompt'}
            </button>
            {(hasSelections || generatedPrompt) && (
              <button className="prompt-reset-btn" onClick={handleReset}>↺ Reset</button>
            )}
          </div>

          {/* Output */}
          {isGenerating && (
            <div className="prompt-output-shimmer">
              <div className="shimmer-bar w80" />
              <div className="shimmer-bar w60" />
              <div className="shimmer-bar w90" />
              <div className="shimmer-bar w50" />
            </div>
          )}

          {error && <div className="prompt-error">⚠ {error}</div>}

          {generatedPrompt && !isGenerating && (
            <div className="prompt-output-wrap">
              <div className="prompt-output-header">
                <span className="prompt-output-label">Generated Prompt</span>
                <button className="prompt-copy-btn" onClick={handleCopy}>
                  {copyMsg || '📋 Copy'}
                </button>
              </div>
              <textarea
                className="prompt-output"
                readOnly
                value={generatedPrompt}
                rows={5}
              />
            </div>
          )}
        </div>
      )}
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
  const lastClickedRef = useRef<string | null>(null);

  const [filters, setFilters] = useState({
    search: '',
    finalStatus: '',
    priority: '',
    subject: '',
    handZone: '',
    dsModel: '',
    purpose: '',
    campaign: '',
    shotType: '',
    colorLabel: '',
    mediaType: '',
    orientation: '',
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
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [filters]);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  function setFilter(key: string, value: string) {
    setFilters(prev => ({ ...prev, [key]: prev[key as keyof typeof prev] === value ? '' : value }));
  }

  function handleAssetClick(asset: Asset, e: React.MouseEvent) {
    if (e.shiftKey && lastClickedRef.current) {
      const ids = assets.map(a => a.id);
      const lastIdx = ids.indexOf(lastClickedRef.current);
      const curIdx = ids.indexOf(asset.id);
      const [start, end] = lastIdx < curIdx ? [lastIdx, curIdx] : [curIdx, lastIdx];
      const rangeIds = ids.slice(start, end + 1);
      setSelected(prev => {
        const next = new Set(prev);
        rangeIds.forEach(id => next.add(id));
        return next;
      });
    } else if (e.metaKey || e.ctrlKey) {
      setSelected(prev => {
        const next = new Set(prev);
        if (next.has(asset.id)) next.delete(asset.id);
        else next.add(asset.id);
        return next;
      });
    } else if (e.altKey) {
      setDetail(asset);
    } else {
      setSelected(prev => {
        const next = new Set(prev);
        if (next.has(asset.id)) { next.delete(asset.id); }
        else { next.clear(); next.add(asset.id); }
        return next;
      });
    }
    lastClickedRef.current = asset.id;
  }

  async function handleExport(format: 'davinci' | 'fcpxml') {
    if (!selected.size) return;
    setExporting(true);
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected), format, timelineName: 'DreamPlay Timeline' }),
      });
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') ?? '';
      const fnMatch = cd.match(/filename="(.+)"/);
      const filename = fnMatch ? fnMatch[1] : `timeline.${format === 'fcpxml' ? 'fcpxml' : 'xml'}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error(e); }
    setExporting(false);
  }

  function handleCopyPaths() {
    const selectedAssets = assets.filter(a => selected.has(a.id));
    navigator.clipboard.writeText(selectedAssets.map(a => a.filePath).join('\n'));
    setCopyMsg('Copied!');
    setTimeout(() => setCopyMsg(''), 2000);
  }

  const selectedAssets = assets.filter(a => selected.has(a.id));
  const totalSelectedDuration = selectedAssets.reduce((sum, a) => sum + (a.durationSeconds ?? 0), 0);

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="app-header">
        <div className="header-left">
          <div className="logo-mark">🎹</div>
          <div>
            <div className="app-title">DreamPlay Media Indexer</div>
            <div className="app-subtitle">AI-Powered Asset Search & Timeline Export</div>
          </div>
        </div>
        <div className="header-stats">
          <div className="stat-pill">
            <span className="stat-num">{stats.total.toLocaleString()}</span>
            <span className="stat-label">Total</span>
          </div>
          <div className="stat-pill">
            <span className="stat-num">{stats.finals.toLocaleString()}</span>
            <span className="stat-label">Finals</span>
          </div>
          <div className="stat-pill high">
            <span className="stat-num">{stats.highPriority.toLocaleString()}</span>
            <span className="stat-label">Priority</span>
          </div>
        </div>
      </header>

      <div className="app-body">
        {/* ── Sidebar ── */}
        <aside className="sidebar">
          {/* Search */}
          <div className="filter-section">
            <input
              className="search-input"
              placeholder="Search descriptions, keywords, filenames…"
              value={filters.search}
              onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
            />
          </div>

          {/* Quick Filters */}
          <div className="filter-section">
            <div className="filter-label">Quick Filters</div>
            <div className="chip-row">
              <button className={`chip ${filters.priority === 'high' ? 'active' : ''}`} onClick={() => setFilter('priority', 'high')}>⚡ Priority</button>
              <button className={`chip ${filters.finalStatus === 'final' ? 'active' : ''}`} onClick={() => setFilter('finalStatus', 'final')}>✅ Finals Only</button>
              <button className={`chip ${filters.mediaType === 'video' ? 'active' : ''}`} onClick={() => setFilter('mediaType', 'video')}>🎬 Video</button>
              <button className={`chip ${filters.mediaType === 'image' ? 'active' : ''}`} onClick={() => setFilter('mediaType', 'image')}>🖼 Photo</button>
            </div>
          </div>

          {/* Color Labels */}
          <div className="filter-section">
            <div className="filter-label">Color Label</div>
            <div className="color-chip-row">
              {Object.entries(COLOR_CHIPS).map(([key, { bg, label }]) => (
                <button
                  key={key}
                  className={`color-chip ${filters.colorLabel === key ? 'active' : ''}`}
                  style={{ background: bg }}
                  title={label}
                  onClick={() => setFilter('colorLabel', key)}
                />
              ))}
            </div>
          </div>

          {/* Hand Zone */}
          <div className="filter-section">
            <div className="filter-label">Hand Zone</div>
            <div className="chip-row">
              {['Zone A', 'Zone B', 'Zone C'].map(z => (
                <button key={z} className={`chip ${filters.handZone === z ? 'active' : ''}`} onClick={() => setFilter('handZone', z)}>
                  {z} {z === 'Zone A' ? '(DS5.5)' : z === 'Zone B' ? '(DS6.0)' : '(DS6.5)'}
                </button>
              ))}
            </div>
          </div>

          {/* DS Model */}
          <div className="filter-section">
            <div className="filter-label">DS Model</div>
            <div className="chip-row">
              {['DS5.5', 'DS6.0', 'DS6.5'].map(m => (
                <button key={m} className={`chip ${filters.dsModel === m ? 'active' : ''}`} onClick={() => setFilter('dsModel', m)}>{m}</button>
              ))}
            </div>
          </div>

          {/* Subject */}
          <div className="filter-section">
            <div className="filter-label">Subject</div>
            <div className="chip-row wrap">
              {SUBJECTS.map(s => (
                <button key={s} className={`chip ${filters.subject === s ? 'active' : ''}`} onClick={() => setFilter('subject', s)}>{s}</button>
              ))}
            </div>
          </div>

          {/* Purpose */}
          <div className="filter-section">
            <div className="filter-label">Purpose</div>
            <div className="chip-row wrap">
              {PURPOSES.map(p => (
                <button key={p} className={`chip ${filters.purpose === p ? 'active' : ''}`} onClick={() => setFilter('purpose', p)}>{p}</button>
              ))}
            </div>
          </div>

          {/* Campaign */}
          <div className="filter-section">
            <div className="filter-label">Campaign</div>
            <div className="chip-row wrap">
              {CAMPAIGNS.map(c => (
                <button key={c} className={`chip ${filters.campaign === c ? 'active' : ''}`} onClick={() => setFilter('campaign', c)}>{c}</button>
              ))}
            </div>
          </div>

          {/* Shot Type */}
          <div className="filter-section">
            <div className="filter-label">Shot Type</div>
            <div className="chip-row wrap">
              {SHOT_TYPES.map(s => (
                <button key={s} className={`chip ${filters.shotType === s ? 'active' : ''}`} onClick={() => setFilter('shotType', s)}>{s}</button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div className="filter-section">
            <div className="filter-label">Status</div>
            <div className="chip-row">
              {['final', 'raw', 'intermediate'].map(s => (
                <button key={s} className={`chip ${filters.finalStatus === s ? 'active' : ''}`} onClick={() => setFilter('finalStatus', s)}>{s}</button>
              ))}
            </div>
          </div>

          {/* Orientation */}
          <div className="filter-section">
            <div className="filter-label">Orientation</div>
            <div className="chip-row">
              {['landscape', 'portrait', 'square'].map(o => (
                <button key={o} className={`chip ${filters.orientation === o ? 'active' : ''}`} onClick={() => setFilter('orientation', o)}>{o}</button>
              ))}
            </div>
          </div>

          {/* Reset */}
          {Object.values(filters).some(v => v) && (
            <button className="reset-btn" onClick={() => setFilters({ search: '', finalStatus: '', priority: '', subject: '', handZone: '', dsModel: '', purpose: '', campaign: '', shotType: '', colorLabel: '', mediaType: '', orientation: '' })}>
              ✕ Clear All Filters
            </button>
          )}
        </aside>

        {/* ── Main Content ── */}
        <main className="main-content">
          {/* ── Prompt Box ── */}
          <PromptBox />

          <div className="grid-header">
            <div className="grid-info">
              {loading ? 'Loading…' : `${total.toLocaleString()} assets`}
              {selected.size > 0 && <span className="selected-badge">{selected.size} selected</span>}
            </div>
            <div className="grid-actions">
              {selected.size > 0 && (
                <>
                  <button className="btn-ghost" onClick={() => setSelected(new Set())}>Deselect All</button>
                  <button className="btn-ghost" onClick={() => setSelected(new Set(assets.map(a => a.id)))}>Select All ({assets.length})</button>
                </>
              )}
            </div>
          </div>

          <div className="asset-grid">
            {assets.map(asset => {
              const isSelected = selected.has(asset.id);
              const thumb = thumbUrl(asset);
              const keywords = (() => { try { return JSON.parse(asset.aiKeywords) as string[]; } catch { return []; } })();

              return (
                <div
                  key={asset.id}
                  className={`asset-card ${isSelected ? 'selected' : ''} ${asset.priority === 'high' ? 'priority' : ''}`}
                  onClick={(e) => handleAssetClick(asset, e)}
                  onDoubleClick={() => setDetail(asset)}
                >
                  {/* Thumbnail */}
                  <div className="asset-thumb-wrap">
                    {thumb ? (
                      <img src={thumb} alt={asset.fileName} className="asset-thumb" loading="lazy" />
                    ) : (
                      <div className="asset-thumb-placeholder">
                        {asset.mediaType === 'video' ? '🎬' : '🖼'}
                      </div>
                    )}
                    {asset.mediaType === 'video' && (
                      <div className="video-overlay">
                        <span className="play-icon">▶</span>
                        {asset.durationSeconds && (
                          <span className="duration-badge">{formatDuration(asset.durationSeconds)}</span>
                        )}
                      </div>
                    )}
                    {asset.finalStatus === 'final' && <div className="final-badge">FINAL</div>}
                    {asset.priority === 'high' && (
                      <div
                        className="priority-dot"
                        style={{ background: asset.colorLabel ? COLOR_CHIPS[asset.colorLabel]?.bg : '#ef4444' }}
                      />
                    )}
                    {isSelected && <div className="selected-checkmark">✓</div>}
                  </div>

                  {/* Info */}
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
                <div className="empty-msg">
                  {stats.total === 0
                    ? 'Run the ingestion script to index your DreamPlay assets:\npnpm ingest'
                    : 'Try adjusting your filters'}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ── Export Tray ── */}
      {selected.size > 0 && (
        <div className="export-tray">
          <div className="tray-info">
            <span className="tray-count">{selected.size} clips selected</span>
            {totalSelectedDuration > 0 && (
              <span className="tray-duration">· {formatDuration(totalSelectedDuration)} total</span>
            )}
          </div>
          <div className="tray-actions">
            <button className="btn-ghost tray-btn" onClick={handleCopyPaths}>
              {copyMsg || '📋 Copy Paths'}
            </button>
            <button className="btn-export fcp" onClick={() => handleExport('fcpxml')} disabled={exporting}>
              {exporting ? '…' : '🎬 Export FCPXML'}
            </button>
            <button className="btn-export davinci" onClick={() => handleExport('davinci')} disabled={exporting}>
              {exporting ? '…' : '🎨 Export DaVinci XML'}
            </button>
          </div>
        </div>
      )}

      {/* ── Detail Modal ── */}
      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setDetail(null)}>✕</button>
            {detail.thumbPath && (
              <img src={thumbUrl(detail)} alt={detail.fileName} className="modal-thumb" />
            )}
            <div className="modal-body">
              <div className="modal-title">{detail.fileName}</div>
              <div className="modal-path">{detail.filePath}</div>
              <div className="modal-desc">{detail.aiDescription}</div>
              <div className="modal-grid">
                <div className="modal-row"><span>Status</span><span className={`status-badge ${detail.finalStatus}`}>{detail.finalStatus}</span></div>
                <div className="modal-row"><span>Priority</span><span>{detail.priority}</span></div>
                <div className="modal-row"><span>Subject</span><span>{detail.subject}</span></div>
                <div className="modal-row"><span>Hand Zone</span><span>{detail.handZone ?? '—'}</span></div>
                <div className="modal-row"><span>DS Model</span><span>{detail.dsModel ?? '—'}</span></div>
                <div className="modal-row"><span>Purpose</span><span>{detail.purpose}</span></div>
                <div className="modal-row"><span>Campaign</span><span>{detail.campaign}</span></div>
                <div className="modal-row"><span>Shot Type</span><span>{detail.shotType}</span></div>
                <div className="modal-row"><span>Duration</span><span>{formatDuration(detail.durationSeconds)}</span></div>
                <div className="modal-row"><span>Resolution</span><span>{detail.width && detail.height ? `${detail.width}×${detail.height}` : '—'}</span></div>
                <div className="modal-row"><span>FPS</span><span>{detail.fps?.toFixed(2) ?? '—'}</span></div>
                <div className="modal-row"><span>Codec</span><span>{detail.codec ?? '—'}</span></div>
                <div className="modal-row"><span>File Size</span><span>{formatBytes(detail.fileSize)}</span></div>
                <div className="modal-row"><span>Color Grade</span><span>{detail.colorGrade || '—'}</span></div>
                <div className="modal-row"><span>Mood</span><span>{detail.mood || '—'}</span></div>
              </div>
              <div className="modal-keywords">
                {(() => { try { return JSON.parse(detail.aiKeywords) as string[]; } catch { return []; } })().map((k, i) => (
                  <span key={i} className="tag">{k}</span>
                ))}
              </div>
              <button className="btn-copy-path" onClick={() => { navigator.clipboard.writeText(detail.filePath); setCopyMsg('Copied!'); setTimeout(() => setCopyMsg(''), 1500); }}>
                {copyMsg || '📋 Copy File Path'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
