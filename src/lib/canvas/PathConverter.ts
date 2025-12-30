import opentype from 'opentype.js';
import { parseSVG, makeAbsolute } from 'svg-path-parser';

interface PathCommand {
  code: string;
  x?: number;
  y?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
}

/**
 * Calculate signed area of a contour (list of points)
 * Positive = counter-clockwise, Negative = clockwise
 * Uses the shoelace formula
 */
function calculateSignedArea(points: { x: number; y: number }[]): number {
  if (points.length < 3) return 0;

  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return area / 2;
}

/**
 * Extract points from a parsed contour for area calculation
 */
function extractPointsFromCommands(commands: PathCommand[]): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];

  for (const cmd of commands) {
    if (cmd.x !== undefined && cmd.y !== undefined) {
      // For curves, we just use the endpoint for area calculation
      // This is an approximation but works well for winding detection
      points.push({ x: cmd.x, y: cmd.y });
    }
  }

  return points;
}

/**
 * Reverse a contour's winding direction
 */
function reverseContour(commands: PathCommand[]): PathCommand[] {
  if (commands.length === 0) return commands;

  // Find the starting point (first M command)
  const firstM = commands.find(c => c.code === 'M');
  if (!firstM) return commands;

  // Collect all points and their command types in reverse order
  const reversed: PathCommand[] = [];

  // Start with M at the last point before Z
  let lastPoint = { x: firstM.x!, y: firstM.y! };
  for (const cmd of commands) {
    if (cmd.x !== undefined && cmd.y !== undefined) {
      lastPoint = { x: cmd.x, y: cmd.y };
    }
  }

  reversed.push({ code: 'M', x: lastPoint.x, y: lastPoint.y });

  // Go through commands in reverse, converting curves appropriately
  for (let i = commands.length - 1; i >= 0; i--) {
    const cmd = commands[i];
    const prevCmd = i > 0 ? commands[i - 1] : firstM;

    // Get the previous point (which becomes the target in reversed path)
    let prevPoint = { x: firstM.x!, y: firstM.y! };
    if (prevCmd && prevCmd.x !== undefined && prevCmd.y !== undefined) {
      prevPoint = { x: prevCmd.x, y: prevCmd.y };
    }

    switch (cmd.code) {
      case 'L':
        reversed.push({ code: 'L', x: prevPoint.x, y: prevPoint.y });
        break;
      case 'C':
        // For cubic bezier, swap control points and reverse
        reversed.push({
          code: 'C',
          x1: cmd.x2,
          y1: cmd.y2,
          x2: cmd.x1,
          y2: cmd.y1,
          x: prevPoint.x,
          y: prevPoint.y,
        });
        break;
      case 'Q':
        // For quadratic bezier, control point stays, just change endpoint
        reversed.push({
          code: 'Q',
          x1: cmd.x1,
          y1: cmd.y1,
          x: prevPoint.x,
          y: prevPoint.y,
        });
        break;
      case 'M':
      case 'Z':
      case 'z':
        // Skip these in the middle
        break;
    }
  }

  reversed.push({ code: 'Z' });
  return reversed;
}

/**
 * Split a path string into separate contours (each starting with M and ending with Z)
 */
function splitIntoContours(commands: PathCommand[]): PathCommand[][] {
  const contours: PathCommand[][] = [];
  let current: PathCommand[] = [];

  for (const cmd of commands) {
    if (cmd.code === 'M' && current.length > 0) {
      // Start of new contour
      contours.push(current);
      current = [];
    }
    current.push(cmd);
    if (cmd.code === 'Z' || cmd.code === 'z') {
      contours.push(current);
      current = [];
    }
  }

  if (current.length > 0) {
    contours.push(current);
  }

  return contours.filter(c => c.length > 0);
}

/**
 * Convert an SVG path string (in canvas coordinates) to an opentype.js Path object
 * Use this for paths from the drawing canvas
 */
