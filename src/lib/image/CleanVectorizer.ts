/**
 * Vectorizer for clean binary masks
 * Takes the output from template subtraction (clean handwriting on white)
 * and converts to SVG paths properly scaled for font coordinates
 */

// @ts-expect-error - imagetracerjs doesn't have type definitions
import ImageTracer from 'imagetracerjs';

import type { TemplateCoordinates } from '../template/TemplateDefinition';

// Font metrics constants (1000 unitsPerEm)
const UNITS_PER_EM = 1000;
const ASCENDER = 800;
const DESCENDER = -200;
const BASELINE = 0;

// Smoothing parameters (tunable)
const BLUR_SIGMA = 0.8;        // Gaussian blur sigma for pre-trace smoothing
const BLUR_THRESHOLD = 128;    // Re-threshold value after blur
const DP_EPSILON = 0.6;        // Douglas-Peucker simplification epsilon (lower = more detail)
const CURVE_SAMPLES = 8;       // Number of points to sample per curve segment

// ============================================================================
// PRE-TRACE BITMAP SMOOTHING
// ============================================================================

/**
 * Smooth a binary mask using Canvas 2D blur filter + re-threshold
 * This reduces stair-step edges before vectorization
 *
 * Uses the browser's native blur filter which is GPU-accelerated
 */
function smoothBinaryMask(imageData: ImageData, sigma: number = BLUR_SIGMA): ImageData {
  const { width, height } = imageData;

  // Draw ImageData to canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(imageData, 0, 0);

  // Apply Gaussian blur using Canvas 2D filter
  ctx.filter = `blur(${sigma}px)`;
  ctx.drawImage(canvas, 0, 0);
  ctx.filter = 'none';

  // Read back blurred data
  const blurred = ctx.getImageData(0, 0, width, height);
  const d = blurred.data;

  // Re-threshold to binary (ink=white, bg=black)
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i]; // grayscale assumed (R channel)
    const out = v > BLUR_THRESHOLD ? 255 : 0;
    d[i] = out;
    d[i + 1] = out;
    d[i + 2] = out;
    d[i + 3] = 255;
  }

  return blurred;
}

// ============================================================================
// CURVE SAMPLING UTILITIES
// ============================================================================

interface Point {
  x: number;
  y: number;
}

/**
 * Sample points along a quadratic bezier curve
 * Q command: control point (cx, cy), end point (ex, ey)
 */
function sampleQuadraticBezier(
  sx: number, sy: number,  // start point
  cx: number, cy: number,  // control point
  ex: number, ey: number,  // end point
  numSamples: number
): Point[] {
  const points: Point[] = [];
  for (let i = 1; i <= numSamples; i++) {
    const t = i / numSamples;
    const mt = 1 - t;
    // B(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2
    const x = mt * mt * sx + 2 * mt * t * cx + t * t * ex;
    const y = mt * mt * sy + 2 * mt * t * cy + t * t * ey;
    points.push({ x, y });
  }
  return points;
}

/**
 * Sample points along a cubic bezier curve
 * C command: control1 (c1x, c1y), control2 (c2x, c2y), end point (ex, ey)
 */
function sampleCubicBezier(
  sx: number, sy: number,    // start point
  c1x: number, c1y: number,  // control point 1
  c2x: number, c2y: number,  // control point 2
  ex: number, ey: number,    // end point
  numSamples: number
): Point[] {
  const points: Point[] = [];
  for (let i = 1; i <= numSamples; i++) {
    const t = i / numSamples;
    const mt = 1 - t;
    // B(t) = (1-t)³P0 + 3(1-t)²tP1 + 3(1-t)t²P2 + t³P3
    const x = mt * mt * mt * sx + 3 * mt * mt * t * c1x + 3 * mt * t * t * c2x + t * t * t * ex;
    const y = mt * mt * mt * sy + 3 * mt * mt * t * c1y + 3 * mt * t * t * c2y + t * t * t * ey;
    points.push({ x, y });
  }
  return points;
}

// ============================================================================
// POST-TRACE PATH SIMPLIFICATION (Douglas-Peucker)
// ============================================================================

/**
 * Douglas-Peucker line simplification
 * Removes points that don't contribute significantly to the shape
 */
