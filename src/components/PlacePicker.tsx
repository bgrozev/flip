/**
 * The target picker: one search box over one list.
 *
 * The list is the user's saved places (starred dropzones and their own saved
 * locations) followed by the known dropzones; typing filters it. The same
 * box also queries the map provider's geocoder, whose hits are appended as
 * their own group — so "where do I want to land" is one control, not a
 * choice between a dropzone dropdown and a separate search box.
 *
 * Everything works without location permission; "Nearest dropzone" is the
 * only thing that asks for it, and only when tapped.
 */
import ClearIcon from '@mui/icons-material/Clear';
import DeleteIcon from '@mui/icons-material/Delete';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import PlaceIcon from '@mui/icons-material/Place';
import SearchIcon from '@mui/icons-material/Search';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { rankPlaces } from '../core/places';
import { useAppState, useGeolocation, useSavedPlaces, useTarget } from '../hooks';
import { resolvePlaceSuggestion, searchPlaceSuggestions } from '../map';
import { MapProvider, Place, PlaceSuggestion } from '../types';
import { findClosestDropzone } from '../util/dropzones';

/** Below this a geocoder query is noise; the local list is doing the work. */
const MIN_SEARCH_CHARS = 3;
const SEARCH_DEBOUNCE_MS = 250;

interface PlacePickerProps {
  /**
   * Heading to use for places with no known landing direction — the current
   * wind direction, or null when there is no usable wind. Imported dropzones
   * have no direction (see `util/dropzones.ts`), so landing into wind is the
   * best available answer.
   */
  upwindHeading: number | null;
}

export default function PlacePicker({ upwindHeading }: PlacePickerProps) {
  const { target, selectLocation } = useTarget();
  const { settings } = useAppState();
  const provider = settings.mapProvider;
  const { places, isFavorite, toggleFavorite, saveCustom, renameCustom, removeCustom } =
    useSavedPlaces();
  const [query, setQuery] = useState('');

  const matches = useMemo(() => rankPlaces(query, places), [query, places]);
  const saved = matches.filter(place => place.kind !== 'dropzone');
  const dropzones = matches.filter(place => place.kind === 'dropzone');

  const { suggestions, searching } = usePlaceSearch(query, provider);

  const handleSelectPlace = (place: Place) => {
    selectLocation({ lat: place.lat, lng: place.lng }, headingFor(place, upwindHeading));
  };

  const handleSelectSuggestion = async (suggestion: PlaceSuggestion) => {
    const position = await resolvePlaceSuggestion(suggestion.id, provider);

    if (position) {
      selectLocation(position, upwindHeading ?? undefined);
    }
  };

  return (
    <Stack spacing={2}>
      <TextField
        value={query}
        onChange={event => setQuery(event.target.value)}
        label="Search dropzones and places"
        fullWidth
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
            ),
            endAdornment: query !== '' ? (
              <InputAdornment position="end">
                <IconButton size="small" aria-label="Clear search" onClick={() => setQuery('')}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null
          }
        }}
      />

      <NearestDropzoneButton
        onFound={dz => selectLocation(
          { lat: dz.lat, lng: dz.lng },
          dz.direction ?? upwindHeading ?? undefined
        )}
      />

      <List
        dense
        disablePadding
        sx={{ maxHeight: 360, overflowY: 'auto' }}
        aria-label="Places"
      >
        {saved.length > 0 && (
          <PlaceGroup
            title="My places"
            places={saved}
            onSelect={handleSelectPlace}
            isFavorite={isFavorite}
            onToggleFavorite={toggleFavorite}
            onRename={renameCustom}
            onMoveHere={name => saveCustom({
              name,
              lat: target.target.lat,
              lng: target.target.lng,
              direction: target.finalHeading
            })}
            onRemove={removeCustom}
          />
        )}

        {dropzones.length > 0 && (
          <PlaceGroup
            title="Dropzones"
            places={dropzones}
            onSelect={handleSelectPlace}
            isFavorite={isFavorite}
            onToggleFavorite={toggleFavorite}
          />
        )}

        {matches.length === 0 && !searching && suggestions.length === 0 && (
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography variant="body2" color="text.secondary">
              {query.length < MIN_SEARCH_CHARS
                ? 'No dropzone matches. Type a bit more to search the map.'
                : 'Nothing found.'}
            </Typography>
          </Box>
        )}

        {(suggestions.length > 0 || searching) && (
          <>
            <ListSubheader disableSticky>
              <Stack direction="row" spacing={1} alignItems="center">
                <span>Search results</span>
                {searching && <CircularProgress size={12} />}
              </Stack>
            </ListSubheader>
            {suggestions.map(suggestion => (
              <ListItemButton
                key={suggestion.id}
                onClick={() => handleSelectSuggestion(suggestion)}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <PlaceIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={suggestion.label} secondary={suggestion.detail} />
              </ListItemButton>
            ))}
          </>
        )}
      </List>

      <SaveCurrentTargetButton
        onSave={name => saveCustom({
          name,
          lat: target.target.lat,
          lng: target.target.lng,
          direction: target.finalHeading
        })}
      />
    </Stack>
  );
}

