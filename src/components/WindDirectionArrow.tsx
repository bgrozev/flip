import { Navigation } from '@mui/icons-material';
import React from 'react';

// Beaufort wind scale color mapping
const getWindColor = (speed: number): string => {
  if (speed <= 1) {
    return '#0000FF';
  } // Calm: Blue
  if (speed <= 5) {
    return '#008000';
  } // Light breeze: Green
  if (speed <= 11) {
    return '#FFFF00';
  } // Moderate breeze: Yellow
  if (speed <= 19) {
    return '#FFA500';
  } // Strong breeze: Orange
  if (speed <= 28) {
    return '#FF0000';
  } // Gale: Red

  return '#8B0000'; // Strong gale: Dark Red
};

interface WindDirectionArrowProps {
  direction: number;
  speed: number;
}

export default function WindDirectionArrow({ direction, speed }: WindDirectionArrowProps) {
  const arrowColor = getWindColor(speed);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 50,
        left: 50,
        pointerEvents: 'none', // Arrow doesn't block map interactions
        zIndex: 1000
      }}
    >
      <div
        style={{
          transformOrigin: 'center',
          transform: `rotate(${180 + direction}deg)`, // Rotate based on wind direction
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%'
        }}
      >
        <Navigation sx={{ fontSize: 80, color: arrowColor }} />{' '}
        {/* Customizable arrow with color */}
      </div>

      <div
        style={{
          color: arrowColor,
          textAlign: 'center',
          fontSize: '18px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          whiteSpace: 'nowrap', // Prevent text from wrapping
          marginTop: '8px', // Space between arrow and text
          padding: '4px 8px', // Padding around the text
          backgroundColor: 'rgba(0, 0, 0, 0.6)', // Background color for contrast
          borderRadius: '8px', // Rounded corners
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)', // Subtle shadow for depth
          width: 'max-content' // Ensure the box wraps the text tightly
        }}
      >
        {`${Math.round(direction)}° @ ${Math.round(speed)} kts`}{' '}
        {/* Display direction and speed */}
      </div>
    </div>
  );
}
