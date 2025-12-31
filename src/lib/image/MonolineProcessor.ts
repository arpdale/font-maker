import { zhangSuenThinning } from './Thinning';

export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  points: Point[];
  length: number;
}

export interface MonolineOptions {
  pruneThreshold?: number;
  simplifyEpsilon?: number;
  smoothingIterations?: number;
  joinStrokes?: boolean;
  joinMaxGap?: number;
}

export interface MonolineResult {
  rawStrokes: Stroke[];
  strokes: Stroke[];
  smoothedStrokes: Stroke[];
  skeleton: ImageData;
  stats: SkeletonStats;
}

export interface SkeletonStats {
  totalPixels: number;
  endpoints: number;
  junctions: number;
  endpointPositions: Point[];
  junctionPositions: Point[];
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Extract strokes from a skeletonized image
 */
export function extractStrokesFromSkeleton(skeletonData: ImageData): Stroke[] {
  const { width, height, data } = skeletonData;
  const visited = new Uint8Array(width * height);
  const strokes: Stroke[] = [];

  // Helper to get pixel value
  const isInk = (x: number, y: number) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    return data[(y * width + x) * 4] > 128;
  };

  // Helper to get neighbors
  const getNeighbors = (x: number, y: number) => {
    const neighbors: Point[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (isInk(nx, ny)) {
          neighbors.push({ x: nx, y: ny });
        }
      }
    }
    return neighbors;
  };

  // Find all skeleton pixels
  const allPixels: Point[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isInk(x, y)) {
        allPixels.push({ x, y });
      }
    }
  }

  // Find endpoints (pixels with only 1 neighbor)
  const endpoints = allPixels.filter((p) => getNeighbors(p.x, p.y).length === 1);

  // Path walking function
  const walkPath = (start: Point): Stroke | null => {
    if (visited[start.y * width + start.x]) return null;

    const points: Point[] = [start];
    visited[start.y * width + start.x] = 1;

    let current = start;
    let walking = true;

    while (walking) {
      const neighbors = getNeighbors(current.x, current.y);
      const next = neighbors.find((n) => !visited[n.y * width + n.x]);

      if (next) {
        points.push(next);
        visited[next.y * width + next.x] = 1;
        current = next;
      } else {
        walking = false;
      }
    }

    if (points.length < 2) return null;

    // Calculate length
    let length = 0;
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      length += Math.sqrt(dx * dx + dy * dy);
    }

    return { points, length };
  };

  // First pass: walk from endpoints
  for (const p of endpoints) {
    const stroke = walkPath(p);
    if (stroke) strokes.push(stroke);
  }

  // Second pass: walk from any remaining pixels (loops)
  for (const p of allPixels) {
    const stroke = walkPath(p);
    if (stroke) strokes.push(stroke);
  }

  return strokes;
}

/**
 * Prune short strokes (spurs/noise)
 */
export function pruneShortStrokes(strokes: Stroke[], threshold: number): Stroke[] {
  return strokes.filter((s) => s.length >= threshold);
}

/**
 * Join strokes that have endpoints close to each other
 */
export function joinNearbyStrokes(strokes: Stroke[], maxGap: number): Stroke[] {
  if (strokes.length < 2) return strokes;

  const result = [...strokes];
  let joined = true;

  while (joined) {
    joined = false;
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const s1 = result[i];
        const s2 = result[j];

        const p1s = s1.points[0];
        const p1e = s1.points[s1.points.length - 1];
        const p2s = s2.points[0];
        const p2e = s2.points[s2.points.length - 1];

        const dist = (a: Point, b: Point) =>
          Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

        let combined: Point[] | null = null;

        if (dist(p1e, p2s) <= maxGap) {
          combined = [...s1.points, ...s2.points];
        } else if (dist(p1e, p2e) <= maxGap) {
          combined = [...s1.points, ...[...s2.points].reverse()];
        } else if (dist(p1s, p2s) <= maxGap) {
          combined = [...[...s1.points].reverse(), ...s2.points];
        } else if (dist(p1s, p2e) <= maxGap) {
          combined = [...s2.points, ...s1.points];
        }

        if (combined) {
          // Calculate new length
          let length = 0;
          for (let k = 1; k < combined.length; k++) {
            const dx = combined[k].x - combined[k - 1].x;
            const dy = combined[k].y - combined[k - 1].y;
            length += Math.sqrt(dx * dx + dy * dy);
          }

          result[i] = { points: combined, length };
          result.splice(j, 1);
          joined = true;
          break;
        }
      }
      if (joined) break;
    }
  }

  return result;
}

