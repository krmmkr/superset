/**
 * Licensed under the Apache License, Version 2.0
 * Superset Calendar Heatmap Plugin - Unit Tests
 */
import { ChartProps } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/theme';
import transformProps from '../../src/CalendarChart1/src/transformProps';
import { CalendarHeatmapChartProps } from '../../src/CalendarChart1/src/types';

describe('Echarts Calendar Heatmap transformProps', () => {
  const getChartProps = (formOverrides = {}, data: any[] = []) =>
    new ChartProps({
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

  test('should transform numeric data correctly', () => {
    const chartProps = getChartProps(
      {
        showCellLabel: true,
        showCellDate: true,
      },
      [
        { ds: '2026-03-01', count: 100 },
        { ds: '2026-03-02', count: 200 },
      ],
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

    // Verify React calendar months structure
    expect(result.months).toBeDefined();
    expect(result.months.length).toBeGreaterThanOrEqual(1);
    expect(result.months[0].monthName).toContain('2026');
    const day1 = result.months[0].days.find(d => d?.dateStr === '2026-03-01');
    expect(day1).toBeDefined();
    expect(day1?.value).toBe(100);
    expect(day1?.dayOfMonth).toBe(1);
  });

  test('should handle categorical (text) data correctly', () => {
    const chartProps = getChartProps(
      {
        showCellLabel: true,
      },
      [
        { ds: '2026-03-01', count: 'Success' },
        { ds: '2026-03-02', count: 'Failed' },
      ],
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

  test('should propagate customization controls properly', () => {
    const chartProps = getChartProps(
      {
        cell_size: 42,
        calendar_orient: 'vertical',
        layout_mode: 'scrollable',
        show_day_label: false,
        show_month_label: true,
        show_cell_label: true,
        show_cell_date: false,
        label_font_size: 14,
        day_label_font_size: 12,
        show_visual_map: true,
        visual_map_type: 'piecewise',
        piecewise_num: 4,
        visual_map_min: 50,
        visual_map_max: 500,
      },
      [
        { ds: '2026-03-01', count: 100 },
        { ds: '2026-03-02', count: 400 },
      ],
    );

    const result = transformProps(chartProps);
    expect(result.cellSize).toBe(42);
    expect(result.calendarOrient).toBe('vertical');
    expect(result.layoutMode).toBe('scrollable');
    expect(result.showDayLabel).toBe(false);
    expect(result.showCellDate).toBe(false);
    expect(result.showCellLabel).toBe(true);
    expect(result.labelFontSize).toBe(14);
    expect(result.dayLabelFontSize).toBe(12);
    expect(result.showVisualMap).toBe(true);
    expect(result.visualMapMin).toBe(50);
    expect(result.visualMapMax).toBe(500);
    expect(result.visualMapColors.length).toBe(4);
  });

  test('should extract extra tooltip metrics from row data', () => {
    const chartProps = getChartProps(
      {
        tooltip_metrics: ['min_val', 'status_list'],
      },
      [
        {
          ds: '2026-03-01',
          count: 150,
          min_val: 10,
          status_list: 'Active, Pending',
        },
      ],
    );

    const result = transformProps(chartProps);
    const day = result.months[0].days.find(d => d?.dateStr === '2026-03-01');
    expect(day).toBeDefined();
    expect(day?.extraMetrics).toBeDefined();
    expect(day?.extraMetrics?.length).toBe(2);

    const minMetric = day?.extraMetrics?.find(m => m.label === 'min_val');
    expect(minMetric?.value).toBe(10);

    const statusMetric = day?.extraMetrics?.find(
      m => m.label === 'status_list',
    );
    expect(statusMetric?.value).toBe('Active, Pending');
  });
});
