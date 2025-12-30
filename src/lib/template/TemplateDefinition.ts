/**
 * Template coordinate definitions
 * All measurements in mm, converted to pixels at specified DPI
 */

export interface TemplateConfig {
  pageSize: 'letter' | 'a4';
  cellsPerRow: number;
  rowsPerPage: number;
  dpi: number; // Rendering resolution
}

export interface TemplateCoordinates {
  // Page dimensions in pixels
  pageWidth: number;
  pageHeight: number;

  // Margin positions in pixels
  margins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };

  // Corner marker centers in pixels (for homography)
  markers: {
    topLeft: { x: number; y: number };
    topRight: { x: number; y: number };
    bottomLeft: { x: number; y: number };
    bottomRight: { x: number; y: number };
  };

  // Grid parameters
  grid: {
    cellsPerRow: number;
    rowsPerPage: number;
    cellWidth: number;
    cellHeight: number;
    // Content area (where grid starts)
    startX: number;
    startY: number;
  };

  // Per-cell guide positions (relative to cell, in pixels)
  cellGuides: {
    labelTop: number;      // Where label text ends
    baseline: number;      // y position of baseline
    xHeight: number;       // y position of x-height line
    capHeight: number;     // y position of cap height
    descender: number;     // y position of descender
  };
}

// Page sizes in mm
const PAGE_SIZES_MM = {
  letter: { width: 215.9, height: 279.4 },
  a4: { width: 210, height: 297 },
};

// Margins in mm (from TemplateGenerator)
const MARGINS_MM = {
  top: 25,
  bottom: 20,
  left: 15,
  right: 15,
};

// Marker size in mm
const MARKER_SIZE_MM = 8;
const MARKER_OFFSET_MM = 2; // Gap between marker and content area

/**
 * Convert mm to pixels at given DPI
 */
function mmToPixels(mm: number, dpi: number): number {
  return Math.round((mm / 25.4) * dpi);
}

/**
 * Generate template coordinates for a given configuration
 */
export function getTemplateCoordinates(config: TemplateConfig): TemplateCoordinates {
  const { pageSize, cellsPerRow, rowsPerPage, dpi } = config;
  const pageMm = PAGE_SIZES_MM[pageSize];

  // Convert all measurements to pixels
  const pageWidth = mmToPixels(pageMm.width, dpi);
  const pageHeight = mmToPixels(pageMm.height, dpi);

  const margins = {
    top: mmToPixels(MARGINS_MM.top, dpi),
    bottom: mmToPixels(MARGINS_MM.bottom, dpi),
    left: mmToPixels(MARGINS_MM.left, dpi),
    right: mmToPixels(MARGINS_MM.right, dpi),
  };

  // Content area dimensions
  const contentWidth = pageWidth - margins.left - margins.right;
  const contentHeight = pageHeight - margins.top - margins.bottom;

  // Cell dimensions
  const cellWidth = contentWidth / cellsPerRow;
  const cellHeight = contentHeight / rowsPerPage;

  // Marker positions (center of each marker)
  // Markers are placed OUTSIDE the content area
  const markerSize = mmToPixels(MARKER_SIZE_MM, dpi);
  const markerOffset = mmToPixels(MARKER_OFFSET_MM, dpi);
  const markerHalfSize = markerSize / 2;

  const markers = {
    topLeft: {
      x: margins.left - markerOffset - markerHalfSize,
      y: margins.top - markerOffset - markerHalfSize,
    },
    topRight: {
      x: pageWidth - margins.right + markerOffset + markerHalfSize,
      y: margins.top - markerOffset - markerHalfSize,
    },
    bottomLeft: {
      x: margins.left - markerOffset - markerHalfSize,
      y: pageHeight - margins.bottom + markerOffset + markerHalfSize,
    },
    bottomRight: {
      x: pageWidth - margins.right + markerOffset + markerHalfSize,
      y: pageHeight - margins.bottom + markerOffset + markerHalfSize,
    },
  };

  // Cell guide positions (relative to cell top-left, in pixels)
  // These match the percentages in TemplateGenerator.ts
  const cellGuides = {
    labelTop: cellHeight * 0.18,       // Label takes ~18% of cell height (increased to fully exclude label)
    baseline: cellHeight * 0.75,
    xHeight: cellHeight * 0.45,
    capHeight: cellHeight * 0.25,
    descender: cellHeight * 0.9,
  };

  return {
    pageWidth,
    pageHeight,
    margins,
    markers,
    grid: {
      cellsPerRow,
      rowsPerPage,
      cellWidth,
      cellHeight,
      startX: margins.left,
      startY: margins.top,
    },
    cellGuides,
  };
}

/**
 * Get the pixel coordinates of a specific cell
 */
export function getCellBounds(
  coords: TemplateCoordinates,
  row: number,
  col: number
): { x: number; y: number; width: number; height: number } {
  return {
    x: coords.grid.startX + col * coords.grid.cellWidth,
    y: coords.grid.startY + row * coords.grid.cellHeight,
    width: coords.grid.cellWidth,
    height: coords.grid.cellHeight,
  };
}

/**
 * Get the writing area within a cell (excludes label at top)
 */
export function getCellWritingArea(
  coords: TemplateCoordinates,
  row: number,
  col: number
): { x: number; y: number; width: number; height: number } {
  const cell = getCellBounds(coords, row, col);
  const labelHeight = coords.cellGuides.labelTop;

  // Add padding to exclude cell borders and any edge artifacts
  const padding = 4; // pixels

  return {
    x: cell.x + padding,
    y: cell.y + labelHeight,
    width: cell.width - padding * 2,
    height: cell.height - labelHeight - padding,
  };
}

/**
 * Default configuration for processing
 */
export const DEFAULT_TEMPLATE_CONFIG: TemplateConfig = {
  pageSize: 'letter',
  cellsPerRow: 8,
  rowsPerPage: 10,
  dpi: 150, // Good balance of quality and speed
};
