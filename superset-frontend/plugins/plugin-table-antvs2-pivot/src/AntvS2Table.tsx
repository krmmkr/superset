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
import React, { useRef, useCallback, useState, useMemo } from 'react';
import { SheetComponent } from '@antv/s2-react';
import {
  setLang,
  getPalette,
  DataCell,
  ColCell,
  RowCell,
  CornerCell,
  S2Event,
  TextAlign,
} from '@antv/s2';
import '@antv/s2-react/dist/s2-react.min.css';
import { DataMask } from '@superset-ui/core';
import { merge } from 'lodash';
import { useTheme, useThemeMode } from '@apache-superset/core/theme';
import { Menu } from '@superset-ui/core/components/Menu';
import { S2TableTransformedProps } from './types';

setLang('en_US');

/**
 * Shared helper: reads per-column alignment from the custom options
 * attached to the spreadsheet instance.
 */
function getAlignmentFromOptions(
  spreadsheet: any,
  field: string,
  isMetric: boolean,
): TextAlign {
  const opts = spreadsheet?.options;
  const alignments = opts?.columnAlignmentsObj || {};
  const dimAlign = opts?.defaultDimensionAlign || 'left';
  const metricAlign = opts?.defaultMetricAlign || 'right';
  return (alignments[field] ||
    (isMetric ? metricAlign : dimAlign)) as TextAlign;
}

/**
 * Shared helper: reads per-column bold preference from the custom options
 * attached to the spreadsheet instance.
 */
function getBoldTextFromOptions(
  spreadsheet: any,
  field: string,
): boolean {
  const opts = spreadsheet?.options;
  const boldTextObj = opts?.columnBoldTextObj || {};
  return !!boldTextObj[field];
}

class CustomDataCell extends DataCell {
  getTextStyle() {
    const textStyle = super.getTextStyle();
    const field = this.meta.valueField;
    const isBold = getBoldTextFromOptions(this.spreadsheet, field);
    return {
      ...textStyle,
      textAlign: getAlignmentFromOptions(
        this.spreadsheet,
        field,
        true,
      ),
      fontWeight: isBold ? 'bold' : textStyle.fontWeight,
    };
  }
}

class CustomColCell extends ColCell {
  getTextStyle() {
    const textStyle = super.getTextStyle();
    const isMetric = this.isMeasureField();
    const field = isMetric ? this.meta.value : this.meta.field;
    const isBold = getBoldTextFromOptions(this.spreadsheet, field);
    return {
      ...textStyle,
      textAlign: getAlignmentFromOptions(
        this.spreadsheet,
        field,
        isMetric,
      ),
      fontWeight: isBold ? 'bold' : textStyle.fontWeight,
    };
  }
}

class CustomRowCell extends RowCell {
  getTextStyle() {
    const textStyle = super.getTextStyle();
    const isMetric = this.isMeasureField();
    const field = isMetric ? this.meta.value : this.meta.field;
    const isBold = getBoldTextFromOptions(this.spreadsheet, field);
    return {
      ...textStyle,
      textAlign: getAlignmentFromOptions(
        this.spreadsheet,
        field,
        isMetric,
      ),
      fontWeight: isBold ? 'bold' : textStyle.fontWeight,
    };
  }
}

class CustomCornerCell extends CornerCell {
  getTextStyle() {
    const textStyle = super.getTextStyle();
    return {
      ...textStyle,
      textAlign: getAlignmentFromOptions(this.spreadsheet, '', false),
    };
  }
}

/** Static CSS for the tooltip sort menu — allocated once at module level. */
const TOOLTIP_MENU_STYLE = `
  .s2-tooltip-custom-menu .ant-menu {
    font-size: 11px !important;
    line-height: 1.2 !important;
    width: 135px !important;
  }
  .s2-tooltip-custom-menu .ant-menu-item {
    height: 22px !important;
    line-height: 22px !important;
    padding: 0 8px !important;
    margin: 1px 0 !important;
    font-size: 11px !important;
  }
  .s2-tooltip-custom-menu .ant-menu-item .ant-menu-title-content {
    font-size: 11px !important;
  }
  .s2-tooltip-custom-menu .ant-menu-item-icon,
  .s2-tooltip-custom-menu .antv-s2-operator-icon {
    font-size: 10px !important;
    margin-right: 4px !important;
  }
`;

