/* eslint-disable react/prop-types */
import { CircleF, GoogleMap, OverlayView, PolylineF, useJsApiLoader } from '@react-google-maps/api';
import React from 'react';

import WindDirectionArrow from './WindDirectionArrow.js';

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
    icons: [ {
        icon: {
            path: 'M 0,-1 0,1', // Short line segment
            strokeOpacity: 0.7,
            scale: 2
        },
        offset: '0',
        repeat: '12px' // Space between dashes (adjust for density)
    } ],
    strokeOpacity: 0 // Hide the normal stroke so only dashes show
};

const CustomTextOverlay = ({ position, text }) => (
    <OverlayView
        position={position}
        mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
    >
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

const libraries = [ 'places' ];

function MapComponent({ windSpeed, windDirection, center, onClick, pathA, pathB, settings, waitingForClick }) {
    const { showPoms, showPomAltitudes, displayWindArrow } = settings;

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: 'INSERT_GOOGLE_API_KEY',
        libraries
    });

    return isLoaded ? (<>
        <GoogleMap
            mapContainerStyle={containerStyle}
            center={center}
            onClick={ev => {
                onClick({ lat: ev.latLng.lat(), lng: ev.latLng.lng() });
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
                path={pathA.filter(p => p.phase === 'manoeuvre')}
                options={{ ...pathOptionsDotted, strokeColor: colorA }}
                field="m1"
            />
            <PolylineF
                path={pathA.filter(p => p.phase === 'pattern')}
                options={{ ...pathOptionsDotted, strokeColor: colorB }}
                field="m1"
            />
            <PolylineF
                path={pathB.filter(p => p.phase === 'manoeuvre')}
                options={{ ...pathOptions, strokeColor: colorA }}
                field="m1"
            />
            <PolylineF
                path={pathB.filter(p => p.phase === 'pattern')}
                options={{ ...pathOptions, strokeColor: colorB }}
                field="m1"
            />

            {
                pathA
                        .filter(p => showPoms && p.pom)
                        .map((pom, i) =>
                            <CircleF
                                center={pom}
                                options={pom.phase === 'manoeuvre' ? pomOptionsA : pomOptionsB}
                                key={i}
                            />
                        )
            }
            {
                pathB
                        .filter(p => showPoms && p.pom)
                        .map((pom, i) =>
                            <CircleF
                                center={pom}
                                options={pom.phase === 'manoeuvre' ? pomOptionsA : pomOptionsB}
                                key={i}
                            />
                        )
            }
            {
                pathB
                        .filter(p => showPomAltitudes && p.pom)
                        .map((pom, i) =>

                        // <CustomTextOverlay position={pom} text={"i="+i+ ",alt="+pom.alt + ",t="+pom.time} key={i} />
                            <CustomTextOverlay position={pom} text={`${Math.round(pom.alt)} ft`} key={i} />
                        )
            }
        </GoogleMap>

        {displayWindArrow
                && <WindDirectionArrow direction={windDirection} speed={windSpeed} />
        }</>
    ) : <>Loading</>;
}

export default React.memo(MapComponent);
