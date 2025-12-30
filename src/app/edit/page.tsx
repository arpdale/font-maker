'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useFontStore } from '@/stores/fontStore';
import { ALL_CHARACTERS, REQUIRED_CHARACTERS } from '@/lib/constants/characters';
import { Home, Pencil, Check, X, ArrowRight, Filter } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type FilterMode = 'all' | 'complete' | 'incomplete' | 'required';

export default function EditPage() {
  const { glyphs, clearGlyph, setCurrentCharacterIndex } = useFontStore();
  const [filter, setFilter] = useState<FilterMode>('all');

  // Progress calculation
  const completedCount = Object.values(glyphs).filter((g) => g.isComplete).length;
  const requiredCompletedCount = REQUIRED_CHARACTERS.filter(
    (c) => glyphs[c.unicode]?.isComplete
  ).length;
  const progressPercent = Math.round((completedCount / ALL_CHARACTERS.length) * 100);

  // Filtered characters
  const filteredCharacters = useMemo(() => {
    switch (filter) {
      case 'complete':
        return ALL_CHARACTERS.filter((c) => glyphs[c.unicode]?.isComplete);
      case 'incomplete':
        return ALL_CHARACTERS.filter((c) => !glyphs[c.unicode]?.isComplete);
      case 'required':
        return REQUIRED_CHARACTERS;
      default:
        return ALL_CHARACTERS;
    }
  }, [filter, glyphs]);

  const handleEditGlyph = (unicode: number) => {
    const index = ALL_CHARACTERS.findIndex((c) => c.unicode === unicode);
    if (index !== -1) {
      setCurrentCharacterIndex(index);
    }
  };

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
                <h1 className="font-semibold text-neutral-900">Review Characters</h1>
                <p className="text-sm text-neutral-500">
                  {completedCount} of {ALL_CHARACTERS.length} characters ({requiredCompletedCount}/{REQUIRED_CHARACTERS.length} required)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Progress value={progressPercent} className="w-32" />
              <span className="text-sm text-neutral-600">{progressPercent}%</span>

              <Link href="/ligatures">
                <Button variant="outline">
                  Ligatures
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
              <Link href="/preview">
                <Button>
                  Preview & Export
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Filter tabs */}
        <div className="bg-white rounded-lg border border-neutral-200 p-4 mb-6">
          <div className="flex items-center gap-4">
            <Filter className="w-4 h-4 text-neutral-500" />
            <div className="flex gap-2">
              {(['all', 'required', 'complete', 'incomplete'] as FilterMode[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    filter === f
                      ? 'bg-neutral-900 text-white'
                      : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                  )}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                  {f === 'all' && ` (${ALL_CHARACTERS.length})`}
                  {f === 'required' && ` (${REQUIRED_CHARACTERS.length})`}
                  {f === 'complete' && ` (${completedCount})`}
                  {f === 'incomplete' && ` (${ALL_CHARACTERS.length - completedCount})`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Glyph grid */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          {filteredCharacters.length === 0 ? (
            <div className="text-center py-12 text-neutral-500">
              No characters match this filter
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-3">
              {filteredCharacters.map((char) => {
                const glyph = glyphs[char.unicode];
                const isComplete = glyph?.isComplete;
                const isRequired = char.required;

                return (
                  <div
                    key={char.unicode}
                    className={cn(
                      'relative group aspect-square rounded-lg border-2 flex flex-col items-center justify-center transition-all',
                      isComplete
                        ? 'border-green-200 bg-green-50'
                        : isRequired
                        ? 'border-amber-200 bg-amber-50'
                        : 'border-neutral-200 bg-white'
                    )}
                  >
                    {/* Status indicator */}
                    <div className="absolute top-1 right-1">
                      {isComplete ? (
                        <Check className="w-3 h-3 text-green-600" />
                      ) : isRequired ? (
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                      ) : null}
                    </div>

                    {/* Character display */}
                    <span className="text-2xl font-serif mb-1">
                      {char.character === ' ' ? '␣' : char.character}
                    </span>
                    <span className="text-[10px] text-neutral-400">
                      {char.name.slice(0, 8)}
                    </span>

                    {/* Hover actions */}
                    <div className="absolute inset-0 bg-black/80 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Link href="/create/draw">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleEditGlyph(char.unicode)}
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                      </Link>
                      {isComplete && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => clearGlyph(char.unicode)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center gap-6 text-sm text-neutral-500">
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 rounded border-2 border-green-200 bg-green-50" />
            Complete
          </span>
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 rounded border-2 border-amber-200 bg-amber-50" />
            Required (incomplete)
          </span>
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 rounded border-2 border-neutral-200 bg-white" />
            Optional (incomplete)
          </span>
        </div>
      </div>
    </div>
  );
}
