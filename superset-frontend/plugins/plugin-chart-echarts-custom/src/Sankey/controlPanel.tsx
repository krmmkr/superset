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
import { validateNonEmpty } from '@superset-ui/core';
import {
  ControlPanelConfig,
  ControlPanelsContainerProps,
  dndGroupByControl,
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
              ...dndGroupByControl,
              label: t('Stages / Group By'),
              multi: true,
              description: t('Columns to use as stages in the Sankey flow.'),
              validators: [validateNonEmpty],
              freeForm: false,
            },
          },
        ],
        ['metric'],
        ['adhoc_filters'],
        ['row_limit'],
        ['sort_by_metric'],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        ['color_scheme'],
        [
          {
            name: 'show_label_percentage',
            config: {
              type: 'CheckboxControl',
              label: t('Show Stage Percentage next to Label'),
              default: false,
              renderTrigger: true,
              description: t(
                "Show the node's stage flow percentage next to the label on the chart.",
              ),
            },
          },
        ],
        [
          {
            name: 'show_label_percentage_type',
            config: {
              type: 'SelectControl',
              label: t('Label Percentage Type'),
              default: 'stage',
              choices: [
                ['stage', t('Percentage of Stage')],
                ['whole', t('Percentage of Whole Data')],
                ['both', t('Both')],
              ],
              renderTrigger: true,
              description: t(
                'Choose whether to display percentage of stage, percentage of whole data, or both next to the label.',
              ),
              visibility: ({ controls }: ControlPanelsContainerProps) =>
                Boolean(controls?.show_label_percentage?.value),
            },
          },
        ],
      ],
    },
    {
      label: t('Tooltip Options'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'show_stage_name',
            config: {
              type: 'CheckboxControl',
              label: t('Show Stage Name'),
              default: true,
              renderTrigger: true,
              description: t(
                'Show the stage name (column name) in the node tooltip.',
              ),
            },
          },
        ],
        [
          {
            name: 'show_stage_percentage',
            config: {
              type: 'CheckboxControl',
              label: t('Show Stage Percentage'),
              default: true,
              renderTrigger: true,
              description: t(
                "Show the node's percentage of the total flow for that stage.",
              ),
            },
          },
        ],
        [
          {
            name: 'show_whole_percentage',
            config: {
              type: 'CheckboxControl',
              label: t('Show Percent of Whole Data'),
              default: true,
              renderTrigger: true,
              description: t(
                "Show the node's percentage of the total flow for the whole data.",
              ),
            },
          },
        ],
        [
          {
            name: 'show_stage_total',
            config: {
              type: 'CheckboxControl',
              label: t('Show Stage Total Value'),
              default: true,
              renderTrigger: true,
              description: t(
                'Show the total value of the stage in the tooltip.',
              ),
            },
          },
        ],
        [
          {
            name: 'show_overall_total',
            config: {
              type: 'CheckboxControl',
              label: t('Show Overall Total Value'),
              default: true,
              renderTrigger: true,
              description: t(
                'Show the overall total value of the dataset in the tooltip.',
              ),
            },
          },
        ],
        [
          {
            name: 'show_node_value',
            config: {
              type: 'CheckboxControl',
              label: t('Show Node Value'),
              default: true,
              renderTrigger: true,
              description: t("Show the node's metric value in the tooltip."),
            },
          },
        ],
        [
          {
            name: 'show_link_percentages',
            config: {
              type: 'CheckboxControl',
              label: t('Show Link Percentages'),
              default: true,
              renderTrigger: true,
              description: t('Show source/target percentages in link tooltip.'),
            },
          },
        ],
      ],
    },
  ],
};

export default config;