/**
 * Smooth a stroke using a simple moving average
 */
export function smoothStrokeMovingAverage(points: Point[], windowSize: number = 3): Point[] {
  if (points.length <= windowSize) return points;

  const smoothed: Point[] = [];
  const halfWindow = Math.floor(windowSize / 2);

  for (let i = 0; i < points.length; i++) {
    let sumX = 0;
    let sumY = 0;
    let count = 0;

    for (let j = i - halfWindow; j <= i + halfWindow; j++) {
      if (j >= 0 && j < points.length) {
        sumX += points[j].x;
        sumY += points[j].y;
        count++;
      }
    }

    smoothed.push({ x: sumX / count, y: sumY / count });
  }

  return smoothed;
}

/**
 * Smooth a stroke using Chaikin's algorithm
 */
export function smoothStrokeChaikin(points: Point[], iterations: number = 1): Point[] {
  if (points.length < 3 || iterations === 0) return points;

  let current = points;

  for (let iter = 0; iter < iterations; iter++) {
    const next: Point[] = [current[0]];

    for (let i = 0; i < current.length - 1; i++) {
      const p0 = current[i];
      const p1 = current[i + 1];

      // Q = 3/4*p0 + 1/4*p1
      next.push({
        x: 0.75 * p0.x + 0.25 * p1.x,
        y: 0.75 * p0.y + 0.25 * p1.y,
      });

      // R = 1/4*p0 + 3/4*p1
      next.push({
        x: 0.25 * p0.x + 0.75 * p1.x,
        y: 0.25 * p0.y + 0.75 * p1.y,
      });
    }

    next.push(current[current.length - 1]);
    current = next;
  }

  return current;
}

/**
 * Simplify a stroke using Douglas-Peucker algorithm
 */
export function simplifyStroke(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2) return points;

  const findMaxDistance = (pts: Point[], start: number, end: number) => {
    let maxDist = 0;
    let index = 0;

    const p1 = pts[start];
    const p2 = pts[end];

    for (let i = start + 1; i < end; i++) {
      const p = pts[i];
      // Distance from point to line
      const dist =
        Math.abs((p2.y - p1.y) * p.x - (p2.x - p1.x) * p.y + p2.x * p1.y - p2.y * p1.x) /
        Math.sqrt((p2.y - p1.y) ** 2 + (p2.x - p1.x) ** 2);

      if (dist > maxDist) {
        maxDist = dist;
        index = i;
      }
    }

    return { maxDist, index };
  };

  const simplify = (pts: Point[], start: number, end: number): Point[] => {
    const { maxDist, index } = findMaxDistance(pts, start, end);

    if (maxDist > epsilon) {
      const left = simplify(pts, start, index);
      const right = simplify(pts, index, end);
      return [...left.slice(0, -1), ...right];
    } else {
      return [pts[start], pts[end]];
    }
  };

  return simplify(points, 0, points.length - 1);
}

/**
 * Analyze a skeleton image to get stats
 */
export function analyzeSkeletonImage(skeleton: ImageData): SkeletonStats {
  const { width, height, data } = skeleton;
  let totalPixels = 0;
  let minX = width, minY = height, maxX = 0, maxY = 0;

  const isInk = (x: number, y: number) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    return data[(y * width + x) * 4] > 128;
  };

  const getNeighborCount = (x: number, y: number) => {
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        if (isInk(x + dx, y + dy)) count++;
      }
    }
    return count;
  };

  const endpointPositions: Point[] = [];
  const junctionPositions: Point[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isInk(x, y)) {
        totalPixels++;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);

        const neighbors = getNeighborCount(x, y);
        if (neighbors === 1) {
          endpointPositions.push({ x, y });
        } else if (neighbors > 2) {
          junctionPositions.push({ x, y });
        }
      }
    }
  }

  return {
    totalPixels,
    endpoints: endpointPositions.length,
    junctions: junctionPositions.length,
    endpointPositions,
    junctionPositions,
    boundingBox: {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1
    }
  };
}

/**
 * Ensure foreground ink is white (255) and background is black (0)
 */
