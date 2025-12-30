/**
 * Grid detection for template processing
 * Detects corner markers and extracts individual character cells
 */

import { ALL_CHARACTERS, REQUIRED_CHARACTERS } from '@/lib/constants/characters';
import type { CharacterDefinition } from '@/types';

export interface GridCell {
  x: number;
  y: number;
  width: number;
  height: number;
  row: number;
  col: number;
  character: CharacterDefinition;
  imageData: ImageData;
}

export interface DetectedGrid {
  cells: GridCell[];
  bounds: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  cellsPerRow: number;
  rowsPerPage: number;
}

interface Point {
  x: number;
  y: number;
}

interface CornerMarkers {
  topLeft: Point | null;
  topRight: Point | null;
  bottomLeft: Point | null;
  bottomRight: Point | null;
}

/**
 * Detect corner registration markers in the image
 * Markers are dark squares with an inner filled square
 */
function findCornerMarkers(imageData: ImageData): CornerMarkers {
  const { width, height, data } = imageData;

  // Helper to check if pixel is dark
  const isDark = (x: number, y: number): boolean => {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    const i = (y * width + x) * 4;
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    return gray < 100;
  };

  // Search regions for each corner (percentage of image)
  const searchSize = Math.min(width, height) * 0.15;

  const findMarkerInRegion = (
    startX: number,
    startY: number,
    endX: number,
    endY: number
  ): Point | null => {
    // Look for a cluster of dark pixels that forms a square-ish shape
    let bestPoint: Point | null = null;
    let bestScore = 0;

    const stepX = Math.sign(endX - startX) * 2;
    const stepY = Math.sign(endY - startY) * 2;

    for (let y = startY; stepY > 0 ? y < endY : y > endY; y += stepY) {
      for (let x = startX; stepX > 0 ? x < endX : x > endX; x += stepX) {
        if (isDark(x, y)) {
          // Found a dark pixel, check if it's part of a marker
          // Count dark pixels in a small region
          let darkCount = 0;
          const checkSize = Math.floor(searchSize * 0.3);

          for (let dy = 0; dy < checkSize; dy++) {
            for (let dx = 0; dx < checkSize; dx++) {
              if (isDark(x + dx, y + dy)) darkCount++;
            }
          }

          const score = darkCount / (checkSize * checkSize);
          if (score > 0.3 && score > bestScore) {
            bestScore = score;
            bestPoint = { x, y };
          }
        }
      }
    }

    return bestPoint;
  };

  return {
    topLeft: findMarkerInRegion(0, 0, searchSize, searchSize),
    topRight: findMarkerInRegion(width - 1, 0, width - searchSize, searchSize),
    bottomLeft: findMarkerInRegion(0, height - 1, searchSize, height - searchSize),
    bottomRight: findMarkerInRegion(width - 1, height - 1, width - searchSize, height - searchSize),
  };
}

/**
 * Estimate grid parameters based on image size and expected template layout
 * Based on analysis of the DSR Handwriting template PDF:
 * - Grid starts after header "DSR Handwriting" and "Page X of Y"
 * - Grid has 8 columns × 10 rows
 * - Corner markers are small filled squares
 */
