# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

"""Custom Calendar Heatmap chart type plugin."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, ClassVar

from superset.mcp_service.chart.chart_utils import (
    _summarize_filters,
    map_calendar_heatmap_custom_config,
)
from superset.mcp_service.chart.plugin import BaseChartPlugin
from superset.mcp_service.chart.schemas import (
    CalendarHeatmapCustomChartConfig,
    ColumnRef,
)
from superset.mcp_service.chart.validation.dataset_validator import DatasetValidator
from superset.mcp_service.common.error_schemas import ChartGenerationError


class CalendarHeatmapCustomChartPlugin(BaseChartPlugin):
    """Plugin for calendar_heatmap_custom chart type."""

    chart_type = "calendar_heatmap_custom"
    display_name = "Custom Calendar Heatmap"
    native_viz_types: ClassVar[Mapping[str, str]] = {
        "calendar_heatmap_custom": "Custom Calendar Heatmap",
    }

    def pre_validate(
        self,
        config: dict[str, Any],
    ) -> ChartGenerationError | None:
        missing_fields = []
        if not any(
            k in config for k in ("temporal_column", "granularity_sqla", "date_column", "x")
        ):
            missing_fields.append("'temporal_column' (date/datetime column)")
        if not any(k in config for k in ("metrics", "metric", "y")):
            missing_fields.append("'metrics' (one or more metrics)")

        if missing_fields:
            return ChartGenerationError(
                error_type="missing_calendar_heatmap_fields",
                message=(
                    f"Custom Calendar Heatmap missing required fields: "
                    f"{', '.join(missing_fields)}"
                ),
                details=(
                    "Calendar heatmaps require a 'temporal_column' for the date cells "
                    "and 'metrics' to color and label each day."
                ),
                suggestions=[
                    "Add 'temporal_column': 'order_date'",
                    "Add 'metrics': [{'name': 'revenue', 'aggregate': 'SUM'}]",
                ],
                error_code="MISSING_CALENDAR_HEATMAP_FIELDS",
            )
        return None

    def extract_column_refs(self, config: Any) -> list[ColumnRef]:
        if not isinstance(config, CalendarHeatmapCustomChartConfig):
            return []
        refs: list[ColumnRef] = [
            ColumnRef(name=config.temporal_column),
            *config.metrics,
            *(config.tooltip_metrics or []),
        ]
        if config.filters:
            for f in config.filters:
                refs.append(ColumnRef(name=f.column))
        return refs

    def to_form_data(
        self, config: Any, dataset_id: int | str | None = None
    ) -> dict[str, Any]:
        return map_calendar_heatmap_custom_config(config)

    def generate_name(self, config: Any, dataset_name: str | None = None) -> str:
        first_metric = config.metrics[0] if config.metrics else None
        metric_label = (
            (first_metric.label or first_metric.name or first_metric.sql_expression)
            if first_metric
            else "Value"
        )
        what = f"{metric_label} Calendar Heatmap"
        context = _summarize_filters(config.filters)
        return self._with_context(what, context)

    def resolve_viz_type(self, config: Any) -> str:
        return "calendar_heatmap_custom"

    def normalize_column_refs(self, config: Any, dataset_context: Any) -> Any:
        config_dict = config.model_dump(exclude_unset=True)
        if config_dict.get("temporal_column"):
            config_dict["temporal_column"] = DatasetValidator.get_canonical_column_name(
                config_dict["temporal_column"], dataset_context
            )
        for mlist_key in ("metrics", "tooltip_metrics"):
            for m in config_dict.get(mlist_key) or []:
                if m.get("sql_expression"):
                    pass
                elif m.get("saved_metric"):
                    m["name"] = DatasetValidator.get_canonical_metric_name(
                        m["name"], dataset_context
                    )
                else:
                    m["name"] = DatasetValidator.get_canonical_column_name(
                        m["name"], dataset_context
                    )
        DatasetValidator.normalize_filters(config_dict, dataset_context)
        return CalendarHeatmapCustomChartConfig.model_validate(config_dict)

    def schema_error_hint(self) -> ChartGenerationError | None:
        return ChartGenerationError(
            error_type="calendar_heatmap_validation_error",
            message="Custom Calendar Heatmap configuration validation failed",
            details=(
                "The calendar heatmap configuration is missing required fields "
                "or has invalid structure"
            ),
            suggestions=[
                "Ensure 'temporal_column' is a valid date/datetime column name",
                "Ensure 'metrics' has at least one metric with 'name' and 'aggregate'",
                "Example: {'chart_type': 'calendar_heatmap_custom', "
                "'temporal_column': 'order_date', "
                "'metrics': [{'name': 'revenue', 'aggregate': 'SUM'}]}",
            ],
            error_code="CALENDAR_HEATMAP_VALIDATION_ERROR",
        )
