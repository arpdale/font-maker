'use client';

import { useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { useFontStore } from '@/stores/fontStore';
import { processTemplatePage, type ProcessingResult } from '@/lib/image/TemplateProcessor';
import { getTemplateCoordinates, DEFAULT_TEMPLATE_CONFIG } from '@/lib/template/TemplateDefinition';
import { ProcessingDebugOverlay } from '@/components/debug/ProcessingDebugOverlay';
import type { PdfPage } from '@/lib/image/PdfParser';
import { ALL_CHARACTERS } from '@/lib/constants/characters';
import {
  Home,
  Upload,
  ArrowRight,
  Download,
  RefreshCw,
  Check,
  AlertCircle,
  FileText,
  ChevronLeft,
  ChevronRight,
  Settings2,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type ProcessingState = 'idle' | 'loading' | 'ready' | 'processing' | 'done' | 'error';
type FileType = 'image' | 'pdf';

export default function UploadPage() {
  const { glyphs, setGlyphPath } = useFontStore();

  // File state
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [pdfPages, setPdfPages] = useState<PdfPage[]>([]);
  const [currentPdfPage, setCurrentPdfPage] = useState(0);
  const [fileType, setFileType] = useState<FileType>('image');

  // Processing state
  const [state, setState] = useState<ProcessingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [processedCount, setProcessedCount] = useState(0);
  const [progressStage, setProgressStage] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);

  // Processing options
  const [subtractThreshold, setSubtractThreshold] = useState(35);
  const [morphCloseSize, setMorphCloseSize] = useState(0);  // Disabled - was filling holes in O, B, P, etc.
  const [morphOpenSize, setMorphOpenSize] = useState(2);
  const [minComponentArea, setMinComponentArea] = useState(80);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Debug state
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);
  const [originalImageData, setOriginalImageData] = useState<ImageData | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Progress calculation
  const completedCount = Object.values(glyphs).filter((g) => g.isComplete).length;
  const totalProgressPercent = Math.round((completedCount / ALL_CHARACTERS.length) * 100);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setState('loading');
    setError(null);
    setPdfPages([]);
    setImage(null);
    setCurrentPdfPage(0);
    setProcessingResult(null);
    setOriginalImageData(null);

    try {
      if (file.type === 'application/pdf') {
        setFileType('pdf');
        const { loadPdf } = await import('@/lib/image/PdfParser');
        const pages = await loadPdf(file, 2); // 2x scale for better quality
        if (pages.length === 0) {
          throw new Error('PDF has no pages');
        }
        setPdfPages(pages);
        setState('ready');
      } else if (file.type.startsWith('image/')) {
        setFileType('image');
        const img = new Image();
        img.onload = () => {
          setImage(img);
          setState('ready');
        };
        img.onerror = () => {
          setError('Failed to load image');
          setState('error');
        };
        img.src = URL.createObjectURL(file);
      } else {
        throw new Error('Unsupported file type. Please upload a PDF or image file.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file');
      setState('error');
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const isValid = file.type === 'application/pdf' || file.type.startsWith('image/');
    if (!isValid) {
      setError('Please upload a PDF or image file');
      setState('error');
      return;
    }

    const input = fileInputRef.current;
    if (input) {
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, []);

  const getCurrentImageData = useCallback((): ImageData | null => {
    if (fileType === 'pdf' && pdfPages.length > 0) {
      return pdfPages[currentPdfPage].imageData;
    } else if (fileType === 'image' && image && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d')!;
      canvas.width = image.width;
      canvas.height = image.height;
      ctx.drawImage(image, 0, 0);
      return ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
    return null;
  }, [fileType, pdfPages, currentPdfPage, image]);

  const processCurrentPage = useCallback(async () => {
    setState('processing');
    setProcessedCount(0);
    setProgressStage('Initializing...');
    setProgressPercent(0);
    setError(null);
    setProcessingResult(null);

    try {
      const imageData = getCurrentImageData();
      if (!imageData) {
        throw new Error('No image data available');
      }

      setOriginalImageData(imageData);

      console.log(`[Upload] Processing page ${currentPdfPage + 1}, image size: ${imageData.width}x${imageData.height}`);

      // Process with new architecture
      const result = await processTemplatePage(imageData, {
        config: {
          ...DEFAULT_TEMPLATE_CONFIG,
          cellsPerRow: 8,
          rowsPerPage: 10,
        },
        characterSet: 'required',
        pageNumber: currentPdfPage,
        subtractThreshold,
        morphologyCloseSize: morphCloseSize,
        morphologyOpenSize: morphOpenSize,
        minComponentArea,
        onProgress: (stage, progress) => {
          setProgressStage(stage);
          setProgressPercent(progress);
        },
      });

      setProcessingResult(result);

      if (!result.success) {
        setError(result.error || 'Processing failed');
        setState('error');
        return;
      }

      // Save glyphs to store (including advanceWidth from template normalization)
      let savedCount = 0;
      for (const glyph of result.glyphs) {
        setGlyphPath(glyph.character.unicode, glyph.opentypePath, glyph.advanceWidth);
        savedCount++;
      }

      setProcessedCount(savedCount);

      if (savedCount > 0) {
        setState('done');
      } else {
        setError('No characters detected. Make sure the template is filled out correctly.');
        setState('error');
      }
    } catch (err) {
      console.error('[Upload] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to process');
      setState('error');
    }
  }, [getCurrentImageData, currentPdfPage, subtractThreshold, morphCloseSize, morphOpenSize, minComponentArea, setGlyphPath]);

  const handleReset = useCallback(() => {
    setImage(null);
    setPdfPages([]);
    setCurrentPdfPage(0);
    setState('idle');
    setError(null);
    setProcessedCount(0);
    setProcessingResult(null);
    setOriginalImageData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const getPreviewUrl = useCallback((): string | null => {
    if (fileType === 'pdf' && pdfPages.length > 0) {
      const page = pdfPages[currentPdfPage];
      const canvas = document.createElement('canvas');
      canvas.width = page.width;
      canvas.height = page.height;
      const ctx = canvas.getContext('2d')!;
      ctx.putImageData(page.imageData, 0, 0);
      return canvas.toDataURL();
    } else if (fileType === 'image' && image) {
      return image.src;
    }
    return null;
  }, [fileType, pdfPages, currentPdfPage, image]);

  const templateCoords = getTemplateCoordinates({
    ...DEFAULT_TEMPLATE_CONFIG,
    cellsPerRow: 8,
    rowsPerPage: 10,
  });

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-neutral-600 hover:text-neutral-900">
                <Home className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="font-semibold text-neutral-900">Upload Template</h1>
                <p className="text-sm text-neutral-500">
                  {completedCount} of {ALL_CHARACTERS.length} characters
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Progress value={totalProgressPercent} className="w-32" />
              <span className="text-sm text-neutral-600">{totalProgressPercent}%</span>
              <Link href="/edit">
                <Button variant="outline">
                  Review All
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Template download */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
          <div className="flex items-start gap-3">
            <Download className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-900">Download Template</h3>
              <p className="text-sm text-blue-700 mb-2">
                Download and print our template (8×10 grid), fill it in with your handwriting,
                then scan or photograph it. Make sure all 4 corner markers are visible.
              </p>
              <Link href="/template">
                <Button variant="outline" size="sm">
                  Download Template PDF
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Upload area */}
        <div className="bg-white rounded-lg border border-neutral-200 p-8">
          {state === 'idle' && (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-neutral-300 rounded-lg p-12 text-center hover:border-neutral-400 transition-colors"
            >
              <Upload className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-neutral-700 mb-2">
                Upload your filled template
              </h3>
              <p className="text-sm text-neutral-500 mb-4">
                Drag and drop a <strong>PDF</strong> or <strong>image</strong>, or click to browse
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/*"
                onChange={handleFileSelect}
                className="hidden"
                id="file-input"
              />
              <Button onClick={() => fileInputRef.current?.click()}>
                Choose File
              </Button>
              <p className="text-xs text-neutral-400 mt-4">
                Supports: PDF, PNG, JPG, JPEG, WebP
              </p>
            </div>
          )}

          {state === 'loading' && (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 text-neutral-400 mx-auto mb-4 animate-spin" />
              <p className="text-neutral-600">Loading file...</p>
            </div>
          )}

          {state === 'error' && (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-neutral-900 mb-2">Error</h3>
              <p className="text-neutral-600 mb-4">{error}</p>
              <Button onClick={handleReset}>Try Again</Button>
            </div>
          )}

          {(state === 'ready' || state === 'processing' || state === 'done') && (
            <div>
              {/* File type badge */}
              <div className="flex items-center gap-2 mb-4">
                {fileType === 'pdf' ? (
                  <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm flex items-center gap-1">
                    <FileText className="w-4 h-4" />
                    PDF ({pdfPages.length} page{pdfPages.length > 1 ? 's' : ''})
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                    Image
                  </span>
                )}
              </div>

              {/* Image preview */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-neutral-900">Preview</h3>
                  <Button variant="ghost" size="sm" onClick={handleReset}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Change File
                  </Button>
                </div>
                <div className="border border-neutral-200 rounded-lg overflow-hidden bg-neutral-100">
                  {getPreviewUrl() && (
                    <img
                      src={getPreviewUrl()!}
                      alt="Uploaded sample"
                      className="max-w-full max-h-[400px] mx-auto"
                    />
                  )}
                </div>

                {/* PDF page navigation */}
                {fileType === 'pdf' && pdfPages.length > 1 && (
                  <div className="flex items-center justify-center gap-4 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPdfPage((p) => Math.max(0, p - 1))}
                      disabled={currentPdfPage === 0}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm text-neutral-600">
                      Page {currentPdfPage + 1} of {pdfPages.length}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPdfPage((p) => Math.min(pdfPages.length - 1, p + 1))}
                      disabled={currentPdfPage >= pdfPages.length - 1}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Hidden processing canvas */}
              <canvas ref={canvasRef} className="hidden" />

              {/* Advanced settings */}
              <div className="mb-6">
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900"
                >
                  <Settings2 className="w-4 h-4" />
                  Advanced Settings
                  {showAdvanced ? <ChevronLeft className="w-4 h-4 rotate-90" /> : <ChevronRight className="w-4 h-4 rotate-90" />}
                </button>

                {showAdvanced && (
                  <div className="mt-4 p-4 bg-neutral-50 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        Subtraction Threshold: {subtractThreshold}
                      </label>
                      <Slider
                        value={[subtractThreshold]}
                        onValueChange={(v) => setSubtractThreshold(v[0])}
                        min={10}
                        max={100}
                        step={5}
                        disabled={state === 'processing'}
                      />
                      <p className="text-xs text-neutral-500 mt-1">
                        Lower values capture lighter strokes, higher values reduce noise.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Process button */}
              <div className="flex flex-col items-center gap-4">
                {state === 'ready' && (
                  <Button onClick={processCurrentPage} size="lg">
                    Process Template Page
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                )}

                {state === 'processing' && (
                  <div className="text-center w-full max-w-md">
                    <div className="flex items-center gap-2 text-neutral-600 mb-2 justify-center">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      {progressStage}
                    </div>
                    <Progress value={progressPercent} className="mb-1" />
                    <p className="text-xs text-neutral-500">{progressPercent.toFixed(0)}%</p>
                  </div>
                )}

                {state === 'done' && (
                  <div className="text-center">
                    <div className="flex items-center gap-2 text-green-600 mb-4">
                      <Check className="w-5 h-5" />
                      Processed {processedCount} character(s)
                    </div>
                    <div className="flex gap-2">
                      {fileType === 'pdf' && currentPdfPage < pdfPages.length - 1 ? (
                        <Button
                          variant="outline"
                          onClick={() => {
                            setCurrentPdfPage((p) => p + 1);
                            setState('ready');
                            setProcessingResult(null);
                          }}
                        >
                          Next Page
                          <ChevronRight className="ml-2 w-4 h-4" />
                        </Button>
                      ) : (
                        <Button variant="outline" onClick={handleReset}>
                          Upload Another
                        </Button>
                      )}
                      <Link href="/edit">
                        <Button>
                          Review Characters
                          <ArrowRight className="ml-2 w-4 h-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Debug overlay */}
        {processingResult && (
          <div className="mt-8">
            <ProcessingDebugOverlay
              originalImage={originalImageData}
              warpedImage={processingResult.debugImages.warped}
              subtractedImage={processingResult.debugImages.subtracted}
              cleanedImage={processingResult.debugImages.cleaned}
              thresholdedImage={processingResult.debugImages.thresholded}
              markers={processingResult.markers}
              templateCoords={templateCoords}
            />
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="font-medium text-neutral-900 mb-4">How it works (new architecture)</h3>
          <ol className="space-y-2 text-sm text-neutral-600 list-decimal list-inside">
            <li>
              <strong>Marker Detection:</strong> Finds the 4 corner registration markers
            </li>
            <li>
              <strong>Perspective Warp:</strong> Aligns the scan to match the template exactly
            </li>
            <li>
              <strong>Template Subtraction:</strong> Removes grid lines, labels, and guide characters
            </li>
            <li>
              <strong>Cleanup:</strong> Removes noise and connects broken strokes
            </li>
            <li>
              <strong>Vectorization:</strong> Converts clean handwriting to font paths
            </li>
          </ol>
        </div>

        {/* Tips */}
        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="font-medium text-amber-900 mb-2">Tips for best results</h3>
          <ul className="text-sm text-amber-800 space-y-1">
            <li>• Use a <strong>dark pen or marker</strong> (black felt-tip works best)</li>
            <li>• Ensure <strong>all 4 corner markers</strong> are visible in the scan</li>
            <li>• Keep the paper <strong>flat</strong> and avoid shadows</li>
            <li>• Scan at <strong>150-300 DPI</strong> for best quality</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
