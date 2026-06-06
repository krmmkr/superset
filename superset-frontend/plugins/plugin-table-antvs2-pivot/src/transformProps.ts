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
function normalizeCol(c: any): string {
  return typeof c === 'object' ? c.column_name || c.label : String(c);
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
                : [
                    ...prevSortParams,
                    { sortFieldId: meta.field, sortMethod },
                  ];

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
    const defaultSelectedKeys =
      spreadsheet.getMenuDefaultSelectedKeys(meta?.id);

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

  const tableMode = formData.tableMode || 'grid';
  const emitFilter = formData.emitFilter ?? true;

  const totalLabel = formData.totalLabel || 'Total';
  const showRowTotals = formData.showRowTotals ?? true;
  const showRowSubtotals = formData.showRowSubtotals ?? false;
  const showColTotals = formData.showColTotals ?? true;
  const showColSubtotals = formData.showColSubtotals ?? false;
  const showSortControls = formData.showSortControls ?? true;
  const showSeriesNumber = formData.showSeriesNumber ?? false;
  const layoutWidthType = formData.layoutWidthType || 'adaptive';
  const showTooltip = formData.showTooltip ?? true;
  const rowHeight =
    formData.rowHeight && !isNaN(Number(formData.rowHeight))
      ? Number(formData.rowHeight)
      : undefined;
  const colHeight =
    formData.colHeight && !isNaN(Number(formData.colHeight))
      ? Number(formData.colHeight)
      : undefined;
  const colHeaderWordWrap = formData.col_header_word_wrap ?? false;
  const rowHeaderWordWrap = formData.row_header_word_wrap ?? false;
  const dataCellWordWrap = formData.data_cell_word_wrap ?? false;

  const advancedS2OptionsObj = safeParseJson<any>(
    formData.advancedS2Options,
    {},
  );

  const columnAggregations = safeParseJson<Record<string, string>>(
    formData.columnAggregations,
    {},
  );

  const defaultDimensionAlign = formData.defaultDimensionAlign || 'left';
  const defaultMetricAlign = formData.defaultMetricAlign || 'right';
  const columnAlignmentsObj = safeParseJson<
    Record<string, 'left' | 'center' | 'right'>
  >(formData.columnAlignments, {});

  const columnFormatsObj = safeParseJson<Record<string, string>>(
    formData.columnFormats,
    {},
  );

  const columnWidthsObj = safeParseJson<Record<string, number>>(
    formData.columnWidths,
    {},
  );

  const s2LayoutWidthType =
    layoutWidthType === 'custom' ? 'compact' : layoutWidthType;
  const widthByField =
    layoutWidthType === 'custom' ? columnWidthsObj : undefined;

  const excludeTotalsMetrics: string[] = formData.excludeTotalsMetrics || [];
  const headerColorObj = formData.headerColor;

  const headerColorRaw = formData.headerColor;
  const headerColor =
    headerColorRaw &&
    typeof headerColorRaw === 'object' &&
    'r' in headerColorRaw
      ? `rgba(${headerColorRaw.r}, ${headerColorRaw.g}, ${headerColorRaw.b}, ${headerColorRaw.a ?? 1})`
      : undefined;

  const rawCrossfilterCols = formData.crossfilterColumns || [];
  const crossfilterColumns = rawCrossfilterCols.map(normalizeCol);

  // Normalize field names
  const groupby = rawGroupby.map(normalizeCol);
  const columns = rawColumns.map(normalizeCol);
  const rawMetricNames: string[] = metricsRaw.map((m: any) => getMetricLabel(m));

  // Superset data payload
  const queryData = queriesData[0] || {};
  const data: DataRecord[] = queryData.data || [];
  const colnames: string[] = (queryData as any).colnames || [];

  // Use Sets for O(1) metric name lookups instead of repeated Array.includes
  const metricNameSet = new Set(rawMetricNames);
  const metricNameLowerSet = new Set(
    rawMetricNames.map((n: string) => n.toLowerCase()),
  );
  const metricCols = colnames.filter(
    c => metricNameSet.has(c) || metricNameLowerSet.has(c.toLowerCase()),
  );

  const allFields = [...groupby, ...columns, ...metricCols];

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
    const out: Record<string, string | number> = {};
    for (const col of groupby) {
      out[col] = String(row[col]);
    }
    for (const col of columns) {
      out[col] = String(row[col]);
    }
    for (const col of metricCols) {
      out[col] = Number(row[col]) || 0;
    }
    return out;
  });

  const s2DataConfig: S2DataConfig = {
    fields: {
      rows: groupby,
      columns,
      values: metricCols,
    },
    meta: allFields.map(f => {
      const isMetric = metricCols.includes(f);
      if (isMetric) {
        const customFormat = columnFormatsObj[f];
        const formatter = getNumberFormatter(customFormat || 'SMART_NUMBER');
        return {
          field: f,
          name: f,
          formatter: (val: any) =>
            val === null || val === undefined ? '' : formatter(val),
        };
      }
      return {
        field: f,
        name: f,
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
    if (excludeTotalsMetrics.includes(metric)) {
      return null;
    }
    const values = rows.map(row => {
      const rawRow = row && typeof row === 'object' && 'raw' in row ? row.raw : row;
      return Number(rawRow?.[metric]) || 0;
    });
    return aggregate(values, columnAggregations[metric] || 'SUM');
  };
  const calcTotalsObj = { calcFunc };

  // ── S2 Options ───────────────────────────────
  const s2Options: S2Options = {
    width,
    height,
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
        hideMeasureColumn: false,
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
    totals: {
      row: {
        showGrandTotals: showRowTotals,
        showSubTotals: showRowSubtotals && groupby.length > 1,
        reverseGrandTotalsLayout: true,
        reverseSubTotalsLayout: true,
        calcGrandTotals: calcTotalsObj,
        calcSubTotals: calcTotalsObj,
        subTotalsDimensions: groupby.length > 1 ? groupby.slice(0, -1) : [],
        grandTotalsLabel: totalLabel,
        subTotalsLabel: `Sub${totalLabel}`,
      } as any,
      col: {
        showGrandTotals: showColTotals,
        showSubTotals: showColSubtotals && columns.length > 1,
        calcGrandTotals: calcTotalsObj,
        calcSubTotals: calcTotalsObj,
        subTotalsDimensions: columns.length > 1 ? columns.slice(0, -1) : [],
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
    columnFormatsObj,
    headerColor,
    headerColorObj,
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
  };
}
