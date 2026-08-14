/**
 * The in-app reference.
 *
 * Content comes from `core/help` as data; this only renders it.
 *
 * List, then drill in to one topic — at every width. The panel column is
 * 380px on desktop and full-screen on mobile, and neither has room for a
 * rail beside the text: with one, prose wraps to about a word per line. An
 * accordion was the other option, but that means nested scrolling, which
 * this layout already struggles with.
 *
 * The selected topic lives in the URL (`/help?topic=winds`) so a panel's
 * help link, and a link someone sends a student, both land in the right
 * place and survive a reload.
 */
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import {
  Box,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
  useMediaQuery
} from '@mui/material';
import React from 'react';

import {
  HelpBlock,
  HelpTopic,
  topicById,
  visibleTopics
} from '../core/help';
import { Shortcut } from '../core/keymap';

import AboutComponent from './AboutComponent';
import ShortcutList from './ShortcutList';

interface HelpComponentProps {
  /** Selected topic id, from the URL. */
  topicId: string | null;
  onSelectTopic: (id: string | null) => void;
  /** For the shortcuts topic — already filtered to the active mode. */
  shortcuts: readonly Shortcut[];
}

export default function HelpComponent({
  topicId, onSelectTopic, shortcuts
}: HelpComponentProps) {
  const isMobile = useMediaQuery('(max-width:600px)');
  // No keyboard on mobile, so no shortcuts topic there.
  const topics = visibleTopics(!isMobile);
  const selected = topicById(topicId);

  if (!selected) {
    return <TopicList topics={topics} onSelect={onSelectTopic} />;
  }

  return (
    <Box sx={{ textAlign: 'left' }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <IconButton
          size="small"
          aria-label="Back to help topics"
          onClick={() => onSelectTopic(null)}
        >
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography variant="h6" sx={{ fontSize: '1rem' }}>{selected.title}</Typography>
      </Stack>
      <TopicContent topic={selected} shortcuts={shortcuts} />
    </Box>
  );
}

interface TopicListProps {
  topics: readonly HelpTopic[];
  onSelect: (id: string) => void;
}

function TopicList({ topics, onSelect }: TopicListProps) {
  return (
    <List dense disablePadding aria-label="Help topics" sx={{ textAlign: 'left' }}>
      {topics.map(topic => (
        <ListItemButton
          key={topic.id}
          onClick={() => onSelect(topic.id)}
          sx={{ borderRadius: 1, alignItems: 'flex-start' }}
        >
          <ListItemText
            primary={topic.title}
            secondary={topic.summary}
            slotProps={{
              primary: { variant: 'body2' },
              secondary: { variant: 'caption' }
            }}
          />
          <ChevronRightIcon fontSize="small" sx={{ color: 'text.disabled', mt: 0.5 }} />
        </ListItemButton>
      ))}
    </List>
  );
}

function TopicContent({ topic, shortcuts }: { topic: HelpTopic; shortcuts: readonly Shortcut[] }) {
  // About keeps its existing component: it is links and credits, not prose.
  if (topic.id === 'about') {
    return <AboutComponent />;
  }

  return (
    <Stack spacing={2}>
      {topic.blocks.map((block, index) => (
        <Block key={index} block={block} shortcuts={shortcuts} />
      ))}
    </Stack>
  );
}

function Block({ block, shortcuts }: { block: HelpBlock; shortcuts: readonly Shortcut[] }) {
  switch (block.kind) {
    case 'paragraph':
      return (
        <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
          {block.text}
        </Typography>
      );

    case 'terms':
      return (
        <Stack spacing={1.25}>
          {block.items.map(item => (
            <Box key={item.term}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>{item.term}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
                {item.text}
              </Typography>
            </Box>
          ))}
        </Stack>
      );

    case 'note':
      return (
        <Box
          sx={{
            p: 1.5,
            borderLeft: '3px solid',
            borderColor: 'primary.main',
            bgcolor: 'action.hover'
          }}
        >
          <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
            {block.text}
          </Typography>
        </Box>
      );

    case 'pathLegend':
      return <PathLegend />;

    case 'shortcuts':
      return <ShortcutList shortcuts={shortcuts} />;

    default:
      return null;
  }
}

/**
 * The dashed/solid legend, drawn rather than described — the whole point is
 * that you recognize the lines on the map.
 */
function PathLegend() {
  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <Box component="svg" width={44} height={14} sx={{ flexShrink: 0, mt: 0.5 }}>
          <line x1="2" y1="7" x2="42" y2="7" stroke="currentColor" strokeWidth="2" strokeDasharray="5 4" opacity="0.6" />
        </Box>
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>Dashed</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
            Your pattern in still air, anchored at the target.
          </Typography>
        </Box>
      </Stack>
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <Box component="svg" width={44} height={14} sx={{ flexShrink: 0, mt: 0.5, color: 'success.main' }}>
          <line x1="2" y1="7" x2="42" y2="7" stroke="currentColor" strokeWidth="2.5" />
        </Box>
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>Solid</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
            The same pattern adjusted for the wind conditions.
          </Typography>
        </Box>
      </Stack>
    </Stack>
  );
}
