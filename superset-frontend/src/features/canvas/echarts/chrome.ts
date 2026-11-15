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

function applyTitle(existing: unknown, chrome: EchartsChromeValue): unknown {
  if (!chrome.titleText) return existing;
  return mergeSection(existing, { text: chrome.titleText });
}

function applyTooltip(existing: unknown, chrome: EchartsChromeValue): unknown {
  const override: Record<string, unknown> = {};
  if (chrome.tooltipTrigger) override.trigger = chrome.tooltipTrigger;
  if (chrome.tooltipShow === false) override.show = false;
  if (chrome.tooltipFormat) override.formatter = chrome.tooltipFormat;
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
  if (Object.keys(labelOverride).length === 0) return existing;
  if (!Array.isArray(existing)) {
    const rec = asRecord(existing);
    if (Object.keys(rec).length === 0) return existing;
    return { ...rec, label: { ...asRecord(rec.label), ...labelOverride } };
  }
  return existing.map(item => {
    const rec = asRecord(item);
    return { ...rec, label: { ...asRecord(rec.label), ...labelOverride } };
  });
}

function applyAxis(
  existing: unknown,
  name: string | undefined,
  rotate: number | undefined,
  format: string | undefined,
  dateFormat?: string,
): unknown {
  const existingRecord = asRecord(firstEntry(existing));
  const override: Record<string, unknown> = {};
  if (name) override.name = name;
  const axisLabelOverride: Record<string, unknown> = {};
  if (rotate) axisLabelOverride.rotate = rotate;
  if (format) {
    axisLabelOverride.formatter = format;
  } else if (dateFormat) {
    axisLabelOverride.formatter = (value: unknown) =>
      formatDatePattern(value, dateFormat);
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
  if (!first || typeof first !== 'object' || Array.isArray(first)) return series;
  const firstRecord = first as Record<string, unknown>;
  const existingMarkLine = asRecord(firstRecord.markLine);
  const nextFirst = {
    ...firstRecord,
    markLine: {
      silent: true,
      ...existingMarkLine,
      label: { formatter: '{b}: {c}', ...asRecord(existingMarkLine.label) },
      data: [{ yAxis: targetValue, name: targetName }],
    },
  };
  return [nextFirst, ...rest];
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
  const title = applyTitle(resolved.title, effectiveChrome);
  const legend = applyLegend(resolved.legend, effectiveChrome);
  const tooltip = applyTooltip(resolved.tooltip, effectiveChrome);
  const labeledSeries = applySeriesLabels(resolved.series, effectiveChrome);
  const series = applyTargetMarkLine(
    labeledSeries,
    targetValue,
    effectiveChrome.targetParam || 'Target',
  );
  const xAxis = applyAxis(
    resolved.xAxis,
    effectiveChrome.xAxisName,
    effectiveChrome.xAxisRotate,
    effectiveChrome.xAxisFormat,
    effectiveChrome.xAxisDateFormat,
  );
  const yAxis = applyAxis(
    resolved.yAxis,
    effectiveChrome.yAxisName,
    effectiveChrome.yAxisRotate,
    effectiveChrome.yAxisFormat,
  );
  if (
    title === resolved.title &&
    legend === resolved.legend &&
    tooltip === resolved.tooltip &&
    series === resolved.series &&
    xAxis === resolved.xAxis &&
    yAxis === resolved.yAxis
  ) {
    return resolved;
  }
  return { ...resolved, title, legend, tooltip, series, xAxis, yAxis };
}
