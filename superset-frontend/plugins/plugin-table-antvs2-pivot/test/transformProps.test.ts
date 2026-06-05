/*
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

import { ChartProps, QueryFormData } from '@superset-ui/core';
import transformProps from '../src/transformProps';

const setDataMask = jest.fn();

const baseFormData = {
  groupby: ['region'],
  columns: ['category'],
  metrics: ['sales'],
  tableMode: 'grid' as const,
  theme: 'default' as const,
  totalLabel: 'Grand Total',
  showRowTotals: true,
  showRowSubtotals: false,
  showColTotals: true,
  showColSubtotals: false,
  showSortControls: true,
  emitFilter: true,
  crossfilterColumns: [],
  advancedS2Options: '{}',
  columnAggregations: '{}',
  viz_type: 'custom_s2_table_plugin',
  datasource: '1__table',
};

const buildChartProps = (formDataOverrides: Partial<QueryFormData> = {}) => {
  return new ChartProps({
    formData: { ...baseFormData, ...formDataOverrides },
    width: 800,
    height: 600,
    queriesData: [
      {
        data: [
          { region: 'East', category: 'Furniture', sales: 100 },
          { region: 'West', category: 'Office Supplies', sales: 200 },
        ],
        colnames: ['region', 'category', 'sales'],
        coltypes: [1, 1, 0],
      },
    ],
    hooks: { setDataMask },
    filterState: { selectedFilters: {} },
    datasource: { verboseMap: {}, columnFormats: {} },
    theme: {} as any,
  });
};

test('should transform default chart props correctly', () => {
  const chartProps = buildChartProps();
  const result = transformProps(chartProps as any);

  expect(result.width).toBe(800);
  expect(result.height).toBe(600);
  expect(result.groupby).toEqual(['region']);
  expect(result.s2DataConfig.fields.rows).toEqual(['region']);
  expect(result.s2DataConfig.fields.columns).toEqual(['category']);
  expect(result.s2DataConfig.fields.values).toEqual(['sales']);

  expect(result.s2Options.showSeriesNumber).toBe(false);
  expect(result.s2Options.style.layoutWidthType).toBe('adaptive');
  expect(result.s2Options.tooltip.enable).toBe(true);
  expect(result.s2Options.style.rowCfg).toBeUndefined();
  expect(result.s2Options.style.colCfg.height).toBeUndefined();
});

test('should handle showSeriesNumber, layoutWidthType, and showTooltip', () => {
  const chartProps = buildChartProps({
    showSeriesNumber: true,
    layoutWidthType: 'compact',
    showTooltip: false,
  });
  const result = transformProps(chartProps as any);

  expect(result.s2Options.showSeriesNumber).toBe(true);
  expect(result.s2Options.style.layoutWidthType).toBe('compact');
  expect(result.s2Options.tooltip.enable).toBe(false);
});

test('should map valid custom rowHeight and colHeight to style configs', () => {
  const chartProps = buildChartProps({
    rowHeight: '35',
    colHeight: '45',
  });
  const result = transformProps(chartProps as any);

  expect(result.s2Options.style.rowCfg.height).toBe(35);
  expect(result.s2Options.style.cellCfg.height).toBe(35);
  expect(result.s2Options.style.colCfg.height).toBe(45);
});

test('should ignore invalid rowHeight and colHeight inputs', () => {
  const chartProps = buildChartProps({
    rowHeight: 'not-a-number',
    colHeight: '',
  });
  const result = transformProps(chartProps as any);

  expect(result.s2Options.style.rowCfg).toBeUndefined();
  expect(result.s2Options.style.cellCfg).toBeUndefined();
  expect(result.s2Options.style.colCfg.height).toBeUndefined();
});

test('should map separate alignment configurations correctly', () => {
  const chartProps = buildChartProps({
    defaultDimensionAlign: 'center',
    defaultMetricAlign: 'left',
    columnAlignments: '{"region": "left", "sales": "right"}',
  });
  const result = transformProps(chartProps as any);

  expect(result.defaultDimensionAlign).toBe('center');
  expect(result.defaultMetricAlign).toBe('left');
  expect(result.columnAlignmentsObj).toEqual({
    region: 'left',
    sales: 'right',
  });
});

test('should map headerColor configuration correctly', () => {
  const chartProps = buildChartProps({
    headerColor: { r: 100, g: 150, b: 200, a: 0.5 },
  });
  const result = transformProps(chartProps as any);

  expect(result.headerColor).toBe('rgba(100, 150, 200, 0.5)');
  expect(result.headerColorObj).toEqual({ r: 100, g: 150, b: 200, a: 0.5 });
});

test('should map number formatting correctly', () => {
  const chartProps = buildChartProps({
    metrics: ['sales', 'profit'],
    columnFormats: '{"sales": ".2%"}',
  });
  chartProps.queriesData[0].data = [
    { region: 'East', category: 'Furniture', sales: 100, profit: 50 },
  ];
  chartProps.queriesData[0].colnames = ['region', 'category', 'sales', 'profit'];
  chartProps.queriesData[0].coltypes = [1, 1, 0, 0];
  const result = transformProps(chartProps as any);

  // Check formatter mapping on meta values: sales should format to percentage
  const salesMeta = result.s2DataConfig.meta.find((m: any) => m.field === 'sales');
  expect(salesMeta.formatter).toBeDefined();
  expect(salesMeta.formatter(0.1234)).toBe('12.34%');

  // profit should fall back to default SMART_NUMBER ('1.23k' for 1234.56)
  const profitMeta = result.s2DataConfig.meta.find((m: any) => m.field === 'profit');
  expect(profitMeta.formatter).toBeDefined();
  expect(profitMeta.formatter(1234.56)).toBe('1.23k');
});

test('should exclude totals for metrics specified in excludeTotalsMetrics', () => {
  const chartProps = buildChartProps({
    metrics: ['sales', 'profit'],
    excludeTotalsMetrics: ['profit'],
  });
  const result = transformProps(chartProps as any);

  const calcFunc = result.s2Options.totals.row.calcTotals.calcFunc;
  expect(calcFunc).toBeDefined();

  const salesVal = calcFunc({ '$$extra$$': 'sales' }, [{ sales: 10 }, { sales: 20 }]);
  expect(salesVal).toBe(30);

  const profitVal = calcFunc({ '$$extra$$': 'profit' }, [{ profit: 10 }, { profit: 20 }]);
  expect(profitVal).toBeNull();
});

test('should return empty string in formatter if value is null or undefined', () => {
  const chartProps = buildChartProps({
    metrics: ['sales'],
  });
  const result = transformProps(chartProps as any);
  const salesMeta = result.s2DataConfig.meta.find((m: any) => m.field === 'sales');

  expect(salesMeta.formatter(null)).toBe('');
  expect(salesMeta.formatter(undefined)).toBe('');
});

test('should map columnWidths when layoutWidthType is custom', () => {
  const chartProps = buildChartProps({
    layoutWidthType: 'custom',
    columnWidths: '{"region": 150, "sales": 120}',
  });
  const result = transformProps(chartProps as any);

  expect(result.s2Options.style.layoutWidthType).toBe('compact');
  expect(result.s2Options.style.colCell.widthByField).toEqual({
    region: 150,
    sales: 120,
  });
});

test('should ignore columnWidths when layoutWidthType is not custom', () => {
  const chartProps = buildChartProps({
    layoutWidthType: 'adaptive',
    columnWidths: '{"region": 150, "sales": 120}',
  });
  const result = transformProps(chartProps as any);

  expect(result.s2Options.style.layoutWidthType).toBe('adaptive');
  expect(result.s2Options.style.colCell.widthByField).toBeUndefined();
});
