export type PillId = 'effects' | 'style' | 'playback' | 'display' | 'export';
export type ScopeLevel = 'cell' | 'layer' | 'hand' | 'tip';
export type EditorMode = 'simple' | 'advanced';

export interface PillConfig {
  id: PillId;
  label: string;
  icon: string;
  scopes: ScopeLevel[];
}

export const PILL_CONFIGS: PillConfig[] = [
  { id: 'effects', label: 'Effects', icon: 'fa-wand-magic-sparkles', scopes: ['cell', 'layer', 'hand', 'tip'] },
  { id: 'style', label: 'Style', icon: 'fa-palette', scopes: ['cell', 'layer', 'hand'] },
  { id: 'playback', label: 'Playback', icon: 'fa-play', scopes: ['cell', 'layer'] },
  { id: 'display', label: 'Display', icon: 'fa-eye', scopes: [] },
  { id: 'export', label: 'Export', icon: 'fa-sliders', scopes: [] },
];
