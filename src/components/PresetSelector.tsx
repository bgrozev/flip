import {
  Add as AddIcon,
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
  Check as CheckIcon,
  Delete as DeleteIcon,
  DriveFileRenameOutline as RenameIcon,
  KeyboardArrowDown as ArrowDownIcon,
  Save as SaveIcon
} from '@mui/icons-material';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Snackbar,
  TextField,
  Typography
} from '@mui/material';
import React, { useState } from 'react';

import { Preset } from '../types';

interface PresetSelectorProps {
  presets: Preset[];
  activePresetId: string | null;
  onSelect: (id: string | null) => void;
  onSave: (name?: string) => void;
  onDelete: () => void;
  onRename: (id: string, newName: string) => void;
}

export default function PresetSelector({
  presets,
  activePresetId,
  onSelect,
  onSave,
  onDelete,
  onRename
}: PresetSelectorProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [inputName, setInputName] = useState('');
  const [snackbarName, setSnackbarName] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const activePreset = presets.find(p => p.id === activePresetId) ?? null;
  const menuOpen = Boolean(anchorEl);

  const closeMenu = () => setAnchorEl(null);

  const handleSelect = (id: string) => {
    if (id !== activePresetId) onSelect(id);
    closeMenu();
  };

  const handleUpdate = () => {
    const name = activePreset?.name ?? '';
    onSave();
    closeMenu();
    setSnackbarName(name);
    setSnackbarOpen(true);
  };

  const handleOpenSaveDialog = () => {
    closeMenu();
    setInputName('');
    setSaveDialogOpen(true);
  };

  const handleSaveConfirm = () => {
    if (!inputName.trim()) return;
    onSave(inputName.trim());
    setSaveDialogOpen(false);
  };

  const handleOpenRenameDialog = () => {
    closeMenu();
    setInputName(activePreset?.name ?? '');
    setRenameDialogOpen(true);
  };

  const handleRenameConfirm = () => {
    if (!activePresetId || !inputName.trim()) return;
    onRename(activePresetId, inputName.trim());
    setRenameDialogOpen(false);
  };

  const handleOpenDeleteDialog = () => {
    closeMenu();
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    onDelete();
    setDeleteDialogOpen(false);
  };

  return (
    <>
      <Button
        size="small"
        onClick={e => setAnchorEl(e.currentTarget)}
        startIcon={
          activePreset ? (
            <BookmarkIcon fontSize="small" />
          ) : (
            <BookmarkBorderIcon fontSize="small" />
          )
        }
        endIcon={<ArrowDownIcon fontSize="small" />}
        variant={activePreset ? 'outlined' : 'text'}
        color="inherit"
        sx={{ textTransform: 'none', minWidth: 0 }}
      >
        <Typography
          variant="body2"
          noWrap
          sx={{ maxWidth: { xs: 90, sm: 130 }, display: 'block' }}
        >
          {activePreset ? activePreset.name : 'Presets'}
        </Typography>
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={closeMenu}
        slotProps={{ paper: { sx: { minWidth: 220 } } }}
      >
        {presets.length === 0 ? (
          <MenuItem disabled>
            <ListItemText secondary="No saved presets" />
          </MenuItem>
        ) : (
          presets.map(p => (
            <MenuItem
              key={p.id}
              selected={p.id === activePresetId}
              onClick={() => handleSelect(p.id)}
            >
              <ListItemIcon sx={{ minWidth: 32 }}>
                {p.id === activePresetId && <CheckIcon fontSize="small" />}
              </ListItemIcon>
              <ListItemText>{p.name}</ListItemText>
            </MenuItem>
          ))
        )}

        <Divider />

        {activePreset && (
          <MenuItem onClick={handleUpdate}>
            <ListItemIcon sx={{ minWidth: 32 }}>
              <SaveIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Update &ldquo;{activePreset.name}&rdquo;</ListItemText>
          </MenuItem>
        )}

        {activePreset && (
          <MenuItem onClick={handleOpenRenameDialog}>
            <ListItemIcon sx={{ minWidth: 32 }}>
              <RenameIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Rename&hellip;</ListItemText>
          </MenuItem>
        )}

        <MenuItem onClick={handleOpenSaveDialog}>
          <ListItemIcon sx={{ minWidth: 32 }}>
            <AddIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Save as new preset&hellip;</ListItemText>
        </MenuItem>

        {activePreset && (
          <MenuItem onClick={handleOpenDeleteDialog} sx={{ color: 'error.main' }}>
            <ListItemIcon sx={{ minWidth: 32 }}>
              <DeleteIcon fontSize="small" sx={{ color: 'error.main' }} />
            </ListItemIcon>
            <ListItemText>Delete &ldquo;{activePreset.name}&rdquo;</ListItemText>
          </MenuItem>
        )}
      </Menu>

      {/* Save as new */}
      <Dialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Save New Preset</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Preset name"
            fullWidth
            variant="outlined"
            value={inputName}
            onChange={e => setInputName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSaveConfirm()}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSaveConfirm}
            disabled={!inputName.trim()}
            variant="contained"
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rename */}
      <Dialog
        open={renameDialogOpen}
        onClose={() => setRenameDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Rename Preset</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="New name"
            fullWidth
            variant="outlined"
            value={inputName}
            onChange={e => setInputName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleRenameConfirm()}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleRenameConfirm}
            disabled={!inputName.trim()}
            variant="contained"
          >
            Rename
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="xs"
      >
        <DialogTitle>Delete preset?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            &ldquo;{activePreset?.name}&rdquo; will be permanently deleted.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Update feedback */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={2000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="success"
          onClose={() => setSnackbarOpen(false)}
          sx={{ width: '100%' }}
        >
          &ldquo;{snackbarName}&rdquo; updated
        </Alert>
      </Snackbar>
    </>
  );
}
