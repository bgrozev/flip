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

import { useAppState, useTarget } from '../hooks';
import { attachPlaceAutocomplete } from '../map';
import { LatLng, MapProvider } from '../types';

import { CustomLocationsComponent, DropzonesComponent } from './';

const LOCATION_TABS = ['dropzones', 'custom', 'search'] as const;
type LocationTab = typeof LOCATION_TABS[number];

const DEFAULT_LOCATION_TAB: LocationTab = 'dropzones';

/**
 * Which tab is showing is UI ephemera, not a document: it stays a plain
 * string (Toolpad's default codec), so no envelope and no reset for stored
 * values. A stored value we don't recognize would leave every tab
 * unselected and the panel empty, so it falls back to the default instead.
 */
function toLocationTab(value: string | null): LocationTab {
  return LOCATION_TABS.includes(value as LocationTab)
    ? (value as LocationTab)
    : DEFAULT_LOCATION_TAB;
}

export default function LocationComponent() {
  const { selectLocation } = useTarget();
  const [storedTab, setSelectedTab] = useLocalStorageState<string>(
    'flip.location.tab',
    DEFAULT_LOCATION_TAB
  );
  const selectedTab = toLocationTab(storedTab);

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
        <Tab label={<Tooltip title="Default dropzones."><span>Dropzones</span></Tooltip>} value="dropzones" />
        <Tab label={<Tooltip title="Custom locations."><span>My Locations</span></Tooltip>} value="custom" />
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
          <MapSearchBox onPlaceSelected={selectLocation} />
        </Box>
      )}
    </Stack>
  );
}

interface MapSearchBoxProps {
  onPlaceSelected: (pos: LatLng) => void;
}

function MapSearchBox({ onPlaceSelected }: MapSearchBoxProps) {
  const { settings } = useAppState();
  const provider: MapProvider = settings.mapProvider;
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the latest callback in a ref so re-attaching depends only on the
  // provider: `onPlaceSelected` is not memoized by its callers, so depending
  // on it directly would re-attach the autocomplete on every render.
  const onPlaceRef = useRef(onPlaceSelected);

  useEffect(() => {
    onPlaceRef.current = onPlaceSelected;
  });

  useEffect(() => {
    const dispose = attachPlaceAutocomplete(
      inputRef.current!,
      pos => onPlaceRef.current(pos),
      provider
    );

    return dispose;
  }, [provider]);

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
