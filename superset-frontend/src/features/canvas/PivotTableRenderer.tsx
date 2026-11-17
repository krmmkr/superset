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
import { useMemo, useState } from 'react';
import type { canvas as canvasApi } from '@apache-superset/core';
import { t } from '@apache-superset/core/translation';
import { css, styled, useTheme } from '@apache-superset/core/theme';
import { Empty, Loading } from '@superset-ui/core/components';
import {
  ConditionalFormatRule,
  evaluateConditionalStyle,
} from './conditionalFormatting';
import { WidgetError } from './dataRenderers';
import { useWidgetRows } from './useWidgetRows';
import WithQuery from './WithQuery';

type Props = canvasApi.CanvasWidgetProps;

const Container = styled.div<{ refreshing?: boolean }>`
  ${({ theme, refreshing }) => css`
    height: 100%;
    overflow: auto;
    opacity: ${refreshing ? 0.55 : 1};
    transition: opacity 0.15s ease;

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: ${theme.fontSizeSM}px;
    }

    th,
    td {
      padding: ${theme.sizeUnit * 1.5}px ${theme.sizeUnit * 2}px;
      border-bottom: 1px solid ${theme.colorBorderSecondary};
      white-space: nowrap;
    }

    th {
      position: sticky;
      top: 0;
      z-index: 1;
      background: ${theme.colorFillAlter};
      color: ${theme.colorTextHeading};
      font-weight: ${theme.fontWeightStrong};
      text-align: left;
      cursor: pointer;
      user-select: none;
    }

    th:hover {
      background: ${theme.colorFillSecondary};
    }

    .sort-indicator {
      margin-left: ${theme.sizeUnit}px;
      font-size: 10px;
      opacity: 0.75;
    }

    th.num,
    td.num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    tr.total-row td {
      background: ${theme.colorFillQuaternary};
      font-weight: ${theme.fontWeightStrong};
      border-top: 2px solid ${theme.colorBorder};
    }

    td.total-col {
      font-weight: ${theme.fontWeightStrong};
      background: ${theme.colorFillQuaternary};
    }

    td.cross-filterable {
      cursor: pointer;
    }

    td.cross-filterable:hover {
      background: ${theme.colorFillAlter};
    }

    td.cross-filter-active {
      background: ${theme.colorPrimaryBg};
      color: ${theme.colorPrimaryText};
      font-weight: ${theme.fontWeightStrong};
    }

    td.num.cross-filter-active {
      outline: 2px solid ${theme.colorPrimary};
      outline-offset: -2px;
    }

    th.sticky-row-col,
    td.sticky-row-col {
      position: sticky;
      left: 0;
      z-index: 2;
      background: ${theme.colorBgContainer};
    }

    thead th.sticky-row-col {
      z-index: 3;
      background: ${theme.colorFillAlter};
    }

    tr.total-row td.sticky-row-col {
      background: ${theme.colorFillQuaternary};
    }
  `}
`;

const text = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const strings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string')
    : [];

type SortTarget =
  | { kind: 'rowField'; index: number }
  | { kind: 'col'; key: string }
  | { kind: 'total' };

type SortState = {
  target: SortTarget;
  dir: 'asc' | 'desc';
} | null;

function isSameSortTarget(a: SortTarget, b: SortTarget): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'rowField' && b.kind === 'rowField') {
    return a.index === b.index;
  }
  if (a.kind === 'col' && b.kind === 'col') {
    return a.key === b.key;
  }
  return true;
}

const KEY_SEP = '\u0000';

/**
 * Cross-tabulates query rows by `rowFields` and `columnFields`, summing the
 * numeric `metric` column and rendering optional row/column totals.
 */
