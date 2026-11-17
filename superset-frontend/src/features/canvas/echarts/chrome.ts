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

import { formatDatePattern } from '../conditionalFormatting';

/**
 * The `echarts` widget's `chrome` layer (title, legend, tooltip, axis labels),
 * per `EchartsChrome` in `superset/widgets/controls.py`: a field left at its
 * default never touches `echartsOptions`; a set field merges onto the
 * matching section, so unmanaged siblings (e.g. `legend.orient`) survive.
 */
export interface EchartsChromeValue {
  titleText?: string;
  legendShow?: boolean;
  legendPosition?: 'top' | 'bottom' | 'left' | 'right' | null;
  tooltipTrigger?: 'item' | 'axis' | null;
  tooltipShow?: boolean;
  tooltipFormat?: string;
  labelShow?: boolean;
  labelPosition?: 'top' | 'inside' | 'bottom' | 'left' | 'right' | null;
  labelFormat?: string;
  labelColor?: string;
  labelFontSize?: number;
  labelRotate?: number;
  labelDecimals?: number | null;
  xAxisName?: string;
  xAxisRotate?: number;
  xAxisFormat?: string;
  xAxisDateFormat?: string;
  yAxisName?: string;
  yAxisRotate?: number;
  yAxisFormat?: string;
  targetParam?: string;
  scrollMode?: 'none' | 'zoombar' | 'scrollbar' | null;
  visibleBars?: number | null;
  timeGrainParam?: string;
  dimensionParam?: string;
  metricParam?: string;
  numberFormat?: 'none' | 'compact' | 'currency' | 'percent' | null;
  currencySymbol?: string;
  aboveTargetColor?: string;
  belowTargetColor?: string;
  stack?: boolean;
  horizontal?: boolean;
  yAxisMin?: number | null;
  yAxisMax?: number | null;
  showGridLines?: boolean;
}

// ECharts has no single "position" property on `legend` — placement comes
// from `top`/`left` (each accepting a keyword or coordinate). This maps the
// friendlier compass-direction picker onto the pair ECharts actually reads.
const LEGEND_POSITION: Record<string, { top: string; left: string }> = {
  top: { top: 'top', left: 'center' },
  bottom: { top: 'bottom', left: 'center' },
  left: { top: 'middle', left: 'left' },
  right: { top: 'middle', left: 'right' },
};

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * ECharts accepts either one `title`/`legend`/`xAxis`/`yAxis` config or an
 * array of them (multi-axis charts, in particular, rely on `xAxis`/`yAxis`
 * arrays). Merging an override onto an array with a plain object spread
 * would convert it into an object keyed by numeric index, silently changing
 * its meaning — so an array's override always lands on its first entry
 * (ECharts' own convention for "the" axis/title/legend) and the rest of the
 * array is preserved as-is.
 */
function mergeSection(
  existing: unknown,
  override: Record<string, unknown>,
): unknown {
  if (Array.isArray(existing)) {
    const [first, ...rest] = existing;
    return [{ ...asRecord(first), ...override }, ...rest];
  }
  return { ...asRecord(existing), ...override };
}

function firstEntry(existing: unknown): unknown {
  return Array.isArray(existing) ? existing[0] : existing;
}

function applyLegend(existing: unknown, chrome: EchartsChromeValue): unknown {
  const override: Record<string, unknown> = {};
  if (chrome.legendShow === false) override.show = false;
  if (chrome.legendPosition) {
    Object.assign(override, LEGEND_POSITION[chrome.legendPosition]);
  }
  if (Object.keys(override).length === 0) return existing;
  return mergeSection(existing, override);
}

function formatCompactNumber(
  raw: unknown,
  mode: 'compact' | 'currency' | 'percent',
  currencySymbol = '$',
  decimals?: number | null,
): string {
  const num = Number(raw);
  if (!Number.isFinite(num)) return raw === undefined ? '' : String(raw);
  const maxFrac = typeof decimals === 'number' ? decimals : 1;
  if (mode === 'percent') {
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: typeof decimals === 'number' ? decimals : 0,
      maximumFractionDigits: maxFrac,
    }).format(num);
  }
  const formatted = new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: maxFrac,
  }).format(num);
  return mode === 'currency' ? `${currencySymbol}${formatted}` : formatted;
}

function applyTitle(existing: unknown, chrome: EchartsChromeValue): unknown {
  if (!chrome.titleText) return existing;
  return mergeSection(existing, { text: chrome.titleText });
}

