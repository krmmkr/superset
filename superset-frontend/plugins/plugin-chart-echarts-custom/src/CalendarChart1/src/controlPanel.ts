/**
 * Licensed under the Apache License, Version 2.0
 * Superset Calendar Heatmap Plugin - Control Panel
 */
import { t } from '@apache-superset/core/translation';
import {
    ControlPanelConfig,
    sharedControls,
} from '@superset-ui/chart-controls';
import {
    DEFAULT_FORM_DATA,
    CalendarOrient,
    VisualMapType,
    VisualMapOrient,
    VisualMapPosition,
    DayLabelFormat,
    MonthLabelFormat,
} from './constants';

const config: ControlPanelConfig = {
    controlPanelSections: [
        // ──────────────────────────────────────────────
        // QUERY
        // ──────────────────────────────────────────────
        {
            label: t('Query'),
            expanded: true,
            controlSetRows: [
                // Standard Superset temporal column (granularity_sqla)
                // This must use the standard name so time_range filters work
                ['granularity_sqla'],
                ['time_range'],
                ['time_grain_sqla'],
                ['metrics'],
                ['adhoc_filters'],
                ['row_limit'],
            ],
        },

        // ──────────────────────────────────────────────
        // CALENDAR LAYOUT
        // ──────────────────────────────────────────────
        {
            label: t('Calendar Layout'),
            expanded: true,
            controlSetRows: [
                [
                    {
                        name: 'calendar_orient',
                        config: {
                            type: 'SelectControl',
                            label: t('Orientation'),
                            description: t('Direction of the calendar layout.'),
                            default: DEFAULT_FORM_DATA.calendarOrient,
                            choices: [
                                [CalendarOrient.Horizontal, t('Horizontal')],
                                [CalendarOrient.Vertical, t('Vertical')],
                            ],
                            renderTrigger: true,
                        },
                    },
                ],
                [
                    {
                        name: 'layout_mode',
                        config: {
                            type: 'SelectControl',
                            label: t('Layout Mode'),
                            description: t('Fit to Screen natively squeezes the calendar into the dashboard widget. Scrollable applies a strictly fixed Cell Size and triggers a scrollbar if the widget is too small.'),
                            default: 'scrollable',
                            choices: [
                                ['scrollable', t('Scrollable (Fixed Cell Size)')],
                                ['fit', t('Fit to Widget (Auto Cell Size)')],
                            ],
                            renderTrigger: true,
                        },
                    },
                ],
                [
                    {
                        name: 'calendar_time_range',
                        config: {
                            type: 'DateFilterControl',
                            freeForm: true,
                            label: t('Calendar Visual Date Range'),
                            default: 'No filter',
                            description: t(
                                'Force the calendar to strictly show this date range (e.g. "now - 2 months", "Last 12 months", or explicitly "2025-01-01 : 2026-12-31"). This overrides the outer auto-calculated dimensions and completely bypasses the data payload length.'
                            ),
                            renderTrigger: true,
                        },
                    },
                ],
                [
                    {
                        name: 'cell_size',
                        config: {
                            type: 'SliderControl',
                            label: t('Cell Size'),
                            description: t('Size of each day cell in pixels.'),
                            default: DEFAULT_FORM_DATA.cellSize,
                            min: 8,
                            max: 50,
                            step: 1,
                            renderTrigger: true,
                        },
                    },
                ],
                [
                    {
                        name: 'show_month_separator',
                        config: {
                            type: 'CheckboxControl',
                            label: t('Show Month Separators'),
                            description: t('Draw lines between months.'),
                            default: DEFAULT_FORM_DATA.showMonthSeparator,
                            renderTrigger: true,
                        },
                    },
                ],
                [
                    {
                        name: 'month_separator_width',
                        config: {
                            type: 'SliderControl',
                            label: t('Month Separator Width'),
                            description: t('Width of the month separator lines. High values natively push all cells apart in ECharts.'),
                            default: DEFAULT_FORM_DATA.monthSeparatorWidth,
                            min: 1,
                            max: 5,
                            step: 1,
                            renderTrigger: true,
                            visibility: ({ controls }: any) =>
                                controls?.show_month_separator?.value === true,
                        },
                    },
                ],
            ],
        },

        // ──────────────────────────────────────────────
        // LABELS
        // ──────────────────────────────────────────────
        {
            label: t('Labels'),
            expanded: true,
            controlSetRows: [
                [
                    {
                        name: 'show_day_label',
                        config: {
                            type: 'CheckboxControl',
                            label: t('Show Day Labels'),
                            description: t('Show day-of-week labels (Mon, Tue, …).'),
                            default: DEFAULT_FORM_DATA.showDayLabel,
                            renderTrigger: true,
                        },
                    },
                ],
                [
                    {
                        name: 'day_label_format',
                        config: {
                            type: 'SelectControl',
                            label: t('Day Label Format'),
                            description: t('Format for day-of-week labels.'),
                            default: DEFAULT_FORM_DATA.dayLabelFormat,
                            choices: [
                                [DayLabelFormat.Short, t('Short (M, T, W …)')],
                                [DayLabelFormat.Medium, t('Medium (Mon, Tue, Wed …)')],
                                [DayLabelFormat.Full, t('Full (Monday, Tuesday …)')],
                            ],
                            renderTrigger: true,
                            visibility: ({ controls }: any) =>
                                controls?.show_day_label?.value === true,
                        },
                    },
                ],
                [
                    {
                        name: 'show_month_label',
                        config: {
                            type: 'CheckboxControl',
                            label: t('Show Month Labels'),
                            description: t('Show month labels above/beside the calendar.'),
                            default: DEFAULT_FORM_DATA.showMonthLabel,
                            renderTrigger: true,
                        },
                    },
                ],
                [
                    {
                        name: 'month_label_format',
                        config: {
                            type: 'SelectControl',
                            label: t('Month Label Format'),
                            description: t('Format for month labels.'),
                            default: DEFAULT_FORM_DATA.monthLabelFormat,
                            choices: [
                                [MonthLabelFormat.Short, t('Short (Jan, Feb …)')],
                                [MonthLabelFormat.Full, t('Full (January, February …)')],
                            ],
                            renderTrigger: true,
                            visibility: ({ controls }: any) =>
                                controls?.show_month_label?.value === true,
                        },
                    },
                ],

            ],
        },

        // ──────────────────────────────────────────────
        // CELL LABELS (Date + Metric inside cells)
        // ──────────────────────────────────────────────
        {
            label: t('Cell Labels'),
            expanded: true,
            controlSetRows: [
                [
                    {
                        name: 'show_cell_label',
                        config: {
                            type: 'CheckboxControl',
                            label: t('Show Metric Value'),
                            description: t('Display the metric value inside each calendar cell.'),
                            default: DEFAULT_FORM_DATA.showCellLabel,
                            renderTrigger: true,
                        },
                    },
                ],
                [
                    {
                        name: 'label_font_size',
                        config: {
                            type: 'SliderControl',
                            label: t('Label Font Size'),
                            description: t('Font size for the metric value.'),
                            default: DEFAULT_FORM_DATA.labelFontSize,
                            min: 8,
                            max: 20,
                            step: 1,
                            renderTrigger: true,
                            visibility: ({ controls }: any) =>
                                controls?.show_cell_label?.value === true,
                        },
                    },
                ],
                [
                    {
                        name: 'show_cell_date',
                        config: {
                            type: 'CheckboxControl',
                            label: t('Show Date (Day of Month)'),
                            description: t('Display the day-of-month number as subscript text in each calendar cell.'),
                            default: DEFAULT_FORM_DATA.showCellDate,
                            renderTrigger: true,
                            visibility: ({ controls }: any) =>
                                controls?.show_cell_label?.value === true,
                        },
                    },
                ],
                [
                    {
                        name: 'day_label_font_size',
                        config: {
                            type: 'SliderControl',
                            label: t('Date Font Size'),
                            description: t('Font size for the day-of-month (number).'),
                            default: DEFAULT_FORM_DATA.dayLabelFontSize,
                            min: 6,
                            max: 16,
                            step: 1,
                            renderTrigger: true,
                            visibility: ({ controls }: any) =>
                                controls?.show_cell_date?.value === true,
                        },
                    },
                ],
            ],
        },

        // ──────────────────────────────────────────────
        // COLOR & VISUAL MAP
        // ──────────────────────────────────────────────
        {
            label: t('Color & Visual Map'),
            expanded: true,
            controlSetRows: [
                ['linear_color_scheme'],
                [
                    {
                        name: 'visual_map_type',
                        config: {
                            type: 'SelectControl',
                            label: t('Visual Map Type'),
                            description: t('Continuous gradient or piecewise (discrete steps).'),
                            default: DEFAULT_FORM_DATA.visualMapType,
                            choices: [
                                [VisualMapType.Continuous, t('Continuous (gradient)')],
                                [VisualMapType.Piecewise, t('Piecewise (steps)')],
                            ],
                            renderTrigger: true,
                        },
                    },
                ],
                [
                    {
                        name: 'piecewise_num',
                        config: {
                            type: 'SliderControl',
                            label: t('Number of Pieces'),
                            description: t('Number of color stops for piecewise mode.'),
                            default: DEFAULT_FORM_DATA.piecewiseNum,
                            min: 2,
                            max: 10,
                            step: 1,
                            renderTrigger: true,
                            visibility: ({ controls }: any) =>
                                controls?.visual_map_type?.value === VisualMapType.Piecewise,
                        },
                    },
                ],
                [
                    {
                        name: 'show_visual_map',
                        config: {
                            type: 'CheckboxControl',
                            label: t('Show Visual Map Legend'),
                            description: t('Display the color legend.'),
                            default: DEFAULT_FORM_DATA.showVisualMap,
                            renderTrigger: true,
                        },
                    },
                ],
                [
                    {
                        name: 'visual_map_orient',
                        config: {
                            type: 'SelectControl',
                            label: t('Visual Map Orientation'),
                            description: t('Orientation of the visual map legend.'),
                            default: DEFAULT_FORM_DATA.visualMapOrient,
                            choices: [
                                [VisualMapOrient.Horizontal, t('Horizontal')],
                                [VisualMapOrient.Vertical, t('Vertical')],
                            ],
                            renderTrigger: true,
                            visibility: ({ controls }: any) =>
                                controls?.show_visual_map?.value === true,
                        },
                    },
                ],
                [
                    {
                        name: 'visual_map_position',
                        config: {
                            type: 'SelectControl',
                            label: t('Visual Map Position'),
                            description: t('Position of the visual map legend.'),
                            default: DEFAULT_FORM_DATA.visualMapPosition,
                            choices: [
                                [VisualMapPosition.TopLeft, t('Top Left')],
                                [VisualMapPosition.TopRight, t('Top Right')],
                                [VisualMapPosition.BottomLeft, t('Bottom Left')],
                                [VisualMapPosition.BottomRight, t('Bottom Right')],
                            ],
                            renderTrigger: true,
                            visibility: ({ controls }: any) =>
                                controls?.show_visual_map?.value === true,
                        },
                    },
                ],
                [
                    {
                        name: 'visual_map_min',
                        config: {
                            type: 'TextControl',
                            label: t('Visual Map Min'),
                            description: t('Minimum value for the color scale. Leave empty to auto-detect.'),
                            default: '',
                            isFloat: true,
                            renderTrigger: true,
                        },
                    },
                ],
                [
                    {
                        name: 'visual_map_max',
                        config: {
                            type: 'TextControl',
                            label: t('Visual Map Max'),
                            description: t('Maximum value for the color scale. Leave empty to auto-detect.'),
                            default: '',
                            isFloat: true,
                            renderTrigger: true,
                        },
                    },
                ],
            ],
        },

        // ──────────────────────────────────────────────
        // CELL STYLING
        // ──────────────────────────────────────────────
        {
            label: t('Cell Styling'),
            expanded: false,
            controlSetRows: [
                [
                    {
                        name: 'cell_border_width',
                        config: {
                            type: 'SliderControl',
                            label: t('Cell Border Width'),
                            description: t('Border width for each day cell.'),
                            default: DEFAULT_FORM_DATA.cellBorderWidth,
                            min: 0,
                            max: 5,
                            step: 0.5,
                            renderTrigger: true,
                        },
                    },
                ],
                [
                    {
                        name: 'cell_border_radius',
                        config: {
                            type: 'SliderControl',
                            label: t('Cell Border Radius'),
                            description: t('Corner rounding for each day cell.'),
                            default: DEFAULT_FORM_DATA.cellBorderRadius,
                            min: 0,
                            max: 15,
                            step: 1,
                            renderTrigger: true,
                        },
                    },
                ],
            ],
        },

        // ──────────────────────────────────────────────
        // TOOLTIP
        // ──────────────────────────────────────────────
        {
            label: t('Tooltip'),
            expanded: false,
            controlSetRows: [
                [
                    {
                        name: 'number_format',
                        config: {
                            ...sharedControls.y_axis_format,
                            label: t('Number Format'),
                            description: t('D3 format string for the metric value.'),
                            default: DEFAULT_FORM_DATA.numberFormat,
                        },
                    },
                ],
            ],
        },

        // ──────────────────────────────────────────────
        // CROSSFILTER
        // ──────────────────────────────────────────────
        {
            label: t('Cross-filtering'),
            expanded: false,
            controlSetRows: [
                [
                    {
                        name: 'emit_filter',
                        config: {
                            type: 'CheckboxControl',
                            label: t('Emit Date Cross-filter'),
                            description: t(
                                'When enabled, clicking a calendar cell will emit a date filter to other charts on the dashboard.',
                            ),
                            default: DEFAULT_FORM_DATA.emitFilter,
                            renderTrigger: false,
                        },
                    },
                ],
                [
                    {
                        name: 'crossfilter_mode',
                        config: {
                            type: 'SelectControl',
                            label: t('Cross-filter Format'),
                            description: t('Temporal mode overrides the global Time Range on connected charts (Superset default behaviour). Categorical mode generates a raw string filter that skips temporal parsing and can be intercepted by SQL Jinja templates.'),
                            default: 'temporal',
                            choices: [
                                ['temporal', t('Temporal (Superset Date Filter)')],
                                ['string', t('Categorical String (For Jinja overrides)')],
                            ],
                            renderTrigger: true,
                            visibility: ({ controls }: any) =>
                                controls?.emit_filter?.value === true,
                        },
                    },
                ],
            ],
        },
    ],
};

export default config;