export function svgPathToOpentypePath(
  svgD: string,
  canvasSize: number = 400,
  unitsPerEm: number = 1000,
  baseline: number = 200 // Distance from bottom to baseline in font units
): opentype.Path {
  const path = new opentype.Path();

  if (!svgD || svgD.trim() === '') {
    return path;
  }

  try {
    // Parse the SVG path and convert to absolute coordinates
    const commands = makeAbsolute(parseSVG(svgD)) as PathCommand[];
    const scale = unitsPerEm / canvasSize;

    for (const cmd of commands) {
      // Transform coordinates: scale and flip Y axis
      // Canvas: Y=0 at top, increases downward
      // Font: Y=0 at baseline, increases upward
      const transformX = (x: number) => Math.round(x * scale);
      const transformY = (y: number) => Math.round((canvasSize - y) * scale - (unitsPerEm - baseline - 800));

      switch (cmd.code) {
        case 'M':
          if (cmd.x !== undefined && cmd.y !== undefined) {
            path.moveTo(transformX(cmd.x), transformY(cmd.y));
          }
          break;
        case 'L':
          if (cmd.x !== undefined && cmd.y !== undefined) {
            path.lineTo(transformX(cmd.x), transformY(cmd.y));
          }
          break;
        case 'C':
          if (cmd.x !== undefined && cmd.y !== undefined &&
              cmd.x1 !== undefined && cmd.y1 !== undefined &&
              cmd.x2 !== undefined && cmd.y2 !== undefined) {
            path.curveTo(
              transformX(cmd.x1), transformY(cmd.y1),
              transformX(cmd.x2), transformY(cmd.y2),
              transformX(cmd.x), transformY(cmd.y)
            );
          }
          break;
        case 'Q':
          if (cmd.x !== undefined && cmd.y !== undefined &&
              cmd.x1 !== undefined && cmd.y1 !== undefined) {
            path.quadraticCurveTo(
              transformX(cmd.x1), transformY(cmd.y1),
              transformX(cmd.x), transformY(cmd.y)
            );
          }
          break;
        case 'Z':
        case 'z':
          path.close();
          break;
        case 'H':
          // Horizontal line - just skip for now as they're rarely used in handwriting
          break;
        case 'V':
          // Vertical line - just skip for now as they're rarely used in handwriting
          break;
      }
    }
  } catch (error) {
    console.error('Error parsing SVG path:', error);
  }

  return path;
}

/**
 * Convert an SVG path string that's already in font coordinates to an opentype.js Path object
 * Use this for paths from the Vectorizer (which pre-normalizes coordinates)
 *
 * IMPORTANT: This function fixes winding direction for proper hole rendering.
 * OpenType fonts use the non-zero winding rule:
 * - Outer contours should be counter-clockwise (positive signed area)
 * - Inner contours (holes) should be clockwise (negative signed area)
 *
 * Accepts either:
 * - JSON format: { outlines: string[], holes: string[] } (new format from CleanVectorizer)
 * - Plain SVG path string (legacy format)
 */
