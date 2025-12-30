/**
 * OpenCV.js-based image processing for template alignment and extraction
 * Handles: marker detection, homography, warp, subtraction, cleanup
 */

import type { TemplateCoordinates } from '../template/TemplateDefinition';

// OpenCV global type
declare global {
  interface Window {
    cv: any;
  }
}

let cvReady = false;
let cvLoadPromise: Promise<void> | null = null;

/**
 * Load OpenCV.js from CDN (client-side only)
 */
export async function loadOpenCV(): Promise<void> {
  if (cvReady && typeof window !== 'undefined' && window.cv) return;

  if (cvLoadPromise) return cvLoadPromise;

  cvLoadPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('OpenCV.js can only be loaded in browser'));
      return;
    }

    // Check if already loaded
    if (window.cv && window.cv.Mat) {
      cvReady = true;
      console.log('[OpenCV] Already loaded');
      resolve();
      return;
    }

    // Load from CDN
    const script = document.createElement('script');
    script.src = 'https://docs.opencv.org/4.8.0/opencv.js';
    script.async = true;

    script.onload = () => {
      // OpenCV.js sets up cv object asynchronously
      const checkReady = () => {
        if (window.cv && window.cv.Mat) {
          cvReady = true;
          console.log('[OpenCV] Loaded successfully from CDN');
          resolve();
        } else {
          setTimeout(checkReady, 50);
        }
      };
      checkReady();
    };

    script.onerror = () => {
      reject(new Error('Failed to load OpenCV.js from CDN'));
    };

    document.head.appendChild(script);
  });

  return cvLoadPromise;
}

/**
 * Check if OpenCV is ready
 */
export function isOpenCVReady(): boolean {
  return cvReady;
}

/**
 * Convert ImageData to OpenCV Mat
 */
export function imageDataToMat(imageData: ImageData): any {
  const cv = window.cv;
  const mat = new cv.Mat(imageData.height, imageData.width, cv.CV_8UC4);
  mat.data.set(imageData.data);
  return mat;
}

/**
 * Convert OpenCV Mat to ImageData
 */
export function matToImageData(mat: any): ImageData {
  const cv = window.cv;
  const imageData = new ImageData(mat.cols, mat.rows);

  if (mat.channels() === 1) {
    // Grayscale - convert to RGBA
    const rgba = new cv.Mat();
    cv.cvtColor(mat, rgba, cv.COLOR_GRAY2RGBA);
    imageData.data.set(rgba.data);
    rgba.delete();
  } else if (mat.channels() === 3) {
    // BGR - convert to RGBA
    const rgba = new cv.Mat();
    cv.cvtColor(mat, rgba, cv.COLOR_BGR2RGBA);
    imageData.data.set(rgba.data);
    rgba.delete();
  } else {
    // Already RGBA
    imageData.data.set(mat.data);
  }

  return imageData;
}

export interface DetectedMarker {
  center: { x: number; y: number };
  corners: { x: number; y: number }[];
  area: number;
}

export interface MarkerDetectionResult {
  topLeft: DetectedMarker | null;
  topRight: DetectedMarker | null;
  bottomLeft: DetectedMarker | null;
  bottomRight: DetectedMarker | null;
  success: boolean;
  debugBinary?: any; // Thresholded image for debugging
}

/**
 * Detect the four corner registration markers in the scanned image
 * Markers are black squares with inner black squares
 */
