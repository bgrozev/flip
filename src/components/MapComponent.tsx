import {
  CircleF,
  GoogleMap,
  OverlayView,
  PolylineF,
  useJsApiLoader
} from '@react-google-maps/api';
import React, { useMemo, useState } from 'react';

import {
  ALTITUDE_LABEL_STYLE,
  DEFAULT_MAP_OPTIONS,
  GOOGLE_MAPS_LIBRARIES,
  MAP_CONTAINER_STYLE,
  PATH_COLORS,
  PATH_OPTIONS,
  PATH_OPTIONS_DOTTED,
  POM_OPTIONS
} from '../constants';
import { useUnits } from '../hooks';
import { LatLng, Settings } from '../types';
import { pathToLatLngs } from '../util/coords';
import { FlightPath } from '../types';

import WindDirectionArrow from './WindDirectionArrow';

interface CustomTextOverlayProps {
  position: LatLng;
  text: string;
}

const CustomTextOverlay = ({ position, text }: CustomTextOverlayProps) => (
  <OverlayView position={position} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
    <div style={ALTITUDE_LABEL_STYLE}>
      {text}
    </div>
  </OverlayView>
);

interface PointData {
  lat: number;
  lng: number;
  alt?: number;
  time?: number;
  phase?: string;
  pom?: number | boolean;
}

interface PointTooltipProps {
  point: PointData;
  manoeuvreInitTime: number;
  formatAltitude: (feet: number) => { value: number; label: string };
  altitudeLabel: string;
}

const TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: 'rgba(0, 0, 0, 0.85)',
  color: 'white',
  padding: '8px 12px',
  borderRadius: '6px',
  fontSize: '12px',
  lineHeight: '1.4',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  transform: 'translate(-50%, -100%)',
  marginTop: '-12px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  minWidth: 'max-content'
};

