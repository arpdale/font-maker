import type { Path } from 'opentype.js';

export interface GlyphData {
  unicode: number;
  name: string;
  character: string;
  path: Path | null;
  advanceWidth: number;
  isComplete: boolean;
}

export interface LigatureDefinition {
  id: string;
  sequence: string;
  name: string;
  path: Path | null;
  advanceWidth: number;
  isComplete: boolean;
}

export interface FontMetrics {
  unitsPerEm: number;
  ascender: number;
  descender: number;
  capHeight: number;
  xHeight: number;
}

export interface FontSettings {
  familyName: string;
  styleName: string;
  metrics: FontMetrics;
}

export interface CharacterDefinition {
  unicode: number;
  name: string;
  character: string;
  category: 'uppercase' | 'lowercase' | 'number' | 'punctuation' | 'accented' | 'symbol';
  required: boolean;
}

export interface CanvasStroke {
  points: Array<{ x: number; y: number; pressure?: number }>;
}

export interface ProjectData {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  settings: FontSettings;
  glyphs: Map<number, GlyphData>;
  ligatures: LigatureDefinition[];
}

export type InputMethod = 'draw' | 'upload';

export type ExportFormat = 'otf' | 'ttf' | 'both';
