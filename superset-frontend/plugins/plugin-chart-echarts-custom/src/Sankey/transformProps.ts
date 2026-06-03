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
    groupby = [],
    sliceId,
    showStageName = true,
    showStagePercentage = true,
    showNodeValue = true,
    showLabelPercentage = false,
    showLinkPercentages = true,
  } = formData;
  const show_stage_name =
    formData.show_stage_name !== undefined
      ? formData.show_stage_name
      : showStageName;
  const show_stage_percentage =
    formData.show_stage_percentage !== undefined
      ? formData.show_stage_percentage
      : showStagePercentage;
  const show_node_value =
    formData.show_node_value !== undefined
      ? formData.show_node_value
      : showNodeValue;
  const show_label_percentage =
    formData.show_label_percentage !== undefined
      ? formData.show_label_percentage
      : showLabelPercentage;
  const show_link_percentages =
    formData.show_link_percentages !== undefined
      ? formData.show_link_percentages
      : showLinkPercentages;
  const { data } = queriesData[0];
  const colorFn = CategoricalColorNamespace.getScale(colorScheme);
  const metricLabel = getMetricLabel(metric);
  const valueFormatter = getNumberFormatter(NumberFormats.FLOAT_2_POINT);
  const percentFormatter = getPercentFormatter(NumberFormats.PERCENT_2_POINT);

  const links: Link[] = [];
  const set = new Set<string>();
  const columns = groupby.map(col => getColumnLabel(col));
  const stageTotals = new Array(columns.length).fill(0);

  if (columns.length >= 2) {
    const linkMap = new Map<string, number>();

    data.forEach(datum => {
      const value = (datum[metricLabel] as number) || 0;
      for (let i = 0; i < columns.length; i += 1) {
        const val = datum[columns[i]];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          stageTotals[i] += value;
        }
      }
      for (let i = 0; i < columns.length - 1; i += 1) {
        const sourceCol = columns[i];
        const targetCol = columns[i + 1];
        const sourceVal = String(datum[sourceCol]);
        const targetVal = String(datum[targetCol]);
        const sourceName = `${sourceVal} (stage ${i})`;
        const targetName = `${targetVal} (stage ${i + 1})`;

        const linkKey = `${sourceName} \u0000 ${targetName}`;
        linkMap.set(linkKey, (linkMap.get(linkKey) || 0) + value);
        set.add(sourceName);
        set.add(targetName);
      }
    });

    linkMap.forEach((val, key) => {
      const [src, tgt] = key.split(' \u0000 ');
      links.push({
        source: src,
        target: tgt,
        value: val,
      });
    });
  }

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

  const seriesData: NonNullable<SankeySeriesOption['data']> = Array.from(
    set,
  ).map(name => {
    let displayName = String(name).replace(/ \(stage \d+\)$/, '');
    if (show_label_percentage) {
      const match = String(name).match(/ \(stage (\d+)\)$/);
      if (match) {
        const stageIndex = parseInt(match[1], 10);
        const stageTotal = stageTotals[stageIndex];
        const val = nodeValues.get(name) || 0;
        if (stageTotal > 0) {
          displayName = `${displayName} (${percentFormatter.format(val / stageTotal)})`;
        }
      }
    }
    return {
      name,
      itemStyle: {
        color: colorFn(name, sliceId),
      },
      label: {
        color: theme.colorText,
        textShadow: theme.colorBgBase,
        formatter: () => displayName,
      },
    };
  });

  const tooltipFormatter = (params: CallbackDataParams) => {
    const { name, data } = params;
    const value = params.value as number;
    const cleanName = String(name).replace(/ \(stage \d+\)/g, '');
    const rows: [string, string][] = [];
    const { source, target } = data as Link;
    if (source && target) {
      if (show_node_value) {
        rows.push([metricLabel, valueFormatter.format(value)]);
      }
      if (show_link_percentages) {
        const cleanSource = String(source).replace(/ \(stage \d+\)/g, '');
        const cleanTarget = String(target).replace(/ \(stage \d+\)/g, '');
        rows.push([
          `% (${cleanSource})`,
          percentFormatter.format(value / nodeValues.get(source)!),
        ]);
        rows.push([
          `% (${cleanTarget})`,
          percentFormatter.format(value / nodeValues.get(target)!),
        ]);
      }
    } else {
      if (show_node_value) {
        rows.push([metricLabel, valueFormatter.format(value)]);
      }
      const match = String(name).match(/ \(stage (\d+)\)$/);
      if (match) {
        const stageIndex = parseInt(match[1], 10);
        const stageName = columns[stageIndex];
        const stageTotal = stageTotals[stageIndex];

        if (show_stage_name) {
          rows.push(['Stage', stageName]);
        }
        if (show_stage_percentage && stageTotal > 0) {
          rows.push([
            'Stage %',
            percentFormatter.format(value / stageTotal),
          ]);
        }
      }
    }
    return tooltipHtml(rows, cleanName);
  };

  const echartOptions: EChartsOption = {
    series: [
      {
        animation: false,
        data: seriesData,
        lineStyle: {
          color: 'source',
        },
        links,
        type: 'sankey',
      },
    ],
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
