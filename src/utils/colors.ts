export const CLASS_COLORS = [
  { label: 'Azul Petróleo', value: '#0F4C81' },
  { label: 'Turquesa', value: '#14B8A6' },
  { label: 'Âmbar', value: '#F59E0B' },
  { label: 'Rosa', value: '#DB2777' },
  { label: 'Azul', value: '#2B7FD4' },
  { label: 'Coral', value: '#E25C3B' },
  { label: 'Violeta', value: '#7C3AED' },
  { label: 'Ciano', value: '#0891B2' },
  { label: 'Verde', value: '#15803D' },
  { label: 'Lima', value: '#65A30D' },
  { label: 'Laranja', value: '#EA580C' },
  { label: 'Vermelho', value: '#DC2626' },
  { label: 'Fúcsia', value: '#C026D3' },
  { label: 'Índigo', value: '#4F46E5' },
  { label: 'Celeste', value: '#0284C7' },
  { label: 'Esmeralda', value: '#059669' },
  { label: 'Uva', value: '#9333EA' },
  { label: 'Grafite', value: '#475569' },
  { label: 'Marrom', value: '#92400E' },
  { label: 'Verde Água', value: '#0D9488' },
];

export type ActivityTypeVisual = { label: string; color: string; bg: string; icon: string };

export const ACTIVITY_TYPE_COLORS = [
  '#0F4C81',
  '#14B8A6',
  '#F59E0B',
  '#DB2777',
  '#7C3AED',
  '#0891B2',
  '#15803D',
  '#E25C3B',
];

export const ACTIVITY_TYPE_CONFIG: Record<string, ActivityTypeVisual> = {
  prova:     { label: 'Prova',     color: '#C0392B', bg: '#FDEDEC', icon: 'PR' },
  trabalho:  { label: 'Trabalho',  color: '#0F4C81', bg: '#E6F0F8', icon: 'TR' },
  atividade: { label: 'Atividade', color: '#14B8A6', bg: '#E0F7F4', icon: 'AT' },
  entrega:   { label: 'Entrega',   color: '#15803D', bg: '#DCFCE7', icon: 'EN' },
  aviso:     { label: 'Aviso',     color: '#F59E0B', bg: '#FEF3C7', icon: 'IN' },
};

export const DEFAULT_ACTIVITY_TYPES = Object.entries(ACTIVITY_TYPE_CONFIG).map(([key, config]) => ({
  key,
  ...config,
  is_custom: 0,
}));

export function getActivityTypeVisual(activity: {
  type: string;
  type_label?: string;
  type_color?: string;
  type_bg?: string;
  type_icon?: string;
}): ActivityTypeVisual {
  const fallback = ACTIVITY_TYPE_CONFIG[activity.type];
  if (fallback) return fallback;

  const color = activity.type_color || '#64748B';
  return {
    label: activity.type_label || 'Outro',
    color,
    bg: activity.type_bg || hexToRgba(color, 0.14),
    icon: activity.type_icon || 'OT',
  };
}

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function lightenColor(hex: string): string {
  return hexToRgba(hex, 0.12);
}
