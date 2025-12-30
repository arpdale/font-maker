import opentype from 'opentype.js';
import type { GlyphData, LigatureDefinition, FontSettings, FontMetrics } from '@/types';

/**
 * Create a .notdef glyph (required placeholder for missing characters)
 */
function createNotdefGlyph(metrics: FontMetrics): opentype.Glyph {
  const path = new opentype.Path();
  const width = metrics.unitsPerEm * 0.5;
  const margin = 50;

  // Draw a rectangle outline
  path.moveTo(margin, metrics.descender + margin);
  path.lineTo(width - margin, metrics.descender + margin);
  path.lineTo(width - margin, metrics.ascender - margin);
  path.lineTo(margin, metrics.ascender - margin);
  path.close();

  // Inner rectangle (to make it hollow)
  const innerMargin = margin + 30;
  path.moveTo(innerMargin, metrics.descender + innerMargin);
  path.lineTo(innerMargin, metrics.ascender - innerMargin);
  path.lineTo(width - innerMargin, metrics.ascender - innerMargin);
  path.lineTo(width - innerMargin, metrics.descender + innerMargin);
  path.close();

  return new opentype.Glyph({
    name: '.notdef',
    unicode: 0,
    advanceWidth: width,
    path: path,
  });
}

/**
 * Create a space glyph
 */
function createSpaceGlyph(metrics: FontMetrics): opentype.Glyph {
  return new opentype.Glyph({
    name: 'space',
    unicode: 32,
    advanceWidth: metrics.unitsPerEm * 0.25,
    path: new opentype.Path(),
  });
}

/**
 * Build an OpenType font from glyph data
 */
export function buildFont(
  settings: FontSettings,
  glyphs: Record<number, GlyphData>,
  ligatures: LigatureDefinition[] = []
): opentype.Font {
  const { familyName, styleName, metrics } = settings;

  // Create glyph array starting with required glyphs
  const opentypeGlyphs: opentype.Glyph[] = [
    createNotdefGlyph(metrics),
  ];

  // Add completed glyphs
  for (const glyphData of Object.values(glyphs)) {
    if (glyphData.isComplete && glyphData.path) {
      // Special handling for space - it should have no path
      if (glyphData.unicode === 32) {
        opentypeGlyphs.push(createSpaceGlyph(metrics));
      } else {
        // Debug: check path details for glyphs with potential holes (O, D, P, Q, R, B, etc.)
        const holedChars = ['O', 'D', 'P', 'Q', 'R', 'B', 'A', '0', '4', '6', '8', '9', 'o', 'd', 'p', 'q', 'b', 'a', 'e'];
        if (holedChars.includes(glyphData.character || '')) {
          const mCount = glyphData.path.commands.filter((c: {type: string}) => c.type === 'M').length;
          const zCount = glyphData.path.commands.filter((c: {type: string}) => c.type === 'Z').length;
          console.log(`[FontBuilder] ${glyphData.character}: ${glyphData.path.commands.length} commands, ${mCount} M, ${zCount} Z`);
        }

        opentypeGlyphs.push(
          new opentype.Glyph({
            name: glyphData.name,
            unicode: glyphData.unicode,
            advanceWidth: glyphData.advanceWidth,
            path: glyphData.path,
          })
        );
      }
    }
  }

  // If space wasn't drawn, add a default space
  const hasSpace = opentypeGlyphs.some((g) => g.unicode === 32);
  if (!hasSpace) {
    opentypeGlyphs.push(createSpaceGlyph(metrics));
  }

  // Add ligature glyphs (they'll be added to the font, but GSUB is complex to implement)
  const completeLigatures = ligatures.filter((l) => l.isComplete && l.path);
  for (const lig of completeLigatures) {
    opentypeGlyphs.push(
      new opentype.Glyph({
        name: lig.name,
        unicode: undefined,
        advanceWidth: lig.advanceWidth,
        path: lig.path!,
      })
    );
  }

  // Create the font
  const font = new opentype.Font({
    familyName,
    styleName,
    unitsPerEm: metrics.unitsPerEm,
    ascender: metrics.ascender,
    descender: metrics.descender,
    glyphs: opentypeGlyphs,
  });

  return font;
}

/**
 * Export font as OTF ArrayBuffer
 */
export function exportAsOTF(font: opentype.Font): ArrayBuffer {
  return font.toArrayBuffer();
}

/**
 * Export font as TTF ArrayBuffer
 * Note: opentype.js generates OpenType fonts which can have .otf or .ttf extension
 * The actual difference is minimal for web use
 */
export function exportAsTTF(font: opentype.Font): ArrayBuffer {
  return font.toArrayBuffer();
}

/**
 * Create a downloadable file from font
 */
export function downloadFont(
  font: opentype.Font,
  filename: string,
  format: 'otf' | 'ttf'
): void {
  const arrayBuffer = font.toArrayBuffer();
  const blob = new Blob([arrayBuffer], { type: 'font/opentype' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.${format}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Auto-calculate font metrics from glyphs
 */
export function calculateMetricsFromGlyphs(
  glyphs: Record<number, GlyphData>
): Partial<FontMetrics> {
  let maxAscender = 0;
  let minDescender = 0;
  let capHeight = 0;
  let xHeight = 0;

  // Check capital H for cap height
  const capitalH = glyphs[0x0048]; // 'H'
  if (capitalH?.path) {
    const bbox = capitalH.path.getBoundingBox();
    capHeight = Math.max(capHeight, bbox.y2);
    maxAscender = Math.max(maxAscender, bbox.y2);
  }

  // Check lowercase x for x-height
  const lowerX = glyphs[0x0078]; // 'x'
  if (lowerX?.path) {
    const bbox = lowerX.path.getBoundingBox();
    xHeight = Math.max(xHeight, bbox.y2);
  }

  // Check lowercase p for descender
  const lowerP = glyphs[0x0070]; // 'p'
  if (lowerP?.path) {
    const bbox = lowerP.path.getBoundingBox();
    minDescender = Math.min(minDescender, bbox.y1);
  }

  // Check lowercase b for ascender
  const lowerB = glyphs[0x0062]; // 'b'
  if (lowerB?.path) {
    const bbox = lowerB.path.getBoundingBox();
    maxAscender = Math.max(maxAscender, bbox.y2);
  }

  return {
    ascender: maxAscender > 0 ? Math.round(maxAscender) : undefined,
    descender: minDescender < 0 ? Math.round(minDescender) : undefined,
    capHeight: capHeight > 0 ? Math.round(capHeight) : undefined,
    xHeight: xHeight > 0 ? Math.round(xHeight) : undefined,
  };
}
