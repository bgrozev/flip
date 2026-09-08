/**
 * The assumption-of-risk notice: the words, and the gate.
 *
 * `RiskNoticeBody` is the prose alone, so the blocking overlay and the Help
 * topic render the SAME text from the same component — a notice that says
 * two different things in two places is worse than no notice.
 *
 * `RiskNoticeDialog` is the gate: shown once, before anything else, and it
 * cannot be dismissed. No close button, no backdrop click, no Escape — a
 * "you must agree" dialog with an exit is a suggestion. The checkbox gates
 * the button rather than the other way around, so the act of agreeing is
 * deliberate and reads in that order: text, tick, proceed.
 *
 * Full-screen on a phone: the notice is longer than a phone dialog's
 * comfortable height, and a scroll trapped inside a floating card is the
 * worst version of that. The actions stay pinned to the bottom at every
 * width, so "what do I do now" is never below the fold.
 */
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Typography,
  useMediaQuery
} from '@mui/material';
import React from 'react';

import {
  RISK_ACCEPT_LABEL,
  RISK_AGREEMENT,
  RISK_INTRO,
  RISK_POINTS,
  RISK_TITLE
} from '../core/disclaimer';

import { FlipMark } from './Wordmark';

/**
 * The notice itself. `dense` is the Help rendering: the same words at the
 * panel's body-text size, matching the other help topics beside it.
 */
export function RiskNoticeBody({ dense = false }: { dense?: boolean }) {
  const variant = dense ? 'body2' : 'body1';

  return (
    <Stack spacing={2}>
      <Typography variant={variant} sx={{ lineHeight: 1.7 }}>
        {RISK_INTRO}
      </Typography>
      <Stack component="ul" spacing={1.25} sx={{ m: 0, pl: 2.5 }}>
        {RISK_POINTS.map(point => (
          <Typography
            component="li"
            key={point}
            variant={variant}
            sx={{ color: 'text.secondary', lineHeight: 1.6 }}
          >
            {point}
          </Typography>
        ))}
      </Stack>
    </Stack>
  );
}

interface RiskNoticeDialogProps {
  open: boolean;
  onAccept: () => void;
}

export default function RiskNoticeDialog({ open, onAccept }: RiskNoticeDialogProps) {
  const fullScreen = useMediaQuery('(max-width:600px)');
  const [agreed, setAgreed] = React.useState(false);

  return (
    <Dialog
      open={open}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="sm"
      // No onClose at all: there is no way out of this one but the button.
      disableEscapeKeyDown
      aria-labelledby="risk-notice-title"
      slotProps={{ paper: { sx: { maxHeight: '100%' } } }}
    >
      <DialogTitle id="risk-notice-title" sx={{ pb: 1 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <FlipMark flocking={false} size={28} />
          <Box>
            <Typography variant="h6" component="div" sx={{ lineHeight: 1.2 }}>
              {RISK_TITLE}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Please read before using FliP
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <RiskNoticeBody />
      </DialogContent>

      <DialogActions
        sx={{
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: 1,
          px: 3,
          py: 2,
          // Both children are laid out by the Stack, so MUI's default
          // "space every child but the first" margin would double it.
          '& > :not(style) ~ :not(style)': { ml: 0 }
        }}
      >
        <FormControlLabel
          sx={{ alignItems: 'flex-start', mr: 0 }}
          control={
            <Checkbox
              checked={agreed}
              onChange={event => setAgreed(event.target.checked)}
              sx={{ pt: 0.25 }}
              inputProps={{ 'aria-label': 'I have read and understood' }}
            />
          }
          label={
            <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
              {RISK_AGREEMENT}
            </Typography>
          }
        />
        <Button
          variant="contained"
          size="large"
          fullWidth
          disabled={!agreed}
          onClick={onAccept}
        >
          {RISK_ACCEPT_LABEL}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
