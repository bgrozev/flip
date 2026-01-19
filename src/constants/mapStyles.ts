/**
 * Map styling constants for Google Maps components.
 */

// Colors for flight path visualization
export const PATH_COLORS = {
  /** Manoeuvre path color (red) */
  manoeuvre: '#ff0000',
  /** Pattern path color (green) */
  pattern: '#00ff00',
  /** Marker stroke color */
  markerStroke: '#000000'
} as const;

// Map container style
export const MAP_CONTAINER_STYLE = {
  width: '100%',
  height: '100%'
} as const;

// Base options for map elements
const baseOptions = {
  clickable: false,
  draggable: false,
  editable: false,
  visible: true,
  zIndex: 1
} as const;

// Point of Manoeuvre (POM) marker styles
const pomBaseOptions = {
  ...baseOptions,
  strokeOpacity: 1,
  strokeWeight: 1,
  fillOpacity: 1,
  radius: 2
} as const;

export const POM_OPTIONS = {
  manoeuvre: {
    ...pomBaseOptions,
    fillColor: PATH_COLORS.manoeuvre,
    strokeColor: PATH_COLORS.markerStroke
  },
  pattern: {
    ...pomBaseOptions,
    fillColor: PATH_COLORS.pattern,
    strokeColor: PATH_COLORS.markerStroke
  }
} as const;

// Polyline path styles
const pathBaseOptions = {
  ...baseOptions,
  strokeOpacity: 0.8,
  strokeWeight: 2,
  fillOpacity: 0.35
} as const;

/** Solid line style for wind-corrected path */
export const PATH_OPTIONS = {
  ...pathBaseOptions
} as const;

/** Dotted line style for pre-wind path */
export const PATH_OPTIONS_DOTTED = {
  ...pathBaseOptions,
  icons: [
    {
      icon: {
        path: 'M 0,-1 0,1',
        strokeOpacity: 0.7,
        scale: 2
      },
      offset: '0',
      repeat: '12px'
    }
  ],
  strokeOpacity: 0
};

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

// Google Maps configuration
export const GOOGLE_MAPS_LIBRARIES: ('places')[] = ['places'];

export const DEFAULT_MAP_OPTIONS = {
  mapTypeControl: false,
  streetViewControl: false,
  tilt: 0,
  rotateControl: false,
  mapTypeId: 'satellite' as const,
  zoom: 17
} as const;
