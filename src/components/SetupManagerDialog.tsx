/**
 * Everything about a setup that is not switching to it.
 *
 * The switcher stays a switcher: rename, delete, canopy and "does this one
 * belong to a dropzone" are all rare next to picking one, and putting them on
 * the rows would have made a two-line menu row carry an overflow button as
 * well — at 375px there is no room for both.
 */
import {
  Delete as DeleteIcon,
  Place as PlaceIcon,
  Public as PublicIcon
} from '@mui/icons-material';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import React, { useState } from 'react';

import { UseSetupsResult } from '../hooks/useSetups';
import { Setup } from '../types';

import selectOnFocus from './selectOnFocus';

interface SetupManagerDialogProps {
  open: boolean;
  setups: UseSetupsResult;
  placeName: string | null;
  chipsFor: (setup: Setup) => string[];
  onClose: () => void;
}

export default function SetupManagerDialog({
  open,
  setups,
  placeName,
  chipsFor,
  onClose
}: SetupManagerDialogProps) {
  const [confirmDelete, setConfirmDelete] = useState<Setup | null>(null);

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Manage setups</DialogTitle>
        <DialogContent dividers>
          {setups.setups.length === 0 && (
            <DialogContentText variant="body2">No saved setups.</DialogContentText>
          )}
          <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
            {setups.setups.map(setup => (
              <SetupRow
                key={setup.id}
                setup={setup}
                chips={chipsFor(setup)}
                placeName={placeName}
                onRename={name => setups.renameSetup(setup.id, name)}
                onCanopy={canopy => setups.updateSetup(setup.id, { canopy })}
                onBind={bound => setups.setSetupSite(setup.id, bound)}
                onDelete={() => setConfirmDelete(setup)}
              />
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Done</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmDelete !== null} onClose={() => setConfirmDelete(null)} maxWidth="xs">
        <DialogTitle>Delete setup?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            “{confirmDelete?.name}” will be permanently deleted.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button
            onClick={() => {
              if (confirmDelete) setups.deleteSetup(confirmDelete.id);
              setConfirmDelete(null);
            }}
            color="error"
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

interface SetupRowProps {
  setup: Setup;
  chips: string[];
  placeName: string | null;
  onRename: (name: string) => void;
  onCanopy: (canopy: string) => void;
  onBind: (bound: boolean) => void;
  onDelete: () => void;
}

function SetupRow({
  setup,
  chips,
  placeName,
  onRename,
  onCanopy,
  onBind,
  onDelete
}: SetupRowProps) {
  const [name, setName] = useState(setup.name);
  const [canopy, setCanopy] = useState(setup.canopy ?? '');
  const bound = Boolean(setup.site);
  const bindLabel = bound
    ? 'Remembers a target — click to make it travel'
    : `Travels — click to bind it to ${placeName ?? 'here'}`;

  return (
    <Stack spacing={1} sx={{ py: 1.5 }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <TextField
          label="Name"
          size="small"
          fullWidth
          value={name}
          onChange={e => setName(e.target.value)}
          onFocus={selectOnFocus}
          onBlur={() => (name.trim() ? onRename(name.trim()) : setName(setup.name))}
        />
        <TextField
          label="Canopy"
          size="small"
          fullWidth
          value={canopy}
          onChange={e => setCanopy(e.target.value)}
          onFocus={selectOnFocus}
          onBlur={() => onCanopy(canopy.trim())}
        />
        <Tooltip title={bindLabel} describeChild>
          <IconButton size="small" onClick={() => onBind(!bound)}>
            {bound ? <PlaceIcon fontSize="small" /> : <PublicIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete this setup" describeChild>
          <IconButton size="small" onClick={onDelete} sx={{ color: 'error.main' }}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
      {chips.length > 0 && (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {chips.join(' · ')}
        </Typography>
      )}
    </Stack>
  );
}