export function ensureForegroundInk(image: ImageData, invertIfNecessary: boolean = true): ImageData {
  const { width, height, data } = image;
  const result = new ImageData(new Uint8ClampedArray(data), width, height);

  // Count dark vs light pixels
  let darkCount = 0;
  let lightCount = 0;
  for (let i = 0; i < data.length; i += 4) {
    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
    if (avg < 128) darkCount++;
    else lightCount++;
  }

  // If mostly light, assume ink is dark and background is light
  const shouldInvert = invertIfNecessary && lightCount > darkCount;

  for (let i = 0; i < result.data.length; i += 4) {
    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
    const val = shouldInvert ? (avg < 128 ? 255 : 0) : (avg > 128 ? 255 : 0);
    result.data[i] = val;
    result.data[i + 1] = val;
    result.data[i + 2] = val;
    result.data[i + 3] = 255;
  }

  return result;
}

/**
 * Calculate dynamic prune threshold based on bounding box
 */
function calculatePruneThreshold(bbox: { width: number; height: number }): number {
  const size = Math.min(bbox.width, bbox.height);
  return Math.max(3, Math.floor(size * 0.05));
}

/**
 * Calculate dynamic simplify epsilon based on bounding box
 */
function calculateSimplifyEpsilon(bbox: { width: number; height: number }): number {
  const size = Math.min(bbox.width, bbox.height);
  return Math.max(0.5, size * 0.005);
}

/**
 * Full monoline processing: binary mask → skeleton → strokes
 * Pipeline order: Extract → Prune → Join → Smooth → Simplify
 */
export function processMonoline(
  binaryMask: ImageData,
  options: MonolineOptions = {}
): MonolineResult {
  const {
    smoothingIterations = 2,
    joinStrokes = true,
  } = options;

  console.log('[processMonoline] Starting monoline processing...');

  // Step 1: Ensure correct ink polarity (ink=white=255, bg=black=0)
  const prepared = ensureForegroundInk(binaryMask, true);

  // Step 2: Apply Zhang-Suen thinning
  const skeleton = zhangSuenThinning(prepared);

  // Step 3: Analyze skeleton
  const stats = analyzeSkeletonImage(skeleton);
  console.log('[processMonoline] Skeleton stats:', stats);

  // Step 4: Extract strokes
  const rawStrokes = extractStrokesFromSkeleton(skeleton);

  // Step 5: Calculate dynamic thresholds
  const pruneThreshold = options.pruneThreshold ?? calculatePruneThreshold(stats.boundingBox);
  const simplifyEps = options.simplifyEpsilon ?? calculateSimplifyEpsilon(stats.boundingBox);
  // Join gap for connecting strokes at shared junctions
  const joinGap = options.joinMaxGap ?? Math.max(5, Math.min(stats.boundingBox.width, stats.boundingBox.height) * 0.3);

  // Step 6: Join nearby stroke endpoints FIRST (before pruning!)
  // This prevents short branch strokes from being pruned - they get merged into longer strokes
  // Run multiple passes until no more joins happen
  let strokes = rawStrokes;
  if (joinStrokes && strokes.length > 1) {
    let prevCount = strokes.length;
    let passes = 0;
    const maxPasses = 10;
    while (passes < maxPasses) {
      strokes = joinNearbyStrokes(strokes, joinGap);
      passes++;
      if (strokes.length === prevCount) break;
      prevCount = strokes.length;
    }
    console.log(`[processMonoline] After ${passes} join passes: ${strokes.length} strokes`);
  }

  // Step 7: Prune short strokes (remove spurs/noise) - AFTER joining
  strokes = pruneShortStrokes(strokes, pruneThreshold);

  // Step 8: Smooth and simplify each stroke
  // Pipeline: moving average → Chaikin → simplify
  const smoothedStrokes: Stroke[] = strokes.map((stroke, idx) => {
    let points = stroke.points;
    console.log(`[processMonoline] Stroke ${idx}: input ${points.length} points`);

    // 1. Moving average to smooth pixel jaggies
    points = smoothStrokeMovingAverage(points, 2);
    console.log(`[processMonoline] Stroke ${idx}: after moving avg ${points.length} points`);

    // 2. Chaikin corner-cutting to round corners
    if (smoothingIterations > 0) {
      points = smoothStrokeChaikin(points, smoothingIterations);
      console.log(`[processMonoline] Stroke ${idx}: after Chaikin ${points.length} points`);
    }

    // 3. Douglas-Peucker to reduce point count
    const beforeSimplify = points.length;
    points = simplifyStroke(points, simplifyEps);
    console.log(`[processMonoline] Stroke ${idx}: after simplify ${points.length} points (was ${beforeSimplify}, eps=${simplifyEps.toFixed(2)})`);

    // Recalculate length
    let length = 0;
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      length += Math.sqrt(dx * dx + dy * dy);
    }

    return { points, length };
  });

  // Step 9: Endpoint welding - ensures strokes that should meet share exact coordinates
  // This is the key step to eliminate visual gaps at junctions
  const weldRadius = 3; // pixels - endpoints within this distance get welded together
  const weldedStrokes = weldEndpoints(smoothedStrokes, weldRadius);

  // Endpoint drift logging - track where gaps might be introduced
  const countNear = (s: Stroke[], r: number) => countNearbyEndpoints(s, r);
  console.log('[processMonoline] Endpoint drift analysis (pairs within 3px):');
  console.log(`  After extraction: ${countNear(rawStrokes, 3)}`);
  console.log(`  After join/prune: ${countNear(strokes, 3)}`);
  console.log(`  After smoothing:  ${countNear(smoothedStrokes, 3)}`);
  console.log(`  After welding:    ${countNear(weldedStrokes, 3)}`);

  console.log('[processMonoline] Processing complete:', {
    rawStrokes: rawStrokes.length,
    afterJoinPrune: strokes.length,
    afterSmoothing: smoothedStrokes.length,
    afterWelding: weldedStrokes.length,
  });

  return {
    rawStrokes,
    strokes,
    smoothedStrokes: weldedStrokes, // Return welded strokes as the final smoothed output
    skeleton,
    stats,
  };
}

