import {
  Box,
  Divider,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  SelectChangeEvent,
  Typography
} from '@mui/material';
import React, { useEffect, useState } from 'react';

import { Target } from '../types';
import { COURSES, fromCourseRelative, getTargetRelativeToCourse } from '../util/courses';

interface CoursesComponentProps {
  selectedCourseId: string | null;
  onSelect: (id: string | null) => void;
  target: Target;
  onTargetChange: (t: Target) => void;
}

function CoursesComponent({
  selectedCourseId,
  onSelect,
  target,
  onTargetChange
}: CoursesComponentProps) {
  const course = COURSES.find(c => c.id === selectedCourseId) ?? null;
  const hasCourse = course?.center !== undefined && course?.direction !== undefined;

  // Local string state for the three inputs — synced from target when course changes,
  // but NOT on every target change (to avoid a feedback loop when the user is typing).
  const [depthStr, setDepthStr] = useState('0');
  const [offsetStr, setOffsetStr] = useState('0');
  const [dirStr, setDirStr] = useState('0');

  useEffect(() => {
    if (!course?.center || course?.direction === undefined) return;
    const rel = getTargetRelativeToCourse(target.target, course.center, course.direction);
    setDepthStr(String(Math.round(rel.depth * 10) / 10));
    setOffsetStr(String(Math.round(rel.offset * 10) / 10));
    const approachAngle = course.direction - target.finalHeading;
    setDirStr(String(Math.round(approachAngle)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course?.id]); // intentionally only re-sync when the selected course changes

  const handleDepth = (e: React.ChangeEvent<HTMLInputElement>) => {
    const s = e.target.value;
    setDepthStr(s);
    const v = parseFloat(s);
    if (isNaN(v) || !course?.center || course?.direction === undefined) return;
    const off = parseFloat(offsetStr);
    onTargetChange({
      ...target,
      target: fromCourseRelative(v, isNaN(off) ? 0 : off, course.center, course.direction)
    });
  };

  const handleOffset = (e: React.ChangeEvent<HTMLInputElement>) => {
    const s = e.target.value;
    setOffsetStr(s);
    const v = parseFloat(s);
    if (isNaN(v) || !course?.center || course?.direction === undefined) return;
    const dep = parseFloat(depthStr);
    onTargetChange({
      ...target,
      target: fromCourseRelative(isNaN(dep) ? 0 : dep, v, course.center, course.direction)
    });
  };

  // Changing approach angle updates finalHeading relative to course direction.
  const handleApproachAngle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const s = e.target.value;
    setDirStr(s);
    const v = parseFloat(s);
    if (isNaN(v) || course?.direction === undefined) return;
    const finalHeading = ((course.direction - v) % 360 + 360) % 360;
    onTargetChange({ ...target, finalHeading });
  };

  const inputSx = { width: '11ch' };

  return (
    <>
      <Typography variant="h6" gutterBottom>
        Courses
      </Typography>
      <FormControl fullWidth size="small">
        <InputLabel>Course</InputLabel>
        <Select
          value={selectedCourseId ?? ''}
          label="Course"
          onChange={(e: SelectChangeEvent<string>) =>
            onSelect(e.target.value === '' ? null : e.target.value)
          }
        >
          <MenuItem value=""><em>None</em></MenuItem>
          {COURSES.map(c => (
            <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
          ))}
        </Select>
      </FormControl>

      {hasCourse && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle1" gutterBottom>
            Target
          </Typography>
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
    </>
  );
}

export default CoursesComponent;
