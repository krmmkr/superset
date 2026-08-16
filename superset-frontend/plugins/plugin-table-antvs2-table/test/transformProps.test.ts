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
  metrics: ['sales'],
  theme: 'default' as const,
  showSortControls: true,
  emitFilter: true,
  crossfilterColumns: [],
  advancedS2Options: '{}',
  viz_type: 'custom_s2_table_plugin',
  datasource: '1__table',
};

const buildChartProps = (formDataOverrides: Partial<QueryFormData> = {}) =>
  new ChartProps({
    formData: { ...baseFormData, ...formDataOverrides },
    width: 800,
    height: 600,
    queriesData: [
      {
        data: [
          { region: 'East', sales: 100 },
          { region: 'West', sales: 200 },
        ],
        colnames: ['region', 'sales'],
        coltypes: [1, 0],
      },
    ],
    hooks: { setDataMask },
    filterState: { selectedFilters: {} },
    datasource: { verboseMap: {}, columnFormats: {} },
    theme: {} as any,
  });

test('should transform default chart props correctly for flat TableSheet', () => {
  const chartProps = buildChartProps();
  const result = transformProps(chartProps as any);

  expect(result.width).toBe(800);
  expect(result.height).toBe(600);
  expect(result.groupby).toEqual(['region']);
  expect(result.s2DataConfig.fields.columns).toEqual(['region', 'sales']);

  expect(result.s2Options.showSeriesNumber).toBe(false);
  expect(result.s2Options.style.layoutWidthType).toBe('adaptive');
  expect(result.s2Options.tooltip.enable).toBe(true);
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

test('should map separate alignment configurations correctly', () => {
  const chartProps = buildChartProps({
    defaultDimensionAlign: 'center',
    defaultMetricAlign: 'left',
    dimension_config: {
      region: { horizontalAlign: 'left' },
    },
    metric_config: {
      sales: { horizontalAlign: 'right' },
    },
  });
  const result = transformProps(chartProps as any);

  expect(result.defaultDimensionAlign).toBe('center');
  expect(result.defaultMetricAlign).toBe('left');
  expect(result.columnAlignmentsObj).toEqual({
    region: 'left',
    sales: 'right',
  });
});

test('should map number formatting correctly', () => {
  const chartProps = buildChartProps({
    metrics: ['sales'],
    metric_config: {
      sales: { d3NumberFormat: '.2%' },
    },
  });
  const result = transformProps(chartProps as any);

  const salesMeta = result.s2DataConfig.meta.find(
    (m: any) => m.field === 'sales',
  );
  expect(salesMeta.formatter).toBeDefined();
  expect(salesMeta.formatter(0.1234)).toBe('12.34%');
});

test('should map columnWidths when layoutWidthType is custom', () => {
  const chartProps = buildChartProps({
    layoutWidthType: 'custom',
    dimension_config: {
      region: { columnWidth: 150 },
    },
    metric_config: {
      sales: { columnWidth: 120 },
    },
  });
  const result = transformProps(chartProps as any);

  expect(result.s2Options.style.layoutWidthType).toBe('compact');
  expect(result.s2Options.style.colCell.widthByField).toEqual({
    region: 150,
    sales: 120,
  });
});

test('should generate mergedCellsInfo when enableRowspan is true', () => {
  const customChartProps = new ChartProps({
    formData: {
      ...baseFormData,
      enableRowspan: true,
      groupby: ['region', 'state'],
      metrics: ['sales'],
    },
    width: 800,
    height: 600,
    queriesData: [
      {
        data: [
          { region: 'East', state: 'NY', sales: 100 },
          { region: 'East', state: 'NY', sales: 200 },
          { region: 'East', state: 'MA', sales: 300 },
          { region: 'West', state: 'CA', sales: 400 },
        ],
        colnames: ['region', 'state', 'sales'],
        coltypes: [1, 1, 0],
      },
    ],
    hooks: { setDataMask },
    filterState: { selectedFilters: {} },
    datasource: { verboseMap: {}, columnFormats: {} },
    theme: {} as any,
  });

  const result = transformProps(customChartProps as any);

  expect(result.s2Options.mergedCellsInfo).toBeDefined();

  // region run East: rows 0-2 (length 3)
  const regionMerge = result.s2Options.mergedCellsInfo.find(
    (cells: any) => cells[0].colIndex === 0 && cells[0].rowIndex === 0,
  );
  expect(regionMerge).toHaveLength(3);
  expect(regionMerge[0]).toEqual({ rowIndex: 0, colIndex: 0, showText: true });
  expect(regionMerge[1]).toEqual({ rowIndex: 1, colIndex: 0, showText: false });
  expect(regionMerge[2]).toEqual({ rowIndex: 2, colIndex: 0, showText: false });

  // state run NY: rows 0-1 (length 2)
  const stateMerge = result.s2Options.mergedCellsInfo.find(
    (cells: any) => cells[0].colIndex === 1 && cells[0].rowIndex === 0,
  );
  expect(stateMerge).toHaveLength(2);
  expect(stateMerge[0]).toEqual({ rowIndex: 0, colIndex: 1, showText: true });
  expect(stateMerge[1]).toEqual({ rowIndex: 1, colIndex: 1, showText: false });
});

test('should generate metricColsSet correctly', () => {
  const chartProps = buildChartProps();
  const result = transformProps(chartProps as any);

  expect(result.metricColsSet).toBeDefined();
  expect(result.metricColsSet.has('sales')).toBe(true);
  expect(result.metricColsSet.has('region')).toBe(false);
});