function estimateGridParams(
  imageWidth: number,
  imageHeight: number,
  markers: CornerMarkers
): { cellsPerRow: number; rowsPerPage: number; bounds: { top: number; left: number; width: number; height: number } } {
  const cellsPerRow = 8;
  const rowsPerPage = 10;

  console.log(`[GridDetector] Image dimensions: ${imageWidth}x${imageHeight}`);
  console.log(`[GridDetector] Markers found:`, {
    topLeft: markers.topLeft ? `(${markers.topLeft.x}, ${markers.topLeft.y})` : 'none',
    topRight: markers.topRight ? `(${markers.topRight.x}, ${markers.topRight.y})` : 'none',
    bottomLeft: markers.bottomLeft ? `(${markers.bottomLeft.x}, ${markers.bottomLeft.y})` : 'none',
    bottomRight: markers.bottomRight ? `(${markers.bottomRight.x}, ${markers.bottomRight.y})` : 'none',
  });

  // Use fixed percentages based on the actual template layout
  // These values are calibrated for the DSR Handwriting template
  // The grid area (excluding markers and header):
  // - Left edge: ~4.5% from left
  // - Right edge: ~96% from left
  // - Top edge: ~6% from top (below header)
  // - Bottom edge: ~94% from top (above footer)

  const left = imageWidth * 0.045;
  const right = imageWidth * 0.96;
  const top = imageHeight * 0.06;
  const bottom = imageHeight * 0.94;

  const contentWidth = right - left;
  const contentHeight = bottom - top;

  console.log(`[GridDetector] Grid bounds: left=${left.toFixed(0)}, top=${top.toFixed(0)}, right=${right.toFixed(0)}, bottom=${bottom.toFixed(0)}`);
  console.log(`[GridDetector] Content area: ${contentWidth.toFixed(0)}x${contentHeight.toFixed(0)}`);
  console.log(`[GridDetector] Cell size: ${(contentWidth/cellsPerRow).toFixed(0)}x${(contentHeight/rowsPerPage).toFixed(0)}`);

  return {
    cellsPerRow,
    rowsPerPage,
    bounds: {
      left,
      top,
      width: contentWidth,
      height: contentHeight,
    },
  };
}

/**
 * Extract a cell's image data from the full image
 */
function extractCellImage(
  imageData: ImageData,
  x: number,
  y: number,
  width: number,
  height: number
): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Create temp canvas with full image
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = imageData.width;
  tempCanvas.height = imageData.height;
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCtx.putImageData(imageData, 0, 0);

  // Draw the cell region
  ctx.drawImage(tempCanvas, x, y, width, height, 0, 0, width, height);

  return ctx.getImageData(0, 0, width, height);
}

/**
 * Extract just the handwriting area from a cell (excluding label at top)
 * Based on template layout:
 * - Top ~8%: cell label (small text like "A", "B")
 * - Remaining: handwriting area (includes faint guide character which we filter later)
 */
function extractWritingArea(cellImageData: ImageData): ImageData {
  const { width, height } = cellImageData;

  // The label is in the top portion of the cell
  // Start extracting from below the label area
  const startY = Math.floor(height * 0.08);
  const areaHeight = height - startY;

  return extractCellImage(cellImageData, 0, startY, width, areaHeight);
}

/**
 * Analyze a cell's pixel distribution to understand its content
 */
function analyzeCellPixels(imageData: ImageData): {
  darkPixels: number;
  mediumPixels: number;
  lightPixels: number;
  avgGray: number;
  minGray: number;
} {
  const { data, width, height } = imageData;
  let darkPixels = 0;   // < 128 (definitely handwriting)
  let mediumPixels = 0; // 128-180 (could be handwriting or dark guide)
  let lightPixels = 0;  // > 180 (guide character or background)
  let totalGray = 0;
  let minGray = 255;
  const totalPixels = width * height;

  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    totalGray += gray;
    minGray = Math.min(minGray, gray);

    if (gray < 128) {
      darkPixels++;
    } else if (gray < 180) {
      mediumPixels++;
    } else {
      lightPixels++;
    }
  }

  return {
    darkPixels,
    mediumPixels,
    lightPixels,
    avgGray: totalGray / totalPixels,
    minGray,
  };
}

/**
 * Check if a cell contains actual handwriting (not just the guide character)
 * Guide characters are typically ~200-220 gray, handwriting is much darker
 */
