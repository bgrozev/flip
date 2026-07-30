import {
  FileDownload as FileDownloadIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { Chip, CircularProgress, Divider, IconButton, Stack, Tooltip } from '@mui/material';
import React from 'react';

import { ModeId } from '../modes';
import { Preset } from '../types';

import ModeSwitcher from './ModeSwitcher';
import PresetSelector from './PresetSelector';

interface ToolbarActionsProps {
  modeId: ModeId;
  onModeChange: (id: ModeId) => void;
  onRefreshWindsClick: () => void;
  onExportClick: () => void;
  /** Export is nerd-only; the button is absent otherwise. */
  showExport: boolean;
  /** Nerd mode is on — shown as a chip so the state is never invisible. */
  nerd: boolean;
  onNerdOff: () => void;
  fetching: boolean;
  showPresets: boolean;
  presets: Preset[];
  activePresetId: string | null;
  onPresetSelect: (id: string | null) => void;
  onPresetSave: (name?: string) => void;
  onPresetDelete: () => void;
  onPresetRename: (id: string, newName: string) => void;
  /** Preset menu open state, owned by App so `S` can open it. */
  presetsOpen: boolean;
  onPresetsOpenChange: (open: boolean) => void;
}

export default function ToolbarActions({
  modeId,
  onModeChange,
  onRefreshWindsClick,
  onExportClick,
  showExport,
  nerd,
  onNerdOff,
  fetching,
  showPresets,
  presets,
  activePresetId,
  onPresetSelect,
  onPresetSave,
  onPresetDelete,
  onPresetRename,
  presetsOpen,
  onPresetsOpenChange
}: ToolbarActionsProps) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      {nerd && <NerdChip onOff={onNerdOff} />}
      <ModeSwitcher modeId={modeId} onChange={onModeChange} />
      <Divider orientation="vertical" flexItem />
      <RefreshWindsButton onClick={onRefreshWindsClick} fetching={fetching} />
      {showExport && <ExportButton onClick={onExportClick} />}
      <Divider orientation="vertical" flexItem />
      {showPresets && (
        <PresetSelector
          presets={presets}
          activePresetId={activePresetId}
          onSelect={onPresetSelect}
          onSave={onPresetSave}
          onDelete={onPresetDelete}
          onRename={onPresetRename}
          open={presetsOpen}
          onOpenChange={onPresetsOpenChange}
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

function RefreshWindsButton({
  onClick,
  fetching
}: {
  onClick: () => void;
  fetching: boolean;
}) {
  const child = fetching ? (
    <CircularProgress size={24} />
  ) : (
    <IconButton type="button" aria-label="refresh-wind" onClick={() => onClick()}>
      <RefreshIcon />
    </IconButton>
  );

  return <Tooltip title="Refresh wind">{child}</Tooltip>;
}
