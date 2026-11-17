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
import {
  DataRecord,
  getMetricLabel,
  getNumberFormatter,
} from '@superset-ui/core';
import {
  S2TableChartProps,
  S2TableTransformedProps,
  Refs,
  EnhancedConditionalFormattingRule,
} from './types';
import type { S2DataConfig } from '@antv/s2';

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
    ];
  }
  return [
    parseInt(clean.substring(0, 2), 16) || 0,
    parseInt(clean.substring(2, 4), 16) || 0,
    parseInt(clean.substring(4, 6), 16) || 0,
  ];
}

function hexToRgba(color: string, opacity?: number): string {
  if (!color) return 'transparent';
  if (opacity === undefined || opacity === 1) {
    if (color.startsWith('#') || color.startsWith('rgb')) {
      return color;
    }
  }
  if (color.startsWith('rgba')) {
    return color;
  }
  if (color.startsWith('rgb(')) {
    const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      const [, r, g, b] = match;
      const alpha =
        opacity !== undefined ? Math.max(0, Math.min(1, opacity)) : 1;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }
  const [r, g, b] = hexToRgb(color);
  const alpha = opacity !== undefined ? Math.max(0, Math.min(1, opacity)) : 1;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function interpolateColor(
  color1: string,
  color2: string,
  factor: number,
  opacity1?: number,
  opacity2?: number,
): string {
  const [r1, g1, b1] = hexToRgb(color1);
  const [r2, g2, b2] = hexToRgb(color2);
  const r = Math.round(r1 + factor * (r2 - r1));
  const g = Math.round(g1 + factor * (g2 - g1));
  const b = Math.round(b1 + factor * (b2 - b1));

  if (opacity1 !== undefined || opacity2 !== undefined) {
    const o1 = opacity1 ?? 1;
    const o2 = opacity2 ?? 1;
    const o = Number((o1 + factor * (o2 - o1)).toFixed(3));
    return `rgba(${r}, ${g}, ${b}, ${o})`;
  }

  return `rgb(${r}, ${g}, ${b})`;
}

interface ColumnStats {
  min: number;
  max: number;
  sum: number;
  avg: number;
  median: number;
}

function computeColumnStats(
  data: Record<string, unknown>[],
  col: string,
): ColumnStats | undefined {
  const values = data
    .map(row => row[col])
    .filter(v => v !== null && v !== undefined && v !== '')
    .map(v => Number(v))
    .filter(v => !isNaN(v));
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const avg = sum / sorted.length;
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  return { min, max, sum, avg, median };
}

function resolveColumnValue(
  colName: string,
  currentField: string,
  cellValue: unknown,
  rowData?: Record<string, unknown>,
  cell?: any,
): unknown {
  if (colName === currentField && cellValue !== undefined) {
    return cellValue;
  }
  if (rowData && rowData[colName] !== undefined) {
    return rowData[colName];
  }
  const metaQuery = (rowData as any)?.query || cell?.getMeta?.()?.query;
  if (metaQuery && metaQuery[colName] !== undefined) {
    return metaQuery[colName];
  }
  if (cell?.spreadsheet?.dataSet?.getCellData && metaQuery) {
    const cellData = cell.spreadsheet.dataSet.getCellData({
      query: { ...metaQuery, $$extra$$: colName },
    });
    if (cellData !== undefined && cellData !== null) {
      if (typeof cellData === 'object' && 'raw' in cellData) {
        const rawVal = (cellData as any).raw?.[colName];
        if (rawVal !== undefined) return rawVal;
      }
      if (typeof cellData === 'object' && colName in cellData) {
        return (cellData as any)[colName];
      }
      if (typeof cellData !== 'object') {
        return cellData;
      }
    }
  }
  return colName === currentField ? cellValue : undefined;
}

/**
 * Evaluates whether a conditional formatting rule matches a given cell value and row context.
 * Supports string comparisons (=, !=, contains, not_contains, starts_with, ends_with, in)
 * and numeric comparisons (>, <, >=, <=, =, !=, between) against static values,
 * dynamic columns, or column-level statistical calculations (avg, median, min, max, pct_of_max, pct_of_total).
 */
function isRuleMatched(
  rule: EnhancedConditionalFormattingRule,
  value: unknown,
  rowData?: Record<string, unknown>,
  currentField = rule.column,
  cell?: any,
  statsMap?: Record<string, ColumnStats | undefined>,
): boolean {
  if (cell?.getMeta?.()?.isTotals && !rule.includeTotals) {
    return false;
  }

  const evaluatedVal = resolveColumnValue(
    rule.column,
    currentField,
    value,
    rowData,
    cell,
  );
  if (evaluatedVal === null || evaluatedVal === undefined) return false;

  const isStringMatch =
    rule.targetValueText !== undefined ||
    rule.operator === 'contains' ||
    rule.operator === 'not_contains' ||
    rule.operator === 'starts_with' ||
    rule.operator === 'ends_with' ||
    rule.operator === 'in' ||
    (typeof evaluatedVal === 'string' && isNaN(Number(evaluatedVal)));

  if (isStringMatch) {
    const valStr = String(evaluatedVal).trim().toLowerCase();
    let targetStr: string | undefined;

    if (rule.compareTarget === 'column') {
      if (!rule.targetColumn) return false;
      const rawColVal = resolveColumnValue(
        rule.targetColumn,
        currentField,
        value,
        rowData,
        cell,
      );
      if (rawColVal === null || rawColVal === undefined) return false;
      targetStr = String(rawColVal).trim().toLowerCase();
    } else {
      targetStr = String(rule.targetValueText ?? rule.targetValue ?? '')
        .trim()
        .toLowerCase();
    }

    switch (rule.operator) {
      case '=':
        return valStr === targetStr;
      case '!=':
        return valStr !== targetStr;
      case 'contains':
        return valStr.includes(targetStr);
      case 'not_contains':
        return !valStr.includes(targetStr);
      case 'starts_with':
        return valStr.startsWith(targetStr);
      case 'ends_with':
        return valStr.endsWith(targetStr);
      case 'in': {
        const items = targetStr
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);
        return items.includes(valStr);
      }
      default:
        return valStr === targetStr;
    }
  }

  // Numeric comparison
  const rawNum = Number(evaluatedVal);
  if (isNaN(rawNum)) return false;

  let numVal = rawNum;
  let targetVal: number | undefined;
  const compareTarget = rule.compareTarget || 'static';
  const multiplier = rule.compareMultiplier ?? 1;
  const colStats = statsMap?.[rule.column];

  switch (compareTarget) {
    case 'column': {
      if (!rule.targetColumn) return false;
      const rawColVal = resolveColumnValue(
        rule.targetColumn,
        currentField,
        value,
        rowData,
        cell,
      );
      if (rawColVal === null || rawColVal === undefined) return false;
      targetVal = Number(rawColVal) * multiplier;
      break;
    }
    case 'avg':
      if (!colStats) return false;
      targetVal = colStats.avg * multiplier;
      break;
    case 'median':
      if (!colStats) return false;
      targetVal = colStats.median * multiplier;
      break;
    case 'min':
      if (!colStats) return false;
      targetVal = colStats.min;
      break;
    case 'max':
      if (!colStats) return false;
      targetVal = colStats.max;
      break;
    case 'pct_of_max':
      if (!colStats || colStats.max === 0) return false;
      numVal = (rawNum / colStats.max) * 100;
      targetVal = rule.targetValue;
      break;
    case 'pct_of_total':
      if (!colStats || colStats.sum === 0) return false;
      numVal = (rawNum / colStats.sum) * 100;
      targetVal = rule.targetValue;
      break;
    case 'static':
    default:
      targetVal = rule.targetValue;
      break;
  }

  if (targetVal === undefined || isNaN(targetVal)) return false;

  switch (rule.operator) {
    case '>':
      return numVal > targetVal;
    case '<':
      return numVal < targetVal;
    case '>=':
      return numVal >= targetVal;
    case '<=':
      return numVal <= targetVal;
    case '=':
      return numVal === targetVal;
    case '!=':
      return numVal !== targetVal;
    case 'between': {
      const rightVal = rule.targetValueRight;
      if (rightVal !== undefined && !isNaN(rightVal)) {
        return numVal > targetVal && numVal < rightVal;
      }
      return false;
    }
    default:
      return false;
  }
}

