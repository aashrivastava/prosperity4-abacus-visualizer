import { MultiSelect, Paper, Select, Stack, Title } from '@mantine/core';
import { ReactNode } from 'react';
import { MidPriceMode } from './OrderBookScatterChart.tsx';

export interface SelectionControlsProps {
  products: string[];
  selectedProduct: string;
  onProductChange: (product: string) => void;
  indicatorKeys: string[];
  selectedIndicators: string[];
  onIndicatorsChange: (indicators: string[]) => void;
  normalizationIndicator: string | null;
  onNormalizationChange: (indicator: string | null) => void;
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
  normalizationIndicator,
  onNormalizationChange,
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

        {/* Normalization dropdown */}
        {indicatorKeys.length > 0 && (
          <Select
            label="Normalize by"
            size="xs"
            data={[{ value: '__none__', label: 'None' }, ...indicatorKeys.map(k => ({ value: k, label: k }))]}
            value={normalizationIndicator ?? '__none__'}
            onChange={val => onNormalizationChange(val === '__none__' ? null : val)}
            allowDeselect={false}
          />
        )}
      </Stack>
    </Paper>
  );
}