// ============================================================================
// ENDPOINT WELDING
// ============================================================================

/**
 * Weld nearby endpoints together by clustering and replacing with centroids.
 * This ensures strokes that should meet at junctions share exact coordinates.
 * Should be called AFTER all smoothing/simplification, right before SVG generation.
 *
 * @param strokes - Input strokes with endpoints that may be slightly apart
 * @param weldRadius - Maximum distance to consider endpoints as "same" (default 2px)
 */
export function weldEndpoints(strokes: Stroke[], weldRadius: number = 2): Stroke[] {
  if (strokes.length === 0) return strokes;

  // Collect all endpoints (start and end of each stroke)
  interface EndpointRef {
    strokeIdx: number;
    isStart: boolean;
    point: Point;
  }

  const endpoints: EndpointRef[] = [];
  for (let i = 0; i < strokes.length; i++) {
    const pts = strokes[i].points;
    if (pts.length < 2) continue;
    endpoints.push({ strokeIdx: i, isStart: true, point: pts[0] });
    endpoints.push({ strokeIdx: i, isStart: false, point: pts[pts.length - 1] });
  }

  // Cluster endpoints within weldRadius using union-find
  const parent: number[] = endpoints.map((_, i) => i);

  const find = (i: number): number => {
    if (parent[i] !== i) parent[i] = find(parent[i]);
    return parent[i];
  };

  const union = (i: number, j: number) => {
    const pi = find(i), pj = find(j);
    if (pi !== pj) parent[pi] = pj;
  };

  const dist = (a: Point, b: Point) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

  // Find clusters
  for (let i = 0; i < endpoints.length; i++) {
    for (let j = i + 1; j < endpoints.length; j++) {
      if (dist(endpoints[i].point, endpoints[j].point) <= weldRadius) {
        union(i, j);
      }
    }
  }

  // Group by cluster and compute centroids
  const clusters = new Map<number, EndpointRef[]>();
  for (let i = 0; i < endpoints.length; i++) {
    const root = find(i);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root)!.push(endpoints[i]);
  }

  // Compute centroid for each cluster and build replacement map
  const replacements = new Map<string, Point>(); // "strokeIdx,isStart" -> new point

  let weldedCount = 0;
  for (const cluster of clusters.values()) {
    if (cluster.length <= 1) continue; // No welding needed

    // Compute centroid
    const centroid: Point = {
      x: cluster.reduce((s, e) => s + e.point.x, 0) / cluster.length,
      y: cluster.reduce((s, e) => s + e.point.y, 0) / cluster.length,
    };

    // Map each endpoint in cluster to centroid
    for (const ep of cluster) {
      replacements.set(`${ep.strokeIdx},${ep.isStart}`, centroid);
    }
    weldedCount += cluster.length;
  }

  console.log(`[weldEndpoints] Welded ${weldedCount} endpoints into ${clusters.size - (endpoints.length - weldedCount)} clusters (radius=${weldRadius})`);

  // Apply replacements to strokes
  return strokes.map((stroke, idx) => {
    const pts = [...stroke.points.map(p => ({ x: p.x, y: p.y }))];

    const startKey = `${idx},true`;
    const endKey = `${idx},false`;

    if (replacements.has(startKey)) {
      const newPt = replacements.get(startKey)!;
      pts[0] = { x: newPt.x, y: newPt.y };
    }

    if (replacements.has(endKey)) {
      const newPt = replacements.get(endKey)!;
      pts[pts.length - 1] = { x: newPt.x, y: newPt.y };
    }

    // Recalculate length
    let length = 0;
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x;
      const dy = pts[i].y - pts[i - 1].y;
      length += Math.sqrt(dx * dx + dy * dy);
    }

    return { points: pts, length };
  });
}

