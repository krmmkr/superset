/* eslint-disable camelcase, theme-colors/no-literal-colors */
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
import type { ComposeOption } from 'echarts/core';
import type { SankeySeriesOption } from 'echarts/charts';
import type { CallbackDataParams } from 'echarts/types/src/util/types';
import {
  CategoricalColorNamespace,
  NumberFormats,
  getColumnLabel,
  getMetricLabel,
  getNumberFormatter,
  tooltipHtml,
} from '@superset-ui/core';
import { SankeyChartProps, SankeyTransformedProps } from './types';
import { Refs } from '../types';
import { getDefaultTooltip } from '../utils/tooltip';
import { getPercentFormatter } from '../utils/formatters';

type Link = { source: string; target: string; value: number };
type EChartsOption = ComposeOption<SankeySeriesOption>;

export default function transformProps(
  chartProps: SankeyChartProps,
): SankeyTransformedProps {
  const refs: Refs = {};
  const { formData, height, hooks, queriesData, width, theme } = chartProps;
  const { onLegendStateChanged } = hooks;
  const {
    colorScheme,
    metric,
    source,
    target,
    sliceId,
    linkColorMode = 'gradient',
    link_color_mode = linkColorMode,
    enable3dEffect = true,
    enable_3d_effect = enable3dEffect,
    nodeWidth = 16,
    node_width = nodeWidth,
    nodeGap = 16,
    node_gap = nodeGap,
    nodeBorderRadius = 6,
    node_border_radius = nodeBorderRadius,
    linkOpacity = 0.75,
    link_opacity = linkOpacity,
    blurOpacity = 0.15,
    blur_opacity = blurOpacity,
    focusMode = 'adjacency',
    focus_mode = focusMode,
  } = formData;
  const { data } = queriesData[0];
  const colorFn = CategoricalColorNamespace.getScale(colorScheme);
  const metricLabel = getMetricLabel(metric);
  const valueFormatter = getNumberFormatter(NumberFormats.FLOAT_2_POINT);
  const percentFormatter = getPercentFormatter(NumberFormats.PERCENT_2_POINT);

  const links: Link[] = [];
  const set = new Set<string>();
  data.forEach(datum => {
    const sourceName = String(datum[getColumnLabel(source)]);
    const targetName = String(datum[getColumnLabel(target)]);
    const value = datum[metricLabel] as number;
    set.add(sourceName);
    set.add(targetName);
    links.push({
      source: sourceName,
      target: targetName,
      value,
    });
  });

  const seriesData: NonNullable<SankeySeriesOption['data']> = Array.from(
    set,
  ).map(name => ({
    name,
    itemStyle: {
      color: colorFn(name, sliceId),
      borderRadius: enable_3d_effect
        ? [
            node_border_radius,
            node_border_radius,
            node_border_radius,
            node_border_radius,
          ]
        : 0,
      borderColor: enable_3d_effect
        ? 'rgba(255, 255, 255, 0.25)'
        : 'transparent',
      borderWidth: enable_3d_effect ? 1 : 0,
      shadowBlur: enable_3d_effect ? 10 : 0,
      shadowColor: enable_3d_effect ? 'rgba(0, 0, 0, 0.45)' : 'transparent',
      shadowOffsetX: enable_3d_effect ? 2 : 0,
      shadowOffsetY: enable_3d_effect ? 2 : 0,
    },
    label: {
      color: theme.colorText,
      textShadow: theme.colorBgBase,
      fontSize: 12,
      fontWeight: 500,
    },
  }));

  // stores a map with the total values for each node considering the links
  const incomingFlows = new Map<string, number>();
  const outgoingFlows = new Map<string, number>();
  const allNodeNames = new Set<string>();

  links.forEach(link => {
    const { source, target, value } = link;
    allNodeNames.add(source);
    allNodeNames.add(target);
    incomingFlows.set(target, (incomingFlows.get(target) || 0) + value);
    outgoingFlows.set(source, (outgoingFlows.get(source) || 0) + value);
  });

  const nodeValues = new Map<string, number>();

  allNodeNames.forEach(nodeName => {
    const totalIncoming = incomingFlows.get(nodeName) || 0;
    const totalOutgoing = outgoingFlows.get(nodeName) || 0;

    nodeValues.set(nodeName, Math.max(totalIncoming, totalOutgoing));
  });

  const tooltipFormatter = (params: CallbackDataParams) => {
    const { name, data } = params;
    const value = params.value as number;
    const rows = [[metricLabel, valueFormatter.format(value)]];
    const { source, target } = data as Link;
    if (source && target) {
      rows.push([
        `% (${source})`,
        percentFormatter.format(value / nodeValues.get(source)!),
      ]);
      rows.push([
        `% (${target})`,
        percentFormatter.format(value / nodeValues.get(target)!),
      ]);
    }
    return tooltipHtml(rows, name);
  };

  let maxRightLabelLen = 0;
  set.forEach(name => {
    if ((outgoingFlows.get(name) || 0) === 0) {
      maxRightLabelLen = Math.max(maxRightLabelLen, name.length);
    }
  });

  const dynamicRightMargin = Math.max(
    55,
    Math.min(260, Math.ceil(maxRightLabelLen * 7.5 + 24)),
  );

  const echartOptions: EChartsOption = {
    series: {
      animation: true,
      data: seriesData,
      nodeWidth: node_width,
      nodeGap: node_gap,
      nodeAlign: 'justify',
      layoutIterations: 32,
      draggable: true,
      left: 14,
      right: dynamicRightMargin,
      top: 15,
      bottom: 15,
      emphasis: {
        focus: focus_mode,
        itemStyle: {
          shadowBlur: 16,
          shadowColor: 'rgba(0, 0, 0, 0.7)',
          opacity: 1,
        },
        lineStyle: {
          opacity: 0.95,
        },
      },
      blur: {
        itemStyle: {
          opacity: blur_opacity,
        },
        lineStyle: {
          opacity: Math.max(0.04, blur_opacity * 0.75),
        },
      },
      lineStyle: {
        color: link_color_mode,
        curveness: 0.5,
        opacity: link_opacity,
      },
      itemStyle: {
        borderRadius: enable_3d_effect
          ? [
              node_border_radius,
              node_border_radius,
              node_border_radius,
              node_border_radius,
            ]
          : 0,
        borderColor: enable_3d_effect
          ? 'rgba(255, 255, 255, 0.25)'
          : 'transparent',
        borderWidth: enable_3d_effect ? 1 : 0,
        shadowBlur: enable_3d_effect ? 10 : 0,
        shadowColor: enable_3d_effect ? 'rgba(0, 0, 0, 0.45)' : 'transparent',
        shadowOffsetX: enable_3d_effect ? 2 : 0,
        shadowOffsetY: enable_3d_effect ? 2 : 0,
      },
      links,
      type: 'sankey',
    },
    tooltip: {
      ...getDefaultTooltip(refs),
      formatter: tooltipFormatter,
    },
  };

  return {
    refs,
    formData,
    width,
    height,
    echartOptions,
    onLegendStateChanged,
  };
}
