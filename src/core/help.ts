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
          { term: 'Target', text: 'The blue dot: where you intend to land. Drag it to move it, or shift-click anywhere on the map to jump it there.' },
          { term: 'Heading handle', text: 'The orange dot beside the target — hover the target to reveal it. Drag it to turn the final approach direction.' },
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
          { term: 'Leg altitude', text: 'The height each leg USES, not the height it starts at. So the usual 300 / 600 / 900 pattern — final at 300, base at 600, downwind at 900 — is entered as 300 for every leg: three legs of 300 ft each, starting at 900.' },
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
      },
      {
        kind: 'note',
        text: 'The manoeuvre ends where you first arrive at the ground, not where you stop — and the built-in samples are cut that way. The swoop that follows is yours to account for: the dotted final-approach line through the target shows the direction it runs in.'
      }
    ]
  },
  {
    id: 'target',
    title: 'Location',
    summary: 'Choosing which dropzone you are planning at.',
    panel: 'target',
    blocks: [
      {
        kind: 'terms',
        items: [
          { term: 'The card at the top', text: 'Where you are planning right now. It also says how far you have dragged the target from the dropzone\u2019s own coordinates, with a way to put it back.' },
          { term: 'Your places', text: 'Starred dropzones and your own saved locations first, then the ones you picked recently. One list \u2014 the star tells you which is which, and moves a place between them.' },
          { term: 'Search', text: 'Filters your places and the dropzones together, and asks the map at the same time, so a field with no name is found the same way a dropzone is.' },
          { term: 'All dropzones', text: 'Every dropzone FliP knows, grouped by country. For browsing; searching is faster when you know the name.' },
          { term: 'Save current target', text: 'Saves wherever the target is right now under a name \u2014 a back field, a student area, a demo landing.' },
          { term: 'Nearest dropzone', text: 'Uses your location, and only when you tap it. Everything else works without location permission.' }
        ]
      },
      {
        kind: 'note',
        text: 'Where you LAND is set on the map, not here: drag the target, or shift-click to jump it. The landing direction is the handle that appears when you hover it, or the keyboard \u2014 see the shortcuts for the coarse and fine steps and for landing into wind.'
      },
      {
        kind: 'note',
        text: 'Choosing a place moves the target in every mode \u2014 the dropzone you are at is not a per-mode thing. Dragging the target or changing the heading only affects the mode you are in.'
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
      },
      {
        kind: 'note',
        text: 'These numbers are a FORECAST, and a forecast is never a fact. FliP warns you when it has reason to doubt one — old data, manual entry, sources that disagree — but silence is not a guarantee: the real air can differ from the model on a perfectly fresh forecast. Treat the plan as one input, check it against what you can see and feel on the day, and remember the jump is yours: applying any of this to a real canopy flight is the jumper’s call and the jumper’s responsibility.'
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
        kind: 'paragraph',
        text: 'Courses belong to a dropzone, so the list only shows the ones at the place you are at, and "New" adds a course there. Switching dropzone clears a course that belongs to the one you left. A setup remembers both, so loading it brings back the dropzone and its course together.'
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
