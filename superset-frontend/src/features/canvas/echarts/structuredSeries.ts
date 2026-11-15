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

/**
 * The `echarts` widget's structured series layer, per `chartType` and
 * `customize` in `superset/widgets/controls.py`: with `chartType` set, the
 * option's `series` is replaced by one series of that type per
 * `dataBinding` metric, styled by `customize.series`. Unset ("Custom"), the
 * option's own `series` is left as authored.
 */

type ChartType =
  | 'bar'
  | 'line'
  | 'scatter'
  | 'sankey'
  | 'calendar'
  | 'treemap'
  | 'sunburst'
  | 'tree';

const ROW_DRIVEN_TYPES = new Set<ChartType>([
  'sankey',
  'calendar',
  'treemap',
  'sunburst',
  'tree',
]);

interface SeriesOverride {
  color?: string;
  visible?: boolean;
  displayName?: string;
}

export interface StructuredProps {
  chartType?: ChartType | null;
  dataBinding?: {
    metrics?: unknown[];
    dimensions?: unknown[];
  };
  customize?: { series?: Record<string, SeriesOverride> };
  chrome?: { labelShow?: boolean };
}

/** The column a metric or dimension comes back as: its name, or its label. */
const labelOf = (item: unknown): string | undefined => {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object' && 'label' in item) {
    const { label } = item as { label?: unknown };
    return typeof label === 'string' ? label : undefined;
  }
  return undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const bind = (source: 'metric' | 'dimension', alias: string) => ({
  $bind: { source, alias },
});

/**
 * Lays the structured series onto a raw, not yet `$bind`-resolved option.
 * Returns `option` itself when `chartType` is unset.
 */
export function applyStructuredSeries(
  option: Record<string, unknown>,
  props: StructuredProps | undefined,
): Record<string, unknown> {
  const chartType = props?.chartType;
  if (!chartType || ROW_DRIVEN_TYPES.has(chartType)) {
    return option;
  }
  const overrides = props?.customize?.series ?? {};
  const series = (props?.dataBinding?.metrics ?? [])
    .map(labelOf)
    .filter((label): label is string => Boolean(label))
    .filter(label => overrides[label]?.visible !== false)
    .map(label => {
      const override = overrides[label] ?? {};
      return {
        type: chartType,
        name: override.displayName || label,
        data: bind('metric', label),
        ...(override.color ? { itemStyle: { color: override.color } } : {}),
      };
    });
  // A category axis over the first dimension, unless the option has its own.
  const dimension = labelOf(props?.dataBinding?.dimensions?.[0]);
  const { xAxis, yAxis } = option;
  const categoryAxis =
    isRecord(xAxis) && xAxis.data === undefined && dimension
      ? { ...xAxis, data: bind('dimension', dimension) }
      : xAxis;
  return {
    ...option,
    xAxis:
      xAxis === undefined && dimension
        ? { type: 'category', data: bind('dimension', dimension) }
        : categoryAxis,
    yAxis: yAxis === undefined ? { type: 'value' } : yAxis,
    series,
  };
}

const firstMetricKey = (
  props: StructuredProps | undefined,
  rows: Record<string, unknown>[],
): string | undefined => {
  const explicit = (props?.dataBinding?.metrics ?? [])
    .map(labelOf)
    .find((label): label is string => Boolean(label));
  if (explicit) return explicit;
  const first = rows[0] ?? {};
  return Object.keys(first).find(key => typeof first[key] === 'number');
};

const formatCalendarDate = (raw: unknown): string | undefined => {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const iso = new Date(raw).toISOString();
    return iso.slice(0, 10);
  }
  if (typeof raw === 'string' && raw.length >= 10) {
    return raw.slice(0, 10);
  }
  return undefined;
};

/**
 * Builds a nested `{ name, value, children? }` tree from flat rows and
 * ordered dimension columns, aggregating leaf values up to parent nodes.
 */
interface TreeNode {
  name: string;
  value: number;
  children?: TreeNode[];
}

function buildHierarchyTree(
  rows: Record<string, unknown>[],
  dimensions: string[],
  metricKey: string | undefined,
): TreeNode[] {
  if (dimensions.length === 0 || !metricKey) return [];
  interface MutableNode {
    name: string;
    value: number;
    children: Map<string, MutableNode>;
  }
  const roots = new Map<string, MutableNode>();

  for (const row of rows) {
    const val = Number(row[metricKey]) || 0;
    let levelMap = roots;
    for (let i = 0; i < dimensions.length; i += 1) {
      const rawName = row[dimensions[i]];
      if (rawName === null || rawName === undefined || rawName === '') break;
      const name = String(rawName);
      let node = levelMap.get(name);
      if (!node) {
        node = { name, value: 0, children: new Map() };
        levelMap.set(name, node);
      }
      node.value += val;
      levelMap = node.children;
    }
  }

  const toArray = (map: Map<string, MutableNode>): TreeNode[] =>
    Array.from(map.values()).map(node =>
      node.children.size > 0
        ? { name: node.name, value: node.value, children: toArray(node.children) }
        : { name: node.name, value: node.value },
    );

  return toArray(roots);
}

