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
import { ColCell, CornerCell, renderText, getTextPosition } from '@antv/s2';
import type { S2DataConfig, S2Options } from '@antv/s2';

function wrapText(
  text: string,
  maxWidth: number,
  maxLines: number,
  fontParam: any,
  measureTextWidth: (t: string, font: any) => number,
): string {
  if (!text) return '';
  const parts = text.split('\n');
  const allLines: string[] = [];

  for (const part of parts) {
    const words = part.split(' ');
    let currentLine = '';
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (measureTextWidth(testLine, fontParam) <= maxWidth) {
        currentLine = testLine;
      } else {
        const wordWidth = measureTextWidth(word, fontParam);
        if (wordWidth > maxWidth) {
          for (let j = 0; j < word.length; j++) {
            const char = word[j];
            const testCharLine = currentLine ? `${currentLine}${char}` : char;
            if (measureTextWidth(testCharLine, fontParam) <= maxWidth) {
              currentLine = testCharLine;
            } else {
              if (currentLine) allLines.push(currentLine);
              currentLine = char;
            }
          }
        } else {
          if (currentLine) allLines.push(currentLine);
          currentLine = word;
        }
      }
    }
    if (currentLine) {
      allLines.push(currentLine);
    }
  }

  if (allLines.length > maxLines) {
    const truncatedLines = allLines.slice(0, maxLines);
    let lastLine = truncatedLines[maxLines - 1];
    const ellipsis = '...';
    while (lastLine.length > 0 && measureTextWidth(lastLine + ellipsis, fontParam) > maxWidth) {
      lastLine = lastLine.slice(0, -1);
    }
    truncatedLines[maxLines - 1] = lastLine + ellipsis;
    return truncatedLines.join('\n');
  }

  return allLines.join('\n');
}

class WrappedColCell extends ColCell {
  protected drawTextShape() {
    const textStyle = { ...this.getTextStyle(), textBaseline: 'middle' as const };
    const cellWidth = this.meta.width;
    const padding = 8;
    const maxTextWidth = cellWidth - padding * 2 - this.getActionIconsWidth();
    const rawText = this.meta.label || this.meta.value || '';

    const text = wrapText(
      rawText,
      maxTextWidth,
      4,
      textStyle,
      this.spreadsheet.measureTextWidth,
    );

    this.actualText = text;
    this.actualTextWidth = Math.min(
      this.spreadsheet.measureTextWidth(text, textStyle),
      maxTextWidth,
    );

    const position = this.getTextPosition();

    // @ts-ignore
    this.textShape = renderText(
      this,
      this.textShapes,
      position.x,
      position.y,
      text,
      textStyle,
    );
    this.textShapes = [this.textShape];
  }
}

class WrappedCornerCell extends CornerCell {
  protected drawTextShape() {
    const x = this.getContentArea().x;
    const { y, height } = this.getCellArea();
    const textStyle = { ...this.getTextStyle(), textBaseline: 'middle' as const };
    const cornerText = this.getCornerText();
    const maxWidth = this.getMaxTextWidth();

    const text = wrapText(
      cornerText,
      maxWidth,
      4,
      textStyle,
      this.spreadsheet.measureTextWidth,
    );

    this.actualText = text;
    this.actualTextWidth = Math.min(
      this.spreadsheet.measureTextWidth(text, textStyle),
      maxWidth,
    );

    const position = getTextPosition(
      {
        x: x + this.getTreeIconWidth(),
        y,
        width: maxWidth,
        height,
      },
      textStyle,
    );

    // @ts-ignore
    this.textShape = renderText(
      this,
      this.textShapes,
      position.x,
      position.y,
      text,
      textStyle,
    );
    this.textShapes = [this.textShape];
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

  const frontendAggregation = formData.frontendAggregation ?? true;
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

  const columnHeaderHeight = formData.columnHeaderHeight !== undefined ? Number(formData.columnHeaderHeight) || 48 : 48;
  const rowCellHeight = formData.rowCellHeight !== undefined ? Number(formData.rowCellHeight) || 36 : 36;
  const defaultColumnWidth = formData.defaultColumnWidth ? Number(formData.defaultColumnWidth) || undefined : undefined;

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
  const calcTotalsObj = frontendAggregation ? { calcFunc } : undefined;

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
        height: columnHeaderHeight,
        width: defaultColumnWidth,
      },
      cellCfg: {
        height: rowCellHeight,
      },
    },
    showDefaultHeaderActionIcon: true,
    tooltip: { showTooltip: false },
    colCell: (node: any, spreadsheet: any, headerConfig: any) =>
      new WrappedColCell(node, spreadsheet, headerConfig),
    cornerCell: (node: any, spreadsheet: any, headerConfig: any) =>
      new WrappedCornerCell(node, spreadsheet, headerConfig),
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
