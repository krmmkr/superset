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
import { DataRecord, getMetricLabel } from '@superset-ui/core';
import { S2TableChartProps, S2TableTransformedProps, Refs } from './types';
import type { S2DataConfig, S2Options } from '@antv/s2';

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
      return values.length > 0 ? Math.min(...values) : 0;
    case 'MAX':
      return values.length > 0 ? Math.max(...values) : 0;
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
function normalizeCol(c: any): string {
  return typeof c === 'object' ? c.column_name || c.label : String(c);
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

  const tableMode = formData.tableMode || 'grid';
  const emitFilter = formData.emitFilter ?? true;

  const totalLabel = formData.totalLabel || 'Total';
  const showRowTotals = formData.showRowTotals ?? true;
  const showRowSubtotals = formData.showRowSubtotals ?? false;
  const showColTotals = formData.showColTotals ?? true;
  const showColSubtotals = formData.showColSubtotals ?? false;
  const showSortControls = formData.showSortControls ?? true;
  const advancedS2OptionsObj = safeParseJson<any>(
    formData.advancedS2Options,
    {},
  );

  const columnAggregations = safeParseJson<Record<string, string>>(
    formData.columnAggregations,
    {},
  );

  const rawCrossfilterCols = formData.crossfilterColumns || [];
  const crossfilterColumns = rawCrossfilterCols.map(normalizeCol);

  // Normalize field names
  const groupby = rawGroupby.map(normalizeCol);
  const columns = rawColumns.map(normalizeCol);
  const rawMetricNames = metricsRaw.map((m: any) => getMetricLabel(m));

  // Superset data payload
  const queryData = queriesData[0] || {};
  const data: DataRecord[] = queryData.data || [];
  const colnames: string[] = (queryData as any).colnames || [];
  const metricCols = colnames.filter(
    c => rawMetricNames.includes(c) || rawMetricNames.includes(c.toLowerCase()),
  );

  const allFields = [...groupby, ...columns, ...metricCols];

  // ── S2 Data Config ───────────────────────────
  const s2Data = data.map(row => {
    const out: any = {};
    groupby.forEach((col: string) => {
      out[col] = String(row[col]);
    });
    columns.forEach((col: string) => {
      out[col] = String(row[col]);
    });
    metricCols.forEach(col => {
      out[col] = Number(row[col]) || 0;
    });
    return out;
  });

  const s2DataConfig: S2DataConfig = {
    fields: {
      rows: groupby,
      columns,
      values: metricCols,
    },
    meta: allFields.map(f => ({ field: f, name: f })),
    data: s2Data,
  };

  // ── Per-column aggregation calcFunc ───────────
  const calcFunc = (
    query: Record<string, any>,
    rows: Record<string, any>[],
  ) => {
    const metric = query['$$extra$$'];
    if (!metric) return 0;
    const values = rows.map(row => Number(row[metric]) || 0);
    return aggregate(values, columnAggregations[metric] || 'SUM');
  };
  const calcTotalsObj = { calcFunc };

  // ── S2 Options ───────────────────────────────
  const s2Options: S2Options = {
    width,
    height,
    hierarchyType: tableMode,
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
      colCfg: {
        hideMeasureColumn: metricCols.length <= 1,
      },
    },
    showDefaultHeaderActionIcon: true,
    tooltip: { showTooltip: false },
    totals: {
      row: {
        showGrandTotals: showRowTotals,
        showSubTotals: showRowSubtotals && groupby.length > 1,
        reverseLayout: true,
        reverseSubLayout: true,
        // @ts-ignore – S2 v1 calcFunc signature
        calcTotals: calcTotalsObj,
        // @ts-ignore
        calcSubTotals: calcTotalsObj,
        subTotalsDimensions: groupby.length > 1 ? groupby.slice(0, -1) : [],
        label: totalLabel,
        subLabel: `Sub${totalLabel}`,
      } as any,
      col: {
        showGrandTotals: showColTotals,
        showSubTotals: showColSubtotals && columns.length > 1,
        // @ts-ignore
        calcTotals: calcTotalsObj,
        // @ts-ignore
        calcSubTotals: calcTotalsObj,
        subTotalsDimensions: columns.length > 1 ? columns.slice(0, -1) : [],
        label: totalLabel,
        subLabel: `Sub${totalLabel}`,
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
  };
}
