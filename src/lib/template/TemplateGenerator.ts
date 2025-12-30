import { jsPDF } from 'jspdf';
import { ALL_CHARACTERS, REQUIRED_CHARACTERS } from '@/lib/constants/characters';
import type { CharacterDefinition } from '@/types';

interface TemplateOptions {
  pageSize: 'letter' | 'a4';
  cellsPerRow: number;
  rowsPerPage: number;
  includeGuides: boolean;
  characterSet: 'required' | 'all' | 'custom';
  customCharacters?: CharacterDefinition[];
  fontName?: string;
}

const DEFAULT_OPTIONS: TemplateOptions = {
  pageSize: 'letter',
  cellsPerRow: 8,
  rowsPerPage: 10,
  includeGuides: true,
  characterSet: 'required',
  fontName: 'My Handwriting Font',
};

// Page dimensions in mm
const PAGE_SIZES = {
  letter: { width: 215.9, height: 279.4 },
  a4: { width: 210, height: 297 },
};

// Margins in mm
const MARGIN = {
  top: 25,
  bottom: 20,
  left: 15,
  right: 15,
};

// Registration marker size
const MARKER_SIZE = 8;
const MARKER_INNER = 4;

/**
 * Draw a registration marker (corner alignment marker)
 */
function drawRegistrationMarker(
  doc: jsPDF,
  x: number,
  y: number,
  size: number = MARKER_SIZE
): void {
  const inner = size / 2;
  const offset = (size - inner) / 2;

  // Outer square
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.rect(x, y, size, size, 'S');

  // Inner square
  doc.rect(x + offset, y + offset, inner, inner, 'F');
}

/**
 * Draw a single character cell
 */
function drawCharacterCell(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  char: CharacterDefinition,
  includeGuides: boolean
): void {
  // Cell border
  doc.setDrawColor(180);
  doc.setLineWidth(0.3);
  doc.rect(x, y, width, height, 'S');

  // Character label (top-left)
  doc.setFontSize(8);
  doc.setTextColor(0);
  doc.text(char.character === ' ' ? 'space' : char.character, x + 1.5, y + 4);

  // Guide lines
  if (includeGuides) {
    const baseline = y + height * 0.75;
    const xHeight = y + height * 0.45;
    const capHeight = y + height * 0.25;
    const descender = y + height * 0.9;

    doc.setDrawColor(200, 200, 255); // Light blue for baseline
    doc.setLineWidth(0.2);
    doc.line(x + 1, baseline, x + width - 1, baseline);

    // Ascender/cap height area (light gray)
    doc.setDrawColor(230);
    doc.line(x + 1, capHeight, x + width - 1, capHeight);

    // x-height line (dashed)
    doc.setLineDashPattern([1, 1], 0);
    doc.setDrawColor(220);
    doc.line(x + 1, xHeight, x + width - 1, xHeight);
    doc.setLineDashPattern([], 0);

    // Descender line
    doc.setDrawColor(255, 200, 200); // Light red
    doc.line(x + 1, descender, x + width - 1, descender);
  }

  // Guide character (large, light gray)
  doc.setFontSize(Math.min(width, height) * 0.6);
  doc.setTextColor(220);

  const charToDraw = char.character === ' ' ? '' : char.character;
  if (charToDraw) {
    // Center the character
    const textWidth = doc.getTextWidth(charToDraw);
    const textX = x + (width - textWidth) / 2;
    const textY = y + height * 0.7;
    doc.text(charToDraw, textX, textY);
  }
}

/**
 * Generate a printable PDF template
 */
