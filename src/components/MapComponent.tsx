import {
  CircleF,
  GoogleMap,
  OverlayView,
  PolylineF,
  useJsApiLoader
} from '@react-google-maps/api';
import React from 'react';

import { LatLng, Settings } from '../types';
import { pathToLatLngs } from '../util/coords';
import { FlightPath } from '../types';

import WindDirectionArrow from './WindDirectionArrow';

const containerStyle = {
  width: '100%',
  height: '100%'
};

const colorA = '#ff0000';
const colorB = '#00ff00';

const options = {
  clickable: false,
  draggable: false,
  editable: false,
  visible: true,
  zIndex: 1
};

const pomOptions = {
  ...options,
  strokeOpacity: 1,
  strokeWeight: 1,
  fillOpacity: 1,
  radius: 2
};

const pomOptionsA = {
  ...pomOptions,
  fillColor: colorA,
  strokeColor: '#000000'
};

const pomOptionsB = {
  ...pomOptions,
  fillColor: colorB,
  strokeColor: '#000000'
};

const pathOptions = {
  ...options,
  strokeOpacity: 0.8,
  strokeWeight: 2,
  fillOpacity: 0.35
};

const pathOptionsDotted = {
  ...pathOptions,
  icons: [
    {
      icon: {
        path: 'M 0,-1 0,1', // Short line segment
        strokeOpacity: 0.7,
        scale: 2
      },
      offset: '0',
      repeat: '12px' // Space between dashes (adjust for density)
    }
  ],
  strokeOpacity: 0 // Hide the normal stroke so only dashes show
};

interface CustomTextOverlayProps {
  position: LatLng;
  text: string;
}

const CustomTextOverlay = ({ position, text }: CustomTextOverlayProps) => (
  <OverlayView position={position} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
    <div
      style={{
        background: 'black',
        border: '1px solid black',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '14px',
        color: 'white',
        boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
        display: 'inline-block', // Make the container fit to the text width
        whiteSpace: 'nowrap', // Prevent text wrapping
        wordBreak: 'break-word' // Break long words to avoid overflow
      }}
    >
      {text}
    </div>
  </OverlayView>
);

const libraries: ('places')[] = ['places'];

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
    googleMapsApiKey: 'AIzaSyCrb0-7563UDAlMUwLZ14OX6ZlWlwTgCP8',
    libraries
  });

  // Convert FlightPath to LatLng[] for Google Maps
  const pathALatLngs = pathToLatLngs(pathA);
  const pathBLatLngs = pathToLatLngs(pathB);

  return isLoaded ? (
    <>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        onClick={ev => {
          if (ev.latLng) {
            onClick({ lat: ev.latLng.lat(), lng: ev.latLng.lng() });
          }
        }}
        zoom={17}
        options={{
          draggableCursor: waitingForClick ? 'crosshair' : 'grab',
          mapTypeControl: false,
          streetViewControl: false,
          tilt: 0,
          rotateControl: false,
          mapTypeId: 'satellite'
        }}
        onLoad={() => console.log('Map loaded.')}
      >
        <PolylineF
          path={pathALatLngs.filter(p => p.phase === 'manoeuvre')}
          options={{ ...pathOptionsDotted, strokeColor: colorA }}
        />
        <PolylineF
          path={pathALatLngs.filter(p => p.phase === 'pattern')}
          options={{ ...pathOptionsDotted, strokeColor: colorB }}
        />
        <PolylineF
          path={pathBLatLngs.filter(p => p.phase === 'manoeuvre')}
          options={{ ...pathOptions, strokeColor: colorA }}
        />
        <PolylineF
          path={pathBLatLngs.filter(p => p.phase === 'pattern')}
          options={{ ...pathOptions, strokeColor: colorB }}
        />

        {pathALatLngs
          .filter(p => showPoms && p.pom)
          .map((pom, i) => (
            <CircleF
              center={pom}
              options={pom.phase === 'manoeuvre' ? pomOptionsA : pomOptionsB}
              key={i}
            />
          ))}
        {pathBLatLngs
          .filter(p => showPoms && p.pom)
          .map((pom, i) => (
            <CircleF
              center={pom}
              options={pom.phase === 'manoeuvre' ? pomOptionsA : pomOptionsB}
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
