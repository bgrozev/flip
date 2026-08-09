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
import React, { useEffect, useRef, useState } from 'react';

import { Preset } from '../types';

import selectOnFocus from './selectOnFocus';

interface PresetSelectorProps {
  presets: Preset[];
  activePresetId: string | null;
  onSelect: (id: string | null) => void;
  onSave: (name?: string) => void;
  onDelete: () => void;
  onRename: (id: string, newName: string) => void;
  /**
   * Whether the menu is open. Owned by App so the `S` shortcut can open it.
   * Controlled rather than signalled: Toolpad re-creates the toolbar slot on
   * every render, so this component remounts constantly, and any "open once"
   * trigger held in local state or an effect would re-fire on each remount.
   */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PresetSelector({
  presets,
  activePresetId,
  onSelect,
  onSave,
  onDelete,
  onRename,
  open,
  onOpenChange
}: PresetSelectorProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [inputName, setInputName] = useState('');
  const [snackbarName, setSnackbarName] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  // Anchor follows the controlled flag. Done in an effect rather than at
  // render because on a fresh mount the button ref is only attached after
  // the first render.
  useEffect(() => {
    setAnchorEl(open ? buttonRef.current : null);
  }, [open]);

  const activePreset = presets.find(p => p.id === activePresetId) ?? null;
  const menuOpen = open && Boolean(anchorEl);

  const closeMenu = () => onOpenChange(false);

  const handleSelect = (id: string) => {
    if (id !== activePresetId) onSelect(id);
    closeMenu();
  };

  /**
   * 1-9 load the nth preset while the menu is open. The global keymap keeps
   * out of menus (see useKeyboardShortcuts), so these digits do not also
   * switch mode.
   */
  const handleMenuKeyDown = (event: React.KeyboardEvent) => {
    const index = Number(event.key) - 1;

    if (!Number.isInteger(index) || index < 0 || index >= Math.min(presets.length, 9)) {
      return;
    }
    event.preventDefault();
    handleSelect(presets[index].id);
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
        ref={buttonRef}
        size="small"
        onClick={() => onOpenChange(true)}
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
        {/* On a phone the bookmark and the chevron say "presets" on their own,
            and the ~70px the label costs is the difference between the toolbar
            fitting on one row and wrapping onto two. */}
        <Typography
          variant="body2"
          noWrap
          sx={{ maxWidth: { sm: 130 }, display: { xs: 'none', sm: 'block' } }}
        >
          {activePreset ? activePreset.name : 'Presets'}
        </Typography>
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={closeMenu}
        onKeyDown={handleMenuKeyDown}
        slotProps={{ paper: { sx: { minWidth: 220 } } }}
      >
        {presets.length === 0 ? (
          <MenuItem disabled>
            <ListItemText secondary="No saved presets" />
          </MenuItem>
        ) : (
          presets.map((p, index) => (
            <MenuItem
              key={p.id}
              selected={p.id === activePresetId}
              onClick={() => handleSelect(p.id)}
            >
              <ListItemIcon sx={{ minWidth: 32 }}>
                {p.id === activePresetId && <CheckIcon fontSize="small" />}
              </ListItemIcon>
              <ListItemText>{p.name}</ListItemText>
              {index < 9 && (
                <Typography variant="caption" sx={{ ml: 2, color: 'text.secondary' }}>
                  {index + 1}
                </Typography>
              )}
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
            onFocus={selectOnFocus}
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
