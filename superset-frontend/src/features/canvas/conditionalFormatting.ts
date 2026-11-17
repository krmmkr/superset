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
import type { CSSProperties } from 'react';
import type { SupersetTheme } from '@apache-superset/core/theme';

export type ConditionalOperator =
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'eq'
  | 'between'
  | 'contains'
  | 'colorScale';

export type ConditionalTone = 'success' | 'warning' | 'error' | 'info';

export interface ConditionalFormatRule {
  column?: string;
  operator: ConditionalOperator;
  value?: number | string;
  valueTo?: number;
  tone?: ConditionalTone;
  color?: string;
  backgroundColor?: string;
}

export interface ColumnFormatDef {
  field?: string;
  headerName?: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  dateFormat?: string;
}

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * Formats a date/timestamp value according to a lightweight pattern
 * (`YYYY`, `YY`, `MMM`, `MM`, `M`, `DD`, `D`, `HH`, `mm`), returning the
 * original string if the value is not a valid date.
 */
export function formatDatePattern(value: unknown, pattern: string): string {
  if (value === null || value === undefined || !pattern) {
    return value === null || value === undefined ? '' : String(value);
  }
  const normalized =
    typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value.trim())
      ? Number(value.trim())
      : value;
  const date =
    normalized instanceof Date
      ? normalized
      : typeof normalized === 'number' || typeof normalized === 'string'
        ? new Date(normalized)
        : null;
  if (!date || Number.isNaN(date.getTime())) return String(value);
  const yyyy = String(date.getUTCFullYear());
  const yy = yyyy.slice(-2);
  const m = date.getUTCMonth();
  const mm = String(m + 1).padStart(2, '0');
  const d = date.getUTCDate();
  const dd = String(d).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const min = String(date.getUTCMinutes()).padStart(2, '0');
  return pattern.replace(
    /YYYY|YY|MMM|MM|M|DD|D|HH|mm/g,
    token =>
      ({
        YYYY: yyyy,
        YY: yy,
        MMM: MONTHS_SHORT[m],
        MM: mm,
        M: String(m + 1),
        DD: dd,
        D: String(d),
        HH: hh,
        mm: min,
      })[token] ?? token,
  );
}

export type NumericBounds = Record<string, { min: number; max: number }>;

export function computeColumnBounds(
  rows: Record<string, unknown>[],
  columns: string[],
): NumericBounds {
  const bounds: NumericBounds = {};
  for (const col of columns) {
    let min = Infinity;
    let max = -Infinity;
    for (const row of rows) {
      const val = row[col];
      if (typeof val === 'number' && Number.isFinite(val)) {
        if (val < min) min = val;
        if (val > max) max = val;
      }
    }
    if (Number.isFinite(min) && Number.isFinite(max)) {
      bounds[col] = { min, max };
    }
  }
  return bounds;
}

export function formatCellValue(
  value: unknown,
  def?: Pick<ColumnFormatDef, 'prefix' | 'suffix' | 'decimals' | 'dateFormat'>,
): string {
  if (value === null || value === undefined) return '';
  if (def?.dateFormat) {
    return formatDatePattern(value, def.dateFormat);
  }
  if (typeof value === 'number') {
    const decimals = typeof def?.decimals === 'number' ? def.decimals : 2;
    const hasExplicitDecimals = typeof def?.decimals === 'number';
    const formatted = value.toLocaleString(undefined, {
      minimumFractionDigits: hasExplicitDecimals ? decimals : 0,
      maximumFractionDigits: decimals,
    });
    return `${def?.prefix ?? ''}${formatted}${def?.suffix ?? ''}`;
  }
  return String(value);
}

function toneColors(
  tone: ConditionalTone | undefined,
  theme: SupersetTheme,
): { color?: string; backgroundColor?: string } {
  switch (tone) {
    case 'success':
      return {
        color: theme.colorSuccessText,
        backgroundColor: theme.colorSuccessBg,
      };
    case 'warning':
      return {
        color: theme.colorWarningText,
        backgroundColor: theme.colorWarningBg,
      };
    case 'error':
      return {
        color: theme.colorErrorText,
        backgroundColor: theme.colorErrorBg,
      };
    case 'info':
      return { color: theme.colorInfoText, backgroundColor: theme.colorInfoBg };
    default:
      return {};
  }
}

function matchesRule(value: unknown, rule: ConditionalFormatRule): boolean {
  if (rule.operator === 'contains') {
    if (rule.value === undefined) return false;
    return String(value ?? '')
      .toLowerCase()
      .includes(String(rule.value).toLowerCase());
  }
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return false;
  const target = Number(rule.value);
  if (!Number.isFinite(target) && rule.operator !== 'colorScale') return false;

  switch (rule.operator) {
    case 'gt':
      return num > target;
    case 'gte':
      return num >= target;
    case 'lt':
      return num < target;
    case 'lte':
      return num <= target;
    case 'eq':
      return num === target;
    case 'between': {
      const upper = Number(rule.valueTo);
      return Number.isFinite(upper) && num >= target && num <= upper;
    }
    case 'colorScale':
      return true;
    default:
      return false;
  }
}

/**
 * Evaluates conditional formatting rules for a single cell and returns inline
 * CSS properties (color, backgroundColor, fontWeight) when a rule matches.
 */
export function evaluateConditionalStyle(
  value: unknown,
  rules: ConditionalFormatRule[],
  column: string,
  bounds: NumericBounds,
  theme: SupersetTheme,
): CSSProperties | undefined {
  for (const rule of rules) {
    if (rule.column && rule.column !== column) continue;
    if (!matchesRule(value, rule)) continue;

    if (rule.operator === 'colorScale') {
      const num = typeof value === 'number' ? value : Number(value);
      const range = bounds[column];
      if (!Number.isFinite(num) || !range) continue;
      const span = range.max - range.min;
      const ratio =
        span > 0 ? Math.max(0, Math.min(1, (num - range.min) / span)) : 0.5;
      const alpha = (0.08 + ratio * 0.32).toFixed(2);
      return {
        backgroundColor: rule.backgroundColor || `rgba(24, 144, 255, ${alpha})`,
        color: rule.color,
      };
    }

    const fromTone = toneColors(rule.tone, theme);
    const color = rule.color ?? fromTone.color;
    const backgroundColor = rule.backgroundColor ?? fromTone.backgroundColor;
    if (color || backgroundColor) {
      return {
        color,
        backgroundColor,
        fontWeight: 500,
      };
    }
  }
  return undefined;
}