function simplifyPath(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2) return points;

  // Find the point with maximum distance from the line between first and last
  let maxDist = 0;
  let maxIndex = 0;

  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], first, last);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  // If max distance is greater than epsilon, recursively simplify
  if (maxDist > epsilon) {
    const left = simplifyPath(points.slice(0, maxIndex + 1), epsilon);
    const right = simplifyPath(points.slice(maxIndex), epsilon);
    return [...left.slice(0, -1), ...right];
  } else {
    return [first, last];
  }
}

/**
 * Calculate perpendicular distance from point to line segment
 */
function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;

  const lineLengthSq = dx * dx + dy * dy;

  if (lineLengthSq === 0) {
    // Line is a point
    return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2);
  }

  // Calculate perpendicular distance using cross product
  const cross = Math.abs(
    (lineEnd.y - lineStart.y) * point.x -
    (lineEnd.x - lineStart.x) * point.y +
    lineEnd.x * lineStart.y -
    lineEnd.y * lineStart.x
  );

  return cross / Math.sqrt(lineLengthSq);
}

/**
 * Parse SVG path d attribute into array of points (only handles M, L, and Z commands)
 * For simplification purposes, we treat curves as their endpoint
 */
function parseSvgPathToPoints(d: string): Point[][] {
  const contours: Point[][] = [];
  let currentContour: Point[] = [];

  const cmdRegex = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g;
  let match;
  let currentX = 0, currentY = 0;

  while ((match = cmdRegex.exec(d)) !== null) {
    const cmd = match[1];
    const argsStr = match[2].trim();
    const args = argsStr.split(/[\s,]+/).filter(s => s.length > 0).map(parseFloat);

    switch (cmd) {
      case 'M':
        if (currentContour.length > 0) {
          contours.push(currentContour);
          currentContour = [];
        }
        currentX = args[0];
        currentY = args[1];
        currentContour.push({ x: currentX, y: currentY });
        break;
      case 'L':
        currentX = args[0];
        currentY = args[1];
        currentContour.push({ x: currentX, y: currentY });
        break;
      case 'H':
        currentX = args[0];
        currentContour.push({ x: currentX, y: currentY });
        break;
      case 'V':
        currentY = args[0];
        currentContour.push({ x: currentX, y: currentY });
        break;
      case 'C': {
        // Cubic bezier - sample points along curve
        const c1x = args[0], c1y = args[1];
        const c2x = args[2], c2y = args[3];
        const cex = args[4], cey = args[5];
        const cubicPts = sampleCubicBezier(currentX, currentY, c1x, c1y, c2x, c2y, cex, cey, CURVE_SAMPLES);
        currentContour.push(...cubicPts);
        currentX = cex;
        currentY = cey;
        break;
      }
      case 'Q': {
        // Quadratic bezier - sample points along curve
        const qcx = args[0], qcy = args[1];
        const qex = args[2], qey = args[3];
        const quadPts = sampleQuadraticBezier(currentX, currentY, qcx, qcy, qex, qey, CURVE_SAMPLES);
        currentContour.push(...quadPts);
        currentX = qex;
        currentY = qey;
        break;
      }
      case 'Z':
      case 'z':
        if (currentContour.length > 0) {
          contours.push(currentContour);
          currentContour = [];
        }
        break;
    }
  }

  if (currentContour.length > 0) {
    contours.push(currentContour);
  }

  return contours;
}

/**
 * Convert simplified points back to SVG path
 */
function pointsToSvgPath(contours: Point[][]): string {
  let path = '';

  for (const contour of contours) {
    if (contour.length === 0) continue;

    path += `M ${contour[0].x.toFixed(2)} ${contour[0].y.toFixed(2)} `;
    for (let i = 1; i < contour.length; i++) {
      path += `L ${contour[i].x.toFixed(2)} ${contour[i].y.toFixed(2)} `;
    }
    path += 'Z ';
  }

  return path.trim();
}

/**
 * Apply Douglas-Peucker simplification to an SVG path string
 */
function simplifySvgPath(d: string, epsilon: number = DP_EPSILON): string {
  const contours = parseSvgPathToPoints(d);
  const simplified = contours.map(c => simplifyPath(c, epsilon));
  return pointsToSvgPath(simplified);
}

export interface VectorizationResult {
  svgPath: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  isEmpty: boolean;
  debugSvg?: string;  // Raw SVG from imagetracer for debugging
}

/**
 * Vectorize a clean binary cell mask
 * The mask should have:
 *   - INK = WHITE (255)
 *   - BACKGROUND = BLACK (0)
 * (Standard binary image convention for morphological ops)
 */
