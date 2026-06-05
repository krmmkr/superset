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
import { t } from '@apache-superset/core/translation';
import { legacyValidateInteger } from '@superset-ui/core';
import {
  ControlPanelConfig,
  sharedControls,
} from '@superset-ui/chart-controls';

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'groupby',
            config: {
              ...sharedControls.groupby,
              label: t('Rows (Group By)'),
              description: t('Columns to group by on the rows of the table.'),
            },
          },
        ],
        [
          {
            name: 'columns',
            config: {
              ...sharedControls.groupby,
              label: t('Columns (Pivot)'),
              description: t('Columns to pivot on the x-axis of the table.'),
            },
          },
        ],
        [
          {
            name: 'metrics',
            config: {
              ...sharedControls.metrics,
              label: t('Metrics'),
              description: t('Metrics to calculate and display.'),
            },
          },
        ],
        ['adhoc_filters'],
        [
          {
            name: 'row_limit',
            config: sharedControls.row_limit,
          },
        ],
      ],
    },
    {
      label: t('Table Configuration'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'table_mode',
            config: {
              type: 'SelectControl',
              label: t('Table Layout Mode'),
              description: t(
                'Grid: each dimension gets its own column. ' +
                  'Tree: dimensions are nested/indented with expand/collapse.',
              ),
              default: 'grid',
              choices: [
                ['grid', t('Grid (Separate Columns)')],
                ['tree', t('Tree (Indented / Expand-Collapse)')],
              ],
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'layout_width_type',
            config: {
              type: 'SelectControl',
              label: t('Column Width Layout'),
              description: t(
                'Adaptive: columns auto-stretch to fill container width. ' +
                  'Compact: columns snug fit to content. ' +
                  'Adaptive Column Width: columns stretch proportionally.',
              ),
              default: 'adaptive',
              choices: [
                ['adaptive', t('Adaptive (Auto-fit)')],
                ['compact', t('Compact (Fit Content)')],
                ['colAdaptive', t('Adaptive Column Width')],
                ['custom', t('Custom Per-Column Widths')],
              ],
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'column_widths',
            config: {
              type: 'TextAreaControl',
              label: t('Per-Column Width (JSON)'),
              description: t(
                'Map column or metric fields to specific width in pixels. ' +
                  'Example: {"region": 150, "sales": 100}',
              ),
              default: '{}',
              language: 'json',
              renderTrigger: true,
              visibility: ({ controls }: any) => controls?.layout_width_type?.value === 'custom',
              resetOnHide: false,
            },
          },
        ],
        [
          {
            name: 'show_series_number',
            config: {
              type: 'CheckboxControl',
              label: t('Show Row Index (Series Number)'),
              description: t('Show row index/sequence numbers on the left.'),
              default: false,
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'show_tooltip',
            config: {
              type: 'CheckboxControl',
              label: t('Show Hover Tooltip'),
              description: t('Show details tooltip when hovering over cells.'),
              default: true,
              renderTrigger: true,
            },
          },
        ],

        [
          {
            name: 'column_aggregations',
            config: {
              type: 'TextAreaControl',
              label: t('Per-Column Aggregation (JSON)'),
              description: t(
                'Map each metric to an aggregation type. Omitted metrics default to SUM. ' +
                  'Supported: SUM, AVG, MIN, MAX, COUNT, COUNT_DISTINCT. ' +
                  'Example: {"revenue": "SUM", "customers": "COUNT_DISTINCT"}',
              ),
              default: '{}',
              language: 'json',
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'advanced_s2_options',
            config: {
              type: 'TextAreaControl',
              label: t('Advanced S2 Options (JSON)'),
              description: t(
                'Deeply override any AntV S2 config (options, styles, multi-column interaction). ' +
                  'Example: {"style": {"rowCfg": {"widthByField": {"Region": 120}}}}',
              ),
              default: '{}',
              language: 'json',
              renderTrigger: true,
              minLines: 15,
              maxLines: 40,
              textAreaStyles: { width: '100%' },
            },
          },
        ],
        [
          {
            name: 'show_sort_controls',
            config: {
              type: 'CheckboxControl',
              label: t('Enable Native Sorting'),
              description: t(
                'Show interactive sort icons when hovering over column headers.',
              ),
              default: true,
              renderTrigger: true,
            },
          },
        ],
      ],
    },
    {
      label: t('Totals & Subtotals'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'total_label',
            config: {
              type: 'TextControl',
              label: t('Total Label'),
              description: t('Custom label for total rows/columns.'),
              default: 'Total',
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'show_row_totals',
            config: {
              type: 'CheckboxControl',
              label: t('Show Row Grand Totals'),
              default: true,
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'show_row_subtotals',
            config: {
              type: 'CheckboxControl',
              label: t('Show Row Subtotals'),
              description: t(
                'Show subtotals for each parent dimension group. ' +
                  'Requires 2+ Row dimensions.',
              ),
              default: false,
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'show_col_totals',
            config: {
              type: 'CheckboxControl',
              label: t('Show Column Grand Totals'),
              default: true,
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'show_col_subtotals',
            config: {
              type: 'CheckboxControl',
              label: t('Show Column Subtotals'),
              description: t(
                'Show subtotals for each parent dimension group. ' +
                  'Requires 2+ Column dimensions.',
              ),
              default: false,
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'exclude_totals_metrics',
            config: {
              type: 'SelectControl',
              label: t('Exclude Metrics from Totals'),
              description: t('Select metrics to exclude from totals/subtotals calculations.'),
              multi: true,
              freeForm: true,
              mapStateToProps: (state: any) => {
                const metrics = state.controls?.metrics?.value || [];
                const choices = metrics.map((m: any) => {
                  const metricName = typeof m === 'string' ? m : m.label || m.metric_name;
                  return [metricName, metricName];
                });
                return {
                  choices,
                };
              },
              default: [],
              renderTrigger: true,
            },
          },
        ],
      ],
    },
    {
      label: t('Appearance'),
      expanded: false,
      controlSetRows: [
        [
          {
            name: 'theme',
            config: {
              type: 'SelectControl',
              label: t('Table Theme'),
              default: 'default',
              choices: [
                ['default', t('Default')],
                ['colorful', t('Colorful')],
                ['gray', t('Gray')],
              ],
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'row_height',
            config: {
              type: 'TextControl',
              label: t('Row Height (px)'),
              description: t('Custom height for data cells and rows in pixels. Leave empty for default.'),
              isInt: true,
              validators: [legacyValidateInteger],
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'col_height',
            config: {
              type: 'TextControl',
              label: t('Column Header Height (px)'),
              description: t('Custom height for column header cells in pixels. Leave empty for default.'),
              isInt: true,
              validators: [legacyValidateInteger],
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'default_dimension_align',
            config: {
              type: 'SelectControl',
              label: t('Default Dimension Alignment'),
              default: 'left',
              choices: [
                ['left', t('Left')],
                ['center', t('Center')],
                ['right', t('Right')],
              ],
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'default_metric_align',
            config: {
              type: 'SelectControl',
              label: t('Default Metric Alignment'),
              default: 'right',
              choices: [
                ['left', t('Left')],
                ['center', t('Center')],
                ['right', t('Right')],
              ],
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'column_alignments',
            config: {
              type: 'TextAreaControl',
              label: t('Per-Column Alignment (JSON)'),
              description: t(
                'Map column or metric fields to text alignment. ' +
                  'Supported values: left, center, right. ' +
                  'Example: {"region": "left", "sales": "right"}',
              ),
              default: '{}',
              language: 'json',
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'column_formats',
            config: {
              type: 'TextAreaControl',
              label: t('Per-Column Format (JSON)'),
              description: t(
                'Map metric fields to specific number formats (e.g., percentages, currencies). ' +
                  'Example: {"sales": "$,.2f", "growth": ".1%"}',
              ),
              default: '{}',
              language: 'json',
              renderTrigger: true,
            },
          },
        ],

        [
          {
            name: 'header_color',
            config: {
              type: 'ColorPickerControl',
              label: t('Header Background Color'),
              description: t('Custom background color for column and row headers.'),
              renderTrigger: true,
            },
          },
        ],
      ],
    },

    {
      label: t('Cross-filtering'),
      expanded: false,
      controlSetRows: [
        [
          {
            name: 'emit_filter',
            config: {
              type: 'CheckboxControl',
              label: t('Enable Cross-filtering'),
              description: t(
                'Clicking data/row cells will filter other dashboard charts.',
              ),
              default: true,
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'crossfilter_columns',
            config: {
              ...sharedControls.groupby,
              label: t('Cross-filter Columns'),
              description: t(
                'Which dimension columns to emit. ' +
                  'Empty = all groupby dimensions. ' +
                  'Emitted as JSON dict for Jinja parsing.',
              ),
              validators: [],
            },
          },
        ],
      ],
    },
  ],
  controlOverrides: {
    series: {
      validators: [],
      clearable: true,
    },
  },
};

export default config;
