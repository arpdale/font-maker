'use client';

import { useState, useMemo, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';
import { ChevronDown, ChevronUp, Pencil, RefreshCw, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  processMonoline,
  type MonolineResult,
  type Stroke,
  strokesToSvgPath,
  strokesToSvgElement,
} from '@/lib/image/MonolineProcessor';

interface MonolineDebugViewProps {
  /** Binary mask of a single glyph cell (ink=white, bg=black) */
  cellMask: ImageData | null;
  /** Character being displayed */
  character?: string;
  className?: string;
}

type ViewMode = 'mask' | 'skeleton' | 'raw' | 'strokes' | 'overlay' | 'junctions';

export function MonolineDebugView({
  cellMask,
  character = '?',
  className,
}: MonolineDebugViewProps) {
  const [expanded, setExpanded] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('overlay');
  const [result, setResult] = useState<MonolineResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [showRawInOverlay, setShowRawInOverlay] = useState(false);

  // Tuning parameters
  const [pruneThreshold, setPruneThreshold] = useState<number | null>(null); // null = auto
  const [smoothingIterations, setSmoothingIterations] = useState(2);

  // Process when mask changes or parameters change
  useEffect(() => {
    if (!cellMask) {
      setResult(null);
      return;
    }

    setProcessing(true);

    // Use requestAnimationFrame to avoid blocking UI
    requestAnimationFrame(() => {
      try {
        const monoResult = processMonoline(cellMask, {
          pruneThreshold: pruneThreshold ?? undefined,
          smoothingIterations,
        });
        setResult(monoResult);
      } catch (err) {
        console.error('[MonolineDebugView] Error:', err);
        setResult(null);
      }
      setProcessing(false);
    });
  }, [cellMask, pruneThreshold, smoothingIterations]);

  // Convert ImageData to data URL
  const imageUrls = useMemo(() => {
    const convert = (data: ImageData | null): string | null => {
      if (!data) return null;
      const canvas = document.createElement('canvas');
      canvas.width = data.width;
      canvas.height = data.height;
      const ctx = canvas.getContext('2d')!;
      ctx.putImageData(data, 0, 0);
      return canvas.toDataURL();
    };

    return {
      mask: convert(cellMask),
      skeleton: result ? convert(result.skeleton) : null,
    };
  }, [cellMask, result]);

  // Generate smoothed strokes SVG - use curves for smooth output
  const strokesSvg = useMemo(() => {
    if (!result || !cellMask) return null;

    const { width, height } = cellMask;
    const pathData = strokesToSvgPath(result.smoothedStrokes, true); // true = use quadratic curves

    // Use 100% width/height so SVG scales with container, viewBox handles coordinate mapping
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
        <path d="${pathData}" fill="none" stroke="#d946ef" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `.trim();
  }, [result, cellMask]);

  // Generate RAW strokes SVG (pre-smoothing, pre-pruning) - red color to distinguish
  const rawStrokesSvg = useMemo(() => {
    if (!result || !cellMask) return null;

    const { width, height } = cellMask;
    const pathData = strokesToSvgPath(result.rawStrokes);

    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
        <path d="${pathData}" fill="none" stroke="#dc2626" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `.trim();
  }, [result, cellMask]);

  // Generate junctions overlay SVG (endpoints=red, junctions=yellow)
  const junctionsSvg = useMemo(() => {
    if (!result || !cellMask) return null;

    const { width, height } = cellMask;
    const { endpointPositions, junctionPositions } = result.stats;

    const endpoints = endpointPositions.map(p =>
      `<circle cx="${p.x}" cy="${p.y}" r="3" fill="#ef4444" />`
    ).join('');

    const junctions = junctionPositions.map(p =>
      `<circle cx="${p.x}" cy="${p.y}" r="3" fill="#eab308" />`
    ).join('');

    // Use 100% width/height so SVG scales with container
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
        ${junctions}
        ${endpoints}
      </svg>
    `.trim();
  }, [result, cellMask]);

  const displaySize = 200;

  return (
    <div className={cn('bg-white rounded-lg border border-neutral-200 overflow-hidden', className)}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-neutral-50 border-b border-neutral-200 hover:bg-neutral-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Pencil className="w-4 h-4 text-neutral-500" />
          <span className="font-medium text-neutral-700">
            Monoline Debug: &ldquo;{character}&rdquo;
          </span>
          {processing && <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-neutral-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-neutral-500" />
        )}
      </button>

      {expanded && (
        <div className="p-4">
          {/* View mode selector */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {(['mask', 'skeleton', 'raw', 'strokes', 'overlay', 'junctions'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-md transition-colors',
                  viewMode === mode
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                )}
              >
                {mode === 'raw' ? 'Raw' : mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          {/* Toggle for overlay mode */}
          {viewMode === 'overlay' && (
            <div className="flex items-center gap-2 mb-4">
              <label className="text-xs text-neutral-600">Show in overlay:</label>
              <button
                onClick={() => setShowRawInOverlay(false)}
                className={cn(
                  'px-2 py-1 text-xs rounded',
                  !showRawInOverlay ? 'bg-blue-600 text-white' : 'bg-neutral-100 text-neutral-600'
                )}
              >
                Smoothed
              </button>
              <button
                onClick={() => setShowRawInOverlay(true)}
                className={cn(
                  'px-2 py-1 text-xs rounded',
                  showRawInOverlay ? 'bg-red-600 text-white' : 'bg-neutral-100 text-neutral-600'
                )}
              >
                Raw
              </button>
            </div>
          )}

          {/* Image display */}
          <div className="flex gap-4 mb-4">
            {/* Main view */}
            <div
              className="relative bg-neutral-800 rounded-lg overflow-hidden flex-shrink-0"
              style={{ width: displaySize, height: displaySize }}
            >
              {cellMask ? (
                <>
                  {/* Background: original mask (dimmed in overlay mode) */}
                  {(viewMode === 'mask' || viewMode === 'overlay') && imageUrls.mask && (
                    <img
                      src={imageUrls.mask}
                      alt="Original mask"
                      className={cn(
                        'absolute inset-0 w-full h-full object-contain',
                        viewMode === 'overlay' && 'opacity-30'
                      )}
                    />
                  )}

                  {/* Skeleton */}
                  {(viewMode === 'skeleton' || viewMode === 'overlay') && imageUrls.skeleton && (
                    <img
                      src={imageUrls.skeleton}
                      alt="Skeleton"
                      className={cn(
                        'absolute inset-0 w-full h-full object-contain',
                        viewMode === 'overlay' && 'opacity-50 mix-blend-screen'
                      )}
                      style={viewMode === 'skeleton' ? {} : { filter: 'hue-rotate(180deg)' }}
                    />
                  )}

                  {/* Raw strokes (pre-smoothing) - red */}
                  {viewMode === 'raw' && rawStrokesSvg && (
                    <>
                      {imageUrls.skeleton && (
                        <img
                          src={imageUrls.skeleton}
                          alt="Skeleton"
                          className="absolute inset-0 w-full h-full object-contain opacity-40"
                        />
                      )}
                      <div
                        className="absolute inset-0 w-full h-full"
                        dangerouslySetInnerHTML={{ __html: rawStrokesSvg }}
                      />
                    </>
                  )}

                  {/* Smoothed strokes - blue */}
                  {viewMode === 'strokes' && strokesSvg && (
                    <>
                      {imageUrls.skeleton && (
                        <img
                          src={imageUrls.skeleton}
                          alt="Skeleton"
                          className="absolute inset-0 w-full h-full object-contain opacity-40"
                        />
                      )}
                      <div
                        className="absolute inset-0 w-full h-full"
                        dangerouslySetInnerHTML={{ __html: strokesSvg }}
                      />
                    </>
                  )}

                  {/* Overlay mode - show raw or smoothed based on toggle */}
                  {viewMode === 'overlay' && (
                    <div
                      className="absolute inset-0 w-full h-full"
                      dangerouslySetInnerHTML={{ __html: showRawInOverlay ? (rawStrokesSvg || '') : (strokesSvg || '') }}
                    />
                  )}

                  {/* Junctions view: skeleton + endpoint/junction dots */}
                  {viewMode === 'junctions' && (
                    <>
                      {imageUrls.skeleton && (
                        <img
                          src={imageUrls.skeleton}
                          alt="Skeleton"
                          className="absolute inset-0 w-full h-full object-contain opacity-50"
                        />
                      )}
                      {junctionsSvg && (
                        <div
                          className="absolute inset-0 w-full h-full"
                          dangerouslySetInnerHTML={{ __html: junctionsSvg }}
                        />
                      )}
                    </>
                  )}
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-neutral-400">
                  <span>No mask</span>
                </div>
              )}
            </div>

            {/* Stats panel */}
            {result && (
              <div className="flex-1 text-sm space-y-2">
                <div className="font-medium text-neutral-700">Statistics</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-neutral-600">
                  <div>Mask size:</div>
                  <div className="font-mono">{cellMask?.width}×{cellMask?.height}</div>
                  <div>Skeleton pixels:</div>
                  <div className="font-mono">{result.stats.totalPixels}</div>
                  <div>Endpoints:</div>
                  <div className="font-mono">{result.stats.endpoints}</div>
                  <div>Junctions:</div>
                  <div className="font-mono">{result.stats.junctions}</div>
                  <div>Extracted:</div>
                  <div className="font-mono">{result.rawStrokes.length} ({result.rawStrokes.reduce((s, st) => s + st.points.length, 0)} pts)</div>
                  <div>After pruning:</div>
                  <div className="font-mono">{result.strokes.length} ({result.strokes.reduce((s, st) => s + st.points.length, 0)} pts)</div>
                  <div>Smoothed:</div>
                  <div className="font-mono">{result.smoothedStrokes.length} ({result.smoothedStrokes.reduce((s, st) => s + st.points.length, 0)} pts)</div>
                  <div>Content bbox:</div>
                  <div className="font-mono">
                    {result.stats.boundingBox.width}×{result.stats.boundingBox.height}
                  </div>
                  <div>Bbox origin:</div>
                  <div className="font-mono">
                    ({result.stats.boundingBox.x}, {result.stats.boundingBox.y})
                  </div>
                  {result.rawStrokes.length > 0 && (() => {
                    const rawPts = result.rawStrokes.flatMap(s => s.points);
                    const rawMinX = Math.min(...rawPts.map(p => p.x));
                    const rawMaxX = Math.max(...rawPts.map(p => p.x));
                    const rawMinY = Math.min(...rawPts.map(p => p.y));
                    const rawMaxY = Math.max(...rawPts.map(p => p.y));
                    return (
                      <>
                        <div>Extracted bounds:</div>
                        <div className="font-mono">
                          x:{rawMinX.toFixed(0)}–{rawMaxX.toFixed(0)}, y:{rawMinY.toFixed(0)}–{rawMaxY.toFixed(0)}
                        </div>
                      </>
                    );
                  })()}
                  {result.smoothedStrokes.length > 0 && (() => {
                    const allPts = result.smoothedStrokes.flatMap(s => s.points);
                    const minX = Math.min(...allPts.map(p => p.x));
                    const maxX = Math.max(...allPts.map(p => p.x));
                    const minY = Math.min(...allPts.map(p => p.y));
                    const maxY = Math.max(...allPts.map(p => p.y));
                    return (
                      <>
                        <div>Smoothed bounds:</div>
                        <div className="font-mono">
                          x:{minX.toFixed(0)}–{maxX.toFixed(0)}, y:{minY.toFixed(0)}–{maxY.toFixed(0)}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* Tuning parameters */}
          <div className="space-y-4 border-t border-neutral-200 pt-4">
            <div className="text-sm font-medium text-neutral-700">Parameters</div>

            <div>
              <label className="block text-xs text-neutral-600 mb-1">
                Prune Threshold: {pruneThreshold ?? 'auto'}
              </label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[pruneThreshold ?? 10]}
                  onValueChange={(v) => setPruneThreshold(v[0])}
                  min={2}
                  max={30}
                  step={1}
                  className="flex-1"
                />
                <button
                  onClick={() => setPruneThreshold(null)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Auto
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs text-neutral-600 mb-1">
                Smoothing Iterations: {smoothingIterations}
              </label>
              <Slider
                value={[smoothingIterations]}
                onValueChange={(v) => setSmoothingIterations(v[0])}
                min={0}
                max={3}
                step={1}
              />
            </div>
          </div>

          {/* Export button */}
          {result && cellMask && (
            <div className="border-t border-neutral-200 pt-4 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const svg = strokesToSvgElement(
                    result.smoothedStrokes,
                    cellMask.width,
                    cellMask.height,
                    1
                  );
                  const blob = new Blob([svg], { type: 'image/svg+xml' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${character}-monoline.svg`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="w-full"
              >
                <Download className="w-4 h-4 mr-2" />
                Export Strokes SVG
              </Button>
              <p className="text-xs text-neutral-500 mt-2">
                Exports {result.smoothedStrokes.length} stroke(s), {result.smoothedStrokes.reduce((sum, s) => sum + s.points.length, 0)} points total
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
