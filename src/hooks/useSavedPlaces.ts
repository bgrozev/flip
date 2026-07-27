/**
 * The user's saved places: starred dropzones ("favorites", stored by name)
 * and locations they saved themselves ("custom", stored with coordinates),
 * merged with the dropzone database into one list for the picker.
 *
 * Two stores rather than one union type: the custom-location store predates
 * favorites and is already versioned, and a favorite really is just a
 * reference to a dropzone.
 */
import { useLocalStorageState } from '@toolpad/core/useLocalStorageState';
import { useMemo } from 'react';

import { SCHEMA_VERSION, migrateCustomLocations, migrateFavoriteDropzones } from '../core/model';
import { buildPlaces } from '../core/places';
import { CustomLocation, Place } from '../types';
import { DROPZONES } from '../util/dropzones';
import { createVersionedCodec } from '../util/storage';

const customCodec = createVersionedCodec(SCHEMA_VERSION, migrateCustomLocations);
const favoritesCodec = createVersionedCodec(SCHEMA_VERSION, migrateFavoriteDropzones);

const NO_CUSTOM: CustomLocation[] = [];
const NO_FAVORITES: string[] = [];

export interface SavedPlaces {
  /** Everything selectable: saved places first, then the remaining dropzones. */
  places: Place[];
  isFavorite: (dropzoneName: string) => boolean;
  toggleFavorite: (dropzoneName: string) => void;
  /** Save (or overwrite) a custom place. Names are the identity. */
  saveCustom: (location: CustomLocation) => void;
  renameCustom: (oldName: string, newName: string) => void;
  removeCustom: (name: string) => void;
}

export function useSavedPlaces(): SavedPlaces {
  const [storedCustom, setStoredCustom] = useLocalStorageState<CustomLocation[]>(
    'flip.custom_locations',
    NO_CUSTOM,
    { codec: customCodec }
  );
  const [storedFavorites, setStoredFavorites] = useLocalStorageState<string[]>(
    'flip.favorite_dropzones',
    NO_FAVORITES,
    { codec: favoritesCodec }
  );

  const customLocations = storedCustom ?? NO_CUSTOM;
  const favorites = storedFavorites ?? NO_FAVORITES;

  const places = useMemo(
    () => buildPlaces(DROPZONES, customLocations, favorites),
    [customLocations, favorites]
  );

  const isFavorite = (dropzoneName: string) => favorites.includes(dropzoneName);

  const toggleFavorite = (dropzoneName: string) => {
    setStoredFavorites(
      favorites.includes(dropzoneName)
        ? favorites.filter(name => name !== dropzoneName)
        : [...favorites, dropzoneName]
    );
  };

  const saveCustom = (location: CustomLocation) => {
    setStoredCustom([
      ...customLocations.filter(loc => loc.name !== location.name),
      location
    ]);
  };

  const renameCustom = (oldName: string, newName: string) => {
    if (newName === '' || oldName === newName) {
      return;
    }
    // The new name wins if it collides, the same way saveCustom overwrites.
    setStoredCustom(
      customLocations
        .filter(loc => loc.name !== newName)
        .map(loc => (loc.name === oldName ? { ...loc, name: newName } : loc))
    );
  };

  const removeCustom = (name: string) => {
    setStoredCustom(customLocations.filter(loc => loc.name !== name));
  };

  return { places, isFavorite, toggleFavorite, saveCustom, renameCustom, removeCustom };
}
