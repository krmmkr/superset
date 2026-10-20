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
/* eslint-disable jest-dom/prefer-to-have-style */

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

const buildChartProps = (formDataOverrides: Partial<QueryFormData> = {}) =>
  new ChartProps({
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

test('should transform default chart props correctly', () => {
  const chartProps = buildChartProps();
  const result = transformProps(chartProps as any);

  expect(result.width).toBe(800);
  expect(result.height).toBe(600);
  expect(result.groupby).toEqual(['region']);
  expect(result.s2DataConfig.fields.rows).toEqual(['region']);
  expect(result.s2DataConfig.fields.columns).toEqual(['category']);
  expect(result.s2DataConfig.fields.values).toEqual(['sales']);

  expect(result.s2Options.seriesNumber.enable).toBe(false);
  expect(result.s2Options.style.layoutWidthType).toBe('adaptive');
  expect(result.s2Options.tooltip.enable).toBe(true);
  expect(result.s2Options.style.rowCell.height).toBeUndefined();
  expect(result.s2Options.style.colCell.height).toBeUndefined();
});

test('should handle showSeriesNumber, layoutWidthType, and showTooltip', () => {
  const chartProps = buildChartProps({
    showSeriesNumber: true,
    layoutWidthType: 'compact',
    showTooltip: false,
  });
  const result = transformProps(chartProps as any);

  expect(result.s2Options.seriesNumber.enable).toBe(true);
  expect(result.s2Options.style.layoutWidthType).toBe('compact');
  expect(result.s2Options.tooltip.enable).toBe(false);
});

test('should map valid custom rowHeight and colHeight to style configs', () => {
  const chartProps = buildChartProps({
    rowHeight: '35',
    colHeight: '45',
  });
  const result = transformProps(chartProps as any);

  expect(result.s2Options.style.rowCell.height).toBe(35);
  expect(result.s2Options.style.dataCell.height).toBe(35);
  expect(result.s2Options.style.colCell.height).toBe(45);
});

test('should ignore invalid rowHeight and colHeight inputs', () => {
  const chartProps = buildChartProps({
    rowHeight: 'not-a-number',
    colHeight: '',
  });
  const result = transformProps(chartProps as any);

  expect(result.s2Options.style.rowCell.height).toBeUndefined();
  expect(result.s2Options.style.dataCell.height).toBeUndefined();
  expect(result.s2Options.style.colCell.height).toBeUndefined();
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
    metric_config: {
      sales: { d3NumberFormat: '.2%' },
    },
  });
  chartProps.queriesData[0].data = [
    { region: 'East', category: 'Furniture', sales: 100, profit: 50 },
  ];
  chartProps.queriesData[0].colnames = [
    'region',
    'category',
    'sales',
    'profit',
  ];
  chartProps.queriesData[0].coltypes = [1, 1, 0, 0];
  const result = transformProps(chartProps as any);

  // Check formatter mapping on meta values: sales should format to percentage
  const salesMeta = result.s2DataConfig.meta.find(
    (m: any) => m.field === 'sales',
  );
  expect(salesMeta.formatter).toBeDefined();
  expect(salesMeta.formatter(0.1234)).toBe('12.34%');

  // profit should fall back to default SMART_NUMBER ('1.23k' for 1234.56)
  const profitMeta = result.s2DataConfig.meta.find(
    (m: any) => m.field === 'profit',
  );
  expect(profitMeta.formatter).toBeDefined();
  expect(profitMeta.formatter(1234.56)).toBe('1.23k');
});

test('should exclude totals for metrics specified in excludeTotalsMetrics', () => {
  const chartProps = buildChartProps({
    metrics: ['sales', 'profit'],
    excludeTotalsMetrics: ['profit'],
  });
  const result = transformProps(chartProps as any);

  const { calcFunc } = result.s2Options.totals.row.calcGrandTotals;
  expect(calcFunc).toBeDefined();

  const salesVal = calcFunc({ $$extra$$: 'sales' }, [
    { sales: 10 },
    { sales: 20 },
  ]);
  expect(salesVal).toBe(30);

  const profitVal = calcFunc({ $$extra$$: 'profit' }, [
    { profit: 10 },
    { profit: 20 },
  ]);
  expect(profitVal).toBeNull();
});

