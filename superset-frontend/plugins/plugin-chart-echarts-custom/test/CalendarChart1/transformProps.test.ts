/**
 * Licensed under the Apache License, Version 2.0
 * Superset Calendar Heatmap Plugin - Unit Tests
 */
import { ChartProps } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/theme';
import transformProps from '../../src/CalendarChart1/src/transformProps';
import { CalendarHeatmapChartProps } from '../../src/CalendarChart1/src/types';

describe('Echarts Calendar Heatmap transformProps', () => {
  const getChartProps = (formOverrides = {}, data: any[] = []) => {
    return new ChartProps({
      formData: {
        colorScheme: 'bnbColors',
        datasource: '3__table',
        viz_type: 'calendar_heatmap_custom',
        metrics: ['count'],
        granularity_sqla: 'ds',
        ...formOverrides,
      },
      width: 800,
      height: 600,
      queriesData: [
        {
          colnames: ['ds', 'count'],
          coltypes: [1, 2],
          data,
        },
      ],
      theme: supersetTheme,
    }) as unknown as CalendarHeatmapChartProps;
  };

  test('should transform numeric data correctly', () => {
    const chartProps = getChartProps(
      {
        showCellLabel: true,
        showCellDate: true,
      },
      [
        { ds: '2026-03-01', count: 100 },
        { ds: '2026-03-02', count: 200 },
      ]
    );

    const result = transformProps(chartProps);
    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
    
    const option = result.echartOptions;
    expect(option.calendar).toBeDefined();
    
    const series = (option.series as any[])[0];
    expect(series.type).toBe('heatmap');
    expect(series.data).toEqual([
      ['2026-03-01', 100, { ds: '2026-03-01', count: 100 }],
      ['2026-03-02', 200, { ds: '2026-03-02', count: 200 }],
    ]);

    const tooltipFormatter = (option.tooltip as any).formatter;
    const tooltipHtml = tooltipFormatter({
      data: ['2026-03-01', 100, { ds: '2026-03-01', count: 100 }],
    });
    expect(tooltipHtml).toContain('2026-03-01');
    expect(tooltipHtml).toContain('100');
  });

  test('should handle categorical (text) data correctly', () => {
    const chartProps = getChartProps(
      {
        showCellLabel: true,
      },
      [
        { ds: '2026-03-01', count: 'Success' },
        { ds: '2026-03-02', count: 'Failed' },
      ]
    );

    const result = transformProps(chartProps);
    const option = result.echartOptions;

    expect((option.visualMap as any).type).toBe('piecewise');
    expect((option.visualMap as any).categories).toEqual(['Failed', 'Success']);

    const series = (option.series as any[])[0];
    expect(series.data).toEqual([
      ['2026-03-01', 'Success', { ds: '2026-03-01', count: 'Success' }],
      ['2026-03-02', 'Failed', { ds: '2026-03-02', count: 'Failed' }],
    ]);

    const tooltipFormatter = (option.tooltip as any).formatter;
    const tooltipHtml = tooltipFormatter({
      data: ['2026-03-01', 'Success', { ds: '2026-03-01', count: 'Success' }],
    });
    expect(tooltipHtml).toContain('2026-03-01');
    expect(tooltipHtml).toContain('Success');
  });
});
