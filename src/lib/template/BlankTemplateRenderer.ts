/**
 * Renders a blank template to ImageData for template subtraction
 * Must match the exact appearance of the PDF template
 */

import {
  type TemplateConfig,
  type TemplateCoordinates,
  getTemplateCoordinates,
  getCellBounds,
} from './TemplateDefinition';
import { REQUIRED_CHARACTERS, ALL_CHARACTERS } from '@/lib/constants/characters';

/**
 * Render a blank template page to canvas and return ImageData
 */
export function renderBlankTemplate(
  config: TemplateConfig,
  pageNumber: number = 0,
  characterSet: 'required' | 'all' = 'required'
): ImageData {
  const coords = getTemplateCoordinates(config);
  const characters = characterSet === 'all' ? ALL_CHARACTERS : REQUIRED_CHARACTERS;

  // Create canvas at exact template resolution
  const canvas = document.createElement('canvas');
  canvas.width = coords.pageWidth;
  canvas.height = coords.pageHeight;
  const ctx = canvas.getContext('2d')!;

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw registration markers
  drawMarkers(ctx, coords);

  // Draw grid and cell contents
  const cellsPerPage = config.cellsPerRow * config.rowsPerPage;
  const startIdx = pageNumber * cellsPerPage;
  const endIdx = Math.min(startIdx + cellsPerPage, characters.length);

  for (let i = startIdx; i < endIdx; i++) {
    const localIdx = i - startIdx;
    const row = Math.floor(localIdx / config.cellsPerRow);
    const col = localIdx % config.cellsPerRow;

    drawCell(ctx, coords, row, col, characters[i].character);
  }

  // Draw empty cells for remaining slots
  for (let i = endIdx - startIdx; i < cellsPerPage; i++) {
    const row = Math.floor(i / config.cellsPerRow);
    const col = i % config.cellsPerRow;
    drawEmptyCell(ctx, coords, row, col);
  }

  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * Draw the four corner registration markers
 */
function drawMarkers(ctx: CanvasRenderingContext2D, coords: TemplateCoordinates): void {
  const markerSize = Math.round(coords.pageWidth * 0.01); // ~1% of page width
  const innerSize = markerSize / 2;

  const drawMarker = (cx: number, cy: number) => {
    const x = cx - markerSize / 2;
    const y = cy - markerSize / 2;

    // Outer square (stroke)
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, markerSize, markerSize);

    // Inner square (filled)
    const innerOffset = (markerSize - innerSize) / 2;
    ctx.fillStyle = '#000000';
    ctx.fillRect(x + innerOffset, y + innerOffset, innerSize, innerSize);
  };

  drawMarker(coords.markers.topLeft.x, coords.markers.topLeft.y);
  drawMarker(coords.markers.topRight.x, coords.markers.topRight.y);
  drawMarker(coords.markers.bottomLeft.x, coords.markers.bottomLeft.y);
  drawMarker(coords.markers.bottomRight.x, coords.markers.bottomRight.y);
}

/**
 * Draw a single character cell with all its elements
 */
function drawCell(
  ctx: CanvasRenderingContext2D,
  coords: TemplateCoordinates,
  row: number,
  col: number,
  character: string
): void {
  const cell = getCellBounds(coords, row, col);

  // Cell border (light gray)
  ctx.strokeStyle = '#b4b4b4'; // RGB 180
  ctx.lineWidth = 1;
  ctx.strokeRect(cell.x, cell.y, cell.width, cell.height);

  // Character label (top-left, small, black)
  const labelText = character === ' ' ? 'space' : character;
  const labelSize = Math.max(8, cell.height * 0.08);
  ctx.font = `${labelSize}px sans-serif`;
  ctx.fillStyle = '#000000';
  ctx.fillText(labelText, cell.x + 4, cell.y + labelSize + 2);

  // Guide lines
  drawGuideLines(ctx, cell, coords.cellGuides);

  // Guide character (large, light gray, centered)
  if (character !== ' ') {
    const charSize = Math.min(cell.width, cell.height) * 0.5;
    ctx.font = `${charSize}px sans-serif`;
    ctx.fillStyle = '#dcdcdc'; // RGB 220 - light gray
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const charX = cell.x + cell.width / 2;
    const charY = cell.y + cell.height * 0.55; // Slightly below center

    ctx.fillText(character, charX, charY);

    // Reset alignment
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
}

/**
 * Draw guide lines in a cell
 */
function drawGuideLines(
  ctx: CanvasRenderingContext2D,
  cell: { x: number; y: number; width: number; height: number },
  guides: { baseline: number; xHeight: number; capHeight: number; descender: number }
): void {
  const lineStart = cell.x + 2;
  const lineEnd = cell.x + cell.width - 2;

  ctx.lineWidth = 0.5;

  // Baseline (light blue)
  ctx.strokeStyle = '#c8c8ff'; // RGB 200, 200, 255
  ctx.beginPath();
  ctx.moveTo(lineStart, cell.y + guides.baseline);
  ctx.lineTo(lineEnd, cell.y + guides.baseline);
  ctx.stroke();

  // Cap height (light gray)
  ctx.strokeStyle = '#e6e6e6'; // RGB 230
  ctx.beginPath();
  ctx.moveTo(lineStart, cell.y + guides.capHeight);
  ctx.lineTo(lineEnd, cell.y + guides.capHeight);
  ctx.stroke();

  // x-height (dashed, light gray)
  ctx.strokeStyle = '#dcdcdc'; // RGB 220
  ctx.setLineDash([2, 2]);
  ctx.beginPath();
  ctx.moveTo(lineStart, cell.y + guides.xHeight);
  ctx.lineTo(lineEnd, cell.y + guides.xHeight);
  ctx.stroke();
  ctx.setLineDash([]);

  // Descender (light red)
  ctx.strokeStyle = '#ffc8c8'; // RGB 255, 200, 200
  ctx.beginPath();
  ctx.moveTo(lineStart, cell.y + guides.descender);
  ctx.lineTo(lineEnd, cell.y + guides.descender);
  ctx.stroke();
}

/**
 * Draw an empty cell (just border)
 */
function drawEmptyCell(
  ctx: CanvasRenderingContext2D,
  coords: TemplateCoordinates,
  row: number,
  col: number
): void {
  const cell = getCellBounds(coords, row, col);

  ctx.strokeStyle = '#dcdcdc'; // RGB 220
  ctx.lineWidth = 0.5;
  ctx.strokeRect(cell.x, cell.y, cell.width, cell.height);
}

/**
 * Cache for rendered blank templates
 */
const templateCache = new Map<string, ImageData>();

/**
 * Get or render a blank template (with caching)
 */
export function getBlankTemplate(
  config: TemplateConfig,
  pageNumber: number = 0,
  characterSet: 'required' | 'all' = 'required'
): ImageData {
  const cacheKey = `${config.pageSize}-${config.cellsPerRow}-${config.rowsPerPage}-${config.dpi}-${pageNumber}-${characterSet}`;

  if (templateCache.has(cacheKey)) {
    return templateCache.get(cacheKey)!;
  }

  const imageData = renderBlankTemplate(config, pageNumber, characterSet);
  templateCache.set(cacheKey, imageData);

  return imageData;
}

/**
 * Clear the template cache
 */
export function clearTemplateCache(): void {
  templateCache.clear();
}