function cellHasContent(imageData: ImageData, threshold: number = 128, charLabel?: string): boolean {
  const { data, width, height } = imageData;
  const totalPixels = width * height;
  const stats = analyzeCellPixels(imageData);

  // Consider pixels < 180 as potential content (more lenient for lighter handwriting)
  const contentPixels = stats.darkPixels + stats.mediumPixels;
  const contentRatio = contentPixels / totalPixels;

  // Also check if there are ANY very dark pixels (definite handwriting)
  const hasDarkContent = stats.darkPixels > 0 && stats.minGray < 120;

  // Has content if:
  // 1. More than 0.05% of pixels are dark/medium, OR
  // 2. There are any very dark pixels (even a few indicate handwriting)
  const hasContent = contentRatio > 0.0005 || hasDarkContent;

  // Log detailed stats for each cell
  console.log(`[GridDetector] Cell ${charLabel || '?'}: dark=${stats.darkPixels} medium=${stats.mediumPixels} light=${stats.lightPixels} minGray=${stats.minGray.toFixed(0)} avgGray=${stats.avgGray.toFixed(0)} ratio=${(contentRatio*100).toFixed(3)}% hasContent=${hasContent}`);

  return hasContent;
}

/**
 * Main function: Detect grid and extract character cells
 */
export function detectGrid(
  imageData: ImageData,
  options: {
    pageNumber?: number;
    characterSet?: 'required' | 'all';
    cellsPerRow?: number;
    rowsPerPage?: number;
  } = {}
): DetectedGrid {
  const {
    pageNumber = 0,
    characterSet = 'required',
    cellsPerRow: forceCellsPerRow,
    rowsPerPage: forceRowsPerPage,
  } = options;

  const characters = characterSet === 'all' ? ALL_CHARACTERS : REQUIRED_CHARACTERS;

  // Find corner markers
  const markers = findCornerMarkers(imageData);
  console.log('[GridDetector] Found markers:', markers);

  // Estimate grid parameters
  const gridParams = estimateGridParams(imageData.width, imageData.height, markers);

  const cellsPerRow = forceCellsPerRow || gridParams.cellsPerRow;
  const rowsPerPage = forceRowsPerPage || gridParams.rowsPerPage;
  const { bounds } = gridParams;

  console.log(`[GridDetector] Grid params: ${cellsPerRow}x${rowsPerPage}, bounds:`, bounds);

  const cellWidth = bounds.width / cellsPerRow;
  const cellHeight = bounds.height / rowsPerPage;
  const cellsPerPage = cellsPerRow * rowsPerPage;

  const cells: GridCell[] = [];

  // Calculate which characters are on this page
  const startCharIndex = pageNumber * cellsPerPage;
  const endCharIndex = Math.min(startCharIndex + cellsPerPage, characters.length);

  for (let i = startCharIndex; i < endCharIndex; i++) {
    const localIndex = i - startCharIndex;
    const row = Math.floor(localIndex / cellsPerRow);
    const col = localIndex % cellsPerRow;

    const x = Math.floor(bounds.left + col * cellWidth);
    const y = Math.floor(bounds.top + row * cellHeight);
    const w = Math.floor(cellWidth);
    const h = Math.floor(cellHeight);

    // Extract cell image
    const cellImage = extractCellImage(imageData, x, y, w, h);

    // Extract just the writing area (excluding label)
    const writingArea = extractWritingArea(cellImage);

    cells.push({
      x,
      y,
      width: w,
      height: h,
      row,
      col,
      character: characters[i],
      imageData: writingArea,
    });
  }

  return {
    cells,
    bounds,
    cellsPerRow,
    rowsPerPage,
  };
}

/**
 * Filter cells to only those with actual handwriting content
 */
export function filterCellsWithContent(
  cells: GridCell[],
  threshold: number = 128
): GridCell[] {
  console.log(`[GridDetector] Analyzing ${cells.length} cells for content...`);
  const filtered = cells.filter(cell => cellHasContent(cell.imageData, threshold, cell.character.character));
  console.log(`[GridDetector] ${filtered.length} cells passed content detection`);
  return filtered;
}

/**
 * Remove the light gray guide character from a cell using adaptive thresholding
 * Guide characters are typically light gray (150-220), handwriting is dark (< 100)
 * We analyze the darkest pixels to determine what's handwriting vs guide
 */
