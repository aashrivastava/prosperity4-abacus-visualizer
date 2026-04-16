import { MultiSelect, Paper, Select, Stack, Switch, Title } from '@mantine/core';
import { ReactNode } from 'react';
import { MidPriceMode } from './OrderBookScatterChart.tsx';

export interface SelectionControlsProps {
  products: string[];
  selectedProduct: string;
  onProductChange: (product: string) => void;
  indicatorKeys: string[];
  selectedIndicators: string[];
  onIndicatorsChange: (indicators: string[]) => void;
  normalizeEnabled: boolean;
  onNormalizeChange: (enabled: boolean) => void;
  midPriceMode: MidPriceMode;
  onMidPriceModeChange: (mode: MidPriceMode) => void;
}

const MID_PRICE_OPTIONS = [
  { value: 'mid', label: 'Mid Price' },
  { value: 'wallmid', label: 'Wall Mid' },
  { value: 'microprice', label: 'Microprice' },
  { value: 'none', label: 'None' },
];

export function SelectionControls({
  products,
  selectedProduct,
  onProductChange,
  indicatorKeys,
  selectedIndicators,
  onIndicatorsChange,
  normalizeEnabled,
  onNormalizeChange,
  midPriceMode,
  onMidPriceModeChange,
}: SelectionControlsProps): ReactNode {
  return (
    <Paper withBorder shadow="xs" p="md">
      <Title order={5} mb="xs">
        Selection Controls
      </Title>
      <Stack gap="sm">
        {/* Product selector */}
        <Select
          label="Product"
          size="xs"
          data={products}
          value={selectedProduct}
          onChange={val => val && onProductChange(val)}
          allowDeselect={false}
        />

        {/* Mid price visualization mode */}
        <Select
          label="Mid Price"
          size="xs"
          data={MID_PRICE_OPTIONS}
          value={midPriceMode}
          onChange={val => val && onMidPriceModeChange(val as MidPriceMode)}
          allowDeselect={false}
        />

        {/* Normalize prices relative to selected mid-price mode */}
        <Switch
          label="Normalize"
          size="xs"
          checked={normalizeEnabled}
          onChange={e => onNormalizeChange(e.currentTarget.checked)}
          disabled={midPriceMode === 'none'}
        />

        {/* Indicator overlay selector */}
        {indicatorKeys.length > 0 && (
          <MultiSelect
            label="Indicator Overlays"
            size="xs"
            data={indicatorKeys}
            value={selectedIndicators}
            onChange={onIndicatorsChange}
            placeholder="Select indicators..."
            clearable
            searchable
          />
        )}
      </Stack>
    </Paper>
  );
}
