'use client';

import React, { useMemo } from 'react';
import type { Path } from 'opentype.js';
import { cn } from '@/lib/utils/cn';

interface GlyphPreviewProps {
  path: Path | null;
  width?: number;
  height?: number;
  showGuides?: boolean;
  className?: string;
  guideCharacter?: string;
}

/**
 * Renders an opentype.js Path as SVG
 */
export function GlyphPreview({
  path,
  width = 400,
  height = 400,
  showGuides = true,
  className,
  guideCharacter,
}: GlyphPreviewProps) {
  // Convert opentype.js path to SVG path string
  const svgPathData = useMemo(() => {
    if (!path) return '';

    try {
      // opentype.js Path has a toPathData() method
      if (typeof path.toPathData === 'function') {
        return path.toPathData(2);
      }

      // Fallback: manually construct path data from commands
      if (path.commands && Array.isArray(path.commands)) {
        return path.commands
          .map((cmd: { type: string; x?: number; y?: number; x1?: number; y1?: number; x2?: number; y2?: number }) => {
            switch (cmd.type) {
              case 'M':
                return `M ${cmd.x} ${cmd.y}`;
              case 'L':
                return `L ${cmd.x} ${cmd.y}`;
              case 'C':
                return `C ${cmd.x1} ${cmd.y1} ${cmd.x2} ${cmd.y2} ${cmd.x} ${cmd.y}`;
              case 'Q':
                return `Q ${cmd.x1} ${cmd.y1} ${cmd.x} ${cmd.y}`;
              case 'Z':
                return 'Z';
              default:
                return '';
            }
          })
          .join(' ');
      }

      return '';
    } catch (err) {
      console.error('[GlyphPreview] Error converting path:', err);
      return '';
    }
  }, [path]);

  // Calculate bounding box for proper scaling
  const viewBox = useMemo(() => {
    if (!path || !path.getBoundingBox) {
      // Default viewBox for 1000 unitsPerEm font
      return { x: 0, y: -800, width: 1000, height: 1000 };
    }

    try {
      const bbox = path.getBoundingBox();
      const padding = 50;
      return {
        x: bbox.x1 - padding,
        y: bbox.y1 - padding,
        width: bbox.x2 - bbox.x1 + padding * 2,
        height: bbox.y2 - bbox.y1 + padding * 2,
      };
    } catch {
      return { x: 0, y: -800, width: 1000, height: 1000 };
    }
  }, [path]);

  // Guide line positions (in font units, assuming 1000 unitsPerEm)
  const guides = {
    baseline: 0,
    xHeight: 500,
    capHeight: 700,
    descender: -200,
    ascender: 800,
  };

  return (
    <div
      className={cn('relative bg-white border-2 border-neutral-200 rounded-lg overflow-hidden', className)}
      style={{ width, height }}
    >
      {/* Guide character (watermark) */}
      {guideCharacter && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
          <span
            className="text-neutral-200 select-none"
            style={{ fontSize: height * 0.6 }}
          >
            {guideCharacter}
          </span>
        </div>
      )}

      {/* SVG rendering */}
      <svg
        width={width}
        height={height}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        className="absolute inset-0"
        style={{ transform: 'scaleY(-1)' }} // Flip Y axis (font coordinates are Y-up)
      >
        {/* Guide lines */}
        {showGuides && (
          <g className="guides" opacity={0.5}>
            {/* Baseline */}
            <line
              x1={viewBox.x}
              y1={guides.baseline}
              x2={viewBox.x + viewBox.width}
              y2={guides.baseline}
              stroke="#3b82f6"
              strokeWidth={2}
            />
            {/* x-height */}
            <line
              x1={viewBox.x}
              y1={guides.xHeight}
              x2={viewBox.x + viewBox.width}
              y2={guides.xHeight}
              stroke="#22c55e"
              strokeWidth={1}
              strokeDasharray="5,5"
            />
            {/* Cap height */}
            <line
              x1={viewBox.x}
              y1={guides.capHeight}
              x2={viewBox.x + viewBox.width}
              y2={guides.capHeight}
              stroke="#a855f7"
              strokeWidth={1}
              strokeDasharray="5,5"
            />
            {/* Descender */}
            <line
              x1={viewBox.x}
              y1={guides.descender}
              x2={viewBox.x + viewBox.width}
              y2={guides.descender}
              stroke="#ef4444"
              strokeWidth={1}
              strokeDasharray="5,5"
            />
          </g>
        )}

        {/* Glyph path */}
        {svgPathData && (
          <path
            d={svgPathData}
            fill="black"
            fillRule="nonzero"
            stroke="none"
          />
        )}
      </svg>

      {/* No path indicator */}
      {!svgPathData && (
        <div className="absolute inset-0 flex items-center justify-center text-neutral-400">
          <span className="text-sm">No glyph data</span>
        </div>
      )}

      {/* Guide labels */}
      {showGuides && (
        <div className="absolute right-1 top-0 bottom-0 flex flex-col justify-between py-2 pointer-events-none text-[10px]">
          <span className="text-purple-500">cap</span>
          <span className="text-green-500">x-height</span>
          <span className="text-blue-500">baseline</span>
          <span className="text-red-500">descender</span>
        </div>
      )}
    </div>
  );
}
