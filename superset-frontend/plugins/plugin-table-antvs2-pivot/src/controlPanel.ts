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
            name: 'frontend_aggregation',
            config: {
              type: 'SelectControl',
              label: t('Aggregation Mode'),
              description: t(
                '"Frontend" uses custom per-column aggregation. ' +
                  '"Backend Default" uses standard sum for totals.',
              ),
              default: true,
              choices: [
                [true, t('Frontend (Custom Per-Column)')],
                [false, t('Backend Default (Sum)')],
              ],
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
              label: t('Show Sort Controls'),
              description: t(
                'Show the inline multi-column sort bar above the table.',
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
