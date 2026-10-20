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
  ChartProps,
  QueryFormColumn,
  QueryFormMetric,
  SetDataMaskHook,
  ChartDataResponseResult,
  FilterState,
  QueryFormData,
  ContextMenuFilters,
  HandlerFunction,
} from '@superset-ui/core';

export interface S2TableFormData extends QueryFormData {
  groupby: QueryFormColumn[];
  metrics: QueryFormMetric[];

  theme: 'default' | 'colorful' | 'gray';
  showSortControls: boolean;
  emitFilter: boolean;
  crossfilterColumns: QueryFormColumn[];

  advancedS2Options?: string;
  enableRowspan?: boolean;

  showSeriesNumber?: boolean;
  layoutWidthType?: 'adaptive' | 'compact' | 'colAdaptive';
  showTooltip?: boolean;
  rowHeight?: string;
  colHeight?: string;
  defaultDimensionAlign?: 'left' | 'center' | 'right';
  defaultMetricAlign?: 'left' | 'center' | 'right';
  headerColor?: { r: number; g: number; b: number; a: number };
  border_color?: { r: number; g: number; b: number; a: number };
  borderColor?: { r: number; g: number; b: number; a: number };
  row_banding_color?: { r: number; g: number; b: number; a: number };

  dimension_config?: Record<
    string,
    {
      customColumnName?: string;
      horizontalAlign?: 'left' | 'center' | 'right';
      columnWidth?: number;
      boldText?: boolean;
    }
  >;
  metric_config?: Record<
    string,
    {
      customColumnName?: string;
      horizontalAlign?: 'left' | 'center' | 'right';
      columnWidth?: number;
      d3NumberFormat?: string;
      currencyFormat?: any;
      boldText?: boolean;
    }
  >;
}

export interface S2TableChartProps extends ChartProps {
  formData: S2TableFormData;
  queriesData: ChartDataResponseResult[];
}

export type Refs = {
  divRef?: React.RefObject<HTMLDivElement>;
};

export interface S2TableTransformedProps {
  formData: S2TableFormData;
  height: number;
  width: number;

  s2DataConfig: any;
  s2Options: any;
  s2Theme: any;
  sheetType: 'table';

  showSortControls: boolean;

  crossfilterColumns: string[];
  groupby: string[];
  allFields: string[];
  metricCols: string[];
  metricColsSet: Set<string>;
  advancedS2OptionsObj: any;
  defaultDimensionAlign?: 'left' | 'center' | 'right';
  defaultMetricAlign?: 'left' | 'center' | 'right';
  columnAlignmentsObj?: Record<string, 'left' | 'center' | 'right'>;
  columnBoldTextObj?: Record<string, boolean>;
  columnFormatsObj?: Record<string, string>;
  headerColor?: string;
  headerColorObj?: { r: number; g: number; b: number; a: number };
  borderColor?: string;
  borderColorObj?: { r: number; g: number; b: number; a: number };
  rowBandingColor?: string;
  rowBandingColorObj?: { r: number; g: number; b: number; a: number };

  setDataMask: SetDataMaskHook;
  selectedValues: Record<number, string>;
  emitCrossFilters: boolean;
  filterState?: FilterState;
  refs: Refs;
  onContextMenu?: (
    clientX: number,
    clientY: number,
    filters?: ContextMenuFilters,
  ) => void;
  setControlValue?: HandlerFunction;
  colHeaderWordWrap?: boolean;
  rowHeaderWordWrap?: boolean;
  dataCellWordWrap?: boolean;
}