export function vectorizeCell(cellImageData: ImageData): VectorizationResult {
  const { width, height, data } = cellImageData;

  // First, find content bounds (looking for WHITE pixels = ink)
  let minX = width, minY = height, maxX = 0, maxY = 0;
  let hasContent = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      // Check if pixel is white (ink) - ink is WHITE (> 128)
      if (data[i] > 128) {
        hasContent = true;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (!hasContent || maxX <= minX || maxY <= minY) {
    return {
      svgPath: '',
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      isEmpty: true,
    };
  }

  // Add padding
  const padding = 2;
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(width - 1, maxX + padding);
  maxY = Math.min(height - 1, maxY + padding);

  const bounds = {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };

  // Create cropped image for tracing
  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = bounds.width;
  croppedCanvas.height = bounds.height;
  const croppedCtx = croppedCanvas.getContext('2d')!;

  // Copy cropped region
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCtx.putImageData(cellImageData, 0, 0);
  croppedCtx.drawImage(tempCanvas, minX, minY, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height);

  const croppedData = croppedCtx.getImageData(0, 0, bounds.width, bounds.height);

  // PRE-TRACE SMOOTHING: Apply Gaussian blur + re-threshold to reduce stair-step edges
  const smoothedData = smoothBinaryMask(croppedData, BLUR_SIGMA);
  console.log('[CleanVectorizer] Applied pre-trace smoothing (sigma=' + BLUR_SIGMA + ')');

  // Trace with imagetracerjs
  // Options tuned for handwriting (blur disabled since we handle it upstream)
  const traceOptions = {
    ltres: 1,        // Line threshold
    qtres: 2,        // Quadratic spline threshold (slightly higher for smoother curves)
    pathomit: 8,     // Omit paths smaller than this (removes tiny garbage)
    rightangleenhance: false,
    colorsampling: 0,
    numberofcolors: 2,
    mincolorratio: 0,
    colorquantcycles: 1,
    blurradius: 0,
    blurdelta: 20,
    scale: 1,
    roundcoords: 1,
    viewbox: false,
    desc: false,
    lcpr: 0,
    qcpr: 0,
    layering: 1,     // Sequential layering - helps with holes
  };

  try {
    const svgString = ImageTracer.imagedataToSVG(smoothedData, traceOptions);

    // DEBUG: Log raw SVG for inspection
    console.log('[CleanVectorizer] Raw SVG from imagetracer:', svgString.substring(0, 500));

    const pathData = extractPathFromSvg(svgString, bounds.width, bounds.height);

    return {
      svgPath: pathData,
      bounds,
      isEmpty: pathData.length === 0,
      debugSvg: svgString,  // Include raw SVG for debugging
    };
  } catch (err) {
    console.error('[CleanVectorizer] Error tracing:', err);
    return {
      svgPath: '',
      bounds,
      isEmpty: true,
    };
  }
}

/**
 * Extract ink paths from SVG using getBBox for robust area-based filtering
 * This approach doesn't rely on fill color (which imagetracer can assign unpredictably)
 * Instead, it keeps paths whose bounding box is in a sensible range for ink
 * (not too big = background, not too small = noise)
 */
function extractPathFromSvg(svgString: string, imageWidth: number, imageHeight: number): string {
  // Need SVG in DOM to compute getBBox()
  const temp = document.createElement('div');
  temp.style.position = 'absolute';
  temp.style.left = '-99999px';
  temp.style.top = '-99999px';
  temp.innerHTML = svgString;
  document.body.appendChild(temp);

  const svgEl = temp.querySelector('svg') as SVGSVGElement | null;
  if (!svgEl) {
    document.body.removeChild(temp);
    return '';
  }

  const paths = Array.from(svgEl.querySelectorAll('path'));
  const cellArea = imageWidth * imageHeight;

  // Detailed logging for each path
  console.log(`[CleanVectorizer] ========== PATH ANALYSIS ==========`);
  console.log(`[CleanVectorizer] Total paths from imagetracer: ${paths.length}`);
  console.log(`[CleanVectorizer] Cell area: ${cellArea} (${imageWidth}x${imageHeight})`);

  // Separate paths into outlines (white/light fill) and holes (black/dark fill)
  const outlines: string[] = [];
  const holes: string[] = [];
  const rejected: { reason: string; area: number; pct: string; fill: string }[] = [];

  for (let idx = 0; idx < paths.length; idx++) {
    const p = paths[idx];
    const d = p.getAttribute('d');
    const fill = p.getAttribute('fill') || 'none';

    if (!d) continue;

    let bb;
    try {
      bb = (p as SVGGraphicsElement).getBBox();
    } catch {
      continue;
    }

    const area = bb.width * bb.height;
    const pct = ((area / cellArea) * 100).toFixed(2);

    // Check if this is a white (ink/outline) or black (hole) fill
    const isWhiteFill = fill.includes('255') || fill === 'white' || fill === '#fff' || fill === '#ffffff';
    const isBlackFill = fill === 'rgb(0,0,0)' || fill === 'black' || fill === '#000' || fill === '#000000';

    console.log(`[CleanVectorizer] Path ${idx}: fill="${fill}", isWhite=${isWhiteFill}, isBlack=${isBlackFill}, bbox=${bb.width.toFixed(0)}x${bb.height.toFixed(0)}, area=${area.toFixed(0)} (${pct}%), d="${d.substring(0, 60)}..."`);

    // Reject huge background-like regions (> 85% of cell) but ONLY if black fill
    // Large white-fill paths are legitimate ink (like letters M, W that fill their cell)
    if (area > cellArea * 0.85 && isBlackFill) {
      rejected.push({ reason: 'too large (background)', area, pct: pct + '%', fill });
      continue;
    }

    // Reject tiny dust (< 0.01% of cell)
    if (area < cellArea * 0.0001) {
      rejected.push({ reason: 'too small (dust)', area, pct: pct + '%', fill });
      continue;
    }

    // Classify by fill color:
    // - White fill = ink outline (the letter shape)
    // - Black fill = hole (background visible through the letter)
    if (isWhiteFill) {
      outlines.push(d);
      console.log(`[CleanVectorizer]   → Classified as OUTLINE`);
    } else if (isBlackFill && area < cellArea * 0.6) {
      // Black fill with reasonable size = hole (not background)
      holes.push(d);
      console.log(`[CleanVectorizer]   → Classified as HOLE`);
    } else {
      // Unknown fill or black but too large - treat as outline
      outlines.push(d);
      console.log(`[CleanVectorizer]   → Classified as OUTLINE (default)`);
    }
  }

  console.log(`[CleanVectorizer] Outlines: ${outlines.length}, Holes: ${holes.length}, Rejected: ${rejected.length}`);

  document.body.removeChild(temp);

  // POST-TRACE SIMPLIFICATION: Apply Douglas-Peucker to reduce micro-vertices
  // Apply separately to outlines and holes to preserve topology
  const simplifiedOutlines = outlines.map(d => {
    const before = d.length;
    const simplified = simplifySvgPath(d, DP_EPSILON);
    console.log(`[CleanVectorizer] Simplified outline: ${before} chars → ${simplified.length} chars`);
    return simplified;
  });

  const simplifiedHoles = holes.map(d => {
    const before = d.length;
    const simplified = simplifySvgPath(d, DP_EPSILON);
    console.log(`[CleanVectorizer] Simplified hole: ${before} chars → ${simplified.length} chars`);
    return simplified;
  });

  console.log(`[CleanVectorizer] ===================================`);

  // Return structured data so PathConverter can handle winding correctly
  // Format: outlines first, then holes, separated by a marker
  // We'll use a special format that PathConverter can parse
  return JSON.stringify({ outlines: simplifiedOutlines, holes: simplifiedHoles });
}

function isWhiteColor(color: string): boolean {
  if (!color) return false;

  if (color.startsWith('rgb')) {
    const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      const r = parseInt(match[1]);
      const g = parseInt(match[2]);
      const b = parseInt(match[3]);
      return r > 200 && g > 200 && b > 200;
    }
  }

  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return r > 200 && g > 200 && b > 200;
    }
  }

  return color === 'white' || color === '#fff' || color === '#ffffff';
}