/** A dropzone's own landing direction, else into wind, else leave it alone. */
function headingFor(place: Place, upwindHeading: number | null): number | undefined {
  return place.direction ?? upwindHeading ?? undefined;
}

interface PlaceGroupProps {
  title: string;
  places: Place[];
  onSelect: (place: Place) => void;
  isFavorite: (name: string) => boolean;
  onToggleFavorite: (name: string) => void;
  onRename?: (oldName: string, newName: string) => void;
  onMoveHere?: (name: string) => void;
  onRemove?: (name: string) => void;
}

function PlaceGroup({
  title,
  places,
  onSelect,
  isFavorite,
  onToggleFavorite,
  onRename,
  onMoveHere,
  onRemove
}: PlaceGroupProps) {
  return (
    <>
      <ListSubheader disableSticky>{title}</ListSubheader>
      {places.map(place => (
        <ListItemButton key={place.id} onClick={() => onSelect(place)}>
          <ListItemText primary={place.name} />
          {place.kind === 'custom' ? (
            <CustomPlaceMenu
              place={place}
              onRename={onRename}
              onMoveHere={onMoveHere}
              onRemove={onRemove}
            />
          ) : (
            <FavoriteToggle
              name={place.name}
              favorite={isFavorite(place.name)}
              onToggle={onToggleFavorite}
            />
          )}
        </ListItemButton>
      ))}
    </>
  );
}

interface FavoriteToggleProps {
  name: string;
  favorite: boolean;
  onToggle: (name: string) => void;
}

function FavoriteToggle({ name, favorite, onToggle }: FavoriteToggleProps) {
  return (
    <Tooltip title={favorite ? 'Remove from my places' : 'Add to my places'}>
      <IconButton
        edge="end"
        size="small"
        aria-label={`${favorite ? 'Unstar' : 'Star'} ${name}`}
        onClick={event => {
          // The row itself selects the place; starring must not also do that.
          event.stopPropagation();
          onToggle(name);
        }}
      >
        {favorite ? <StarIcon fontSize="small" color="primary" /> : <StarBorderIcon fontSize="small" />}
      </IconButton>
    </Tooltip>
  );
}

interface CustomPlaceMenuProps {
  place: Place;
  onRename?: (oldName: string, newName: string) => void;
  onMoveHere?: (name: string) => void;
  onRemove?: (name: string) => void;
}

