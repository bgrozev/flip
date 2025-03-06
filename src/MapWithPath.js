/* eslint-disable react/prop-types */
import { CircleF, GoogleMap, LoadScript, PolylineF } from '@react-google-maps/api';
import React from 'react';

import { Point } from './util/geo.js';

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

const pathOptionsA = {
    ...pathOptions,
    strokeColor: colorA
};

const pathOptionsB = {
    ...pathOptions,
    strokeColor: colorB
};

function MapWithPath(props) {
    return (
        <LoadScript googleMapsApiKey="INSERT_GOOGLE_API_KEY">
            <GoogleMap
                mapContainerStyle={containerStyle}
                mapTypeId='satellite'
                mapTypeControl='true'
                center={props.center}
                onClick={ev => {
                    props.onClick(new Point(ev.latLng.lat(), ev.latLng.lng()));
                }}
                zoom={17}
            >
                <PolylineF
                    path={props.pathA.points}
                    options={pathOptionsA}
                    field="m1"
                />
                <PolylineF
                    path={props.pathB.points}
                    options={pathOptionsB}
                    field="m1"
                />

                {
                    props.pathA.points
                        .filter(p => props.showPoms && p.pom)
                        .map((pom, i) =>
                            <CircleF center={pom} options={pomOptionsA} key={i} />
                        )
                }
                {
                    props.pathB.points
                        .filter(p => props.showPoms && p.pom)
                        .map((pom, i) =>
                            <CircleF center={pom} options={pomOptionsB} key={i} />
                        )
                }
            </GoogleMap>
        </LoadScript>
    );
}

export default React.memo(MapWithPath);
