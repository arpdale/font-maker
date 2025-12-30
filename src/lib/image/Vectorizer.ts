/**
 * Image vectorization utilities
 * Uses imagetracerjs for high-quality bitmap-to-vector conversion
 */

// @ts-expect-error - imagetracerjs doesn't have type definitions
import ImageTracer from 'imagetracerjs';

// Font metrics constants (1000 unitsPerEm)
const UNITS_PER_EM = 1000;
const ASCENDER = 800;
const DESCENDER = -200;
const CAP_HEIGHT = 700;
const X_HEIGHT = 500;
const BASELINE = 0;

/**
 * Convert an image to SVG path using imagetracerjs
 * Returns a path string normalized to font coordinate space
 */
export async function imageToSvgPath(
  imageData: ImageData,
  options: {
    threshold?: number;
    skipThreshold?: boolean;
    normalize?: boolean;
  } = {}
): Promise<string> {
  const { threshold = 128, skipThreshold = false, normalize = true } = options;

  // Apply threshold to get binary image (skip if already applied)
  const binaryData = skipThreshold ? imageData : applyThreshold(imageData, threshold);

  // Convert ImageData to canvas for imagetracerjs
  const canvas = document.createElement('canvas');
  canvas.width = binaryData.width;
  canvas.height = binaryData.height;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(binaryData, 0, 0);

  // Configure imagetracerjs for handwriting
  // Using 'posterized2' preset with modifications for clean letterforms
  const traceOptions = {
    // Tracing
    ltres: 1,           // Line error threshold
    qtres: 1,           // Quadratic spline error threshold
    pathomit: 8,        // Edge node paths shorter than this will be discarded
    rightangleenhance: false,

    // Color quantization
    colorsampling: 0,   // Disable color sampling (we have binary image)
    numberofcolors: 2,  // Black and white only
    mincolorratio: 0,
    colorquantcycles: 1,

    // Shape detection
    blurradius: 0,      // No blur (already processed)
    blurdelta: 20,

    // SVG output
    scale: 1,
    roundcoords: 2,     // Round to 2 decimal places
    viewbox: false,
    desc: false,
    lcpr: 0,
    qcpr: 0,

    // Layering
    layering: 0,        // Sequential
  };

  return new Promise((resolve) => {
    try {
      // Trace the image
      const svgString = ImageTracer.imagedataToSVG(binaryData, traceOptions);

      // Parse SVG to extract path data
      const pathData = extractPathFromSvg(svgString);

      if (!pathData || pathData.length === 0) {
        console.log('[Vectorizer] No path data extracted from trace');
        resolve('');
        return;
      }

      // Normalize to font coordinates if requested
      if (normalize) {
        const normalizedPath = normalizePathToFontCoords(
          pathData,
          binaryData.width,
          binaryData.height
        );
        console.log(`[Vectorizer] Normalized path length: ${normalizedPath.length}`);
        resolve(normalizedPath);
      } else {
        resolve(pathData);
      }
    } catch (err) {
      console.error('[Vectorizer] Error tracing image:', err);
      resolve('');
    }
  });
}

/**
 * Extract path data from SVG string
 */
function extractPathFromSvg(svgString: string): string {
  // Parse the SVG to get path elements
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const paths = doc.querySelectorAll('path');

  const pathDatas: string[] = [];

  paths.forEach((path) => {
    const d = path.getAttribute('d');
    const fill = path.getAttribute('fill');

    // Only include black paths (the handwriting, not background)
    // imagetracerjs outputs white background as one path and black content as another
    if (d && fill && isBlackColor(fill)) {
      pathDatas.push(d);
    }
  });

  return pathDatas.join(' ');
}

/**
 * Check if a color string represents black
 */
function isBlackColor(color: string): boolean {
  if (!color) return false;

  // Handle rgb format
  if (color.startsWith('rgb')) {
    const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      const r = parseInt(match[1]);
      const g = parseInt(match[2]);
      const b = parseInt(match[3]);
      return r < 128 && g < 128 && b < 128;
    }
  }

  // Handle hex format
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return r < 128 && g < 128 && b < 128;
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return r < 128 && g < 128 && b < 128;
    }
  }

  // Handle named colors
  return color === 'black' || color === '#000' || color === '#000000';
}

/**
 * Normalize SVG path coordinates to font coordinate space
 * - Scale to fit within font metrics
 * - Flip Y axis (SVG is Y-down, fonts are Y-up)
 * - Position on baseline
 */
