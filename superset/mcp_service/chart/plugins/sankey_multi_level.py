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

"""Multi-level Sankey chart type plugin."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, ClassVar

from superset.mcp_service.chart.chart_utils import (
    _summarize_filters,
    map_sankey_multi_level_config,
)
from superset.mcp_service.chart.plugin import BaseChartPlugin
from superset.mcp_service.chart.schemas import ColumnRef, SankeyMultiLevelChartConfig
from superset.mcp_service.chart.validation.dataset_validator import DatasetValidator
from superset.mcp_service.common.error_schemas import ChartGenerationError


class SankeyMultiLevelChartPlugin(BaseChartPlugin):
    """Plugin for sankey_multi_level chart type."""

    chart_type = "sankey_multi_level"
    display_name = "Multi-Level Sankey"
    native_viz_types: ClassVar[Mapping[str, str]] = {
        "sankey_multi_level": "Multi-Level Sankey",
    }

    def pre_validate(
        self,
        config: dict[str, Any],
    ) -> ChartGenerationError | None:
        missing_fields = []
        groupby = (
            config.get("groupby")
            or config.get("group_by")
            or config.get("stages")
            or config.get("dimensions")
        )
        if not groupby or (isinstance(groupby, list) and len(groupby) < 2):
            missing_fields.append("'groupby' (at least 2 stage columns)")
        if "metric" not in config:
            missing_fields.append("'metric' (flow value metric)")

        if missing_fields:
            return ChartGenerationError(
                error_type="missing_sankey_fields",
                message=(
                    f"Multi-Level Sankey chart missing required fields: "
                    f"{', '.join(missing_fields)}"
                ),
                details=(
                    "Multi-Level Sankey diagrams require at least 2 stage columns in "
                    "'groupby' and a 'metric' sizing the flows between stages."
                ),
                suggestions=[
                    "Add 'groupby': [{'name': 'source_stage'}, {'name': 'target_stage'}]",
                    "Add 'metric': {'name': 'volume', 'aggregate': 'SUM'}",
                ],
                error_code="MISSING_SANKEY_FIELDS",
            )
        return None

    def extract_column_refs(self, config: Any) -> list[ColumnRef]:
        if not isinstance(config, SankeyMultiLevelChartConfig):
            return []
        refs: list[ColumnRef] = [*config.groupby, config.metric]
        if config.filters:
            for f in config.filters:
                refs.append(ColumnRef(name=f.column))
        return refs

    def to_form_data(
        self, config: Any, dataset_id: int | str | None = None
    ) -> dict[str, Any]:
        return map_sankey_multi_level_config(config)

    def generate_name(self, config: Any, dataset_name: str | None = None) -> str:
        stages = " \u2192 ".join(g.name or "" for g in config.groupby[:3] if g.name)
        metric_label = (
            config.metric.label or config.metric.name or config.metric.sql_expression
        )
        what = f"Sankey ({stages}) by {metric_label}" if stages else f"Sankey ({metric_label})"
        context = _summarize_filters(config.filters)
        return self._with_context(what, context)

    def resolve_viz_type(self, config: Any) -> str:
        return "sankey_multi_level"

    def normalize_column_refs(self, config: Any, dataset_context: Any) -> Any:
        config_dict = config.model_dump(exclude_unset=True)
        for col in config_dict.get("groupby") or []:
            if not col.get("sql_expression") and not col.get("saved_metric"):
                col["name"] = DatasetValidator.get_canonical_column_name(
                    col["name"], dataset_context
                )
        if config_dict.get("metric"):
            if config_dict["metric"].get("sql_expression"):
                pass
            elif config_dict["metric"].get("saved_metric"):
                config_dict["metric"]["name"] = (
                    DatasetValidator.get_canonical_metric_name(
                        config_dict["metric"]["name"], dataset_context
                    )
                )
            else:
                config_dict["metric"]["name"] = (
                    DatasetValidator.get_canonical_column_name(
                        config_dict["metric"]["name"], dataset_context
                    )
                )
        DatasetValidator.normalize_filters(config_dict, dataset_context)
        return SankeyMultiLevelChartConfig.model_validate(config_dict)

    def schema_error_hint(self) -> ChartGenerationError | None:
        return ChartGenerationError(
            error_type="sankey_validation_error",
            message="Multi-Level Sankey chart configuration validation failed",
            details=(
                "The Sankey configuration is missing required fields "
                "or has fewer than 2 stage columns in 'groupby'"
            ),
            suggestions=[
                "Ensure 'groupby' has at least 2 stage columns",
                "Ensure 'metric' field has 'name' and 'aggregate'",
                "Example: {'chart_type': 'sankey_multi_level', "
                "'groupby': [{'name': 'channel'}, {'name': 'status'}], "
                "'metric': {'name': 'orders', 'aggregate': 'COUNT'}}",
            ],
            error_code="SANKEY_VALIDATION_ERROR",
        )