/**
 * Convert SVG path to font coordinates using cell's position in template
 * This ensures consistent baseline alignment across all glyphs
 */
export function normalizeToFontCoords(
  svgPath: string,
  cellBounds: { x: number; y: number; width: number; height: number },
  templateCoords: TemplateCoordinates,
  pathBounds: { x: number; y: number; width: number; height: number }
): string {
  if (!svgPath) return '';

  // Calculate the scale factor
  // We want the cell's baseline-to-capHeight region to map to font's baseline-to-capHeight
  const cellBaseline = templateCoords.cellGuides.baseline;
  const cellCapHeight = templateCoords.cellGuides.capHeight;
  const cellWritingHeight = cellBaseline - cellCapHeight;

  // Font writing height (baseline to cap height)
  const fontCapHeight = 700; // Standard cap height
  const fontWritingHeight = fontCapHeight - BASELINE;

  // Scale factor
  const scale = fontWritingHeight / cellWritingHeight;

  // The path coordinates are relative to the cropped bounds
  // We need to transform them to font coordinates

  // Parse and transform each command
  const transformed = transformPath(svgPath, {
    scale,
    // X offset: center the glyph
    offsetX: (UNITS_PER_EM - pathBounds.width * scale) / 2,
    // Y offset: align baseline
    // In image coords, Y increases downward
    // In font coords, Y increases upward
    // The baseline in the cell is at cellBaseline from top
    // The path's Y coordinates are relative to the cropped region
    // We need to flip Y and position so baseline aligns
    offsetY: BASELINE,
    flipY: true,
    sourceHeight: pathBounds.height,
  });

  return transformed;
}

