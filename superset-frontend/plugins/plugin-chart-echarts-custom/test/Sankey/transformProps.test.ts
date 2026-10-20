/**
 * Licensed under the Apache License, Version 2.0
 * Superset Sankey Plugin - Unit Tests
 */
import { ChartProps } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/theme';
import transformProps from '../../src/Sankey/transformProps';
import { SankeyChartProps } from '../../src/Sankey/types';

describe('Echarts Sankey transformProps', () => {
  const getChartProps = (formOverrides = {}) =>
    new ChartProps({
      formData: {
        colorScheme: 'bnbColors',
        datasource: '3__table',
        viz_type: 'sankey_multi_level',
        metric: 'count',
        groupby: ['source_col', 'target_col'],
        ...formOverrides,
      },
      width: 800,
      height: 600,
      queriesData: [
        {
          colnames: ['source_col', 'target_col', 'count'],
          coltypes: [1, 1, 2],
          data: [
            { source_col: 'Outreach', target_col: 'Eligible', count: 245 },
            { source_col: 'Investigation', target_col: 'Outreach', count: 100 },
          ],
        },
      ],
      theme: supersetTheme,
    }) as unknown as SankeyChartProps;

  test('should default to gradient link color and 3D capsule node styling', () => {
    const chartProps = getChartProps();
    const result = transformProps(chartProps);
    const series = (result.echartOptions.series as any[])[0];

    expect(series.type).toBe('sankey');
    expect(series.lineStyle.color).toBe('gradient');
    expect(series.lineStyle.curveness).toBe(0.5);
    expect(series.lineStyle.opacity).toBe(0.75);
    expect(series.itemStyle.borderRadius).toEqual([6, 6, 6, 6]);
    expect(series.itemStyle.shadowBlur).toBe(10);
    expect(series.nodeWidth).toBe(16);
    expect(series.nodeGap).toBe(16);
    expect(series.left).toBe(14);
    expect(series.right).toBeGreaterThanOrEqual(55);
    expect(series.emphasis.focus).toBe('adjacency');
    expect(series.blur.itemStyle.opacity).toBe(0.15);

    // Check node items
    expect(series.data.length).toBeGreaterThanOrEqual(3);
    const node = series.data[0];
    expect(node.itemStyle.borderRadius).toEqual([6, 6, 6, 6]);
    expect(node.itemStyle.borderWidth).toBe(1);
  });

  test('should support source and target link color modes', () => {
    const sourceProps = getChartProps({ link_color_mode: 'source' });
    const sourceResult = transformProps(sourceProps);
    const sourceSeries = (sourceResult.echartOptions.series as any[])[0];
    expect(sourceSeries.lineStyle.color).toBe('source');

    const targetProps = getChartProps({ link_color_mode: 'target' });
    const targetResult = transformProps(targetProps);
    const targetSeries = (targetResult.echartOptions.series as any[])[0];
    expect(targetSeries.lineStyle.color).toBe('target');
  });

  test('should customize node width, gap, border radius, and link opacity', () => {
    const customProps = getChartProps({
      node_width: 24,
      node_gap: 20,
      node_border_radius: 10,
      link_opacity: 0.9,
      blur_opacity: 0.05,
      focus_mode: 'trajectory',
      enable_3d_effect: true,
    });
    const result = transformProps(customProps);
    const series = (result.echartOptions.series as any[])[0];

    expect(series.nodeWidth).toBe(24);
    expect(series.nodeGap).toBe(20);
    expect(series.lineStyle.opacity).toBe(0.9);
    expect(series.emphasis.focus).toBe('trajectory');
    expect(series.blur.itemStyle.opacity).toBe(0.05);
    expect(series.itemStyle.borderRadius).toEqual([10, 10, 10, 10]);
  });
});
