import { Checkbox, ColorSwatch, Group, NumberInput, Paper, Stack, Text, Title } from '@mantine/core';
import { ReactNode } from 'react';

export interface TradeFilterControlsProps {
  showOrderBook: boolean;
  onShowOrderBookChange: (show: boolean) => void;
  showAllTraders: boolean;
  onShowAllTradersChange: (show: boolean) => void;
  traderIds: string[];
  traderVisibility: Record<string, boolean>;
  onTraderVisibilityChange: (traderId: string, visible: boolean) => void;
  traderColorMap: Map<string, string>;
  minQuantity: number;
  maxQuantity: number;
  onMinQuantityChange: (val: number) => void;
  onMaxQuantityChange: (val: number) => void;
}

export function TradeFilterControls({
  showOrderBook,
  onShowOrderBookChange,
  showAllTraders,
  onShowAllTradersChange,
  traderIds,
  traderVisibility,
  onTraderVisibilityChange,
  traderColorMap,
  minQuantity,
  maxQuantity,
  onMinQuantityChange,
  onMaxQuantityChange,
}: TradeFilterControlsProps): ReactNode {
  return (
    <Paper withBorder shadow="xs" p="md">
      <Title order={5} mb="xs">
        Trade Filters
      </Title>
      <Stack gap="xs">
        {/* Order book toggle */}
        <Checkbox
          label="OB"
          size="xs"
          checked={showOrderBook}
          onChange={e => onShowOrderBookChange(e.currentTarget.checked)}
        />

        {/* All traders master toggle */}
        <Checkbox
          label="All Traders"
          size="xs"
          checked={showAllTraders}
          onChange={e => onShowAllTradersChange(e.currentTarget.checked)}
        />

        {/* Own trades toggle */}
        <Group gap={4} align="center">
          <ColorSwatch color={traderColorMap.get('SUBMISSION') || '#ff6600'} size={14} />
          <Checkbox
            label="F (own)"
            size="xs"
            checked={traderVisibility['SUBMISSION'] !== false}
            onChange={e => onTraderVisibilityChange('SUBMISSION', e.currentTarget.checked)}
          />
        </Group>

        {/* Per-trader toggles */}
        {traderIds.map(id => (
          <Group key={id} gap={4} align="center">
            <ColorSwatch color={traderColorMap.get(id) || '#a9a9a9'} size={14} />
            <Checkbox
              label={id}
              size="xs"
              checked={traderVisibility[id] !== false}
              onChange={e => onTraderVisibilityChange(id, e.currentTarget.checked)}
            />
          </Group>
        ))}

        {/* Quantity filter */}
        <Text size="xs" fw={600} mt="xs">
          Trades Filtering
        </Text>
        <NumberInput label="Min" size="xs" value={minQuantity} onChange={val => onMinQuantityChange(Number(val) || 0)} min={0} />
        <NumberInput label="Max" size="xs" value={maxQuantity} onChange={val => onMaxQuantityChange(Number(val) || 9999)} min={0} />
      </Stack>
    </Paper>
  );
}