/**
 * Debug helper: count how many endpoint pairs are within a given radius
 */
export function countNearbyEndpoints(strokes: Stroke[], radius: number): number {
  const endpoints: Point[] = [];
  for (const s of strokes) {
    if (s.points.length < 2) continue;
    endpoints.push(s.points[0]);
    endpoints.push(s.points[s.points.length - 1]);
  }

  let count = 0;
  for (let i = 0; i < endpoints.length; i++) {
    for (let j = i + 1; j < endpoints.length; j++) {
      const dx = endpoints[i].x - endpoints[j].x;
      const dy = endpoints[i].y - endpoints[j].y;
      if (Math.sqrt(dx * dx + dy * dy) <= radius) count++;
    }
  }
  return count;
}

// ============================================================================
// SVG EXPORT
// ============================================================================

/**
 * Convert strokes to SVG path string using quadratic curves for smoothness
 * Uses M (moveto) and Q (quadratic curve) commands
 * This produces much smoother output for pen plotters
 */
export function strokesToSvgPath(strokes: Stroke[], useCurves: boolean = false): string {
  let path = '';

  console.log(`[strokesToSvgPath] Converting ${strokes.length} strokes to SVG`);

  for (let si = 0; si < strokes.length; si++) {
    const stroke = strokes[si];
    if (stroke.points.length < 2) {
      console.log(`[strokesToSvgPath] Stroke ${si}: skipped (${stroke.points.length} points)`);
      continue;
    }

    console.log(`[strokesToSvgPath] Stroke ${si}: ${stroke.points.length} points, length=${stroke.length.toFixed(1)}`);
    console.log(`[strokesToSvgPath]   First point: (${stroke.points[0].x.toFixed(1)}, ${stroke.points[0].y.toFixed(1)})`);
    console.log(`[strokesToSvgPath]   Last point: (${stroke.points[stroke.points.length - 1].x.toFixed(1)}, ${stroke.points[stroke.points.length - 1].y.toFixed(1)})`);

    const points = stroke.points;
    const first = points[0];
    path += `M ${first.x.toFixed(2)} ${first.y.toFixed(2)} `;

    if (!useCurves || points.length < 3) {
      // Simple line segments
      for (let i = 1; i < points.length; i++) {
        const p = points[i];
        path += `L ${p.x.toFixed(2)} ${p.y.toFixed(2)} `;
      }
    } else {
      // Quadratic curves through midpoints for smooth output
      // This is the Catmull-Rom to quadratic conversion approach
      for (let i = 1; i < points.length - 1; i++) {
        const p0 = points[i - 1];
        const p1 = points[i];
        const p2 = points[i + 1];

        // Midpoint between current and next
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;

        // Quadratic curve with p1 as control point, midpoint as end
        path += `Q ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} ${midX.toFixed(2)} ${midY.toFixed(2)} `;
      }

      // Final segment to last point
      const last = points[points.length - 1];
      const secondLast = points[points.length - 2];
      path += `Q ${secondLast.x.toFixed(2)} ${secondLast.y.toFixed(2)} ${last.x.toFixed(2)} ${last.y.toFixed(2)} `;
    }
  }

  return path.trim();
}

/**
 * Convert strokes to SVG path string using only line segments
 * Use this if you need precise control points (e.g., for CNC)
 */
export function strokesToSvgPathLines(strokes: Stroke[]): string {
  return strokesToSvgPath(strokes, false);
}

/**
 * Create a complete SVG element for strokes
 * @param strokes - Strokes to render
 * @param width - SVG width
 * @param height - SVG height
 * @param strokeWidth - Stroke width for rendering
 */
export function strokesToSvgElement(
  strokes: Stroke[],
  width: number,
  height: number,
  strokeWidth: number = 1,
  useCurves: boolean = true  // Default to curves for smooth plotter output
): string {
  const pathData = strokesToSvgPath(strokes, useCurves);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <path d="${pathData}" fill="none" stroke="black" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
}
