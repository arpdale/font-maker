/**
 * Main template processing orchestrator
 * Coordinates: marker detection → warp → subtraction → extraction → vectorization
 */

import {
  loadOpenCV,
  imageDataToMat,
  matToImageData,
  processPage,
  extractCell,
  removeSmallComponents,
  cleanupProcessedPage,
  type ProcessedPage,
  type MarkerDetectionResult,
} from './OpenCVProcessor';

import {
  type TemplateConfig,
  type TemplateCoordinates,
  getTemplateCoordinates,
  getCellBounds,
  getCellWritingArea,
  DEFAULT_TEMPLATE_CONFIG,
} from '../template/TemplateDefinition';

import { getBlankTemplate } from '../template/BlankTemplateRenderer';

import { vectorizeCell, simpleNormalize, templateNormalize, type TemplateGuides } from './CleanVectorizer';

import { normalizedSvgToOpentypePath } from '../canvas/PathConverter';

import { REQUIRED_CHARACTERS, ALL_CHARACTERS } from '@/lib/constants/characters';
import type { CharacterDefinition } from '@/types';
import type { Path } from 'opentype.js';

export interface ProcessingOptions {
  config?: TemplateConfig;
  characterSet?: 'required' | 'all';
  pageNumber?: number;
  subtractThreshold?: number;
  morphologyCloseSize?: number;
  morphologyOpenSize?: number;
  minComponentArea?: number;
  onProgress?: (stage: string, progress: number) => void;
}

export interface ExtractedGlyph {
  character: CharacterDefinition;
  svgPath: string;
  opentypePath: Path;
  cellImageData: ImageData;
  cleanedImageData: ImageData;
  bounds: { x: number; y: number; width: number; height: number };
  advanceWidth: number;
}

export interface ProcessingResult {
  success: boolean;
  glyphs: ExtractedGlyph[];
  debugImages: {
    warped: ImageData | null;
    subtracted: ImageData | null;
    cleaned: ImageData | null;
    thresholded: ImageData | null;
  };
  markers: MarkerDetectionResult | null;
  error?: string;
}

/**
 * Process a single template page and extract all character glyphs
 */
