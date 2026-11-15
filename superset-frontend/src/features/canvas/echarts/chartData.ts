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

import { SupersetClient } from '@superset-ui/core';
import { DRAFT_TOKEN_HEADER, VERSION_HEADER } from '../useCanvasDefinition';
import type { DataRow } from './resolveBindings';

/** A widget's `dataBinding` prop: the query the server runs for it. */
export interface DataBinding {
  datasetId: number;
  metrics: unknown[];
  dimensions?: string[];
  timeGrain?: string;
  timeGrainColumn?: string;
  filters?: Record<string, unknown>[];
  rowLimit?: number;
  orderBy?: { field: string; descending?: boolean }[];
}

/** The value a `filter.select` widget publishes to the widgets in its scope. */
export interface SelectFilterValue {
  datasetId: number;
  column: string;
  values: string[];
}

/** The value a `filter.date_range` widget publishes to the widgets in its scope. */
export interface DateRangeFilterValue {
  datasetId: number;
  column: string;
  op: 'TEMPORAL_RANGE';
  timeRange: string;
}

export type RuntimeFilterValue = SelectFilterValue | DateRangeFilterValue;

const isSelectFilterValue = (value: unknown): value is SelectFilterValue =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as SelectFilterValue).datasetId === 'number' &&
  typeof (value as SelectFilterValue).column === 'string' &&
  Array.isArray((value as SelectFilterValue).values);

const isDateRangeFilterValue = (
  value: unknown,
): value is DateRangeFilterValue =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as DateRangeFilterValue).datasetId === 'number' &&
  typeof (value as DateRangeFilterValue).column === 'string' &&
  (value as DateRangeFilterValue).op === 'TEMPORAL_RANGE' &&
  typeof (value as DateRangeFilterValue).timeRange === 'string' &&
  (value as DateRangeFilterValue).timeRange.length > 0;

/**
 * The filter values reaching a widget, sent with its data request.
 * The server applies those on the binding's own dataset.
 */
export function runtimeFilters(
  filters: { value: unknown }[],
): RuntimeFilterValue[] {
  const result: RuntimeFilterValue[] = [];
  for (const filter of filters) {
    const items = Array.isArray(filter.value) ? filter.value : [filter.value];
    for (const value of items) {
      if (isSelectFilterValue(value) && value.values.length > 0) {
        result.push({
          datasetId: value.datasetId,
          column: value.column,
          values: value.values,
        });
      } else if (isDateRangeFilterValue(value)) {
        result.push({
          datasetId: value.datasetId,
          column: value.column,
          op: 'TEMPORAL_RANGE',
          timeRange: value.timeRange,
        });
      }
    }
  }
  return result;
}

export interface PlacementData {
  rows: DataRow[];
  /** The query that ran; only for users who can view queries. */
  query?: string;
  language?: string;
}

/**
 * A placement's data. The server builds the query from the placement's
 * stored binding, so the page, MCP tools and reports run the same query.
 */
export async function fetchPlacementData({
  canvasId,
  placementId,
  draftToken,
  versionUuid,
  filters,
  timeGrain,
  dimension,
  templateParams,
}: {
  canvasId: number;
  placementId: string;
  draftToken?: string;
  /** Read the placement as this version saved it. */
  versionUuid?: string;
  filters: RuntimeFilterValue[];
  timeGrain?: string;
  dimension?: string;
  templateParams?: Record<string, unknown>;
}): Promise<PlacementData> {
  const headers = {
    ...(draftToken ? { [DRAFT_TOKEN_HEADER]: draftToken } : {}),
    ...(versionUuid ? { [VERSION_HEADER]: versionUuid } : {}),
  };
  const { json } = await SupersetClient.post({
    endpoint: `/api/v1/canvas/${canvasId}/placement/${encodeURIComponent(
      placementId,
    )}/data`,
    headers,
    jsonPayload: {
      runtime_filters: filters,
      ...(timeGrain ? { time_grain: timeGrain } : {}),
      ...(dimension ? { dimension } : {}),
      ...(templateParams && Object.keys(templateParams).length > 0
        ? { template_params: templateParams }
        : {}),
    },
  });
  const dataset = json?.result?.datasets?.[0];
  return {
    rows: dataset?.inline_data ?? [],
    query: dataset?.query,
    language: dataset?.language,
  };
}
