'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils/cn';
import { ChevronDown, ChevronUp, Eye, EyeOff, Grid3X3, Crosshair } from 'lucide-react';
import type { MarkerDetectionResult } from '@/lib/image/OpenCVProcessor';
import type { TemplateCoordinates } from '@/lib/template/TemplateDefinition';

interface ProcessingDebugOverlayProps {
  originalImage: ImageData | null;
  warpedImage: ImageData | null;
  subtractedImage: ImageData | null;
  cleanedImage: ImageData | null;
  thresholdedImage: ImageData | null;
  markers: MarkerDetectionResult | null;
  templateCoords: TemplateCoordinates | null;
  className?: string;
}

type ViewMode = 'original' | 'thresholded' | 'warped' | 'subtracted' | 'cleaned';

export function ProcessingDebugOverlay({
  originalImage,
  warpedImage,
  subtractedImage,
  cleanedImage,
  thresholdedImage,
  markers,
  templateCoords,
  className,
}: ProcessingDebugOverlayProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('thresholded');
  const [showGrid, setShowGrid] = useState(true);
  const [showMarkers, setShowMarkers] = useState(true);
  const [expanded, setExpanded] = useState(true);

  // Convert ImageData to data URL for display
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
      original: convert(originalImage),
      thresholded: convert(thresholdedImage),
      warped: convert(warpedImage),
      subtracted: convert(subtractedImage),
      cleaned: convert(cleanedImage),
    };
  }, [originalImage, thresholdedImage, warpedImage, subtractedImage, cleanedImage]);

  const currentImage = imageUrls[viewMode];
  const currentData = {
    original: originalImage,
    thresholded: thresholdedImage,
    warped: warpedImage,
    subtracted: subtractedImage,
    cleaned: cleanedImage,
  }[viewMode];

  // Calculate scale for overlay
  const containerWidth = 600; // Fixed display width
  const scale = currentData ? containerWidth / currentData.width : 1;

  return (
    <div className={cn('bg-white rounded-lg border border-neutral-200 overflow-hidden', className)}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-neutral-50 border-b border-neutral-200 hover:bg-neutral-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-neutral-500" />
          <span className="font-medium text-neutral-700">Processing Debug View</span>
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
            {(['original', 'thresholded', 'warped', 'subtracted', 'cleaned'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                disabled={!imageUrls[mode]}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-md transition-colors',
                  viewMode === mode
                    ? 'bg-neutral-900 text-white'
                    : imageUrls[mode]
                    ? 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                    : 'bg-neutral-50 text-neutral-400 cursor-not-allowed'
                )}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          {/* Overlay toggles */}
          <div className="flex gap-4 mb-4">
            <button
              onClick={() => setShowGrid(!showGrid)}
              className={cn(
                'flex items-center gap-1.5 text-sm',
                showGrid ? 'text-blue-600' : 'text-neutral-400'
              )}
            >
              <Grid3X3 className="w-4 h-4" />
              Grid
            </button>
            <button
              onClick={() => setShowMarkers(!showMarkers)}
              className={cn(
                'flex items-center gap-1.5 text-sm',
                showMarkers ? 'text-green-600' : 'text-neutral-400'
              )}
            >
              <Crosshair className="w-4 h-4" />
              Markers
            </button>
          </div>

          {/* Image display with overlay */}
          <div
            className="relative bg-neutral-100 rounded-lg overflow-hidden"
            style={{ width: containerWidth, height: currentData ? currentData.height * scale : 400 }}
          >
            {currentImage ? (
              <>
                <img
                  src={currentImage}
                  alt={`${viewMode} view`}
                  className="absolute inset-0 w-full h-full object-contain"
                />

                {/* Grid overlay */}
                {showGrid && templateCoords && (viewMode === 'warped' || viewMode === 'subtracted' || viewMode === 'cleaned') && (
                  <svg
                    className="absolute inset-0 pointer-events-none"
                    viewBox={`0 0 ${templateCoords.pageWidth} ${templateCoords.pageHeight}`}
                    style={{ width: '100%', height: '100%' }}
                  >
                    {/* Grid lines */}
                    {Array.from({ length: templateCoords.grid.rowsPerPage + 1 }).map((_, i) => (
                      <line
                        key={`h-${i}`}
                        x1={templateCoords.grid.startX}
                        y1={templateCoords.grid.startY + i * templateCoords.grid.cellHeight}
                        x2={templateCoords.grid.startX + templateCoords.grid.cellsPerRow * templateCoords.grid.cellWidth}
                        y2={templateCoords.grid.startY + i * templateCoords.grid.cellHeight}
                        stroke="#3b82f6"
                        strokeWidth={2}
                        opacity={0.5}
                      />
                    ))}
                    {Array.from({ length: templateCoords.grid.cellsPerRow + 1 }).map((_, i) => (
                      <line
                        key={`v-${i}`}
                        x1={templateCoords.grid.startX + i * templateCoords.grid.cellWidth}
                        y1={templateCoords.grid.startY}
                        x2={templateCoords.grid.startX + i * templateCoords.grid.cellWidth}
                        y2={templateCoords.grid.startY + templateCoords.grid.rowsPerPage * templateCoords.grid.cellHeight}
                        stroke="#3b82f6"
                        strokeWidth={2}
                        opacity={0.5}
                      />
                    ))}
                  </svg>
                )}

                {/* Marker overlay */}
                {showMarkers && markers && (viewMode === 'original' || viewMode === 'warped') && (
                  <svg
                    className="absolute inset-0 pointer-events-none"
                    viewBox={`0 0 ${currentData!.width} ${currentData!.height}`}
                    style={{ width: '100%', height: '100%' }}
                  >
                    {/* Detected markers on original, expected on warped */}
                    {viewMode === 'original' && markers && (
                      <>
                        {markers.topLeft && (
                          <MarkerIndicator x={markers.topLeft.center.x} y={markers.topLeft.center.y} label="TL" />
                        )}
                        {markers.topRight && (
                          <MarkerIndicator x={markers.topRight.center.x} y={markers.topRight.center.y} label="TR" />
                        )}
                        {markers.bottomLeft && (
                          <MarkerIndicator x={markers.bottomLeft.center.x} y={markers.bottomLeft.center.y} label="BL" />
                        )}
                        {markers.bottomRight && (
                          <MarkerIndicator x={markers.bottomRight.center.x} y={markers.bottomRight.center.y} label="BR" />
                        )}
                      </>
                    )}
                    {viewMode === 'warped' && templateCoords && (
                      <>
                        <MarkerIndicator x={templateCoords.markers.topLeft.x} y={templateCoords.markers.topLeft.y} label="TL" expected />
                        <MarkerIndicator x={templateCoords.markers.topRight.x} y={templateCoords.markers.topRight.y} label="TR" expected />
                        <MarkerIndicator x={templateCoords.markers.bottomLeft.x} y={templateCoords.markers.bottomLeft.y} label="BL" expected />
                        <MarkerIndicator x={templateCoords.markers.bottomRight.x} y={templateCoords.markers.bottomRight.y} label="BR" expected />
                      </>
                    )}
                  </svg>
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-neutral-400">
                <span>No image available</span>
              </div>
            )}
          </div>

          {/* Info */}
          {currentData && (
            <div className="mt-2 text-xs text-neutral-500">
              {currentData.width} × {currentData.height} pixels
              {markers && viewMode === 'original' && (
                <span className="ml-4">
                  Markers: {[markers.topLeft, markers.topRight, markers.bottomLeft, markers.bottomRight].filter(Boolean).length}/4 detected
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MarkerIndicator({
  x,
  y,
  label,
  expected = false,
}: {
  x: number;
  y: number;
  label: string;
  expected?: boolean;
}) {
  const color = expected ? '#22c55e' : '#ef4444';
  const size = 20;

  return (
    <g>
      <circle cx={x} cy={y} r={size} fill="none" stroke={color} strokeWidth={3} />
      <line x1={x - size} y1={y} x2={x + size} y2={y} stroke={color} strokeWidth={2} />
      <line x1={x} y1={y - size} x2={x} y2={y + size} stroke={color} strokeWidth={2} />
      <text
        x={x + size + 5}
        y={y + 5}
        fill={color}
        fontSize={14}
        fontWeight="bold"
      >
        {label}
      </text>
    </g>
  );
}