function applyTooltip(existing: unknown, chrome: EchartsChromeValue): unknown {
  const override: Record<string, unknown> = {};
  if (chrome.tooltipTrigger) override.trigger = chrome.tooltipTrigger;
  if (chrome.tooltipShow === false) override.show = false;
  if (chrome.tooltipFormat) {
    override.formatter = chrome.tooltipFormat;
  } else if (chrome.numberFormat && chrome.numberFormat !== 'none') {
    const mode = chrome.numberFormat;
    const symbol = chrome.currencySymbol || '$';
    const decimals = chrome.labelDecimals;
    override.valueFormatter = (value: unknown) =>
      formatCompactNumber(value, mode, symbol, decimals);
  }
  if (Object.keys(override).length === 0) return existing;
  return mergeSection(existing, override);
}

function applySeriesLabels(
  existing: unknown,
  chrome: EchartsChromeValue,
): unknown {
  const labelOverride: Record<string, unknown> = {};
  if (chrome.labelShow) labelOverride.show = true;
  if (chrome.labelPosition) labelOverride.position = chrome.labelPosition;
  if (chrome.labelFormat) {
    labelOverride.formatter = chrome.labelFormat;
  } else if (chrome.numberFormat && chrome.numberFormat !== 'none') {
    const mode = chrome.numberFormat;
    const symbol = chrome.currencySymbol || '$';
    const decimals = chrome.labelDecimals;
    labelOverride.formatter = (params: { value?: unknown }) => {
      const raw = Array.isArray(params?.value)
        ? params.value[params.value.length - 1]
        : params?.value;
      return formatCompactNumber(raw, mode, symbol, decimals);
    };
  } else if (typeof chrome.labelDecimals === 'number') {
    const decimals = chrome.labelDecimals;
    labelOverride.formatter = (params: { value?: unknown }) => {
      const raw = Array.isArray(params?.value)
        ? params.value[params.value.length - 1]
        : params?.value;
      const num = Number(raw);
      if (!Number.isFinite(num)) return raw === undefined ? '' : String(raw);
      return num.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    };
  }
  if (chrome.labelColor) labelOverride.color = chrome.labelColor;
  if (typeof chrome.labelFontSize === 'number') {
    labelOverride.fontSize = chrome.labelFontSize;
  }
  if (chrome.labelRotate) {
    labelOverride.rotate = chrome.labelRotate;
  }
  const shouldStack = Boolean(chrome.stack);
  if (Object.keys(labelOverride).length === 0 && !shouldStack) return existing;
  const patchSeries = (rec: Record<string, unknown>) => {
    const next = { ...rec };
    if (Object.keys(labelOverride).length > 0) {
      next.label = { ...asRecord(rec.label), ...labelOverride };
    }
    if (
      shouldStack &&
      (rec.type === 'bar' || rec.type === 'line' || rec.type === 'area')
    ) {
      next.stack = rec.stack ?? 'total';
    }
    return next;
  };
  if (!Array.isArray(existing)) {
    const rec = asRecord(existing);
    if (Object.keys(rec).length === 0) return existing;
    return patchSeries(rec);
  }
  return existing.map(item => patchSeries(asRecord(item)));
}

function applyAxis(
  existing: unknown,
  name: string | undefined,
  rotate: number | undefined,
  format: string | undefined,
  dateFormat?: string,
  extra?: {
    numberFormat?: 'none' | 'compact' | 'currency' | 'percent' | null;
    currencySymbol?: string;
    decimals?: number | null;
    min?: number | null;
    max?: number | null;
    showGridLines?: boolean;
  },
): unknown {
  const existingRecord = asRecord(firstEntry(existing));
  const override: Record<string, unknown> = {};
  if (name) override.name = name;
  if (typeof extra?.min === 'number' && Number.isFinite(extra.min)) {
    override.min = extra.min;
  }
  if (typeof extra?.max === 'number' && Number.isFinite(extra.max)) {
    override.max = extra.max;
  }
  if (extra?.showGridLines === false) {
    override.splitLine = { ...asRecord(existingRecord.splitLine), show: false };
  }
  const axisLabelOverride: Record<string, unknown> = {};
  if (rotate) axisLabelOverride.rotate = rotate;
  if (format) {
    axisLabelOverride.formatter = format;
  } else if (dateFormat) {
    axisLabelOverride.formatter = (value: unknown) =>
      formatDatePattern(value, dateFormat);
  } else if (extra?.numberFormat && extra.numberFormat !== 'none') {
    const mode = extra.numberFormat;
    const symbol = extra.currencySymbol || '$';
    const { decimals } = extra;
    axisLabelOverride.formatter = (value: unknown) =>
      formatCompactNumber(value, mode, symbol, decimals);
  }
  if (Object.keys(axisLabelOverride).length > 0) {
    override.axisLabel = {
      ...asRecord(existingRecord.axisLabel),
      ...axisLabelOverride,
    };
  }
  if (Object.keys(override).length === 0) return existing;
  return mergeSection(existing, override);
}