export function detectCornerMarkers(
  imageMat: any,
  expectedCoords: TemplateCoordinates
): MarkerDetectionResult {
  const cv = window.cv;

  const result: MarkerDetectionResult = {
    topLeft: null,
    topRight: null,
    bottomLeft: null,
    bottomRight: null,
    success: false,
  };

  const width = imageMat.cols;
  const height = imageMat.rows;

  console.log('[OpenCV] Detecting markers in image:', { width, height });

  // Convert to grayscale
  const gray = new cv.Mat();
  cv.cvtColor(imageMat, gray, cv.COLOR_RGBA2GRAY);

  // Try multiple threshold approaches
  const binary = new cv.Mat();

  // Use Otsu's method for automatic threshold selection
  cv.threshold(gray, binary, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);

  // Find contours
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(binary, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

  console.log('[OpenCV] Found', contours.size(), 'total contours');

  // Much wider area tolerance - markers could be 0.01% to 1% of image
  const imageArea = width * height;
  const minArea = imageArea * 0.0001; // Very small
  const maxArea = imageArea * 0.01;   // Up to 1%

  // Collect all square-ish candidates
  const allCandidates: DetectedMarker[] = [];

  for (let i = 0; i < contours.size(); i++) {
    const contour = contours.get(i);
    const area = cv.contourArea(contour);

    if (area < minArea || area > maxArea) continue;

    // Check if contour is roughly square
    const rect = cv.boundingRect(contour);
    const aspectRatio = rect.width / rect.height;

    // More lenient aspect ratio (0.5 to 2.0)
    if (aspectRatio < 0.5 || aspectRatio > 2.0) continue;

    // Check solidity (filled vs hollow)
    const hull = new cv.Mat();
    cv.convexHull(contour, hull);
    const hullArea = cv.contourArea(hull);
    hull.delete();

    const solidity = area / hullArea;
    if (solidity < 0.7) continue; // Must be fairly solid

    // Get contour center
    const moments = cv.moments(contour);
    if (moments.m00 === 0) continue;

    const centerX = moments.m10 / moments.m00;
    const centerY = moments.m01 / moments.m00;

    allCandidates.push({
      center: { x: centerX, y: centerY },
      corners: [
        { x: rect.x, y: rect.y },
        { x: rect.x + rect.width, y: rect.y },
        { x: rect.x + rect.width, y: rect.y + rect.height },
        { x: rect.x, y: rect.y + rect.height },
      ],
      area,
    });
  }

  console.log('[OpenCV] Square-ish candidates:', allCandidates.length);

  // Define corner regions (outer 20% of image)
  const cornerMargin = 0.20;
  const corners = {
    topLeft: { xMin: 0, xMax: width * cornerMargin, yMin: 0, yMax: height * cornerMargin },
    topRight: { xMin: width * (1 - cornerMargin), xMax: width, yMin: 0, yMax: height * cornerMargin },
    bottomLeft: { xMin: 0, xMax: width * cornerMargin, yMin: height * (1 - cornerMargin), yMax: height },
    bottomRight: { xMin: width * (1 - cornerMargin), xMax: width, yMin: height * (1 - cornerMargin), yMax: height },
  };

  // Find best candidate in each corner region
  for (const [cornerName, region] of Object.entries(corners)) {
    const inRegion = allCandidates.filter(c =>
      c.center.x >= region.xMin && c.center.x <= region.xMax &&
      c.center.y >= region.yMin && c.center.y <= region.yMax
    );

    console.log(`[OpenCV] ${cornerName} region has ${inRegion.length} candidates`);

    if (inRegion.length > 0) {
      // Pick the one closest to the actual corner
      const cornerX = cornerName.includes('Left') ? 0 : width;
      const cornerY = cornerName.includes('top') ? 0 : height;

      inRegion.sort((a, b) => {
        const distA = Math.hypot(a.center.x - cornerX, a.center.y - cornerY);
        const distB = Math.hypot(b.center.x - cornerX, b.center.y - cornerY);
        return distA - distB;
      });

      const best = inRegion[0];
      (result as any)[cornerName] = best;
      console.log(`[OpenCV] ${cornerName}: found at (${best.center.x.toFixed(0)}, ${best.center.y.toFixed(0)}), area=${best.area.toFixed(0)}`);
    }
  }

  result.success = !!(
    result.topLeft &&
    result.topRight &&
    result.bottomLeft &&
    result.bottomRight
  );

  // Keep binary for debugging
  result.debugBinary = binary.clone();

  // Cleanup
  gray.delete();
  binary.delete();
  contours.delete();
  hierarchy.delete();

  console.log('[OpenCV] Marker detection result:', {
    success: result.success,
    found: {
      topLeft: !!result.topLeft,
      topRight: !!result.topRight,
      bottomLeft: !!result.bottomLeft,
      bottomRight: !!result.bottomRight,
    },
  });

  return result;
}

/**
 * Compute homography matrix from detected markers to template coordinates
 */
export function computeHomography(
  detected: MarkerDetectionResult,
  templateCoords: TemplateCoordinates
): any | null {
  const cv = window.cv;

  if (!detected.success) return null;

  // Source points (detected marker centers in scan)
  const srcPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
    detected.topLeft!.center.x,
    detected.topLeft!.center.y,
    detected.topRight!.center.x,
    detected.topRight!.center.y,
    detected.bottomRight!.center.x,
    detected.bottomRight!.center.y,
    detected.bottomLeft!.center.x,
    detected.bottomLeft!.center.y,
  ]);

  // Destination points (expected positions in template space)
  const dstPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
    templateCoords.markers.topLeft.x,
    templateCoords.markers.topLeft.y,
    templateCoords.markers.topRight.x,
    templateCoords.markers.topRight.y,
    templateCoords.markers.bottomRight.x,
    templateCoords.markers.bottomRight.y,
    templateCoords.markers.bottomLeft.x,
    templateCoords.markers.bottomLeft.y,
  ]);

  // Compute homography
  const H = cv.findHomography(srcPoints, dstPoints);

  srcPoints.delete();
  dstPoints.delete();

  return H;
}

