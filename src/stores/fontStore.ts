import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Path } from 'opentype.js';
import type { GlyphData, LigatureDefinition, FontSettings, FontMetrics } from '@/types';
import { ALL_CHARACTERS, DEFAULT_METRICS } from '@/lib/constants/characters';

interface FontStore {
  // Font settings
  settings: FontSettings;
  setSettings: (settings: Partial<FontSettings>) => void;

  // Glyphs
  glyphs: Record<number, GlyphData>;
  setGlyph: (unicode: number, data: Partial<GlyphData>) => void;
  setGlyphPath: (unicode: number, path: Path, advanceWidth?: number) => void;
  clearGlyph: (unicode: number) => void;

  // Ligatures
  ligatures: LigatureDefinition[];
  addLigature: (sequence: string) => void;
  removeLigature: (id: string) => void;
  setLigaturePath: (id: string, path: Path) => void;

  // Navigation
  currentCharacterIndex: number;
  setCurrentCharacterIndex: (index: number) => void;

  // Progress
  getCompletionPercentage: () => number;
  getRequiredCompletionPercentage: () => number;

  // Reset
  resetProject: () => void;
}

// Initialize glyphs from character definitions
function initializeGlyphs(): Record<number, GlyphData> {
  const glyphs: Record<number, GlyphData> = {};
  for (const char of ALL_CHARACTERS) {
    glyphs[char.unicode] = {
      unicode: char.unicode,
      name: char.name,
      character: char.character,
      path: null,
      advanceWidth: 500,
      isComplete: false,
    };
  }
  return glyphs;
}

const initialSettings: FontSettings = {
  familyName: 'My Handwriting',
  styleName: 'Regular',
  metrics: DEFAULT_METRICS,
};

export const useFontStore = create<FontStore>()(
  persist(
    (set, get) => ({
      settings: initialSettings,
      glyphs: initializeGlyphs(),
      ligatures: [],
      currentCharacterIndex: 0,

      setSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),

      setGlyph: (unicode, data) =>
        set((state) => ({
          glyphs: {
            ...state.glyphs,
            [unicode]: { ...state.glyphs[unicode], ...data },
          },
        })),

      setGlyphPath: (unicode, path, advanceWidth?) =>
        set((state) => ({
          glyphs: {
            ...state.glyphs,
            [unicode]: {
              ...state.glyphs[unicode],
              path,
              isComplete: true,
              // Use provided advanceWidth or keep existing
              advanceWidth: advanceWidth ?? state.glyphs[unicode]?.advanceWidth ?? 500,
            },
          },
        })),

      clearGlyph: (unicode) =>
        set((state) => ({
          glyphs: {
            ...state.glyphs,
            [unicode]: {
              ...state.glyphs[unicode],
              path: null,
              isComplete: false,
            },
          },
        })),

      addLigature: (sequence) =>
        set((state) => ({
          ligatures: [
            ...state.ligatures,
            {
              id: `lig_${sequence}_${Date.now()}`,
              sequence,
              name: `lig_${sequence}`,
              path: null,
              advanceWidth: 600,
              isComplete: false,
            },
          ],
        })),

      removeLigature: (id) =>
        set((state) => ({
          ligatures: state.ligatures.filter((l) => l.id !== id),
        })),

      setLigaturePath: (id, path) =>
        set((state) => ({
          ligatures: state.ligatures.map((l) =>
            l.id === id ? { ...l, path, isComplete: true } : l
          ),
        })),

      setCurrentCharacterIndex: (index) =>
        set({ currentCharacterIndex: index }),

      getCompletionPercentage: () => {
        const state = get();
        const total = ALL_CHARACTERS.length;
        const completed = Object.values(state.glyphs).filter(
          (g) => g.isComplete
        ).length;
        return Math.round((completed / total) * 100);
      },

      getRequiredCompletionPercentage: () => {
        const state = get();
        const required = ALL_CHARACTERS.filter((c) => c.required);
        const completed = required.filter(
          (c) => state.glyphs[c.unicode]?.isComplete
        ).length;
        return Math.round((completed / required.length) * 100);
      },

      resetProject: () =>
        set({
          settings: initialSettings,
          glyphs: initializeGlyphs(),
          ligatures: [],
          currentCharacterIndex: 0,
        }),
    }),
    {
      name: 'font-storage',
      partialize: (state) => ({
        settings: state.settings,
        // Note: Paths cannot be serialized directly, we'll handle this separately
        currentCharacterIndex: state.currentCharacterIndex,
      }),
    }
  )
);