export function normalizedSvgToOpentypePath(svgD: string): opentype.Path {
  const path = new opentype.Path();

  if (!svgD || svgD.trim() === '') {
    return path;
  }

  try {
    // Check if input is JSON format (new style with outlines/holes)
    let outlinePaths: string[] = [];
    let holePaths: string[] = [];
    let isJsonFormat = false;

    try {
      const parsed = JSON.parse(svgD);
      if (parsed.outlines && parsed.holes) {
        outlinePaths = parsed.outlines;
        holePaths = parsed.holes;
        isJsonFormat = true;
        console.log(`[PathConverter] JSON format: ${outlinePaths.length} outlines, ${holePaths.length} holes`);
      }
    } catch {
      // Not JSON, use legacy handling
    }

    if (isJsonFormat) {
      // NEW: Process outlines and holes with known roles
      // Outlines should be CCW (positive signed area), holes should be CW (negative)

      // Process outline paths
      // IMPORTANT: imagetracer's "outline" path often contains BOTH the outer boundary
      // AND holes as separate subpaths (e.g., "M outer... Z M hole... Z").
      // But ONLY if there are actual holes - for letters like "M" without holes,
      // all contours are legitimate parts of the letter.
      const hasHoles = holePaths.length > 0;

      for (const pathStr of outlinePaths) {
        const commands = makeAbsolute(parseSVG(pathStr)) as PathCommand[];
        const contours = splitIntoContours(commands);

        if (contours.length === 0) continue;

        // Determine which contours to emit
        let contoursToEmit: PathCommand[][];

        if (hasHoles && contours.length > 1) {
          // Has holes AND multiple contours - only use the largest (outer boundary)
          // Smaller contours are embedded holes that will be handled from holePaths
          let largestIdx = 0;
          let largestAbsArea = 0;
          for (let i = 0; i < contours.length; i++) {
            const points = extractPointsFromCommands(contours[i]);
            const absArea = Math.abs(calculateSignedArea(points));
            if (absArea > largestAbsArea) {
              largestAbsArea = absArea;
              largestIdx = i;
            }
          }
          console.log(`[PathConverter] Outline has ${contours.length} contours + ${holePaths.length} holes, using largest (#${largestIdx}, area=${largestAbsArea.toFixed(0)})`);
          contoursToEmit = [contours[largestIdx]];
        } else {
          // No holes OR single contour - use all contours (they're all part of the letter)
          if (contours.length > 1) {
            console.log(`[PathConverter] Outline has ${contours.length} contours, NO holes - using all contours`);
          }
          contoursToEmit = contours;
        }

        // Emit the selected contours with proper CCW winding
        for (const contour of contoursToEmit) {
          const points = extractPointsFromCommands(contour);
          const signedArea = calculateSignedArea(points);

          // Outlines need CCW winding (positive area in Y-up coordinates)
          const needsReverse = signedArea < 0;
          const finalContour = needsReverse ? reverseContour(contour) : contour;

          if (needsReverse) {
            const reversedPoints = extractPointsFromCommands(finalContour);
            const reversedArea = calculateSignedArea(reversedPoints);
            console.log(`[PathConverter] Reversing outline: ${signedArea.toFixed(0)} → ${reversedArea.toFixed(0)} (should be positive)`);
          }

          emitContourToPath(finalContour, path);
        }
      }

      // Process hole paths
      for (const pathStr of holePaths) {
        console.log(`[PathConverter] Processing hole path: "${pathStr.substring(0, 100)}..."`);
        const commands = makeAbsolute(parseSVG(pathStr)) as PathCommand[];
        console.log(`[PathConverter] Hole parsed commands: ${commands.length}`);
        const contours = splitIntoContours(commands);
        console.log(`[PathConverter] Hole contours: ${contours.length}`);

        for (const contour of contours) {
          const points = extractPointsFromCommands(contour);
          const signedArea = calculateSignedArea(points);
          console.log(`[PathConverter] Hole contour: ${contour.length} cmds, ${points.length} points, signedArea=${signedArea.toFixed(0)}`);

          // Holes need CW winding (negative area in Y-up coordinates)
          const needsReverse = signedArea > 0;
          const finalContour = needsReverse ? reverseContour(contour) : contour;

          if (needsReverse) {
            console.log(`[PathConverter] Reversing hole (signedArea=${signedArea.toFixed(0)} → CW)`);
          } else {
            console.log(`[PathConverter] Hole already CW (signedArea=${signedArea.toFixed(0)})`);
          }

          emitContourToPath(finalContour, path);
        }
      }

      // Debug: show final path command count and verify final winding
      console.log(`[PathConverter] Final path has ${path.commands.length} commands`);

      // Verify final path contours have correct winding
      debugVerifyFinalPath(path);
    } else {
      // LEGACY: Plain SVG path - use area-based heuristic
      const commands = makeAbsolute(parseSVG(svgD)) as PathCommand[];
      const contours = splitIntoContours(commands);

      if (contours.length === 0) {
        return path;
      }

      // Calculate signed area and absolute area for each contour
      const contourData = contours.map(contour => {
        const points = extractPointsFromCommands(contour);
        const signedArea = calculateSignedArea(points);
        return {
          contour,
          signedArea,
          absArea: Math.abs(signedArea),
        };
      });

      // Sort by absolute area (largest first = outer contours)
      contourData.sort((a, b) => b.absArea - a.absArea);

      // The largest contour is the outer boundary - should be CCW (positive area)
      // Smaller contours inside it are holes - should be CW (negative area)
      for (let i = 0; i < contourData.length; i++) {
        const { contour, signedArea } = contourData[i];
        const isOuter = i === 0;

        // OpenType with Y-up: outer = CCW (positive), holes = CW (negative)
        const needsReverse = isOuter ? signedArea < 0 : signedArea > 0;

        if (needsReverse) {
          console.log(`[PathConverter] Reversing contour ${i} (area=${signedArea.toFixed(0)}, isOuter=${isOuter})`);
          emitContourToPath(reverseContour(contour), path);
        } else {
          emitContourToPath(contour, path);
        }
      }
    }
  } catch (error) {
    console.error('Error parsing normalized SVG path:', error);
  }

  return path;
}

