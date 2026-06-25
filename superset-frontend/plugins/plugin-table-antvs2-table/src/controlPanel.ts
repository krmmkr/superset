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
  legacyValidateInteger,
  ensureIsArray,
  getMetricLabel,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
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
              label: t('Columns (Dimensions)'),
              description: t(
                'Select dimension columns to display in the flat table.',
              ),
            },
          },
        ],
        [
          {
            name: 'metrics',
            config: {
              ...sharedControls.metrics,
              label: t('Columns (Metrics)'),
              description: t('Select metric columns to calculate and display.'),
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
            name: 'dimension_config',
            config: {
              type: 'ColumnConfigControl',
              label: t('Dimension Customizations'),
              description: t(
                'Configure display labels, alignments, and widths for dimensions.',
              ),
              renderTrigger: true,
              configFormLayout: {
                [GenericDataType.String]: [
                  [
                    'columnWidth',
                    {
                      name: 'horizontalAlign',
                      override: { defaultValue: 'left' },
                    },
                  ],
                  [
                    'customColumnName',
                    {
                      name: 'boldText',
                      config: {
                        controlType: 'Checkbox',
                        label: t('Bold text'),
                        description: t('Whether to make the text in this column bolder'),
                        defaultValue: false,
                        debounceDelay: 200,
                      },
                    },
                  ],
                ],
              },
              shouldMapStateToProps() {
                return true;
              },
              mapStateToProps({ controls }: any) {
                const groupby = ensureIsArray(controls.groupby?.value || []);
                const colnames = groupby.map(col =>
                  typeof col === 'object'
                    ? col.column_name || col.label
                    : String(col),
                );
                return {
                  columnsPropsObject: {
                    colnames,
                    coltypes: colnames.map(() => GenericDataType.String),
                  },
                };
              },
            },
          },
        ],
        [
          {
            name: 'metric_config',
            config: {
              type: 'ColumnConfigControl',
              label: t('Metric Customizations'),
              description: t(
                'Configure display labels, alignments, widths, and formatting for metrics.',
              ),
              renderTrigger: true,
              configFormLayout: {
                [GenericDataType.Numeric]: [
                  {
                    tab: t('Style Settings'),
                    children: [
                      [
                        'columnWidth',
                        {
                          name: 'horizontalAlign',
                          override: { defaultValue: 'right' },
                        },
                      ],
                      [
                        'customColumnName',
                        {
                          name: 'boldText',
                          config: {
                            controlType: 'Checkbox',
                            label: t('Bold text'),
                            description: t('Whether to make the text in this column bolder'),
                            defaultValue: false,
                            debounceDelay: 200,
                          },
                        },
                      ],
                    ],
                  },
                  {
                    tab: t('Formatting'),
                    children: [['d3NumberFormat'], ['currencyFormat']],
                  },
                ],
              },
              shouldMapStateToProps() {
                return true;
              },
              mapStateToProps({ controls }: any) {
                const metrics = ensureIsArray(controls.metrics?.value || []);
                const colnames = metrics.map((m: any) => getMetricLabel(m));
                return {
                  columnsPropsObject: {
                    colnames,
                    coltypes: colnames.map(() => GenericDataType.Numeric),
                  },
                };
              },
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
            name: 'enable_rowspan',
            config: {
              type: 'CheckboxControl',
              label: t('Enable Rowspan / Merge Cells'),
              description: t(
                'Automatically merge adjacent row cells with identical values for dimension columns.',
              ),
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
            name: 'advanced_s2_options',
            config: {
              type: 'TextAreaControl',
              label: t('Advanced S2 Options (JSON)'),
              description: t(
                'Deeply override any AntV S2 config (options, styles, multi-column interaction). ' +
                  'Example: {"style": {"colCell": {"widthByField": {"Region": 120}}}}',
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
              description: t(
                'Custom height for data cells and rows in pixels. Leave empty for default.',
              ),
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
              description: t(
                'Custom height for column header cells in pixels. Leave empty for default.',
              ),
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
            name: 'header_color',
            config: {
              type: 'ColorPickerControl',
              label: t('Header Background Color'),
              description: t(
                'Custom background color for column and row headers.',
              ),
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'border_color',
            config: {
              type: 'ColorPickerControl',
              label: t('Border Color'),
              description: t('Custom color for table cell borders.'),
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'row_banding_color',
            config: {
              type: 'ColorPickerControl',
              label: t('Row Banding (Stripe) Color'),
              description: t(
                'Custom color for alternate rows. Set opacity to 0 (transparent) to disable row banding.',
              ),
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'col_header_word_wrap',
            config: {
              type: 'CheckboxControl',
              label: t('Wrap Column Header Text'),
              description: t('Wrap column header text when there is overflow.'),
              default: false,
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'row_header_word_wrap',
            config: {
              type: 'CheckboxControl',
              label: t('Wrap Row Header Text'),
              description: t(
                'Wrap row header (dimension) text when there is overflow.',
              ),
              default: false,
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'data_cell_word_wrap',
            config: {
              type: 'CheckboxControl',
              label: t('Wrap Data Cell Text'),
              description: t('Wrap data cell values when there is overflow.'),
              default: false,
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