/**
 * Apply perspective warp to align scan with template
 */
export function warpToTemplate(
  imageMat: any,
  homography: any,
  templateCoords: TemplateCoordinates
): any {
  const cv = window.cv;

  const warped = new cv.Mat();
  const dsize = new cv.Size(templateCoords.pageWidth, templateCoords.pageHeight);

  cv.warpPerspective(imageMat, warped, homography, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT);

  return warped;
}

/**
 * Perform template subtraction to isolate handwriting
 * Returns a binary mask where:
 *   - INK/handwriting = BLACK (0)
 *   - BACKGROUND = WHITE (255)
 * This polarity makes vectorization more robust (ink is sparse, background is large)
 */
export function subtractTemplate(
  warpedScan: any,
  blankTemplate: any,
  threshold: number = 30
): any {
  const cv = window.cv;

  // Convert both to grayscale
  const scanGray = new cv.Mat();
  const templateGray = new cv.Mat();

  if (warpedScan.channels() > 1) {
    cv.cvtColor(warpedScan, scanGray, cv.COLOR_RGBA2GRAY);
  } else {
    warpedScan.copyTo(scanGray);
  }

  if (blankTemplate.channels() > 1) {
    cv.cvtColor(blankTemplate, templateGray, cv.COLOR_RGBA2GRAY);
  } else {
    blankTemplate.copyTo(templateGray);
  }

  // Apply slight blur to both to reduce noise from scan artifacts
  const ksize = new cv.Size(3, 3);
  cv.GaussianBlur(scanGray, scanGray, ksize, 0);
  cv.GaussianBlur(templateGray, templateGray, ksize, 0);

  // Compute absolute difference
  const diff = new cv.Mat();
  cv.absdiff(scanGray, templateGray, diff);

  // Apply another blur to "heal" small gaps in strokes
  cv.GaussianBlur(diff, diff, ksize, 0);

  // Threshold the difference to get binary mask
  // Handwriting = WHITE (255), background = BLACK (0)
  const mask = new cv.Mat();
  cv.threshold(diff, mask, threshold, 255, cv.THRESH_BINARY);

  // Keep this polarity for morphological operations (they expect white=foreground)
  // We'll handle path selection in the vectorizer

  scanGray.delete();
  templateGray.delete();
  diff.delete();

  return mask;
}

/**
 * Apply morphological cleanup to remove noise and connect strokes
 */
