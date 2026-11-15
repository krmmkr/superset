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
import {
  Button,
  Empty,
  Input,
  Loading,
  Table,
  TableSize,
  Typography,
} from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import {
  ColumnFormatDef,
  computeColumnBounds,
  ConditionalFormatRule,
  evaluateConditionalStyle,
  formatCellValue,
} from './conditionalFormatting';
import { useWidgetRows } from './useWidgetRows';
import WithQuery from './WithQuery';

type Props = canvasApi.CanvasWidgetProps;

type TileAlign = 'left' | 'center' | 'right';

const ALIGN_ITEMS: Record<TileAlign, string> = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end',
};

const Tile = styled.div<{
  $refreshing?: boolean;
  $align?: TileAlign;
  $accentColor?: string;
}>`
  ${({ theme, $refreshing, $align = 'left', $accentColor }) => css`
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: ${ALIGN_ITEMS[$align]};
    text-align: ${$align};
    gap: ${theme.sizeUnit}px;
    opacity: ${$refreshing ? 0.55 : 1};
    transition: opacity 0.15s ease;
    ${
      $accentColor
        ? css`
            border-left: 3px solid ${$accentColor};
            padding-left: ${theme.sizeUnit * 2.5}px;
          `
        : ''
    }
  `}
`;

const BigNumber = styled.div`
  ${({ theme }) => css`
    color: ${theme.colorTextHeading};
    font-size: ${theme.fontSizeHeading1}px;
    font-weight: ${theme.fontWeightStrong};
    line-height: 1.1;
  `}
`;

const text = (value: unknown): string =>
  typeof value === 'string' ? value : '';

function resolveParam(
  customizations: canvasApi.CanvasWidgetProps['customizations'],
  name: string,
): string | number | undefined {
  if (!name || !Array.isArray(customizations)) return undefined;
  for (const item of customizations) {
    const val = item?.value as { name?: unknown; value?: unknown } | undefined;
    if (
      val &&
      val.name === name &&
      (typeof val.value === 'number' || typeof val.value === 'string')
    ) {
      return val.value;
    }
  }
  return undefined;
}

const ErrorBox = styled.div`
  ${({ theme }) => css`
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: ${theme.sizeUnit * 2}px;
  `}
`;

export function WidgetError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <ErrorBox>
      <Typography.Text type="danger">{message}</Typography.Text>
      <Button
        size="small"
        icon={<Icons.ReloadOutlined iconSize="s" />}
        onClick={onRetry}
      >
        {t('Retry')}
      </Button>
    </ErrorBox>
  );
}

const DeltaRow = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit}px;
    font-size: ${theme.fontSizeSM}px;
  `}
`;

const SparklineSvg = styled.svg`
  ${({ theme }) => css`
    width: 100%;
    max-width: ${theme.sizeUnit * 35}px;
    height: ${theme.sizeUnit * 7}px;
    margin-top: ${theme.sizeUnit}px;
    overflow: visible;
  `}
`;

const ProgressTrack = styled.div`
  ${({ theme }) => css`
    width: 100%;
    max-width: ${theme.sizeUnit * 45}px;
    height: ${theme.sizeUnit * 1.5}px;
    border-radius: ${theme.borderRadiusSM}px;
    background: ${theme.colorFillSecondary};
    overflow: hidden;
    margin-top: ${theme.sizeUnit * 0.5}px;
  `}
`;

const ProgressFill = styled.div<{ $pct: number; $color?: string }>`
  ${({ theme, $pct, $color }) => css`
    width: ${$pct}%;
    height: 100%;
    border-radius: ${theme.borderRadiusSM}px;
    background: ${$color || theme.colorPrimary};
    transition: width 0.2s ease;
  `}
`;

