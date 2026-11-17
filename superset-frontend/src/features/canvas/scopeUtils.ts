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
import type { canvas as canvasApi } from '@apache-superset/core';
import type { CanvasDefinitionResult } from './types';

/** Resolve a placement's widget props, checking both inline and shared widget entries. */
export function nodePropsOf(
  result: Pick<CanvasDefinitionResult, 'definition' | 'widgets'>,
  nodeId: string,
): Record<string, unknown> | undefined {
  const node = result.definition?.nodes?.[nodeId];
  if (!node) return undefined;
  return node.widgetId
    ? (
        result.widgets?.[node.widgetId] ??
        result.definition?.widgets?.[node.widgetId]
      )?.props
    : node.props;
}

/** Extract the numeric datasetId from a widget's props, if present. */
export function datasetIdOf(
  props: Record<string, unknown> | undefined,
): number | null {
  if (!props) return null;
  if (typeof props.datasetId === 'number') return props.datasetId;
  const binding = props.dataBinding as Record<string, unknown> | undefined;
  return typeof binding?.datasetId === 'number' ? binding.datasetId : null;
}

/** Return true if a target widget's props reference the given parameter name. */
export function widgetBindsParam(
  props: Record<string, unknown> | undefined,
  paramName: string,
): boolean {
  if (!props || !paramName) return false;
  const chrome = props.chrome as Record<string, unknown> | undefined;
  if (
    chrome?.targetParam === paramName ||
    chrome?.timeGrainParam === paramName ||
    chrome?.dimensionParam === paramName ||
    chrome?.metricParam === paramName ||
    props.targetParam === paramName ||
    props.thresholdParam === paramName
  ) {
    return true;
  }
  const token = `{{${paramName}}}`;
  return ['message', 'content', 'label'].some(key => {
    const val = props[key];
    return typeof val === 'string' && val.includes(token);
  });
}

/**
 * Narrow raw scope targets to the widgets actually driven by `sourceId`:
 * - `customization` (parameter): widgets that bind `paramName` (if `name` is set).
 * - `filter` / `crossFilter`: widgets sharing `datasetId` when both sides specify one.
 */
export function resolveEffectiveTargets(
  kind: canvasApi.ScopeKind,
  sourceId: string,
  rawTargets: string[],
  getProps: (nodeId: string) => Record<string, unknown> | undefined,
): string[] {
  const srcProps = getProps(sourceId);
  if (kind === 'customization') {
    const paramName = typeof srcProps?.name === 'string' ? srcProps.name : '';
    return paramName
      ? rawTargets.filter(id => widgetBindsParam(getProps(id), paramName))
      : rawTargets;
  }
  const srcDatasetId = datasetIdOf(srcProps);
  if (srcDatasetId === null) return rawTargets;
  return rawTargets.filter(id => {
    const targetDatasetId = datasetIdOf(getProps(id));
    return targetDatasetId === null || targetDatasetId === srcDatasetId;
  });
}
