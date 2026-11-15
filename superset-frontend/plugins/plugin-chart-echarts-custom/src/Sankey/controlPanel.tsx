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
            name: 'layout_mode',
            config: {
              type: 'SelectControl',
              label: t('Layout Mode'),
              default: 'fit',
              choices: [
                ['fit', t('Fit to Width')],
                ['scrollable', t('Scrollable (Maintain Min Width)')],
              ],
              renderTrigger: true,
              description: t(
                'Fit to Width scales the diagram into the card. Scrollable enables horizontal scrolling when the diagram exceeds the minimum width.',
              ),
            },
          },
        ],
        [
          {
            name: 'min_width',
            config: {
              type: 'SliderControl',
              label: t('Minimum Diagram Width (px)'),
              default: 600,
              min: 300,
              max: 2000,
              step: 50,
              renderTrigger: true,
              description: t(
                'Minimum width in pixels before horizontal scrollbar appears in scrollable mode.',
              ),
              visibility: ({ controls }: ControlPanelsContainerProps) =>
                controls?.layout_mode?.value === 'scrollable',
            },
          },
        ],
        [
          {
            name: 'link_color_mode',
            config: {
              type: 'SelectControl',
              label: t('Link / Band Color'),
              default: 'gradient',
              choices: [
                ['gradient', t('Both (Gradient: Source → Destination)')],
                ['source', t('Use Source Color')],
                ['target', t('Use Destination Color')],
              ],
              renderTrigger: true,
              description: t(
                'Controls whether flow bands take the source color, destination color, or smoothly transition between both.',
              ),
            },
          },
        ],
        [
          {
            name: 'enable_3d_effect',
            config: {
              type: 'CheckboxControl',
              label: t('3D Capsule Nodes'),
              default: true,
              renderTrigger: true,
              description: t(
                'Add rounded 3D capsule styling, edge highlights, and depth shadows to nodes and bands.',
              ),
            },
          },
        ],
        [
          {
            name: 'node_width',
            config: {
              type: 'SliderControl',
              label: t('Node Width'),
              default: 16,
              min: 8,
              max: 40,
              step: 1,
              renderTrigger: true,
              description: t('Width of the vertical node pillars in pixels.'),
            },
          },
        ],
        [
          {
            name: 'node_gap',
            config: {
              type: 'SliderControl',
              label: t('Node Gap'),
              default: 16,
              min: 4,
              max: 40,
              step: 1,
              renderTrigger: true,
              description: t('Vertical spacing between nodes in pixels.'),
            },
          },
        ],
        [
          {
            name: 'node_border_radius',
            config: {
              type: 'SliderControl',
              label: t('Node Corner Radius'),
              default: 6,
              min: 0,
              max: 20,
              step: 1,
              renderTrigger: true,
              description: t('Corner rounding for node pillars.'),
            },
          },
        ],
        [
          {
            name: 'link_opacity',
            config: {
              type: 'SliderControl',
              label: t('Link Opacity'),
              default: 0.75,
              min: 0.1,
              max: 1.0,
              step: 0.05,
              renderTrigger: true,
              description: t('Opacity of the flow ribbons.'),
            },
          },
        ],
        [
          {
            name: 'blur_opacity',
            config: {
              type: 'SliderControl',
              label: t('Hover Inactive Elements Opacity'),
              default: 0.15,
              min: 0.0,
              max: 0.8,
              step: 0.05,
              renderTrigger: true,
              description: t(
                'Controls the opacity of non-focused nodes and ribbons when hovering over a specific bar or flow.',
              ),
            },
          },
        ],
        [
          {
            name: 'focus_mode',
            config: {
              type: 'SelectControl',
              label: t('Hover Focus Mode'),
              default: 'adjacency',
              choices: [
                ['adjacency', t('Direct Connections (Adjacency)')],
                ['trajectory', t('Full Flow Path (Trajectory)')],
                ['series', t('All Elements in Series')],
              ],
              renderTrigger: true,
              description: t(
                'Choose whether hovering highlights only direct adjacent connections or the entire multi-stage path.',
              ),
            },
          },
        ],
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
