import { FileDownload as FileDownloadIcon } from '@mui/icons-material';
import { Chip, Divider, IconButton, Stack, Tooltip } from '@mui/material';
import React from 'react';

import { UseSetupsResult } from '../hooks/useSetups';
import { ModeId } from '../modes';

import ModeSwitcher from './ModeSwitcher';
import SetupSelector from './SetupSelector';

interface ToolbarActionsProps {
  modeId: ModeId;
  onModeChange: (id: ModeId) => void;
  onExportClick: () => void;
  /** Export is nerd-only; the button is absent otherwise. */
  showExport: boolean;
  /** Nerd mode is on — shown as a chip so the state is never invisible. */
  nerd: boolean;
  onNerdOff: () => void;
  showSetups: boolean;
  setups: UseSetupsResult;
  /** The mode in play, so a setup saved in another one can say which. */
  activeModeId: ModeId;
  placeId: string | null;
  placeName: string | null;
  /** Setup menu open state, owned by App so `S` can open it. */
  setupsOpen: boolean;
  onSetupsOpenChange: (open: boolean) => void;
}

export default function ToolbarActions({
  modeId,
  onModeChange,
  onExportClick,
  showExport,
  nerd,
  onNerdOff,
  showSetups,
  setups,
  activeModeId,
  placeId,
  placeName,
  setupsOpen,
  onSetupsOpenChange
}: ToolbarActionsProps) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      {nerd && <NerdChip onOff={onNerdOff} />}
      <ModeSwitcher modeId={modeId} onChange={onModeChange} />
      <Divider orientation="vertical" flexItem />
      {/* Refreshing the winds lives in the Wind panel header and on the map
          indicator, next to what it changes — not in the global toolbar. */}
      {showExport && <ExportButton onClick={onExportClick} />}
      {showExport && <Divider orientation="vertical" flexItem />}
      {showSetups && (
        <SetupSelector
          setups={setups}
          activeModeId={activeModeId}
          placeId={placeId}
          placeName={placeName}
          open={setupsOpen}
          onOpenChange={onSetupsOpenChange}
        />
      )}
    </Stack>
  );
}


/**
 * Nerd mode's only footprint outside Settings, and only while it is on:
 * without it the extra tools appear with nothing to explain them, and
 * "why does my FliP look different from yours" has no answer. Clicking it
 * turns nerd mode off (reversible, so no confirmation).
 */
function NerdChip({ onOff }: { onOff: () => void }) {
  return (
    <Tooltip title="Nerd mode is on — click to turn it off">
      <Chip
        label="NERD"
        size="small"
        variant="outlined"
        color="primary"
        onClick={onOff}
        sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: 0.5, height: 20 }}
      />
    </Tooltip>
  );
}

function ExportButton({ onClick }: { onClick: () => void }) {
  return (
    <Tooltip title="Export FlySight 2 CSV">
      <IconButton type="button" aria-label="export" onClick={onClick}>
        <FileDownloadIcon />
      </IconButton>
    </Tooltip>
  );
}