function normalizePathToFontCoords(
  pathData: string,
  sourceWidth: number,
  sourceHeight: number
): string {
  // Target height is from descender to ascender
  const targetHeight = ASCENDER - DESCENDER; // 1000
  const targetWidth = UNITS_PER_EM * 0.8; // 800 - typical glyph width

  // Calculate scale to fit while preserving aspect ratio
  const scaleX = targetWidth / sourceWidth;
  const scaleY = targetHeight / sourceHeight;
  const scale = Math.min(scaleX, scaleY) * 0.85; // 85% to add some padding

  // Calculate centering offset
  const scaledWidth = sourceWidth * scale;
  const scaledHeight = sourceHeight * scale;
  const offsetX = (UNITS_PER_EM - scaledWidth) / 2; // Center horizontally

  // Position vertically: baseline at y=0, content sits on baseline
  // In font coords, baseline is 0, descender is negative, ascender is positive
  // After Y flip, we need to position so bottom of glyph is near baseline
  const offsetY = BASELINE + scaledHeight * 0.1; // Slight offset above baseline

  // Parse and transform the path
  const transformed = transformPath(pathData, scale, offsetX, offsetY, sourceHeight);

  return transformed;
}

/**
 * Transform SVG path data with scale, translation, and Y-flip
 */
function transformPath(
  pathData: string,
  scale: number,
  offsetX: number,
  offsetY: number,
  sourceHeight: number
): string {
  // Parse path commands
  const commands = parsePathCommands(pathData);

  // Transform each command
  const transformed = commands.map((cmd) => {
    const type = cmd.type;
    const args = cmd.args;

    switch (type.toUpperCase()) {
      case 'M':
      case 'L':
        return transformPoint(type, args, scale, offsetX, offsetY, sourceHeight);
      case 'H':
        // Horizontal line - only X coordinate
        return `${type} ${(args[0] * scale + offsetX).toFixed(2)}`;
      case 'V':
        // Vertical line - only Y coordinate (flip)
        return `${type} ${(offsetY - (args[0] - sourceHeight) * scale).toFixed(2)}`;
      case 'C':
        // Cubic bezier - 3 points (6 values)
        return transformCubic(type, args, scale, offsetX, offsetY, sourceHeight);
      case 'Q':
        // Quadratic bezier - 2 points (4 values)
        return transformQuadratic(type, args, scale, offsetX, offsetY, sourceHeight);
      case 'Z':
        return 'Z';
      default:
        return `${type} ${args.join(' ')}`;
    }
  });

  return transformed.join(' ');
}

function transformPoint(
  type: string,
  args: number[],
  scale: number,
  offsetX: number,
  offsetY: number,
  sourceHeight: number
): string {
  const x = args[0] * scale + offsetX;
  const y = offsetY - (args[1] - sourceHeight) * scale; // Flip Y
  return `${type} ${x.toFixed(2)} ${y.toFixed(2)}`;
}

function transformCubic(
  type: string,
  args: number[],
  scale: number,
  offsetX: number,
  offsetY: number,
  sourceHeight: number
): string {
  const x1 = args[0] * scale + offsetX;
  const y1 = offsetY - (args[1] - sourceHeight) * scale;
  const x2 = args[2] * scale + offsetX;
  const y2 = offsetY - (args[3] - sourceHeight) * scale;
  const x = args[4] * scale + offsetX;
  const y = offsetY - (args[5] - sourceHeight) * scale;
  return `${type} ${x1.toFixed(2)} ${y1.toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)}`;
}

function transformQuadratic(
  type: string,
  args: number[],
  scale: number,
  offsetX: number,
  offsetY: number,
  sourceHeight: number
): string {
  const x1 = args[0] * scale + offsetX;
  const y1 = offsetY - (args[1] - sourceHeight) * scale;
  const x = args[2] * scale + offsetX;
  const y = offsetY - (args[3] - sourceHeight) * scale;
  return `${type} ${x1.toFixed(2)} ${y1.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)}`;
}

interface PathCommand {
  type: string;
  args: number[];
}

/**
 * Parse SVG path string into commands
 */
