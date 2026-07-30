import {
  Add as AddIcon,
  ContentCopy as ContentCopyIcon,
  Delete as DeleteIcon,
  EditLocationAlt as EditLocationIcon,
  FileDownload as FileDownloadIcon
} from '@mui/icons-material';
import {
  Box,
  Button,
  Divider,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Radio,
  Select,
  Stack,
  TextField,
  ToggleButton,
  Tooltip,
  Typography
} from '@mui/material';
import React, { useEffect, useState } from 'react';

import { useCustomCourses } from '../hooks';
import { CourseParams, CourseType, LatLng, Target } from '../types';
import {
  BUILT_IN_PARAMS,
  buildCourse,
  courseTypeLabel,
  coursesForPlace,
  defaultCourseName,
  duplicateCourseParams,
  fromCourseRelative,
  getTargetRelativeToCourse
} from '../core/courses';
import { normalizeRelativeAngle } from '../core/validation';
import { downloadCourseKmz } from '../util/exportKmz';
import { AltitudeUnit } from '../core/units';

const M_PER_FT = 0.3048;

/** The three course types, in the order the New menu offers them. */
const COURSE_TYPES: readonly CourseType[] = ['distance', 'zone-accuracy', 'speed'];

function metersToDisplay(m: number, unit: AltitudeUnit): number {
  return unit === 'ft' ? m / M_PER_FT : m;
}

function displayToMeters(v: number, unit: AltitudeUnit): number {
  return unit === 'ft' ? v * M_PER_FT : v;
}

interface CoursesComponentProps {
  selectedCourseId: string | null;
  onSelect: (id: string | null) => void;
  target: Target;
  onTargetChange: (t: Target) => void;
  editOpen: boolean;
  onEditOpenChange: (open: boolean) => void;
  altitudeUnit: AltitudeUnit;
  /** KMZ export is nerd-only, like every other export. */
  showExport?: boolean;
  /**
   * The place the user is at. A course is a set of buoys in one pond, so the
   * list only offers the ones that belong here — and a new course is created
   * here. Null when the target belongs to no place (a geocoder hit).
   */
  placeId: string | null;
  /** That place's name, for the group header. */
  placeName: string | null;
}

