/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import type { canvas as canvasApi } from '@apache-superset/core';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Button, Tag, Typography } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import type { ScopeValues } from './CanvasGrid';

export interface ActiveFiltersBarProps {
  values: ScopeValues;
  titles?: Record<string, string>;
  onClear: (kind: canvasApi.ScopeKind, nodeId: string) => void;
  onClearAll: () => void;
}

interface FilterChip {
  kind: 'filter' | 'crossFilter';
  nodeId: string;
  label: string;
  summary: string;
}

const Bar = styled.section`
  ${({ theme }) => css`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
    padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 4}px;
    border-bottom: 1px solid ${theme.colorBorderSecondary};
    background: ${theme.colorBgContainer};
  `}
`;

const Label = styled(Typography.Text)`
  ${({ theme }) => css`
    display: inline-flex;
    align-items: center;
    gap: ${theme.sizeUnit}px;
    font-size: ${theme.fontSizeSM}px;
  `}
`;

const KINDS: readonly ('filter' | 'crossFilter')[] = ['filter', 'crossFilter'];

function formatValue(raw: unknown): { column?: string; text: string } | null {
  if (raw === undefined || raw === null) return null;
  if (Array.isArray(raw)) {
    if (raw.length === 0) return null;
    if (raw.some(item => typeof item === 'object' && item !== null)) {
      const parts = raw
        .map(item => formatValue(item))
        .filter((v): v is { column?: string; text: string } => v !== null)
        .map(v => (v.column ? `${v.column}: ${v.text}` : v.text));
      return parts.length > 0 ? { text: parts.join(' · ') } : null;
    }
    return { text: raw.map(String).join(', ') };
  }
  if (typeof raw === 'object') {
    const record = raw as Record<string, unknown>;
    const column =
      typeof record.column === 'string' ? record.column : undefined;
    if (typeof record.timeRange === 'string') {
      return record.timeRange ? { column, text: record.timeRange } : null;
    }
    if (Array.isArray(record.values)) {
      if (record.values.length === 0) return null;
      return { column, text: record.values.map(String).join(', ') };
    }
    if (
      'value' in record &&
      record.value !== undefined &&
      record.value !== null
    ) {
      return { column, text: String(record.value) };
    }
    const keys = Object.keys(record);
    if (keys.length === 0) return null;
    return { column, text: JSON.stringify(record) };
  }
  const str = String(raw).trim();
  return str ? { text: str } : null;
}

/**
 * Compact bar summarizing active canvas filters and cross-filters, with
 * one-click removal per chip and a "Clear all" action.
 */
export default function ActiveFiltersBar({
  values,
  titles,
  onClear,
  onClearAll,
}: ActiveFiltersBarProps) {
  const chips: FilterChip[] = [];

  for (const kind of KINDS) {
    const entries = values[kind] ?? {};
    for (const [nodeId, raw] of Object.entries(entries)) {
      const formatted = formatValue(raw);
      if (!formatted) continue;
      chips.push({
        kind,
        nodeId,
        label: titles?.[nodeId] ?? formatted.column ?? nodeId,
        summary: formatted.text,
      });
    }
  }

  if (chips.length === 0) return null;

  return (
    <Bar aria-label={t('Active filters')}>
      <Label type="secondary">
        <Icons.FilterOutlined iconSize="s" />
        {t('Active filters')}
      </Label>
      {chips.map(chip => (
        <Tag
          key={`${chip.kind}:${chip.nodeId}`}
          color={chip.kind === 'crossFilter' ? 'blue' : undefined}
          closable
          onClose={() => onClear(chip.kind, chip.nodeId)}
        >
          {chip.label}: {chip.summary}
        </Tag>
      ))}
      <Button type="link" size="small" onClick={onClearAll}>
        {t('Clear all')}
      </Button>
    </Bar>
  );
}
