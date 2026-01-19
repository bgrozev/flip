import {
  CircleF,
  GoogleMap,
  OverlayView,
  PolylineF,
  useJsApiLoader
} from '@react-google-maps/api';
import React from 'react';

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
  const { showPoms, showPomAltitudes, displayWindArrow } = settings;

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: 'INSERT_GOOGLE_API_KEY',
    libraries: GOOGLE_MAPS_LIBRARIES
  });

  // Convert FlightPath to LatLng[] for Google Maps
  const pathALatLngs = pathToLatLngs(pathA);
  const pathBLatLngs = pathToLatLngs(pathB);

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

        {pathALatLngs
          .filter(p => showPoms && p.pom)
          .map((pom, i) => (
            <CircleF
              center={pom}
              options={pom.phase === 'manoeuvre' ? POM_OPTIONS.manoeuvre : POM_OPTIONS.pattern}
              key={i}
            />
          ))}
        {pathBLatLngs
          .filter(p => showPoms && p.pom)
          .map((pom, i) => (
            <CircleF
              center={pom}
              options={pom.phase === 'manoeuvre' ? POM_OPTIONS.manoeuvre : POM_OPTIONS.pattern}
              key={i}
            />
          ))}
        {pathBLatLngs
          .filter(p => showPomAltitudes && p.pom)
          .map((pom, i) => (
            <CustomTextOverlay
              position={pom}
              text={`${Math.round(pom.alt ?? 0)} ft`}
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
