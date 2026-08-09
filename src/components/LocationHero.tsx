/**
 * Where you are, as the first thing the Location panel says.
 *
 * The panel used to open with an instruction ("drag the target on the map…")
 * and a search box, so the one question it exists to answer — *which dropzone
 * am I planning at* — was answered only by a highlighted row somewhere in a
 * 274-entry list. This is that answer, in display type.
 *
 * It also collects the things that belong to the current place rather than to
 * the list: starring it, its website, and how far the target has been dragged
 * from where the place says it is.
 */
import {
  OpenInNew as OpenInNewIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon
} from '@mui/icons-material';
import { Box, IconButton, Link, Stack, Tooltip, Typography } from '@mui/material';
import React from 'react';

import { Place } from '../types';

interface LocationHeroProps {
  /** The active place, or null when the target belongs to no place. */
  place: Place | null;
  /** Where the target actually is — it may have been dragged off the place. */
  targetLat: number;
  targetLng: number;
  /**
   * How far the target sits from the place's own coordinates, in the user's
   * distance unit, already formatted (e.g. "120 m"). Absent when the target
   * is on the place, or when there is no place to measure against.
   */
  offsetLabel?: string;
  /** Put the target back on the place's own coordinates. */
  onResetToPlace?: () => void;
  isFavorite: boolean;
  /** Absent for a custom place or a geocoder hit — only dropzones star. */
  onToggleFavorite?: () => void;
}

/** Town, region and country, in whichever of them the place actually has. */
export function placeSubtitle(place: Place): string {
  return [place.town, place.region, place.country].filter(Boolean).join(', ');
}

export default function LocationHero({
  place,
  targetLat,
  targetLng,
  offsetLabel,
  onResetToPlace,
  isFavorite,
  onToggleFavorite
}: LocationHeroProps) {
  const subtitle = place ? placeSubtitle(place) : '';
  const coordinates = `${targetLat.toFixed(5)}, ${targetLng.toFixed(5)}`;

  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 1,
        bgcolor: 'action.hover',
        border: 1,
        borderColor: 'divider'
      }}
    >
      <Stack direction="row" alignItems="flex-start" spacing={1}>
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography variant="h6" sx={{ lineHeight: 1.2, wordBreak: 'break-word' }}>
            {/* A target that belongs to no place is not nameless — it is just
                somewhere, and saying so beats leaving the line blank. */}
            {place ? place.name : 'Custom location'}
          </Typography>
          {subtitle !== '' && (
            <Typography variant="body2" color="text.secondary">{subtitle}</Typography>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            {coordinates}
          </Typography>
          {place?.website && (
            <Link
              href={place.website}
              target="_blank"
              rel="noopener noreferrer"
              variant="caption"
              sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, mt: 0.5 }}
            >
              Website<OpenInNewIcon sx={{ fontSize: 12 }} />
            </Link>
          )}
        </Box>
        {onToggleFavorite && (
          <Tooltip title={isFavorite ? 'Remove from your places' : 'Add to your places'}>
            <IconButton size="small" onClick={onToggleFavorite}>
              {isFavorite
                ? <StarIcon fontSize="small" color="warning" />
                : <StarBorderIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      {offsetLabel && onResetToPlace && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Target moved {offsetLabel} from the dropzone.{' '}
          <Link component="button" type="button" variant="caption" onClick={onResetToPlace}>
            Put it back
          </Link>
        </Typography>
      )}
    </Box>
  );
}
