// ─────────────────────────────────────────────────────────────
//  Para Po! Design System — "Neon Grid" sci-fi theme
//  Deep-space navy · Electric gold · Glowing borders
// ─────────────────────────────────────────────────────────────

export const C = {
  // ── Background layers ──────────────────────────────────────
  bg:       '#07080F',    // void — deepest layer
  bg2:      '#0C0F1C',    // secondary background
  surface:  '#10141E',    // primary card surface
  surface2: '#161B2A',    // elevated card
  surface3: '#1E2538',    // active / hover / input

  // ── Glass & overlay ────────────────────────────────────────
  glass:     'rgba(16,20,30,0.94)',
  glassWarm: 'rgba(22,18,10,0.94)',
  overlay:   'rgba(7,8,15,0.72)',

  // ── Borders & dividers ────────────────────────────────────
  border:   'rgba(255,255,255,0.08)',
  border2:  'rgba(255,255,255,0.14)',
  divider:  'rgba(255,255,255,0.05)',

  // ── Brand glow ────────────────────────────────────────────
  glow:     'rgba(255,193,7,0.32)',
  glow2:    'rgba(255,193,7,0.15)',

  // ── Text hierarchy ─────────────────────────────────────────
  text:   '#EEF2FF',    // cool-white, not harsh pure white
  text2:  '#94A3B8',    // secondary
  muted:  '#8B9EB7',    // blue-shifted muted (7.5:1 contrast on bg)
  muted2: '#7A90A8',    // hints / decorative — passes WCAG AA on bg

  // ── Brand ─────────────────────────────────────────────────
  accent:     '#FFC107',
  accentDim:  'rgba(255,193,7,0.13)',
  accentGlow: 'rgba(255,193,7,0.28)',

  // ── Status ────────────────────────────────────────────────
  green:     '#10B981',
  greenDim:  'rgba(16,185,129,0.14)',
  red:       '#F43F5E',
  redDim:    'rgba(244,63,94,0.14)',
  orange:    '#F97316',
  orangeDim: 'rgba(249,115,22,0.14)',
  warning:    '#FB923C',             // distinct warm-amber for action warnings
  warningDim: 'rgba(251,146,60,0.14)',
  blue:      '#38BDF8',
  blueDim:   'rgba(56,189,248,0.14)',
  purple:    '#A78BFA',
  purpleDim: 'rgba(167,139,250,0.14)',
};

// ── Pre-built shadow presets ──────────────────────────────────
export const SHADOW = {
  glow: {
    shadowColor: '#FFC107',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.42,
    shadowRadius: 18,
    elevation: 10,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.48,
    shadowRadius: 22,
    elevation: 12,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.32,
    shadowRadius: 8,
    elevation: 4,
  },
};

// ── Border radius tokens ───────────────────────────────────────
export const R = {
  xs:   8,
  sm:   12,
  md:   16,
  lg:   22,
  xl:   28,
  pill: 999,
};

// ── Sci-fi map style ──────────────────────────────────────────
//  Deep-space indigo base · precise road hierarchy
export const DARK_MAP_STYLE = [
  // Base
  { elementType: 'geometry',               stylers: [{ color: '#0A0C18' }] },
  { elementType: 'labels.text.fill',        stylers: [{ color: '#4A566E' }] },
  { elementType: 'labels.text.stroke',      stylers: [{ color: '#0A0C18' }] },
  { elementType: 'labels.icon',             stylers: [{ visibility: 'off' }] },

  // Local roads
  { featureType: 'road',                    elementType: 'geometry',          stylers: [{ color: '#181E34' }] },
  { featureType: 'road',                    elementType: 'geometry.stroke',   stylers: [{ color: '#12162A' }] },
  { featureType: 'road',                    elementType: 'labels.text.fill',  stylers: [{ color: '#485070' }] },
  { featureType: 'road',                    elementType: 'labels.text.stroke',stylers: [{ color: '#0A0C18' }] },

  // Arterials
  { featureType: 'road.arterial',           elementType: 'geometry',          stylers: [{ color: '#1C2440' }] },
  { featureType: 'road.arterial',           elementType: 'labels.text.fill',  stylers: [{ color: '#566080' }] },

  // Highways — most prominent
  { featureType: 'road.highway',            elementType: 'geometry',          stylers: [{ color: '#242C52' }] },
  { featureType: 'road.highway',            elementType: 'geometry.stroke',   stylers: [{ color: '#182044' }] },
  { featureType: 'road.highway',            elementType: 'labels.text.fill',  stylers: [{ color: '#6878A8' }] },

  // Water — deep void blue
  { featureType: 'water',                   elementType: 'geometry',          stylers: [{ color: '#060916' }] },
  { featureType: 'water',                   elementType: 'labels.text.fill',  stylers: [{ color: '#162044' }] },

  // Landscape
  { featureType: 'landscape',               elementType: 'geometry',          stylers: [{ color: '#0D1020' }] },
  { featureType: 'landscape.natural',       elementType: 'geometry',          stylers: [{ color: '#0A0D1C' }] },

  // Remove noise
  { featureType: 'poi',                     stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',                 stylers: [{ visibility: 'off' }] },

  // Administrative
  { featureType: 'administrative',          elementType: 'geometry.stroke',   stylers: [{ color: '#1C2248' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill',  stylers: [{ color: '#404868' }] },
  { featureType: 'administrative.country',  elementType: 'labels',            stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.province', elementType: 'labels',            stylers: [{ visibility: 'off' }] },
];