export default function PivotTableRenderer(widget: Props) {
  const { props, filters, crossFilters, refreshKey, setCrossFilter } = widget;
  const theme = useTheme();
  const [sort, setSort] = useState<SortState>(null);
  const [activeCrossKey, setActiveCrossKey] = useState<string | null>(null);
  const effectiveFilters = useMemo(
    () => [...filters, ...(crossFilters ?? [])],
    [filters, crossFilters],
  );
  const { rows, loading, error, query, language, datasource, retry } =
    useWidgetRows(widget, effectiveFilters, refreshKey);
  const rules = Array.isArray(props?.conditionalFormatting)
    ? (props.conditionalFormatting as ConditionalFormatRule[])
    : [];

  const rowFields = strings(props?.rowFields);
  const colFields = strings(props?.columnFields);
  const metricProp = text(props?.metric);
  const showRowTotals = props?.showRowTotals !== false;
  const showColTotals = props?.showColTotals !== false;
  const decimals = typeof props?.decimals === 'number' ? props.decimals : 0;
  const prefix = text(props?.prefix);
  const suffix = text(props?.suffix);

  const pivot = useMemo(() => {
    const firstRow = rows[0] ?? {};
    const metricKey =
      metricProp ||
      Object.keys(firstRow).find(k => typeof firstRow[k] === 'number') ||
      '';

    const rowKeys: string[] = [];
    const rowPartsMap = new Map<string, string[]>();
    const rowKeySet = new Set<string>();
    const colKeys: string[] = [];
    const colPartsMap = new Map<string, string[]>();
    const colKeySet = new Set<string>();
    const cells = new Map<string, Map<string, number>>();
    const rowTotals = new Map<string, number>();
    const colTotals = new Map<string, number>();
    let grandTotal = 0;

    for (const row of rows) {
      const parts = rowFields.length
        ? rowFields.map(f => String(row[f] ?? '–'))
        : [t('Total')];
      const rKey = parts.join(KEY_SEP);
      const colParts = colFields.map(f => String(row[f] ?? '–'));
      const cKey = colFields.length
        ? colParts.join(' / ')
        : metricKey || t('Value');

      if (!rowKeySet.has(rKey)) {
        rowKeySet.add(rKey);
        rowKeys.push(rKey);
        rowPartsMap.set(rKey, parts);
      }
      if (!colKeySet.has(cKey)) {
        colKeySet.add(cKey);
        colKeys.push(cKey);
        colPartsMap.set(cKey, colParts);
      }

      const rawVal = metricKey ? row[metricKey] : 0;
      const num = typeof rawVal === 'number' ? rawVal : Number(rawVal) || 0;

      if (!cells.has(rKey)) cells.set(rKey, new Map());
      const rowMap = cells.get(rKey)!;
      rowMap.set(cKey, (rowMap.get(cKey) ?? 0) + num);
      rowTotals.set(rKey, (rowTotals.get(rKey) ?? 0) + num);
      colTotals.set(cKey, (colTotals.get(cKey) ?? 0) + num);
      grandTotal += num;
    }

    let minCell = Infinity;
    let maxCell = -Infinity;
    for (const rowMap of cells.values()) {
      for (const v of rowMap.values()) {
        if (v < minCell) minCell = v;
        if (v > maxCell) maxCell = v;
      }
    }
    const bounds =
      Number.isFinite(minCell) && Number.isFinite(maxCell)
        ? { pivot: { min: minCell, max: maxCell } }
        : {};

    return {
      rowKeys,
      rowPartsMap,
      colKeys,
      colPartsMap,
      cells,
      rowTotals,
      colTotals,
      grandTotal,
      bounds,
    };
  }, [rows, rowFields, colFields, metricProp]);

  const sortedRowKeys = useMemo(() => {
    if (!sort) return pivot.rowKeys;
    const mult = sort.dir === 'asc' ? 1 : -1;
    const copy = [...pivot.rowKeys];
    copy.sort((a, b) => {
      if (sort.target.kind === 'rowField') {
        const partsA = pivot.rowPartsMap.get(a) ?? [];
        const partsB = pivot.rowPartsMap.get(b) ?? [];
        const idx = sort.target.index;
        const primary = (partsA[idx] ?? '').localeCompare(
          partsB[idx] ?? '',
          undefined,
          { numeric: true },
        );
        if (primary !== 0) return primary * mult;
        return a.localeCompare(b, undefined, { numeric: true }) * mult;
      }
      const valA =
        sort.target.kind === 'total'
          ? (pivot.rowTotals.get(a) ?? 0)
          : (pivot.cells.get(a)?.get(sort.target.key) ??
            Number.NEGATIVE_INFINITY);
      const valB =
        sort.target.kind === 'total'
          ? (pivot.rowTotals.get(b) ?? 0)
          : (pivot.cells.get(b)?.get(sort.target.key) ??
            Number.NEGATIVE_INFINITY);
      if (valA === valB) return 0;
      return (valA - valB) * mult;
    });
    return copy;
  }, [pivot, sort]);

  const rowSpans = useMemo(() => {
    const colCount = Math.max(1, rowFields.length);
    const spans: number[][] = sortedRowKeys.map(() =>
      Array.from({ length: colCount }, () => 1),
    );
    if (colCount <= 1) return spans;

    for (let r = 0; r < sortedRowKeys.length; r += 1) {
      const parts = pivot.rowPartsMap.get(sortedRowKeys[r]) ?? [];
      for (let c = 0; c < colCount - 1; c += 1) {
        const prevParts =
          r > 0 ? (pivot.rowPartsMap.get(sortedRowKeys[r - 1]) ?? []) : null;
        const sameAsPrev =
          prevParts !== null &&
          parts.slice(0, c + 1).every((p, i) => p === prevParts[i]);
        if (sameAsPrev) {
          spans[r][c] = 0;
        } else {
          let count = 1;
          for (let k = r + 1; k < sortedRowKeys.length; k += 1) {
            const nextParts = pivot.rowPartsMap.get(sortedRowKeys[k]) ?? [];
            const matches = parts
              .slice(0, c + 1)
              .every((p, i) => p === nextParts[i]);
            if (!matches) break;
            count += 1;
          }
          spans[r][c] = count;
        }
      }
    }
    return spans;
  }, [sortedRowKeys, pivot.rowPartsMap, rowFields.length]);

  const toggleSort = (target: SortTarget) => {
    setSort(prev => {
      if (!prev || !isSameSortTarget(prev.target, target)) {
        return { target, dir: 'asc' };
      }
      if (prev.dir === 'asc') return { target, dir: 'desc' };
      return null;
    });
  };

  const sortIndicator = (target: SortTarget) => {
    if (!sort || !isSameSortTarget(sort.target, target)) return null;
    return (
      <span className="sort-indicator" aria-hidden="true">
        {sort.dir === 'asc' ? '▲' : '▼'}
      </span>
    );
  };

  const displayMode =
    props?.displayMode === 'row_percent' ||
    props?.displayMode === 'col_percent' ||
    props?.displayMode === 'total_percent'
      ? props.displayMode
      : 'value';
  const compactNumbers = Boolean(props?.compactNumbers);
  const freezeRowFields = props?.freezeRowFields !== false;

  const formatNum = (val: number | undefined, denom?: number) => {
    if (val === undefined) return '–';
    if (displayMode !== 'value') {
      const pct = denom && denom !== 0 ? (val / denom) * 100 : 0;
      const pctDecimals = decimals > 0 ? decimals : 1;
      return `${pct.toFixed(pctDecimals)}%`;
    }
    if (compactNumbers) {
      const formatted = new Intl.NumberFormat('en-US', {
        notation: 'compact',
        maximumFractionDigits: decimals > 0 ? decimals : 1,
      }).format(val);
      return `${prefix}${formatted}${suffix}`;
    }
    return `${prefix}${val.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}${suffix}`;
  };

  const cellDenom = (rKey: string, cKey: string) => {
    if (displayMode === 'row_percent') return pivot.rowTotals.get(rKey);
    if (displayMode === 'col_percent') return pivot.colTotals.get(cKey);
    if (displayMode === 'total_percent') return pivot.grandTotal;
    return undefined;
  };

  const datasetId = (props?.dataBinding as { datasetId?: unknown } | undefined)
    ?.datasetId;
  const crossFilterEnabled = Boolean(props?.crossFilter);
  const buildFilter = (column: string, value: string) => ({
    ...(typeof datasetId === 'number' ? { datasetId } : {}),
    column,
    values: [value],
  });
  const toggleCrossFilter = (key: string, payload: unknown) => {
    if (!crossFilterEnabled || !setCrossFilter) return;
    if (activeCrossKey === key) {
      setActiveCrossKey(null);
      setCrossFilter(undefined);
    } else {
      setActiveCrossKey(key);
      setCrossFilter(payload);
    }
  };
  const handleRowCellClick = (column: string | undefined, value: string) => {
    if (!column) return;
    toggleCrossFilter(`row:${column}:${value}`, buildFilter(column, value));
  };
  const handleDataCellClick = (rKey: string, cKey: string) => {
    const rParts = pivot.rowPartsMap.get(rKey) ?? [];
    const cParts = pivot.colPartsMap.get(cKey) ?? [];
    const filtersOut = [
      ...rowFields.map((col, idx) => buildFilter(col, rParts[idx] ?? '')),
      ...colFields.map((col, idx) => buildFilter(col, cParts[idx] ?? '')),
    ].filter(f => f.values[0] !== '');
    if (filtersOut.length === 0) return;
    toggleCrossFilter(
      `cell:${rKey}:${cKey}`,
      filtersOut.length === 1 ? filtersOut[0] : filtersOut,
    );
  };

  if (loading && rows.length === 0)
    return <Loading position="inline-centered" />;
  if (error) return <WidgetError message={error} onRetry={retry} />;
  if (!loading && rows.length === 0) {
    return (
      <WithQuery
        query={query}
        language={language}
        datasource={datasource}
        rows={rows}
        title={text(props?.label) || undefined}
      >
        <Empty description={t('No data')} />
      </WithQuery>
    );
  }

  return (
    <WithQuery
      query={query}
      language={language}
      datasource={datasource}
      rows={rows}
      title={text(props?.label) || undefined}
    >
      <Container refreshing={loading}>
        <table>
          <thead>
            <tr>
              {(rowFields.length ? rowFields : [t('Dimension')]).map(
                (fieldLabel, idx) => {
                  const target: SortTarget = { kind: 'rowField', index: idx };
                  return (
                    <th
                      key={fieldLabel}
                      className={
                        freezeRowFields && idx === 0
                          ? 'sticky-row-col'
                          : undefined
                      }
                      onClick={() => toggleSort(target)}
                    >
                      {fieldLabel}
                      {sortIndicator(target)}
                    </th>
                  );
                },
              )}
              {pivot.colKeys.map(cKey => {
                const target: SortTarget = { kind: 'col', key: cKey };
                return (
                  <th
                    key={cKey}
                    className="num"
                    onClick={() => toggleSort(target)}
                  >
                    {cKey}
                    {sortIndicator(target)}
                  </th>
                );
              })}
              {showRowTotals && (
                <th
                  className="num"
                  onClick={() => toggleSort({ kind: 'total' })}
                >
                  {t('Total')}
                  {sortIndicator({ kind: 'total' })}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {sortedRowKeys.map((rKey, rIdx) => {
              const rowMap = pivot.cells.get(rKey);
              const parts = pivot.rowPartsMap.get(rKey) ?? [rKey];
              return (
                <tr key={rKey}>
                  {parts.map((part, cIdx) => {
                    const span = rowSpans[rIdx]?.[cIdx] ?? 1;
                    if (span === 0) return null;
                    const fieldName = rowFields[cIdx];
                    const isFilterable =
                      crossFilterEnabled && Boolean(fieldName);
                    const isActive =
                      isFilterable &&
                      activeCrossKey === `row:${fieldName}:${part}`;
                    const cellClasses: string[] = [];
                    if (freezeRowFields && cIdx === 0) {
                      cellClasses.push('sticky-row-col');
                    }
                    if (isFilterable) cellClasses.push('cross-filterable');
                    if (isActive) cellClasses.push('cross-filter-active');
                    const cellClass =
                      cellClasses.length > 0
                        ? cellClasses.join(' ')
                        : undefined;
                    return (
                      <td
                        key={`${cIdx}-${part}`}
                        rowSpan={span > 1 ? span : undefined}
                        className={cellClass}
                        onClick={
                          isFilterable
                            ? () => handleRowCellClick(fieldName, part)
                            : undefined
                        }
                      >
                        {part}
                      </td>
                    );
                  })}
                  {pivot.colKeys.map(cKey => {
                    const cellVal = rowMap?.get(cKey);
                    const cellStyle =
                      cellVal !== undefined
                        ? evaluateConditionalStyle(
                            cellVal,
                            rules,
                            'pivot',
                            pivot.bounds,
                            theme,
                          )
                        : undefined;
                    const cellFilterable =
                      crossFilterEnabled &&
                      cellVal !== undefined &&
                      (rowFields.length > 0 || colFields.length > 0);
                    const cellActive =
                      cellFilterable &&
                      activeCrossKey === `cell:${rKey}:${cKey}`;
                    const cellClasses = ['num'];
                    if (cellFilterable) cellClasses.push('cross-filterable');
                    if (cellActive) cellClasses.push('cross-filter-active');
                    return (
                      <td
                        key={cKey}
                        className={cellClasses.join(' ')}
                        style={cellStyle}
                        onClick={
                          cellFilterable
                            ? () => handleDataCellClick(rKey, cKey)
                            : undefined
                        }
                      >
                        {formatNum(cellVal, cellDenom(rKey, cKey))}
                      </td>
                    );
                  })}
                  {showRowTotals && (
                    <td className="num total-col">
                      {formatNum(
                        pivot.rowTotals.get(rKey),
                        displayMode === 'row_percent'
                          ? pivot.rowTotals.get(rKey)
                          : pivot.grandTotal,
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {showColTotals && (
              <tr className="total-row">
                <td
                  colSpan={Math.max(1, rowFields.length)}
                  className={freezeRowFields ? 'sticky-row-col' : undefined}
                >
                  {t('Total')}
                </td>
                {pivot.colKeys.map(cKey => (
                  <td key={cKey} className="num">
                    {formatNum(
                      pivot.colTotals.get(cKey),
                      displayMode === 'col_percent'
                        ? pivot.colTotals.get(cKey)
                        : pivot.grandTotal,
                    )}
                  </td>
                ))}
                {showRowTotals && (
                  <td className="num total-col">
                    {formatNum(pivot.grandTotal, pivot.grandTotal)}
                  </td>
                )}
              </tr>
            )}
          </tbody>
        </table>
      </Container>
    </WithQuery>
  );
}
