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
import { setLang, getPalette } from '@antv/s2';
import '@antv/s2-react/dist/style.min.css';
import { DataMask } from '@superset-ui/core';
import { merge } from 'lodash';
import { useTheme, useThemeMode } from '@apache-superset/core/theme';
import { S2TableTransformedProps } from './types';

setLang('en_US');

interface SortEntry {
  field: string;
  direction: 'ASC' | 'DESC';
}

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
    allFields,
    metricCols,
    showSortControls,
    advancedS2OptionsObj,
  } = props;

  const divRef = useRef<HTMLDivElement>(null);

  // ── Multi-column sort state ──────────────────
  const [sortEntries, setSortEntries] = useState<SortEntry[]>([]);

  const addSort = useCallback(() => {
    // Find the first field not yet in the sort list
    const usedFields = new Set(sortEntries.map(e => e.field));
    const nextField = allFields.find(f => !usedFields.has(f)) || allFields[0];
    if (nextField) {
      setSortEntries(prev => [...prev, { field: nextField, direction: 'ASC' }]);
    }
  }, [sortEntries, allFields]);

  const removeSort = useCallback((idx: number) => {
    setSortEntries(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const updateSort = useCallback((idx: number, patch: Partial<SortEntry>) => {
    setSortEntries(prev =>
      prev.map((entry, i) => (i === idx ? { ...entry, ...patch } : entry)),
    );
  }, []);

  const clearAllSorts = useCallback(() => setSortEntries([]), []);

  // Pre-sort data by all sort entries (first entry = primary sort) and attach sortParams for S2 header sort icons
  const sortedDataCfg = useMemo(() => {
    const sortParams = sortEntries.map(entry => ({
      sortFieldId: entry.field,
      sortMethod: entry.direction,
    }));

    const baseCfg = {
      ...s2DataConfig,
      sortParams,
    };

    if (sortEntries.length === 0) return baseCfg;

    const sorted = [...s2DataConfig.data].sort((a: any, b: any) => {
      for (const { field, direction } of sortEntries) {
        const isMetric = metricCols.includes(field);
        let cmp: number;

        if (isMetric) {
          const aNum = Number(a[field]) || 0;
          const bNum = Number(b[field]) || 0;
          cmp = aNum - bNum;
        } else {
          cmp = String(a[field] || '').localeCompare(String(b[field] || ''));
        }

        if (cmp !== 0) {
          return direction === 'ASC' ? cmp : -cmp;
        }
      }
      return 0;
    });

    return { ...baseCfg, data: sorted };
  }, [s2DataConfig, sortEntries, metricCols]);

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

  // ── Column Header sorting on click ──
  const handleColCellClick = useCallback(
    (cellItem: any) => {
      const meta = cellItem?.viewMeta || cellItem?.meta;
      if (!meta || !meta.field) return;
      const clickedField = meta.field;

      setSortEntries(prev => {
        const existingIdx = prev.findIndex(e => e.field === clickedField);
        if (existingIdx === -1) {
          // Single-column sort: clear others and set ASC
          return [{ field: clickedField, direction: 'ASC' }];
        }
        const existing = prev[existingIdx];
        if (existing.direction === 'ASC') {
          // Toggle to DESC
          return [{ field: clickedField, direction: 'DESC' }];
        }
        // Toggle to None (clear sort)
        return [];
      });
    },
    [],
  );

  // ── Theme ────────────────────────────────────
  const theme = useTheme();
  const isDarkMode = useThemeMode();

  const textColor = theme?.colorText || '#262626';
  const bgColor = theme?.colorBgContainer || '#ffffff';
  const isDark = isDarkMode;
  const headerBgColor =
    theme?.colorBgLayout || theme?.colorFillAlter || '#fafafa';
  const borderColor = isDark
    ? theme?.colorBorderSecondary || theme?.colorBorder || '#303030'
    : theme?.colorBorderSecondary || theme?.colorBorder || '#f0f0f0';
  const hoverBgColor = isDark
    ? theme?.colorFillContentHover || 'rgba(255, 255, 255, 0.08)'
    : theme?.colorBgTextHover || theme?.colorFillAlter || '#f5f5f5';
  const headerTextColor =
    theme?.colorTextHeading || theme?.colorText || '#262626';

  const totalText = headerTextColor;
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
    const baseThemeCfg: any = {
      name: formData.theme || 'default',
      theme: isDefaultTheme
        ? {
            background: { color: bgColor },
            splitLine: {
              horizontalBorderColor: borderColor,
              verticalBorderColor: borderColor,
              horizontalBorderColorOpacity: isDark ? 0.6 : 1,
              verticalBorderColorOpacity: isDark ? 0.6 : 1,
            },
            dataCell: {
              cell: {
                backgroundColor: bgColor,
                crossBackgroundColor: hoverBgColor,
                horizontalBorderColor: borderColor,
                verticalBorderColor: borderColor,
                interactionState: {
                  hover: { backgroundColor: hoverBgColor, backgroundOpacity: 1 },
                  hoverFocus: { backgroundColor: hoverBgColor, backgroundOpacity: 1 },
                  selected: { backgroundColor: hoverBgColor, backgroundOpacity: 1 },
                },
              },
              text: { fill: textColor, textAlign: 'center' },
              bolderText: { fill: totalText, fontWeight: totalFontWeight, textAlign: 'center' },
              measureText: { fill: textColor, textAlign: 'center' },
            },
            cornerCell: {
              cell: {
                backgroundColor: headerBgColor,
                horizontalBorderColor: borderColor,
                verticalBorderColor: borderColor,
                interactionState: {
                  hover: { backgroundColor: hoverBgColor, backgroundOpacity: 1 },
                  hoverFocus: { backgroundColor: hoverBgColor, backgroundOpacity: 1 },
                  selected: { backgroundColor: hoverBgColor, backgroundOpacity: 1 },
                },
              },
              text: { fill: headerTextColor, fontWeight: 'bold' },
              bolderText: { fill: headerTextColor },
              measureText: { fill: headerTextColor },
            },
            rowCell: {
              cell: {
                backgroundColor: bgColor,
                horizontalBorderColor: borderColor,
                verticalBorderColor: borderColor,
                interactionState: {
                  hover: { backgroundColor: hoverBgColor, backgroundOpacity: 1 },
                  hoverFocus: { backgroundColor: hoverBgColor, backgroundOpacity: 1 },
                  selected: { backgroundColor: hoverBgColor, backgroundOpacity: 1 },
                },
              },
              text: { fill: textColor },
              bolderText: { fill: totalText, fontWeight: totalFontWeight },
              measureText: { fill: textColor },
            },
            colCell: {
              cell: {
                backgroundColor: headerBgColor,
                horizontalBorderColor: borderColor,
                verticalBorderColor: borderColor,
                interactionState: {
                  hover: { backgroundColor: hoverBgColor, backgroundOpacity: 1 },
                  hoverFocus: { backgroundColor: hoverBgColor, backgroundOpacity: 1 },
                  selected: { backgroundColor: hoverBgColor, backgroundOpacity: 1 },
                },
              },
              text: { fill: headerTextColor, fontWeight: 'bold', textAlign: 'center' },
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

    const userOptions = (advancedS2OptionsObj && advancedS2OptionsObj.options) || {};
    const finalAdvThemeCfg = advThemeCfg || userOptions.themeCfg || {};
    const merged = merge({}, baseThemeCfg, finalAdvThemeCfg);

    const activeTheme = merge({}, advTheme || userOptions.theme || finalAdvThemeCfg.theme || {});
    const themeKeys = ['background', 'splitLine', 'dataCell', 'rowCell', 'colCell', 'cornerCell', 'scrollBar', 'cell'];

    // Auto-promote keys from root, root.options, themeCfg or themeCfg.theme to merged.theme
    themeKeys.forEach(key => {
      if (advancedS2OptionsObj && advancedS2OptionsObj[key]) {
        activeTheme[key] = merge({}, activeTheme[key] || {}, advancedS2OptionsObj[key]);
      }
      if (userOptions && userOptions[key]) {
        activeTheme[key] = merge({}, activeTheme[key] || {}, userOptions[key]);
      }
      if (finalAdvThemeCfg[key]) {
        activeTheme[key] = merge({}, activeTheme[key] || {}, finalAdvThemeCfg[key]);
      }
    });

    if (Object.keys(activeTheme).length > 0) {
      merged.theme = merge({}, merged.theme || {}, activeTheme);
    }

    const activePalette = advPalette || userOptions.palette || finalAdvThemeCfg.palette;
    if (activePalette) {
      merged.palette = activePalette;
    } else {
      merged.palette = getPalette(merged.name || 'default');
    }

    return merged;
  }, [
    bgColor,
    borderColor,
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
    
    const userOptions = (advancedS2OptionsObj && advancedS2OptionsObj.options) || {};
    const finalOptions = merge({}, baseOptions, restOptions, userOptions);

    // Promote layout/style keys from root of advancedS2OptionsObj or nested options to style block
    const styleKeys = ['colCfg', 'rowCfg', 'cellCfg', 'layoutWidthType', 'showSeriesNumber'];
    styleKeys.forEach(key => {
      if (advancedS2OptionsObj && advancedS2OptionsObj[key]) {
        finalOptions.style = finalOptions.style || {};
        finalOptions.style[key] = merge({}, finalOptions.style[key] || {}, advancedS2OptionsObj[key]);
      }
      if (userOptions && userOptions[key]) {
        finalOptions.style = finalOptions.style || {};
        finalOptions.style[key] = merge({}, finalOptions.style[key] || {}, userOptions[key]);
      }
    });

    // Also support direct rowHeight / colHeight / cellHeight overrides from root or nested options
    if (advancedS2OptionsObj) {
      const colHeight = advancedS2OptionsObj.colHeight ?? userOptions.colHeight;
      if (colHeight !== undefined) {
        finalOptions.style = finalOptions.style || {};
        finalOptions.style.colCfg = finalOptions.style.colCfg || {};
        finalOptions.style.colCfg.height = colHeight;
      }
      const rowHeight = advancedS2OptionsObj.rowHeight ?? userOptions.rowHeight;
      if (rowHeight !== undefined) {
        finalOptions.style = finalOptions.style || {};
        finalOptions.style.rowCfg = finalOptions.style.rowCfg || {};
        finalOptions.style.rowCfg.height = rowHeight;
      }
      const cellHeight = advancedS2OptionsObj.cellHeight ?? userOptions.cellHeight;
      if (cellHeight !== undefined) {
        finalOptions.style = finalOptions.style || {};
        finalOptions.style.cellCfg = finalOptions.style.cellCfg || {};
        finalOptions.style.cellCfg.height = cellHeight;
      }
    }

    return finalOptions;
  }, [s2Options, advancedS2OptionsObj]);

  // Generate a key to force SheetComponent remount when options or theme changes
  const sheetKey = useMemo(() => {
    return [
      width,
      height,
      isDark ? 'dark' : 'light',
      formData.theme || 'default',
      formData.advancedS2Options || '',
      formData.tableMode || 'grid',
    ].join('_');
  }, [width, height, isDark, formData.theme, formData.advancedS2Options, formData.tableMode]);


  const controlBarHeight = showSortControls ? 32 : 0;

  const selectStyle: any = {
    padding: '2px 6px',
    fontSize: '12px',
    border: `1px solid ${borderColor}`,
    borderRadius: '4px',
    backgroundColor: bgColor,
    color: textColor,
    cursor: 'pointer',
    outline: 'none',
  };
  const btnStyle: any = {
    padding: '2px 8px',
    fontSize: '11px',
    border: `1px solid ${borderColor}`,
    borderRadius: '4px',
    backgroundColor: bgColor,
    color: textColor,
    cursor: 'pointer',
  };

  const usedFields = new Set(sortEntries.map(e => e.field));
  const canAddMore = allFields.some(f => !usedFields.has(f));

  const sortBar = (
    <div
      style={{
        height: `${controlBarHeight}px`,
        padding: '0 8px',
        fontSize: '12px',
        color: textColor,
        backgroundColor: headerBgColor,
        borderBottom: `1px solid ${borderColor}`,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        flexWrap: 'wrap',
        overflow: 'hidden',
      }}
    >
      <span style={{ fontWeight: 500 }}>Sort:</span>
      {sortEntries.length === 0 && <span style={{ opacity: 0.6 }}>None</span>}
      {sortEntries.map((entry, idx) => (
        <span
          key={idx}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            backgroundColor: bgColor,
            border: `1px solid ${borderColor}`,
            borderRadius: '4px',
            padding: '1px 4px',
          }}
        >
          <span style={{ opacity: 0.5, fontSize: '10px' }}>{idx + 1}.</span>
          <select
            value={entry.field}
            onChange={e => updateSort(idx, { field: e.target.value })}
            style={{ ...selectStyle, border: 'none', padding: '1px 2px' }}
          >
            {allFields.map(f => (
              <option
                key={f}
                value={f}
                disabled={usedFields.has(f) && f !== entry.field}
              >
                {f}
              </option>
            ))}
          </select>
          <select
            value={entry.direction}
            onChange={e =>
              updateSort(idx, { direction: e.target.value as 'ASC' | 'DESC' })
            }
            style={{ ...selectStyle, border: 'none', padding: '1px 4px' }}
          >
            <option value="ASC">↑ ASC</option>
            <option value="DESC">↓ DESC</option>
          </select>
          <button
            type="button"
            onClick={() => removeSort(idx)}
            style={{
              ...btnStyle,
              border: 'none',
              padding: '0 2px',
              fontSize: '10px',
            }}
          >
            ✕
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={addSort}
        style={btnStyle}
        disabled={!canAddMore}
      >
        +
      </button>
      {sortEntries.length > 0 && (
        <button type="button" onClick={clearAllSorts} style={btnStyle}>
          Clear
        </button>
      )}
    </div>
  );

  const chartHeight = height - controlBarHeight;

  return (
    <div
      ref={divRef}
      style={{ width: `${width}px`, height: `${height}px`, overflow: 'hidden' }}
    >
      {showSortControls && sortBar}
      {React.createElement(SheetComponent as any, {
        key: sheetKey,
        sheetType,
        adaptive,
        loading,
        showPagination,
        dataCfg: sortedDataCfg,
        options: { ...optionsWithStyles, height: chartHeight },
        themeCfg: customThemeCfg,
        onMounted: (s2: any) => {
          (window as any).s2 = s2;
        },
        onDataCellClick: handleDataClick,
        onRowCellClick: handleDataClick,
        onColCellClick: handleColCellClick,
      })}
    </div>
  );
}