/**
 * Aggregate helper: computes a single value from an array of numbers
 * based on the given aggregation type.
 */
function aggregate(values: number[], aggType: string): number {
  switch (aggType) {
    case 'SUM':
      return values.reduce((a, b) => a + b, 0);
    case 'AVG':
      return values.length > 0
        ? values.reduce((a, b) => a + b, 0) / values.length
        : 0;
    case 'MIN':
      return values.length > 0
        ? values.reduce((a, b) => (a < b ? a : b), values[0])
        : 0;
    case 'MAX':
      return values.length > 0
        ? values.reduce((a, b) => (a > b ? a : b), values[0])
        : 0;
    case 'COUNT':
      return values.length;
    case 'COUNT_DISTINCT':
      return new Set(values).size;
    default:
      return values.reduce((a, b) => a + b, 0);
  }
}

/**
 * Safely parse a JSON string, returning fallback on failure.
 */
function safeParseJson<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return fallback;
  }
}

/**
 * Normalize a column reference (object with column_name / label, or string)
 * to a plain string field name.
 */
function normalizeCol(c: unknown): string {
  if (c && typeof c === 'object' && !Array.isArray(c)) {
    const colObj = c as Record<string, unknown>;
    return String(colObj.column_name || colObj.label || '');
  }
  return String(c ?? '');
}

