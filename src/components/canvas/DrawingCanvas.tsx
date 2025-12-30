'use client';

import React, { useRef, useCallback, useEffect, useState } from 'react';
import { ReactSketchCanvas, ReactSketchCanvasRef } from 'react-sketch-canvas';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Undo2, Redo2, Trash2, Eraser, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface DrawingCanvasProps {
  width?: number;
  height?: number;
  character?: string;
  onPathChange?: (svgPath: string) => void;
  showGuides?: boolean;
  className?: string;
}

export function DrawingCanvas({
  width = 400,
  height = 400,
  character,
  onPathChange,
  showGuides = true,
  className,
}: DrawingCanvasProps) {
  const canvasRef = useRef<ReactSketchCanvasRef>(null);
  const [strokeWidth, setStrokeWidth] = useState(8);
  const [isErasing, setIsErasing] = useState(false);

  // Guide line positions (as percentages)
  const guides = {
    baseline: 75, // 75% from top
    xHeight: 45, // x-height line
    capHeight: 25, // cap height line
    descender: 90, // descender line
  };

  const handleClear = useCallback(() => {
    canvasRef.current?.clearCanvas();
    onPathChange?.('');
  }, [onPathChange]);

  const handleUndo = useCallback(() => {
    canvasRef.current?.undo();
  }, []);

  const handleRedo = useCallback(() => {
    canvasRef.current?.redo();
  }, []);

  const handleExport = useCallback(async () => {
    if (!canvasRef.current) return;

    try {
      const svg = await canvasRef.current.exportSvg();
      if (!svg) {
        onPathChange?.('');
        return;
      }

      // Parse SVG to extract path data
      const parser = new DOMParser();
      const doc = parser.parseFromString(svg, 'image/svg+xml');
      const pathElements = doc.querySelectorAll('path');

      const combinedPath = Array.from(pathElements)
        .map((p) => p.getAttribute('d') || '')
        .filter((d) => d)
        .join(' ');

      onPathChange?.(combinedPath);
    } catch (error) {
      console.error('Error exporting paths:', error);
    }
  }, [onPathChange]);

  const toggleEraser = useCallback(() => {
    if (isErasing) {
      canvasRef.current?.eraseMode(false);
    } else {
      canvasRef.current?.eraseMode(true);
    }
    setIsErasing(!isErasing);
  }, [isErasing]);

  // Export paths whenever drawing changes
  useEffect(() => {
    const timer = setTimeout(handleExport, 100);
    return () => clearTimeout(timer);
  }, [handleExport]);

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Controls */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleUndo}
            title="Undo"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRedo}
            title="Redo"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleClear}
            title="Clear"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="h-6 w-px bg-neutral-200" />

        <div className="flex items-center gap-2">
          <Button
            variant={isErasing ? 'secondary' : 'outline'}
            size="icon"
            onClick={toggleEraser}
            title={isErasing ? 'Switch to pen' : 'Switch to eraser'}
          >
            {isErasing ? (
              <Eraser className="h-4 w-4" />
            ) : (
              <Pencil className="h-4 w-4" />
            )}
          </Button>
        </div>

        <div className="h-6 w-px bg-neutral-200" />

        <div className="flex items-center gap-2 flex-1 min-w-[150px] max-w-[200px]">
          <span className="text-sm text-neutral-500 whitespace-nowrap">
            Size:
          </span>
          <Slider
            value={[strokeWidth]}
            onValueChange={(value) => setStrokeWidth(value[0])}
            min={2}
            max={24}
            step={1}
          />
          <span className="text-sm text-neutral-600 w-6">{strokeWidth}</span>
        </div>
      </div>

      {/* Canvas container */}
      <div className="relative" style={{ width, height }}>
        {/* Guide lines */}
        {showGuides && (
          <div className="absolute inset-0 pointer-events-none z-10">
            {/* Baseline */}
            <div
              className="absolute left-0 right-0 border-t-2 border-blue-400"
              style={{ top: `${guides.baseline}%` }}
            />
            {/* X-height */}
            <div
              className="absolute left-0 right-0 border-t border-dashed border-green-400"
              style={{ top: `${guides.xHeight}%` }}
            />
            {/* Cap height */}
            <div
              className="absolute left-0 right-0 border-t border-dashed border-purple-400"
              style={{ top: `${guides.capHeight}%` }}
            />
            {/* Descender */}
            <div
              className="absolute left-0 right-0 border-t border-dashed border-red-400"
              style={{ top: `${guides.descender}%` }}
            />

            {/* Guide labels */}
            <div className="absolute right-1 text-[10px] text-blue-500" style={{ top: `${guides.baseline}%`, transform: 'translateY(-50%)' }}>
              baseline
            </div>
            <div className="absolute right-1 text-[10px] text-green-500" style={{ top: `${guides.xHeight}%`, transform: 'translateY(-50%)' }}>
              x-height
            </div>
            <div className="absolute right-1 text-[10px] text-purple-500" style={{ top: `${guides.capHeight}%`, transform: 'translateY(-50%)' }}>
              cap
            </div>
            <div className="absolute right-1 text-[10px] text-red-500" style={{ top: `${guides.descender}%`, transform: 'translateY(-50%)' }}>
              descender
            </div>
          </div>
        )}

        {/* Reference character (watermark) */}
        {character && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
            <span
              className="text-neutral-200 select-none"
              style={{ fontSize: height * 0.6 }}
            >
              {character}
            </span>
          </div>
        )}

        {/* Drawing canvas */}
        <ReactSketchCanvas
          ref={canvasRef}
          width={`${width}px`}
          height={`${height}px`}
          strokeWidth={strokeWidth}
          strokeColor="#000000"
          canvasColor="transparent"
          style={{
            border: '2px solid #e5e5e5',
            borderRadius: '8px',
            background: 'white',
          }}
          onChange={handleExport}
        />
      </div>

      {/* Legend */}
      {showGuides && (
        <div className="flex gap-4 text-xs text-neutral-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-blue-400" /> Baseline
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-green-400 border-dashed" /> x-height
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-purple-400 border-dashed" /> Cap height
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-red-400 border-dashed" /> Descender
          </span>
        </div>
      )}
    </div>
  );
}