function Sparkline({
  series,
  area = false,
  color,
}: {
  series: number[];
  area?: boolean;
  color?: string;
}) {
  const theme = useTheme();
  if (series.length < 2) return null;
  const strokeColor = color || theme.colorPrimary;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const coords = series.map((val, idx) => {
    const x = (idx / (series.length - 1)) * 120;
    const y = 26 - ((val - min) / span) * 24;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const points = coords.join(' ');
  const areaPoints = `0.0,28.0 ${points} 120.0,28.0`;
  return (
    <SparklineSvg viewBox="0 0 120 28" aria-hidden="true">
      {area && (
        <polygon fill={strokeColor} fillOpacity={0.14} points={areaPoints} />
      )}
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </SparklineSvg>
  );
}

const COMPACT_UNITS: Array<[number, string]> = [
  [1e12, 'T'],
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'K'],
];

function formatMetricNumber(
  num: number,
  decimals: number,
  abbreviate: boolean,
  prefix: string,
  suffix: string,
): string {
  if (abbreviate) {
    const abs = Math.abs(num);
    for (const [threshold, unit] of COMPACT_UNITS) {
      if (abs >= threshold) {
        const compactDecimals = decimals > 0 ? decimals : 1;
        const scaled = (num / threshold).toFixed(compactDecimals);
        return `${prefix}${scaled}${unit}${suffix}`;
      }
    }
  }
  const formatted = num.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${prefix}${formatted}${suffix}`;
}

function deltaTone(pct: number, invert: boolean): 'success' | 'danger' {
  const positive = invert ? pct <= 0 : pct >= 0;
  return positive ? 'success' : 'danger';
}

/** The first row's value of the tile's metric, as a big number. */
export function MetricTileRenderer(widget: Props) {
  const { props, filters, refreshKey } = widget;
  const { rows, loading, error, query, language, datasource, retry } =
    useWidgetRows(widget, filters, refreshKey);
  if (loading && rows.length === 0)
    return <Loading position="inline-centered" />;
  if (error) return <WidgetError message={error} onRetry={retry} />;
  const row = rows[0] ?? {};
  const binding = props?.dataBinding as
    | { metrics?: unknown[]; dimensions?: unknown[] }
    | undefined;
  const firstMetric = binding?.metrics?.[0];
  const metricLabel =
    typeof firstMetric === 'string'
      ? firstMetric
      : firstMetric &&
          typeof firstMetric === 'object' &&
          'label' in firstMetric &&
          typeof (firstMetric as { label?: unknown }).label === 'string'
        ? (firstMetric as { label: string }).label
        : undefined;
  const dimensionSet = new Set(
    (binding?.dimensions ?? []).filter(
      (d): d is string => typeof d === 'string',
    ),
  );
  const column =
    (metricLabel && typeof row[metricLabel] === 'number'
      ? metricLabel
      : undefined) ??
    Object.keys(row).find(
      key => !dimensionSet.has(key) && typeof row[key] === 'number',
    ) ??
    Object.keys(row).find(key => typeof row[key] === 'number');
  const value = column ? (row[column] as number) : undefined;
  const decimals = typeof props?.decimals === 'number' ? props.decimals : 0;
  const series = column
    ? rows.map(r => r[column]).filter((v): v is number => typeof v === 'number')
    : [];
  const prevValue = series.length >= 2 ? series[1] : undefined;
  const showDelta =
    Boolean(props?.showDelta) &&
    value !== undefined &&
    prevValue !== undefined &&
    prevValue !== 0;
  const deltaPct = showDelta
    ? ((value! - prevValue!) / Math.abs(prevValue!)) * 100
    : undefined;
  const abbreviate = Boolean(props?.abbreviate);
  const invertDelta = Boolean(props?.invertDelta);
  const showProgress = Boolean(props?.showProgress);
  const sparklineArea = Boolean(props?.sparklineArea);
  const accentColor = text(props?.accentColor);
  const alignProp = props?.align;
  const align: TileAlign =
    alignProp === 'center' || alignProp === 'right' ? alignProp : 'left';
  const prefix = text(props?.prefix);
  const suffix = text(props?.suffix);

  const targetParamName = text(props?.targetParam);
  const rawTarget = resolveParam(widget.customizations, targetParamName);
  const paramTargetNum =
    rawTarget !== undefined ? Number(rawTarget) : Number.NaN;
  const staticTargetNum =
    typeof props?.target === 'number' ? props.target : Number.NaN;
  const targetNum = Number.isFinite(paramTargetNum)
    ? paramTargetNum
    : staticTargetNum;
  const hasTarget =
    value !== undefined && Number.isFinite(targetNum) && targetNum !== 0;
  const targetDeltaPct = hasTarget
    ? ((value! - targetNum) / Math.abs(targetNum)) * 100
    : undefined;
  const progressPct = hasTarget
    ? Math.max(0, Math.min(100, (value! / targetNum) * 100))
    : undefined;
  const comparisonLabel = text(props?.comparisonLabel);
  const showSparkline = Boolean(props?.showSparkline) && series.length >= 2;
  const label = text(props?.label) || column;
  return (
    <WithQuery
      query={query}
      language={language}
      datasource={datasource}
      rows={rows}
      title={label}
    >
      <Tile $refreshing={loading} $align={align} $accentColor={accentColor}>
        <BigNumber>
          {value === undefined
            ? '–'
            : formatMetricNumber(value, decimals, abbreviate, prefix, suffix)}
        </BigNumber>
        <Typography.Text type="secondary">{label}</Typography.Text>
        {deltaPct !== undefined && (
          <DeltaRow>
            <Typography.Text type={deltaTone(deltaPct, invertDelta)} strong>
              {deltaPct >= 0
                ? `+${deltaPct.toFixed(1)}%`
                : `${deltaPct.toFixed(1)}%`}
            </Typography.Text>
            {comparisonLabel && (
              <Typography.Text type="secondary">
                {comparisonLabel}
              </Typography.Text>
            )}
          </DeltaRow>
        )}
        {targetDeltaPct !== undefined && (
          <DeltaRow>
            <Typography.Text
              type={deltaTone(targetDeltaPct, invertDelta)}
              strong
            >
              {targetDeltaPct >= 0
                ? `+${targetDeltaPct.toFixed(1)}%`
                : `${targetDeltaPct.toFixed(1)}%`}
            </Typography.Text>
            <Typography.Text type="secondary">
              {t(
                'vs target (%s)',
                formatMetricNumber(
                  targetNum,
                  decimals,
                  abbreviate,
                  prefix,
                  suffix,
                ),
              )}
            </Typography.Text>
          </DeltaRow>
        )}
        {showProgress && progressPct !== undefined && (
          <ProgressTrack
            role="progressbar"
            aria-valuenow={Math.round(progressPct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('Target progress')}
          >
            <ProgressFill
              $pct={progressPct}
              $color={accentColor || undefined}
            />
          </ProgressTrack>
        )}
        {showSparkline && (
          <Sparkline
            series={[...series].reverse()}
            area={sparklineArea}
            color={accentColor || undefined}
          />
        )}
      </Tile>
    </WithQuery>
  );
}

function compareCellValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const numA = Number(a);
  const numB = Number(b);
  if (
    typeof a !== 'boolean' &&
    typeof b !== 'boolean' &&
    a !== '' &&
    b !== '' &&
    Number.isFinite(numA) &&
    Number.isFinite(numB)
  ) {
    return numA - numB;
  }
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

const StyledTableWrap = styled.div<{
  $headerBgColor?: string;
  $headerTextColor?: string;
  $striped?: boolean;
  $density?: 'compact' | 'normal' | 'comfortable';
  $wrapText?: boolean;
  $crossFilter?: boolean;
}>`
  ${({
    theme,
    $headerBgColor,
    $headerTextColor,
    $striped,
    $density,
    $wrapText,
    $crossFilter,
  }) => css`
    ${
      ($headerBgColor || $headerTextColor) &&
      css`
        && .ant-table-thead > tr > th,
        && .ant-table-thead > tr > td {
          ${$headerBgColor ? `background: ${$headerBgColor};` : ''}
          ${$headerTextColor ? `color: ${$headerTextColor};` : ''}
        }
      `
    }
    ${
      $striped &&
      css`
        && .ant-table-tbody > tr:nth-of-type(even) > td {
          background: ${theme.colorFillAlter};
        }
      `
    }
    ${
      $density === 'comfortable' &&
      css`
        && .ant-table-tbody > tr > td {
          padding-top: ${theme.sizeUnit * 3.5}px;
          padding-bottom: ${theme.sizeUnit * 3.5}px;
        }
      `
    }
    ${
      $wrapText &&
      css`
        && .ant-table-cell {
          white-space: normal;
          word-break: break-word;
        }
      `
    }
    ${
      $crossFilter &&
      css`
        && .ant-table-tbody > tr {
          cursor: pointer;
        }
        && .ant-table-tbody > tr.canvas-row-cross-active > td {
          background: ${theme.colorPrimaryBg};
          font-weight: ${theme.fontWeightStrong};
        }
      `
    }
  `}
`;

const TableSearchWrap = styled.div`
  ${({ theme }) => css`
    margin-bottom: ${theme.sizeUnit * 2}px;
  `}
`;

const ConditionalCell = styled.span`
  ${({ theme }) => css`
    display: inline-block;
    padding: ${theme.sizeUnit * 0.5}px ${theme.sizeUnit * 1.5}px;
    border-radius: ${theme.borderRadiusSM}px;
  `}
`;

/** The query's rows as a table; `columnDefs` picks and names the columns. */
export function TableRenderer(widget: Props) {
  const { props, filters, crossFilters, refreshKey, setCrossFilter } = widget;
  const theme = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCrossVal, setActiveCrossVal] = useState<string | null>(null);
  const effectiveFilters = useMemo(
    () => [...filters, ...(crossFilters ?? [])],
    [filters, crossFilters],
  );
  const { rows, loading, error, query, language, datasource, retry } =
    useWidgetRows(widget, effectiveFilters, refreshKey);
  const defs = (props?.columnDefs ?? []) as ColumnFormatDef[];
  const baseRules = Array.isArray(props?.conditionalFormatting)
    ? (props.conditionalFormatting as ConditionalFormatRule[])
    : [];
  const thresholdParamName = text(props?.thresholdParam);
  const rawThreshold = resolveParam(widget.customizations, thresholdParamName);
  const thresholdNum =
    rawThreshold !== undefined ? Number(rawThreshold) : Number.NaN;
  const sortable = props?.sortable !== false;
  const columns = useMemo(() => {
    const fields = defs.length
      ? defs.filter(def => def.field)
      : Object.keys(rows[0] ?? {}).map(field => ({ field }) as ColumnFormatDef);
    const firstNumCol = fields.find(
      f => f.field && typeof rows[0]?.[f.field] === 'number',
    )?.field;
    const rules: ConditionalFormatRule[] =
      Number.isFinite(thresholdNum) && firstNumCol
        ? [
            {
              column: firstNumCol,
              operator: 'gte',
              value: thresholdNum,
              tone: 'success',
            },
            {
              column: firstNumCol,
              operator: 'lt',
              value: thresholdNum,
              tone: 'warning',
            },
            ...baseRules,
          ]
        : baseRules;
    const bounds = computeColumnBounds(
      rows,
      fields.map(f => f.field as string),
    );
    return fields.map(def => {
      const col = def.field as string;
      return {
        key: col,
        dataIndex: col,
        title: def.headerName || col,
        ...(sortable
          ? {
              sorter: (
                a: Record<string, unknown>,
                b: Record<string, unknown>,
              ) => compareCellValues(a[col], b[col]),
            }
          : {}),
        render: (value: unknown) => {
          const textVal = formatCellValue(value, def);
          const style = evaluateConditionalStyle(
            value,
            rules,
            col,
            bounds,
            theme,
          );
          return style ? (
            <ConditionalCell style={style}>{textVal}</ConditionalCell>
          ) : (
            textVal
          );
        },
      };
    });
  }, [defs, rows, baseRules, thresholdNum, theme, sortable]);
  const searchable = Boolean(props?.searchable);
  const visibleRows = useMemo(() => {
    const trimmed = searchTerm.trim().toLowerCase();
    if (!searchable || !trimmed) return rows;
    return rows.filter(row =>
      columns.some(col => {
        const val = row[col.key];
        return (
          val !== null &&
          val !== undefined &&
          String(val).toLowerCase().includes(trimmed)
        );
      }),
    );
  }, [rows, columns, searchable, searchTerm]);
  if (error) return <WidgetError message={error} onRetry={retry} />;
  if (!loading && rows.length === 0) {
    return (
      <WithQuery query={query} language={language} datasource={datasource}>
        <Empty description={t('No data')} />
      </WithQuery>
    );
  }
  const pageSize =
    typeof props?.pageSize === 'number' && props.pageSize >= 0
      ? props.pageSize
      : 10;
  const headerBgColor = text(props?.headerBgColor);
  const headerTextColor = text(props?.headerTextColor);
  const striped = Boolean(props?.striped);
  const wrapText = Boolean(props?.wrapText);
  const density =
    props?.density === 'normal' || props?.density === 'comfortable'
      ? props.density
      : 'compact';
  const crossFilterEnabled = Boolean(props?.crossFilter);
  const binding = props?.dataBinding as
    | { datasetId?: unknown; dimensions?: unknown[] }
    | undefined;
  const firstDim =
    (Array.isArray(binding?.dimensions) &&
    typeof binding.dimensions[0] === 'string'
      ? binding.dimensions[0]
      : undefined) || (columns[0]?.key as string | undefined);
  const datasetId = binding?.datasetId;

  const handleRowClick = (record: Record<string, unknown>) => {
    if (!crossFilterEnabled || !firstDim || !setCrossFilter) return;
    const rawVal = record[firstDim];
    if (rawVal === null || rawVal === undefined) return;
    const val = String(rawVal);
    if (activeCrossVal === val) {
      setActiveCrossVal(null);
      setCrossFilter(undefined);
    } else {
      setActiveCrossVal(val);
      setCrossFilter({
        ...(typeof datasetId === 'number' ? { datasetId } : {}),
        column: firstDim,
        values: [val],
      });
    }
  };

  return (
    <WithQuery
      query={query}
      language={language}
      datasource={datasource}
      rows={rows}
      title={text(props?.label) || undefined}
    >
      {searchable && (
        <TableSearchWrap>
          <Input.Search
            allowClear
            size="small"
            placeholder={t('Search rows...')}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </TableSearchWrap>
      )}
      <StyledTableWrap
        $headerBgColor={headerBgColor || undefined}
        $headerTextColor={headerTextColor || undefined}
        $striped={striped}
        $density={density}
        $wrapText={wrapText}
        $crossFilter={crossFilterEnabled}
        data-striped={striped ? 'true' : undefined}
      >
        <Table
          data={visibleRows.map((row, index) => ({ key: index, ...row }))}
          columns={columns}
          loading={loading}
          size={density === 'compact' ? TableSize.Small : TableSize.Middle}
          usePagination={pageSize > 0}
          defaultPageSize={pageSize > 0 ? pageSize : undefined}
          sticky
          onRow={
            crossFilterEnabled
              ? (record: Record<string, unknown>) => ({
                  onClick: () => handleRowClick(record),
                  className:
                    firstDim &&
                    activeCrossVal !== null &&
                    String(record[firstDim] ?? '') === activeCrossVal
                      ? 'canvas-row-cross-active'
                      : undefined,
                })
              : undefined
          }
        />
      </StyledTableWrap>
    </WithQuery>
  );
}
