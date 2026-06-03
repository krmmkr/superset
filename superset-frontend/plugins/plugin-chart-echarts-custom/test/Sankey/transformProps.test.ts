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
import { ChartProps } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/theme';
import transformProps from '../../src/Sankey/transformProps';
import { SankeyChartProps } from '../../src/Sankey/types';

describe('Sankey transformProps', () => {
  const getChartProps = (formOverrides = {}) => {
    return new ChartProps({
      formData: {
        colorScheme: 'bnbColors',
        datasource: '3__table',
        viz_type: 'sankey',
        metric: 'sum__num',
        groupby: ['source_col', 'target_col'],
        ...formOverrides,
      },
      width: 800,
      height: 600,
      queriesData: [
        {
          data: [
            { source_col: 'A', target_col: 'B', sum__num: 10 },
          ],
        },
      ],
      theme: supersetTheme,
    }) as SankeyChartProps;
  };

  test('should transform chart props for Sankey', () => {
    const chartProps = getChartProps();
    const result = transformProps(chartProps);

    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
    expect(result.echartOptions.series).toBeInstanceOf(Array);
    const series = (result.echartOptions.series as any[])[0];
    expect(series.type).toBe('sankey');
    expect(series.data).toEqual([
      expect.objectContaining({ name: 'A (stage 0)' }),
      expect.objectContaining({ name: 'B (stage 1)' }),
    ]);
    expect(series.links).toEqual([
      { source: 'A (stage 0)', target: 'B (stage 1)', value: 10 },
    ]);
  });

  test('should format label percentage next to node name if show_label_percentage is true', () => {
    const chartProps = getChartProps({
      show_label_percentage: true,
    });
    const result = transformProps(chartProps);
    const series = (result.echartOptions.series as any[])[0];

    // Total for stage 0 is 10, node A has flow value 10, so percentage is 100.00%
    const nodeA = series.data.find((d: any) => d.name === 'A (stage 0)');
    expect(nodeA.label.formatter()).toBe('A (100.00%)');
  });

  test('should not format label percentage next to node name if show_label_percentage is false', () => {
    const chartProps = getChartProps({
      show_label_percentage: false,
    });
    const result = transformProps(chartProps);
    const series = (result.echartOptions.series as any[])[0];

    const nodeA = series.data.find((d: any) => d.name === 'A (stage 0)');
    expect(nodeA.label.formatter()).toBe('A');
  });

  test('should format node tooltip based on tooltip customization options', () => {
    const chartProps = getChartProps({
      show_node_value: true,
      show_stage_name: true,
      show_stage_percentage: true,
    });
    const result = transformProps(chartProps);
    const formatter = (result.echartOptions.tooltip as any)?.formatter as Function;

    const nodeParams = {
      name: 'A (stage 0)',
      value: 10,
      data: { name: 'A (stage 0)' },
    };

    const tooltipHtml = formatter(nodeParams);
    expect(tooltipHtml).toContain('A');
    expect(tooltipHtml).toContain('sum__num');
    expect(tooltipHtml).toContain('10.00');
    expect(tooltipHtml).toContain('Stage');
    expect(tooltipHtml).toContain('source_col');
    expect(tooltipHtml).toContain('Stage %');
    expect(tooltipHtml).toContain('100.00%');
  });

  test('should omit node details from tooltip if controls are disabled', () => {
    const chartProps = getChartProps({
      show_node_value: false,
      show_stage_name: false,
      show_stage_percentage: false,
    });
    const result = transformProps(chartProps);
    const formatter = (result.echartOptions.tooltip as any)?.formatter as Function;

    const nodeParams = {
      name: 'A (stage 0)',
      value: 10,
      data: { name: 'A (stage 0)' },
    };

    const tooltipHtml = formatter(nodeParams);
    expect(tooltipHtml).toContain('A');
    expect(tooltipHtml).not.toContain('sum__num');
    expect(tooltipHtml).not.toContain('Stage');
    expect(tooltipHtml).not.toContain('source_col');
    expect(tooltipHtml).not.toContain('Stage %');
  });

  test('should format link tooltip based on tooltip customization options', () => {
    const chartProps = getChartProps({
      show_node_value: true,
      show_link_percentages: true,
    });
    const result = transformProps(chartProps);
    const formatter = (result.echartOptions.tooltip as any)?.formatter as Function;

    const linkParams = {
      name: 'A (stage 0) > B (stage 1)',
      value: 10,
      data: {
        source: 'A (stage 0)',
        target: 'B (stage 1)',
        value: 10,
      },
    };

    const tooltipHtml = formatter(linkParams);
    // Since name of link in params is 'A (stage 0) > B (stage 1)', cleanName becomes 'A > B'
    expect(tooltipHtml).toContain('A &gt; B');
    expect(tooltipHtml).toContain('sum__num');
    expect(tooltipHtml).toContain('10.00');
    expect(tooltipHtml).toContain('% (A)');
    expect(tooltipHtml).toContain('% (B)');
    expect(tooltipHtml).toContain('100.00%');
  });

  test('should omit link details from tooltip if controls are disabled', () => {
    const chartProps = getChartProps({
      show_node_value: false,
      show_link_percentages: false,
    });
    const result = transformProps(chartProps);
    const formatter = (result.echartOptions.tooltip as any)?.formatter as Function;

    const linkParams = {
      name: 'A (stage 0) > B (stage 1)',
      value: 10,
      data: {
        source: 'A (stage 0)',
        target: 'B (stage 1)',
        value: 10,
      },
    };

    const tooltipHtml = formatter(linkParams);
    expect(tooltipHtml).toContain('A &gt; B');
    expect(tooltipHtml).not.toContain('sum__num');
    expect(tooltipHtml).not.toContain('% (A)');
    expect(tooltipHtml).not.toContain('% (B)');
  });
});
