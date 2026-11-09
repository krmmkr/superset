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
  MergedCell,
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
    const field = (this.meta?.field || this.meta?.valueField || '') as string;
    const isMetric =
      (this.spreadsheet?.options as any)?.metricColsSet?.has(field) || false;
    const isBold = getBoldTextFromOptions(this.spreadsheet, field);
    return {
      ...textStyle,
      textAlign: getAlignmentFromOptions(this.spreadsheet, field, isMetric),
      fontWeight: isBold ? 'bold' : textStyle.fontWeight,
    };
  }
}

class CustomMergedCell extends MergedCell {
  getTextStyle() {
    const textStyle = super.getTextStyle();
    const field = (this.meta?.field || this.meta?.valueField || '') as string;
    const isBold = getBoldTextFromOptions(this.spreadsheet, field);
    return {
      ...textStyle,
      textAlign: getAlignmentFromOptions(this.spreadsheet, field, false),
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

/**
 * Build dynamic CSS for the S2 tooltip container and sort menu so it matches
 * Superset's light and dark themes.
 */
function buildTooltipStyleSheet({
  isDark,
  tooltipBg,
  textColor,
  secondaryTextColor,
  tertiaryTextColor,
  borderColor,
  hoverBgColor,
  selectedBgColor,
  selectedTextColor,
  headerBgColor,
  fontFamily,
  fontSize,
  borderRadius,
  boxShadow,
}: {
  isDark: boolean;
  tooltipBg: string;
  textColor: string;
  secondaryTextColor: string;
  tertiaryTextColor: string;
  borderColor: string;
  hoverBgColor: string;
  selectedBgColor: string;
  selectedTextColor: string;
  headerBgColor: string;
  fontFamily: string;
  fontSize: number;
  borderRadius: number;
  boxShadow: string;
}) {
  return `
    .antv-s2-tooltip-container.superset-s2-tooltip,
    .antv-s2-tooltip-container {
      --antv-s2-tooltip-background: ${tooltipBg};
      --antv-s2-tooltip-operator-background: ${tooltipBg};
      --antv-s2-tooltip-operator-menu-selected-background: ${selectedBgColor};
      --antv-s2-font: ${textColor};
      --antv-s2-font-85: ${textColor};
      --antv-s2-font-65: ${secondaryTextColor};
      --antv-s2-font-45: ${tertiaryTextColor};
      --antv-s2-border: ${borderColor};
      background: ${tooltipBg} !important;
      color: ${textColor} !important;
      font-family: ${fontFamily} !important;
      font-size: ${fontSize}px !important;
      border: 1px solid ${borderColor} !important;
      border-radius: ${borderRadius}px !important;
      box-shadow: ${boxShadow} !important;
      backdrop-filter: blur(8px);
    }
    .antv-s2-tooltip-container .antv-s2-tooltip-name,
    .antv-s2-tooltip-container .antv-s2-tooltip-highlight {
      color: ${textColor} !important;
    }
    .antv-s2-tooltip-container .antv-s2-tooltip-head-info-list {
      color: ${textColor} !important;
      font-weight: 600;
      padding: 8px 12px 6px !important;
      border-bottom: 1px solid ${borderColor};
    }
    .antv-s2-tooltip-container .antv-s2-tooltip-detail-list {
      padding: 6px 12px 8px !important;
    }
    .antv-s2-tooltip-container .antv-s2-tooltip-detail-item,
    .antv-s2-tooltip-container .antv-s2-tooltip-summary {
      color: ${secondaryTextColor} !important;
    }
    .antv-s2-tooltip-container .antv-s2-tooltip-detail-item-val,
    .antv-s2-tooltip-container .antv-s2-tooltip-summary-val {
      color: ${textColor} !important;
      font-weight: 600;
    }
    .antv-s2-tooltip-container .antv-s2-tooltip-description,
    .antv-s2-tooltip-container .antv-s2-tooltip-tips {
      color: ${tertiaryTextColor} !important;
    }
    .antv-s2-tooltip-container .antv-s2-tooltip-infos {
      background: ${headerBgColor} !important;
      background-color: ${headerBgColor} !important;
      color: ${tertiaryTextColor} !important;
      border-top: 1px solid ${borderColor};
    }
    .antv-s2-tooltip-container .antv-s2-tooltip-operator {
      background: ${tooltipBg} !important;
      color: ${textColor} !important;
    }
    .s2-tooltip-custom-menu .ant-menu {
      background: ${tooltipBg} !important;
      color: ${textColor} !important;
      font-family: ${fontFamily} !important;
      font-size: 11px !important;
      line-height: 1.2 !important;
      width: 140px !important;
      border-inline-end: none !important;
    }
    .s2-tooltip-custom-menu .ant-menu-item {
      height: 24px !important;
      line-height: 24px !important;
      padding: 0 8px !important;
      margin: 2px 4px !important;
      border-radius: 4px !important;
      font-size: 11px !important;
      color: ${textColor} !important;
    }
    .s2-tooltip-custom-menu .ant-menu-item:hover,
    .s2-tooltip-custom-menu .ant-menu-item-active {
      background-color: ${hoverBgColor} !important;
      color: ${textColor} !important;
    }
    .s2-tooltip-custom-menu .ant-menu-item-selected {
      background-color: ${selectedBgColor} !important;
      color: ${selectedTextColor} !important;
      font-weight: 600;
    }
    .s2-tooltip-custom-menu .ant-menu-item .ant-menu-title-content {
      font-size: 11px !important;
    }
    .s2-tooltip-custom-menu .ant-menu-item-icon,
    .s2-tooltip-custom-menu .antv-s2-operator-icon {
      font-size: 10px !important;
      margin-right: 6px !important;
      color: ${isDark ? secondaryTextColor : textColor} !important;
      fill: ${isDark ? secondaryTextColor : textColor} !important;
    }
  `;
}

/**
 * Build cell interaction state styling. Takes hover/selected bg color and
 * returns the interactionState block used across all cell types.
 */
function buildInteractionState(isDark = false, borderColor = 'transparent') {
  const crosshairBg = isDark
    ? 'rgba(255, 255, 255, 0.025)'
    : 'rgba(0, 0, 0, 0.02)';
  const focusBg = isDark
    ? 'rgba(255, 255, 255, 0.055)'
    : 'rgba(0, 0, 0, 0.045)';
  return {
    hover: {
      backgroundColor: crosshairBg,
      backgroundOpacity: 1,
    },
    hoverFocus: {
      backgroundColor: focusBg,
      backgroundOpacity: 1,
      borderColor,
      borderOpacity: 0,
      borderWidth: 0,
    },
    selected: {
      backgroundColor: focusBg,
      backgroundOpacity: 1,
    },
    prepareSelect: {
      borderColor,
      borderOpacity: 0,
      borderWidth: 0,
    },
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
    selectedValues,
    emitCrossFilters,
    crossfilterColumns,
    groupby,
    metricCols,
    metricColsSet,
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
        columns: props.s2DataConfig?.fields?.columns || [],
      }),
    [props.s2DataConfig?.fields?.columns],
  );

  React.useEffect(() => {
    setSortParams([]);
  }, [fieldsKey]);

  const mergedDataCfg = useMemo(
    () => ({
      ...s2DataConfig,
      sortParams:
        sortParams.length > 0
          ? sortParams
          : s2DataConfig.sortParams || [],
    }),
    [s2DataConfig, sortParams],
  );

  // ── Cross-filtering ──
  const handleDataClick = useCallback(
    (cellItem: any) => {
      if (!emitCrossFilters || !setDataMask) return;

      const meta =
        cellItem?.viewMeta ||
        cellItem?.meta ||
        (typeof cellItem?.getMeta === 'function' ? cellItem.getMeta() : null);
      if (!meta) return;

      const record =
        meta.record ||
        meta.spreadsheet?.dataSet?.getRowData?.(meta) ||
        meta.spreadsheet?.dataSet?.displayData?.[meta.rowIndex] ||
        meta.query ||
        (meta.cells &&
          (meta.cells[0]?.viewMeta?.record ||
            meta.cells[0]?.meta?.record ||
            meta.cells[0]?.record)) ||
        {};

      const colsToEmit =
        crossfilterColumns.length > 0 ? crossfilterColumns : groupby;

      const filterDict: Record<string, any> = {};
      const filters: any[] = [];

      colsToEmit.forEach(col => {
        if (record[col] !== undefined) {
          const val = record[col];
          filterDict[col] = val;
          filters.push({ col, op: '==', val });
        }
      });

      if (filters.length === 0) return;

      const filterDictStr = JSON.stringify(filterDict);
      const currentSelected = Object.values(selectedValues || {});
      const isAlreadySelected = currentSelected.includes(filterDictStr);

      if (isAlreadySelected) {
        setDataMask({
          extraFormData: {},
          filterState: {
            value: null,
            selectedValues: [],
          },
        });
        return;
      }

      const dataMask: DataMask = {
        extraFormData: { filters } as any,
        filterState: {
          value: [filterDictStr],
          selectedValues: [filterDictStr],
        },
      };
      setDataMask(dataMask);
    },
    [
      emitCrossFilters,
      setDataMask,
      selectedValues,
      crossfilterColumns,
      groupby,
    ],
  );

  // ── Theme ────────────────────────────────────
  const theme = useTheme();
  const isDarkMode = useThemeMode();

  const fontFamily =
    theme?.fontFamily ||
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
  const fontSize = theme?.fontSizeSM || 12;
  const headerFontWeight = theme?.fontWeightStrong || 600;
  const textColor = theme?.colorText || '#262626';
  const bgColor = theme?.colorBgContainer || '#ffffff';
  const isDark = isDarkMode;
  const headerBgColor =
    headerColor ||
    (isDark
      ? theme?.colorFillQuaternary || theme?.colorFillAlter || '#1d1d1d'
      : theme?.colorFillAlter || theme?.colorBgLayout || '#fafafa');
  const resolvedBorderColor =
    borderColor ||
    (isDark
      ? theme?.colorBorderSecondary || theme?.colorBorder || '#303030'
      : theme?.colorBorderSecondary || theme?.colorBorder || '#f0f0f0');
  const hoverBgColor = isDark
    ? theme?.colorFillContentHover || 'rgba(255, 255, 255, 0.08)'
    : theme?.colorBgTextHover || theme?.colorFillSecondary || '#f0f0f0';
  const defaultBandingColor = isDark
    ? 'rgba(255, 255, 255, 0.025)'
    : theme?.colorFillQuaternary || '#fafafa';

  const isTransparentBanding = rowBandingColorObj && rowBandingColorObj.a === 0;
  const resolvedRowBandingColor = isTransparentBanding
    ? bgColor
    : rowBandingColor || defaultBandingColor;
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
  const totalFontWeight = theme?.fontWeightStrong || 600;

  const tooltipBg =
    theme?.colorBgElevated || (isDark ? '#1f1f1f' : '#ffffff');
  const secondaryTextColor =
    theme?.colorTextSecondary ||
    (isDark ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.65)');
  const tertiaryTextColor =
    theme?.colorTextTertiary ||
    (isDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.45)');
  const selectedBgColor =
    theme?.controlItemBgActive ||
    (isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.06)');
  const selectedTextColor = theme?.colorPrimary || textColor;
  const tooltipBorderRadius = theme?.borderRadius || 6;
  const tooltipBoxShadow =
    theme?.boxShadowSecondary ||
    (isDark
      ? '0 6px 16px 0 rgba(0, 0, 0, 0.48)'
      : '0 6px 16px 0 rgba(0, 0, 0, 0.08)');

  const tooltipStyleSheet = useMemo(
    () =>
      buildTooltipStyleSheet({
        isDark,
        tooltipBg,
        textColor,
        secondaryTextColor,
        tertiaryTextColor,
        borderColor: resolvedBorderColor,
        hoverBgColor,
        selectedBgColor,
        selectedTextColor,
        headerBgColor,
        fontFamily,
        fontSize,
        borderRadius: tooltipBorderRadius,
        boxShadow: tooltipBoxShadow,
      }),
    [
      isDark,
      tooltipBg,
      textColor,
      secondaryTextColor,
      tertiaryTextColor,
      resolvedBorderColor,
      hoverBgColor,
      selectedBgColor,
      selectedTextColor,
      headerBgColor,
      fontFamily,
      fontSize,
      tooltipBorderRadius,
      tooltipBoxShadow,
    ],
  );

  const isDefaultTheme = !formData.theme || formData.theme === 'default';

  const {
    adaptive,
    loading,
    showPagination,
    themeCfg: advThemeCfg,
    theme: advTheme,
    palette: advPalette,
  } = advancedS2OptionsObj || {};

  const customThemeCfg = useMemo(() => {
    const hoverInteraction = buildInteractionState(isDark, resolvedBorderColor);
    const resizeHighlightColor = isDark
      ? theme?.colorTextTertiary || 'rgba(255, 255, 255, 0.45)'
      : theme?.colorTextTertiary || 'rgba(0, 0, 0, 0.35)';
    const resizeAreaTheme = {
      size: 2,
      background: resizeHighlightColor,
      backgroundOpacity: 0,
      guideLineColor: resizeHighlightColor,
      guideLineDisableColor: isDark
        ? 'rgba(255, 255, 255, 0.15)'
        : 'rgba(0, 0, 0, 0.15)',
      guideLineDash: [3, 3],
      interactionState: {
        hover: {
          backgroundColor: resizeHighlightColor,
          backgroundOpacity: isDark ? 0.65 : 0.55,
        },
      },
    };
    const cellBorders = {
      horizontalBorderColor: resolvedBorderColor,
      verticalBorderColor: resolvedBorderColor,
    };
    const baseTextProps = {
      fontFamily,
      fontSize,
    };

    const baseThemeCfg: any = {
      name: formData.theme || 'default',
      theme: isDefaultTheme
        ? {
            background: { color: bgColor },
            resizeArea: resizeAreaTheme,
            prepareSelectMask: {
              backgroundColor: resizeHighlightColor,
              backgroundOpacity: 0.15,
            },
            splitLine: {
              ...cellBorders,
              horizontalBorderColorOpacity: isDark ? 0.65 : 1,
              verticalBorderColorOpacity: isDark ? 0.65 : 1,
            },
            dataCell: {
              cell: {
                backgroundColor: bgColor,
                crossBackgroundColor: resolvedRowBandingColor,
                ...cellBorders,
                interactionState: hoverInteraction,
              },
              text: { ...baseTextProps, fill: textColor, textAlign: 'center' },
              bolderText: {
                ...baseTextProps,
                fill: totalText,
                fontWeight: totalFontWeight,
                textAlign: 'center',
              },
              measureText: {
                ...baseTextProps,
                fill: textColor,
                textAlign: 'center',
              },
            },
            cornerCell: {
              cell: {
                backgroundColor: headerBgColor,
                ...cellBorders,
                interactionState: hoverInteraction,
              },
              text: {
                ...baseTextProps,
                fill: headerTextColor,
                fontWeight: headerFontWeight,
              },
              bolderText: {
                ...baseTextProps,
                fill: headerTextColor,
                fontWeight: headerFontWeight,
              },
              measureText: { ...baseTextProps, fill: headerTextColor },
            },
            seriesNumberCell: {
              cell: {
                backgroundColor: headerBgColor,
                ...cellBorders,
                interactionState: hoverInteraction,
              },
              text: { ...baseTextProps, fill: headerTextColor },
              bolderText: {
                ...baseTextProps,
                fill: headerTextColor,
                fontWeight: headerFontWeight,
              },
              measureText: { ...baseTextProps, fill: headerTextColor },
            },
            rowCell: {
              cell: {
                backgroundColor: bgColor,
                ...cellBorders,
                interactionState: hoverInteraction,
              },
              text: { ...baseTextProps, fill: textColor },
              bolderText: {
                ...baseTextProps,
                fill: totalText,
                fontWeight: totalFontWeight,
              },
              measureText: { ...baseTextProps, fill: textColor },
              seriesText: { ...baseTextProps, fill: textColor },
            },
            colCell: {
              cell: {
                backgroundColor: headerBgColor,
                ...cellBorders,
                interactionState: hoverInteraction,
              },
              text: {
                ...baseTextProps,
                fill: headerTextColor,
                fontWeight: headerFontWeight,
                textAlign: 'center',
              },
              bolderText: {
                ...baseTextProps,
                fill: headerTextColor,
                fontWeight: headerFontWeight,
                textAlign: 'center',
              },
              measureText: {
                ...baseTextProps,
                fill: headerTextColor,
                textAlign: 'center',
              },
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
        : {
            resizeArea: resizeAreaTheme,
            prepareSelectMask: {
              backgroundColor: resizeHighlightColor,
              backgroundOpacity: 0.15,
            },
            dataCell: { cell: { interactionState: hoverInteraction } },
            rowCell: { cell: { interactionState: hoverInteraction } },
            colCell: { cell: { interactionState: hoverInteraction } },
            cornerCell: { cell: { interactionState: hoverInteraction } },
            seriesNumberCell: { cell: { interactionState: hoverInteraction } },
          },
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
      'resizeArea',
      'prepareSelectMask',
      'dataCell',
      'rowCell',
      'colCell',
      'cornerCell',
      'scrollBar',
      'cell',
    ];

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
    fontFamily,
    fontSize,
    headerFontWeight,
    resolvedBorderColor,
    resolvedRowBandingColor,
    isDefaultTheme,
    advancedS2OptionsObj,
  ]);

  // Conditional background custom rules + JSON overrides
  const optionsWithStyles = useMemo(() => {
    const baseOptions = { ...s2Options };

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

    (finalOptions as any).columnAlignmentsObj = columnAlignmentsObj;
    (finalOptions as any).columnBoldTextObj = columnBoldTextObj;
    (finalOptions as any).defaultDimensionAlign = defaultDimensionAlign;
    (finalOptions as any).defaultMetricAlign = defaultMetricAlign;
    (finalOptions as any).metricCols = metricCols;
    (finalOptions as any).metricColsSet = metricColsSet;

    finalOptions.dataCell = (viewMeta: any, spreadsheet: any, ...args: any[]) =>
      new CustomDataCell(
        viewMeta,
        spreadsheet || viewMeta?.spreadsheet,
        ...args,
      );
    finalOptions.mergedCell = (
      viewMeta: any,
      spreadsheet: any,
      ...args: any[]
    ) =>
      new CustomMergedCell(
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
      if (typeof finalOptions.style.mergedCell === 'function') {
        delete finalOptions.style.mergedCell;
      }
    }

    finalOptions.tooltip = finalOptions.tooltip || {};
    finalOptions.tooltip.className = 'superset-s2-tooltip';
    finalOptions.tooltip.style = {
      background: tooltipBg,
      color: textColor,
      fontFamily,
      fontSize: `${fontSize}px`,
      borderRadius: `${tooltipBorderRadius}px`,
      border: `1px solid ${resolvedBorderColor}`,
      boxShadow: tooltipBoxShadow,
      ...finalOptions.tooltip.style,
    };
    finalOptions.tooltip.operation = finalOptions.tooltip.operation || {};
    finalOptions.tooltip.operation.menu = {
      render: (props: any) =>
        React.createElement(
          React.Fragment,
          null,
          React.createElement('style', null, tooltipStyleSheet),
          React.createElement(
            'div',
            { className: 's2-tooltip-custom-menu' },
            React.createElement(Menu, { ...props, mode: 'vertical' }),
          ),
        ),
      ...finalOptions.tooltip.operation.menu,
    };

    if (sortParams && sortParams.length > 0) {
      finalOptions.mergedCellsInfo = [];
    } else {
      finalOptions.mergedCellsInfo = s2Options.mergedCellsInfo || [];
    }

    return finalOptions;
  }, [
    s2Options,
    advancedS2OptionsObj,
    defaultDimensionAlign,
    defaultMetricAlign,
    columnAlignmentsObj,
    columnBoldTextObj,
    headerColor,
    metricCols,
    metricColsSet,
    colHeaderWordWrap,
    rowHeaderWordWrap,
    dataCellWordWrap,
    sortParams,
    tooltipBg,
    textColor,
    fontFamily,
    fontSize,
    tooltipBorderRadius,
    resolvedBorderColor,
    tooltipBoxShadow,
    tooltipStyleSheet,
  ]);

  const sheetKey = useMemo(
    () =>
      [
        isDark ? 'dark' : 'light',
        formData.theme || 'default',
        formData.advancedS2Options || formData.advanced_s2_options || '',
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
        formData.enableRowspan ?? formData.enable_rowspan ?? false,
      ].join('_'),
    [
      isDark,
      formData.theme,
      formData.advancedS2Options,
      formData.advanced_s2_options,
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
      formData.enableRowspan,
      formData.enable_rowspan,
    ],
  );

  return (
    <div
      ref={divRef}
      style={{ width: `${width}px`, height: `${height}px`, overflow: 'hidden' }}
    >
      <style>{tooltipStyleSheet}</style>
      {React.createElement(SheetComponent as any, {
        key: sheetKey,
        sheetType: 'table',
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