function applyTargetMarkLine(
  series: unknown,
  targetValue: number | undefined,
  targetName: string,
  horizontal = false,
): unknown {
  if (
    targetValue === undefined ||
    !Number.isFinite(targetValue) ||
    !Array.isArray(series) ||
    series.length === 0
  ) {
    return series;
  }
  const [first, ...rest] = series;
  if (!first || typeof first !== 'object' || Array.isArray(first))
    return series;
  const firstRecord = first as Record<string, unknown>;
  const existingMarkLine = asRecord(firstRecord.markLine);
  const axisKey = horizontal ? 'xAxis' : 'yAxis';
  const nextFirst = {
    ...firstRecord,
    markLine: {
      silent: true,
      ...existingMarkLine,
      label: { formatter: '{b}: {c}', ...asRecord(existingMarkLine.label) },
      data: [{ [axisKey]: targetValue, name: targetName }],
    },
  };
  return [nextFirst, ...rest];
}

function applyTargetColors(
  series: unknown,
  targetValue: number | undefined,
  chrome: EchartsChromeValue,
): unknown {
  const above = chrome.aboveTargetColor;
  const below = chrome.belowTargetColor;
  if (
    targetValue === undefined ||
    !Number.isFinite(targetValue) ||
    (!above && !below) ||
    !Array.isArray(series) ||
    series.length === 0
  ) {
    return series;
  }
  const [first, ...rest] = series;
  const firstRecord = asRecord(first);
  if (!Array.isArray(firstRecord.data)) return series;
  const nextData = firstRecord.data.map(item => {
    const itemObj =
      item && typeof item === 'object' && !Array.isArray(item)
        ? (item as Record<string, unknown>)
        : null;
    const rawVal = itemObj ? itemObj.value : item;
    const num = Number(
      Array.isArray(rawVal) ? rawVal[rawVal.length - 1] : rawVal,
    );
    if (!Number.isFinite(num)) return item;
    const color = num >= targetValue ? above : below;
    if (!color) return item;
    return {
      ...(itemObj ?? { value: item }),
      itemStyle: {
        ...(itemObj ? asRecord(itemObj.itemStyle) : {}),
        color,
      },
    };
  });
  return [{ ...firstRecord, data: nextData }, ...rest];
}

