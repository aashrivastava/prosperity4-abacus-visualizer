import { NumberInput, Paper, Stack, Title } from '@mantine/core';
import { ReactNode } from 'react';

export interface DownsamplingConfig {
  ds10: number;
  ds100: number;
  ob: number;
  trades: number;
}

export interface PerformanceControlsProps {
  config: DownsamplingConfig;
  onChange: (config: DownsamplingConfig) => void;
}

export function PerformanceControls({ config, onChange }: PerformanceControlsProps): ReactNode {
  const update = (key: keyof DownsamplingConfig, val: number) => {
    onChange({ ...config, [key]: val });
  };

  return (
    <Paper withBorder shadow="xs" p="md">
      <Title order={5} mb="xs">
        Set Thresholds
      </Title>
      <Stack gap="xs">
        <NumberInput label="ds10" size="xs" value={config.ds10} onChange={val => update('ds10', Number(val) || 0)} min={0} />
        <NumberInput label="ds100" size="xs" value={config.ds100} onChange={val => update('ds100', Number(val) || 0)} min={0} />
        <NumberInput label="ob" size="xs" value={config.ob} onChange={val => update('ob', Number(val) || 0)} min={0} />
        <NumberInput label="trades" size="xs" value={config.trades} onChange={val => update('trades', Number(val) || 0)} min={0} />
      </Stack>
    </Paper>
  );
}
