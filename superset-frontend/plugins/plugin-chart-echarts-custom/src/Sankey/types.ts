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
import {
  QueryFormColumn,
  QueryFormData,
  QueryFormMetric,
} from '@superset-ui/core';
import { BaseChartProps, BaseTransformedProps } from '../types';

export type SankeyFormData = QueryFormData & {
  colorScheme: string;
  metric: QueryFormMetric;
  groupby: QueryFormColumn[];
  show_stage_name?: boolean;
  show_stage_percentage?: boolean;
  show_node_value?: boolean;
  show_label_percentage?: boolean;
  show_link_percentages?: boolean;
  showStageName?: boolean;
  showStagePercentage?: boolean;
  showNodeValue?: boolean;
  showLabelPercentage?: boolean;
  showLinkPercentages?: boolean;
};

export interface SankeyChartProps extends BaseChartProps<SankeyFormData> {
  formData: SankeyFormData;
}

export type SankeyTransformedProps = BaseTransformedProps<SankeyFormData> & {};