/** Sort menu item definitions — static, allocated once. */
const SORT_ITEMS_DIMENSION = [
  { key: 'asc', icon: 'groupAsc', label: 'Ascending' },
  { key: 'desc', icon: 'groupDesc', label: 'Descending' },
  { key: 'none', label: 'No sort' },
];
const SORT_ITEMS_GROUP = [
  { key: 'asc', icon: 'groupAsc', label: 'Group Ascending' },
  { key: 'desc', icon: 'groupDesc', label: 'Group Descending' },
  { key: 'none', label: 'No sort' },
];

/**
 * Handle sort icon click for both rowCell and colCell header action icons.
 * Extracts the duplicated ~80-line handler into a single reusable function.
 */
function handleSortIconClick(options: any): void {
  const { event, meta } = options;
  event.stopPropagation();
  const { spreadsheet } = meta;
  if (!spreadsheet) return;

  spreadsheet.interaction.addIntercepts(['hover']);

  const isDimension =
    meta.field !== '$$extra$$' && !meta.isMeasure && !meta.isTotals;

  if (isDimension) {
    const currentSortParam = spreadsheet.dataCfg?.sortParams?.find(
      (p: any) => p.sortFieldId === meta.field,
    );
    const defaultSelectedKeys = currentSortParam?.sortMethod
      ? [currentSortParam.sortMethod.toLowerCase()]
      : ['none'];

    spreadsheet.showTooltipWithInfo(event, [], {
      operator: {
        menu: {
          onClick: ({ key }: { key: string }) => {
            const sortMethod = key.toUpperCase();
            const prevSortParams = (
              spreadsheet.dataCfg?.sortParams || []
            ).filter((p: any) => p.sortFieldId !== meta.field);
            const newSortParams =
              sortMethod === 'NONE'
                ? prevSortParams
                : [...prevSortParams, { sortFieldId: meta.field, sortMethod }];

            spreadsheet.emit('sort:range-sort', newSortParams);
            spreadsheet.setDataCfg({
              ...spreadsheet.dataCfg,
              sortParams: newSortParams,
            });
            spreadsheet.render();
            spreadsheet.hideTooltip();
          },
          items: SORT_ITEMS_DIMENSION,
          selectedKeys: defaultSelectedKeys,
        },
      },
      onlyShowOperator: true,
      forceRender: true,
    });
  } else {
    const defaultSelectedKeys = spreadsheet.getMenuDefaultSelectedKeys(
      meta?.id,
    );

    spreadsheet.showTooltipWithInfo(event, [], {
      operator: {
        menu: {
          onClick: ({ key }: { key: string }) => {
            if (typeof spreadsheet.groupSortByMethod === 'function') {
              spreadsheet.groupSortByMethod(key, meta);
            }
            spreadsheet.emit('sort:range-sorted', event);
            spreadsheet.hideTooltip();
          },
          items: SORT_ITEMS_GROUP,
          selectedKeys: defaultSelectedKeys,
        },
      },
      onlyShowOperator: true,
      forceRender: true,
    });
  }
}

