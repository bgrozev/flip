import {
  Box,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import { useLocalStorageState } from '@toolpad/core/useLocalStorageState';
import React, { useEffect, useRef } from 'react';

import { useTarget } from '../hooks';

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

export default function LocationComponent() {
  const { selectLocation } = useTarget();
  const [selectedTab, setSelectedTab] = useLocalStorageState<string>(
    'flip.location.tab',
    'dropzones'
  );

  const handleTabChange = (_event: React.SyntheticEvent, newTab: string) => {
    setSelectedTab(newTab);
  };

  return (
    <Stack spacing={4}>
      <Typography variant="h6">Locations</Typography>
      <Tabs
        value={selectedTab}
        onChange={handleTabChange}
        aria-label="Location tabs"
        sx={{ '& .MuiTab-root': { fontSize: '0.75rem', minWidth: 0, px: 1.5 } }}
      >
        <Tooltip title="Default dropzones.">
          <Tab label="Dropzones" value="dropzones" />
        </Tooltip>
        <Tooltip title="Custom locations.">
          <Tab label="My Locations" value="custom" />
        </Tooltip>
        <Tab label="Search" value="search" />
      </Tabs>

      {selectedTab === 'dropzones' && (
        <Box>
          <DropzonesComponent />
        </Box>
      )}

      {selectedTab === 'custom' && (
        <Box>
          <CustomLocationsComponent />
        </Box>
      )}

      {selectedTab === 'search' && (
        <Box>
          <MapSearchBox
            onPlaceSelected={place => {
              if (place.geometry) {
                selectLocation({
                  lat: place.geometry.location.lat(),
                  lng: place.geometry.location.lng()
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
