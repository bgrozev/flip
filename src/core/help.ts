/**
 * In-app reference: the topic registry.
 *
 * Content is DATA, not JSX, so the prose lives in one file and can be
 * rewritten without touching a component — the words are expected to change
 * far more often than the rendering.
 *
 * The organising promise: if you do not understand a piece of the UI, there
 * is an entry that explains it. Most topics therefore mirror a panel, and
 * `topicForPanel` is what lets each panel header link straight to its own.
 *
 * Pure — no React, no DOM. Rendered by `components/HelpComponent`.
 */
import { PanelId } from '../types';

/**
 * A block of topic content.
 *
 * `terms` is the workhorse: a control-by-control reference, which is the
 * shape "what does this field mean" actually wants. `shortcuts` is a
 * placeholder the renderer fills from `core/keymap`, so the key list is
 * never written down twice.
 */
export interface HelpTerm {
  /** The label as it appears in the UI, so it can be matched by eye. */
  term: string;
  text: string;
}

export type HelpBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'terms'; items: readonly HelpTerm[] }
  | { kind: 'note'; text: string }
  | { kind: 'pathLegend' }
  | { kind: 'shortcuts' };

export interface HelpTopic {
  id: string;
  title: string;
  /** One line, shown under the title in the topic list. */
  summary: string;
  /** The panel this documents, if any — drives the panel's help link. */
  panel?: PanelId;
  /** Hidden where there is no keyboard (the shortcuts topic). */
  desktopOnly?: boolean;
  blocks: readonly HelpBlock[];
}

