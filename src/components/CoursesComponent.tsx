import {
  Add as AddIcon,
  ContentCopy as ContentCopyIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon
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
import { BUILT_IN_PARAMS, fromCourseRelative, getTargetRelativeToCourse } from '../util/courses';

interface CoursesComponentProps {
  selectedCourseId: string | null;
  onSelect: (id: string | null) => void;
  target: Target;
  onTargetChange: (t: Target) => void;
  editOpen: boolean;
  onEditOpenChange: (open: boolean) => void;
}

function CoursesComponent({
  selectedCourseId,
  onSelect,
  target,
  onTargetChange,
  editOpen,
  onEditOpenChange
}: CoursesComponentProps) {
  const { customParams, createCourse, updateCourse, removeCourse } = useCustomCourses();

  const selectedCustom = customParams.find(c => c.id === selectedCourseId) ?? null;
  const selectedBuiltIn = BUILT_IN_PARAMS.find(c => c.id === selectedCourseId) ?? null;
  // Unified course params for the Target section (works for both custom and built-in)
  const selectedCourseParams: CourseParams | null = selectedBuiltIn ?? selectedCustom;

  // ── Target-relative section ──────────────────────────────────────────────────
  const [depthStr, setDepthStr] = useState('0');
  const [offsetStr, setOffsetStr] = useState('0');
  const [dirStr, setDirStr] = useState('0');

  useEffect(() => {
    if (!selectedCourseParams) return;
    const center: LatLng = { lat: selectedCourseParams.lat, lng: selectedCourseParams.lng };
    const rel = getTargetRelativeToCourse(target.target, center, selectedCourseParams.direction);
    setDepthStr(String(Math.round(rel.depth * 10) / 10));
    setOffsetStr(String(Math.round(rel.offset * 10) / 10));
    const approachAngle = selectedCourseParams.direction - target.finalHeading;
    setDirStr(String(Math.round(approachAngle)));
  // Re-sync when the selected course changes OR when the course is moved/rotated.
  // Deliberately excludes target changes to avoid feedback loops.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourseId, selectedCourseParams?.lat, selectedCourseParams?.lng, selectedCourseParams?.direction]);

  const handleDepth = (e: React.ChangeEvent<HTMLInputElement>) => {
    const s = e.target.value;
    setDepthStr(s);
    const v = parseFloat(s);
    if (isNaN(v) || !selectedCourseParams) return;
    const center: LatLng = { lat: selectedCourseParams.lat, lng: selectedCourseParams.lng };
    const off = parseFloat(offsetStr);
    onTargetChange({ ...target, target: fromCourseRelative(v, isNaN(off) ? 0 : off, center, selectedCourseParams.direction) });
  };

  const handleOffset = (e: React.ChangeEvent<HTMLInputElement>) => {
    const s = e.target.value;
    setOffsetStr(s);
    const v = parseFloat(s);
    if (isNaN(v) || !selectedCourseParams) return;
    const center: LatLng = { lat: selectedCourseParams.lat, lng: selectedCourseParams.lng };
    const dep = parseFloat(depthStr);
    onTargetChange({ ...target, target: fromCourseRelative(isNaN(dep) ? 0 : dep, v, center, selectedCourseParams.direction) });
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

  useEffect(() => {
    if (selectedCustom) {
      setEditName(selectedCustom.name);
      setEditLat(String(selectedCustom.lat));
      setEditLng(String(selectedCustom.lng));
      setEditCourseDir(String(selectedCustom.direction));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustom?.id]);

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
    const newId = createCourse({
      name: `${params.name} (copy)`,
      type: params.type,
      lat: params.lat,
      lng: params.lng,
      direction: params.direction
    });
    onSelect(newId);
  };

  const handleNew = () => {
    const newId = createCourse({
      name: 'New Course',
      type: 'distance',
      lat: target.target.lat,
      lng: target.target.lng,
      direction: 0
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
    type === 'distance' ? 'Distance' : 'Zone Accuracy';

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
            const custom = customParams.find(c => c.id === id);
            if (custom) return custom.name;
            const builtin = BUILT_IN_PARAMS.find(c => c.id === id);
            return builtin ? builtin.name : id;
          }}
        >
          <MenuItem value=""><em>None</em></MenuItem>

          {customParams.length > 0 && (
            <ListSubheader disableSticky>Custom</ListSubheader>
          )}
          {customParams.map(params => (
            <MenuItem key={params.id} value={params.id} sx={{ pr: 0.5 }}>
              <Box sx={{ display: 'flex', width: '100%', alignItems: 'center', minWidth: 0 }}>
                <Box sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {params.name}
                  <Typography component="span" variant="caption" sx={{ ml: 0.75, opacity: 0.55 }}>
                    {courseTypeLabel(params.type)}
                  </Typography>
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
          ))}

          {customParams.length > 0 && <Divider />}

          <ListSubheader disableSticky>Built-in</ListSubheader>
          {BUILT_IN_PARAMS.map(params => (
            <MenuItem key={params.id} value={params.id} sx={{ pr: 0.5 }}>
              <Box sx={{ display: 'flex', width: '100%', alignItems: 'center', minWidth: 0 }}>
                <Box sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {params.name}
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
          ))}
        </Select>
      </FormControl>

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
                endAdornment={<InputAdornment position="end">m</InputAdornment>}
                inputProps={{ step: 0.5 }}
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
                endAdornment={<InputAdornment position="end">m</InputAdornment>}
                inputProps={{ step: 0.5 }}
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
                onChange={e => updateCourse(selectedCustom.id, { type: e.target.value as CourseType })}
              >
                <MenuItem value="distance">Distance</MenuItem>
                <MenuItem value="zone-accuracy">Zone Accuracy</MenuItem>
              </Select>
            </FormControl>

            <Stack direction="row" spacing={1}>
              <TextField
                label="Lat"
                size="small"
                value={editLat}
                onChange={e => setEditLat(e.target.value)}
                onBlur={commitLat}
                onKeyDown={e => { if (e.key === 'Enter') commitLat(); }}
                sx={{ flex: 1 }}
              />
              <TextField
                label="Lng"
                size="small"
                value={editLng}
                onChange={e => setEditLng(e.target.value)}
                onBlur={commitLng}
                onKeyDown={e => { if (e.key === 'Enter') commitLng(); }}
                sx={{ flex: 1 }}
              />
            </Stack>

            <FormControl variant="outlined" size="small" fullWidth>
              <OutlinedInput
                value={editCourseDir}
                onChange={e => setEditCourseDir(e.target.value)}
                onBlur={commitCourseDir}
                onKeyDown={e => { if (e.key === 'Enter') commitCourseDir(); }}
                endAdornment={<InputAdornment position="end">°</InputAdornment>}
                inputProps={{ type: 'number', step: 1 }}
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
