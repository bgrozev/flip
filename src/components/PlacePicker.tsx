/**
 * The place picker, in three states rather than one long list.
 *
 * It used to render all 274 dropzones unfiltered under the user's saved
 * places, which is not a list anyone reads — and is why two of this file's
 * tests need a 15-second timeout. Now:
 *
 * - **Idle** shows YOUR PLACES: starred dropzones and your own saved
 *   locations first, then the ones you picked recently. One list, not two —
 *   a favorite you just used would otherwise appear in both, and the star on
 *   each row is what tells them apart (and promotes a recent to a favorite
 *   where it stands).
 * - **Searching** filters your places and the dropzones together, and asks
 *   the map provider's geocoder in the same breath, so "where do I want to
 *   land" stays one control.
 * - **Browsing** is the disclosure at the bottom: all the dropzones, grouped
 *   by country. 41 countries is a list; 274 dropzones is not.
 *
 * Everything works without location permission; "Nearest dropzone" is the
 * only thing that asks for it, and only when tapped.
 */
import ClearIcon from '@mui/icons-material/Clear';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HistoryIcon from '@mui/icons-material/History';
import DeleteIcon from '@mui/icons-material/Delete';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { dropzonePlaceId, groupPlacesByCountry, rankPlaces } from '../core/places';
import {
  useAppState,
  useGeolocation,
  useRecentPlaces,
  useSavedPlaces,
  useTarget
} from '../hooks';
import { PlaceSearchLoader, resolvePlaceSuggestion, searchPlaceSuggestions } from '../map';
import { Dropzone, MapProvider, Place, PlaceSuggestion, RecentPlace } from '../types';
import { findClosestDropzone } from '../util/dropzones';