function applyDataZoom(
  existing: unknown,
  resolved: Record<string, unknown>,
  chrome: EchartsChromeValue,
): { dataZoom: unknown; grid: unknown } {
  const mode = chrome.scrollMode;
  if (!mode || mode === 'none') {
    return { dataZoom: existing, grid: resolved.grid };
  }

  const isHorizontal = Boolean(chrome.horizontal);
  const axisIndexKey = isHorizontal ? 'yAxisIndex' : 'xAxisIndex';
  const xAxisRecord = asRecord(firstEntry(resolved.xAxis));
  const yAxisRecord = asRecord(firstEntry(resolved.yAxis));
  const xData = Array.isArray(xAxisRecord.data) ? xAxisRecord.data : undefined;
  const yData = Array.isArray(yAxisRecord.data) ? yAxisRecord.data : undefined;
  const firstSeries = asRecord(firstEntry(resolved.series));
  const sData = Array.isArray(firstSeries.data) ? firstSeries.data : undefined;
  const categoryCount =
    (isHorizontal ? (yData?.length ?? xData?.length) : xData?.length) ??
    sData?.length ??
    0;

  const hasVisibleBars =
    typeof chrome.visibleBars === 'number' && chrome.visibleBars >= 1;
  const windowSize = hasVisibleBars ? Math.floor(chrome.visibleBars!) : 15;
  const windowBounds =
    (mode === 'scrollbar' || hasVisibleBars) &&
    (categoryCount === 0 || categoryCount > windowSize)
      ? { startValue: 0, endValue: windowSize - 1 }
      : {};

  const placement = isHorizontal ? { right: 6 } : { bottom: 8 };
  const thickness = isHorizontal ? { width: 10 } : { height: 10 };
  const slider: Record<string, unknown> =
    mode === 'scrollbar'
      ? {
          type: 'slider',
          [axisIndexKey]: 0,
          zoomLock: true,
          showDetail: false,
          showDataShadow: false,
          brushSelect: false,
          ...thickness,
          ...placement,
          filterMode: 'none',
          ...windowBounds,
        }
      : {
          type: 'slider',
          [axisIndexKey]: 0,
          ...placement,
          filterMode: 'none',
          ...windowBounds,
        };

  const inside: Record<string, unknown> =
    mode === 'scrollbar'
      ? {
          type: 'inside',
          [axisIndexKey]: 0,
          zoomOnMouseWheel: false,
          moveOnMouseMove: true,
          moveOnMouseWheel: true,
          filterMode: 'none',
        }
      : {
          type: 'inside',
          [axisIndexKey]: 0,
          filterMode: 'none',
        };

  const existingGrid = asRecord(resolved.grid);
  const gridEdge = isHorizontal ? 'right' : 'bottom';
  const nextGrid =
    existingGrid[gridEdge] === undefined
      ? {
          ...existingGrid,
          containLabel: existingGrid.containLabel ?? true,
          [gridEdge]: mode === 'scrollbar' ? 32 : 44,
        }
      : resolved.grid;

  return { dataZoom: [slider, inside], grid: nextGrid };
}

/**
 * Layers `chrome`'s fields onto an already `$bind`-resolved raw option, one
 * independent merge per section (`legend`/`tooltip`/`xAxis`/`yAxis`).
 * Returns `resolved` unchanged (same reference) when every field is at its
 * default.
 */
export function applyStructuredChrome(
  resolved: Record<string, unknown>,
  chrome: EchartsChromeValue | undefined,
  targetValue?: number,
): Record<string, unknown> {
  if (!chrome && targetValue === undefined) return resolved;
  const effectiveChrome = chrome ?? {};
  const isHorizontal = Boolean(effectiveChrome.horizontal);
  const title = applyTitle(resolved.title, effectiveChrome);
  const legend = applyLegend(resolved.legend, effectiveChrome);
  const tooltip = applyTooltip(resolved.tooltip, effectiveChrome);
  const labeledSeries = applySeriesLabels(resolved.series, effectiveChrome);
  const markedSeries = applyTargetMarkLine(
    labeledSeries,
    targetValue,
    effectiveChrome.targetParam || 'Target',
    isHorizontal,
  );
  const series = applyTargetColors(markedSeries, targetValue, effectiveChrome);
  const baseXAxis = applyAxis(
    resolved.xAxis,
    effectiveChrome.xAxisName,
    effectiveChrome.xAxisRotate,
    effectiveChrome.xAxisFormat,
    effectiveChrome.xAxisDateFormat,
  );
  const baseYAxis = applyAxis(
    resolved.yAxis,
    effectiveChrome.yAxisName,
    effectiveChrome.yAxisRotate,
    effectiveChrome.yAxisFormat,
    undefined,
    {
      numberFormat: effectiveChrome.numberFormat,
      currencySymbol: effectiveChrome.currencySymbol,
      decimals: effectiveChrome.labelDecimals,
      min: effectiveChrome.yAxisMin,
      max: effectiveChrome.yAxisMax,
      showGridLines: effectiveChrome.showGridLines,
    },
  );
  const xAxis = isHorizontal ? baseYAxis : baseXAxis;
  const yAxis = isHorizontal ? baseXAxis : baseYAxis;
  const { dataZoom, grid } = applyDataZoom(
    resolved.dataZoom,
    resolved,
    effectiveChrome,
  );
  if (
    title === resolved.title &&
    legend === resolved.legend &&
    tooltip === resolved.tooltip &&
    series === resolved.series &&
    xAxis === resolved.xAxis &&
    yAxis === resolved.yAxis &&
    dataZoom === resolved.dataZoom &&
    grid === resolved.grid
  ) {
    return resolved;
  }
  return {
    ...resolved,
    title,
    legend,
    tooltip,
    series,
    xAxis,
    yAxis,
    dataZoom,
    grid,
  };
}