/**
 * Debug: verify final opentype path has correct winding directions
 */
function debugVerifyFinalPath(path: opentype.Path): void {
  // Extract contours from opentype path commands
  const contours: { x: number; y: number }[][] = [];
  let currentContour: { x: number; y: number }[] = [];

  for (const cmd of path.commands) {
    if (cmd.type === 'M') {
      if (currentContour.length > 0) {
        contours.push(currentContour);
      }
      currentContour = [{ x: cmd.x, y: cmd.y }];
    } else if (cmd.type === 'L' || cmd.type === 'C' || cmd.type === 'Q') {
      currentContour.push({ x: cmd.x, y: cmd.y });
    } else if (cmd.type === 'Z') {
      if (currentContour.length > 0) {
        contours.push(currentContour);
        currentContour = [];
      }
    }
  }
  if (currentContour.length > 0) {
    contours.push(currentContour);
  }

  // Count M and Z commands
  const mCount = path.commands.filter(c => c.type === 'M').length;
  const zCount = path.commands.filter(c => c.type === 'Z').length;

  console.log(`[PathConverter] FINAL PATH VERIFICATION:`);
  console.log(`[PathConverter]   Total commands: ${path.commands.length}, M commands: ${mCount}, Z commands: ${zCount}`);
  console.log(`[PathConverter]   Total contours extracted: ${contours.length}`);

  // Calculate and report signed area for each contour
  for (let i = 0; i < contours.length; i++) {
    const points = contours[i];
    const signedArea = calculateSignedArea(points);
    const absArea = Math.abs(signedArea);
    const winding = signedArea > 0 ? 'CCW (outer)' : signedArea < 0 ? 'CW (hole)' : 'degenerate';
    console.log(`[PathConverter]   Contour ${i}: ${points.length} points, signedArea=${signedArea.toFixed(0)}, absArea=${absArea.toFixed(0)}, winding=${winding}`);
  }

  // For proper rendering with non-zero fill:
  // - Largest contour (by abs area) should be CCW (positive)
  // - Smaller contours inside should be CW (negative)
  if (contours.length > 1) {
    const sortedByArea = contours.map((pts, idx) => ({
      idx,
      signedArea: calculateSignedArea(pts),
      absArea: Math.abs(calculateSignedArea(pts)),
    })).sort((a, b) => b.absArea - a.absArea);

    const largest = sortedByArea[0];
    console.log(`[PathConverter]   Largest contour is #${largest.idx} with absArea=${largest.absArea.toFixed(0)}`);
    if (largest.signedArea < 0) {
      console.log(`[PathConverter]   ⚠️ WARNING: Largest contour is CW (negative) - should be CCW for outer boundary!`);
    }
    for (let i = 1; i < sortedByArea.length; i++) {
      const inner = sortedByArea[i];
      if (inner.signedArea > 0) {
        console.log(`[PathConverter]   ⚠️ WARNING: Inner contour #${inner.idx} is CCW (positive) - should be CW for hole!`);
      }
    }
  }

  // Dump first few commands of the path for debugging
  if (path.commands.length > 0) {
    console.log(`[PathConverter]   First 10 commands of final path:`);
    for (let i = 0; i < Math.min(10, path.commands.length); i++) {
      const cmd = path.commands[i];
      if (cmd.type === 'M' || cmd.type === 'L') {
        console.log(`[PathConverter]     ${i}: ${cmd.type} (${cmd.x}, ${cmd.y})`);
      } else if (cmd.type === 'Z') {
        console.log(`[PathConverter]     ${i}: Z`);
      } else if (cmd.type === 'C') {
        console.log(`[PathConverter]     ${i}: C (..., ${cmd.x}, ${cmd.y})`);
      } else if (cmd.type === 'Q') {
        console.log(`[PathConverter]     ${i}: Q (..., ${cmd.x}, ${cmd.y})`);
      }
    }
  }
}