function PointTooltip({ point, manoeuvreInitTime, formatAltitude, altitudeLabel }: PointTooltipProps) {
  const alt = formatAltitude(point.alt ?? 0);
  const phase = point.phase === 'manoeuvre' ? 'Manoeuvre' : 'Pattern';

  // Time relative to manoeuvre initiation (convert from ms to seconds)
  // manoeuvreInitTime is the lowest time value among manoeuvre points (initiation point)
  // Manoeuvre points: positive (time elapsed since initiation)
  // Pattern points: negative
  const timeSinceInitMs = (point.time ?? 0) - manoeuvreInitTime;
  const timeSinceInitSec = timeSinceInitMs / 1000;
  const displayTime = point.phase === 'pattern' ? -timeSinceInitSec : timeSinceInitSec;
  const timeSign = displayTime >= 0 ? '+' : '';

  return (
    <OverlayView position={point} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
      <div style={TOOLTIP_STYLE}>
        <div><strong>{phase}</strong></div>
        <div>Altitude: {Math.round(alt.value)} {altitudeLabel}</div>
        <div>Time: {timeSign}{displayTime.toFixed(1)}s</div>
        <div style={{ fontSize: '10px', color: '#aaa', marginTop: '4px' }}>
          {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
        </div>
      </div>
    </OverlayView>
  );
}

interface InteractivePointProps {
  point: PointData;
  manoeuvreInitTime: number;
  options: google.maps.CircleOptions;
  showTooltip: boolean;
  formatAltitude: (feet: number) => { value: number; label: string };
  altitudeLabel: string;
}

function InteractivePoint({ point, manoeuvreInitTime, options, showTooltip, formatAltitude, altitudeLabel }: InteractivePointProps) {
  const [hovered, setHovered] = useState(false);

  // Override options to make circle interactive and larger for easier hovering
  const interactiveOptions = {
    ...options,
    clickable: true,
    radius: showTooltip ? 5 : (options.radius ?? 2)
  };

  return (
    <>
      <CircleF
        center={point}
        options={interactiveOptions}
        onMouseOver={() => setHovered(true)}
        onMouseOut={() => setHovered(false)}
      />
      {showTooltip && hovered && (
        <PointTooltip
          point={point}
          manoeuvreInitTime={manoeuvreInitTime}
          formatAltitude={formatAltitude}
          altitudeLabel={altitudeLabel}
        />
      )}
    </>
  );
}

interface MapComponentProps {
  windSpeed: number;
  windDirection: number;
  center: LatLng;
  onClick: (latLng: LatLng) => void;
  pathA: FlightPath;
  pathB: FlightPath;
  settings: Settings;
  waitingForClick: boolean;
}

function MapComponent({
  windSpeed,
  windDirection,
  center,
  onClick,
  pathA,
  pathB,
  settings,
  waitingForClick
}: MapComponentProps) {
  const { showPoms, showPomAltitudes, showPomTooltips, displayWindArrow } = settings;
  const { formatAltitude, altitudeLabel } = useUnits();

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY || 'INSERT_GOOGLE_API_KEY',
    libraries: GOOGLE_MAPS_LIBRARIES
  });

  // Convert FlightPath to LatLng[] for Google Maps (memoized to avoid recalculation)
  const pathALatLngs = useMemo(() => pathToLatLngs(pathA), [pathA]);
  const pathBLatLngs = useMemo(() => pathToLatLngs(pathB), [pathB]);

  // Find the manoeuvre initiation time (the point where manoeuvre begins, which has the LOWEST time among manoeuvre points)
  const manoeuvreInitTime = useMemo(() => {
    const manoeuvrePoints = pathBLatLngs.filter(p => p.phase === 'manoeuvre');
    if (manoeuvrePoints.length === 0) return 0;
    return Math.min(...manoeuvrePoints.map(p => p.time ?? 0));
  }, [pathBLatLngs]);

  return isLoaded ? (
    <>
      <GoogleMap
        mapContainerStyle={MAP_CONTAINER_STYLE}
        center={center}
        onClick={ev => {
          if (ev.latLng) {
            onClick({ lat: ev.latLng.lat(), lng: ev.latLng.lng() });
          }
        }}
        zoom={DEFAULT_MAP_OPTIONS.zoom}
        options={{
          ...DEFAULT_MAP_OPTIONS,
          draggableCursor: waitingForClick ? 'crosshair' : 'grab'
        }}
        onLoad={() => console.log('Map loaded.')}
      >
        <PolylineF
          path={pathALatLngs.filter(p => p.phase === 'manoeuvre')}
          options={{ ...PATH_OPTIONS_DOTTED, strokeColor: PATH_COLORS.manoeuvre }}
        />
        <PolylineF
          path={pathALatLngs.filter(p => p.phase === 'pattern')}
          options={{ ...PATH_OPTIONS_DOTTED, strokeColor: PATH_COLORS.pattern }}
        />
        <PolylineF
          path={pathBLatLngs.filter(p => p.phase === 'manoeuvre')}
          options={{ ...PATH_OPTIONS, strokeColor: PATH_COLORS.manoeuvre }}
        />
        <PolylineF
          path={pathBLatLngs.filter(p => p.phase === 'pattern')}
          options={{ ...PATH_OPTIONS, strokeColor: PATH_COLORS.pattern }}
        />

        {/* Pre-wind path POMs (non-interactive) */}
        {pathALatLngs
          .filter(p => showPoms && p.pom)
          .map((pom, i) => (
            <CircleF
              center={pom}
              options={pom.phase === 'manoeuvre' ? POM_OPTIONS.manoeuvre : POM_OPTIONS.pattern}
              key={i}
            />
          ))}
        {/* Wind-adjusted path - all points are interactive when tooltips enabled */}
        {pathBLatLngs.map((point, i) => (
          <InteractivePoint
            key={i}
            point={point}
            manoeuvreInitTime={manoeuvreInitTime}
            options={{
              ...(point.phase === 'manoeuvre' ? POM_OPTIONS.manoeuvre : POM_OPTIONS.pattern),
              // Only show circle visually for POMs, but all points are hoverable
              fillOpacity: (showPoms && point.pom) ? 1 : 0,
              strokeOpacity: (showPoms && point.pom) ? 1 : 0
            }}
            showTooltip={showPomTooltips}
            formatAltitude={formatAltitude}
            altitudeLabel={altitudeLabel}
          />
        ))}
        {pathBLatLngs
          .filter(p => showPomAltitudes && p.pom)
          .map((pom, i) => (
            <CustomTextOverlay
              position={pom}
              text={`${Math.round(formatAltitude(pom.alt ?? 0).value)} ${altitudeLabel}`}
              key={i}
            />
          ))}
      </GoogleMap>

      {displayWindArrow && (
        <WindDirectionArrow direction={windDirection} speed={windSpeed} />
      )}
    </>
  ) : (
    <>Loading</>
  );
}

export default React.memo(MapComponent);
