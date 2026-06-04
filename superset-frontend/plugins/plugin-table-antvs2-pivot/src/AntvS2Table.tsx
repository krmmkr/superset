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
    s2Theme,
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

  // Pre-sort data by all sort entries (first entry = primary sort)
  const sortedDataCfg = useMemo(() => {
    if (sortEntries.length === 0) return s2DataConfig;

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

    return { ...s2DataConfig, data: sorted };
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

  // ── Theme ────────────────────────────────────
  const textColor = s2Theme?.colorText || '#262626';
  const bgColor = s2Theme?.colorBgContainer || '#ffffff';
  const headerBgColor =
    s2Theme?.colorBgLayout || s2Theme?.colorFillAlter || '#fafafa';
  const borderColor =
    s2Theme?.colorBorderSecondary || s2Theme?.colorBorder || '#f0f0f0';
  const hoverBgColor =
    s2Theme?.colorBgTextHover || s2Theme?.colorFillAlter || '#f5f5f5';
  const headerTextColor =
    s2Theme?.colorTextHeading || s2Theme?.colorText || '#262626';

  const totalText = headerTextColor;
  const totalFontWeight = 700;

  const isDefaultTheme = !formData.theme || formData.theme === 'default';

  const baseThemeCfg: any = {
    name: formData.theme || 'default',
    theme: isDefaultTheme
      ? {
          background: { color: bgColor },
          splitLine: {
            horizontalBorderColor: borderColor,
            verticalBorderColor: borderColor,
            horizontalBorderColorOpacity: 1,
            verticalBorderColorOpacity: 1,
          },
          dataCell: {
            cell: {
              backgroundColor: bgColor,
              crossBackgroundColor: hoverBgColor,
              interactionState: {
                hover: { backgroundColor: hoverBgColor },
              },
            },
            text: { fill: textColor },
            bolderText: { fill: totalText, fontWeight: totalFontWeight },
            measureText: { fill: textColor },
          },
          cornerCell: {
            cell: { backgroundColor: headerBgColor },
            text: { fill: headerTextColor, fontWeight: 'bold' },
            bolderText: { fill: headerTextColor },
            measureText: { fill: headerTextColor },
          },
          rowCell: {
            cell: { backgroundColor: bgColor },
            text: { fill: textColor },
            bolderText: { fill: totalText, fontWeight: totalFontWeight },
            measureText: { fill: textColor },
          },
          colCell: {
            cell: { backgroundColor: headerBgColor },
            text: { fill: headerTextColor, fontWeight: 'bold' },
            bolderText: { fill: headerTextColor },
            measureText: { fill: headerTextColor },
          },
          scrollBar: {
            thumbColor:
              s2Theme?.colorTextSecondary ||
              s2Theme?.colorTextTertiary ||
              'rgba(0,0,0,0.35)',
            thumbHoverColor: s2Theme?.colorText || 'rgba(0,0,0,0.5)',
            trackColor:
              s2Theme?.colorFillSecondary ||
              s2Theme?.colorBgLayout ||
              'rgba(0,0,0,0.05)',
            size: 8,
            hoverSize: 12,
            lineCap: 'round',
          },
        }
      : {},
  };

  const customThemeCfg = useMemo(() => {
    const advThemeCfg = advancedS2OptionsObj?.themeCfg || {};
    const merged = merge({}, baseThemeCfg, advThemeCfg);

    // Ensure S2 always has a built-in palette to fall back on if `name` is overriden.
    // Doing this safely natively allows `merged.name` to be recognized by S2's getTheme engine!
    merged.palette =
      advThemeCfg.palette || getPalette(merged.name || 'default');

    return merged;
  }, [baseThemeCfg, advancedS2OptionsObj, formData.theme]);

  // Conditional background custom rules + JSON overrides
  const optionsWithStyles = useMemo(() => {
    const baseOptions = { ...s2Options };

    // Deep merge advanced options directly on top (excluding themeCfg since we applied it above)
    const { themeCfg, ...restAdvancedOptions } = advancedS2OptionsObj || {};
    return merge({}, baseOptions, restAdvancedOptions);
  }, [s2Options, advancedS2OptionsObj]);

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
        dataCfg: sortedDataCfg,
        options: { ...optionsWithStyles, height: chartHeight },
        themeCfg: customThemeCfg,
        onDataCellClick: handleDataClick,
        onRowCellClick: handleDataClick,
      })}
    </div>
  );
}