export async function processTemplatePage(
  scanImageData: ImageData,
  options: ProcessingOptions = {}
): Promise<ProcessingResult> {
  const {
    config = DEFAULT_TEMPLATE_CONFIG,
    characterSet = 'required',
    pageNumber = 0,
    subtractThreshold = 30,
    morphologyCloseSize = 3,
    morphologyOpenSize = 2,
    minComponentArea = 50,
    onProgress,
  } = options;

  const result: ProcessingResult = {
    success: false,
    glyphs: [],
    debugImages: {
      warped: null,
      subtracted: null,
      cleaned: null,
      thresholded: null,
    },
    markers: null,
  };

  try {
    // Step 1: Load OpenCV
    onProgress?.('Loading OpenCV...', 0);
    await loadOpenCV();

    // Step 2: Get template coordinates and blank template
    onProgress?.('Preparing template...', 5);
    const templateCoords = getTemplateCoordinates(config);
    const blankTemplate = getBlankTemplate(config, pageNumber, characterSet);

    console.log('[TemplateProcessor] Template coords:', {
      pageSize: `${templateCoords.pageWidth}x${templateCoords.pageHeight}`,
      grid: `${config.cellsPerRow}x${config.rowsPerPage}`,
      cellSize: `${templateCoords.grid.cellWidth.toFixed(0)}x${templateCoords.grid.cellHeight.toFixed(0)}`,
    });

    // Step 3: Process page (detect markers, warp, subtract, clean)
    onProgress?.('Processing page...', 10);
    const processed = await processPage(
      scanImageData,
      blankTemplate,
      templateCoords,
      {
        subtractThreshold,
        closeSize: morphologyCloseSize,
        openSize: morphologyOpenSize,
        minComponentArea,
      }
    );

    if (!processed) {
      result.error = 'Failed to process page. Processing returned null.';
      return result;
    }

    result.markers = processed.markers;

    // Convert debug images (always, even if markers failed)
    onProgress?.('Generating debug images...', 30);
    result.debugImages.warped = matToImageData(processed.warped);
    result.debugImages.subtracted = matToImageData(processed.subtracted);
    result.debugImages.cleaned = matToImageData(processed.cleaned);
    if (processed.thresholded) {
      result.debugImages.thresholded = matToImageData(processed.thresholded);
    }

    // If markers failed, return partial result with debug images
    if (!processed.markers.success) {
      result.error = 'Failed to detect all 4 corner markers. Check the thresholded debug image.';
      cleanupProcessedPage(processed);
      return result;
    }

    // Step 4: Extract and vectorize each cell
    const characters = characterSet === 'all' ? ALL_CHARACTERS : REQUIRED_CHARACTERS;
    const cellsPerPage = config.cellsPerRow * config.rowsPerPage;
    const startIdx = pageNumber * cellsPerPage;
    const endIdx = Math.min(startIdx + cellsPerPage, characters.length);

    // Compute template guides in writing area coordinates (once for all cells)
    // The cell guides are in full cell coordinates, but writing area excludes the label
    const labelTop = templateCoords.cellGuides.labelTop;
    const cellHeight = templateCoords.grid.cellHeight;
    const writingAreaHeight = cellHeight - labelTop - 4; // 4 = padding from getCellWritingArea

    const templateGuides: TemplateGuides = {
      baseline: templateCoords.cellGuides.baseline - labelTop,
      capHeight: templateCoords.cellGuides.capHeight - labelTop,
      xHeight: templateCoords.cellGuides.xHeight - labelTop,
      descender: templateCoords.cellGuides.descender - labelTop,
      writingAreaHeight,
    };

    console.log(`[TemplateProcessor] Template guides in writing area coords:`, {
      baseline: templateGuides.baseline.toFixed(1),
      capHeight: templateGuides.capHeight.toFixed(1),
      xHeight: templateGuides.xHeight.toFixed(1),
      descender: templateGuides.descender.toFixed(1),
      writingAreaHeight: templateGuides.writingAreaHeight.toFixed(1),
      capToBaseline: (templateGuides.baseline - templateGuides.capHeight).toFixed(1),
    });

    console.log(`[TemplateProcessor] Extracting cells ${startIdx} to ${endIdx - 1}`);

    for (let i = startIdx; i < endIdx; i++) {
      const localIdx = i - startIdx;
      const row = Math.floor(localIdx / config.cellsPerRow);
      const col = localIdx % config.cellsPerRow;

      const progress = 30 + ((localIdx / (endIdx - startIdx)) * 60);
      onProgress?.(`Extracting ${characters[i].character}...`, progress);

      // Get cell bounds (writing area, excluding label)
      const writingArea = getCellWritingArea(templateCoords, row, col);

      // Extract cell from cleaned image (after warp + subtract + morphology)
      const cellMat = extractCell(
        processed.cleaned,
        writingArea.x,
        writingArea.y,
        writingArea.width,
        writingArea.height
      );

      // Per-cell cleanup: remove small components + reject components in top 15% (labels)
      // This is done PER-CELL so centroid-Y filtering actually works
      const cleanedCellMat = removeSmallComponents(cellMat, minComponentArea, 0.15);
      cellMat.delete();

      const cellImageData = matToImageData(cleanedCellMat);
      cleanedCellMat.delete();

      // Also get cell from warped (for debugging)
      const warpedCellMat = extractCell(
        processed.warped,
        writingArea.x,
        writingArea.y,
        writingArea.width,
        writingArea.height
      );
      const warpedCellImageData = matToImageData(warpedCellMat);
      warpedCellMat.delete();

      // Vectorize the cell
      const vectorResult = vectorizeCell(cellImageData);

      // Debug: extra logging for M which is mysteriously missing
      if (characters[i].character === 'M') {
        console.log(`[TemplateProcessor] DEBUG M: vectorResult.isEmpty=${vectorResult.isEmpty}`);
        console.log(`[TemplateProcessor] DEBUG M: bounds=`, vectorResult.bounds);
        console.log(`[TemplateProcessor] DEBUG M: svgPath length=${vectorResult.svgPath?.length || 0}`);
        console.log(`[TemplateProcessor] DEBUG M: svgPath preview="${vectorResult.svgPath?.substring(0, 200) || 'empty'}"`);
      }

      if (!vectorResult.isEmpty) {
        // Normalize to font coordinates using template baseline mapping
        const { normalizedPath, advanceWidth } = templateNormalize(
          vectorResult.svgPath,
          vectorResult.bounds,
          templateGuides
        );

        // Convert to opentype.js Path
        const opentypePath = normalizedSvgToOpentypePath(normalizedPath);

        result.glyphs.push({
          character: characters[i],
          svgPath: normalizedPath,
          opentypePath,
          cellImageData: warpedCellImageData,
          cleanedImageData: cellImageData,
          bounds: vectorResult.bounds,
          advanceWidth,
        });

        console.log(`[TemplateProcessor] ✓ ${characters[i].character} vectorized (advance=${advanceWidth})`);
      } else {
        console.log(`[TemplateProcessor] ✗ ${characters[i].character} empty`);
      }
    }

    // Cleanup OpenCV mats
    cleanupProcessedPage(processed);

    onProgress?.('Complete', 100);
    result.success = true;

    console.log(`[TemplateProcessor] Extracted ${result.glyphs.length} glyphs`);

  } catch (err) {
    console.error('[TemplateProcessor] Error:', err);
    result.error = err instanceof Error ? err.message : 'Unknown error';
  }

  return result;
}

/**
 * Quick check if an image likely contains a valid template
 * (has markers in roughly the right positions)
 */
export async function validateTemplateImage(
  imageData: ImageData,
  config: TemplateConfig = DEFAULT_TEMPLATE_CONFIG
): Promise<{ valid: boolean; message: string }> {
  try {
    await loadOpenCV();

    const templateCoords = getTemplateCoordinates(config);
    const mat = imageDataToMat(imageData);

    // Import detectCornerMarkers
    const { detectCornerMarkers } = await import('./OpenCVProcessor');
    const markers = detectCornerMarkers(mat, templateCoords);

    mat.delete();

    if (markers.success) {
      return { valid: true, message: 'All 4 corner markers detected' };
    }

    const found = [
      markers.topLeft ? 'top-left' : null,
      markers.topRight ? 'top-right' : null,
      markers.bottomLeft ? 'bottom-left' : null,
      markers.bottomRight ? 'bottom-right' : null,
    ].filter(Boolean);

    return {
      valid: false,
      message: `Missing markers. Found: ${found.length > 0 ? found.join(', ') : 'none'}`,
    };
  } catch (err) {
    return {
      valid: false,
      message: err instanceof Error ? err.message : 'Validation failed',
    };
  }
}
