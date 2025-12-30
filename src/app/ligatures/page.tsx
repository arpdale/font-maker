'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { DrawingCanvas } from '@/components/canvas/DrawingCanvas';
import { Button } from '@/components/ui/button';
import { useFontStore } from '@/stores/fontStore';
import { svgPathToOpentypePath, calculateAdvanceWidth } from '@/lib/canvas/PathConverter';
import { COMMON_LIGATURES } from '@/lib/constants/characters';
import { Home, Plus, Trash2, Check, ArrowRight, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export default function LigaturesPage() {
  const { ligatures, addLigature, removeLigature, setLigaturePath } = useFontStore();
  const [customSequence, setCustomSequence] = useState('');
  const [selectedLigature, setSelectedLigature] = useState<string | null>(null);
  const [currentSvgPath, setCurrentSvgPath] = useState('');

  const handleAddCommonLigature = useCallback(
    (sequence: string) => {
      if (!ligatures.some((l) => l.sequence === sequence)) {
        addLigature(sequence);
      }
    },
    [ligatures, addLigature]
  );

  const handleAddCustomLigature = useCallback(() => {
    if (customSequence.length >= 2 && !ligatures.some((l) => l.sequence === customSequence)) {
      addLigature(customSequence);
      setCustomSequence('');
    }
  }, [customSequence, ligatures, addLigature]);

  const handleSaveLigature = useCallback(() => {
    if (!selectedLigature || !currentSvgPath) return;

    const opentypePath = svgPathToOpentypePath(currentSvgPath);
    setLigaturePath(selectedLigature, opentypePath);
    setSelectedLigature(null);
    setCurrentSvgPath('');
  }, [selectedLigature, currentSvgPath, setLigaturePath]);

  const selectedLigatureData = ligatures.find((l) => l.id === selectedLigature);

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
                <h1 className="font-semibold text-neutral-900">Ligatures</h1>
                <p className="text-sm text-neutral-500">
                  {ligatures.filter((l) => l.isComplete).length} of {ligatures.length} ligatures defined
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Link href="/edit">
                <Button variant="outline">
                  <ArrowLeft className="mr-2 w-4 h-4" />
                  Back to Characters
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
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left column - Ligature list */}
          <div>
            {/* Common ligatures */}
            <div className="bg-white rounded-lg border border-neutral-200 p-6 mb-6">
              <h2 className="font-medium text-neutral-900 mb-4">Common Ligatures</h2>
              <div className="flex flex-wrap gap-2">
                {COMMON_LIGATURES.map((lig) => {
                  const isAdded = ligatures.some((l) => l.sequence === lig.sequence);
                  return (
                    <button
                      key={lig.sequence}
                      onClick={() => handleAddCommonLigature(lig.sequence)}
                      disabled={isAdded}
                      className={cn(
                        'px-4 py-2 rounded-lg text-lg font-serif transition-colors',
                        isAdded
                          ? 'bg-green-100 text-green-700 cursor-default'
                          : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                      )}
                    >
                      {lig.sequence}
                      {isAdded && <Check className="w-4 h-4 inline ml-2" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom ligature */}
            <div className="bg-white rounded-lg border border-neutral-200 p-6 mb-6">
              <h2 className="font-medium text-neutral-900 mb-4">Add Custom Ligature</h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customSequence}
                  onChange={(e) => setCustomSequence(e.target.value)}
                  placeholder="e.g., st, ct, Th"
                  className="flex-1 px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  maxLength={4}
                />
                <Button
                  onClick={handleAddCustomLigature}
                  disabled={customSequence.length < 2}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add
                </Button>
              </div>
              <p className="text-xs text-neutral-500 mt-2">
                Enter 2-4 characters that should be combined into a single ligature glyph.
              </p>
            </div>

            {/* Ligature list */}
            <div className="bg-white rounded-lg border border-neutral-200 p-6">
              <h2 className="font-medium text-neutral-900 mb-4">Your Ligatures</h2>
              {ligatures.length === 0 ? (
                <p className="text-neutral-500 text-center py-8">
                  No ligatures added yet. Add common ligatures above or create custom ones.
                </p>
              ) : (
                <div className="space-y-2">
                  {ligatures.map((lig) => (
                    <div
                      key={lig.id}
                      className={cn(
                        'flex items-center justify-between p-3 rounded-lg border transition-colors',
                        selectedLigature === lig.id
                          ? 'border-neutral-900 bg-neutral-50'
                          : 'border-neutral-200 hover:border-neutral-300'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-serif w-16">{lig.sequence}</span>
                        {lig.isComplete ? (
                          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            Done
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full">
                            Needs drawing
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedLigature(lig.id);
                            setCurrentSvgPath('');
                          }}
                        >
                          {lig.isComplete ? 'Edit' : 'Draw'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLigature(lig.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right column - Drawing area */}
          <div>
            {selectedLigature && selectedLigatureData ? (
              <div className="bg-white rounded-lg border border-neutral-200 p-6 sticky top-24">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-medium text-neutral-900">
                      Draw Ligature: {selectedLigatureData.sequence}
                    </h2>
                    <p className="text-sm text-neutral-500">
                      Draw how these characters should look when combined
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedLigature(null)}
                  >
                    Cancel
                  </Button>
                </div>

                <div className="flex justify-center mb-6">
                  <DrawingCanvas
                    width={400}
                    height={400}
                    character={selectedLigatureData.sequence}
                    onPathChange={setCurrentSvgPath}
                    showGuides={true}
                  />
                </div>

                <div className="flex justify-center">
                  <Button onClick={handleSaveLigature} disabled={!currentSvgPath}>
                    Save Ligature
                    <Check className="ml-2 w-4 h-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-neutral-200 p-12 text-center sticky top-24">
                <div className="text-neutral-400 mb-4">
                  <svg
                    className="w-16 h-16 mx-auto"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
                    <text
                      x="8"
                      y="15"
                      fontSize="8"
                      fontWeight="bold"
                      stroke="none"
                      fill="currentColor"
                    >
                      fi
                    </text>
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-neutral-700 mb-2">
                  Select a Ligature to Draw
                </h3>
                <p className="text-sm text-neutral-500">
                  Add ligatures from the list on the left, then click &quot;Draw&quot; to create
                  the combined glyph.
                </p>
              </div>
            )}

            {/* Info box */}
            <div className="mt-6 bg-blue-50 border border-blue-100 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">What are ligatures?</h3>
              <p className="text-sm text-blue-800">
                Ligatures are special characters that replace sequences of letters.
                For example, in many fonts, &quot;fi&quot; is replaced with a single glyph where
                the dot of the &quot;i&quot; is merged with the &quot;f&quot; for better visual flow.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
