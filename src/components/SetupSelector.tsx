import {
  Add as AddIcon,
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
  Check as CheckIcon,
  ContentCopy as CopyIcon,
  KeyboardArrowDown as ArrowDownIcon,
  Save as SaveIcon,
  Tune as ManageIcon,
  Undo as UndoIcon
} from '@mui/icons-material';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  Divider,
  FormControlLabel,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Snackbar,
  Switch,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { BUILT_IN_PARAMS } from '../core/courses';
import { placeNameFromId } from '../core/places';
import {
  describeSetup,
  describeSetupDiff,
  groupSetups
} from '../core/setups';
import { useCustomCourses } from '../hooks/useCustomCourses';
import { UseSetupsResult } from '../hooks/useSetups';
import { ModeId, getMode } from '../modes';
import samples from '../samples';
import { CourseParams, Setup } from '../types';

import DisclosureRow from './DisclosureRow';
import SetupManagerDialog from './SetupManagerDialog';
import selectOnFocus from './selectOnFocus';

interface SetupSelectorProps {
  setups: UseSetupsResult;
  activeModeId: ModeId;
  placeId: string | null;
  placeName: string | null;
  /**
   * Whether the menu is open. Owned by App so the `S` shortcut can open it.
   * Controlled rather than signalled: Toolpad re-creates the toolbar slot on
   * every render, so this component remounts constantly, and any "open once"
   * trigger held in local state or an effect would re-fire on each remount.
   */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SetupSelector({
  setups,
  activeModeId,
  placeId,
  placeName,
  open,
  onOpenChange
}: SetupSelectorProps) {
  const {
    setups: all,
    activeSetup,
    awaySetup,
    copyCandidate,
    dirty,
    diff,
    copyCourse,
    createSetup,
    copySetupHere,
    saveChanges,
    discardChanges,
    loadSetup,
    undoLoad,
    detach
  } = setups;

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [showElsewhere, setShowElsewhere] = useState(false);
  const [snackbar, setSnackbar] = useState<{ text: string; undo: boolean } | null>(null);

  // Anchor follows the controlled flag. Done in an effect rather than at
  // render because on a fresh mount the button ref is only attached after
  // the first render.
  useEffect(() => {
    setAnchorEl(open ? buttonRef.current : null);
  }, [open]);

  const menuOpen = open && Boolean(anchorEl);
  const closeMenu = () => onOpenChange(false);

  const { customParams } = useCustomCourses();
  const courseById = useMemo(() => {
    const map = new Map<string, CourseParams>();

    [...customParams, ...BUILT_IN_PARAMS].forEach(course => map.set(course.id, course));

    return map;
  }, [customParams]);
  // Five conversions, once: a sample's rotation is measured off its path.
  const samplePaths = useMemo(() => samples.map(sample => sample.getPath()), []);

  /**
   * `withPlace` names the setup's dropzone in the line — for the lists whose
   * own heading does not, which is "Other dropzones" here and the manage
   * dialog, which has no headings at all. Under "At <place>" it would repeat
   * that heading on every row.
   */
  const chipsFor = (setup: Setup, withPlace = false) =>
    describeSetup(setup, {
      course: setup.site?.selectedCourseId
        ? courseById.get(setup.site.selectedCourseId) ?? null
        : null,
      samplePath: setup.manoeuvre.type === 'samples'
        ? samplePaths[setup.manoeuvre.sampleIndex ?? 0] ?? null
        : null,
      activeModeId,
      modeLabel: id => getMode(id as ModeId).label,
      place: withPlace && setup.site ? placeNameFromId(setup.site.placeId) : null,
      shortCourse: true
    });

  const grouped = useMemo(() => groupSetups(all, placeId), [all, placeId]);
  const hereLabel = placeName ? `At ${placeName}` : 'Here';
  // The digits address what is on screen, in the order it is on screen.
  const numbered = useMemo(
    () => [
      ...grouped.here,
      ...grouped.anywhere,
      ...showElsewhere ? grouped.elsewhere : []
    ],
    [grouped, showElsewhere]
  );

  const handleSelect = (id: string) => {
    const setup = all.find(s => s.id === id);

    loadSetup(id);
    closeMenu();
    // Unsaved changes were just discarded; say so rather than let them
    // vanish quietly.
    setSnackbar({ text: `Loaded “${setup?.name ?? ''}”`, undo: true });
  };

  /**
   * 1-9 load the nth setup while the menu is open. The global keymap keeps
   * out of menus (see useKeyboardShortcuts), so these digits do not also
   * switch mode.
   */
  const handleMenuKeyDown = (event: React.KeyboardEvent) => {
    const index = Number(event.key) - 1;

    if (!Number.isInteger(index) || index < 0 || index >= Math.min(numbered.length, 9)) {
      return;
    }
    event.preventDefault();
    handleSelect(numbered[index].id);
  };

  const handleSave = () => {
    saveChanges();
    closeMenu();
    setSnackbar({ text: `“${activeSetup?.name ?? ''}” saved`, undo: false });
  };

  const handleDiscard = () => {
    discardChanges();
    closeMenu();
    setSnackbar({ text: `“${activeSetup?.name ?? ''}” restored`, undo: false });
  };

  const handleDetach = () => {
    detach();
    closeMenu();
  };

  const rowFor = (setup: Setup, withPlace = false) => {
    const index = numbered.indexOf(setup);
    const chips = chipsFor(setup, withPlace);

    return (
      <MenuItem
        key={setup.id}
        selected={setup.id === setups.activeSetupId}
        onClick={() => handleSelect(setup.id)}
      >
        <ListItemIcon sx={{ minWidth: 32 }}>
          {setup.id === setups.activeSetupId && <CheckIcon fontSize="small" />}
        </ListItemIcon>
        <ListItemText
          primary={setup.name}
          secondary={chips.length > 0 ? chips.join(' · ') : undefined}
          slotProps={{ secondary: { variant: 'caption' } }}
        />
        {index >= 0 && index < 9 && (
          <Typography variant="caption" sx={{ ml: 2, color: 'text.secondary' }}>
            {index + 1}
          </Typography>
        )}
      </MenuItem>
    );
  };

  const copyLabel = placeName ? `Copy to ${placeName}…` : 'Copy to here…';
  // The button still names the setup you are on when it does not apply here —
  // saying "Setups" would read as nothing being loaded.
  const shown = activeSetup ?? awaySetup;
  const awayNote = awaySetup
    ? awaySetup.site && awaySetup.site.placeId !== placeId
      ? `${awaySetup.name} — saved at another dropzone`
      : `${awaySetup.name} — saved in another mode`
    : null;

  return (
    <>
      <Tooltip
        title={
          awayNote ??
            (activeSetup
              ? dirty
                ? `${activeSetup.name} — unsaved ${describeSetupDiff(diff)}`
                : activeSetup.name
              : 'Setups')
        }
      >
        <Button
          ref={buttonRef}
          size="small"
          onClick={() => onOpenChange(true)}
          startIcon={
            shown ? <BookmarkIcon fontSize="small" /> : <BookmarkBorderIcon fontSize="small" />
          }
          endIcon={<ArrowDownIcon fontSize="small" />}
          variant={shown ? 'outlined' : 'text'}
          color="inherit"
          sx={{ textTransform: 'none', minWidth: 0 }}
        >
          {/* On a phone the bookmark and the chevron say "setups" on their own,
              and the ~70px the label costs is the difference between the toolbar
              fitting on one row and wrapping onto two. */}
          <Typography
            variant="body2"
            noWrap
            sx={{ maxWidth: { sm: 130 }, display: { xs: 'none', sm: 'block' } }}
          >
            {shown ? shown.name : 'Setups'}
          </Typography>
          {/* The dot is the whole "this needs saving" signal, and it survives
              the label being hidden at 375px. */}
          {dirty && (
            <Box
              component="span"
              aria-label="unsaved changes"
              sx={{
                width: 8,
                height: 8,
                ml: 0.5,
                borderRadius: '50%',
                bgcolor: 'warning.main',
                flexShrink: 0
              }}
            />
          )}
        </Button>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={closeMenu}
        onKeyDown={handleMenuKeyDown}
        // Two-line rows, three group headings and six actions overflow a
        // laptop screen well before anyone has an unreasonable number of
        // setups, and MUI will not scroll a popover it was not told to.
        slotProps={{ paper: { sx: { minWidth: 260, maxWidth: 340, maxHeight: '80vh' } } }}
      >
        {all.length === 0 && (
          <MenuItem disabled>
            <ListItemText secondary="No saved setups" />
          </MenuItem>
        )}

        {grouped.here.length > 0 && (
          <ListSubheader sx={{ lineHeight: 2, bgcolor: 'transparent' }}>
            {hereLabel}
          </ListSubheader>
        )}
        {grouped.here.map(setup => rowFor(setup))}

        {grouped.anywhere.length > 0 && (
          <ListSubheader sx={{ lineHeight: 2, bgcolor: 'transparent' }}>
            Anywhere
          </ListSubheader>
        )}
        {grouped.anywhere.map(setup => rowFor(setup))}

        {grouped.elsewhere.length > 0 && (
          <Box sx={{ px: 2, py: 0.5 }}>
            <DisclosureRow
              label={`Other dropzones (${grouped.elsewhere.length})`}
              open={showElsewhere}
              onToggle={() => setShowElsewhere(v => !v)}
            />
          </Box>
        )}
        {showElsewhere && grouped.elsewhere.map(setup => rowFor(setup, true))}

        <Divider />

        {activeSetup && dirty && (
          <MenuItem onClick={handleSave}>
            <ListItemIcon sx={{ minWidth: 32 }}>
              <SaveIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="Save changes"
              secondary={describeSetupDiff(diff)}
              slotProps={{ secondary: { variant: 'caption' } }}
            />
          </MenuItem>
        )}

        {activeSetup && dirty && (
          <MenuItem onClick={handleDiscard}>
            <ListItemIcon sx={{ minWidth: 32 }}>
              <UndoIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Discard changes" />
          </MenuItem>
        )}

        <MenuItem
          onClick={() => {
            closeMenu();
            setSaveDialogOpen(true);
          }}
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            <AddIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Save as new setup…" />
        </MenuItem>

        {copyCandidate && (
          <MenuItem
            onClick={() => {
              closeMenu();
              setCopyDialogOpen(true);
            }}
          >
            <ListItemIcon sx={{ minWidth: 32 }}>
              <CopyIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={copyLabel} />
          </MenuItem>
        )}

        {setups.activeSetupId !== null && (
          <MenuItem onClick={handleDetach}>
            <ListItemIcon sx={{ minWidth: 32 }}>
              <BookmarkBorderIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Work without a setup" />
          </MenuItem>
        )}

        <MenuItem
          onClick={() => {
            closeMenu();
            setManageOpen(true);
          }}
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            <ManageIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Manage setups…" />
        </MenuItem>
      </Menu>

      <SaveSetupDialog
        open={saveDialogOpen}
        placeName={placeName}
        defaultCanopy={shown?.canopy ?? ''}
        onClose={() => setSaveDialogOpen(false)}
        onSave={draft => {
          createSetup(draft);
          setSaveDialogOpen(false);
        }}
      />

      <CopySetupDialog
        open={copyDialogOpen}
        setup={copyCandidate}
        placeName={placeName}
        course={copyCourse}
        onClose={() => setCopyDialogOpen(false)}
        onCopy={draft => {
          if (copyCandidate) copySetupHere(copyCandidate.id, draft);
          setCopyDialogOpen(false);
        }}
      />

      <SetupManagerDialog
        open={manageOpen}
        setups={setups}
        placeName={placeName}
        chipsFor={setup => chipsFor(setup, true)}
        onClose={() => setManageOpen(false)}
      />

      <Snackbar
        open={snackbar !== null}
        autoHideDuration={5000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        message={snackbar?.text}
        action={
          snackbar?.undo
            ? (
              <Button
                color="inherit"
                size="small"
                onClick={() => {
                  undoLoad();
                  setSnackbar(null);
                }}
              >
                Undo
              </Button>
            )
            : undefined
        }
      />
    </>
  );
}

interface SaveSetupDialogProps {
  open: boolean;
  placeName: string | null;
  defaultCanopy: string;
  onClose: () => void;
  onSave: (draft: { name: string; canopy?: string; includeSite: boolean }) => void;
}

function SaveSetupDialog({
  open,
  placeName,
  defaultCanopy,
  onClose,
  onSave
}: SaveSetupDialogProps) {
  const [name, setName] = useState('');
  const [canopy, setCanopy] = useState('');
  const [includeSite, setIncludeSite] = useState(true);

  // The dialog is mounted permanently, so its fields are reset on each open
  // rather than by remounting.
  useEffect(() => {
    if (open) {
      setName('');
      setCanopy(defaultCanopy);
      setIncludeSite(true);
    }
  }, [open, defaultCanopy]);

  const confirm = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      canopy: canopy.trim() || undefined,
      includeSite
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogContent sx={{ pt: 3 }}>
        <TextField
          autoFocus
          margin="dense"
          label="Setup name"
          fullWidth
          size="small"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && confirm()}
        />
        <TextField
          margin="dense"
          label="Canopy"
          placeholder="SAW 75"
          fullWidth
          size="small"
          value={canopy}
          onChange={e => setCanopy(e.target.value)}
          onFocus={selectOnFocus}
          onKeyDown={e => e.key === 'Enter' && confirm()}
        />
        <FormControlLabel
          sx={{ mt: 1 }}
          control={
            <Switch
              checked={includeSite}
              onChange={e => setIncludeSite(e.target.checked)}
              size="small"
            />
          }
          label={
            <Typography variant="body2">
              {includeSite
                ? `Remember the target${placeName ? ` at ${placeName}` : ''}`
                : 'Canopy and turn only — works at any dropzone'}
            </Typography>
          }
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={confirm} disabled={!name.trim()} variant="contained">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

interface CopySetupDialogProps {
  open: boolean;
  setup: Setup | null;
  placeName: string | null;
  course: CourseParams | null;
  onClose: () => void;
  onCopy: (draft: { name: string; relative: boolean }) => void;
}

function CopySetupDialog({
  open,
  setup,
  placeName,
  course,
  onClose,
  onCopy
}: CopySetupDialogProps) {
  const [name, setName] = useState('');
  const [relative, setRelative] = useState(true);

  // The original's name, not a mashup of it and the new dropzone's: the field
  // is focused and its contents selected, so one keystroke replaces it, and
  // "Skydive Arizona ZHills Distance" is not a name anyone would keep.
  useEffect(() => {
    if (open) {
      setName(setup?.name ?? '');
      setRelative(true);
    }
  }, [open, setup]);

  const confirm = () => {
    if (!name.trim()) return;
    onCopy({ name: name.trim(), relative });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogContent sx={{ pt: 3 }}>
        <DialogContentText variant="body2" sx={{ mb: 1 }}>
          A copy of “{setup?.name}”{placeName ? ` at ${placeName}` : ''}.
        </DialogContentText>
        <TextField
          autoFocus
          margin="dense"
          label="Setup name"
          fullWidth
          size="small"
          value={name}
          onChange={e => setName(e.target.value)}
          onFocus={selectOnFocus}
          onKeyDown={e => e.key === 'Enter' && confirm()}
        />
        {course && (
          <FormControlLabel
            sx={{ mt: 1 }}
            control={
              <Switch
                checked={relative}
                onChange={e => setRelative(e.target.checked)}
                size="small"
              />
            }
            label={
              <Typography variant="body2">
                {relative
                  ? `Position it against ${course.name}`
                  : 'Use the target as it is now'}
              </Typography>
            }
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={confirm} disabled={!name.trim()} variant="contained">
          Copy
        </Button>
      </DialogActions>
    </Dialog>
  );
}
