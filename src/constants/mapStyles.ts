/**
 * Provider-neutral map styling constants.
 * (Google-Maps-specific configuration lives in src/map/google/mapConfig.ts.)
 */

// Colors for flight path visualization
export const PATH_COLORS = {
  /** Manoeuvre path color (red) */
  manoeuvre: '#ff4444',
  /** Pattern path color (green) */
  pattern: '#00e676',
  /** Pre-wind (ghost) path color — white for visibility on satellite */
  preWind: '#ffffff',
  /** Marker stroke color */
  markerStroke: '#000000'
} as const;

// Text overlay style for altitude labels
export const ALTITUDE_LABEL_STYLE: React.CSSProperties = {
  background: 'black',
  border: '1px solid black',
  padding: '4px 8px',
  borderRadius: '4px',
  fontSize: '14px',
  color: 'white',
  boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
  display: 'inline-block',
  whiteSpace: 'nowrap',
  wordBreak: 'break-word'
};
