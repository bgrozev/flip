import { describe, it, expect } from 'vitest';

import { MODES } from '../modes';

import {
  DEFAULT_HELP_TOPIC,
  HELP_TOPICS,
  topicById,
  topicForPanel,
  visibleTopics
} from './help';

describe('HELP_TOPICS', () => {
  it('has unique ids and a title and summary for every topic', () => {
    const ids = HELP_TOPICS.map(topic => topic.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const topic of HELP_TOPICS) {
      expect(topic.id).toMatch(/^[a-z0-9-]+$/);
      expect(topic.title.trim()).not.toBe('');
      expect(topic.summary.trim()).not.toBe('');
    }
  });

  it('documents at most one topic per panel', () => {
    const panels = HELP_TOPICS.map(topic => topic.panel).filter(Boolean);

    expect(new Set(panels).size).toBe(panels.length);
  });

  it('covers every panel a user can open', () => {
    // The promise of the help panel is that anything you can look at has an
    // entry. `settings` and `help` itself are the deliberate exceptions:
    // settings rows carry their own descriptions, and help explains itself.
    const documented = new Set(HELP_TOPICS.map(topic => topic.panel).filter(Boolean));
    const exempt = new Set(['settings', 'help', 'about']);
    const missing: string[] = [];

    for (const mode of MODES) {
      for (const panel of mode.nav) {
        if (!exempt.has(panel) && !documented.has(panel)) {
          missing.push(`${mode.id}/${panel}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it('gives every topic content, except About which the component supplies', () => {
    for (const topic of HELP_TOPICS) {
      if (topic.id === 'about') {
        continue;
      }
      expect(topic.blocks.length, `${topic.id} has no content`).toBeGreaterThan(0);
    }
  });

  it('never leaves a terms block with an empty term or text', () => {
    for (const topic of HELP_TOPICS) {
      for (const block of topic.blocks) {
        if (block.kind === 'terms') {
          expect(block.items.length).toBeGreaterThan(0);
          for (const item of block.items) {
            expect(item.term.trim(), `${topic.id}`).not.toBe('');
            expect(item.text.trim(), `${topic.id}: ${item.term}`).not.toBe('');
          }
        }
      }
    }
  });
});

describe('lookups', () => {
  it('finds a topic by panel', () => {
    expect(topicForPanel('wind')?.id).toBe('winds');
    expect(topicForPanel('pattern')?.id).toBe('pattern');
    expect(topicForPanel('settings')).toBeUndefined();
  });

  it('finds a topic by id, and tolerates junk', () => {
    expect(topicById('how-it-works')?.title).toBe('How FliP works');
    expect(topicById('nonsense')).toBeUndefined();
    expect(topicById(null)).toBeUndefined();
    expect(topicById(undefined)).toBeUndefined();
  });

  it('defaults to a topic that exists', () => {
    expect(topicById(DEFAULT_HELP_TOPIC)).toBeDefined();
  });
});

describe('visibleTopics', () => {
  it('hides the shortcuts topic where there is no keyboard', () => {
    expect(visibleTopics(true).map(t => t.id)).toContain('shortcuts');
    expect(visibleTopics(false).map(t => t.id)).not.toContain('shortcuts');
  });

  it('shows every other topic regardless of mode', () => {
    // Deliberate: someone in Standard Pattern may want to read what Flocking
    // is before switching to it.
    expect(visibleTopics(false).map(t => t.id)).toContain('flocking');
    expect(visibleTopics(false).map(t => t.id)).toContain('courses');
  });
});
