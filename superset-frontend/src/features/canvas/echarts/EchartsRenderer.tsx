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

import { useEffect, useMemo, useRef, useState } from 'react';
import type { canvas as canvasApi } from '@apache-superset/core';
import { t } from '@apache-superset/core/translation';
import { css, styled, useTheme } from '@apache-superset/core/theme';
import {
  getCategoricalSchemeRegistry,
  getClientErrorObject,
} from '@superset-ui/core';
import { Typography } from '@superset-ui/core/components';
import { applyStructuredChrome, EchartsChromeValue } from './chrome';
import { useWidgetRows } from '../useWidgetRows';
import WithQuery from '../WithQuery';
import { resolveOption } from './resolveBindings';
import {
  applyRowDrivenChart,
  applyStructuredSeries,
  StructuredProps,
} from './structuredSeries';
import { themedOption, withLabelColors } from './themedOption';

const Container = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
`;

const DrillBar = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: ${theme.sizeUnit}px;
    padding: 0 0 ${theme.sizeUnit}px;
    font-size: ${theme.fontSizeSM}px;
    flex-shrink: 0;
  `}
`;

const ChartViewport = styled.div<{ $fit?: boolean }>`
  ${({ $fit }) => css`
    width: 100%;
    flex: 1;
    min-height: 0;
    overflow: ${$fit ? 'hidden' : 'auto'};
  `}
`;

const Chart = styled.div<{
  $minWidth?: number;
  $minHeight?: number;
  $fit?: boolean;
}>`
  ${({ $minWidth, $minHeight, $fit }) => css`
    width: 100%;
    height: 100%;
    min-width: ${$fit ? '0' : $minWidth ? `${$minWidth}px` : '0'};
    min-height: ${$fit ? '0' : $minHeight ? `${$minHeight}px` : '120px'};
  `}
`;

function calendarScrollDimensions(option: Record<string, unknown>): {
  minWidth?: number;
  minHeight?: number;
} {
  const cal = option.calendar;
  if (!cal) return {};
  const list = Array.isArray(cal) ? cal : [cal];
  let maxW = 0;
  let totalH = 0;
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const { cellSize } = entry as { cellSize?: unknown };
    let cw = 0;
    let ch = 0;
    if (typeof cellSize === 'number') {
      cw = cellSize;
      ch = cellSize;
    } else if (Array.isArray(cellSize)) {
      if (typeof cellSize[0] === 'number') cw = cellSize[0];
      if (typeof cellSize[1] === 'number') ch = cellSize[1];
    }
    if (cw > 0) maxW = Math.max(maxW, cw * 54 + 80);
    if (ch > 0) totalH += ch * 7 + 70;
  }
  return {
    minWidth: maxW > 0 ? maxW : undefined,
    minHeight: totalH > 0 ? totalH : undefined,
  };
}

const Message = styled.div`
  ${({ theme }) => css`
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: ${theme.sizeUnit * 2}px;
    color: ${theme.colorTextSecondary};
    text-align: center;
  `}