/**
 * Emit a contour's commands to an opentype path
 */
function emitContourToPath(contour: PathCommand[], path: opentype.Path): void {
  for (const cmd of contour) {
    switch (cmd.code) {
      case 'M':
        if (cmd.x !== undefined && cmd.y !== undefined) {
          path.moveTo(Math.round(cmd.x), Math.round(cmd.y));
        }
        break;
      case 'L':
        if (cmd.x !== undefined && cmd.y !== undefined) {
          path.lineTo(Math.round(cmd.x), Math.round(cmd.y));
        }
        break;
      case 'C':
        if (cmd.x !== undefined && cmd.y !== undefined &&
            cmd.x1 !== undefined && cmd.y1 !== undefined &&
            cmd.x2 !== undefined && cmd.y2 !== undefined) {
          path.curveTo(
            Math.round(cmd.x1), Math.round(cmd.y1),
            Math.round(cmd.x2), Math.round(cmd.y2),
            Math.round(cmd.x), Math.round(cmd.y)
          );
        }
        break;
      case 'Q':
        if (cmd.x !== undefined && cmd.y !== undefined &&
            cmd.x1 !== undefined && cmd.y1 !== undefined) {
          path.quadraticCurveTo(
            Math.round(cmd.x1), Math.round(cmd.y1),
            Math.round(cmd.x), Math.round(cmd.y)
          );
        }
        break;
      case 'Z':
      case 'z':
        path.close();
        break;
      case 'H':
        // Horizontal lines - skip (rarely used)
        break;
      case 'V':
        // Vertical lines - skip (rarely used)
        break;
    }
  }
}

/**
 * Get the bounding box of an opentype path
 */
export function getPathBoundingBox(path: opentype.Path): {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  height: number;
} {
  const bbox = path.getBoundingBox();
  return {
    ...bbox,
    width: bbox.x2 - bbox.x1,
    height: bbox.y2 - bbox.y1,
  };
}

/**
 * Calculate advance width from path bounding box
 */
export function calculateAdvanceWidth(
  path: opentype.Path,
  sideBearing: number = 50
): number {
  const bbox = path.getBoundingBox();
  return Math.round(sideBearing + (bbox.x2 - bbox.x1) + sideBearing);
}

/**
 * Center and normalize a path within the glyph space
 */
export function normalizeGlyphPath(
  path: opentype.Path,
  targetWidth: number = 500,
  targetBaseline: number = 0
): opentype.Path {
  const bbox = path.getBoundingBox();
  const width = bbox.x2 - bbox.x1;
  const offsetX = (targetWidth - width) / 2 - bbox.x1;
  const offsetY = targetBaseline - bbox.y1;

  const normalizedPath = new opentype.Path();

  for (const cmd of path.commands) {
    switch (cmd.type) {
      case 'M':
        normalizedPath.moveTo(cmd.x + offsetX, cmd.y + offsetY);
        break;
      case 'L':
        normalizedPath.lineTo(cmd.x + offsetX, cmd.y + offsetY);
        break;
      case 'C':
        normalizedPath.curveTo(
          cmd.x1 + offsetX, cmd.y1 + offsetY,
          cmd.x2 + offsetX, cmd.y2 + offsetY,
          cmd.x + offsetX, cmd.y + offsetY
        );
        break;
      case 'Q':
        normalizedPath.quadraticCurveTo(
          cmd.x1 + offsetX, cmd.y1 + offsetY,
          cmd.x + offsetX, cmd.y + offsetY
        );
        break;
      case 'Z':
        normalizedPath.close();
        break;
    }
  }

  return normalizedPath;
}
