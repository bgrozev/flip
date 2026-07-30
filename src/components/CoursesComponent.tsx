import {
  Add as AddIcon,
  ContentCopy as ContentCopyIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  FileDownload as FileDownloadIcon
} from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
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
  OutlinedInput,
  Radio,
  Select,
  Stack,
  TextField,
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

  // One row per course. The actions live here rather than inside a dropdown,
  // where Duplicate was only reachable while the menu happened to be open.
  const courseRow = (params: CourseParams) => {
    const isCustom = customParams.some(c => c.id === params.id);
    // Built-in courses are named for their type, so the caption would just
    // repeat the name; custom ones are called whatever the user chose.
    const typeCaption = params.name === courseTypeLabel(params.type)
      ? null
      : courseTypeLabel(params.type);

    return (
      <ListItem
        key={params.id}
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
          selected={params.id === selectedCourseId}
          onClick={() => onSelect(params.id)}
          sx={{ py: 0.25 }}
        >
          <Radio
            size="small"
            checked={params.id === selectedCourseId}
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

  const inputSx = { width: '11ch' };

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
            onClick={() => onSelect(null)}
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

      {/* ── Course actions ── */}
      {selectedCourseParams && showExport && (
        <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1 }}>
          <Button
            size="small"
            startIcon={<FileDownloadIcon />}
            onClick={() => downloadCourseKmz(buildCourse(selectedCourseParams))}
          >
            Export KMZ
          </Button>
        </Stack>
      )}

      {/* ── Target-relative section (all courses) ── */}
      {selectedCourseParams && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle1" gutterBottom>Target</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            Where you land, measured from the course.
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0 }}>
            <Tooltip title="Distance back from the course centre along the course axis. Positive is away from the course, in the direction you fly it from.">
              <FormControl sx={{ m: 1, ...inputSx }} variant="outlined" size="small">
                <OutlinedInput
                  value={depthStr}
                  onChange={handleDepth}
                  type="number"
                  endAdornment={<InputAdornment position="end">{altitudeUnit}</InputAdornment>}
                  inputProps={{ step: altitudeUnit === 'ft' ? 1 : 0.5 }}
                />
                <Box component="span" sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.5, ml: 0.5 }}>
                  Depth
                </Box>
              </FormControl>
            </Tooltip>

            <Tooltip title="Distance across the course from its centreline. Positive is to the right of the course direction.">
              <FormControl sx={{ m: 1, ...inputSx }} variant="outlined" size="small">
                <OutlinedInput
                  value={offsetStr}
                  onChange={handleOffset}
                  type="number"
                  endAdornment={<InputAdornment position="end">{altitudeUnit}</InputAdornment>}
                  inputProps={{ step: altitudeUnit === 'ft' ? 1 : 0.5 }}
                />
                <Box component="span" sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.5, ml: 0.5 }}>
                  Offset
                </Box>
              </FormControl>
            </Tooltip>

            <Tooltip title="How far your final heading is turned from the course direction. 0 flies straight down the course; positive means the course runs to the right of your approach.">
              <FormControl sx={{ m: 1, ...inputSx }} variant="outlined" size="small">
                <OutlinedInput
                  value={dirStr}
                  onChange={handleApproachAngle}
                  type="number"
                  endAdornment={<InputAdornment position="end">°</InputAdornment>}
                  inputProps={{ step: 0.5 }}
                />
                <Box component="span" sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.5, ml: 0.5 }}>
                  Approach Angle
                </Box>
              </FormControl>
            </Tooltip>
          </Box>
        </>
      )}

      {/* ── Edit section (custom courses only, collapsible). Titled with the
          course name: "Edit" said nothing about which course it edits, and
          the panel can show several. ── */}
      {selectedCustom && (
        <Accordion
          expanded={editOpen}
          onChange={(_, isExpanded) => onEditOpenChange(isExpanded)}
          disableGutters
          elevation={0}
          sx={{ mt: 1, '&:before': { display: 'none' }, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 36, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
            <Typography variant="subtitle2" noWrap>{selectedCustom.name}</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0, pb: 1.5, px: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>

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
                  value={selectedCustom.type}
                  label="Type"
                  onChange={e => {
                    const t = e.target.value as CourseType;
                    updateCourse(selectedCustom.id, {
                      type: t,
                      ...(t === 'speed' && !selectedCustom.carveDirection ? { carveDirection: 'left' } : {})
                    });
                  }}
                >
                  {COURSE_TYPES.map(type => (
                    <MenuItem key={type} value={type}>{courseTypeLabel(type)}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              {selectedCustom.type === 'speed' && (
                <FormControl size="small" sx={{ flex: 1 }}>
                  <InputLabel>Carve</InputLabel>
                  <Select
                    value={selectedCustom.carveDirection ?? 'left'}
                    label="Carve"
                    onChange={e => updateCourse(selectedCustom.id, { carveDirection: e.target.value as 'left' | 'right' })}
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

            <FormControl variant="outlined" size="small" fullWidth>
              <OutlinedInput
                value={editCourseDir}
                onChange={e => {
                  const s = e.target.value;
                  setEditCourseDir(s);
                  const v = parseFloat(s);
                  if (!isNaN(v) && selectedCustom) updateCourse(selectedCustom.id, { direction: v });
                }}
                onFocus={() => { dirFocusedRef.current = true; }}
                onBlur={() => { dirFocusedRef.current = false; commitCourseDir(); }}
                onKeyDown={e => { if (e.key === 'Enter') commitCourseDir(); }}
                endAdornment={<InputAdornment position="end">°</InputAdornment>}
                inputProps={{ type: 'number', step: 0.1 }}
              />
              <Box component="span" sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.5 }}>
                Direction
              </Box>
            </FormControl>

            <Typography variant="caption" color="text.secondary">
              Drag the course on the map to move it, or its handle to rotate.
            </Typography>
          </AccordionDetails>
        </Accordion>
      )}
    </>
  );
}

export default CoursesComponent;