export const HELP_TOPICS: readonly HelpTopic[] = [
  {
    id: 'how-it-works',
    title: 'How FliP works',
    summary: 'The two lines on the map, and what the difference between them means.',
    blocks: [
      {
        kind: 'paragraph',
        text: 'FliP draws your landing pattern twice. The difference between the two lines is the wind.'
      },
      { kind: 'pathLegend' },
      {
        kind: 'paragraph',
        text: 'The wind is applied from the ground up: the landing point stays where you put it, and every point earlier in the jump is pushed downwind of where it would otherwise be. That is why the start of the pattern moves while the target does not.'
      },
      {
        kind: 'note',
        text: 'The further apart the two lines are, the more the wind is doing. Fly the solid line — the dashed one only shows the shape you are flying.'
      }
    ]
  },
  {
    id: 'reading-the-map',
    title: 'Reading the map',
    summary: 'Handles, labels and the things you can drag.',
    blocks: [
      {
        kind: 'terms',
        items: [
          { term: 'Target', text: 'Where you intend to land. Drag it to move it, or shift-click anywhere on the map to jump it there.' },
          { term: 'Heading handle', text: 'Hover the target to reveal it. Drag it to turn the final approach direction.' },
          { term: 'Altitude labels', text: 'The altitude at that point of the jump. They thin out as you zoom out so they stay readable.' },
          { term: 'Winds indicator', text: 'The corner panel: ground wind plus the altitudes that matter for this plan. Hover the ground row for the station or forecast behind it; tap it to open the Wind panel.' }
        ]
      }
    ]
  },
  {
    id: 'pattern',
    title: 'Pattern',
    summary: 'Leg altitudes, descent rate and glide ratio.',
    panel: 'pattern',
    blocks: [
      {
        kind: 'paragraph',
        text: 'The pattern is flown downwind, then base, then final. You describe how much altitude each leg uses and how your canopy flies; FliP works out the ground track.'
      },
      {
        kind: 'terms',
        items: [
          { term: 'Leg altitude', text: 'The height used by that leg, not the height it starts at. The three add up: 300, 600 and 900 make a pattern that begins at 1800 ft.' },
          { term: 'Descent rate', text: 'How fast you come down in the pattern. Together with glide ratio this sets how far each leg reaches.' },
          { term: 'Glide ratio', text: 'How far you travel forward per unit of height lost, in still air. Higher means flatter and longer legs.' },
          { term: 'Turn direction', text: 'Which way you turn at the end of that leg — left or right.' }
        ]
      },
      {
        kind: 'note',
        text: 'Standard Pattern always flies all three legs. The leg-count selector is a canopy-piloting control and only appears in High Performance Landing.'
      }
    ]
  },
  {
    id: 'manoeuvre',
    title: 'Manoeuvre',
    summary: 'The turn onto final, from parameters, a track or a sample.',
    panel: 'manoeuvre',
    blocks: [
      {
        kind: 'paragraph',
        text: 'The manoeuvre is the turn that puts you on final approach. It can be described three ways, and they are interchangeable.'
      },
      {
        kind: 'terms',
        items: [
          { term: 'Parameters', text: 'Describe the turn numerically: how much altitude it uses, how long it takes, how far it displaces you sideways and forwards, and which way it turns.' },
          { term: 'Track', text: 'Use a real GPS track you flew, so the plan matches what you actually do.' },
          { term: 'Samples', text: 'Use one of the built-in example turns when you have no track of your own.' },
          { term: 'Initiation altitude', text: 'Raises or lowers the altitude the turn begins at, without changing its shape. Applies to tracks and samples.' }
        ]
      }
    ]
  },
  {
    id: 'target',
    title: 'Target and places',
    summary: 'Choosing where you land, and which way you land.',
    panel: 'target',
    blocks: [
      {
        kind: 'terms',
        items: [
          { term: 'Search', text: 'One list: your saved places first, then the known dropzones, then anywhere the map can find. Type to filter all of it at once.' },
          { term: 'Star', text: 'Stars a dropzone into “My places” so it is always at the top.' },
          { term: 'Save current target', text: 'Saves wherever the target is right now under a name — a back field, a student area, a demo landing.' },
          { term: 'Nearest dropzone', text: 'Uses your location, and only when you tap it. Everything else works without location permission.' },
          { term: 'Final heading', text: 'The direction you land in. “Upwind” sets it against the current wind.' }
        ]
      },
      {
        kind: 'note',
        text: 'Choosing a place moves the target in every mode — the dropzone you are at is not a per-mode thing. Dragging the target or changing the heading only affects the mode you are in.'
      }
    ]
  },
  {
    id: 'winds',
    title: 'Winds and trust',
    summary: 'Where the numbers come from, and when not to believe them.',
    panel: 'wind',
    blocks: [
      {
        kind: 'paragraph',
        text: 'The wind table is the whole basis of the plan: one row per altitude, each with the direction the wind comes FROM and its speed.'
      },
      {
        kind: 'terms',
        items: [
          { term: 'Forecast time', text: 'Which hour you are planning for. The scrubber steps through hours already downloaded, so it responds immediately.' },
          { term: 'Ground wind', text: 'Where available, the nearest weather station’s observation replaces the forecast’s ground row — an observation beats a forecast.' },
          { term: 'Compare sources', text: 'The same jump against a different weather model or a balloon sounding. Where they disagree, treat the plan as less certain.' },
          { term: 'Manual winds', text: 'Unlock the table to type your own. The plan is then only as good as what you typed, and FliP says so.' }
        ]
      },
      {
        kind: 'note',
        text: 'The banner across the top of the map is the trust signal: it appears when the winds are manual, stale, or were never fetched, and hides itself when the forecast is fresh.'
      }
    ]
  },
  {
    id: 'flocking',
    title: 'Flocking',
    summary: 'Spot and jumprun planning, and the three ways to solve it.',
    panel: 'flocking',
    blocks: [
      {
        kind: 'paragraph',
        text: 'Flocking plans a long, high descent under wind, where the question is not "what pattern do I fly" but "where does the aircraft need to put us".'
      },
      {
        kind: 'terms',
        items: [
          { term: 'Classic', text: 'Pick the direction the flock flies. The jumprun is that same direction, and there is exactly one exit point that works.' },
          { term: 'Free', text: 'You place the jumprun yourself — its direction and how far to the side it passes — plus where on it you exit and which way the flock flies. FliP reports where the jump ends and by how much it misses.' },
          { term: 'Solve', text: 'Describe the jumpruns the aircraft is allowed to fly as corridors, and let FliP choose. It prefers a run that reaches the green ring, and among those the one most into wind, so the answer stays steady as the forecast shifts.' },
          { term: 'Window', text: 'The altitudes the flock is actually flying between — the top is exit, the bottom is where the jump ends.' },
          { term: 'Green and yellow rings', text: 'How close to the target counts as good and as acceptable. They are what the solver tiers its answers by.' }
        ]
      }
    ]
  },
  {
    id: 'courses',
    title: 'Courses',
    summary: 'Competition course layouts on the map.',
    panel: 'courses',
    blocks: [
      {
        kind: 'paragraph',
        text: 'A course draws competition gates and buoys on the map so you can plan an approach against the real layout.'
      },
      {
        kind: 'terms',
        items: [
          { term: 'Distance', text: 'Entry gate and a measured run — how far you carry the swoop.' },
          { term: 'Zone accuracy', text: 'Scoring zones, entered on a set line.' },
          { term: 'Speed', text: 'A timed carve; the carve direction says which way it turns.' },
          { term: 'Direction', text: 'Which way the course is laid out — normally into the prevailing wind.' }
        ]
      }
    ]
  },
  {
    id: 'shortcuts',
    title: 'Keyboard shortcuts',
    summary: 'Every key, for the mode you are in.',
    desktopOnly: true,
    blocks: [{ kind: 'shortcuts' }]
  },
  {
    id: 'glossary',
    title: 'Glossary',
    summary: 'The words, briefly.',
    blocks: [
      {
        kind: 'terms',
        items: [
          { term: 'Spot', text: 'Where the aircraft puts you out.' },
          { term: 'Jumprun', text: 'The line the aircraft flies while people exit.' },
          { term: 'Drift', text: 'How far the wind carries you while you descend.' },
          { term: 'Crab', text: 'Flying angled into the wind so your track over the ground is the one you want.' },
          { term: 'Glide ratio', text: 'Distance forward per unit of height lost.' },
          { term: 'POM', text: 'Point of measurement — the marked points along the path, normally one per 1000 ft.' }
        ]
      }
    ]
  },
  {
    id: 'about',
    title: 'About FliP',
    summary: 'Who made it, and where the code lives.',
    blocks: []
  }
];

/** The topic documenting a panel, if there is one. */
export function topicForPanel(panel: PanelId): HelpTopic | undefined {
  return HELP_TOPICS.find(topic => topic.panel === panel);
}

export function topicById(id: string | null | undefined): HelpTopic | undefined {
  return HELP_TOPICS.find(topic => topic.id === id);
}

/**
 * Topics to list. Everything is shown regardless of mode — someone in
 * Standard Pattern may well want to read what Flocking is before switching
 * to it — but the shortcuts topic is dropped where there is no keyboard.
 */
export function visibleTopics(hasKeyboard: boolean): HelpTopic[] {
  return HELP_TOPICS.filter(topic => hasKeyboard || !topic.desktopOnly);
}

/** The first topic, used when no topic is selected. */
export const DEFAULT_HELP_TOPIC = HELP_TOPICS[0].id;
