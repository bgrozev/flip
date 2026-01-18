import {
  Box,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography
} from '@mui/material';
import { useLocalStorageState } from '@toolpad/core/useLocalStorageState';
import React, { useEffect, useRef } from 'react';

import { Target } from '../types';

import { CustomLocationsComponent, DropzonesComponent } from './';

declare global {
  interface Window {
    google?: {
      maps: {
        places: {
          Autocomplete: new (
            input: HTMLInputElement
          ) => {
            addListener: (event: string, callback: () => void) => void;
            getPlace: () => {
              geometry?: {
                location: {
                  lat: () => number;
                  lng: () => number;
                };
              };
            };
          };
        };
      };
    };
  }
}

interface LocationComponentProps {
  target: Target;
  setTarget: (target: Target) => void;
}

export default function LocationComponent({ target, setTarget }: LocationComponentProps) {
  const [selectedTab, setSelectedTab] = useLocalStorageState<string>(
    'flip.location.tab',
    'dropzones'
  );

  const handleTabChange = (
    _event: React.MouseEvent<HTMLElement>,
    newTab: string | null
  ) => {
    if (newTab !== null) {
      setSelectedTab(newTab);
    }
  };

  return (
    <Stack spacing={4}>
      <Typography variant="h6">Locations</Typography>
      <ToggleButtonGroup
        value={selectedTab}
        exclusive
        onChange={handleTabChange}
        aria-label="Location tabs"
        sx={{ mb: 2 }}
      >
        <Tooltip title="Default dropzones.">
          <ToggleButton value="dropzones" aria-label="Dropzones">
            Dropzones
          </ToggleButton>
        </Tooltip>
        <Tooltip title="Custom locations.">
          <ToggleButton value="custom" aria-label="My Locations">
            My Locations
          </ToggleButton>
        </Tooltip>
        <ToggleButton value="search" aria-label="Search">
          Search
        </ToggleButton>
      </ToggleButtonGroup>

      {selectedTab === 'dropzones' && (
        <Box>
          <DropzonesComponent target={target} setTarget={setTarget} />
        </Box>
      )}

      {selectedTab === 'custom' && (
        <Box>
          <CustomLocationsComponent target={target} setTarget={setTarget} />
        </Box>
      )}

      {selectedTab === 'search' && (
        <Box>
          <MapSearchBox
            onPlaceSelected={place => {
              if (place.geometry) {
                setTarget({
                  ...target,
                  target: {
                    lat: place.geometry.location.lat(),
                    lng: place.geometry.location.lng()
                  }
                });
              }
            }}
          />
        </Box>
      )}
    </Stack>
  );
}

interface Place {
  geometry?: {
    location: {
      lat: () => number;
      lng: () => number;
    };
  };
}

interface MapSearchBoxProps {
  onPlaceSelected: (place: Place) => void;
}

function MapSearchBox({ onPlaceSelected }: MapSearchBoxProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!window.google) {
      console.log('No window.google');

      return;
    }

    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current!);

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();

      if (place.geometry) {
        onPlaceSelected(place);
      }
    });
  }, [onPlaceSelected]);

  return (
    <TextField
      inputRef={inputRef}
      label="Search location"
      variant="outlined"
      fullWidth
      style={{ maxWidth: '300px' }}
    />
  );
}
