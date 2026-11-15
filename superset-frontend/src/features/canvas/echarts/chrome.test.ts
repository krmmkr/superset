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

test('an unset chrome (no chartChrome at all) leaves the raw option untouched', () => {
  const raw = { title: { text: 'Raw title' }, legend: { orient: 'vertical' } };
  expect(applyStructuredChrome(raw, undefined)).toBe(raw);
});

test('every field at its default leaves the raw option untouched, same reference', () => {
  const raw = { title: { text: 'Raw title' } };
  const chrome = {
    titleText: '',
    legendShow: true,
    legendPosition: null,
    tooltipTrigger: null,
    xAxisName: '',
    xAxisRotate: 0,
    xAxisFormat: '',
    yAxisName: '',
    yAxisRotate: 0,
    yAxisFormat: '',
  };
  expect(applyStructuredChrome(raw, chrome)).toBe(raw);
});

test('titleText sets the title text, keeping the raw title styling', () => {
  const raw = { title: { textStyle: { fontSize: 20 } } };
  const merged = applyStructuredChrome(raw, { titleText: 'Sales' });
  expect(merged.title).toEqual({ textStyle: { fontSize: 20 }, text: 'Sales' });
});

test('legendShow: false hides the legend regardless of the raw config', () => {
  const raw = { legend: { orient: 'vertical' } };
  const merged = applyStructuredChrome(raw, { legendShow: false });
  expect(merged.legend).toEqual({ orient: 'vertical', show: false });
});

test('legendPosition maps to the top/left pair ECharts actually reads', () => {
  const merged = applyStructuredChrome({}, { legendPosition: 'right' });
  expect(merged.legend).toEqual({ top: 'middle', left: 'right' });
});

test('tooltipTrigger applies onto the raw tooltip config, unmanaged keys survive', () => {
  const raw = { tooltip: { formatter: '{b}: {c}' } };
  const merged = applyStructuredChrome(raw, { tooltipTrigger: 'axis' });
  expect(merged.tooltip).toEqual({ formatter: '{b}: {c}', trigger: 'axis' });
});

test('axis name/rotate/format merge into name + axisLabel, raw axisLabel keys survive', () => {
  const raw = { xAxis: { type: 'category', axisLabel: { color: 'red' } } };
  const merged = applyStructuredChrome(raw, {
    xAxisName: 'Product',
    xAxisRotate: 45,
    xAxisFormat: '{value} kg',
  });
  expect(merged.xAxis).toEqual({
    type: 'category',
    name: 'Product',
    axisLabel: { color: 'red', rotate: 45, formatter: '{value} kg' },
  });
});

test('xAxis and yAxis are managed independently', () => {
  const merged = applyStructuredChrome(
    { xAxis: {}, yAxis: {} },
    { xAxisName: 'X', yAxisName: 'Y' },
  );
  expect(merged.xAxis).toEqual({ name: 'X' });
  expect(merged.yAxis).toEqual({ name: 'Y' });
});

test('a multi-axis xAxis array merges onto its first entry, rest untouched', () => {
  const raw = {
    xAxis: [
      { type: 'category', axisLabel: { color: 'red' } },
      { type: 'value' },
    ],
  };
  const merged = applyStructuredChrome(raw, {
    xAxisName: 'Product',
    xAxisRotate: 45,
  });
  expect(merged.xAxis).toEqual([
    {
      type: 'category',
      name: 'Product',
      axisLabel: { color: 'red', rotate: 45 },
    },
    { type: 'value' },
  ]);
});

test('an array-valued legend merges onto its first entry, rest untouched', () => {
  const raw = { legend: [{ orient: 'vertical' }, { top: 'bottom' }] };
  const merged = applyStructuredChrome(raw, { legendShow: false });
  expect(merged.legend).toEqual([
    { orient: 'vertical', show: false },
    { top: 'bottom' },
  ]);
});

test('unmanaged raw properties outside title/legend/tooltip/xAxis/yAxis survive untouched', () => {
  const raw = {
    series: [{ type: 'bar', data: [1, 2] }],
    grid: { left: 10 },
    title: { text: 'raw' },
  };
  const merged = applyStructuredChrome(raw, { legendShow: false });
  expect(merged.series).toBe(raw.series);
  expect(merged.grid).toBe(raw.grid);
  expect(merged.title).toBe(raw.title);
});

