/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  See the License for the -
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
import type { S2DataConfig } from '@antv/s2';

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
  const metricsRaw = formData.metrics || [];
  const emitFilter = formData.emitFilter ?? formData.emit_filter ?? true;

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

  const colHeaderWordWrap =
    formData.colHeaderWordWrap ?? formData.col_header_word_wrap ?? false;
  const rowHeaderWordWrap =
    formData.rowHeaderWordWrap ?? formData.row_header_word_wrap ?? false;
  const dataCellWordWrap =
    formData.dataCellWordWrap ?? formData.data_cell_word_wrap ?? false;
  const enableRowspan =
    formData.enableRowspan ?? formData.enable_rowspan ?? false;

  const advancedS2Options =
    formData.advancedS2Options ?? formData.advanced_s2_options;
  const advancedS2OptionsObj = safeParseJson<any>(advancedS2Options, {});

  const dimensionConfig =
    formData.dimensionConfig || formData.dimension_config || {};
  const metricConfig = formData.metricConfig || formData.metric_config || {};

  const columnAlignmentsObj: Record<string, 'left' | 'center' | 'right'> = {};
  const columnBoldTextObj: Record<string, boolean> = {};
  const columnFormatsObj: Record<string, string> = {};
  const columnWidthsObj: Record<string, number> = {};
  const customColumnNames: Record<string, string> = {};

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
    if (cfg?.boldText !== undefined) {
      columnBoldTextObj[col] = cfg.boldText;
    }
  });

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
    if (cfg?.customColumnName) {
      customColumnNames[col] = cfg.customColumnName;
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

  const rowBandingColorObj = formData.rowBandingColor ?? formData.row_banding_color;

  const rowBandingColorRaw = formData.rowBandingColor ?? formData.row_banding_color;
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
  const rawMetricNames: string[] = metricsRaw.map((m: any) =>
    getMetricLabel(m),
  );

  // Superset data payload
  const queryData = queriesData[0] || {};
  const data: DataRecord[] = queryData.data || [];
  const colnames: string[] = (queryData as any).colnames || [];

  // Use Sets for O(1) lookup
  const metricNameSet = new Set(rawMetricNames);
  const metricNameLowerSet = new Set(
    rawMetricNames.map((n: string) => n.toLowerCase()),
  );
  const metricCols = colnames.filter(
    c => metricNameSet.has(c) || metricNameLowerSet.has(c.toLowerCase()),
  );

  const allFields = [...groupby, ...metricCols];

  // ── S2 Data Config ───────────────────────────
  const s2Data = data.map(row => {
    const out: Record<string, string | number> = {};
    for (const col of groupby) {
      out[col] = String(row[col]);
    }
    for (const col of metricCols) {
      out[col] = Number(row[col]) || 0;
    }
    return out;
  });

  const s2DataConfig: S2DataConfig = {
    fields: {
      columns: [...groupby, ...metricCols],
    },
    meta: allFields.map(f => {
      const isMetric = metricCols.includes(f);
      const displayName = customColumnNames[f] || f;
      if (isMetric) {
        const customFormat = columnFormatsObj[f];
        const formatter = getNumberFormatter(customFormat || 'SMART_NUMBER');
        return {
          field: f,
          name: displayName,
          formatter: (val: any) =>
            val === null || val === undefined ? '' : formatter(val),
        };
      }
      return {
        field: f,
        name: displayName,
      };
    }),
    data: s2Data,
  };
  const mergedCellsInfo: any[] = [];
  if (enableRowspan && groupby.length > 0 && s2Data.length > 0) {
    groupby.forEach((colField: string, colIdx: number) => {
      const globalColIdx = [...groupby, ...metricCols].indexOf(colField);
      if (globalColIdx === -1) return;

      let runStart = 0;
      for (let r = 1; r < s2Data.length; r += 1) {
        let canMerge = true;
        for (let prevIdx = 0; prevIdx <= colIdx; prevIdx += 1) {
          const checkField = groupby[prevIdx];
          if (s2Data[r][checkField] !== s2Data[runStart][checkField]) {
            canMerge = false;
            break;
          }
        }

        if (!canMerge) {
          const runLength = r - runStart;
          if (runLength > 1) {
            const cells = [];
            for (let runR = runStart; runR < r; runR += 1) {
              cells.push({
                rowIndex: runR,
                colIndex: globalColIdx,
                showText: runR === runStart,
              });
            }
            mergedCellsInfo.push(cells);
          }
          runStart = r;
        }
      }
      const lastRunLength = s2Data.length - runStart;
      if (lastRunLength > 1) {
        const cells = [];
        for (let runR = runStart; runR < s2Data.length; runR += 1) {
          cells.push({
            rowIndex: runR,
            colIndex: globalColIdx,
            showText: runR === runStart,
          });
        }
        mergedCellsInfo.push(cells);
      }
    });
  }

  // ── S2 Options ───────────────────────────────
  const s2Options: any = {
    width,
    height,
    widthByField,
    mergedCellsInfo,
    seriesNumber: {
      enable: showSeriesNumber,
    },
    interaction: {
      hoverHighlight: true,
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
    sheetType: 'table',
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
  };
}