test('should return null placeholder in formatter if value is null or undefined', () => {
  const chartProps = buildChartProps({
    metrics: ['sales'],
    null_placeholder: '-',
  });
  const result = transformProps(chartProps as any);
  const salesMeta = result.s2DataConfig.meta.find(
    (m: any) => m.field === 'sales',
  );

  expect(salesMeta.formatter(null)).toBe('-');
  expect(salesMeta.formatter(undefined)).toBe('-');
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

test('should ignore columnWidths when layoutWidthType is not custom', () => {
  const chartProps = buildChartProps({
    layoutWidthType: 'adaptive',
    dimension_config: {
      region: { columnWidth: 150 },
    },
    metric_config: {
      sales: { columnWidth: 120 },
    },
  });
  const result = transformProps(chartProps as any);

  expect(result.s2Options.style.layoutWidthType).toBe('adaptive');
  expect(result.s2Options.style.colCell.widthByField).toBeUndefined();
});

test('should exclude totals for metrics configured with excludeTotals in metric_config', () => {
  const chartProps = buildChartProps({
    metrics: ['sales', 'profit'],
    metric_config: {
      profit: { excludeTotals: true },
    },
  });
  const result = transformProps(chartProps as any);

  const { calcFunc } = result.s2Options.totals.row.calcGrandTotals;
  expect(calcFunc).toBeDefined();

  const salesVal = calcFunc({ $$extra$$: 'sales' }, [
    { sales: 10 },
    { sales: 20 },
  ]);
  expect(salesVal).toBe(30);

  const profitVal = calcFunc({ $$extra$$: 'profit' }, [
    { profit: 10 },
    { profit: 20 },
  ]);
  expect(profitVal).toBeNull();
});

test('should exclude dimensions from row/col subTotalsDimensions when showSubtotal is false in dimension_config', () => {
  const chartProps = buildChartProps({
    groupby: ['region', 'country', 'city'],
    columns: ['category', 'sub_category'],
    showRowSubtotals: true,
    showColSubtotals: true,
    dimension_config: {
      country: { showSubtotal: false },
      category: { showSubtotal: false },
    },
  });
  chartProps.queriesData[0].colnames = [
    'region',
    'country',
    'city',
    'category',
    'sub_category',
    'sales',
  ];
  chartProps.queriesData[0].coltypes = [1, 1, 1, 1, 1, 0];
  const result = transformProps(chartProps as any);

  expect(result.s2Options.totals.row.subTotalsDimensions).toEqual(['region']);
  expect(result.s2Options.totals.col.subTotalsDimensions).toEqual([]);
});

test('should map hide_measure_column correctly to s2Options.style.colCell', () => {
  const chartPropsDefault = buildChartProps();
  const resultDefault = transformProps(chartPropsDefault as any);
  expect(resultDefault.hideMeasureColumn).toBe(false);
  expect(resultDefault.s2Options.style.colCell.hideValue).toBe(false);
  expect(resultDefault.s2Options.style.colCell.hideMeasureColumn).toBe(false);

  const chartPropsHidden = buildChartProps({
    hide_measure_column: true,
  });
  const resultHidden = transformProps(chartPropsHidden as any);
  expect(resultHidden.hideMeasureColumn).toBe(true);
  expect(resultHidden.s2Options.style.colCell.hideValue).toBe(true);
  expect(resultHidden.s2Options.style.colCell.hideMeasureColumn).toBe(true);
});

test('should map metrics_layout correctly to s2DataConfig.fields.valueInCols', () => {
  const chartPropsCols = buildChartProps({ metrics_layout: 'columns' });
  const resultCols = transformProps(chartPropsCols as any);
  expect(resultCols.s2DataConfig.fields.valueInCols).toBe(true);

  const chartPropsRows = buildChartProps({ metrics_layout: 'rows' });
  const resultRows = transformProps(chartPropsRows as any);
  expect(resultRows.s2DataConfig.fields.valueInCols).toBe(false);
});

test('should map totals_position correctly to reverseGrandTotalsLayout and reverseSubTotalsLayout', () => {
  const chartPropsDefault = buildChartProps({
    totals_position: 'bottom_right',
  });
  const resultDefault = transformProps(chartPropsDefault as any);
  expect(resultDefault.s2Options.totals.row.reverseGrandTotalsLayout).toBe(
    false,
  );
  expect(resultDefault.s2Options.totals.row.reverseSubTotalsLayout).toBe(false);
  expect(resultDefault.s2Options.totals.col.reverseGrandTotalsLayout).toBe(
    false,
  );
  expect(resultDefault.s2Options.totals.col.reverseSubTotalsLayout).toBe(false);

  const chartPropsTopLeft = buildChartProps({ totals_position: 'top_left' });
  const resultTopLeft = transformProps(chartPropsTopLeft as any);
  expect(resultTopLeft.s2Options.totals.row.reverseGrandTotalsLayout).toBe(
    true,
  );
  expect(resultTopLeft.s2Options.totals.row.reverseSubTotalsLayout).toBe(true);
  expect(resultTopLeft.s2Options.totals.col.reverseGrandTotalsLayout).toBe(
    true,
  );
  expect(resultTopLeft.s2Options.totals.col.reverseSubTotalsLayout).toBe(true);
});

test('should preserve null values in s2Data instead of coercing to 0', () => {
  const chartProps = buildChartProps({
    metrics: ['sales', 'profit'],
    null_placeholder: 'N/A',
  });
  chartProps.queriesData[0].data = [
    { region: 'East', category: 'Furniture', sales: 100, profit: null },
    { region: 'West', category: null, sales: null, profit: 0 },
  ];
  chartProps.queriesData[0].colnames = [
    'region',
    'category',
    'sales',
    'profit',
  ];
  chartProps.queriesData[0].coltypes = [1, 1, 0, 0];

  const result = transformProps(chartProps as any);
  expect(result.s2DataConfig.data[0].profit).toBeNull();
  expect(result.s2DataConfig.data[1].sales).toBeNull();
  expect(result.s2DataConfig.data[1].profit).toBe(0);
  expect(result.s2DataConfig.data[1].category).toBe('');

  const profitMeta = result.s2DataConfig.meta.find(
    (m: any) => m.field === 'profit',
  );
  expect(profitMeta.formatter(null)).toBe('N/A');
});

test('should generate static threshold conditions for background and text', () => {
  const chartProps = buildChartProps({
    enhanced_conditional_formatting: [
      {
        id: '1',
        column: 'sales',
        ruleType: 'threshold',
        operator: '>',
        compareTarget: 'static',
        targetValue: 150,
        color: '#ff0000',
        applyTo: 'background',
      },
      {
        id: '2',
        column: 'sales',
        ruleType: 'threshold',
        operator: '<=',
        compareTarget: 'static',
        targetValue: 150,
        color: '#0000ff',
        applyTo: 'text',
      },
    ],
  });

  const result = transformProps(chartProps as any);
  const bgCond = result.s2Options.conditions.background.find(
    (c: any) => c.field === 'sales',
  );
  expect(bgCond).toBeDefined();
  expect(bgCond.mapping(200)).toEqual({ fill: '#ff0000' });
  expect(bgCond.mapping(100)).toBeNull();

  const textCond = result.s2Options.conditions.text.find(
    (c: any) => c.field === 'sales',
  );
  expect(textCond).toBeDefined();
  expect(textCond.mapping(150)).toEqual({ fill: '#0000ff' });
  expect(textCond.mapping(100)).toEqual({ fill: '#0000ff' });
  expect(textCond.mapping(200)).toBeNull();
});

test('should generate cross-column dynamic threshold conditions', () => {
  const chartProps = buildChartProps({
    enhanced_conditional_formatting: [
      {
        id: 'cross-1',
        column: 'sales',
        ruleType: 'threshold',
        operator: '>',
        compareTarget: 'column',
        targetColumn: 'profit',
        color: '#00ff00',
        applyTo: 'background',
      },
    ],
  });

  const result = transformProps(chartProps as any);
  const bgCond = result.s2Options.conditions.background.find(
    (c: any) => c.field === 'sales',
  );
  expect(bgCond).toBeDefined();

  // sales = 200, profit = 100 -> matched
  expect(bgCond.mapping(200, { profit: 100 })).toEqual({ fill: '#00ff00' });
  // sales = 100, profit = 200 -> not matched
  expect(bgCond.mapping(100, { profit: 200 })).toBeNull();
  // missing target column in row data -> null
  expect(bgCond.mapping(100, {})).toBeNull();
});

test('should generate color scale heatmap conditions with min/max interpolation', () => {
  const chartProps = buildChartProps({
    enhanced_conditional_formatting: [
      {
        id: 'scale-1',
        column: 'sales',
        ruleType: 'colorScale',
        minColor: '#ffffff',
        maxColor: '#000000',
      },
    ],
  });

  const result = transformProps(chartProps as any);
  const bgCond = result.s2Options.conditions.background.find(
    (c: any) => c.field === 'sales',
  );
  expect(bgCond).toBeDefined();

  // In test data, sales are 100 and 200.
  // min = 100 -> ratio 0 -> rgb(255, 255, 255)
  expect(bgCond.mapping(100)).toEqual({ fill: 'rgb(255, 255, 255)' });
  // max = 200 -> ratio 1 -> rgb(0, 0, 0)
  expect(bgCond.mapping(200)).toEqual({ fill: 'rgb(0, 0, 0)' });
  // midpoint = 150 -> ratio 0.5 -> intermediate rgb
  const midResult = bgCond.mapping(150);
  expect(midResult).toBeDefined();
  expect(midResult.fill).toMatch(/^rgb\(\d+,\s*\d+,\s*\d+\)$/i);
  expect(midResult.fill).not.toBe('rgb(255, 255, 255)');
  expect(midResult.fill).not.toBe('rgb(0, 0, 0)');
});

test('should support opacity / transparency in threshold rules', () => {
  const chartProps = buildChartProps({
    enhanced_conditional_formatting: [
      {
        id: 'opacity-1',
        column: 'sales',
        ruleType: 'threshold',
        operator: '>',
        compareTarget: 'static',
        targetValue: 150,
        color: '#ff0000',
        opacity: 0.4,
        applyTo: 'background',
      },
    ],
  });

  const result = transformProps(chartProps as any);
  const bgCond = result.s2Options.conditions.background.find(
    (c: any) => c.field === 'sales',
  );
  expect(bgCond).toBeDefined();
  expect(bgCond.mapping(200)).toEqual({ fill: 'rgba(255, 0, 0, 0.4)' });
  expect(bgCond.mapping(100)).toBeNull();
});

test('should support dimension rules with string operators (=, !=, contains, starts_with)', () => {
  const chartProps = buildChartProps({
    enhanced_conditional_formatting: [
      {
        id: 'dim-exact',
        column: 'region',
        ruleType: 'threshold',
        operator: '=',
        compareTarget: 'static',
        targetValueText: 'East',
        color: '#1890ff',
        opacity: 0.5,
        applyTo: 'background',
      },
      {
        id: 'dim-contains',
        column: 'category',
        ruleType: 'threshold',
        operator: 'contains',
        compareTarget: 'static',
        targetValueText: 'Office',
        color: '#52c41a',
        applyTo: 'text',
      },
      {
        id: 'dim-starts',
        column: 'region',
        ruleType: 'threshold',
        operator: 'starts_with',
        compareTarget: 'static',
        targetValueText: 'We',
        color: '#faad14',
        applyTo: 'background',
      },
    ],
  });

  const result = transformProps(chartProps as any);
  const regionCond = result.s2Options.conditions.background.find(
    (c: any) => c.field === 'region',
  );
  expect(regionCond).toBeDefined();
  expect(regionCond.mapping('East')).toEqual({
    fill: 'rgba(24, 144, 255, 0.5)',
  });
  expect(regionCond.mapping('West')).toBeNull();

  const catCond = result.s2Options.conditions.text.find(
    (c: any) => c.field === 'category',
  );
  expect(catCond).toBeDefined();
  expect(catCond.mapping('Office Supplies')).toEqual({ fill: '#52c41a' });
  expect(catCond.mapping('Furniture')).toBeNull();

  // Test starts_with rule
  const startsCond = result.s2Options.conditions.background.filter(
    (c: any) => c.field === 'region',
  )[1];
  expect(startsCond).toBeDefined();
  expect(startsCond.mapping('West')).toEqual({ fill: '#faad14' });
  expect(startsCond.mapping('East')).toBeNull();
});

test('should support color scale with min and max opacity gradients', () => {
  const chartProps = buildChartProps({
    enhanced_conditional_formatting: [
      {
        id: 'scale-opacity',
        column: 'sales',
        ruleType: 'colorScale',
        minColor: '#ffffff',
        maxColor: '#000000',
        minOpacity: 0.2,
        maxOpacity: 0.8,
      },
    ],
  });

  const result = transformProps(chartProps as any);
  const bgCond = result.s2Options.conditions.background.find(
    (c: any) => c.field === 'sales',
  );
  expect(bgCond).toBeDefined();

  // min (100) -> ratio 0 -> rgba(255, 255, 255, 0.2)
  expect(bgCond.mapping(100)).toEqual({ fill: 'rgba(255, 255, 255, 0.2)' });
  // max (200) -> ratio 1 -> rgba(0, 0, 0, 0.8)
  expect(bgCond.mapping(200)).toEqual({ fill: 'rgba(0, 0, 0, 0.8)' });
  // midpoint (150) -> ratio 0.5 -> alpha around 0.5
  const midResult = bgCond.mapping(150);
  expect(midResult).toBeDefined();
  expect(midResult.fill).toMatch(/^rgba\(\d+,\s*\d+,\s*\d+,\s*0\.5\)$/);
});

test('should support icon conditions for threshold rules with vector icons and position', () => {
  const chartProps = buildChartProps({
    enhanced_conditional_formatting: [
      {
        id: 'icon-up',
        column: 'sales',
        ruleType: 'threshold',
        operator: '>',
        compareTarget: 'static',
        targetValue: 150,
        color: '#52c41a',
        applyTo: 'icon',
        iconName: 'trend-up',
        iconPosition: 'left',
      },
      {
        id: 'icon-down',
        column: 'sales',
        ruleType: 'threshold',
        operator: '<',
        compareTarget: 'static',
        targetValue: 150,
        color: '#ff4d4f',
        applyTo: 'icon',
        iconName: 'trend-down',
        iconPosition: 'right',
      },
    ],
  });

  const result = transformProps(chartProps as any);
  const iconConditions = result.s2Options.conditions.icon;
  expect(iconConditions).toBeDefined();
  expect(iconConditions.length).toBe(2);

  // Up icon (position: left)
  const upCond = iconConditions[0];
  expect(upCond.field).toBe('sales');
  expect(upCond.position).toBe('left');
  expect(upCond.mapping(200)).toEqual({ fill: '#52c41a', icon: 'trend-up' });
  expect(upCond.mapping(100)).toBeNull();

  // Down icon (position: right)
  const downCond = iconConditions[1];
  expect(downCond.field).toBe('sales');
  expect(downCond.position).toBe('right');
  expect(downCond.mapping(100)).toEqual({
    fill: '#ff4d4f',
    icon: 'trend-down',
  });
  expect(downCond.mapping(200)).toBeNull();

  // Verify customSVGIcons are registered in s2Options
  expect(result.s2Options.customSVGIcons).toBeDefined();
  const iconNames = result.s2Options.customSVGIcons.map(
    (item: any) => item.name,
  );
  expect(iconNames).toContain('trend-up');
  expect(iconNames).toContain('trend-down');
});

test('should support custom prefix in icon conditions', () => {
  const chartProps = buildChartProps({
    enhanced_conditional_formatting: [
      {
        id: 'custom-prefix-rule',
        column: 'sales',
        ruleType: 'threshold',
        operator: '>',
        compareTarget: 'static',
        targetValue: 100,
        color: '#1890ff',
        applyTo: 'icon',
        iconName: 'custom',
        customPrefix: '$',
        iconPosition: 'left',
      },
    ],
  });

  const result = transformProps(chartProps as any);
  const iconConditions = result.s2Options.conditions.icon;
  expect(iconConditions).toBeDefined();
  expect(iconConditions.length).toBe(1);

  const prefixCond = iconConditions[0];
  expect(prefixCond.field).toBe('sales');
  expect(prefixCond.position).toBe('left');

  const matchResult = prefixCond.mapping(150);
  expect(matchResult).toBeDefined();
  expect(matchResult.fill).toBe('#1890ff');
  expect(matchResult.icon).toBe('custom_custom-prefix-rule');

  // Verify custom SVG was registered
  const customSvg = result.s2Options.customSVGIcons.find(
    (item: any) => item.name === 'custom_custom-prefix-rule',
  );
  expect(customSvg).toBeDefined();
  expect(customSvg.src).toContain('<text');
  expect(customSvg.src).toContain('$</text>');
});

test('should handle edge cases in isRuleMatched: null values, negative numbers, and non-numeric inputs', () => {
  const chartProps = buildChartProps({
    enhanced_conditional_formatting: [
      {
        id: 'negative-test',
        column: 'profit',
        ruleType: 'threshold',
        operator: '<',
        compareTarget: 'static',
        targetValue: 0,
        color: '#ff4d4f',
        applyTo: 'background',
      },
      {
        id: 'between-negative',
        column: 'profit',
        ruleType: 'threshold',
        operator: 'between',
        compareTarget: 'static',
        targetValue: -50,
        targetValueRight: 50,
        color: '#faad14',
        applyTo: 'text',
      },
    ],
  });

  const result = transformProps(chartProps as any);
  const bgCond = result.s2Options.conditions.background.find(
    (c: any) => c.field === 'profit',
  );
  const textCond = result.s2Options.conditions.text.find(
    (c: any) => c.field === 'profit',
  );

  expect(bgCond).toBeDefined();
  expect(textCond).toBeDefined();

  // Null or undefined value returns null
  expect(bgCond.mapping(null)).toBeNull();
  expect(bgCond.mapping(undefined)).toBeNull();

  // Non-numeric string on numeric rule returns null
  expect(bgCond.mapping('invalid-number')).toBeNull();

  // Negative value matching
  expect(bgCond.mapping(-20)).toEqual({ fill: '#ff4d4f' });
  expect(bgCond.mapping(10)).toBeNull();

  // Between negative range (-50 < val < 50)
  expect(textCond.mapping(0)).toEqual({ fill: '#faad14' });
  expect(textCond.mapping(-30)).toEqual({ fill: '#faad14' });
  expect(textCond.mapping(-60)).toBeNull();
  expect(textCond.mapping(60)).toBeNull();
});
