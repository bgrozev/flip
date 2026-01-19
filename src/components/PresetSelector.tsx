import {
  Delete as DeleteIcon,
  Save as SaveIcon
} from '@mui/icons-material';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  SelectChangeEvent,
  Stack,
  TextField,
  Tooltip
} from '@mui/material';
import React, { useState } from 'react';

import { Preset } from '../types';

interface PresetSelectorProps {
  presets: Preset[];
  activePresetId: string | null;
  onSelect: (id: string | null) => void;
  onSave: (name?: string) => void;
  onDelete: () => void;
}

export default function PresetSelector({
  presets,
  activePresetId,
  onSelect,
  onSave,
  onDelete
}: PresetSelectorProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');

  const handleSelectChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value;
    onSelect(value === '' ? null : value);
  };

  const handleSaveClick = () => {
    if (activePresetId) {
      onSave();
    } else {
      setDialogOpen(true);
    }
  };

  const handleDialogSave = () => {
    if (newName.trim()) {
      onSave(newName.trim());
      setNewName('');
      setDialogOpen(false);
    }
  };

  const handleDialogClose = () => {
    setNewName('');
    setDialogOpen(false);
  };

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <FormControl size="small" sx={{ minWidth: 150 }}>
        <Select
          value={activePresetId ?? ''}
          displayEmpty
          onChange={handleSelectChange}
        >
          <MenuItem value="">
            <em>No preset</em>
          </MenuItem>
          {presets.map(p => (
            <MenuItem key={p.id} value={p.id}>
              {p.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Tooltip title={activePresetId ? 'Update preset' : 'Save as new preset'}>
        <IconButton onClick={handleSaveClick}>
          <SaveIcon />
        </IconButton>
      </Tooltip>

      {activePresetId && (
        <Tooltip title="Delete preset">
          <IconButton onClick={onDelete}>
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      )}

      <Dialog open={dialogOpen} onClose={handleDialogClose}>
        <DialogTitle>Save New Preset</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Preset name"
            fullWidth
            variant="outlined"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                handleDialogSave();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose}>Cancel</Button>
          <Button onClick={handleDialogSave} disabled={!newName.trim()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