interface TransformOptions {
  scale: number;
  offsetX: number;
  offsetY: number;
  flipY: boolean;
  sourceHeight: number;
}

function transformPath(pathData: string, options: TransformOptions): string {
  const { scale, offsetX, offsetY, flipY, sourceHeight } = options;

  const cmdRegex = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g;
  let result = '';
  let match;

  while ((match = cmdRegex.exec(pathData)) !== null) {
    const type = match[1];
    const argsStr = match[2].trim();

    if (type.toUpperCase() === 'Z') {
      result += 'Z ';
      continue;
    }

    const args = argsStr
      .split(/[\s,]+/)
      .filter((s) => s.length > 0)
      .map((s) => parseFloat(s));

    const transformed = transformCommand(type, args, scale, offsetX, offsetY, flipY, sourceHeight);
    result += transformed + ' ';
  }

  return result.trim();
}

function transformCommand(
  type: string,
  args: number[],
  scale: number,
  offsetX: number,
  offsetY: number,
  flipY: boolean,
  sourceHeight: number
): string {
  const transformX = (x: number) => (x * scale + offsetX).toFixed(1);
  const transformY = (y: number) => {
    if (flipY) {
      return ((sourceHeight - y) * scale + offsetY).toFixed(1);
    }
    return (y * scale + offsetY).toFixed(1);
  };

  switch (type.toUpperCase()) {
    case 'M':
    case 'L':
      return `${type} ${transformX(args[0])} ${transformY(args[1])}`;

    case 'H':
      return `H ${transformX(args[0])}`;

    case 'V':
      return `V ${transformY(args[0])}`;

    case 'C':
      return `C ${transformX(args[0])} ${transformY(args[1])} ${transformX(args[2])} ${transformY(args[3])} ${transformX(args[4])} ${transformY(args[5])}`;

    case 'Q':
      return `Q ${transformX(args[0])} ${transformY(args[1])} ${transformX(args[2])} ${transformY(args[3])}`;

    case 'S':
      return `S ${transformX(args[0])} ${transformY(args[1])} ${transformX(args[2])} ${transformY(args[3])}`;

    case 'T':
      return `T ${transformX(args[0])} ${transformY(args[1])}`;

    default:
      return `${type} ${args.join(' ')}`;
  }
}

/**
 * Simple and robust approach: scale to fit with consistent aspect ratio
 * Now handles JSON format with separate outlines and holes
 * @deprecated Use templateNormalize instead for proper baseline alignment
 */
