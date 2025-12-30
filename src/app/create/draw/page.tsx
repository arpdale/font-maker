'use client';

import { useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { DrawingCanvas } from '@/components/canvas/DrawingCanvas';
import { GlyphPreview } from '@/components/canvas/GlyphPreview';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useFontStore } from '@/stores/fontStore';
import { svgPathToOpentypePath, calculateAdvanceWidth } from '@/lib/canvas/PathConverter';
import { ALL_CHARACTERS, REQUIRED_CHARACTERS } from '@/lib/constants/characters';
import {
  ChevronLeft,
  ChevronRight,
  Home,
  Check,
  ArrowRight,
  Pencil,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type CharacterCategory = 'all' | 'uppercase' | 'lowercase' | 'numbers' | 'punctuation' | 'accented' | 'symbols';

export default function DrawPage() {
  const { glyphs, setGlyphPath, clearGlyph, currentCharacterIndex, setCurrentCharacterIndex } =
    useFontStore();

  const [category, setCategory] = useState<CharacterCategory>('all');
  const [currentSvgPath, setCurrentSvgPath] = useState('');
  const [viewMode, setViewMode] = useState<'draw' | 'preview'>('draw');

  // Filter characters by category
  const filteredCharacters = useMemo(() => {
    if (category === 'all') return ALL_CHARACTERS;
    const categoryMap: Record<CharacterCategory, string[]> = {
      all: [],
      uppercase: ['uppercase'],
      lowercase: ['lowercase'],
      numbers: ['number'],
      punctuation: ['punctuation'],
      accented: ['accented'],
      symbols: ['symbol'],
    };
    return ALL_CHARACTERS.filter((c) =>
      categoryMap[category].includes(c.category)
    );
  }, [category]);

  const currentChar = filteredCharacters[currentCharacterIndex] || filteredCharacters[0];

  // Progress calculation
  const completedCount = Object.values(glyphs).filter((g) => g.isComplete).length;
  const requiredCompletedCount = REQUIRED_CHARACTERS.filter(
    (c) => glyphs[c.unicode]?.isComplete
  ).length;
  const progressPercent = Math.round((completedCount / ALL_CHARACTERS.length) * 100);

  const handlePathChange = useCallback((svgPath: string) => {
    setCurrentSvgPath(svgPath);
  }, []);

  const handleSave = useCallback(() => {
    if (!currentChar || !currentSvgPath) return;

    const opentypePath = svgPathToOpentypePath(currentSvgPath);
    const advanceWidth = calculateAdvanceWidth(opentypePath);

    setGlyphPath(currentChar.unicode, opentypePath);

    // Auto-advance to next character
    if (currentCharacterIndex < filteredCharacters.length - 1) {
      setCurrentCharacterIndex(currentCharacterIndex + 1);
      setCurrentSvgPath('');
    }
  }, [currentChar, currentSvgPath, currentCharacterIndex, filteredCharacters.length, setGlyphPath, setCurrentCharacterIndex]);

  const handleClear = useCallback(() => {
    if (!currentChar) return;
    clearGlyph(currentChar.unicode);
    setCurrentSvgPath('');
  }, [currentChar, clearGlyph]);

  const handlePrev = useCallback(() => {
    if (currentCharacterIndex > 0) {
      setCurrentCharacterIndex(currentCharacterIndex - 1);
      setCurrentSvgPath('');
    }
  }, [currentCharacterIndex, setCurrentCharacterIndex]);

  const handleNext = useCallback(() => {
    if (currentCharacterIndex < filteredCharacters.length - 1) {
      setCurrentCharacterIndex(currentCharacterIndex + 1);
      setCurrentSvgPath('');
    }
  }, [currentCharacterIndex, filteredCharacters.length, setCurrentCharacterIndex]);

  const isCurrentComplete = currentChar ? glyphs[currentChar.unicode]?.isComplete : false;
  const currentGlyph = currentChar ? glyphs[currentChar.unicode] : null;

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
                <h1 className="font-semibold text-neutral-900">Draw Characters</h1>
                <p className="text-sm text-neutral-500">
                  {completedCount} of {ALL_CHARACTERS.length} characters ({requiredCompletedCount} required done)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Progress value={progressPercent} className="w-32" />
              <span className="text-sm text-neutral-600">{progressPercent}%</span>
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

      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Sidebar - Character list */}
          <div className="w-64 shrink-0">
            <div className="bg-white rounded-lg border border-neutral-200 p-4 sticky top-24">
              <h2 className="font-medium text-neutral-900 mb-3">Categories</h2>
              <div className="flex flex-col gap-1 mb-4">
                {(['all', 'uppercase', 'lowercase', 'numbers', 'punctuation', 'accented', 'symbols'] as CharacterCategory[]).map(
                  (cat) => (
                    <button
                      key={cat}
                      onClick={() => {
                        setCategory(cat);
                        setCurrentCharacterIndex(0);
                      }}
                      className={cn(
                        'text-left px-3 py-2 rounded text-sm transition-colors',
                        category === cat
                          ? 'bg-neutral-900 text-white'
                          : 'hover:bg-neutral-100 text-neutral-700'
                      )}
                    >
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </button>
                  )
                )}
              </div>

              <h2 className="font-medium text-neutral-900 mb-3">Characters</h2>
              <div className="grid grid-cols-6 gap-1 max-h-[400px] overflow-y-auto">
                {filteredCharacters.map((char, index) => {
                  const isComplete = glyphs[char.unicode]?.isComplete;
                  const isCurrent = index === currentCharacterIndex;
                  return (
                    <button
                      key={char.unicode}
                      onClick={() => {
                        setCurrentCharacterIndex(index);
                        setCurrentSvgPath('');
                      }}
                      className={cn(
                        'w-8 h-8 rounded text-sm font-medium flex items-center justify-center transition-all',
                        isCurrent
                          ? 'bg-neutral-900 text-white ring-2 ring-offset-2 ring-neutral-900'
                          : isComplete
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                      )}
                      title={char.name}
                    >
                      {char.character === ' ' ? '␣' : char.character}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Main content - Drawing area */}
          <div className="flex-1">
            <div className="bg-white rounded-lg border border-neutral-200 p-8">
              {/* Character info */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-6xl font-serif">
                      {currentChar?.character === ' ' ? '␣' : currentChar?.character}
                    </span>
                    {isCurrentComplete && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Completed
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-neutral-500 mt-1">
                    {currentChar?.name} (U+{currentChar?.unicode.toString(16).toUpperCase().padStart(4, '0')})
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handlePrev}
                    disabled={currentCharacterIndex === 0}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-neutral-500 w-20 text-center">
                    {currentCharacterIndex + 1} / {filteredCharacters.length}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleNext}
                    disabled={currentCharacterIndex >= filteredCharacters.length - 1}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* View mode toggle */}
              {isCurrentComplete && (
                <div className="flex justify-center mb-4">
                  <div className="inline-flex rounded-lg border border-neutral-200 p-1">
                    <button
                      onClick={() => setViewMode('draw')}
                      className={cn(
                        'px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2',
                        viewMode === 'draw'
                          ? 'bg-neutral-900 text-white'
                          : 'text-neutral-600 hover:text-neutral-900'
                      )}
                    >
                      <Pencil className="w-4 h-4" />
                      Draw
                    </button>
                    <button
                      onClick={() => setViewMode('preview')}
                      className={cn(
                        'px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2',
                        viewMode === 'preview'
                          ? 'bg-neutral-900 text-white'
                          : 'text-neutral-600 hover:text-neutral-900'
                      )}
                    >
                      <Eye className="w-4 h-4" />
                      Preview Saved
                    </button>
                  </div>
                </div>
              )}

              {/* Drawing canvas or Preview */}
              <div className="flex justify-center mb-6">
                {viewMode === 'draw' || !isCurrentComplete ? (
                  <DrawingCanvas
                    width={400}
                    height={400}
                    character={currentChar?.character}
                    onPathChange={handlePathChange}
                    showGuides={true}
                  />
                ) : (
                  <GlyphPreview
                    path={currentGlyph?.path || null}
                    width={400}
                    height={400}
                    showGuides={true}
                    guideCharacter={currentChar?.character}
                  />
                )}
              </div>

              {/* Action buttons */}
              <div className="flex justify-center gap-4">
                <Button variant="outline" onClick={handleClear}>
                  Clear
                </Button>
                {viewMode === 'draw' && (
                  <Button onClick={handleSave} disabled={!currentSvgPath}>
                    Save & Next
                    <ChevronRight className="ml-2 w-4 h-4" />
                  </Button>
                )}
                {viewMode === 'preview' && isCurrentComplete && (
                  <Button variant="outline" onClick={() => setViewMode('draw')}>
                    <Pencil className="mr-2 w-4 h-4" />
                    Redraw
                  </Button>
                )}
              </div>
            </div>

            {/* Tips */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
              <h3 className="font-medium text-blue-900 mb-2">Tips for best results</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Draw characters on the baseline (blue line)</li>
                <li>• Keep lowercase letters within the x-height (green line)</li>
                <li>• Uppercase should reach the cap height (purple line)</li>
                <li>• Letters like p, g, y should extend to the descender (red line)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