import DisclosureRow from './DisclosureRow';
import selectOnFocus from './selectOnFocus';

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
  const { recents, record } = useRecentPlaces();
  const [query, setQuery] = useState('');
  const [browsing, setBrowsing] = useState(false);

  const searchingList = query.trim() !== '';

  const matches = useMemo(
    () => (searchingList ? rankPlaces(query, places) : []),
    [searchingList, query, places]
  );
  const savedMatches = matches.filter(place => place.kind !== 'dropzone');
  const dropzoneMatches = matches.filter(place => place.kind === 'dropzone');

  // Every dropzone, INCLUDING the starred ones. `buildPlaces` moves a
  // favourite into the saved group, which is right for the search results and
  // wrong here: a browse list called "All dropzones" that quietly loses one
  // each time you star it is lying, and its country counts go with it.
  const allDropzones = useMemo(
    () => places.filter(place => place.kind !== 'custom'),
    [places]
  );
  const countries = useMemo(
    () => (browsing ? groupPlacesByCountry(allDropzones) : []),
    [browsing, allDropzones]
  );

  // Your places: saved first (they are a decision), then the ones you merely
  // passed through. A recent already saved is not repeated — it is the same
  // place, and the star on its row is where that distinction lives.
  const saved = useMemo(
    () => places.filter(place => place.kind !== 'dropzone'),
    [places]
  );
  const unsavedRecents = useMemo(() => {
    const savedIds = new Set(saved.map(place => place.id));

    return recents.filter(entry => entry.id === '' || !savedIds.has(entry.id));
  }, [recents, saved]);

  // The geocoder may not be usable yet (Google's lives in the Maps JS API,
  // which on mobile nothing else has loaded); re-run the query once it is.
  const [geocoderReady, setGeocoderReady] = useState(false);
  const handleGeocoderReady = useCallback(() => setGeocoderReady(true), []);
  const { suggestions, searching } = usePlaceSearch(query, provider, geocoderReady);

  const handleSelectPlace = (place: Place) => {
    record({
      id: place.id,
      name: place.name,
      lat: place.lat,
      lng: place.lng,
      ...place.direction !== undefined ? { direction: place.direction } : {},
      ...placeLocationLabel(place) ? { subtitle: placeLocationLabel(place) } : {}
    });
    selectLocation(
      { lat: place.lat, lng: place.lng },
      headingFor(place, upwindHeading),
      { id: place.id, modes: place.modes }
    );
  };

  // A recent is a snapshot, so it can be re-selected even when whatever it
  // came from is gone. Where it still resolves to a place, the place wins:
  // it carries the per-mode config and the corrected coordinates.
  const handleSelectRecent = (entry: RecentPlace) => {
    const place = entry.id === '' ? undefined : places.find(candidate => candidate.id === entry.id);

    if (place) {
      handleSelectPlace(place);

      return;
    }

    record(entry);
    selectLocation(
      { lat: entry.lat, lng: entry.lng },
      entry.direction ?? upwindHeading ?? undefined,
      entry.id === '' ? undefined : { id: entry.id }
    );
  };

  const handleSelectSuggestion = async (suggestion: PlaceSuggestion) => {
    const position = await resolvePlaceSuggestion(suggestion.id, provider);

    if (position) {
      record({
        id: '',
        name: suggestion.label,
        lat: position.lat,
        lng: position.lng,
        ...suggestion.detail ? { subtitle: suggestion.detail } : {}
      });
      selectLocation(position, upwindHeading ?? undefined);
    }
  };

  return (
    <Stack spacing={2}>
      <PlaceSearchLoader provider={provider} onReady={handleGeocoderReady} />
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
        onFound={dz => handleSelectPlace({
          id: dropzonePlaceId(dz.name),
          kind: 'dropzone',
          name: dz.name,
          lat: dz.lat,
          lng: dz.lng,
          ...dz.direction !== undefined ? { direction: dz.direction } : {},
          ...dz.modes ? { modes: dz.modes } : {},
          ...dz.town ? { town: dz.town } : {},
          ...dz.region ? { region: dz.region } : {},
          ...dz.country ? { country: dz.country } : {}
        })}
      />

      {searchingList ? (
        <List dense disablePadding sx={{ maxHeight: 360, overflowY: 'auto' }} aria-label="Search results">
          {savedMatches.length > 0 && (
            <PlaceGroup
              title="Your places"
              places={savedMatches}
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

          {dropzoneMatches.length > 0 && (
            <PlaceGroup
              title="Dropzones"
              places={dropzoneMatches}
              onSelect={handleSelectPlace}
              isFavorite={isFavorite}
              onToggleFavorite={toggleFavorite}
            />
          )}

          {matches.length === 0 && !searching && suggestions.length === 0 && (
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="body2" color="text.secondary">
                {query.trim().length < MIN_SEARCH_CHARS
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
      ) : (
        <YourPlaces
          saved={saved}
          recents={unsavedRecents}
          onSelectPlace={handleSelectPlace}
          onSelectRecent={handleSelectRecent}
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

      <Box>
        <DisclosureRow
          label={`All dropzones (${allDropzones.length})`}
          open={browsing}
          onToggle={() => setBrowsing(open => !open)}
        />
        {browsing && (
          <List
            dense
            disablePadding
            sx={{ maxHeight: 360, overflowY: 'auto' }}
            aria-label="Dropzones by country"
          >
            {countries.map(group => (
              <CountryGroup
                key={group.country}
                country={group.country}
                places={group.places}
                onSelect={handleSelectPlace}
                isFavorite={isFavorite}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </List>
        )}
      </Box>

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

interface YourPlacesProps {
  saved: Place[];
  recents: RecentPlace[];
  onSelectPlace: (place: Place) => void;
  onSelectRecent: (entry: RecentPlace) => void;
  isFavorite: (name: string) => boolean;
  onToggleFavorite: (name: string) => void;
  onRename: (oldName: string, newName: string) => void;
  onMoveHere: (name: string) => void;
  onRemove: (name: string) => void;
}

/**
 * One list, saved first. The two halves are not separately headed on purpose:
 * a favorite you used an hour ago is both saved and recent, and two headed
 * lists would either show it twice or need an invisible rule about which one
 * wins. Position says which is which, and the star says how to change it.
 */
function YourPlaces({
  saved,
  recents,
  onSelectPlace,
  onSelectRecent,
  isFavorite,
  onToggleFavorite,
  onRename,
  onMoveHere,
  onRemove
}: YourPlacesProps) {
  if (saved.length === 0 && recents.length === 0) {
    return (
      <Box sx={{ px: 1, py: 1.5 }}>
        <Typography variant="body2" color="text.secondary">
          Search for a dropzone, or open the list below. Star one and it will
          be waiting here next time.
        </Typography>
      </Box>
    );
  }

  return (
    <List dense disablePadding sx={{ maxHeight: 360, overflowY: 'auto' }} aria-label="Your places">
      <ListSubheader disableSticky>Your places</ListSubheader>
      {saved.map(place => (
        <ListItemButton key={place.id} onClick={() => onSelectPlace(place)}>
          <ListItemText primary={place.name} secondary={placeLocationLabel(place)} />
          {place.website && <WebsiteLink place={place} />}
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
      {recents.map(entry => (
        <ListItemButton key={entry.id || `name:${entry.name}`} onClick={() => onSelectRecent(entry)}>
          <ListItemIcon sx={{ minWidth: 36 }}>
            <HistoryIcon fontSize="small" color="disabled" />
          </ListItemIcon>
          <ListItemText primary={entry.name} secondary={entry.subtitle} />
          {/* Only a dropzone can be starred — a favorite names one, so a
              geocoder hit has nothing to name. Saving one is what
              "Save current target" is for. */}
          {entry.id.startsWith('dz:') && (
            <FavoriteToggle
              name={entry.name}
              favorite={isFavorite(entry.name)}
              onToggle={onToggleFavorite}
            />
          )}
        </ListItemButton>
      ))}
    </List>
  );
}

interface CountryGroupProps {
  country: string;
  places: Place[];
  onSelect: (place: Place) => void;
  isFavorite: (name: string) => boolean;
  onToggleFavorite: (name: string) => void;
}

/** One country, collapsed until asked: the whole point of grouping. */
function CountryGroup({
  country,
  places,
  onSelect,
  isFavorite,
  onToggleFavorite
}: CountryGroupProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <ListItemButton onClick={() => setOpen(value => !value)}>
        <ListItemIcon sx={{ minWidth: 36 }}>
          {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </ListItemIcon>
        <ListItemText primary={country} secondary={`${places.length}`} />
      </ListItemButton>
      {open && places.map(place => (
        <ListItemButton key={place.id} sx={{ pl: 5 }} onClick={() => onSelect(place)}>
          <ListItemText primary={place.name} secondary={placeLocationLabel(place)} />
          {place.website && <WebsiteLink place={place} />}
          <FavoriteToggle
            name={place.name}
            favorite={isFavorite(place.name)}
            onToggle={onToggleFavorite}
          />
        </ListItemButton>
      ))}
    </>
  );
}

/** "Eloy, Arizona" — whichever of the location fields are known. */
function placeLocationLabel(place: Place): string | undefined {
  const parts = [place.town, place.region, place.country]
    .filter((value): value is string => value !== undefined && value !== '');

  return parts.length > 0 ? parts.join(', ') : undefined;
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
          <ListItemText primary={place.name} secondary={placeLocationLabel(place)} />
          {place.website && <WebsiteLink place={place} />}
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

/** Opens the dropzone's own site. Stops the click so the row doesn't select. */
function WebsiteLink({ place }: { place: Place }) {
  return (
    <Tooltip title={`Open the ${place.name} website`}>
      <IconButton
        size="small"
        component="a"
        href={place.website}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${place.name} website`}
        onClick={event => event.stopPropagation()}
      >
        <OpenInNewIcon fontSize="small" />
      </IconButton>
    </Tooltip>
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
      <Button variant="outlined" size="small" onClick={() => setOpen(true)} sx={{ alignSelf: 'flex-start' }}>
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

/** Keep a click inside a row's dialog from reaching the row underneath. */
function stopClick(event: React.MouseEvent): void {
  event.stopPropagation();
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
    // A portal renders elsewhere in the DOM but stays a child in the REACT
    // tree, so a click in here bubbles to whatever contains the dialog — and
    // this one is rendered inside a place row, whose job is to select the
    // place. Confirming a rename therefore also moved the target to it. The
    // `Menu` beside it already guards this the same way.
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" onClick={stopClick}>
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
            onFocus={selectOnFocus}
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
  onFound: (dropzone: Dropzone) => void;
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
function usePlaceSearch(query: string, provider: MapProvider, geocoderReady: boolean) {
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
  }, [query, provider, geocoderReady]);

  return { suggestions, searching };
}
