import { FormControl, InputLabel, MenuItem, Select, SelectChangeEvent, Typography } from '@mui/material';
import React from 'react';

import { COURSES } from '../util/courses';

interface CoursesComponentProps {
  selectedCourseId: string | null;
  onSelect: (id: string | null) => void;
}

function CoursesComponent({ selectedCourseId, onSelect }: CoursesComponentProps) {
  const handleChange = (e: SelectChangeEvent<string>) => {
    onSelect(e.target.value === '' ? null : e.target.value);
  };

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
          onChange={handleChange}
        >
          <MenuItem value="">
            <em>None</em>
          </MenuItem>
          {COURSES.map(course => (
            <MenuItem key={course.id} value={course.id}>
              {course.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </>
  );
}

export default CoursesComponent;