function removeGuideCharacter(imageData: ImageData): ImageData {
  const { width, height, data } = imageData;
  const result = new ImageData(width, height);

  // First pass: analyze pixel distribution to find the darkest pixels
  const grayValues: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    if (gray < 240) { // Ignore pure white background
      grayValues.push(gray);
    }
  }

  // Find the minimum gray value (darkest pixel)
  const minGray = Math.min(...grayValues);

  // Adaptive threshold: keep pixels that are within a certain range of the darkest
  // If darkest is 30 (black pen), threshold might be 80
  // If darkest is 100 (lighter pen), threshold might be 130
  // This helps separate handwriting from guide characters
  const adaptiveThreshold = Math.min(minGray + 60, 120);

  console.log(`[GuideRemoval] minGray=${minGray.toFixed(0)}, adaptiveThreshold=${adaptiveThreshold.toFixed(0)}`);

  let keptPixels = 0;
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;

    if (gray < adaptiveThreshold) {
      // Keep very dark pixels (handwriting)
      result.data[i] = data[i];
      result.data[i + 1] = data[i + 1];
      result.data[i + 2] = data[i + 2];
      result.data[i + 3] = 255;
      keptPixels++;
    } else {
      // Remove lighter pixels (guide character, background)
      result.data[i] = 255;
      result.data[i + 1] = 255;
      result.data[i + 2] = 255;
      result.data[i + 3] = 255;
    }
  }

  console.log(`[GuideRemoval] Kept ${keptPixels} dark pixels out of ${width * height} total`);

  return result;
}

/**
 * Process all cells in a grid and return vectorized paths
 */
export async function processGridCells(
  grid: DetectedGrid,
  threshold: number = 128,
  onProgress?: (current: number, total: number) => void
): Promise<Map<number, string>> {
  const { imageToSvgPath, applyThreshold, cropToContent } = await import('./Vectorizer');

  const results = new Map<number, string>();
  const cellsWithContent = filterCellsWithContent(grid.cells, threshold);

  console.log(`[GridDetector] Processing ${cellsWithContent.length} cells with content out of ${grid.cells.length} total`);

  let skippedCrop = 0;
  let skippedEmpty = 0;
  let errors = 0;

  for (let i = 0; i < cellsWithContent.length; i++) {
    const cell = cellsWithContent[i];

    try {
      // First, remove the guide character (light gray)
      const withoutGuide = removeGuideCharacter(cell.imageData);

      // Analyze what's left after guide removal
      const guideRemovedStats = analyzeCellPixels(withoutGuide);
      console.log(`[GridDetector] ${cell.character.character} after guide removal: dark=${guideRemovedStats.darkPixels} medium=${guideRemovedStats.mediumPixels}`);

      // Apply threshold to get clean binary image
      const thresholded = applyThreshold(withoutGuide, threshold);

      // Crop to content
      const { imageData: cropped, bounds } = cropToContent(thresholded, 5);

      // Check if there's still content after cropping
      if (cropped.width < 5 || cropped.height < 5) {
        console.log(`[GridDetector] Cell ${cell.character.character} too small after crop: ${cropped.width}x${cropped.height}`);
        skippedCrop++;
        continue;
      }

      // Vectorize
      const svgPath = await imageToSvgPath(cropped, { skipThreshold: true });

      if (svgPath && svgPath.length > 0) {
        results.set(cell.character.unicode, svgPath);
        console.log(`[GridDetector] ✓ Processed ${cell.character.character} (U+${cell.character.unicode.toString(16).toUpperCase()}) - path length: ${svgPath.length}`);
      } else {
        console.log(`[GridDetector] ✗ ${cell.character.character} produced empty path`);
        skippedEmpty++;
      }
    } catch (err) {
      console.error(`[GridDetector] Error processing cell ${cell.character.character}:`, err);
      errors++;
    }

    if (onProgress) {
      onProgress(i + 1, cellsWithContent.length);
    }
  }

  console.log(`[GridDetector] Summary: ${results.size} processed, ${skippedCrop} too small after crop, ${skippedEmpty} empty paths, ${errors} errors`);

  return results;
}