function parsePathCommands(pathData: string): PathCommand[] {
  const commands: PathCommand[] = [];

  // Regular expression to match path commands
  const cmdRegex = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g;
  let match;

  while ((match = cmdRegex.exec(pathData)) !== null) {
    const type = match[1];
    const argsStr = match[2].trim();

    if (type.toUpperCase() === 'Z') {
      commands.push({ type: 'Z', args: [] });
      continue;
    }

    // Parse numeric arguments
    const args = argsStr
      .split(/[\s,]+/)
      .filter((s) => s.length > 0)
      .map((s) => parseFloat(s));

    // Handle implicit commands (multiple coordinate pairs)
    const argsPerCmd = getArgsPerCommand(type);
    if (argsPerCmd > 0 && args.length > argsPerCmd) {
      // Split into multiple commands
      for (let i = 0; i < args.length; i += argsPerCmd) {
        commands.push({
          type: i === 0 ? type : (type === 'M' ? 'L' : type === 'm' ? 'l' : type),
          args: args.slice(i, i + argsPerCmd),
        });
      }
    } else {
      commands.push({ type, args });
    }
  }

  return commands;
}

function getArgsPerCommand(type: string): number {
  switch (type.toUpperCase()) {
    case 'M':
    case 'L':
    case 'T':
      return 2;
    case 'H':
    case 'V':
      return 1;
    case 'S':
    case 'Q':
      return 4;
    case 'C':
      return 6;
    case 'A':
      return 7;
    default:
      return 0;
  }
}

/**
 * Apply threshold to image data for better vectorization
 */
export function applyThreshold(imageData: ImageData, threshold: number = 128): ImageData {
  const data = imageData.data;
  const result = new ImageData(imageData.width, imageData.height);

  for (let i = 0; i < data.length; i += 4) {
    // Convert to grayscale
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    // Apply threshold
    const value = gray < threshold ? 0 : 255;
    result.data[i] = value;
    result.data[i + 1] = value;
    result.data[i + 2] = value;
    result.data[i + 3] = 255;
  }

  return result;
}

/**
 * Invert image colors (for when writing is light on dark background)
 */
export function invertImage(imageData: ImageData): ImageData {
  const data = imageData.data;
  const result = new ImageData(imageData.width, imageData.height);

  for (let i = 0; i < data.length; i += 4) {
    result.data[i] = 255 - data[i];
    result.data[i + 1] = 255 - data[i + 1];
    result.data[i + 2] = 255 - data[i + 2];
    result.data[i + 3] = data[i + 3];
  }

  return result;
}

/**
 * Crop image to content bounds with padding
 */
export function cropToContent(
  imageData: ImageData,
  padding: number = 10
): { imageData: ImageData; bounds: { x: number; y: number; width: number; height: number } } {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  // Find content bounds (looking for non-white pixels)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      // Check if pixel is dark (content)
      if (data[i] < 128) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  // Handle case where no content found
  if (minX >= maxX || minY >= maxY) {
    return {
      imageData,
      bounds: { x: 0, y: 0, width, height },
    };
  }

  // Add padding
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(width - 1, maxX + padding);
  maxY = Math.min(height - 1, maxY + padding);

  const cropWidth = maxX - minX + 1;
  const cropHeight = maxY - minY + 1;

  // Create cropped image
  const canvas = document.createElement('canvas');
  canvas.width = cropWidth;
  canvas.height = cropHeight;
  const ctx = canvas.getContext('2d')!;

  // Put original image data on a temp canvas
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCtx.putImageData(imageData, 0, 0);

  // Draw cropped region
  ctx.drawImage(tempCanvas, minX, minY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

  return {
    imageData: ctx.getImageData(0, 0, cropWidth, cropHeight),
    bounds: { x: minX, y: minY, width: cropWidth, height: cropHeight },
  };
}

/**
 * Scale image data to fit within target dimensions while preserving aspect ratio
 */
export function scaleImageData(
  imageData: ImageData,
  maxWidth: number,
  maxHeight: number
): ImageData {
  const { width, height } = imageData;
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);

  if (scale === 1) return imageData;

  const newWidth = Math.round(width * scale);
  const newHeight = Math.round(height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = newWidth;
  canvas.height = newHeight;
  const ctx = canvas.getContext('2d')!;

  // Put original image on temp canvas
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCtx.putImageData(imageData, 0, 0);

  // Scale
  ctx.drawImage(tempCanvas, 0, 0, width, height, 0, 0, newWidth, newHeight);

  return ctx.getImageData(0, 0, newWidth, newHeight);
}

// Legacy export for compatibility
export async function initPotrace(): Promise<void> {
  // No-op - we use imagetracerjs now
}
