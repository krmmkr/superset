/* eslint-disable camelcase */
/**
 * Licensed under the Apache License, Version 2.0
 * Superset Calendar Heatmap Plugin - Build Query
 */
import {
  buildQueryContext,
  QueryFormData,
  QueryFormColumn,
} from '@superset-ui/core';

export default function buildQuery(formData: QueryFormData) {
  const {
    metrics = [],
    tooltip_metrics: tooltipMetricsSnake = [],
    tooltipMetrics = [],
  } = formData as any;
  const rawMetricsList = [
    ...(Array.isArray(metrics) ? metrics : [metrics]),
    ...(Array.isArray(tooltipMetricsSnake)
      ? tooltipMetricsSnake
      : [tooltipMetricsSnake]),
    ...(Array.isArray(tooltipMetrics) ? tooltipMetrics : [tooltipMetrics]),
  ].filter(Boolean);

  const seenLabels = new Set<string>();
  const allMetrics = rawMetricsList.filter(m => {
    const label =
      typeof m === 'object' && m !== null
        ? m.label || m.column_name || JSON.stringify(m)
        : String(m);
    if (seenLabels.has(label)) return false;
    seenLabels.add(label);
    return true;
  });

  let parsedGranularity = formData.granularity_sqla;
  let isCustomSql = false;

  if (typeof parsedGranularity === 'object' && parsedGranularity !== null) {
    const sqlExpr =
      (parsedGranularity as any).sqlExpression ||
      (parsedGranularity as any).column_name;
    const labelStr = (parsedGranularity as any).label || 'temporal_column';

    if (sqlExpr) {
      // Format it tightly as an AdhocColumn so it can be injected into generic `columns`
      parsedGranularity = {
        sqlExpression: sqlExpr,
        label: labelStr,
        expressionType: 'SQL',
      } as any;
      isCustomSql = true;
    } else {
      parsedGranularity = String(parsedGranularity);
    }
  }

  // Force P1D (1 Day) aggregation if the user hasn't explicitly set a different time grain.
  // Calendar Heatmaps fundamentally require daily aggregation to display correctly.
  const updatedFormData = {
    ...formData,
    // Drop granularity entirely if Custom SQL, to bypass legacy validation
    granularity_sqla: isCustomSql
      ? null
      : (parsedGranularity as any)?.label || parsedGranularity,
    time_grain_sqla: formData.time_grain_sqla || 'P1D',
  };

  return buildQueryContext(updatedFormData, baseQueryObject => [
    {
      ...baseQueryObject,
      metrics: allMetrics.length ? allMetrics : [],
      // Modern Echarts Approach: If Custom SQL, treat it as a generic grouping column
      columns: isCustomSql
        ? [
            parsedGranularity as QueryFormColumn,
            ...(baseQueryObject.columns || []),
          ]
        : baseQueryObject.columns,
      // Opt out of legacy `is_timeseries` checks if Custom SQL, so `helpers.py` doesn't enforce physical columns
      is_timeseries: !isCustomSql,
    },
  ]);
}
