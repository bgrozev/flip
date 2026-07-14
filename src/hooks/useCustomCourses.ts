import { useLocalStorageState } from '@toolpad/core/useLocalStorageState';
import { useMemo } from 'react';

import { SCHEMA_VERSION, migrateCustomCourses } from '../core/model';
import { CourseParams } from '../types';
import { buildCourse } from '../util/courses';
import { createVersionedCodec } from '../util/storage';

const EMPTY: CourseParams[] = [];
const codec = createVersionedCodec(SCHEMA_VERSION, migrateCustomCourses);

export function useCustomCourses() {
  const [stored, setStored] = useLocalStorageState<CourseParams[]>(
    'flip.courses.custom',
    EMPTY,
    { codec }
  );
  const customParams = stored ?? EMPTY;

  const customCourses = useMemo(() => customParams.map(buildCourse), [customParams]);

  const createCourse = (params: Omit<CourseParams, 'id'>): string => {
    const id = `custom-${Date.now()}`;
    setStored([...customParams, { ...params, id }]);
    return id;
  };

  const updateCourse = (id: string, updates: Partial<Omit<CourseParams, 'id'>>) => {
    setStored(customParams.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const removeCourse = (id: string) => {
    setStored(customParams.filter(c => c.id !== id));
  };

  return { customParams, customCourses, createCourse, updateCourse, removeCourse };
}