/**
 * Builds row-driven ECharts options for non-Cartesian chart types (`sankey`
 * multi-level flows, `calendar` heatmaps, and hierarchical `treemap` /
 * `sunburst` / `tree` charts) after `$bind` resolution.
 */
export function applyRowDrivenChart(
  option: Record<string, unknown>,
  props: StructuredProps | undefined,
  rows: Record<string, unknown>[],
): Record<string, unknown> {
  const chartType = props?.chartType;
  if (!chartType || !ROW_DRIVEN_TYPES.has(chartType)) return option;

  const metricKey = firstMetricKey(props, rows);
  const dimensions = (props?.dataBinding?.dimensions ?? [])
    .map(labelOf)
    .filter((dim): dim is string => Boolean(dim));

  if (chartType === 'sankey') {
    const nodeNames = new Set<string>();
    const nodeLevel = new Map<string, number>();
    const linkTotals = new Map<string, number>();

    const nodeNameFor = (raw: unknown, level: number, dim: string): string => {
      const base = raw === null || raw === undefined ? '–' : String(raw);
      const existingLevel = nodeLevel.get(base);
      if (existingLevel === undefined || existingLevel === level) {
        nodeLevel.set(base, level);
        return base;
      }
      const qualified = `${base} (${dim})`;
      nodeLevel.set(qualified, level);
      return qualified;
    };

    if (dimensions.length >= 2 && metricKey) {
      for (const row of rows) {
        const val = Number(row[metricKey]) || 0;
        for (let i = 0; i < dimensions.length - 1; i += 1) {
          const source = nodeNameFor(row[dimensions[i]], i, dimensions[i]);
          const target = nodeNameFor(
            row[dimensions[i + 1]],
            i + 1,
            dimensions[i + 1],
          );
          if (source === target) continue;
          nodeNames.add(source);
          nodeNames.add(target);
          const key = `${source}\u0000${target}`;
          linkTotals.set(key, (linkTotals.get(key) ?? 0) + val);
        }
      }
    }

    const links = Array.from(linkTotals.entries()).map(([key, value]) => {
      const [source, target] = key.split('\u0000');
      return { source, target, value };
    });

    const next = { ...option };
    delete next.xAxis;
    delete next.yAxis;
    return {
      ...next,
      tooltip: option.tooltip ?? { trigger: 'item', triggerOn: 'mousemove' },
      series: [
        {
          type: 'sankey',
          emphasis: { focus: 'adjacency' },
          data: Array.from(nodeNames).map(name => ({ name })),
          links,
        },
      ],
    };
  }

  if (chartType === 'treemap' || chartType === 'sunburst' || chartType === 'tree') {
    const tree = buildHierarchyTree(rows, dimensions, metricKey);
    const next = { ...option };
    delete next.xAxis;
    delete next.yAxis;
    const seriesEntry =
      chartType === 'treemap'
        ? {
            type: 'treemap',
            roam: false,
            leafDepth: 2,
            data: tree,
          }
        : chartType === 'sunburst'
          ? {
              type: 'sunburst',
              radius: ['15%', '90%'],
              data: tree,
            }
          : {
              type: 'tree',
              data: [{ name: dimensions[0] ?? 'Root', children: tree }],
              expandAndCollapse: true,
              roam: false,
              label: {
                position: 'left',
                verticalAlign: 'middle',
                align: 'right',
              },
              leaves: {
                label: {
                  position: 'right',
                  verticalAlign: 'middle',
                  align: 'left',
                },
              },
            };
    return {
      ...next,
      tooltip: option.tooltip ?? { trigger: 'item' },
      series: [seriesEntry],
    };
  }

  // Calendar heatmap: [YYYY-MM-DD, value]
  const dateDim = dimensions[0];
  const pairs: [string, number][] = [];
  let min = Infinity;
  let max = -Infinity;

  if (dateDim && metricKey) {
    for (const row of rows) {
      const dateStr = formatCalendarDate(row[dateDim]);
      if (!dateStr) continue;
      const val = Number(row[metricKey]) || 0;
      pairs.push([dateStr, val]);
      if (val < min) min = val;
      if (val > max) max = val;
    }
  }

  const defaultRange = pairs[0]?.[0]?.slice(0, 4) ?? String(new Date().getFullYear());
  const next = { ...option };
  delete next.xAxis;
  delete next.yAxis;
  return {
    ...next,
    tooltip: option.tooltip ?? { trigger: 'item' },
    visualMap: option.visualMap ?? {
      min: Number.isFinite(min) ? min : 0,
      max: Number.isFinite(max) ? max : 100,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
    },
    calendar: option.calendar ?? {
      top: 40,
      left: 40,
      right: 20,
      cellSize: ['auto', props?.chrome?.labelShow ? 22 : 14],
      range: defaultRange,
    },
    series: [
      {
        type: 'heatmap',
        coordinateSystem: 'calendar',
        data: pairs,
      },
    ],
  };
}
