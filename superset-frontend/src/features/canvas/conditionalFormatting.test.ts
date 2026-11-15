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
import type { SupersetTheme } from '@apache-superset/core/theme';
import {
  computeColumnBounds,
  evaluateConditionalStyle,
  formatCellValue,
  formatDatePattern,
} from './conditionalFormatting';

const mockTheme = {
  colorSuccessText: '#135200',
  colorSuccessBg: '#f6ffed',
  colorWarningText: '#ad6800',
  colorWarningBg: '#fffbe6',
  colorErrorText: '#a8071a',
  colorErrorBg: '#fff1f0',
  colorInfoText: '#0050b3',
  colorInfoBg: '#e6f4ff',
} as unknown as SupersetTheme;

test('formatCellValue formats numbers with prefix, suffix, and decimals', () => {
  expect(formatCellValue(1234.5, { prefix: '$', decimals: 0 })).toBe('$1,235');
  expect(formatCellValue(42.156, { suffix: '%', decimals: 1 })).toBe('42.2%');
  expect(formatCellValue('EMEA')).toBe('EMEA');
  expect(formatCellValue(null)).toBe('');
});

test('evaluateConditionalStyle applies threshold tones, contains, and colorScale', () => {
  const rows = [{ sales: 100 }, { sales: 500 }, { sales: 1000 }];
  const bounds = computeColumnBounds(rows, ['sales']);

  const rules = [
    {
      column: 'sales',
      operator: 'gte' as const,
      value: 800,
      tone: 'success' as const,
    },
    {
      column: 'sales',
      operator: 'between' as const,
      value: 300,
      valueTo: 799,
      tone: 'info' as const,
    },
    {
      column: 'sales',
      operator: 'lt' as const,
      value: 300,
      tone: 'warning' as const,
    },
    {
      column: 'status',
      operator: 'contains' as const,
      value: 'Cancel',
      tone: 'error' as const,
    },
  ];

  expect(
    evaluateConditionalStyle(950, rules, 'sales', bounds, mockTheme),
  ).toEqual({
    color: '#135200',
    backgroundColor: '#f6ffed',
    fontWeight: 500,
  });
  expect(
    evaluateConditionalStyle(500, rules, 'sales', bounds, mockTheme),
  ).toEqual({
    color: '#0050b3',
    backgroundColor: '#e6f4ff',
    fontWeight: 500,
  });
  expect(
    evaluateConditionalStyle(100, rules, 'sales', bounds, mockTheme),
  ).toEqual({
    color: '#ad6800',
    backgroundColor: '#fffbe6',
    fontWeight: 500,
  });
  expect(
    evaluateConditionalStyle('Cancelled', rules, 'status', bounds, mockTheme),
  ).toEqual({
    color: '#a8071a',
    backgroundColor: '#fff1f0',
    fontWeight: 500,
  });

  const heatStyle = evaluateConditionalStyle(
    1000,
    [{ operator: 'colorScale' }],
    'sales',
    bounds,
    mockTheme,
  );
  expect(heatStyle?.backgroundColor).toBe('rgba(24, 144, 255, 0.40)');
});

test('formatDatePattern handles epoch ms numbers and stringified epoch ms', () => {
  expect(formatDatePattern(1041379200000, 'YYYY-MM-DD')).toBe('2003-01-01');
  expect(formatDatePattern('1041379200000', 'YYYY-MM-DD')).toBe('2003-01-01');
  expect(formatDatePattern('2003-01-01T00:00:00', 'YYYY-MM-DD')).toBe(
    '2003-01-01',
  );
  expect(formatDatePattern('not-a-date', 'YYYY-MM-DD')).toBe('not-a-date');
});
