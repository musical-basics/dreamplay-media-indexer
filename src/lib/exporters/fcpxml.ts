import { AssetRecord } from '../taxonomy';

// FCPXML 1.11 exporter for Final Cut Pro X
export function generateFCPXML(assets: AssetRecord[], eventName = 'DreamPlay Library', projectName = 'DreamPlay Timeline'): string {
  const fps = 24;
  const frameDuration = `1/${fps}s`;

  const videoAssets = assets.filter((a) => a.mediaType === 'video');

  const lines: string[] = [];
  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  lines.push(`<!DOCTYPE fcpxml>`);
  lines.push(`<fcpxml version="1.11">`);
  lines.push(`  <resources>`);
  lines.push(`    <format id="r1" name="FFVideoFormat1080p24" frameDuration="${frameDuration}" width="1920" height="1080" colorSpace="1-1-1 (Rec. 709)"/>`);

  // Register each asset as a resource
  for (const asset of videoAssets) {
    const duration = asset.durationSeconds ?? 3;
    const durationFCP = toFCPTime(duration, fps);
    lines.push(`    <asset id="${asset.id}" name="${escapeXml(asset.fileName)}" start="0s" duration="${durationFCP}" hasVideo="1" hasAudio="1" format="r1">`);
    lines.push(`      <media-rep kind="original-media" src="${encodeURI(`file://${asset.filePath}`)}"/>`);
    lines.push(`    </asset>`);
  }

  lines.push(`  </resources>`);
  lines.push(`  <library>`);
  lines.push(`    <event name="${escapeXml(eventName)}">`);
  lines.push(`      <project name="${escapeXml(projectName)}">`);
  lines.push(`        <sequence format="r1" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">`);
  lines.push(`          <spine>`);

  let offset = 0;
  for (const asset of videoAssets) {
    const duration = asset.durationSeconds ?? 3;
    const durationFCP = toFCPTime(duration, fps);
    const offsetFCP = toFCPTime(offset, fps);
    lines.push(`            <clip name="${escapeXml(asset.fileName)}" ref="${asset.id}" offset="${offsetFCP}" duration="${durationFCP}" start="0s">`);
    lines.push(`              <note>${escapeXml(asset.aiDescription)}</note>`);
    lines.push(`            </clip>`);
    offset += duration;
  }

  lines.push(`          </spine>`);
  lines.push(`        </sequence>`);
  lines.push(`      </project>`);
  lines.push(`    </event>`);
  lines.push(`  </library>`);
  lines.push(`</fcpxml>`);

  return lines.join('\n');
}

function toFCPTime(seconds: number, fps: number): string {
  const frames = Math.round(seconds * fps);
  return `${frames}/${fps}s`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
