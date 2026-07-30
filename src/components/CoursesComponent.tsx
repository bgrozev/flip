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
  ListSubheader,
  MenuItem,
  OutlinedInput,
  Select,
  SelectChangeEvent,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import React, { useEffect, useState } from 'react';

import { useCustomCourses } from '../hooks';
import { CourseParams, CourseType, LatLng, Target } from '../types';
import {
  BUILT_IN_PARAMS,
  buildCourse,
  coursesForPlace,
  fromCourseRelative,
  getTargetRelativeToCourse
} from '../core/courses';
import { downloadCourseKmz } from '../util/exportKmz';
import { AltitudeUnit } from '../core/units';

const M_PER_FT = 0.3048;

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
    const approachAngle = selectedCourseParams.direction - target.finalHeading;
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
  // A duplicate keeps the original's place, not the active one: the copy sits
  // on top of the buoys it was copied from, so it belongs to the same pond.
  // (They can only differ for an unassigned course or one from a preset.)
  const handleDuplicate = (params: CourseParams) => {
    const newId = createCourse({
      name: `${params.name} (copy)`,
      type: params.type,
      lat: params.lat,
      lng: params.lng,
      direction: params.direction,
      placeId: params.placeId
    });
    onSelect(newId);
  };

  const handleNew = () => {
    const newId = createCourse({
      name: 'New Course',
      type: 'distance',
      lat: target.target.lat,
      lng: target.target.lng,
      direction: 0,
      // Undefined with no place active, which is what "belongs nowhere" is
      // stored as — such a course is then offered at every dropzone.
      placeId: placeId ?? undefined
    });
    onSelect(newId);
  };

  const handleDelete = () => {
    if (selectedCourseId) {
      removeCourse(selectedCourseId);
      onSelect(null);
    }
  };

  const courseTypeLabel = (type: CourseType) =>
    type === 'distance' ? 'Distance' : type === 'speed' ? 'Speed' : 'Zone Accuracy';

  // The built-in courses are named for their type, since the dropzone is
  // already the group they sit under — so the type caption would just repeat
  // the name. Custom ones are named whatever the user called them.
  const courseRow = (params: CourseParams) => (
    <MenuItem key={params.id} value={params.id} sx={{ pr: 0.5 }}>
      <Box sx={{ display: 'flex', width: '100%', alignItems: 'center', minWidth: 0 }}>
        <Box sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {params.name}
          {params.name !== courseTypeLabel(params.type) && (
            <Typography component="span" variant="caption" sx={{ ml: 0.75, opacity: 0.55 }}>
              {courseTypeLabel(params.type)}
            </Typography>
          )}
        </Box>
        <IconButton
          size="small"
          title="Duplicate"
          onMouseDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); handleDuplicate(params); }}
          sx={{ ml: 0.5, p: 0.25, flexShrink: 0 }}
        >
          <ContentCopyIcon sx={{ fontSize: 13 }} />
        </IconButton>
      </Box>
    </MenuItem>
  );

  const inputSx = { width: '11ch' };

  return (
    <>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="h6">Courses</Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={handleNew}>New</Button>
      </Stack>

      {/* ── Course selector ── */}
      <FormControl fullWidth size="small">
        <InputLabel>Course</InputLabel>
        <Select
          value={selectedCourseId ?? ''}
          label="Course"
          onChange={(e: SelectChangeEvent<string>) =>
            onSelect(e.target.value === '' ? null : e.target.value)
          }
          renderValue={id => {
            if (!id) return <em>None</em>;
            const found = [...customParams, ...BUILT_IN_PARAMS].find(c => c.id === id);
            return found ? found.name : id;
          }}
        >
          <MenuItem value=""><em>None</em></MenuItem>

          {atPlace.length > 0 && (
            <ListSubheader disableSticky>{placeName ?? 'Here'}</ListSubheader>
          )}
          {atPlace.map(courseRow)}

          {atPlace.length > 0 && unassigned.length > 0 && <Divider />}

          {unassigned.length > 0 && (
            <ListSubheader disableSticky>Not at a dropzone</ListSubheader>
          )}
          {unassigned.map(courseRow)}

          {elsewhere.length > 0 && <Divider />}

          {elsewhere.length > 0 && (
            <ListSubheader disableSticky>From another dropzone</ListSubheader>
          )}
          {elsewhere.map(courseRow)}
        </Select>
      </FormControl>

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
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0 }}>
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
          </Box>
        </>
      )}

      {/* ── Edit section (custom courses only, collapsible) ── */}
      {selectedCustom && (
        <Accordion
          expanded={editOpen}
          onChange={(_, isExpanded) => onEditOpenChange(isExpanded)}
          disableGutters
          elevation={0}
          sx={{ mt: 1, '&:before': { display: 'none' }, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 36, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
            <Typography variant="subtitle2">Edit</Typography>
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

            <FormControl size="small" fullWidth>
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
                <MenuItem value="distance">Distance</MenuItem>
                <MenuItem value="zone-accuracy">Zone Accuracy</MenuItem>
                <MenuItem value="speed">Speed</MenuItem>
              </Select>
            </FormControl>

            {selectedCustom.type === 'speed' && (
              <FormControl size="small" fullWidth>
                <InputLabel>Carve Direction</InputLabel>
                <Select
                  value={selectedCustom.carveDirection ?? 'left'}
                  label="Carve Direction"
                  onChange={e => updateCourse(selectedCustom.id, { carveDirection: e.target.value as 'left' | 'right' })}
                >
                  <MenuItem value="left">Left</MenuItem>
                  <MenuItem value="right">Right</MenuItem>
                </Select>
              </FormControl>
            )}

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

            <Button
              color="error"
              size="small"
              variant="outlined"
              startIcon={<DeleteIcon />}
              onClick={handleDelete}
            >
              Delete Course
            </Button>
          </AccordionDetails>
        </Accordion>
      )}
    </>
  );
}

export default CoursesComponent;
