import { AssetRecord } from '../taxonomy';

// DaVinci Resolve-compatible EDL/XML export
// Uses the standard CMX 3600 EDL format wrapped in a resolve-friendly XML

export function generateDaVinciXML(assets: AssetRecord[], timelineName = 'DreamPlay Timeline'): string {
  const fps = 24;
  const lines: string[] = [];

  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  lines.push(`<!DOCTYPE xmeml PUBLIC "-//Apple Computer//DTD FC XML 1.0//EN" "http://www.apple.com/DTDs/FCF.dtd">`);
  lines.push(`<xmeml version="4">`);
  lines.push(`  <sequence>`);
  lines.push(`    <name>${escapeXml(timelineName)}</name>`);
  lines.push(`    <rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>`);
  lines.push(`    <media>`);
  lines.push(`      <video>`);
  lines.push(`        <format>`);
  lines.push(`          <samplecharacteristics>`);
  lines.push(`            <width>1920</width>`);
  lines.push(`            <height>1080</height>`);
  lines.push(`            <rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>`);
  lines.push(`          </samplecharacteristics>`);
  lines.push(`        </format>`);
  lines.push(`        <track>`);

  let timelineStart = 0;

  for (const asset of assets) {
    if (asset.mediaType !== 'video') continue;
    const duration = asset.durationSeconds ?? 3;
    const durationFrames = Math.round(duration * fps);
    const clipEnd = timelineStart + durationFrames;

    lines.push(`          <clipitem>`);
    lines.push(`            <name>${escapeXml(asset.fileName)}</name>`);
    lines.push(`            <duration>${durationFrames}</duration>`);
    lines.push(`            <rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>`);
    lines.push(`            <start>${timelineStart}</start>`);
    lines.push(`            <end>${clipEnd}</end>`);
    lines.push(`            <in>0</in>`);
    lines.push(`            <out>${durationFrames}</out>`);
    lines.push(`            <file id="${asset.id}">`);
    lines.push(`              <name>${escapeXml(asset.fileName)}</name>`);
    lines.push(`              <pathurl>${encodeURI(`file://${asset.filePath}`)}</pathurl>`);
    lines.push(`              <duration>${durationFrames}</duration>`);
    lines.push(`              <rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>`);
    if (asset.width && asset.height) {
      lines.push(`              <media><video><samplecharacteristics>`);
      lines.push(`                <width>${asset.width}</width>`);
      lines.push(`                <height>${asset.height}</height>`);
      lines.push(`              </samplecharacteristics></video></media>`);
    }
    lines.push(`            </file>`);
    lines.push(`          </clipitem>`);

    timelineStart = clipEnd;
  }

  lines.push(`        </track>`);
  lines.push(`      </video>`);
  lines.push(`    </media>`);
  lines.push(`  </sequence>`);
  lines.push(`</xmeml>`);

  return lines.join('\n');
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