export function morphologicalCleanup(
  binaryMat: any,
  closeSize: number = 3,
  openSize: number = 2
): any {
  const cv = window.cv;

  const result = new cv.Mat();
  binaryMat.copyTo(result);

  // Closing: connect nearby strokes (dilate then erode)
  if (closeSize > 0) {
    const closeKernel = cv.getStructuringElement(
      cv.MORPH_ELLIPSE,
      new cv.Size(closeSize, closeSize)
    );
    cv.morphologyEx(result, result, cv.MORPH_CLOSE, closeKernel);
    closeKernel.delete();
  }

  // Opening: remove small noise (erode then dilate)
  if (openSize > 0) {
    const openKernel = cv.getStructuringElement(
      cv.MORPH_ELLIPSE,
      new cv.Size(openSize, openSize)
    );
    cv.morphologyEx(result, result, cv.MORPH_OPEN, openKernel);
    openKernel.delete();
  }

  return result;
}

/**
 * Ensure the binary mat has ink=white (255) and background=black (0)
 * If inverted, flip it. This is required for connectedComponents to work correctly.
 */
export function ensureInkIsWhite(binaryMat: any): any {
  const cv = window.cv;
  const nonZero = cv.countNonZero(binaryMat);
  const total = binaryMat.rows * binaryMat.cols;

  // If >50% nonZero, background is probably white (inverted). Flip it.
  if (nonZero > total * 0.5) {
    const flipped = new cv.Mat();
    cv.bitwise_not(binaryMat, flipped);
    console.log('[OpenCV] Flipped polarity: background was white, now ink is white');
    return flipped;
  }

  // Already correct polarity
  const result = new cv.Mat();
  binaryMat.copyTo(result);
  return result;
}

/**
 * Remove small connected components (noise/dust) while preserving holes in letterforms
 * Uses connectedComponentsWithStats for proper area-based filtering without destroying topology
 *
 * @param binaryMat - Binary image where ink=WHITE (255), background=BLACK (0)
 * @param minArea - Minimum area in pixels to keep a component
 * @param rejectTopFraction - Reject components whose centroid Y is in this top fraction (for labels)
 */
export function removeSmallComponents(
  binaryMat: any,
  minArea: number = 50,
  rejectTopFraction: number = 0
): any {
  const cv = window.cv;

  // Ensure correct polarity: ink should be white (255), background black (0)
  const normalized = ensureInkIsWhite(binaryMat);

  // Use connected components with stats - this preserves topology (holes)
  const labels = new cv.Mat();
  const stats = new cv.Mat();
  const centroids = new cv.Mat();

  // Get connected components
  const numLabels = cv.connectedComponentsWithStats(normalized, labels, stats, centroids);

  const imageHeight = binaryMat.rows;
  const topRejectY = imageHeight * rejectTopFraction;

  // Build set of labels to keep
  const labelsToKeep = new Set<number>();
  let rejectedByArea = 0;
  let rejectedByPosition = 0;

  for (let i = 1; i < numLabels; i++) {
    const area = stats.intAt(i, cv.CC_STAT_AREA);
    const centroidY = centroids.doubleAt(i, 1); // col 0 = x, col 1 = y

    // Reject if too small
    if (area < minArea) {
      rejectedByArea++;
      continue;
    }

    // Reject if centroid is in the top band (label region)
    if (rejectTopFraction > 0 && centroidY < topRejectY) {
      rejectedByPosition++;
      continue;
    }

    labelsToKeep.add(i);
  }

  console.log(`[OpenCV] Components: ${numLabels - 1} total, keeping ${labelsToKeep.size}, rejected ${rejectedByArea} (area), ${rejectedByPosition} (position)`);

  // Create output by masking: keep pixels where label is in our keep set
  const result = cv.Mat.zeros(binaryMat.rows, binaryMat.cols, cv.CV_8UC1);

  // Get raw data access for speed
  const labelsData = labels.data32S; // int32 array
  const resultData = result.data;    // uint8 array
  const totalPixels = labels.rows * labels.cols;

  for (let i = 0; i < totalPixels; i++) {
    const label = labelsData[i];
    if (labelsToKeep.has(label)) {
      resultData[i] = 255;
    }
  }

  normalized.delete();
  labels.delete();
  stats.delete();
  centroids.delete();

  return result;
}