export function simpleNormalize(
  svgPath: string,
  pathBounds: { width: number; height: number }
): string {
  if (!svgPath || pathBounds.width === 0 || pathBounds.height === 0) return '';

  // Target: fit within 800x800 centered in 1000x1000 em
  const targetSize = 700;
  const scale = Math.min(targetSize / pathBounds.width, targetSize / pathBounds.height);

  const scaledWidth = pathBounds.width * scale;
  const scaledHeight = pathBounds.height * scale;

  // Center horizontally, position on baseline vertically
  const offsetX = (UNITS_PER_EM - scaledWidth) / 2;
  const offsetY = 50; // Small offset above baseline

  const transformOptions = {
    scale,
    offsetX,
    offsetY,
    flipY: true,
    sourceHeight: pathBounds.height,
  };

  // Check if svgPath is JSON format (new style with outlines/holes)
  try {
    const parsed = JSON.parse(svgPath);
    if (parsed.outlines && parsed.holes) {
      // Transform outlines and holes separately
      const transformedOutlines = parsed.outlines.map((p: string) => transformPath(p, transformOptions));
      const transformedHoles = parsed.holes.map((p: string) => {
        const transformed = transformPath(p, transformOptions);
        console.log(`[simpleNormalize] Hole BEFORE: "${p.substring(0, 80)}..."`);
        console.log(`[simpleNormalize] Hole AFTER:  "${transformed.substring(0, 80)}..."`);
        return transformed;
      });

      console.log(`[simpleNormalize] Transformed ${transformedOutlines.length} outlines, ${transformedHoles.length} holes`);

      return JSON.stringify({ outlines: transformedOutlines, holes: transformedHoles });
    }
  } catch {
    // Not JSON, fall through to legacy handling
  }

  // Legacy: plain SVG path string
  return transformPath(svgPath, transformOptions);
}

/**
 * Template-based normalization using baseline-mapped transform
 *
 * This uses the template's guide lines to create a consistent coordinate system:
 * - Single yScale derived from capHeight-to-baseline distance
 * - Uniform scaling (xScale = yScale) to preserve aspect ratio
 * - All glyphs positioned relative to baseline, not their own bounds
 *
 * This ensures lowercase letters, descenders, and punctuation are properly sized
 * relative to each other.
 */
export interface TemplateGuides {
  /** Baseline y position in writing area pixels (y increases downward) */
  baseline: number;
  /** Cap height y position in writing area pixels */
  capHeight: number;
  /** x-height y position in writing area pixels */
  xHeight: number;
  /** Descender y position in writing area pixels */
  descender: number;
  /** Height of the writing area in pixels */
  writingAreaHeight: number;
}

// Font metrics (in font units, 1000 unitsPerEm)
const FONT_BASELINE = 0;
const FONT_CAP_HEIGHT = 700;
const FONT_X_HEIGHT = 500;
const FONT_DESCENDER = -200;
const FONT_ASCENDER = 800;
const LEFT_SIDE_BEARING = 10;
const RIGHT_SIDE_BEARING = 10;

