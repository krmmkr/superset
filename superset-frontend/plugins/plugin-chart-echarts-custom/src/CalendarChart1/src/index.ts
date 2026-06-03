/**
 * Licensed under the Apache License, Version 2.0
 * Superset Calendar Heatmap Plugin - Entry Point
 */
import { ChartMetadata, ChartPlugin, Behavior } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import transformProps from './transformProps';
import buildQuery from './buildQuery';
import controlPanel from './controlPanel';
import { CalendarHeatmapFormData, CalendarHeatmapChartProps } from './types';
import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';

const metadata = new ChartMetadata({
    category: t('Trend'),
    description: t(
        'A calendar heatmap built on Apache ECharts. ' +
        'Visualize daily values across months and years with customizable colors, ' +
        'cell styling, and date-based cross-filtering.',
    ),
    name: t('Calendar Heatmap (Custom)'),
    tags: [
        t('Calendar'),
        t('Heatmap'),
        t('Time'),
        t('ECharts'),
        t('Trend'),
        t('Popular'),
    ],
    thumbnail,
    thumbnailDark,
    behaviors: [
        Behavior.InteractiveChart,
        Behavior.DrillToDetail,
    ],
});

export default class EchartsCalendarHeatmapChartPlugin extends ChartPlugin<
    CalendarHeatmapFormData,
    CalendarHeatmapChartProps
> {
    constructor() {
        super({
            buildQuery,
            loadChart: () => import('./EchartsCalendar'),
            metadata,
            transformProps,
            controlPanel,
        });
    }
}