/**
 * Extract a single cell from the warped image
 */
export function extractCell(
  warpedMat: any,
  x: number,
  y: number,
  width: number,
  height: number
): any {
  const cv = window.cv;

  const rect = new cv.Rect(
    Math.round(x),
    Math.round(y),
    Math.round(width),
    Math.round(height)
  );

  return warpedMat.roi(rect);
}

/**
 * Full processing pipeline for a single page
 */
export interface ProcessedPage {
  warped: any;
  subtracted: any;
  cleaned: any;
  thresholded: any; // Debug: show what OpenCV sees
  markers: MarkerDetectionResult;
  homography: any | null;
}

export async function processPage(
  imageData: ImageData,
  blankTemplateData: ImageData,
  templateCoords: TemplateCoordinates,
  options: {
    subtractThreshold?: number;
    closeSize?: number;
    openSize?: number;
    minComponentArea?: number;
  } = {}
): Promise<ProcessedPage | null> {
  const {
    subtractThreshold = 30,
    closeSize = 3,
    openSize = 2,
    minComponentArea = 50,
  } = options;

  await loadOpenCV();

  // Convert to Mat
  const scanMat = imageDataToMat(imageData);
  const templateMat = imageDataToMat(blankTemplateData);

  // Step 1: Detect markers
  console.log('[OpenCV] Step 1: Detecting markers...');
  const markers = detectCornerMarkers(scanMat, templateCoords);

  // Return partial result with thresholded image for debugging even if detection fails
  if (!markers.success) {
    console.error('[OpenCV] Failed to detect all 4 corner markers');
    const result: ProcessedPage = {
      warped: scanMat.clone(), // Just return original
      subtracted: scanMat.clone(),
      cleaned: scanMat.clone(),
      thresholded: markers.debugBinary || scanMat.clone(),
      markers,
      homography: null,
    };
    scanMat.delete();
    templateMat.delete();
    return result;
  }

  // Step 2: Compute homography
  console.log('[OpenCV] Step 2: Computing homography...');
  const homography = computeHomography(markers, templateCoords);

  if (!homography) {
    console.error('[OpenCV] Failed to compute homography');
    scanMat.delete();
    templateMat.delete();
    return null;
  }

  // Step 3: Warp scan to template space
  console.log('[OpenCV] Step 3: Warping to template space...');
  const warped = warpToTemplate(scanMat, homography, templateCoords);

  // Step 4: Subtract template
  console.log('[OpenCV] Step 4: Subtracting template...');
  const subtracted = subtractTemplate(warped, templateMat, subtractThreshold);

  // Step 5: Morphological cleanup
  console.log('[OpenCV] Step 5: Morphological cleanup...');
  const cleaned = morphologicalCleanup(subtracted, closeSize, openSize);

  // Note: removeSmallComponents is now called per-cell in TemplateProcessor
  // This allows for centroid-Y filtering to reject labels at the top of each cell

  // Cleanup input mats
  scanMat.delete();
  templateMat.delete();

  return {
    warped,
    subtracted,
    cleaned,
    thresholded: markers.debugBinary,
    markers,
    homography,
  };
}

/**
 * Cleanup all Mats from a processed page
 */
export function cleanupProcessedPage(page: ProcessedPage): void {
  try { page.warped?.delete(); } catch {}
  try { page.subtracted?.delete(); } catch {}
  try { page.cleaned?.delete(); } catch {}
  // thresholded and markers.debugBinary are the same reference, only delete once
  try { page.thresholded?.delete(); } catch {}
  try { page.homography?.delete(); } catch {}
  // Don't delete markers.debugBinary - it's the same as thresholded
}
