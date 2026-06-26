export const C = {
  // ── Bumblebee palette ─────────────────────────────────────
  bg:         '#0A0A0A',          // deep black
  surface:    '#1A1A1A',          // dark charcoal
  surface2:   '#232323',          // charcoal
  surface3:   '#2D2D2D',          // lighter charcoal
  border:     '#333333',          // charcoal border
  text:       '#FFFFFF',          // white
  muted:      '#888888',
  muted2:     '#5C5C5C',
  accent:     '#FFC107',          // bumblebee yellow
  accentDim:  'rgba(255,193,7,0.15)',
  // ── Status colours (unchanged) ────────────────────────────
  green:      '#22c55e',
  greenDim:   'rgba(34,197,94,0.12)',
  red:        '#ef4444',
  redDim:     'rgba(239,68,68,0.12)',
  orange:     '#f97316',
  orangeDim:  'rgba(249,115,22,0.12)',
  blue:       '#3b82f6',
  blueDim:    'rgba(59,130,246,0.12)',
  purple:     '#a855f7',
};

// Good map design: clear visual hierarchy — highway > arterial > local > landscape > base
// Roads must be distinctly lighter than the background so they're always readable.
export const DARK_MAP_STYLE = [
  // ── Base ──────────────────────────────────────────────────
  { elementType: 'geometry',             stylers: [{ color: '#13131f' }] },
  { elementType: 'labels.text.fill',     stylers: [{ color: '#7c7c8a' }] },
  { elementType: 'labels.text.stroke',   stylers: [{ color: '#13131f' }] },
  { elementType: 'labels.icon',          stylers: [{ visibility: 'off' }] },

  // ── Local roads ───────────────────────────────────────────
  { featureType: 'road',                 elementType: 'geometry',       stylers: [{ color: '#272738' }] },
  { featureType: 'road',                 elementType: 'geometry.stroke', stylers: [{ color: '#1e1e2e' }] },
  { featureType: 'road',                 elementType: 'labels.text.fill', stylers: [{ color: '#6e6e82' }] },
  { featureType: 'road',                 elementType: 'labels.text.stroke', stylers: [{ color: '#13131f' }] },

  // ── Arterials ─────────────────────────────────────────────
  { featureType: 'road.arterial',        elementType: 'geometry',        stylers: [{ color: '#2c2c44' }] },
  { featureType: 'road.arterial',        elementType: 'labels.text.fill', stylers: [{ color: '#7878a0' }] },

  // ── Highways — most prominent ─────────────────────────────
  { featureType: 'road.highway',         elementType: 'geometry',        stylers: [{ color: '#36365a' }] },
  { featureType: 'road.highway',         elementType: 'geometry.stroke', stylers: [{ color: '#28283e' }] },
  { featureType: 'road.highway',         elementType: 'labels.text.fill', stylers: [{ color: '#9898b8' }] },

  // ── Water ─────────────────────────────────────────────────
  { featureType: 'water',                elementType: 'geometry',        stylers: [{ color: '#0c0f1e' }] },
  { featureType: 'water',                elementType: 'labels.text.fill', stylers: [{ color: '#2a3a6a' }] },

  // ── Landscape ─────────────────────────────────────────────
  { featureType: 'landscape',            elementType: 'geometry',        stylers: [{ color: '#181828' }] },
  { featureType: 'landscape.natural',    elementType: 'geometry',        stylers: [{ color: '#14161e' }] },

  // ── Remove noise ──────────────────────────────────────────
  { featureType: 'poi',                  stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',              stylers: [{ visibility: 'off' }] },

  // ── Administrative ────────────────────────────────────────
  { featureType: 'administrative',       elementType: 'geometry.stroke', stylers: [{ color: '#2a2a3a' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#606070' }] },
  { featureType: 'administrative.country',  elementType: 'labels',        stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.province', elementType: 'labels',        stylers: [{ visibility: 'off' }] },
];