function CustomPlaceMenu({ place, onRename, onMoveHere, onRemove }: CustomPlaceMenuProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [renaming, setRenaming] = useState(false);

  const close = () => setAnchor(null);

  return (
    <>
      <IconButton
        edge="end"
        size="small"
        aria-label={`Edit ${place.name}`}
        onClick={event => {
          event.stopPropagation();
          setAnchor(event.currentTarget);
        }}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchor} open={anchor !== null} onClose={close} onClick={e => e.stopPropagation()}>
        <MenuItem onClick={() => { close(); setRenaming(true); }}>
          <ListItemIcon><DriveFileRenameOutlineIcon fontSize="small" /></ListItemIcon>
          Rename
        </MenuItem>
        <MenuItem onClick={() => { close(); onMoveHere?.(place.name); }}>
          <ListItemIcon><MyLocationIcon fontSize="small" /></ListItemIcon>
          Move to current target
        </MenuItem>
        <MenuItem onClick={() => { close(); onRemove?.(place.name); }}>
          <ListItemIcon><DeleteIcon fontSize="small" /></ListItemIcon>
          Delete
        </MenuItem>
      </Menu>
      <NameDialog
        open={renaming}
        title="Rename place"
        initialName={place.name}
        confirmLabel="Rename"
        onClose={() => setRenaming(false)}
        onConfirm={name => onRename?.(place.name, name)}
      />
    </>
  );
}

interface SaveCurrentTargetButtonProps {
  onSave: (name: string) => void;
}

function SaveCurrentTargetButton({ onSave }: SaveCurrentTargetButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outlined" onClick={() => setOpen(true)} sx={{ alignSelf: 'flex-start' }}>
        Save current target
      </Button>
      <NameDialog
        open={open}
        title="Save current target"
        initialName=""
        confirmLabel="Save"
        onClose={() => setOpen(false)}
        onConfirm={onSave}
      />
    </>
  );
}

interface NameDialogProps {
  open: boolean;
  title: string;
  initialName: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: (name: string) => void;
}

function NameDialog({
  open, title, initialName, confirmLabel, onClose, onConfirm
}: NameDialogProps) {
  const [name, setName] = useState(initialName);

  // Reopening for a different place must not show the previous name.
  useEffect(() => {
    if (open) {
      setName(initialName);
    }
  }, [open, initialName]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();

    if (trimmed === '') {
      return;
    }
    onConfirm(trimmed);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <form onSubmit={submit}>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label="Name"
            value={name}
            onChange={event => setName(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={name.trim() === ''}>
            {confirmLabel}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

interface NearestDropzoneButtonProps {
  onFound: (dropzone: { lat: number; lng: number; direction?: number }) => void;
}

function NearestDropzoneButton({ onFound }: NearestDropzoneButtonProps) {
  const { status, request } = useGeolocation();

  const handleClick = async () => {
    const position = await request();

    if (position) {
      onFound(findClosestDropzone([position.lng, position.lat]));
    }
  };

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Button
        size="small"
        startIcon={
          status === 'locating'
            ? <CircularProgress size={14} />
            : <MyLocationIcon fontSize="small" />
        }
        onClick={handleClick}
        disabled={status === 'locating' || status === 'unavailable'}
      >
        Nearest dropzone
      </Button>
      {(status === 'denied' || status === 'error' || status === 'unavailable') && (
        <Typography variant="caption" color="text.secondary">
          {status === 'denied'
            ? 'Location permission denied — pick from the list instead.'
            : 'Location unavailable — pick from the list instead.'}
        </Typography>
      )}
    </Stack>
  );
}

/**
 * Debounced geocoder search for the current query. Out-of-order responses are
 * dropped (a slow early query must not overwrite a later one), and the
 * provider comes from settings so the picker never touches a concrete map
 * implementation.
 */
function usePlaceSearch(query: string, provider: MapProvider) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < MIN_SEARCH_CHARS) {
      seq.current++;
      setSuggestions([]);
      setSearching(false);

      return;
    }

    setSearching(true);
    const mySeq = ++seq.current;
    const timer = setTimeout(() => {
      searchPlaceSuggestions(trimmed, provider).then(results => {
        if (mySeq !== seq.current) {
          return; // superseded by a newer query
        }
        setSuggestions(results);
        setSearching(false);
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, provider]);

  return { suggestions, searching };
}
