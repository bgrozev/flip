/**
 * Course layer: buoys, lines and (zoomed-in) distance markers for the
 * enabled canopy-piloting courses.
 */
import React from 'react';

import { Course, CourseElement, CourseMarker } from '../../types';
import { MapCircle, MapOverlay, MapPolyline, useMapZoom } from '..';

/** Course distance markers only render at or above this zoom level. */
const MARKER_MIN_ZOOM = 20;

export interface CourseLayerProps {
  courses: Course[];
}

export default function CourseLayer({ courses }: CourseLayerProps) {
  const zoom = useMapZoom();

  return (
    <>
      {courses.flatMap(course =>
        course.elements.map((element: CourseElement, i) => {
          const key = `${course.id}-${element.type}-${i}`;

          if (element.type === 'buoy') {
            // Two concentric circles.
            // White buoy: white outer + white inner, both with black stroke.
            // Orange buoy: orange outer + white inner; black stroke on both
            //   creates a thin black ring between the two fills.
            const outerFill = element.color === 'white' ? '#ffffff' : '#ff8800';
            const center = { lat: element.lat, lng: element.lng };
            return (
              <React.Fragment key={key}>
                <MapCircle
                  center={center}
                  radius={1.2}
                  fillColor={outerFill}
                  fillOpacity={1}
                  strokeColor="#000"
                  strokeWeight={0.75}
                  strokeOpacity={1}
                  zIndex={15}
                />
                <MapCircle
                  center={center}
                  radius={0.6}
                  fillColor="#ffffff"
                  fillOpacity={1}
                  strokeColor="#000"
                  strokeWeight={0.4}
                  strokeOpacity={1}
                  zIndex={16}
                />
              </React.Fragment>
            );
          }
          if (element.type === 'line') {
            return (
              <MapPolyline
                key={key}
                path={[element.from, element.to]}
                color={element.color}
                opacity={0.9}
                weight={1.5}
                zIndex={10}
              />
            );
          }
          if (element.type === 'marker') {
            if (zoom < MARKER_MIN_ZOOM) return null;
            const marker = element as CourseMarker;
            const pos = { lat: marker.lat, lng: marker.lng };
            if (!marker.label) return null;
            return (
              <MapOverlay key={key} position={pos}>
                <div style={{
                  display: 'inline-block',
                  color: marker.color,
                  fontSize: '10px',
                  whiteSpace: 'nowrap',
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'none',
                  fontWeight: 'bold',
                  background: 'rgba(0,0,0,0.65)',
                  border: '1px solid rgba(255,255,255,0.35)',
                  borderRadius: '2px',
                  padding: '1px 3px',
                }}>
                  {marker.label}
                </div>
              </MapOverlay>
            );
          }
          return null;
        })
      )}
    </>
  );
}
