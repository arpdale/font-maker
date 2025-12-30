'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useFontStore } from '@/stores/fontStore';
import { buildFont, downloadFont } from '@/lib/font/FontBuilder';
import { ALL_CHARACTERS, REQUIRED_CHARACTERS } from '@/lib/constants/characters';
import {
  Home,
  Download,
  ArrowLeft,
  Type,
  Settings,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type ExportFormat = 'otf' | 'ttf';

export default function PreviewPage() {
  const { settings, setSettings, glyphs, ligatures } = useFontStore();
  const [sampleText, setSampleText] = useState(
    'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z\na b c d e f g h i j k l m n o p q r s t u v w x y z\n0 1 2 3 4 5 6 7 8 9 ! @ # $ % ^ & * ( )'
  );
  const [fontSize, setFontSize] = useState(48);
  const [showSettings, setShowSettings] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [fontDataUrl, setFontDataUrl] = useState<string | null>(null);

  // Progress calculation
  const completedCount = Object.values(glyphs).filter((g) => g.isComplete).length;
  const requiredCompletedCount = REQUIRED_CHARACTERS.filter(
    (c) => glyphs[c.unicode]?.isComplete
  ).length;
  const requiredTotal = REQUIRED_CHARACTERS.length;
  const canExport = requiredCompletedCount >= Math.floor(requiredTotal * 0.5); // At least 50% of required

  // Build font preview
  const font = useMemo(() => {
    try {
      return buildFont(settings, glyphs, ligatures);
    } catch (error) {
      console.error('Failed to build font:', error);
      return null;
    }
  }, [settings, glyphs, ligatures]);

  // Generate font data URL for CSS @font-face
  useEffect(() => {
    if (!font) {
      setFontDataUrl(null);
      return;
    }

    try {
      const arrayBuffer = font.toArrayBuffer();
      const blob = new Blob([arrayBuffer], { type: 'font/opentype' });
      const url = URL.createObjectURL(blob);
      setFontDataUrl(url);

      return () => URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to generate font URL:', error);
      setFontDataUrl(null);
    }
  }, [font]);

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (!font) return;

      setIsExporting(true);
      try {
        downloadFont(font, settings.familyName.replace(/\s+/g, '-'), format);
      } catch (error) {
        console.error('Export failed:', error);
      } finally {
        setIsExporting(false);
      }
    },
    [font, settings.familyName]
  );

  const handleExportBoth = useCallback(async () => {
    await handleExport('otf');
    setTimeout(() => handleExport('ttf'), 500);
  }, [handleExport]);

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Custom font style */}
      {fontDataUrl && (
        <style>{`
          @font-face {
            font-family: 'PreviewFont';
            src: url('${fontDataUrl}') format('opentype');
          }
        `}</style>
      )}

      {/* Header */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-neutral-600 hover:text-neutral-900">
                <Home className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="font-semibold text-neutral-900">Preview & Export</h1>
                <p className="text-sm text-neutral-500">
                  {completedCount} characters, {ligatures.filter((l) => l.isComplete).length} ligatures
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Link href="/ligatures">
                <Button variant="outline">
                  <ArrowLeft className="mr-2 w-4 h-4" />
                  Back to Ligatures
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left column - Preview */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg border border-neutral-200 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-medium text-neutral-900 flex items-center gap-2">
                  <Type className="w-5 h-5" />
                  Font Preview
                </h2>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-neutral-500">Size:</span>
                  <Slider
                    value={[fontSize]}
                    onValueChange={(v) => setFontSize(v[0])}
                    min={12}
                    max={200}
                    step={2}
                    className="w-32"
                  />
                  <span className="text-sm text-neutral-600 w-8">{fontSize}px</span>
                </div>
              </div>

              {/* Preview area */}
              <div
                className="min-h-[300px] p-6 bg-neutral-50 rounded-lg border border-neutral-200"
                style={{
                  fontFamily: fontDataUrl ? 'PreviewFont, serif' : 'serif',
                  fontSize: `${fontSize}px`,
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {sampleText || 'Type something to preview...'}
              </div>

              {/* Sample text input */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Sample Text
                </label>
                <textarea
                  value={sampleText}
                  onChange={(e) => setSampleText(e.target.value)}
                  className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none"
                  rows={4}
                  placeholder="Type text to preview your font..."
                />
              </div>
            </div>

            {/* Missing characters warning */}
            {requiredCompletedCount < requiredTotal && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-amber-900">Missing Characters</h3>
                    <p className="text-sm text-amber-700">
                      {requiredTotal - requiredCompletedCount} required characters are missing.
                      Your font may not display all text correctly.
                    </p>
                    <Link href="/edit" className="text-sm text-amber-900 underline mt-1 inline-block">
                      Complete missing characters
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right column - Settings & Export */}
          <div>
            {/* Font Settings */}
            <div className="bg-white rounded-lg border border-neutral-200 p-6 mb-6">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="flex items-center justify-between w-full text-left"
              >
                <h2 className="font-medium text-neutral-900 flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Font Settings
                </h2>
                <span className="text-neutral-400">{showSettings ? '−' : '+'}</span>
              </button>

              {showSettings && (
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Font Family Name
                    </label>
                    <input
                      type="text"
                      value={settings.familyName}
                      onChange={(e) => setSettings({ familyName: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Style Name
                    </label>
                    <input
                      type="text"
                      value={settings.styleName}
                      onChange={(e) => setSettings({ styleName: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    />
                  </div>

                  <div className="pt-2 border-t border-neutral-200">
                    <h3 className="text-sm font-medium text-neutral-700 mb-2">Metrics</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-neutral-500">Units/Em:</span>
                        <span className="ml-2">{settings.metrics.unitsPerEm}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500">Ascender:</span>
                        <span className="ml-2">{settings.metrics.ascender}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500">Descender:</span>
                        <span className="ml-2">{settings.metrics.descender}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500">Cap Height:</span>
                        <span className="ml-2">{settings.metrics.capHeight}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Export */}
            <div className="bg-white rounded-lg border border-neutral-200 p-6">
              <h2 className="font-medium text-neutral-900 flex items-center gap-2 mb-4">
                <Download className="w-5 h-5" />
                Export Font
              </h2>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-neutral-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-neutral-900">{completedCount}</div>
                  <div className="text-xs text-neutral-500">Characters</div>
                </div>
                <div className="bg-neutral-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-neutral-900">
                    {ligatures.filter((l) => l.isComplete).length}
                  </div>
                  <div className="text-xs text-neutral-500">Ligatures</div>
                </div>
              </div>

              {/* Export buttons */}
              <div className="space-y-3">
                <Button
                  className="w-full"
                  onClick={() => handleExport('otf')}
                  disabled={!canExport || isExporting}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download OTF
                </Button>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => handleExport('ttf')}
                  disabled={!canExport || isExporting}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download TTF
                </Button>
                <Button
                  className="w-full"
                  variant="secondary"
                  onClick={handleExportBoth}
                  disabled={!canExport || isExporting}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Both
                </Button>
              </div>

              {!canExport && (
                <p className="text-xs text-neutral-500 mt-3 text-center">
                  Complete at least 50% of required characters to export.
                </p>
              )}

              {/* Success indicator */}
              {canExport && (
                <div className="mt-4 p-3 bg-green-50 rounded-lg flex items-center gap-2 text-green-700 text-sm">
                  <Check className="w-4 h-4" />
                  Ready to export!
                </div>
              )}
            </div>

            {/* Installation guide */}
            <div className="mt-6 bg-blue-50 border border-blue-100 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">Installing your font</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>
                  <strong>Mac:</strong> Double-click the font file and click &quot;Install Font&quot;
                </li>
                <li>
                  <strong>Windows:</strong> Right-click and select &quot;Install&quot;
                </li>
                <li>
                  <strong>Web:</strong> Use @font-face in your CSS
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
