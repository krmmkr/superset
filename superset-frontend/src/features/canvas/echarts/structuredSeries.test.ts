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
import { applyStructuredChrome } from './chrome';
import { applyRowDrivenChart, applyStructuredSeries } from './structuredSeries';

test('without a chart type the option is left as authored', () => {
  const option = { series: [{ type: 'pie' }] };

  expect(applyStructuredSeries(option, { chartType: null })).toBe(option);
});

test('a chart type draws one series per metric over the first dimension', () => {
  const option = applyStructuredSeries(
    { xAxis: { type: 'category' }, yAxis: { name: 'Births' } },
    {
      chartType: 'line',
      dataBinding: {
        metrics: ['sum__num', { label: 'Girls' }],
        dimensions: ['ds'],
      },
      customize: { series: { Girls: { color: '#f00', displayName: 'F' } } },
    },
  );

  expect(option.xAxis).toEqual({
    type: 'category',
    data: { $bind: { source: 'dimension', alias: 'ds' } },
  });
  expect(option.yAxis).toEqual({ name: 'Births' });
  expect(option.series).toEqual([
    {
      type: 'line',
      name: 'sum__num',
      data: { $bind: { source: 'metric', alias: 'sum__num' } },
    },
    {
      type: 'line',
      name: 'F',
      data: { $bind: { source: 'metric', alias: 'Girls' } },
      itemStyle: { color: '#f00' },
    },
  ]);
});

test('a hidden series is left out', () => {
  const option = applyStructuredSeries(
    {},
    {
      chartType: 'bar',
      dataBinding: { metrics: ['a', 'b'], dimensions: ['d'] },
      customize: { series: { b: { visible: false } } },
    },
  );

  expect(option.series).toHaveLength(1);
  expect(option.yAxis).toEqual({ type: 'value' });
});

test('builds multi-level sankey nodes and aggregated links from rows', () => {
  const option = applyRowDrivenChart(
    {},
    {
      chartType: 'sankey',
      dataBinding: {
        metrics: ['sales'],
        dimensions: ['territory', 'product_line', 'deal_size'],
      },
    },
    [
      { territory: 'NA', product_line: 'Classic Cars', deal_size: 'Large', sales: 100 },
      { territory: 'NA', product_line: 'Classic Cars', deal_size: 'Small', sales: 50 },
      { territory: 'EMEA', product_line: 'Classic Cars', deal_size: 'Large', sales: 80 },
    ],
  );

  expect(option.xAxis).toBeUndefined();
  expect(option.series).toEqual([
    {
      type: 'sankey',
      emphasis: { focus: 'adjacency' },
      data: [
        { name: 'NA' },
        { name: 'Classic Cars' },
        { name: 'Large' },
        { name: 'Small' },
        { name: 'EMEA' },
      ],
      links: [
        { source: 'NA', target: 'Classic Cars', value: 150 },
        { source: 'Classic Cars', target: 'Large', value: 180 },
        { source: 'Classic Cars', target: 'Small', value: 50 },
        { source: 'EMEA', target: 'Classic Cars', value: 80 },
      ],
    },
  ]);
});

test('builds calendar heatmap option from date and metric rows', () => {
  const option = applyRowDrivenChart(
    {},
    {
      chartType: 'calendar',
      dataBinding: {
        metrics: ['sales'],
        dimensions: ['order_date'],
      },
    },
    [
      { order_date: '2004-01-15T00:00:00', sales: 1200 },
      { order_date: '2004-02-20T00:00:00', sales: 3400 },
    ],
  );

  expect(option.calendar).toMatchObject({ range: '2004' });
  expect(option.visualMap).toMatchObject({ min: 1200, max: 3400 });
  expect(option.series).toEqual([
    {
      type: 'heatmap',
      coordinateSystem: 'calendar',
      data: [
        ['2004-01-15', 1200],
        ['2004-02-20', 3400],
      ],
    },
  ]);
});

test('applyRowDrivenChart builds nested hierarchy trees for treemap, sunburst, and tree', () => {
  const rows = [
    { region: 'NA', category: 'Bikes', sales: 100 },
    { region: 'NA', category: 'Helmets', sales: 50 },
    { region: 'EMEA', category: 'Bikes', sales: 80 },
  ];
  const props = {
    dataBinding: { metrics: ['sales'], dimensions: ['region', 'category'] },
  };

  const treemap = applyRowDrivenChart({}, { ...props, chartType: 'treemap' }, rows);
  expect(treemap.series).toEqual([
    {
      type: 'treemap',
      roam: false,
      leafDepth: 2,
      data: [
        {
          name: 'NA',
          value: 150,
          children: [
            { name: 'Bikes', value: 100 },
            { name: 'Helmets', value: 50 },
          ],
        },
        {
          name: 'EMEA',
          value: 80,
          children: [{ name: 'Bikes', value: 80 }],
        },
      ],
    },
  ]);

  const sunburst = applyRowDrivenChart({}, { ...props, chartType: 'sunburst' }, rows);
  expect(sunburst.series).toMatchObject([
    {
      type: 'sunburst',
      data: [
        { name: 'NA', value: 150 },
        { name: 'EMEA', value: 80 },
      ],
    },
  ]);

  const tree = applyRowDrivenChart({}, { ...props, chartType: 'tree' }, rows);
  expect(tree.series).toMatchObject([
    {
      type: 'tree',
      data: [{ name: 'region', children: [{ name: 'NA', value: 150 }, { name: 'EMEA', value: 80 }] }],
    },
  ]);
});

test('calendar chart expands cellSize when chrome.labelShow is enabled and forwards cell labels', () => {
  const rows = [
    { order_date: '2025-01-15', sales: 42 },
    { order_date: '2025-01-16', sales: 18 },
  ];
  const base = applyRowDrivenChart(
    {},
    {
      chartType: 'calendar',
      dataBinding: { metrics: ['sales'], dimensions: ['order_date'] },
      chrome: { labelShow: true },
    },
    rows,
  );
  expect(base.calendar).toMatchObject({ cellSize: ['auto', 22] });

  const chromed = applyStructuredChrome(base, {
    labelShow: true,
    labelColor: '#ffffff',
  });
  expect(chromed.series).toMatchObject([
    {
      type: 'heatmap',
      coordinateSystem: 'calendar',
      label: { show: true, color: '#ffffff' },
    },
  ]);
});