export function templateNormalize(
  svgPath: string,
  pathBounds: { x: number; y: number; width: number; height: number },
  guides: TemplateGuides
): { normalizedPath: string; advanceWidth: number } {
  if (!svgPath || pathBounds.width === 0 || pathBounds.height === 0) {
    return { normalizedPath: '', advanceWidth: 0 };
  }

  // Calculate scale from template capHeight-to-baseline to font capHeight-to-baseline
  // In image coords (y down): baseline > capHeight, so baseline - capHeight is positive
  // In font coords (y up): capHeight > baseline, so FONT_CAP_HEIGHT - FONT_BASELINE is positive
  const templateCapToBaseline = guides.baseline - guides.capHeight;
  const fontCapToBaseline = FONT_CAP_HEIGHT - FONT_BASELINE;

  // Single scale factor for both x and y (uniform scaling preserves aspect ratio)
  const scale = fontCapToBaseline / templateCapToBaseline;

  console.log(`[templateNormalize] Template cap-to-baseline: ${templateCapToBaseline.toFixed(1)}px`);
  console.log(`[templateNormalize] Font cap-to-baseline: ${fontCapToBaseline}`);
  console.log(`[templateNormalize] Scale factor: ${scale.toFixed(3)}`);
  console.log(`[templateNormalize] Path bounds in writing area: x=${pathBounds.x}, y=${pathBounds.y}, w=${pathBounds.width}, h=${pathBounds.height}`);

  // The transform for each point:
  // 1. Path coords are relative to cropped region (0,0 at top-left of crop)
  // 2. Add pathBounds offset to get position in writing area
  // 3. Flip Y and anchor to baseline
  // 4. Scale to font units
  //
  // yInWritingArea = yInPath + pathBounds.y
  // yFont = (baseline - yInWritingArea) * scale
  //       = (baseline - (yInPath + pathBounds.y)) * scale
  //       = (baseline - pathBounds.y - yInPath) * scale
  //       = (baseline - pathBounds.y) * scale - yInPath * scale
  //
  // So: yFont = baselineOffset - yInPath * scale
  // where baselineOffset = (baseline - pathBounds.y) * scale

  const baselineOffset = (guides.baseline - pathBounds.y) * scale;

  // For X: just scale and add left side bearing
  // xFont = xInPath * scale + LEFT_SIDE_BEARING

  // Calculate advance width from glyph width
  const glyphWidthInFontUnits = pathBounds.width * scale;
  const advanceWidth = Math.round(LEFT_SIDE_BEARING + glyphWidthInFontUnits + RIGHT_SIDE_BEARING);

  console.log(`[templateNormalize] Baseline offset: ${baselineOffset.toFixed(1)}`);
  console.log(`[templateNormalize] Glyph width: ${glyphWidthInFontUnits.toFixed(1)} → advance: ${advanceWidth}`);

  // Transform function for this glyph
  const transformPoint = (x: number, y: number): { x: number; y: number } => ({
    x: x * scale + LEFT_SIDE_BEARING,
    y: baselineOffset - y * scale,
  });

  // Check if svgPath is JSON format (new style with outlines/holes)
  try {
    const parsed = JSON.parse(svgPath);
    if (parsed.outlines && parsed.holes) {
      const transformedOutlines = parsed.outlines.map((p: string) =>
        transformPathWithFunction(p, transformPoint)
      );
      const transformedHoles = parsed.holes.map((p: string) =>
        transformPathWithFunction(p, transformPoint)
      );

      console.log(`[templateNormalize] Transformed ${transformedOutlines.length} outlines, ${transformedHoles.length} holes`);

      return {
        normalizedPath: JSON.stringify({ outlines: transformedOutlines, holes: transformedHoles }),
        advanceWidth,
      };
    }
  } catch {
    // Not JSON, fall through to legacy handling
  }

  // Legacy: plain SVG path string
  return {
    normalizedPath: transformPathWithFunction(svgPath, transformPoint),
    advanceWidth,
  };
}

/**
 * Transform a path using a custom point transformation function
 */
function transformPathWithFunction(
  pathData: string,
  transformPoint: (x: number, y: number) => { x: number; y: number }
): string {
  const cmdRegex = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g;
  let result = '';
  let match;
  let currentX = 0;
  let currentY = 0;

  while ((match = cmdRegex.exec(pathData)) !== null) {
    const type = match[1];
    const argsStr = match[2].trim();

    if (type.toUpperCase() === 'Z') {
      result += 'Z ';
      continue;
    }

    const args = argsStr
      .split(/[\s,]+/)
      .filter((s) => s.length > 0)
      .map((s) => parseFloat(s));

    switch (type) {
      case 'M': {
        const p = transformPoint(args[0], args[1]);
        currentX = args[0];
        currentY = args[1];
        result += `M ${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
        break;
      }
      case 'L': {
        const p = transformPoint(args[0], args[1]);
        currentX = args[0];
        currentY = args[1];
        result += `L ${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
        break;
      }
      case 'H': {
        const p = transformPoint(args[0], currentY);
        currentX = args[0];
        result += `L ${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
        break;
      }
      case 'V': {
        const p = transformPoint(currentX, args[0]);
        currentY = args[0];
        result += `L ${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
        break;
      }
      case 'C': {
        const p1 = transformPoint(args[0], args[1]);
        const p2 = transformPoint(args[2], args[3]);
        const p = transformPoint(args[4], args[5]);
        currentX = args[4];
        currentY = args[5];
        result += `C ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
        break;
      }
      case 'Q': {
        const p1 = transformPoint(args[0], args[1]);
        const p = transformPoint(args[2], args[3]);
        currentX = args[2];
        currentY = args[3];
        result += `Q ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
        break;
      }
      case 'S': {
        const p1 = transformPoint(args[0], args[1]);
        const p = transformPoint(args[2], args[3]);
        currentX = args[2];
        currentY = args[3];
        result += `S ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
        break;
      }
      case 'T': {
        const p = transformPoint(args[0], args[1]);
        currentX = args[0];
        currentY = args[1];
        result += `T ${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
        break;
      }
      default:
        // For relative commands or others, just pass through (shouldn't happen after makeAbsolute)
        result += `${type} ${args.join(' ')} `;
    }
  }

  return result.trim();
}