function CoursesComponent({
  selectedCourseId,
  onSelect,
  target,
  onTargetChange,
  editOpen,
  onEditOpenChange,
  altitudeUnit,
  showExport = false,
  placeId,
  placeName
}: CoursesComponentProps) {
  const { customParams, createCourse, updateCourse, removeCourse } = useCustomCourses();

  const selectedCustom = customParams.find(c => c.id === selectedCourseId) ?? null;
  const selectedBuiltIn = BUILT_IN_PARAMS.find(c => c.id === selectedCourseId) ?? null;
  // Unified course params for the Target section (works for both custom and built-in)
  const selectedCourseParams: CourseParams | null = selectedBuiltIn ?? selectedCustom;

  // Custom courses first within each group, as before: the user's own work is
  // what they came here for. `elsewhere` normally holds nothing — choosing a
  // place drops a selection that belongs to another one — but a preset can
  // still name a course from somewhere else, and it has to stay renderable.
  const custom = coursesForPlace(customParams, placeId, selectedCourseId);
  const builtIn = coursesForPlace(BUILT_IN_PARAMS, placeId, selectedCourseId);
  const atPlace = [...custom.atPlace, ...builtIn.atPlace];
  const unassigned = [...custom.unassigned, ...builtIn.unassigned];
  const elsewhere = [...custom.elsewhere, ...builtIn.elsewhere];
  const hasAny = atPlace.length + unassigned.length + elsewhere.length > 0;

  // ── Target-relative section ──────────────────────────────────────────────────
  const [depthStr, setDepthStr] = useState('0');
  const [offsetStr, setOffsetStr] = useState('0');
  const [dirStr, setDirStr] = useState('0');

  useEffect(() => {
    if (!selectedCourseParams) return;
    const center: LatLng = { lat: selectedCourseParams.lat, lng: selectedCourseParams.lng };
    const rel = getTargetRelativeToCourse(target.target, center, selectedCourseParams.direction);
    const toDisp = (m: number) => metersToDisplay(m, altitudeUnit);
    setDepthStr(String(Math.round(toDisp(rel.depth) * 10) / 10));
    setOffsetStr(String(Math.round(toDisp(rel.offset) * 10) / 10));
    // Folded to (-180, 180]: a plain subtraction reads "-270" for what is
    // really 90 degrees the other way, which is what the UX pass flagged.
    const approachAngle = normalizeRelativeAngle(
      selectedCourseParams.direction - target.finalHeading
    );
    setDirStr(String(Math.round(approachAngle)));
  // Re-sync when the selected course changes OR when the course is moved/rotated.
  // Deliberately excludes target changes to avoid feedback loops.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourseId, selectedCourseParams?.lat, selectedCourseParams?.lng, selectedCourseParams?.direction, altitudeUnit]);

  const handleDepth = (e: React.ChangeEvent<HTMLInputElement>) => {
    const s = e.target.value;
    setDepthStr(s);
    const v = parseFloat(s);
    if (isNaN(v) || !selectedCourseParams) return;
    const center: LatLng = { lat: selectedCourseParams.lat, lng: selectedCourseParams.lng };
    const off = parseFloat(offsetStr);
    const depM = displayToMeters(v, altitudeUnit);
    const offM = displayToMeters(isNaN(off) ? 0 : off, altitudeUnit);
    onTargetChange({ ...target, target: fromCourseRelative(depM, offM, center, selectedCourseParams.direction) });
  };

  const handleOffset = (e: React.ChangeEvent<HTMLInputElement>) => {
    const s = e.target.value;
    setOffsetStr(s);
    const v = parseFloat(s);
    if (isNaN(v) || !selectedCourseParams) return;
    const center: LatLng = { lat: selectedCourseParams.lat, lng: selectedCourseParams.lng };
    const dep = parseFloat(depthStr);
    const depM = displayToMeters(isNaN(dep) ? 0 : dep, altitudeUnit);
    const offM = displayToMeters(v, altitudeUnit);
    onTargetChange({ ...target, target: fromCourseRelative(depM, offM, center, selectedCourseParams.direction) });
  };

  const handleApproachAngle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const s = e.target.value;
    setDirStr(s);
    const v = parseFloat(s);
    if (isNaN(v) || !selectedCourseParams) return;
    const finalHeading = ((selectedCourseParams.direction - v) % 360 + 360) % 360;
    onTargetChange({ ...target, finalHeading });
  };

  // ── Custom-course edit section ───────────────────────────────────────────────
  const [editName, setEditName] = useState('');
  const [editLat, setEditLat] = useState('');
  const [editLng, setEditLng] = useState('');
  const [editCourseDir, setEditCourseDir] = useState('');
  const dirFocusedRef = React.useRef(false);
  const latFocusedRef = React.useRef(false);
  const lngFocusedRef = React.useRef(false);

  useEffect(() => {
    if (selectedCustom) {
      setEditName(selectedCustom.name);
      setEditLat(String(selectedCustom.lat));
      setEditLng(String(selectedCustom.lng));
      setEditCourseDir(String(selectedCustom.direction));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustom?.id]);

  // Sync lat/lng/direction from external changes (e.g. map drag) but not while typing
  useEffect(() => {
    if (selectedCustom && !latFocusedRef.current) setEditLat(String(selectedCustom.lat));
  }, [selectedCustom?.lat]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedCustom && !lngFocusedRef.current) setEditLng(String(selectedCustom.lng));
  }, [selectedCustom?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedCustom && !dirFocusedRef.current) {
      setEditCourseDir(String(Math.round(selectedCustom.direction * 1000) / 1000));
    }
  }, [selectedCustom?.direction]); // eslint-disable-line react-hooks/exhaustive-deps

  const commitName = () => {
    const v = editName.trim();
    if (selectedCustom && v) updateCourse(selectedCustom.id, { name: v });
  };
  const commitLat = () => {
    const v = parseFloat(editLat);
    if (selectedCustom && !isNaN(v)) updateCourse(selectedCustom.id, { lat: v });
  };
  const commitLng = () => {
    const v = parseFloat(editLng);
    if (selectedCustom && !isNaN(v)) updateCourse(selectedCustom.id, { lng: v });
  };
  const commitCourseDir = () => {
    const v = parseFloat(editCourseDir);
    if (selectedCustom && !isNaN(v)) {
      const n = ((v % 360) + 360) % 360;
      updateCourse(selectedCustom.id, { direction: n });
      setEditCourseDir(String(Math.round(n * 1000) / 1000));
    }
  };

  // ── Shared actions ───────────────────────────────────────────────────────────
  const handleDuplicate = (params: CourseParams) => {
    onSelect(createCourse(duplicateCourseParams(params)));
    // A copy sits exactly on top of its original, so it needs moving.
    onEditOpenChange(true);
  };

  // "New" asks for the type first: it is the first real decision, and it used
  // to be two levels down inside Edit behind a generic "New Course".
  const [newMenuAnchor, setNewMenuAnchor] = useState<HTMLElement | null>(null);

  const handleNew = (type: CourseType) => {
    setNewMenuAnchor(null);
    const newId = createCourse({
      name: defaultCourseName(type, [...atPlace, ...unassigned].map(c => c.name)),
      type,
      lat: target.target.lat,
      lng: target.target.lng,
      // The target's final heading, not 0: a course laid out due north
      // through the target is never what anyone means, and courses are
      // normally set into the prevailing wind — which is what the heading
      // already tracks.
      direction: target.finalHeading,
      ...(type === 'speed' ? { carveDirection: 'left' as const } : {}),
      // Undefined with no place active, which is what "belongs nowhere" is
      // stored as — such a course is then offered at every dropzone.
      placeId: placeId ?? undefined
    });
    onSelect(newId);
    // A new course is unpositioned by definition, so open the editor with it.
    onEditOpenChange(true);
  };

  const handleDelete = (id: string) => {
    removeCourse(id);
    if (id === selectedCourseId) {
      onSelect(null);
    }
  };

  // Positioning is a mode, so it must not survive a change of course: leaving
  // it on would hand the next course's handles the map without being asked.
  const handleSelect = (id: string | null) => {
    if (id !== selectedCourseId) {
      onEditOpenChange(false);
    }
    onSelect(id);
  };

  /**
   * The selected course's own controls, shown under its row rather than in a
   * section below — with the list this short, a detail panel further down
   * made you look away from the thing you had just picked.
   */
  const courseDetails = (params: CourseParams, isCustom: boolean) => (
    <Box sx={{ px: 1.5, pb: 1.5, pt: 0.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {isCustom && (
        <>
          {/* An explicit mode: the course handles land on top of the target's
              (a course centre is usually metres from where you land), so the
              target stops being draggable while this is on. */}
          <ToggleButton
            value="edit"
            size="small"
            selected={editOpen}
            onChange={() => onEditOpenChange(!editOpen)}
            color="primary"
            sx={{ textTransform: 'none' }}
          >
            <EditLocationIcon sx={{ fontSize: 18, mr: 0.75 }} />
            {editOpen ? 'Done positioning' : 'Position on map'}
          </ToggleButton>

          {editOpen && (
            <Typography variant="caption" color="text.secondary">
              Drag the course to move it, or its handle to rotate. The target
              stays put until you are done.
            </Typography>
          )}

          <TextField
            label="Name"
            size="small"
            fullWidth
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onBlur={commitName}
            onKeyDown={e => { if (e.key === 'Enter') commitName(); }}
          />

          <Stack direction="row" spacing={1}>
            <FormControl size="small" sx={{ flex: 1 }}>
              <InputLabel>Type</InputLabel>
              <Select
                value={params.type}
                label="Type"
                onChange={e => {
                  const t = e.target.value as CourseType;
                  updateCourse(params.id, {
                    type: t,
                    ...(t === 'speed' && !params.carveDirection ? { carveDirection: 'left' } : {})
                  });
                }}
              >
                {COURSE_TYPES.map(type => (
                  <MenuItem key={type} value={type}>{courseTypeLabel(type)}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {params.type === 'speed' && (
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>Carve</InputLabel>
                <Select
                  value={params.carveDirection ?? 'left'}
                  label="Carve"
                  onChange={e => updateCourse(params.id, { carveDirection: e.target.value as 'left' | 'right' })}
                >
                  <MenuItem value="left">Left</MenuItem>
                  <MenuItem value="right">Right</MenuItem>
                </Select>
              </FormControl>
            )}
          </Stack>

          <Stack direction="row" spacing={1}>
            <TextField
              label="Lat"
              size="small"
              value={editLat}
              onChange={e => setEditLat(e.target.value)}
              onFocus={() => { latFocusedRef.current = true; }}
              onBlur={() => { latFocusedRef.current = false; commitLat(); }}
              onKeyDown={e => { if (e.key === 'Enter') commitLat(); }}
              sx={{ flex: 1 }}
            />
            <TextField
              label="Lng"
              size="small"
              value={editLng}
              onChange={e => setEditLng(e.target.value)}
              onFocus={() => { lngFocusedRef.current = true; }}
              onBlur={() => { lngFocusedRef.current = false; commitLng(); }}
              onKeyDown={e => { if (e.key === 'Enter') commitLng(); }}
              sx={{ flex: 1 }}
            />
          </Stack>

          <TextField
            label="Direction"
            size="small"
            fullWidth
            value={editCourseDir}
            onChange={e => {
              const s = e.target.value;
              setEditCourseDir(s);
              const v = parseFloat(s);
              if (!isNaN(v)) updateCourse(params.id, { direction: v });
            }}
            onFocus={() => { dirFocusedRef.current = true; }}
            onBlur={() => { dirFocusedRef.current = false; commitCourseDir(); }}
            onKeyDown={e => { if (e.key === 'Enter') commitCourseDir(); }}
            slotProps={{
              input: { endAdornment: <InputAdornment position="end">°</InputAdornment> },
              htmlInput: { type: 'number', step: 0.1 }
            }}
          />
        </>
      )}

      {showExport && (
        <Button
          size="small"
          startIcon={<FileDownloadIcon />}
          onClick={() => downloadCourseKmz(buildCourse(params))}
          sx={{ alignSelf: 'flex-start' }}
        >
          Export KMZ
        </Button>
      )}
    </Box>
  );

  // One row per course. The actions live here rather than inside a dropdown,
  // where Duplicate was only reachable while the menu happened to be open.
  const courseRow = (params: CourseParams) => {
    const isCustom = customParams.some(c => c.id === params.id);
    const isSelected = params.id === selectedCourseId;
    // Built-in courses are named for their type, so the caption would just
    // repeat the name; custom ones are called whatever the user chose.
    const typeCaption = params.name === courseTypeLabel(params.type)
      ? null
      : courseTypeLabel(params.type);

    return (
      <React.Fragment key={params.id}>
        <ListItem
          disablePadding
          secondaryAction={
            <Stack direction="row" spacing={0.25}>
              <Tooltip title="Duplicate">
                <IconButton size="small" edge="end" onClick={() => handleDuplicate(params)}>
                  <ContentCopyIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </Tooltip>
              {isCustom && (
                <Tooltip title="Delete">
                  <IconButton size="small" edge="end" onClick={() => handleDelete(params.id)}>
                    <DeleteIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          }
        >
          <ListItemButton
            dense
            selected={isSelected}
            onClick={() => handleSelect(params.id)}
            sx={{ py: 0.25 }}
          >
            <Radio
              size="small"
              checked={isSelected}
              tabIndex={-1}
              disableRipple
              sx={{ p: 0.5, mr: 0.5 }}
            />
            <ListItemText
              primary={params.name}
              secondary={typeCaption}
              slotProps={{
                primary: { variant: 'body2', noWrap: true },
                secondary: { variant: 'caption' }
              }}
            />
          </ListItemButton>
        </ListItem>
        {/* A built-in course with nothing exportable has no details at all;
            rendering the block anyway left an unexplained gap under its row. */}
        {isSelected && (isCustom || showExport) && courseDetails(params, isCustom)}
      </React.Fragment>
    );
  };

  const groupHeader = (text: string) => (
    <Typography
      variant="caption"
      color="text.secondary"
      sx={{ display: 'block', px: 1, pt: 1, pb: 0.25 }}
    >
      {text}
    </Typography>
  );

  return (
    <>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="h6">Courses</Typography>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={e => setNewMenuAnchor(e.currentTarget)}
        >
          New
        </Button>
        <Menu
          anchorEl={newMenuAnchor}
          open={newMenuAnchor !== null}
          onClose={() => setNewMenuAnchor(null)}
        >
          {COURSE_TYPES.map(type => (
            <MenuItem key={type} onClick={() => handleNew(type)}>
              {courseTypeLabel(type)}
            </MenuItem>
          ))}
        </Menu>
      </Stack>

      {/* ── Course selector: a radio list, not a dropdown. There are only ever
          a handful at one dropzone, so showing them all costs less than the
          two clicks a Select needs to reveal the same thing. ── */}
      <List dense disablePadding sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
        <ListItem disablePadding>
          <ListItemButton
            dense
            selected={selectedCourseId === null}
            onClick={() => handleSelect(null)}
            sx={{ py: 0.25 }}
          >
            <Radio
              size="small"
              checked={selectedCourseId === null}
              tabIndex={-1}
              disableRipple
              sx={{ p: 0.5, mr: 0.5 }}
            />
            <ListItemText
              primary={<em>None</em>}
              slotProps={{ primary: { variant: 'body2' } }}
            />
          </ListItemButton>
        </ListItem>

        {atPlace.length > 0 && groupHeader(placeName ?? 'Here')}
        {atPlace.map(courseRow)}

        {unassigned.length > 0 && groupHeader('Not at a dropzone')}
        {unassigned.map(courseRow)}

        {elsewhere.length > 0 && groupHeader('From another dropzone')}
        {elsewhere.map(courseRow)}
      </List>

      {/* Courses are per-dropzone, so an empty list is normal and needs
          saying — otherwise it reads as the panel being broken. */}
      {!hasAny && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          {placeName
            ? `No courses at ${placeName}. "New" adds one here.`
            : 'Courses belong to a dropzone. Pick one in the Target panel, or add a course here and it will be offered everywhere.'}
        </Typography>
      )}

      {/* ── Relative position (all courses) ── */}
      {selectedCourseParams && (
        <>
          <Divider sx={{ my: 2 }} />
          <Tooltip title="Your turn position relative to the course">
            <Typography variant="subtitle1" gutterBottom sx={{ display: 'inline-block' }}>
              Relative Position
            </Typography>
          </Tooltip>
          {/* One field per line: three side by side wrapped unpredictably in a
              narrow panel, and the labels are too long to read at a glance. */}
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Tooltip title="Distance back from the course centre along the course axis. Positive is away from the course, in the direction you fly it from.">
              <TextField
                label="Depth"
                size="small"
                fullWidth
                value={depthStr}
                onChange={handleDepth}
                slotProps={{
                  input: { endAdornment: <InputAdornment position="end">{altitudeUnit}</InputAdornment> },
                  htmlInput: { type: 'number', step: altitudeUnit === 'ft' ? 1 : 0.5 }
                }}
              />
            </Tooltip>

            <Tooltip title="Distance across the course from its centreline. Positive is to the right of the course direction.">
              <TextField
                label="Offset"
                size="small"
                fullWidth
                value={offsetStr}
                onChange={handleOffset}
                slotProps={{
                  input: { endAdornment: <InputAdornment position="end">{altitudeUnit}</InputAdornment> },
                  htmlInput: { type: 'number', step: altitudeUnit === 'ft' ? 1 : 0.5 }
                }}
              />
            </Tooltip>

            <Tooltip title="How far your final heading is turned from the course direction. 0 flies straight down the course; positive means the course runs to the right of your approach.">
              <TextField
                label="Approach Angle"
                size="small"
                fullWidth
                value={dirStr}
                onChange={handleApproachAngle}
                slotProps={{
                  input: { endAdornment: <InputAdornment position="end">°</InputAdornment> },
                  htmlInput: { type: 'number', step: 0.5 }
                }}
              />
            </Tooltip>
          </Stack>
        </>
      )}

    </>
  );
}

export default CoursesComponent;