`;

const describe = async (error: unknown): Promise<string> => {
  if (error instanceof Error) return error.message;
  const { error: message } = await getClientErrorObject(
    error as Parameters<typeof getClientErrorObject>[0],
  );
  return message ?? t('Unknown error');
};

const dimLabel = (item: unknown): string | undefined => {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object' && 'label' in item) {
    const { label } = item as { label?: unknown };
    return typeof label === 'string' ? label : undefined;
  }
  return undefined;
};

function resolveNumericParam(
  customizations: canvasApi.CanvasWidgetProps['customizations'],
  name: string | undefined,
): number | undefined {
  if (!name || !Array.isArray(customizations)) return undefined;
  for (const item of customizations) {
    const val = item?.value as { name?: unknown; value?: unknown } | undefined;
    if (
      val &&
      val.name === name &&
      val.value !== undefined &&
      val.value !== ''
    ) {
      const num = Number(val.value);
      if (Number.isFinite(num)) return num;
    }
  }
  return undefined;
}

function resolveStringParam(
  customizations: canvasApi.CanvasWidgetProps['customizations'],
  name: string | undefined,
): string | undefined {
  if (!name || !Array.isArray(customizations)) return undefined;
  for (const item of customizations) {
    const val = item?.value as { name?: unknown; value?: unknown } | undefined;
    if (
      val &&
      val.name === name &&
      typeof val.value === 'string' &&
      val.value.trim() !== ''
    ) {
      return val.value.trim();
    }
  }
  return undefined;
}

function collectTemplateParams(
  customizations: canvasApi.CanvasWidgetProps['customizations'],
): Record<string, unknown> | undefined {
  if (!Array.isArray(customizations) || customizations.length === 0) {
    return undefined;
  }
  const params: Record<string, unknown> = {};
  for (const item of customizations) {
    const val = item?.value as { name?: unknown; value?: unknown } | undefined;
    if (
      val &&
      typeof val.name === 'string' &&
      val.name.trim() !== '' &&
      val.value !== undefined
    ) {
      params[val.name.trim()] = val.value;
    }
  }
  return Object.keys(params).length > 0 ? params : undefined;
}

function rebindDimensionAlias(
  value: unknown,
  fromAlias: string,
  toAlias: string,
): unknown {
  if (fromAlias === toAlias || !fromAlias || !toAlias) return value;
  if (Array.isArray(value)) {
    return value.map(item => rebindDimensionAlias(item, fromAlias, toAlias));
  }
  if (typeof value !== 'object' || value === null) return value;
  const record = value as Record<string, unknown>;
  if (
    '$bind' in record &&
    typeof record.$bind === 'object' &&
    record.$bind !== null
  ) {
    const bind = record.$bind as Record<string, unknown>;
    if (bind.source === 'dimension' && bind.alias === fromAlias) {
      return { ...record, $bind: { ...bind, alias: toAlias } };
    }
  }
  return Object.fromEntries(
    Object.entries(record).map(([k, v]) => [
      k,
      rebindDimensionAlias(v, fromAlias, toAlias),
    ]),
  );
}

/**
 * Renders the `echarts` widget: any ECharts option, with `$bind` markers
 * filled from the widget's query and styled by the Superset theme and the
 * canvas's color scheme. ECharts is loaded on first use.
 */
export default function EchartsRenderer(widget: canvasApi.CanvasWidgetProps) {
  const {
    props,
    refreshKey,
    colors,
    filters,
    crossFilters,
    customizations,
    setCrossFilter,
    title,
  } = widget;
  const theme = useTheme();
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string>();
  const [drillPath, setDrillPath] = useState<
    { column: string; value: string }[]
  >([]);
  const activeCrossRef = useRef<string | undefined>(undefined);

  const chrome = props?.chrome as EchartsChromeValue | undefined;
  const paramTimeGrain = resolveStringParam(
    customizations,
    chrome?.timeGrainParam,
  );
  const paramDimension = resolveStringParam(
    customizations,
    chrome?.dimensionParam,
  );
  const templateParams = useMemo(
    () => collectTemplateParams(customizations),
    [customizations],
  );

  const binding = props?.dataBinding as
    | { datasetId?: number; metrics?: unknown[]; dimensions?: unknown[] }
    | undefined;
  const dimensions = useMemo(
    () =>
      (binding?.dimensions ?? [])
        .map(dimLabel)
        .filter((d): d is string => Boolean(d)),
    [binding?.dimensions],
  );
  const drillEnabled = Boolean(props?.drillDown) && dimensions.length > 1;
  const activeDimIndex = drillEnabled
    ? Math.min(drillPath.length, dimensions.length - 1)
    : 0;
  const activeDim =
    (!drillEnabled || drillPath.length === 0) && paramDimension
      ? paramDimension
      : dimensions[activeDimIndex];

  const effectiveProps = useMemo(() => {
    if (drillEnabled && drillPath.length > 0 && activeDim) {
      return {
        ...(props as StructuredProps),
        dataBinding: {
          ...binding,
          dimensions: [activeDim],
        },
      };
    }
    if (paramDimension) {
      return {
        ...(props as StructuredProps),
        dataBinding: {
          ...binding,
          dimensions: [paramDimension, ...(binding?.dimensions ?? []).slice(1)],
        },
      };
    }
    return props as StructuredProps | undefined;
  }, [
    drillEnabled,
    drillPath.length,
    activeDim,
    paramDimension,
    props,
    binding,
  ]);

  const drillFilters = useMemo(
    () =>
      drillPath.map(step => ({
        column: step.column,
        operator: 'in' as const,
        value: [step.value],
      })),
    [drillPath],
  );
  const allFilters = useMemo(
    () => [...filters, ...crossFilters, ...drillFilters],
    [filters, crossFilters, drillFilters],
  );

  const queryOverrides = useMemo(
    () =>
      paramTimeGrain || paramDimension || templateParams
        ? {
            timeGrain: paramTimeGrain,
            dimension: paramDimension,
            templateParams,
          }
        : undefined,
    [paramTimeGrain, paramDimension, templateParams],
  );
  const data = useWidgetRows(widget, allFilters, refreshKey, queryOverrides);
  const rawOption = (props?.echartsOptions ?? {}) as Record<string, unknown>;
  const option = useMemo(() => {
    const baseDim = dimensions[0];
    if (baseDim && activeDim && baseDim !== activeDim) {
      return rebindDimensionAlias(rawOption, baseDim, activeDim) as Record<
        string,
        unknown
      >;
    }
    return rawOption;
  }, [rawOption, dimensions, activeDim]);

  useEffect(() => {
    if (activeCrossRef.current !== undefined) {
      activeCrossRef.current = undefined;
      setCrossFilter?.(undefined);
    }
    // Clear stale cross-filter when the active dimension changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDim]);
  const targetValue = resolveNumericParam(customizations, chrome?.targetParam);
  const optionKey = JSON.stringify([
    option,
    chrome ?? null,
    targetValue ?? null,
    props?.chartType ?? null,
    props?.customize ?? null,
    effectiveProps?.dataBinding ?? null,
    Boolean(title),
  ]);
  const { scheme } = colors;
  const labelColorsKey = JSON.stringify(colors.labelColors);

  useEffect(() => {
    if (data.loading || data.error) return undefined;
    let disposed = false;
    let chart: { dispose: () => void; resize: () => void } | undefined;
    let observer: ResizeObserver | undefined;
    (async () => {
      try {
        const echarts = await import('echarts');
        if (disposed || !container.current) return;
        const resolved = applyRowDrivenChart(
          resolveOption(applyStructuredSeries(option, effectiveProps), {
            rows: data.rows,
            theme: theme as unknown as Record<string, unknown>,
          }),
          effectiveProps,
          data.rows,
        );
        const palette =
          getCategoricalSchemeRegistry().get(scheme)?.colors ?? [];
        const chromed = applyStructuredChrome(resolved, chrome, targetValue);
        // The canvas titles the placement above the chart; drawing the
        // option's title as well would show it twice.
        const untitled = { ...chromed };
        delete untitled.title;
        const instance = echarts.init(container.current);
        instance.setOption(
          themedOption(
            withLabelColors(title ? untitled : chromed, colors.labelColors),
            theme,
            palette,
          ),
        );
        if (activeDim && (drillEnabled || props?.crossFilter)) {
          instance.on('click', (params: { name?: unknown }) => {
            const clicked =
              params?.name !== undefined && params?.name !== null
                ? String(params.name)
                : '';
            if (!clicked) return;
            if (drillEnabled && drillPath.length < dimensions.length - 1) {
              setDrillPath(prev => [
                ...prev,
                { column: activeDim, value: clicked },
              ]);
              return;
            }
            if (props?.crossFilter && setCrossFilter) {
              if (activeCrossRef.current === clicked) {
                activeCrossRef.current = undefined;
                setCrossFilter(undefined);
              } else {
                activeCrossRef.current = clicked;
                setCrossFilter({
                  ...(typeof binding?.datasetId === 'number'
                    ? { datasetId: binding.datasetId }
                    : {}),
                  column: activeDim,
                  values: [clicked],
                });
              }
            }
          });
        }
        chart = instance;
        let rafId: number | undefined;
        observer = new ResizeObserver(() => {
          if (rafId !== undefined) cancelAnimationFrame(rafId);
          rafId = requestAnimationFrame(() => {
            if (!disposed) instance.resize();
          });
        });
        observer.observe(container.current);
        setError(undefined);
      } catch (e) {
        if (!disposed) setError(await describe(e));
      }
    })();
    return () => {
      disposed = true;
      observer?.disconnect();
      chart?.dispose();
    };
    // Keys stand in for the objects, which are recreated on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, optionKey, theme, scheme, labelColorsKey]);

  const message = data.error ?? error;
  const fitMode =
    props?.fitMode === 'fit' || props?.fitMode === 'scroll'
      ? props.fitMode
      : 'auto';
  const scrollDims = fitMode === 'fit' ? {} : calendarScrollDimensions(option);
  const minHeight =
    fitMode === 'scroll' ? (scrollDims.minHeight ?? 240) : scrollDims.minHeight;
  return (
    <WithQuery
      query={data.query}
      language={data.language}
      datasource={data.datasource}
      rows={data.rows}
      title={title}
      renderMaximized={() => <EchartsRenderer {...widget} />}
    >
      {message ? (
        <Message>{t('This chart could not be drawn: %s', message)}</Message>
      ) : (
        /*
         * Opted out of the canvas's body drag. ECharts paints its own drag
         * targets -- a dataZoom slider, a brush, graph roam -- onto its
         * canvas, where they are pixels rather than elements, so the check
         * that keeps a press on a control from becoming a widget move has
         * nothing to match. Without this, dragging a zoom handle in a plan
         * also moves the widget and persists it on release.
         */
        <Container>
          {drillPath.length > 0 && (
            <DrillBar>
              <Typography.Link onClick={() => setDrillPath([])}>
                {t('All')}
              </Typography.Link>
              {drillPath.map((step, idx) => (
                <span key={`${step.column}-${step.value}`}>
                  {' / '}
                  {idx < drillPath.length - 1 ? (
                    <Typography.Link
                      onClick={() =>
                        setDrillPath(prev => prev.slice(0, idx + 1))
                      }
                    >
                      {step.value}
                    </Typography.Link>
                  ) : (
                    <Typography.Text strong>{step.value}</Typography.Text>
                  )}
                </span>
              ))}
            </DrillBar>
          )}
          <ChartViewport $fit={fitMode === 'fit'} data-fit-mode={fitMode}>
            <Chart
              ref={container}
              data-test="canvas-echarts"
              data-canvas-no-drag
              $fit={fitMode === 'fit'}
              $minWidth={scrollDims.minWidth}
              $minHeight={minHeight}
            />
          </ChartViewport>
        </Container>
      )}
    </WithQuery>
  );
}
