import { useLocalStorageState } from '@toolpad/core/useLocalStorageState';
import { useCallback, useMemo, useRef } from 'react';

import { BUILT_IN_PARAMS, coursesForPlace } from '../core/courses';
import { FlockingParams } from '../core/flocking';
import { SCHEMA_VERSION, migrateSetups } from '../core/model';
import {
  SetupDiff,
  SetupSnapshot,
  isSetupDirty,
  planSetupCopy,
  setupDiff,
  siteOfSnapshot,
  snapshotOfSetup
} from '../core/setups';
import { CourseParams, ManoeuvreConfig, PatternParams, Setup, Target } from '../types';
import { createVersionedCodec } from '../util/storage';

import { useCustomCourses } from './useCustomCourses';

const STORAGE_KEYS = {
  // The documents were called presets; renaming the key would buy a migration
  // and nothing else, since nobody reads it but this hook.
  setups: 'flip.presets',
  activeSetup: 'flip.presets.active'
} as const;

/**
 * Ids were the timestamp alone, which is not unique: saving twice in one
 * millisecond, or copying a setup the moment it is created, produces two
 * documents that every lookup by id confuses for one another.
 */
function newSetupId(): string {
  return `setup_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export interface SetupDraft {
  name: string;
  canopy?: string;
  note?: string;
  /** Whether the setup remembers where it lands, or only what flies it. */
  includeSite: boolean;
}

export interface SetupCopyDraft {
  name: string;
  /** Carry the position relative to a course over to the new dropzone. */
  relative: boolean;
}

interface UseSetupsParams {
  /** Everything a setup can store, as it is right now. */
  snapshot: SetupSnapshot;
  /**
   * Applies a loaded setup's target. A setup names a place, so this is the
   * place-level setter (every mode), not the per-mode one — see App.
   */
  applyTarget: (target: Target, placeId: string | null) => void;
  setModeId: (id: string) => void;
  /**
   * Mode-explicit on purpose: loading switches mode, and React has not
   * re-rendered by the time the pattern is applied, so a setter bound to the
   * mode that was active would file a swooper's numbers under Standard
   * Pattern.
   */
  setPatternParamsForMode: (modeId: string, params: PatternParams) => void;
  setManoeuvreConfig: (config: ManoeuvreConfig) => void;
  setFlockingParams: (params: FlockingParams) => void;
  setSelectedCourseId: (id: string | null) => void;
}

export interface UseSetupsResult {
  setups: Setup[];
  /**
   * The setup being worked on, or null. A setup saved in another mode is not
   * active while you are out of it — pattern params are per-mode, so it has
   * nothing to say about what is on screen — and comes back when you return.
   */
  activeSetup: Setup | null;
  /**
   * The setup you are on, when it does not apply where you are — another
   * mode, or another dropzone. Named so the toolbar can say so instead of
   * pretending nothing is loaded.
   */
  awaySetup: Setup | null;
  activeSetupId: string | null;
  diff: SetupDiff;
  dirty: boolean;
  /** The setup "Copy here" would copy: the live one, or the one you are away from. */
  copyCandidate: Setup | null;
  /** The course at THIS place a copy would be positioned against, if any. */
  copyCourse: CourseParams | null;
  createSetup: (draft: SetupDraft) => void;
  copySetupHere: (id: string, draft: SetupCopyDraft) => void;
  saveChanges: () => void;
  discardChanges: () => void;
  loadSetup: (id: string) => void;
  /** Puts back what the last load replaced; a no-op once there is nothing. */
  undoLoad: () => void;
  detach: () => void;
  deleteSetup: (id: string) => void;
  renameSetup: (id: string, name: string) => void;
  updateSetup: (id: string, updates: Partial<Pick<Setup, 'canopy' | 'note'>>) => void;
  setSetupSite: (id: string, bound: boolean) => void;
}

export function useSetups({
  snapshot,
  applyTarget,
  setModeId,
  setPatternParamsForMode,
  setManoeuvreConfig,
  setFlockingParams,
  setSelectedCourseId
}: UseSetupsParams): UseSetupsResult {
  const [storedSetups, setStoredSetups] = useLocalStorageState<Setup[]>(
    STORAGE_KEYS.setups,
    [],
    { codec: createVersionedCodec(SCHEMA_VERSION, migrateSetups) }
  );
  const setups = useMemo(() => storedSetups ?? [], [storedSetups]);

  const [storedActiveId, setActiveSetupId] = useLocalStorageState<string | null>(
    STORAGE_KEYS.activeSetup,
    null
  );
  const activeSetupId = storedActiveId ?? null;

  const { customParams } = useCustomCourses();
  const allCourses = useMemo(
    () => [...customParams, ...BUILT_IN_PARAMS],
    [customParams]
  );

  const stored = setups.find(s => s.id === activeSetupId) ?? null;
  /**
   * A setup is only live where it applies: in the mode it was saved in, and
   * at the dropzone it is bound to. Elsewhere it is DORMANT rather than
   * detached — it is still what you were working on, and it comes back when
   * you return — but it cannot be dirty or saved.
   *
   * Both halves earn their keep. Pattern params are per-mode, so in another
   * mode a setup describes numbers that are not on screen. And a setup bound
   * to ZHills has nothing to say about a target at Eloy: without this, flying
   * to another dropzone reads as "unsaved place, target and course", and
   * Save would quietly move the ZHills setup to Eloy.
   */
  const inMode = !stored?.modeId || stored.modeId === snapshot.modeId;
  const atPlace = !stored?.site || stored.site.placeId === snapshot.placeId;
  const activeSetup = stored && inMode && atPlace ? stored : null;
  const awaySetup = stored && !(inMode && atPlace) ? stored : null;

  const diff = useMemo(() => setupDiff(snapshot, activeSetup), [snapshot, activeSetup]);
  const dirty = isSetupDirty(diff);

  /** Restores the state a load replaced. Cleared once it is used. */
  const undoRef = useRef<{ snapshot: SetupSnapshot; site: boolean; setupId: string | null } | null>(
    null
  );

  const applySnapshot = useCallback(
    (next: SetupSnapshot, site: boolean) => {
      setModeId(next.modeId);
      setPatternParamsForMode(next.modeId, next.patternParams);
      setManoeuvreConfig(next.manoeuvre);
      setFlockingParams(next.flockingParams);

      // Only when the setup says something about where it lands. Applying it
      // regardless would run a place selection on every load, which clears a
      // course selection and re-seeds per-mode targets for no reason.
      if (site) {
        applyTarget(next.target, next.placeId);
        setSelectedCourseId(next.selectedCourseId);
      }
    },
    [
      applyTarget,
      setModeId,
      setPatternParamsForMode,
      setManoeuvreConfig,
      setFlockingParams,
      setSelectedCourseId
    ]
  );

  const loadSetup = useCallback(
    (id: string) => {
      const setup = setups.find(s => s.id === id);

      if (!setup) return;

      // Unsaved changes are discarded rather than confirmed — switching
      // between setups is the thing they exist for, and a dialog on every
      // switch would tax it. This is what makes that recoverable.
      undoRef.current = {
        snapshot,
        site: Boolean(setup.site),
        setupId: activeSetupId
      };

      applySnapshot(snapshotOfSetup(setup, snapshot), Boolean(setup.site));
      setActiveSetupId(id);
    },
    [setups, snapshot, activeSetupId, applySnapshot, setActiveSetupId]
  );

  const undoLoad = useCallback(() => {
    const previous = undoRef.current;

    if (!previous) return;

    undoRef.current = null;
    applySnapshot(previous.snapshot, previous.site);
    setActiveSetupId(previous.setupId);
  }, [applySnapshot, setActiveSetupId]);

  const createSetup = useCallback(
    (draft: SetupDraft) => {
      const setup: Setup = {
        id: newSetupId(),
        name: draft.name,
        modeId: snapshot.modeId,
        patternParams: snapshot.patternParams,
        manoeuvre: snapshot.manoeuvre,
        createdAt: Date.now()
      };

      if (draft.canopy) setup.canopy = draft.canopy;
      if (draft.note) setup.note = draft.note;
      if (snapshot.modeId === 'flocking') setup.flockingParams = snapshot.flockingParams;
      setup.site = draft.includeSite ? siteOfSnapshot(snapshot) : null;

      setStoredSetups([...setups, setup]);
      setActiveSetupId(setup.id);
    },
    [snapshot, setups, setStoredSetups, setActiveSetupId]
  );

  const sourceCourseFor = useCallback(
    (setup: Setup | null) =>
      allCourses.find(c => c.id === setup?.site?.selectedCourseId) ?? null,
    [allCourses]
  );

  const destinationCourses = useMemo(() => {
    const here = coursesForPlace(allCourses, snapshot.placeId);

    return [...here.atPlace, ...here.unassigned];
  }, [allCourses, snapshot.placeId]);

  // Copying is for the setup that does not already belong here — which is
  // usually the one you are away from, since that is what "take my ZHills
  // setup to Eloy" looks like.
  const candidate = activeSetup ?? awaySetup;
  const copyCandidate = candidate && (!candidate.site || candidate.site.placeId !== snapshot.placeId)
    ? candidate
    : null;

  // What the copy dialog's switch would position against, so it can name it.
  const copyCourse = useMemo(() => {
    const source = sourceCourseFor(copyCandidate);

    if (!copyCandidate || !source) return null;

    return planSetupCopy({
      setup: copyCandidate,
      sourceCourse: source,
      destinationCourses,
      destinationSelectedCourseId: snapshot.selectedCourseId,
      currentTarget: snapshot.target,
      relative: true
    }).course;
  }, [copyCandidate, sourceCourseFor, destinationCourses, snapshot]);

  /**
   * A copy of a setup at the dropzone you are at now, keeping where it sits
   * relative to a course. The same three fields the Courses panel shows —
   * depth, offset, approach angle — are measured off the original and laid
   * out again against the course here, so a Distance setup arrives on the
   * Distance course, turned the way that one is turned.
   */
  const copySetupHere = useCallback(
    (id: string, draft: SetupCopyDraft) => {
      const setup = setups.find(s => s.id === id);

      if (!setup) return;

      const plan = planSetupCopy({
        setup,
        sourceCourse: sourceCourseFor(setup),
        destinationCourses,
        destinationSelectedCourseId: snapshot.selectedCourseId,
        currentTarget: snapshot.target,
        relative: draft.relative
      });

      const copy: Setup = {
        ...setup,
        id: newSetupId(),
        name: draft.name,
        createdAt: Date.now(),
        site: {
          placeId: snapshot.placeId,
          target: plan.target,
          selectedCourseId: plan.course?.id ?? snapshot.selectedCourseId
        }
      };

      setStoredSetups([...setups, copy]);
      // The copy is what you now have on screen, so it is loaded rather than
      // merely filed: otherwise saving one means going and finding it.
      undoRef.current = { snapshot, site: true, setupId: activeSetupId };
      applySnapshot(snapshotOfSetup(copy, snapshot), true);
      setActiveSetupId(copy.id);
    },
    [
      setups,
      snapshot,
      activeSetupId,
      sourceCourseFor,
      destinationCourses,
      applySnapshot,
      setStoredSetups,
      setActiveSetupId
    ]
  );

  const saveChanges = useCallback(() => {
    if (!activeSetup) return;

    setStoredSetups(
      setups.map(s =>
        s.id === activeSetup.id
          ? {
            ...s,
            modeId: snapshot.modeId,
            patternParams: snapshot.patternParams,
            manoeuvre: snapshot.manoeuvre,
            flockingParams: snapshot.modeId === 'flocking'
              ? snapshot.flockingParams
              : s.flockingParams,
            site: s.site ? siteOfSnapshot(snapshot) : undefined
          }
          : s
      )
    );
  }, [activeSetup, setups, snapshot, setStoredSetups]);

  const discardChanges = useCallback(() => {
    if (!activeSetup) return;

    applySnapshot(snapshotOfSetup(activeSetup, snapshot), Boolean(activeSetup.site));
  }, [activeSetup, snapshot, applySnapshot]);

  const detach = useCallback(() => setActiveSetupId(null), [setActiveSetupId]);

  const deleteSetup = useCallback(
    (id: string) => {
      setStoredSetups(setups.filter(s => s.id !== id));

      if (activeSetupId === id) {
        setActiveSetupId(null);
      }
    },
    [setups, activeSetupId, setStoredSetups, setActiveSetupId]
  );

  const renameSetup = useCallback(
    (id: string, name: string) => {
      setStoredSetups(setups.map(s => (s.id === id ? { ...s, name } : s)));
    },
    [setups, setStoredSetups]
  );

  const updateSetup = useCallback(
    (id: string, updates: Partial<Pick<Setup, 'canopy' | 'note'>>) => {
      setStoredSetups(
        setups.map(s => {
          if (s.id !== id) return s;

          const next = { ...s, ...updates };

          // An emptied field is absent, not an empty string, so that nothing
          // downstream has to tell the two apart.
          if (!next.canopy) delete next.canopy;
          if (!next.note) delete next.note;

          return next;
        })
      );
    },
    [setups, setStoredSetups]
  );

  /** Binds a setup to where you are now, or cuts it loose to travel. */
  const setSetupSite = useCallback(
    (id: string, bound: boolean) => {
      setStoredSetups(
        setups.map(s => {
          if (s.id !== id) return s;
          if (!bound) {
            return { ...s, site: null };
          }

          return { ...s, site: s.site ?? siteOfSnapshot(snapshot) };
        })
      );
    },
    [setups, snapshot, setStoredSetups]
  );

  return {
    setups,
    activeSetup,
    awaySetup,
    activeSetupId,
    diff,
    dirty,
    copyCandidate,
    copyCourse,
    createSetup,
    copySetupHere,
    saveChanges,
    discardChanges,
    loadSetup,
    undoLoad,
    detach,
    deleteSetup,
    renameSetup,
    updateSetup,
    setSetupSite
  };
}
