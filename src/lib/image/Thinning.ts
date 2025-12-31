/**
 * Zhang-Suen Thinning Algorithm
 * Produces a 1-pixel wide skeleton from a binary image
 *
 * Input: Binary ImageData where ink=white(255), background=black(0)
 * Output: Skeletonized ImageData with same convention
 */

/**
 * Zhang-Suen thinning algorithm implementation
 * Based on: T.Y. Zhang and C.Y. Suen, "A fast parallel algorithm for thinning digital patterns"
 */
export function zhangSuenThinning(input: ImageData): ImageData {
  const { width, height, data } = input;

  // Create binary grid (1 = foreground/ink, 0 = background)
  const grid: number[][] = [];
  for (let y = 0; y < height; y++) {
    grid[y] = [];
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      // Ink is white (>128), background is black
      grid[y][x] = data[idx] > 128 ? 1 : 0;
    }
  }

  let changed = true;
  let iterations = 0;
  const maxIterations = 1000; // Safety limit

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    // Sub-iteration 1
    const toRemove1: [number, number][] = [];
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        if (grid[y][x] === 1 && shouldRemoveStep1(grid, x, y)) {
          toRemove1.push([x, y]);
        }
      }
    }
    for (const [x, y] of toRemove1) {
      grid[y][x] = 0;
      changed = true;
    }

    // Sub-iteration 2
    const toRemove2: [number, number][] = [];
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        if (grid[y][x] === 1 && shouldRemoveStep2(grid, x, y)) {
          toRemove2.push([x, y]);
        }
      }
    }
    for (const [x, y] of toRemove2) {
      grid[y][x] = 0;
      changed = true;
    }
  }

  console.log(`[zhangSuenThinning] Completed in ${iterations} iterations`);

  // Convert back to ImageData
  const result = new ImageData(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const val = grid[y][x] === 1 ? 255 : 0;
      result.data[idx] = val;
      result.data[idx + 1] = val;
      result.data[idx + 2] = val;
      result.data[idx + 3] = 255;
    }
  }

  return result;
}

/**
 * Get the 8 neighbors of a pixel in order: P2, P3, P4, P5, P6, P7, P8, P9
 *
 *   P9 P2 P3
 *   P8 P1 P4
 *   P7 P6 P5
 *
 * Returns array [P2, P3, P4, P5, P6, P7, P8, P9]
 */
function getNeighbors(grid: number[][], x: number, y: number): number[] {
  return [
    grid[y - 1][x],     // P2 (north)
    grid[y - 1][x + 1], // P3 (northeast)
    grid[y][x + 1],     // P4 (east)
    grid[y + 1][x + 1], // P5 (southeast)
    grid[y + 1][x],     // P6 (south)
    grid[y + 1][x - 1], // P7 (southwest)
    grid[y][x - 1],     // P8 (west)
    grid[y - 1][x - 1], // P9 (northwest)
  ];
}

/**
 * Count the number of 0->1 transitions in the ordered sequence of neighbors
 * This is B(P1) in the Zhang-Suen paper
 */
function countTransitions(neighbors: number[]): number {
  let count = 0;
  for (let i = 0; i < 8; i++) {
    if (neighbors[i] === 0 && neighbors[(i + 1) % 8] === 1) {
      count++;
    }
  }
  return count;
}

/**
 * Count the number of non-zero neighbors
 * This is A(P1) in the Zhang-Suen paper
 */
function countNonZeroNeighbors(neighbors: number[]): number {
  return neighbors.reduce((sum, val) => sum + val, 0);
}

/**
 * Check if pixel should be removed in step 1
 * Conditions:
 * (a) 2 <= A(P1) <= 6
 * (b) B(P1) = 1
 * (c) P2 * P4 * P6 = 0
 * (d) P4 * P6 * P8 = 0
 */
function shouldRemoveStep1(grid: number[][], x: number, y: number): boolean {
  const neighbors = getNeighbors(grid, x, y);
  const [P2, P3, P4, P5, P6, P7, P8, P9] = neighbors;

  const A = countNonZeroNeighbors(neighbors);
  const B = countTransitions(neighbors);

  return (
    A >= 2 && A <= 6 &&
    B === 1 &&
    P2 * P4 * P6 === 0 &&
    P4 * P6 * P8 === 0
  );
}

/**
 * Check if pixel should be removed in step 2
 * Conditions:
 * (a) 2 <= A(P1) <= 6
 * (b) B(P1) = 1
 * (c) P2 * P4 * P8 = 0
 * (d) P2 * P6 * P8 = 0
 */
function shouldRemoveStep2(grid: number[][], x: number, y: number): boolean {
  const neighbors = getNeighbors(grid, x, y);
  const [P2, P3, P4, P5, P6, P7, P8, P9] = neighbors;

  const A = countNonZeroNeighbors(neighbors);
  const B = countTransitions(neighbors);

  return (
    A >= 2 && A <= 6 &&
    B === 1 &&
    P2 * P4 * P8 === 0 &&
    P2 * P6 * P8 === 0
  );
}
