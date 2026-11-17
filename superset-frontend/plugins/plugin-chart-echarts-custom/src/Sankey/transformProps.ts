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

const isNullValue = (val: any): boolean =>
  val === undefined ||
  val === null ||
  String(val).trim() === '' ||
  String(val) === 'null' ||
  String(val) === 'undefined';

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
    showLabelPercentageType = 'stage',
    showWholePercentage = true,
    showStageTotal = true,
    showOverallTotal = true,
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
  const show_label_percentage_type =
    formData.show_label_percentage_type !== undefined
      ? formData.show_label_percentage_type
      : showLabelPercentageType;
  const show_whole_percentage =
    formData.show_whole_percentage !== undefined
      ? formData.show_whole_percentage
      : showWholePercentage;
  const show_stage_total =
    formData.show_stage_total !== undefined
      ? formData.show_stage_total
      : showStageTotal;
  const show_overall_total =
    formData.show_overall_total !== undefined
      ? formData.show_overall_total
      : showOverallTotal;
  const link_color_mode =
    formData.link_color_mode ?? formData.linkColorMode ?? 'gradient';
  const enable_3d_effect =
    formData.enable_3d_effect ?? formData.enable3dEffect ?? true;
  const node_width = Number(formData.node_width ?? formData.nodeWidth ?? 16);
  const node_gap = Number(formData.node_gap ?? formData.nodeGap ?? 16);
  const node_border_radius = Number(
    formData.node_border_radius ?? formData.nodeBorderRadius ?? 6,
  );
  const link_opacity = Number(
    formData.link_opacity ?? formData.linkOpacity ?? 0.75,
  );
  const blur_opacity = Number(
    formData.blur_opacity ??
      formData.blurOpacity ??
      formData.inactive_opacity ??
      formData.inactiveOpacity ??
      0.15,
  );
  const focus_mode = formData.focus_mode ?? formData.focusMode ?? 'adjacency';

  const { data } = queriesData[0];
  const colorFn = CategoricalColorNamespace.getScale(colorScheme);
  const metricLabel = metric ? getMetricLabel(metric) : 'Value';
  const valueFormatter = getNumberFormatter(NumberFormats.FLOAT_2_POINT);
  const percentFormatter = getPercentFormatter(NumberFormats.PERCENT_2_POINT);

  const links: Link[] = [];
  const set = new Set<string>();
  const columns = groupby.map(col => getColumnLabel(col));
  const stageTotals = Array.from({ length: columns.length }, () => 0);
  const overallTotal = data.reduce(
    (sum, datum) => sum + ((datum[metricLabel] as number) || 0),
    0,
  );

  if (columns.length >= 2) {
    const linkMap = new Map<string, number>();

    data.forEach(datum => {
      const value = (datum[metricLabel] as number) || 0;
      for (let i = 0; i < columns.length; i += 1) {
        const val = datum[columns[i]];
        if (!isNullValue(val)) {
          stageTotals[i] += value;
        }
      }
      for (let i = 0; i < columns.length - 1; i += 1) {
        const sourceCol = columns[i];
        const targetCol = columns[i + 1];
        const sourceVal = datum[sourceCol];
        const targetVal = datum[targetCol];

        if (isNullValue(sourceVal) || isNullValue(targetVal)) {
          continue;
        }

        const sourceName = `${String(sourceVal)} (stage ${i})`;
        const targetName = `${String(targetVal)} (stage ${i + 1})`;

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

  let maxRightLabelLen = 0;
  const lastStageSuffix = `(stage ${columns.length - 1})`;

  const seriesData: NonNullable<SankeySeriesOption['data']> = Array.from(
    set,
  ).map(name => {
    let displayName = String(name).replace(/ \(stage \d+\)$/, '');
    const isRightmostStage =
      columns.length > 0
        ? String(name).endsWith(lastStageSuffix)
        : (outgoingFlows.get(name) || 0) === 0;

    if (show_label_percentage) {
      const match = String(name).match(/ \(stage (\d+)\)$/);
      if (match) {
        const stageIndex = parseInt(match[1], 10);
        const stageTotal = stageTotals[stageIndex];
        const val = nodeValues.get(name) || 0;

        let percentStr = '';
        if (show_label_percentage_type === 'stage' && stageTotal > 0) {
          percentStr = percentFormatter.format(val / stageTotal);
        } else if (show_label_percentage_type === 'whole' && overallTotal > 0) {
          percentStr = percentFormatter.format(val / overallTotal);
        } else if (show_label_percentage_type === 'both') {
          const stagePercent =
            stageTotal > 0 ? percentFormatter.format(val / stageTotal) : '-';
          const wholePercent =
            overallTotal > 0
              ? percentFormatter.format(val / overallTotal)
              : '-';
          percentStr = `${stagePercent} / ${wholePercent}`;
        }

        if (percentStr) {
          displayName = `${displayName} (${percentStr})`;
        }
      }
    }

    if (isRightmostStage) {
      maxRightLabelLen = Math.max(maxRightLabelLen, displayName.length);
    }

    return {
      name,
      itemStyle: {
        color: colorFn(String(name).replace(/ \(stage \d+\)$/, ''), sliceId),
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
        formatter: () => displayName,
      },
    };
  });

  // Calculate dynamic right margin based on rightmost labels to prevent clipping
  const dynamicRightMargin = Math.max(
    55,
    Math.min(260, Math.ceil(maxRightLabelLen * 7.5 + 24)),
  );

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
          rows.push(['Stage %', percentFormatter.format(value / stageTotal)]);
        }
        if (show_whole_percentage && overallTotal > 0) {
          rows.push([
            'Percent of Whole',
            percentFormatter.format(value / overallTotal),
          ]);
        }
        if (show_stage_total && stageTotal > 0) {
          rows.push(['Stage Total', valueFormatter.format(stageTotal)]);
        }
        if (show_overall_total && overallTotal > 0) {
          rows.push(['Overall Total', valueFormatter.format(overallTotal)]);
        }
      }
    }
    return tooltipHtml(rows, cleanName);
  };

  const echartOptions: EChartsOption = {
    series: [
      {
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
