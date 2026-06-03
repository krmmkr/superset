/**
 * Licensed under the Apache License, Version 2.0
 * Superset Calendar Heatmap Plugin - ECharts Calendar React Component
 *
 * Renders the ECharts calendar heatmap and handles click events
 * to emit date-based crossfilters via setDataMask.
 */
import {
    useRef,
    useEffect,
    useCallback,
    useState,
    useLayoutEffect,
} from 'react';
import { init, use } from 'echarts/core';
import { HeatmapChart } from 'echarts/charts';
import { CalendarComponent } from 'echarts/components';
import {
    TooltipComponent,
    VisualMapComponent,
    VisualMapContinuousComponent,
    VisualMapPiecewiseComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { LabelLayout } from 'echarts/features';
import type { EChartsType } from 'echarts/core';
import type { DataMask } from '@superset-ui/core';
import { CalendarHeatmapTransformedProps } from './types';

// Register required ECharts components — including LabelLayout for labels
use([
    CanvasRenderer,
    HeatmapChart,
    CalendarComponent,
    TooltipComponent,
    VisualMapComponent,
    VisualMapContinuousComponent,
    VisualMapPiecewiseComponent,
    LabelLayout,
]);

// Simple counter to track renders
let renderCount = 0;

export default function EchartsCalendar(props: CalendarHeatmapTransformedProps) {
    const {
        width,
        height,
        echartWidth,
        echartHeight,
        echartOptions,
        setDataMask,
        selectedValues,
        emitCrossFilters,
        temporalColumn,
        crossfilterMode,
        refs,
    } = props;

    const divRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<EChartsType>();
    const [didMount, setDidMount] = useState(false);
    // Track options changes with a serialized hash for debugging


    // Expose refs if needed by parent
    if (refs) {
        refs.divRef = divRef as any;
    }

    // ──────────────────────────────────────────────
    // Resize handler
    // ──────────────────────────────────────────────
    const handleSizeChange = useCallback(
        ({ width: w, height: h }: { width: number; height: number }) => {
            if (chartRef.current) {
                chartRef.current.resize({ width: w, height: h });
            }
        },
        [],
    );

    // ──────────────────────────────────────────────
    // Initialize chart
    // ──────────────────────────────────────────────
    useEffect(() => {
        if (!divRef.current) return;
        if (!chartRef.current) {
            chartRef.current = init(divRef.current);
            console.log('[CalendarHeatmap] ECharts instance created');
        }
        handleSizeChange({ width: echartWidth, height: echartHeight });
        setDidMount(true);
    }, []); // init once

    // Dispose on unmount
    useEffect(() => () => {
        chartRef.current?.dispose();
        chartRef.current = undefined;
    }, []);

    // ──────────────────────────────────────────────
    // Apply options when they change
    // This is the CRITICAL effect — it must fire whenever
    // echartOptions changes (new reference from transformProps)
    // ──────────────────────────────────────────────
    useEffect(() => {
        if (!didMount || !chartRef.current) return;

        renderCount += 1;
        console.log(`[CalendarHeatmap] Applying setOption (render #${renderCount})`);

        try {
            // Use notMerge=true to completely replace options
            chartRef.current.setOption(echartOptions, {
                notMerge: true,
                lazyUpdate: false,
            });
            console.log('[CalendarHeatmap] setOption succeeded');
        } catch (e) {
            console.error('[CalendarHeatmap] setOption failed:', e);
        }
    }, [didMount, echartOptions]);

    // ──────────────────────────────────────────────
    // Resize on dimension changes
    // ──────────────────────────────────────────────
    useLayoutEffect(() => {
        handleSizeChange({ width: echartWidth, height: echartHeight });
    }, [echartWidth, echartHeight, handleSizeChange]);

    // ──────────────────────────────────────────────
    // Cross-filter click handler
    // ──────────────────────────────────────────────
    const handleClick = useCallback(
        (params: any) => {
            if (!emitCrossFilters || !setDataMask) return;

            const dataItem = params?.data;
            if (!dataItem || !Array.isArray(dataItem)) return;

            const dateStr = dataItem[0];

            const currentlySelected = Object.values(selectedValues || {});
            const isSelected = currentlySelected.includes(dateStr);

            if (isSelected) {
                const dataMask: DataMask = {
                    extraFormData: { time_range: undefined, filters: [] } as any,
                    filterState: { value: null, selectedValues: null },
                };
                setDataMask(dataMask);
            } else {
                const isCategorical = crossfilterMode === 'string';
                const extraFormData: any = {};

                if (isCategorical) {
                    // String Mode: Do NOT emit a time_range at all.
                    // Just emit a standard column filter so Jinja templates can capture the raw string!
                    extraFormData.time_range = undefined;
                    extraFormData.filters = [{
                        col: temporalColumn,
                        op: '==' as const,
                        val: dateStr,
                    }];
                } else {
                    // Temporal Mode: Native Superset override
                    extraFormData.time_range = `${dateStr} : ${dateStr}T23:59:59`;
                    extraFormData.filters = [{
                        col: temporalColumn,
                        op: '==' as const,
                        val: dateStr,
                    }];
                }

                const dataMask: DataMask = {
                    extraFormData,
                    filterState: {
                        value: [dateStr],
                        selectedValues: [dateStr],
                    },
                };
                setDataMask(dataMask);
            }
        },
        [emitCrossFilters, setDataMask, selectedValues, temporalColumn, crossfilterMode],
    );

    // ──────────────────────────────────────────────
    // Register event handlers
    // ──────────────────────────────────────────────
    useEffect(() => {
        if (!didMount || !chartRef.current) return;
        chartRef.current.off('click');
        chartRef.current.on('click', handleClick);
    }, [didMount, handleClick]);

    // ──────────────────────────────────────────────
    // Highlighting
    // ──────────────────────────────────────────────
    useEffect(() => {
        if (!chartRef.current || !didMount) return;

        const selected = Object.values(selectedValues || {});
        if (selected.length === 0) {
            chartRef.current.dispatchAction({ type: 'downplay' });
        } else {
            chartRef.current.dispatchAction({ type: 'downplay' });
            // Find data indices for highlighting
            const option = chartRef.current.getOption() as any;
            const seriesArr = Array.isArray(option?.series) ? option.series : [option?.series].filter(Boolean);
            seriesArr.forEach((_series: any, seriesIdx: number) => {
                const sData = _series?.data || [];
                const matchingIndices: number[] = [];
                sData.forEach((item: any, dataIdx: number) => {
                    const ds = Array.isArray(item) ? item[0] : null;
                    if (ds && selected.includes(ds)) {
                        matchingIndices.push(dataIdx);
                    }
                });
                if (matchingIndices.length > 0) {
                    chartRef.current!.dispatchAction({
                        type: 'highlight',
                        seriesIndex: seriesIdx,
                        dataIndex: matchingIndices,
                    });
                }
            });
        }
    }, [selectedValues, didMount]);

    return (
        <div style={{ width: `${width}px`, height: `${height}px`, overflow: 'auto' }}>
            <div
                ref={divRef}
                style={{
                    width: `${echartWidth}px`,
                    height: `${echartHeight}px`,
                    position: 'relative',
                }}
            />
        </div>
    );
}