test('tooltipShow, tooltipFormat, and series data label customizations merge cleanly', () => {
  const raw = {
    tooltip: { backgroundColor: '#111' },
    series: [
      { type: 'bar', data: [10, 20] },
      { type: 'line', data: [5, 15], label: { color: '#333' } },
    ],
  };
  const merged = applyStructuredChrome(raw, {
    tooltipTrigger: 'axis',
    tooltipFormat: '{b}: ${c}',
    labelShow: true,
    labelPosition: 'top',
    labelFormat: '${c}',
  });

  expect(merged.tooltip).toEqual({
    backgroundColor: '#111',
    trigger: 'axis',
    formatter: '{b}: ${c}',
  });
  expect(merged.series).toEqual([
    {
      type: 'bar',
      data: [10, 20],
      label: { show: true, position: 'top', formatter: '${c}' },
    },
    {
      type: 'line',
      data: [5, 15],
      label: { color: '#333', show: true, position: 'top', formatter: '${c}' },
    },
  ]);

  const hiddenTooltip = applyStructuredChrome(raw, { tooltipShow: false });
  expect(hiddenTooltip.tooltip).toEqual({
    backgroundColor: '#111',
    show: false,
  });
});

test('labelColor and labelFontSize apply across series labels', () => {
  const raw = {
    series: [
      { type: 'bar', data: [1, 2] },
      { type: 'pie', data: [{ name: 'A', value: 1 }], label: { show: true } },
    ],
  };
  const merged = applyStructuredChrome(raw, {
    labelColor: '#ff5500',
    labelFontSize: 14,
  });
  expect(merged.series).toEqual([
    { type: 'bar', data: [1, 2], label: { color: '#ff5500', fontSize: 14 } },
    {
      type: 'pie',
      data: [{ name: 'A', value: 1 }],
      label: { show: true, color: '#ff5500', fontSize: 14 },
    },
  ]);
});

test('targetValue from targetParam injects a horizontal markLine onto the first series', () => {
  const raw = {
    series: [{ type: 'bar', data: [100, 200] }],
  };
  const merged = applyStructuredChrome(
    raw,
    { targetParam: 'revenueGoal' },
    150,
  );
  expect(merged.series).toEqual([
    {
      type: 'bar',
      data: [100, 200],
      markLine: {
        silent: true,
        label: { formatter: '{b}: {c}' },
        data: [{ yAxis: 150, name: 'revenueGoal' }],
      },
    },
  ]);
});

test('labelRotate, labelDecimals, and xAxisDateFormat apply cleanly', () => {
  const raw = {
    xAxis: { type: 'category', data: ['2026-01-15T00:00:00Z'] },
    series: [{ type: 'bar', data: [1234.567] }],
  };
  const merged = applyStructuredChrome(raw, {
    labelShow: true,
    labelRotate: 45,
    labelDecimals: 1,
    xAxisDateFormat: 'MMM D, YYYY',
  });
  const seriesEntry = (
    merged.series as Array<{ label: Record<string, unknown> }>
  )[0];
  expect(seriesEntry.label.rotate).toBe(45);
  expect(typeof seriesEntry.label.formatter).toBe('function');
  const fmtLabel = seriesEntry.label.formatter as (p: {
    value: unknown;
  }) => string;
  expect(fmtLabel({ value: 1234.567 })).toBe('1,234.6');

  const xAxis = merged.xAxis as {
    axisLabel: { formatter: (v: unknown) => string };
  };
  expect(xAxis.axisLabel.formatter('2026-01-15T00:00:00Z')).toBe(
    'Jan 15, 2026',
  );
});

test('scrollMode none leaves option unchanged, zoombar and scrollbar configure dataZoom', () => {
  const categories = Array.from({ length: 30 }, (_, i) => `Day ${i + 1}`);
  const raw = {
    xAxis: { type: 'category', data: categories },
    series: [{ type: 'bar', data: categories.map((_, i) => i) }],
  };

  expect(applyStructuredChrome(raw, { scrollMode: 'none' })).toBe(raw);

  const zoombar = applyStructuredChrome(raw, {
    scrollMode: 'zoombar',
    visibleBars: 10,
  });
  expect(zoombar.dataZoom).toEqual([
    {
      type: 'slider',
      xAxisIndex: 0,
      bottom: 8,
      filterMode: 'none',
      startValue: 0,
      endValue: 9,
    },
    {
      type: 'inside',
      xAxisIndex: 0,
      filterMode: 'none',
    },
  ]);
  expect(zoombar.grid).toEqual({ containLabel: true, bottom: 44 });

  const scrollbar = applyStructuredChrome(raw, {
    scrollMode: 'scrollbar',
    visibleBars: 12,
  });
  expect(scrollbar.dataZoom).toEqual([
    {
      type: 'slider',
      xAxisIndex: 0,
      zoomLock: true,
      showDetail: false,
      showDataShadow: false,
      brushSelect: false,
      height: 10,
      bottom: 8,
      filterMode: 'none',
      startValue: 0,
      endValue: 11,
    },
    {
      type: 'inside',
      xAxisIndex: 0,
      zoomOnMouseWheel: false,
      moveOnMouseMove: true,
      moveOnMouseWheel: true,
      filterMode: 'none',
    },
  ]);
  expect(scrollbar.grid).toEqual({ containLabel: true, bottom: 32 });
});
