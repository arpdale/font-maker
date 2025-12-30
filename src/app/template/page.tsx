'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { downloadTemplate, getTemplateDataUrl } from '@/lib/template/TemplateGenerator';
import { ALL_CHARACTERS, REQUIRED_CHARACTERS } from '@/lib/constants/characters';
import { Home, Download, FileText, Printer, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type PageSize = 'letter' | 'a4';
type CharacterSet = 'required' | 'all';

export default function TemplatePage() {
  const [pageSize, setPageSize] = useState<PageSize>('letter');
  const [characterSet, setCharacterSet] = useState<CharacterSet>('required');
  const [cellsPerRow, setCellsPerRow] = useState(8);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [includeGuides, setIncludeGuides] = useState(true);
  const [fontName, setFontName] = useState('My Handwriting Font');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const characterCount = characterSet === 'required'
    ? REQUIRED_CHARACTERS.length
    : ALL_CHARACTERS.length;

  const cellsPerPage = cellsPerRow * rowsPerPage;
  const totalPages = Math.ceil(characterCount / cellsPerPage);

  // Generate preview
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const url = getTemplateDataUrl({
          pageSize,
          characterSet,
          cellsPerRow,
          rowsPerPage,
          includeGuides,
          fontName,
        });
        setPreviewUrl(url);
      } catch (error) {
        console.error('Failed to generate preview:', error);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [pageSize, characterSet, cellsPerRow, rowsPerPage, includeGuides, fontName]);

  const handleDownload = useCallback(() => {
    setIsGenerating(true);
    try {
      downloadTemplate(
        {
          pageSize,
          characterSet,
          cellsPerRow,
          rowsPerPage,
          includeGuides,
          fontName,
        },
        `${fontName.replace(/\s+/g, '-').toLowerCase()}-template.pdf`
      );
    } catch (error) {
      console.error('Failed to generate template:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [pageSize, characterSet, cellsPerRow, rowsPerPage, includeGuides, fontName]);

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
                <h1 className="font-semibold text-neutral-900">Download Template</h1>
                <p className="text-sm text-neutral-500">
                  Print this template and fill it with your handwriting
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Link href="/create/upload">
                <Button>
                  Upload Filled Template
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left column - Settings */}
          <div className="space-y-6">
            {/* Font Name */}
            <div className="bg-white rounded-lg border border-neutral-200 p-6">
              <h2 className="font-medium text-neutral-900 mb-4">Font Name</h2>
              <input
                type="text"
                value={fontName}
                onChange={(e) => setFontName(e.target.value)}
                placeholder="My Handwriting Font"
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
              <p className="text-xs text-neutral-500 mt-2">
                This will appear on the template header
              </p>
            </div>

            {/* Page Settings */}
            <div className="bg-white rounded-lg border border-neutral-200 p-6">
              <h2 className="font-medium text-neutral-900 mb-4">Page Settings</h2>

              {/* Page Size */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Page Size
                </label>
                <div className="flex gap-2">
                  {(['letter', 'a4'] as PageSize[]).map((size) => (
                    <button
                      key={size}
                      onClick={() => setPageSize(size)}
                      className={cn(
                        'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors',
                        pageSize === size
                          ? 'bg-neutral-900 text-white'
                          : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                      )}
                    >
                      {size === 'letter' ? 'US Letter' : 'A4'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cells per row */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Cells per Row: {cellsPerRow}
                </label>
                <Slider
                  value={[cellsPerRow]}
                  onValueChange={(v) => setCellsPerRow(v[0])}
                  min={5}
                  max={10}
                  step={1}
                />
              </div>

              {/* Rows per page */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Rows per Page: {rowsPerPage}
                </label>
                <Slider
                  value={[rowsPerPage]}
                  onValueChange={(v) => setRowsPerPage(v[0])}
                  min={5}
                  max={12}
                  step={1}
                />
              </div>
            </div>

            {/* Character Set */}
            <div className="bg-white rounded-lg border border-neutral-200 p-6">
              <h2 className="font-medium text-neutral-900 mb-4">Character Set</h2>
              <div className="space-y-2">
                <button
                  onClick={() => setCharacterSet('required')}
                  className={cn(
                    'w-full p-4 rounded-lg border-2 text-left transition-colors',
                    characterSet === 'required'
                      ? 'border-neutral-900 bg-neutral-50'
                      : 'border-neutral-200 hover:border-neutral-300'
                  )}
                >
                  <div className="font-medium text-neutral-900">Basic Characters</div>
                  <div className="text-sm text-neutral-500">
                    {REQUIRED_CHARACTERS.length} characters - A-Z, a-z, 0-9, punctuation
                  </div>
                </button>
                <button
                  onClick={() => setCharacterSet('all')}
                  className={cn(
                    'w-full p-4 rounded-lg border-2 text-left transition-colors',
                    characterSet === 'all'
                      ? 'border-neutral-900 bg-neutral-50'
                      : 'border-neutral-200 hover:border-neutral-300'
                  )}
                >
                  <div className="font-medium text-neutral-900">Extended Latin</div>
                  <div className="text-sm text-neutral-500">
                    {ALL_CHARACTERS.length} characters - includes accents and symbols
                  </div>
                </button>
              </div>
            </div>

            {/* Options */}
            <div className="bg-white rounded-lg border border-neutral-200 p-6">
              <h2 className="font-medium text-neutral-900 mb-4">Options</h2>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeGuides}
                  onChange={(e) => setIncludeGuides(e.target.checked)}
                  className="w-4 h-4 rounded border-neutral-300"
                />
                <div>
                  <div className="text-sm font-medium text-neutral-700">Include guide lines</div>
                  <div className="text-xs text-neutral-500">
                    Shows baseline, x-height, and descender guides
                  </div>
                </div>
              </label>
            </div>

            {/* Summary & Download */}
            <div className="bg-white rounded-lg border border-neutral-200 p-6">
              <h2 className="font-medium text-neutral-900 mb-4">Summary</h2>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-3 bg-neutral-50 rounded-lg">
                  <div className="text-2xl font-bold text-neutral-900">{characterCount}</div>
                  <div className="text-xs text-neutral-500">Characters</div>
                </div>
                <div className="text-center p-3 bg-neutral-50 rounded-lg">
                  <div className="text-2xl font-bold text-neutral-900">{cellsPerPage}</div>
                  <div className="text-xs text-neutral-500">Per Page</div>
                </div>
                <div className="text-center p-3 bg-neutral-50 rounded-lg">
                  <div className="text-2xl font-bold text-neutral-900">{totalPages}</div>
                  <div className="text-xs text-neutral-500">Pages</div>
                </div>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handleDownload}
                disabled={isGenerating}
              >
                <Download className="w-5 h-5 mr-2" />
                {isGenerating ? 'Generating...' : 'Download PDF Template'}
              </Button>
            </div>
          </div>

          {/* Right column - Preview */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="bg-white rounded-lg border border-neutral-200 p-6">
              <h2 className="font-medium text-neutral-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Preview
              </h2>

              {previewUrl ? (
                <div className="border border-neutral-200 rounded-lg overflow-hidden bg-neutral-100">
                  <iframe
                    src={previewUrl}
                    className="w-full h-[600px]"
                    title="Template Preview"
                  />
                </div>
              ) : (
                <div className="h-[600px] flex items-center justify-center bg-neutral-100 rounded-lg">
                  <p className="text-neutral-500">Generating preview...</p>
                </div>
              )}
            </div>

            {/* Instructions */}
            <div className="mt-6 bg-blue-50 border border-blue-100 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                <Printer className="w-4 h-4" />
                Printing Tips
              </h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Print at 100% scale (no scaling/fit to page)</li>
                <li>• Use a dark pen or fine marker</li>
                <li>• Keep the corner markers visible</li>
                <li>• Write each character within its cell</li>
                <li>• Let ink dry before scanning</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