export default function transformProps(
  chartProps: S2TableChartProps,
): S2TableTransformedProps {
  const {
    formData,
    height,
    width,
    queriesData,
    hooks,
    filterState,
    emitCrossFilters,
    theme: supersetTheme,
  } = chartProps as any;

  const { setDataMask = () => {}, setControlValue } = hooks;

  // ── Form data extraction ─────────────────────
  const rawGroupby = formData.groupby || [];
  const rawColumns = formData.columns || [];
  const metricsRaw = formData.metrics || [];

  const tableMode = formData.tableMode ?? formData.table_mode ?? 'grid';
  const emitFilter = formData.emitFilter ?? formData.emit_filter ?? true;

  const totalLabel = formData.totalLabel ?? formData.total_label ?? 'Total';
  const showRowTotals =
    formData.showRowTotals ?? formData.show_row_totals ?? true;
  const showRowSubtotals =
    formData.showRowSubtotals ?? formData.show_row_subtotals ?? false;
  const showColTotals =
    formData.showColTotals ?? formData.show_col_totals ?? true;
  const showColSubtotals =
    formData.showColSubtotals ?? formData.show_col_subtotals ?? false;
  const showSortControls =
    formData.showSortControls ?? formData.show_sort_controls ?? true;
  const showSeriesNumber =
    formData.showSeriesNumber ?? formData.show_series_number ?? false;
  const layoutWidthType =
    formData.layoutWidthType ?? formData.layout_width_type ?? 'adaptive';
  const showTooltip = formData.showTooltip ?? formData.show_tooltip ?? true;

  const rowHeightRaw = formData.rowHeight ?? formData.row_height;
  const rowHeight =
    rowHeightRaw && !isNaN(Number(rowHeightRaw))
      ? Number(rowHeightRaw)
      : undefined;

  const colHeightRaw = formData.colHeight ?? formData.col_height;
  const colHeight =
    colHeightRaw && !isNaN(Number(colHeightRaw))
      ? Number(colHeightRaw)
      : undefined;

  const explicitHideMeasure =
    formData.hideMeasureColumn ??
    formData.hide_measure_column ??
    formData.hideMetricColumn ??
    formData.hide_metric_column ??
    formData.hideMetricsColumns ??
    formData.hide_metrics_columns;

  const showSingleMetricHeader = Boolean(
    formData.showSingleMetricHeader ??
    formData.show_single_metric_header ??
    false,
  );

  const metricsLayout =
    formData.metricsLayout ?? formData.metrics_layout ?? 'columns';
  const valueInCols = metricsLayout === 'columns';

  const totalsPosition =
    formData.totalsPosition ?? formData.totals_position ?? 'bottom_right';
  const reverseTotalsLayout = totalsPosition === 'top_left';

  const nullPlaceholder =
    formData.nullPlaceholder ?? formData.null_placeholder ?? '-';

  const enableExport = formData.enableExport ?? formData.enable_export ?? false;

  const enhancedRules: EnhancedConditionalFormattingRule[] =
    formData.enhancedConditionalFormatting ??
    formData.enhanced_conditional_formatting ??
    [];

  const colHeaderWordWrap =
    formData.colHeaderWordWrap ?? formData.col_header_word_wrap ?? false;
  const rowHeaderWordWrap =
    formData.rowHeaderWordWrap ?? formData.row_header_word_wrap ?? false;
  const dataCellWordWrap =
    formData.dataCellWordWrap ?? formData.data_cell_word_wrap ?? false;

  const advancedS2Options =
    formData.advancedS2Options ?? formData.advanced_s2_options;
  const advancedS2OptionsObj = safeParseJson<any>(advancedS2Options, {});

  const dimensionConfig =
    formData.dimensionConfig || formData.dimension_config || {};
  const metricConfig = formData.metricConfig || formData.metric_config || {};

  const columnAggregations: Record<string, string> = {};
  const columnAlignmentsObj: Record<string, 'left' | 'center' | 'right'> = {};
  const columnBoldTextObj: Record<string, boolean> = {};
  const columnFormatsObj: Record<string, string> = {};
  const columnWidthsObj: Record<string, number> = {};
  const customColumnNames: Record<string, string> = {};
  const disabledSubtotalDimensions = new Set<string>();

  Object.entries(dimensionConfig).forEach(([col, cfg]: [string, any]) => {
    if (cfg?.columnWidth !== undefined) {
      columnWidthsObj[col] = cfg.columnWidth;
    }
    if (cfg?.horizontalAlign) {
      columnAlignmentsObj[col] = cfg.horizontalAlign;
    }
    if (cfg?.customColumnName) {
      customColumnNames[col] = cfg.customColumnName;
    }
    if (cfg?.showSubtotal === false) {
      disabledSubtotalDimensions.add(col);
    }
    if (cfg?.boldText !== undefined) {
      columnBoldTextObj[col] = cfg.boldText;
    }
  });

  const excludeTotalsMetricsRaw: string[] =
    formData.excludeTotalsMetrics ?? formData.exclude_totals_metrics ?? [];
  const excludeTotalsSet = new Set(excludeTotalsMetricsRaw);

  Object.entries(metricConfig).forEach(([col, cfg]: [string, any]) => {
    if (cfg?.columnWidth !== undefined) {
      columnWidthsObj[col] = cfg.columnWidth;
    }
    if (cfg?.horizontalAlign) {
      columnAlignmentsObj[col] = cfg.horizontalAlign;
    }
    if (cfg?.d3NumberFormat) {
      columnFormatsObj[col] = cfg.d3NumberFormat;
    }
    if (cfg?.totalAggregation) {
      columnAggregations[col] = cfg.totalAggregation;
    }
    if (cfg?.customColumnName) {
      customColumnNames[col] = cfg.customColumnName;
    }
    if (cfg?.excludeTotals) {
      excludeTotalsSet.add(col);
    }
    if (cfg?.boldText !== undefined) {
      columnBoldTextObj[col] = cfg.boldText;
    }
  });

  const defaultDimensionAlign =
    formData.defaultDimensionAlign ??
    formData.default_dimension_align ??
    'left';
  const defaultMetricAlign =
    formData.defaultMetricAlign ?? formData.default_metric_align ?? 'right';

  const s2LayoutWidthType =
    layoutWidthType === 'custom' ? 'compact' : layoutWidthType;
  const widthByField =
    layoutWidthType === 'custom' ? columnWidthsObj : undefined;

  const headerColorObj = formData.headerColor ?? formData.header_color;

  const headerColorRaw = formData.headerColor ?? formData.header_color;
  const headerColor =
    headerColorRaw &&
    typeof headerColorRaw === 'object' &&
    'r' in headerColorRaw
      ? `rgba(${headerColorRaw.r}, ${headerColorRaw.g}, ${headerColorRaw.b}, ${headerColorRaw.a ?? 1})`
      : undefined;

  const borderColorObj = formData.borderColor ?? formData.border_color;

  const borderColorRaw = formData.borderColor ?? formData.border_color;
  const borderColor =
    borderColorRaw &&
    typeof borderColorRaw === 'object' &&
    'r' in borderColorRaw
      ? `rgba(${borderColorRaw.r}, ${borderColorRaw.g}, ${borderColorRaw.b}, ${borderColorRaw.a ?? 1})`
      : undefined;

  const rowBandingColorObj =
    formData.rowBandingColor ?? formData.row_banding_color;

  const rowBandingColorRaw =
    formData.rowBandingColor ?? formData.row_banding_color;
  const rowBandingColor =
    rowBandingColorRaw &&
    typeof rowBandingColorRaw === 'object' &&
    'r' in rowBandingColorRaw
      ? `rgba(${rowBandingColorRaw.r}, ${rowBandingColorRaw.g}, ${rowBandingColorRaw.b}, ${rowBandingColorRaw.a ?? 1})`
      : undefined;

  const rawCrossfilterCols =
    formData.crossfilterColumns ?? formData.crossfilter_columns ?? [];
  const crossfilterColumns = rawCrossfilterCols.map(normalizeCol);

  // Normalize field names
  const groupby = rawGroupby.map(normalizeCol);
  const columns = rawColumns.map(normalizeCol);
  const rawMetricNames: string[] = metricsRaw.map((m: any) =>
    getMetricLabel(m),
  );

  // Superset data payload
  const verboseMap: Record<string, string> =
    (chartProps as any).datasource?.verboseMap || {};
  const queryData = queriesData[0] || {};
  const data: DataRecord[] = queryData.data || [];
  const colnames: string[] = (queryData as any).colnames || [];

  // Use Sets for O(1) metric name lookups instead of repeated Array.includes
  const groupbySet = new Set(groupby);
  const columnsSet = new Set(columns);
  const metricNameSet = new Set(rawMetricNames);
  const metricNameLowerSet = new Set(
    rawMetricNames.map((n: string) => n.toLowerCase()),
  );
  const metricCols = colnames.filter(
    c =>
      !groupbySet.has(c) &&
      !columnsSet.has(c) &&
      (metricNameSet.has(c) || metricNameLowerSet.has(c.toLowerCase())),
  );

  const allFields = [...groupby, ...columns, ...metricCols];

  const hideMeasureColumn =
    Boolean(explicitHideMeasure) ||
    (columns.length > 0 && metricCols.length === 1 && !showSingleMetricHeader);

  // Find tree dimension width in Tree mode
  let treeWidth: number | undefined;
  if (tableMode === 'tree' && groupby.length > 0) {
    for (const col of groupby) {
      if (columnWidthsObj[col] !== undefined) {
        treeWidth = columnWidthsObj[col];
        break;
      }
    }
  }

  // ── S2 Data Config ───────────────────────────
  const s2Data = data.map(row => {
    const out: Record<string, string | number | null> = {};
    for (const col of groupby) {
      out[col] =
        row[col] === null || row[col] === undefined ? '' : String(row[col]);
    }
    for (const col of columns) {
      out[col] =
        row[col] === null || row[col] === undefined ? '' : String(row[col]);
    }
    for (const col of metricCols) {
      const val = row[col];
      out[col] =
        val === null || val === undefined || val === '' ? null : Number(val);
    }
    return out;
  });

  const s2DataConfig: S2DataConfig = {
    fields: {
      rows: groupby,
      columns,
      values: metricCols,
      valueInCols,
    },
    meta: allFields.map(f => {
      const isMetric = metricCols.includes(f);
      const displayName = customColumnNames[f] || verboseMap[f] || f;
      if (isMetric) {
        const customFormat = columnFormatsObj[f];
        const formatter = getNumberFormatter(customFormat || 'SMART_NUMBER');
        return {
          field: f,
          name: displayName,
          formatter: (val: any) =>
            val === null || val === undefined
              ? nullPlaceholder
              : formatter(val),
        };
      }
      return {
        field: f,
        name: displayName,
      };
    }),
    data: s2Data,
  };

  // ── Per-column aggregation calcFunc ───────────
  const calcFunc = (
    query: Record<string, any>,
    rows: Record<string, any>[],
  ) => {
    const metric = query['$$extra$$'];
    if (!metric) return 0;
    if (excludeTotalsSet.has(metric)) {
      return null;
    }

    // A query represents a Grand Total if it contains no dimension keys (only $$extra$$)
    const isGrandTotal = Object.keys(query).every(key => key === '$$extra$$');
    if (isGrandTotal && queriesData[1]?.data?.[0]) {
      return Number(queriesData[1].data[0][metric]) || 0;
    }

    const values = rows.map(row => {
      const rawRow =
        row && typeof row === 'object' && 'raw' in row ? row.raw : row;
      return Number(rawRow?.[metric]) || 0;
    });
    return aggregate(values, columnAggregations[metric] || 'SUM');
  };
  const calcTotalsObj = { calcFunc };

  // ── S2 Options ───────────────────────────────
  const s2Options: any = {
    width,
    height,
    widthByField,
    hierarchyType: tableMode,
    seriesNumber: {
      enable: showSeriesNumber,
    },
    interaction: {
      hoverHighlight: true,
      // Disable cell selection behaviors that cause
      // "N items selected" summary bar at bottom
      selectedCellsSpotlight: false,
      multiSelection: false,
      brushSelection: false,
      rangeSelection: false,
      selectedCellMove: false,
      selectedCellHighlight: false,
    },
    style: {
      layoutWidthType: s2LayoutWidthType,
      colCell: {
        widthByField,
        hideValue: hideMeasureColumn,
        hideMeasureColumn,
        ...(colHeight !== undefined ? { height: colHeight } : {}),
      },
      rowCell: {
        widthByField,
        ...(treeWidth !== undefined ? { width: treeWidth, treeWidth } : {}),
        ...(rowHeight !== undefined ? { height: rowHeight } : {}),
      },
      dataCell: rowHeight !== undefined ? { height: rowHeight } : {},
    } as any,
    showDefaultHeaderActionIcon: showSortControls,
    headerActionIcons: showSortControls
      ? [
          {
            icons: ['SortDown'],
            belongsCell: 'rowCell',
            defaultHide: true,
            onClick: handleSortIconClick,
          },
          {
            icons: ['SortDown'],
            belongsCell: 'colCell',
            defaultHide: true,
            onClick: handleSortIconClick,
          },
        ]
      : [],
    tooltip: {
      enable: showTooltip,
      operation: {
        sort: showSortControls,
        hiddenColumns: true,
      },
    } as any,
    placeholder: {
      cell: nullPlaceholder,
    },
    conditions: (() => {
      const columnStatsMap: Record<string, ColumnStats | undefined> = {};
      enhancedRules.forEach(r => {
        if (r.column && !(r.column in columnStatsMap)) {
          columnStatsMap[r.column] = computeColumnStats(
            data as Record<string, unknown>[],
            r.column,
          );
        }
      });

      const getTargetFields = (
        rule: EnhancedConditionalFormattingRule,
      ): string[] => {
        if (
          !rule.formatColumn ||
          rule.formatColumn === '__same__' ||
          rule.formatColumn === rule.column
        ) {
          return [rule.column];
        }
        if (rule.formatColumn === '__all_metrics__') {
          return metricCols.length > 0 ? metricCols : [rule.column];
        }
        return [rule.formatColumn];
      };

      type ConditionEvaluator = (
        value: unknown,
        rowData?: Record<string, unknown>,
        cell?: any,
      ) => any;

      const wrapEvaluator = (
        evaluatorsByField: Record<string, ConditionEvaluator[]>,
        field: string,
        evalFn: ConditionEvaluator,
      ): ConditionEvaluator => {
        if (!evaluatorsByField[field]) {
          evaluatorsByField[field] = [];
        }
        evaluatorsByField[field].push(evalFn);
        return (
          value: unknown,
          rowData?: Record<string, unknown>,
          cell?: any,
        ) => {
          if (cell === undefined) {
            return evalFn(value, rowData, cell);
          }
          const list = evaluatorsByField[field] || [evalFn];
          for (let i = list.length - 1; i >= 0; i -= 1) {
            const res = list[i](value, rowData, cell);
            if (res !== null && res !== undefined) {
              return res;
            }
          }
          return null;
        };
      };

      const bgEvaluators: Record<string, ConditionEvaluator[]> = {};
      const textEvaluators: Record<string, ConditionEvaluator[]> = {};
      const iconEvaluators: Record<string, ConditionEvaluator[]> = {};

      const backgroundConditions: any[] = [];
      const textConditions: any[] = [];
      const iconConditions: any[] = [];

      enhancedRules.forEach(rule => {
        const targetFields = getTargetFields(rule);

        if (rule.ruleType === 'threshold' && rule.applyTo === 'background') {
          targetFields.forEach(targetField => {
            const evalFn: ConditionEvaluator = (value, rowData, cell) => {
              if (
                isRuleMatched(
                  rule,
                  value,
                  rowData,
                  targetField,
                  cell,
                  columnStatsMap,
                ) &&
                rule.color
              ) {
                return { fill: hexToRgba(rule.color, rule.opacity) };
              }
              return null;
            };
            backgroundConditions.push({
              field: targetField,
              mapping: wrapEvaluator(bgEvaluators, targetField, evalFn),
            });
          });
        } else if (rule.ruleType === 'colorScale') {
          const stats = columnStatsMap[rule.column];
          const min = stats?.min ?? 0;
          const max = stats?.max ?? 100;

          targetFields.forEach(targetField => {
            const evalFn: ConditionEvaluator = (value, rowData, cell) => {
              if (cell?.getMeta?.()?.isTotals && !rule.includeTotals) {
                return null;
              }
              const evaluatedVal = resolveColumnValue(
                rule.column,
                targetField,
                value,
                rowData,
                cell,
              );
              if (evaluatedVal === null || evaluatedVal === undefined) {
                return null;
              }
              const num = Number(evaluatedVal);
              if (isNaN(num)) return null;
              const ratio =
                max === min
                  ? 0.5
                  : Math.max(0, Math.min(1, (num - min) / (max - min)));

              let fill: string;
              if (rule.midColor) {
                const midOpacity =
                  rule.minOpacity !== undefined || rule.maxOpacity !== undefined
                    ? ((rule.minOpacity ?? 1) + (rule.maxOpacity ?? 1)) / 2
                    : undefined;
                if (ratio <= 0.5) {
                  fill = interpolateColor(
                    rule.minColor || '#ff4d4f',
                    rule.midColor,
                    ratio * 2,
                    rule.minOpacity,
                    midOpacity,
                  );
                } else {
                  fill = interpolateColor(
                    rule.midColor,
                    rule.maxColor || '#52c41a',
                    (ratio - 0.5) * 2,
                    midOpacity,
                    rule.maxOpacity,
                  );
                }
              } else {
                fill = interpolateColor(
                  rule.minColor || '#e6f7ff',
                  rule.maxColor || '#1890ff',
                  ratio,
                  rule.minOpacity,
                  rule.maxOpacity,
                );
              }
              return { fill };
            };
            backgroundConditions.push({
              field: targetField,
              mapping: wrapEvaluator(bgEvaluators, targetField, evalFn),
            });
          });
        } else if (rule.ruleType === 'threshold' && rule.applyTo === 'text') {
          targetFields.forEach(targetField => {
            const evalFn: ConditionEvaluator = (value, rowData, cell) => {
              if (
                isRuleMatched(
                  rule,
                  value,
                  rowData,
                  targetField,
                  cell,
                  columnStatsMap,
                ) &&
                rule.color
              ) {
                return { fill: hexToRgba(rule.color, rule.opacity) };
              }
              return null;
            };
            textConditions.push({
              field: targetField,
              mapping: wrapEvaluator(textEvaluators, targetField, evalFn),
            });
          });
        } else if (rule.ruleType === 'threshold' && rule.applyTo === 'icon') {
          const iconKey =
            rule.iconName === 'custom'
              ? `custom_${rule.id}`
              : rule.iconName || 'arrow-up';
          targetFields.forEach(targetField => {
            const evalFn: ConditionEvaluator = (value, rowData, cell) => {
              if (
                isRuleMatched(
                  rule,
                  value,
                  rowData,
                  targetField,
                  cell,
                  columnStatsMap,
                ) &&
                rule.color
              ) {
                return {
                  fill: hexToRgba(rule.color, rule.opacity),
                  icon: iconKey,
                };
              }
              return null;
            };
            iconConditions.push({
              field: targetField,
              position: rule.iconPosition || 'left',
              mapping: wrapEvaluator(iconEvaluators, targetField, evalFn),
            });
          });
        }
      });

      return {
        background: backgroundConditions,
        text: textConditions,
        icon: iconConditions,
      };
    })(),
    customSVGIcons: [
      {
        name: 'arrow-up',
        src: '<svg viewBox="0 0 1024 1024"><path d="M512 256l384 384H128z" /></svg>',
      },
      {
        name: 'arrow-down',
        src: '<svg viewBox="0 0 1024 1024"><path d="M512 768l-384-384h768z" /></svg>',
      },
      {
        name: 'trend-up',
        src: '<svg viewBox="0 0 1024 1024"><path d="M868 545.5L536 213.6 204.1 545.5l45.2 45.2 254.7-254.6V810h64V336.1l254.8 254.6z" /></svg>',
      },
      {
        name: 'trend-down',
        src: '<svg viewBox="0 0 1024 1024"><path d="M868 478.5L536 810.4 204.1 478.5l45.2-45.2 254.7 254.6V214h64v473.9l254.8-254.6z" /></svg>',
      },
      {
        name: 'circle-fill',
        src: '<svg viewBox="0 0 1024 1024"><circle cx="512" cy="512" r="384" /></svg>',
      },
      {
        name: 'check',
        src: '<svg viewBox="0 0 1024 1024"><path d="M912 190h-69.9c-9.8 0-19.1 4.5-25.1 12.2L404.7 724.5 207 474a32.3 32.3 0 0 0-25.1-12.2H112c-6.7 0-10.4 7.7-6.3 12.9l273.9 347c12.8 16.2 37.4 16.2 50.3 0l488.4-618.8c4.1-5.1.4-12.9-6.3-12.9z" /></svg>',
      },
      {
        name: 'cross',
        src: '<svg viewBox="0 0 1024 1024"><path d="M563.8 512l262.5-262.5c14.1-14.1 14.1-36.9 0-51s-36.9-14.1-51 0L512.8 461 250.3 198.5c-14.1-14.1-36.9-14.1-51 0s-14.1 36.9 0 51L461.8 512 199.3 774.5c-14.1 14.1-14.1 36.9 0 51 7.1 7 16.2 10.5 25.5 10.5s18.4-3.5 25.5-10.5l262.5-262.5 262.5 262.5c7.1 7 16.2 10.5 25.5 10.5s18.4-3.5 25.5-10.5c14.1-14.1 14.1-36.9 0-51L563.8 512z" /></svg>',
      },
      ...enhancedRules
        .filter(
          r =>
            r.applyTo === 'icon' && r.iconName === 'custom' && r.customPrefix,
        )
        .map(r => ({
          name: `custom_${r.id}`,
          src: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><text x="50" y="72" font-size="65" font-weight="bold" text-anchor="middle" fill="currentColor">${r.customPrefix}</text></svg>`,
        })),
    ],
    totals: {
      row: {
        showGrandTotals: showRowTotals,
        showSubTotals: showRowSubtotals && groupby.length > 1,
        reverseGrandTotalsLayout: reverseTotalsLayout,
        reverseSubTotalsLayout: reverseTotalsLayout,
        calcGrandTotals: calcTotalsObj,
        calcSubTotals: calcTotalsObj,
        subTotalsDimensions: (groupby.length > 1
          ? groupby.slice(0, -1)
          : []
        ).filter((dim: string) => !disabledSubtotalDimensions.has(dim)),
        grandTotalsLabel: totalLabel,
        subTotalsLabel: `Sub${totalLabel}`,
      } as any,
      col: {
        showGrandTotals: showColTotals,
        showSubTotals: showColSubtotals && columns.length > 1,
        reverseGrandTotalsLayout: reverseTotalsLayout,
        reverseSubTotalsLayout: reverseTotalsLayout,
        calcGrandTotals: calcTotalsObj,
        calcSubTotals: calcTotalsObj,
        subTotalsDimensions: (columns.length > 1
          ? columns.slice(0, -1)
          : []
        ).filter((dim: string) => !disabledSubtotalDimensions.has(dim)),
        grandTotalsLabel: totalLabel,
        subTotalsLabel: `Sub${totalLabel}`,
      } as any,
    },
  };

  // ── Return ────────────────────────────────────
  const refs: Refs = {};
  const selectedValues = filterState?.selectedValues
    ? (filterState.selectedValues as Record<number, string>)
    : {};

  return {
    formData,
    height,
    width,
    s2DataConfig,
    s2Options,
    s2Theme: supersetTheme,
    showSortControls,
    advancedS2OptionsObj,
    defaultDimensionAlign,
    defaultMetricAlign,
    columnAlignmentsObj,
    columnBoldTextObj,
    columnFormatsObj,
    headerColor,
    headerColorObj,
    borderColor,
    borderColorObj,
    rowBandingColor,
    rowBandingColorObj,
    crossfilterColumns,
    groupby,
    allFields,
    metricCols,
    setDataMask,
    selectedValues,
    emitCrossFilters: emitFilter && (emitCrossFilters ?? false),
    filterState,
    refs,
    onContextMenu: hooks.onContextMenu,
    setControlValue,
    colHeaderWordWrap,
    rowHeaderWordWrap,
    dataCellWordWrap,
    hideMeasureColumn,
    metricsLayout,
    totalsPosition,
    nullPlaceholder,
    enableExport,
    enhancedConditionalFormatting: enhancedRules,
  };
}