export function generateTemplate(options: Partial<TemplateOptions> = {}): jsPDF {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const pageSize = PAGE_SIZES[opts.pageSize];

  // Get characters to include
  let characters: CharacterDefinition[];
  switch (opts.characterSet) {
    case 'required':
      characters = REQUIRED_CHARACTERS;
      break;
    case 'all':
      characters = ALL_CHARACTERS;
      break;
    case 'custom':
      characters = opts.customCharacters || REQUIRED_CHARACTERS;
      break;
    default:
      characters = REQUIRED_CHARACTERS;
  }

  // Calculate dimensions
  const contentWidth = pageSize.width - MARGIN.left - MARGIN.right;
  const contentHeight = pageSize.height - MARGIN.top - MARGIN.bottom;
  const cellWidth = contentWidth / opts.cellsPerRow;
  const cellHeight = contentHeight / opts.rowsPerPage;
  const cellsPerPage = opts.cellsPerRow * opts.rowsPerPage;
  const totalPages = Math.ceil(characters.length / cellsPerPage);

  // Create PDF
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: opts.pageSize,
  });

  // Generate pages
  for (let page = 0; page < totalPages; page++) {
    if (page > 0) {
      doc.addPage();
    }

    // Draw registration markers (corners)
    drawRegistrationMarker(doc, MARGIN.left - MARKER_SIZE - 2, MARGIN.top - MARKER_SIZE - 2);
    drawRegistrationMarker(doc, pageSize.width - MARGIN.right + 2, MARGIN.top - MARKER_SIZE - 2);
    drawRegistrationMarker(doc, MARGIN.left - MARKER_SIZE - 2, pageSize.height - MARGIN.bottom + 2);
    drawRegistrationMarker(doc, pageSize.width - MARGIN.right + 2, pageSize.height - MARGIN.bottom + 2);

    // Header
    doc.setFontSize(16);
    doc.setTextColor(100);
    doc.text(opts.fontName || 'Handwriting Font Template', pageSize.width / 2, MARGIN.top - 12, {
      align: 'center',
    });

    // Page number
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text(`Page ${page + 1} of ${totalPages}`, pageSize.width / 2, MARGIN.top - 5, {
      align: 'center',
    });

    // Draw character cells
    const startIdx = page * cellsPerPage;
    const endIdx = Math.min(startIdx + cellsPerPage, characters.length);

    for (let i = startIdx; i < endIdx; i++) {
      const localIdx = i - startIdx;
      const row = Math.floor(localIdx / opts.cellsPerRow);
      const col = localIdx % opts.cellsPerRow;

      const x = MARGIN.left + col * cellWidth;
      const y = MARGIN.top + row * cellHeight;

      drawCharacterCell(doc, x, y, cellWidth, cellHeight, characters[i], opts.includeGuides);
    }

    // Fill remaining cells with empty boxes
    for (let i = endIdx - startIdx; i < cellsPerPage; i++) {
      const row = Math.floor(i / opts.cellsPerRow);
      const col = i % opts.cellsPerRow;

      const x = MARGIN.left + col * cellWidth;
      const y = MARGIN.top + row * cellHeight;

      doc.setDrawColor(220);
      doc.setLineWidth(0.2);
      doc.rect(x, y, cellWidth, cellHeight, 'S');
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(
      'Include all four corner markers when scanning. Write clearly within each cell.',
      MARGIN.left,
      pageSize.height - MARGIN.bottom + 12
    );

    // Guide legend
    if (opts.includeGuides && page === 0) {
      const legendY = pageSize.height - MARGIN.bottom + 8;
      doc.setFontSize(6);
      doc.setTextColor(150);

      doc.setDrawColor(200, 200, 255);
      doc.setLineWidth(0.5);
      doc.line(pageSize.width - 80, legendY, pageSize.width - 75, legendY);
      doc.text('Baseline', pageSize.width - 73, legendY + 1);

      doc.setDrawColor(255, 200, 200);
      doc.line(pageSize.width - 55, legendY, pageSize.width - 50, legendY);
      doc.text('Descender', pageSize.width - 48, legendY + 1);
    }
  }

  return doc;
}

/**
 * Download the template as PDF
 */
export function downloadTemplate(
  options: Partial<TemplateOptions> = {},
  filename: string = 'handwriting-template.pdf'
): void {
  const doc = generateTemplate(options);
  doc.save(filename);
}

/**
 * Get template as data URL for preview
 */
export function getTemplateDataUrl(options: Partial<TemplateOptions> = {}): string {
  const doc = generateTemplate(options);
  return doc.output('dataurlstring');
}