/**
 * Build cell interaction state styling. Takes hover/selected bg color and
 * returns the interactionState block used across all cell types.
 */
function buildInteractionState(bg: string) {
  return {
    hover: { backgroundColor: bg, backgroundOpacity: 1 },
    hoverFocus: { backgroundColor: bg, backgroundOpacity: 1 },
    selected: { backgroundColor: bg, backgroundOpacity: 1 },
  };
}

/* eslint-disable theme-colors/no-literal-colors */
export default function AntvS2Table(props: S2TableTransformedProps) {
  const {
    width,
    height,
    formData,
    s2DataConfig,
    s2Options,
    setDataMask,
    emitCrossFilters,
    crossfilterColumns,
    groupby,
    metricCols,
    advancedS2OptionsObj,
    defaultDimensionAlign = 'left',
    defaultMetricAlign = 'right',
    columnAlignmentsObj = {},
    columnBoldTextObj = {},
    headerColor,
    headerColorObj,
    borderColor,
    rowBandingColor,
    rowBandingColorObj,
    colHeaderWordWrap,
    rowHeaderWordWrap,
    dataCellWordWrap,
  } = props;

  const divRef = useRef<HTMLDivElement>(null);

  const [sortParams, setSortParams] = useState<any[]>([]);

  const fieldsKey = useMemo(
    () =>
      JSON.stringify({
        rows: groupby,
        columns: props.s2DataConfig?.fields?.columns || [],
        values: metricCols,
      }),
    [groupby, props.s2DataConfig?.fields?.columns, metricCols],
  );

  React.useEffect(() => {
    setSortParams([]);
  }, [fieldsKey]);

  const mergedDataCfg = useMemo(
    () => ({
      ...s2DataConfig,
      sortParams:
        sortParams.length > 0 ? sortParams : s2DataConfig.sortParams || [],
    }),
    [s2DataConfig, sortParams],
  );

  // ── Cross-filtering (data & row cell clicks only) ──
  const handleDataClick = useCallback(
    (cellItem: any) => {
      if (!emitCrossFilters || !setDataMask) return;

      const meta = cellItem?.viewMeta || cellItem?.meta;
      if (!meta?.query) return;

      const colsToEmit =
        crossfilterColumns.length > 0 ? crossfilterColumns : groupby;

      const filterDict: Record<string, any> = {};
      const filters: any[] = [];

      colsToEmit.forEach(col => {
        if (meta.query[col] !== undefined) {
          const val = meta.query[col];
          filterDict[col] = val;
          filters.push({ col, op: '==', val });
        }
      });

      if (filters.length === 0) return;

      const filterDictStr = JSON.stringify(filterDict);
      const dataMask: DataMask = {
        extraFormData: { filters } as any,
        filterState: {
          value: [filterDictStr],
          selectedValues: [filterDictStr],
        },
      };
      setDataMask(dataMask);
    },
    [emitCrossFilters, setDataMask, crossfilterColumns, groupby],
  );

  // ── Theme ────────────────────────────────────
  const theme = useTheme();
  const isDarkMode = useThemeMode();

  const textColor = theme?.colorText || '#262626';
  const bgColor = theme?.colorBgContainer || '#ffffff';
  const isDark = isDarkMode;
  const headerBgColor =
    headerColor || theme?.colorBgLayout || theme?.colorFillAlter || '#fafafa';
  const resolvedBorderColor = borderColor || (isDark
    ? theme?.colorBorderSecondary || theme?.colorBorder || '#303030'
    : theme?.colorBorderSecondary || theme?.colorBorder || '#f0f0f0');
  const hoverBgColor = isDark
    ? theme?.colorFillContentHover || 'rgba(255, 255, 255, 0.08)'
    : theme?.colorBgTextHover || theme?.colorFillAlter || '#f5f5f5';

  const isTransparentBanding = rowBandingColorObj && rowBandingColorObj.a === 0;
  const resolvedRowBandingColor = isTransparentBanding
    ? bgColor
    : rowBandingColor || hoverBgColor;
  const rawHeaderColor = headerColorObj;
  let headerTextColor =
    theme?.colorTextHeading || theme?.colorText || '#262626';

  if (
    rawHeaderColor &&
    typeof rawHeaderColor === 'object' &&
    'r' in rawHeaderColor
  ) {
    const { r, g, b } = rawHeaderColor;
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    headerTextColor = yiq >= 128 ? '#262626' : '#ffffff';
  }

  const totalText = textColor;
  const totalFontWeight = 700;

  const isDefaultTheme = !formData.theme || formData.theme === 'default';

  const {
    sheetType = 'pivot',
    adaptive,
    loading,
    showPagination,
    themeCfg: advThemeCfg,
    theme: advTheme,
    palette: advPalette,
  } = advancedS2OptionsObj || {};

  const customThemeCfg = useMemo(() => {
    const hoverInteraction = buildInteractionState(hoverBgColor);
    const cellBorders = {
      horizontalBorderColor: resolvedBorderColor,
      verticalBorderColor: resolvedBorderColor,
    };

    const baseThemeCfg: any = {
      name: formData.theme || 'default',
      theme: isDefaultTheme
        ? {
            background: { color: bgColor },
            splitLine: {
              ...cellBorders,
              horizontalBorderColorOpacity: isDark ? 0.6 : 1,
              verticalBorderColorOpacity: isDark ? 0.6 : 1,
            },
            dataCell: {
              cell: {
                backgroundColor: bgColor,
                crossBackgroundColor: resolvedRowBandingColor,
                ...cellBorders,
                interactionState: hoverInteraction,
              },
              text: { fill: textColor, textAlign: 'center' },
              bolderText: {
                fill: totalText,
                fontWeight: totalFontWeight,
                textAlign: 'center',
              },
              measureText: { fill: textColor, textAlign: 'center' },
            },
            cornerCell: {
              cell: {
                backgroundColor: headerBgColor,
                ...cellBorders,
                interactionState: hoverInteraction,
              },
              text: { fill: headerTextColor, fontWeight: 'bold' },
              bolderText: { fill: headerTextColor },
              measureText: { fill: headerTextColor },
            },
            seriesNumberCell: {
              cell: {
                backgroundColor: headerBgColor,
                ...cellBorders,
                interactionState: hoverInteraction,
              },
              text: { fill: headerTextColor },
              bolderText: { fill: headerTextColor },
              measureText: { fill: headerTextColor },
            },
            rowCell: {
              cell: {
                backgroundColor: bgColor,
                ...cellBorders,
                interactionState: hoverInteraction,
              },
              text: { fill: textColor },
              bolderText: { fill: totalText, fontWeight: totalFontWeight },
              measureText: { fill: textColor },
              seriesText: { fill: textColor },
            },
            colCell: {
              cell: {
                backgroundColor: headerBgColor,
                ...cellBorders,
                interactionState: hoverInteraction,
              },
              text: {
                fill: headerTextColor,
                fontWeight: 'bold',
                textAlign: 'center',
              },
              bolderText: { fill: headerTextColor, textAlign: 'center' },
              measureText: { fill: headerTextColor, textAlign: 'center' },
            },
            scrollBar: {
              thumbColor:
                theme?.colorTextSecondary ||
                theme?.colorTextTertiary ||
                'rgba(0,0,0,0.35)',
              thumbHoverColor: theme?.colorText || 'rgba(0,0,0,0.5)',
              trackColor:
                theme?.colorFillSecondary ||
                theme?.colorBgLayout ||
                'rgba(0,0,0,0.05)',
              size: 8,
              hoverSize: 12,
              lineCap: 'round',
            },
          }
        : {},
    };

    const userOptions =
      (advancedS2OptionsObj && advancedS2OptionsObj.options) || {};
    const finalAdvThemeCfg = advThemeCfg || userOptions.themeCfg || {};
    const merged = merge({}, baseThemeCfg, finalAdvThemeCfg);

    const activeTheme = merge(
      {},
      advTheme || userOptions.theme || finalAdvThemeCfg.theme || {},
    );
    const themeKeys = [
      'background',
      'splitLine',
      'dataCell',
      'rowCell',
      'colCell',
      'cornerCell',
      'scrollBar',
      'cell',
    ];

    // Auto-promote keys from root, root.options, themeCfg or themeCfg.theme to merged.theme
    themeKeys.forEach(key => {
      if (advancedS2OptionsObj && advancedS2OptionsObj[key]) {
        activeTheme[key] = merge(
          {},
          activeTheme[key] || {},
          advancedS2OptionsObj[key],
        );
      }
      if (userOptions && userOptions[key]) {
        activeTheme[key] = merge({}, activeTheme[key] || {}, userOptions[key]);
      }
      if (finalAdvThemeCfg[key]) {
        activeTheme[key] = merge(
          {},
          activeTheme[key] || {},
          finalAdvThemeCfg[key],
        );
      }
    });

    if (Object.keys(activeTheme).length > 0) {
      merged.theme = merge({}, merged.theme || {}, activeTheme);
    }

    const activePalette =
      advPalette || userOptions.palette || finalAdvThemeCfg.palette;
    if (activePalette) {
      merged.palette = activePalette;
    } else {
      merged.palette = getPalette(merged.name || 'default');
    }

    return merged;
  }, [
    bgColor,
    borderColor,
    rowBandingColor,
    textColor,
    hoverBgColor,
    headerBgColor,
    headerTextColor,
    isDark,
    theme,
    formData.theme,
    advThemeCfg,
    advTheme,
    advPalette,
    totalText,
    totalFontWeight,
    isDefaultTheme,
    advancedS2OptionsObj,
  ]);

  // Conditional background custom rules + JSON overrides
  const optionsWithStyles = useMemo(() => {
    const baseOptions = { ...s2Options };

    // Deep merge advanced options directly on top (excluding theme settings and top-level props)
    const {
      sheetType: ignoredSheetType,
      adaptive: ignoredAdaptive,
      loading: ignoredLoading,
      showPagination: ignoredShowPagination,
      themeCfg: ignoredThemeCfg,
      theme: ignoredTheme,
      palette: ignoredPalette,
      background: ignoredBackground,
      splitLine: ignoredSplitLine,
      dataCell: ignoredDataCell,
      rowCell: ignoredRowCell,
      colCell: ignoredColCell,
      cornerCell: ignoredCornerCell,
      scrollBar: ignoredScrollBar,
      cell: ignoredCell,
      options: ignoredOptions,
      ...restOptions
    } = advancedS2OptionsObj || {};

    const userOptions =
      (advancedS2OptionsObj && advancedS2OptionsObj.options) || {};
    const finalOptions = merge({}, baseOptions, restOptions, userOptions);

    // Promote layout/style keys from root of advancedS2OptionsObj or nested options to style block
    const styleKeys = [
      'colCell',
      'rowCell',
      'dataCell',
      'layoutWidthType',
      'seriesNumber',
    ];
    styleKeys.forEach(key => {
      if (advancedS2OptionsObj && advancedS2OptionsObj[key]) {
        finalOptions.style = finalOptions.style || {};
        finalOptions.style[key] = merge(
          {},
          finalOptions.style[key] || {},
          advancedS2OptionsObj[key],
        );
      }
      if (userOptions && userOptions[key]) {
        finalOptions.style = finalOptions.style || {};
        finalOptions.style[key] = merge(
          {},
          finalOptions.style[key] || {},
          userOptions[key],
        );
      }
    });

    // Also support direct rowHeight / colHeight / cellHeight overrides from root or nested options
    if (advancedS2OptionsObj) {
      const colHeight = advancedS2OptionsObj.colHeight ?? userOptions.colHeight;
      if (colHeight !== undefined) {
        finalOptions.style = finalOptions.style || {};
        finalOptions.style.colCell = finalOptions.style.colCell || {};
        finalOptions.style.colCell.height = colHeight;
      }
      const rowHeight = advancedS2OptionsObj.rowHeight ?? userOptions.rowHeight;
      if (rowHeight !== undefined) {
        finalOptions.style = finalOptions.style || {};
        finalOptions.style.rowCell = finalOptions.style.rowCell || {};
        finalOptions.style.rowCell.height = rowHeight;
      }
      const cellHeight =
        advancedS2OptionsObj.cellHeight ?? userOptions.cellHeight;
      if (cellHeight !== undefined) {
        finalOptions.style = finalOptions.style || {};
        finalOptions.style.dataCell = finalOptions.style.dataCell || {};
        finalOptions.style.dataCell.height = cellHeight;
      }
    }

    // Apply word wrapping options natively in S2 2.x
    finalOptions.style = finalOptions.style || {};

    finalOptions.style.colCell = finalOptions.style.colCell || {};
    finalOptions.style.colCell.wordWrap = true;
    finalOptions.style.colCell.maxLines = colHeaderWordWrap ? Infinity : 1;
    finalOptions.style.colCell.textOverflow = 'ellipsis';

    finalOptions.style.rowCell = finalOptions.style.rowCell || {};
    finalOptions.style.rowCell.wordWrap = true;
    finalOptions.style.rowCell.maxLines = rowHeaderWordWrap ? Infinity : 1;
    finalOptions.style.rowCell.textOverflow = 'ellipsis';

    finalOptions.style.dataCell = finalOptions.style.dataCell || {};
    finalOptions.style.dataCell.wordWrap = true;
    finalOptions.style.dataCell.maxLines = dataCellWordWrap ? Infinity : 1;
    finalOptions.style.dataCell.textOverflow = 'ellipsis';

    // Attach custom alignment options to finalOptions so cell classes can read them
    (finalOptions as any).columnAlignmentsObj = columnAlignmentsObj;
    (finalOptions as any).columnBoldTextObj = columnBoldTextObj;
    (finalOptions as any).defaultDimensionAlign = defaultDimensionAlign;
    (finalOptions as any).defaultMetricAlign = defaultMetricAlign;
    (finalOptions as any).metricCols = metricCols;

    // Map custom cells
    finalOptions.dataCell = (viewMeta: any, spreadsheet: any, ...args: any[]) =>
      new CustomDataCell(
        viewMeta,
        spreadsheet || viewMeta?.spreadsheet,
        ...args,
      );
    finalOptions.colCell = (meta: any, spreadsheet: any, ...args: any[]) =>
      new CustomColCell(meta, spreadsheet || meta?.spreadsheet, ...args);
    finalOptions.rowCell = (meta: any, spreadsheet: any, ...args: any[]) =>
      new CustomRowCell(meta, spreadsheet || meta?.spreadsheet, ...args);
    finalOptions.cornerCell = (meta: any, spreadsheet: any, ...args: any[]) =>
      new CustomCornerCell(meta, spreadsheet || meta?.spreadsheet, ...args);

    // Defensively remove style overrides for cell definitions, to prevent S2 from
    // overwriting our custom cell constructor functions when merging style block to root.
    if (finalOptions.style) {
      if (typeof finalOptions.style.rowCell === 'function') {
        delete finalOptions.style.rowCell;
      }
      if (typeof finalOptions.style.colCell === 'function') {
        delete finalOptions.style.colCell;
      }
      if (typeof finalOptions.style.cornerCell === 'function') {
        delete finalOptions.style.cornerCell;
      }
      if (typeof finalOptions.style.dataCell === 'function') {
        delete finalOptions.style.dataCell;
      }
    }

    // Ensure tooltip has a render function for the operation menu in 2.x
    finalOptions.tooltip = finalOptions.tooltip || {};
    finalOptions.tooltip.operation = finalOptions.tooltip.operation || {};
    finalOptions.tooltip.operation.menu = {
      render: (props: any) =>
        React.createElement(
          React.Fragment,
          null,
          React.createElement('style', null, TOOLTIP_MENU_STYLE),
          React.createElement(
            'div',
            { className: 's2-tooltip-custom-menu' },
            React.createElement(Menu, { ...props, mode: 'vertical' }),
          ),
        ),
      ...finalOptions.tooltip.operation.menu,
    };

    return finalOptions;
  }, [
    s2Options,
    advancedS2OptionsObj,
    defaultDimensionAlign,
    defaultMetricAlign,
    columnAlignmentsObj,
    headerColor,
    metricCols,
    colHeaderWordWrap,
    rowHeaderWordWrap,
    dataCellWordWrap,
  ]);

  // Generate a key to force SheetComponent remount when config/theme changes.
  // Width/height are intentionally excluded — S2 handles resize internally
  // via options.height and the wrapper div style without needing a remount.
  const sheetKey = useMemo(
    () =>
      [
        isDark ? 'dark' : 'light',
        formData.theme || 'default',
        formData.advancedS2Options || formData.advanced_s2_options || '',
        formData.tableMode || formData.table_mode || 'grid',
        formData.showSeriesNumber ?? formData.show_series_number ?? false,
        formData.layoutWidthType || formData.layout_width_type || 'adaptive',
        formData.showTooltip ?? formData.show_tooltip ?? true,
        formData.rowHeight || formData.row_height || '',
        formData.colHeight || formData.col_height || '',
        formData.defaultDimensionAlign ||
          formData.default_dimension_align ||
          'left',
        formData.defaultMetricAlign || formData.default_metric_align || 'right',
        JSON.stringify(
          formData.dimensionConfig || formData.dimension_config || {},
        ),
        JSON.stringify(formData.metricConfig || formData.metric_config || {}),
        formData.headerColor
          ? `${formData.headerColor.r}_${formData.headerColor.g}_${formData.headerColor.b}_${formData.headerColor.a}`
          : formData.header_color
            ? `${formData.header_color.r}_${formData.header_color.g}_${formData.header_color.b}_${formData.header_color.a}`
            : '',
        formData.borderColor
          ? `${formData.borderColor.r}_${formData.borderColor.g}_${formData.borderColor.b}_${formData.borderColor.a}`
          : formData.border_color
            ? `${formData.border_color.r}_${formData.border_color.g}_${formData.border_color.b}_${formData.border_color.a}`
            : '',
        formData.rowBandingColor
          ? `${formData.rowBandingColor.r}_${formData.rowBandingColor.g}_${formData.rowBandingColor.b}_${formData.rowBandingColor.a}`
          : formData.row_banding_color
            ? `${formData.row_banding_color.r}_${formData.row_banding_color.g}_${formData.row_banding_color.b}_${formData.row_banding_color.a}`
            : '',
        formData.colHeaderWordWrap ?? formData.col_header_word_wrap ?? false,
        formData.rowHeaderWordWrap ?? formData.row_header_word_wrap ?? false,
        formData.dataCellWordWrap ?? formData.data_cell_word_wrap ?? false,
      ].join('_'),
    [
      isDark,
      formData.theme,
      formData.advancedS2Options,
      formData.advanced_s2_options,
      formData.tableMode,
      formData.table_mode,
      formData.showSeriesNumber,
      formData.show_series_number,
      formData.layoutWidthType,
      formData.layout_width_type,
      formData.showTooltip,
      formData.show_tooltip,
      formData.rowHeight,
      formData.row_height,
      formData.colHeight,
      formData.col_height,
      formData.defaultDimensionAlign,
      formData.default_dimension_align,
      formData.defaultMetricAlign,
      formData.default_metric_align,
      formData.dimensionConfig,
      formData.dimension_config,
      formData.metricConfig,
      formData.metric_config,
      formData.headerColor,
      formData.header_color,
      formData.borderColor,
      formData.border_color,
      formData.rowBandingColor,
      formData.row_banding_color,
      formData.colHeaderWordWrap,
      formData.col_header_word_wrap,
      formData.rowHeaderWordWrap,
      formData.row_header_word_wrap,
      formData.dataCellWordWrap,
      formData.data_cell_word_wrap,
    ],
  );

  return (
    <div
      ref={divRef}
      style={{ width: `${width}px`, height: `${height}px`, overflow: 'hidden' }}
    >
      {React.createElement(SheetComponent as any, {
        key: sheetKey,
        sheetType,
        adaptive,
        loading,
        showPagination,
        dataCfg: mergedDataCfg,
        options: { ...optionsWithStyles, height },
        themeCfg: customThemeCfg,
        onMounted: (s2: any) => {
          (window as any).s2 = s2;
          s2.on(S2Event.RANGE_SORT, (newSortParams: any) => {
            if (Array.isArray(newSortParams)) {
              setSortParams(newSortParams);
            }
          });

          // Intercept showTooltipWithInfo to append Sort options to the header click tooltip
          const originalShowTooltipWithInfo = s2.showTooltipWithInfo.bind(s2);
          s2.showTooltipWithInfo = (
            event: any,
            cellInfos: any,
            options: any,
          ) => {
            const cell = s2.getTargetCell(event?.target);
            const cellType = cell?.cellType;

            // Only modify if it is a row cell or col cell, the event is a click, and has options
            if (
              (cellType === 'rowCell' || cellType === 'colCell') &&
              options &&
              event?.type === 'click'
            ) {
              const meta = cell.getMeta();
              if (meta) {
                const isDimension =
                  meta.field !== '$$extra$$' &&
                  !meta.isMeasure &&
                  !meta.isTotals;

                const currentSortParam = s2.dataCfg?.sortParams?.find(
                  (p: any) => p.sortFieldId === meta.field,
                );
                const defaultSelectedKeys = isDimension
                  ? currentSortParam?.sortMethod
                    ? [currentSortParam.sortMethod.toLowerCase()]
                    : ['none']
                  : s2.getMenuDefaultSelectedKeys(meta?.id) || ['none'];

                // Shared handler: applies sort for both dimension and metric fields
                const applySortMethod = (method: string) => {
                  if (isDimension) {
                    const prevSortParams = (
                      s2.dataCfg?.sortParams || []
                    ).filter((p: any) => p.sortFieldId !== meta.field);
                    const newSortParams =
                      method === 'none'
                        ? prevSortParams
                        : [
                            ...prevSortParams,
                            {
                              sortFieldId: meta.field,
                              sortMethod: method.toUpperCase(),
                            },
                          ];
                    s2.emit('sort:range-sort', newSortParams);
                    s2.setDataCfg({
                      ...s2.dataCfg,
                      sortParams: newSortParams,
                    });
                    s2.render();
                  } else {
                    if (typeof s2.groupSortByMethod === 'function') {
                      s2.groupSortByMethod(method, meta);
                    }
                    s2.emit('sort:range-sorted', event);
                  }
                  s2.hideTooltip();
                };

                const sortItems = [
                  {
                    key: 'asc',
                    icon: 'groupAsc',
                    label: 'Ascending',
                    onClick: () => applySortMethod('asc'),
                  },
                  {
                    key: 'desc',
                    icon: 'groupDesc',
                    label: 'Descending',
                    onClick: () => applySortMethod('desc'),
                  },
                  {
                    key: 'none',
                    label: 'No sort',
                    onClick: () => applySortMethod('none'),
                  },
                ];

                options.operator = options.operator || {};
                options.operator.menu = options.operator.menu || {};

                const existingItems = options.operator.menu.items || [];
                const hasSortItem = existingItems.some(
                  (item: any) =>
                    item.key === 'asc' ||
                    item.key === 'desc' ||
                    item.key === 'none',
                );

                if (!hasSortItem) {
                  options.operator.menu.items = [
                    ...existingItems,
                    ...sortItems,
                  ];
                  options.operator.menu.selectedKeys = defaultSelectedKeys;
                }
              }
            }
            return originalShowTooltipWithInfo(event, cellInfos, options);
          };
        },
        onDataCellClick: handleDataClick,
        onRowCellClick: handleDataClick,
      })}
    </div>
  );
}
