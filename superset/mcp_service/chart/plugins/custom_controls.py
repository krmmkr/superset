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

"""Custom controls filter chart type plugin."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, ClassVar

from superset.mcp_service.chart.chart_utils import (
    _summarize_filters,
    map_custom_controls_config,
)
from superset.mcp_service.chart.plugin import BaseChartPlugin
from superset.mcp_service.chart.schemas import ColumnRef, CustomControlsChartConfig
from superset.mcp_service.chart.validation.dataset_validator import DatasetValidator
from superset.mcp_service.common.error_schemas import ChartGenerationError


class CustomControlsChartPlugin(BaseChartPlugin):
    """Plugin for custom_controls chart type."""

    chart_type = "custom_controls"
    display_name = "Custom Controls"
    native_viz_types: ClassVar[Mapping[str, str]] = {
        "custom_controls": "Custom Controls",
    }

    def pre_validate(
        self,
        config: dict[str, Any],
    ) -> ChartGenerationError | None:
        if not any(
            k in config for k in ("filter_column", "filterColumn", "column")
        ):
            return ChartGenerationError(
                error_type="missing_custom_controls_fields",
                message="Custom controls chart missing required field: filter_column",
                details=(
                    "Custom controls charts require a 'filter_column' specifying "
                    "which column to filter on and fetch options for"
                ),
                suggestions=[
                    "Add 'filter_column': {'name': 'category'}",
                    "Optional: set 'control_type' to 'Dropdown', 'Radio', "
                    "'Checkbox', or 'TextBox'",
                ],
                error_code="MISSING_CUSTOM_CONTROLS_FIELDS",
            )
        return None

    def extract_column_refs(self, config: Any) -> list[ColumnRef]:
        if not isinstance(config, CustomControlsChartConfig):
            return []
        refs: list[ColumnRef] = [config.filter_column]
        if config.filters:
            for f in config.filters:
                refs.append(ColumnRef(name=f.column))
        return refs

    def to_form_data(
        self, config: Any, dataset_id: int | str | None = None
    ) -> dict[str, Any]:
        return map_custom_controls_config(config)

    def generate_name(self, config: Any, dataset_name: str | None = None) -> str:
        col_name = config.filter_column.label or config.filter_column.name
        what = f"{col_name} {config.control_type} Control"
        context = _summarize_filters(config.filters)
        return self._with_context(what, context)

    def resolve_viz_type(self, config: Any) -> str:
        return "custom_controls"

    def normalize_column_refs(self, config: Any, dataset_context: Any) -> Any:
        config_dict = config.model_dump(exclude_unset=True)
        col = config_dict.get("filter_column")
        if col and not col.get("sql_expression") and not col.get("saved_metric"):
            col["name"] = DatasetValidator.get_canonical_column_name(
                col["name"], dataset_context
            )
        DatasetValidator.normalize_filters(config_dict, dataset_context)
        return CustomControlsChartConfig.model_validate(config_dict)

    def schema_error_hint(self) -> ChartGenerationError | None:
        return ChartGenerationError(
            error_type="custom_controls_validation_error",
            message="Custom controls configuration validation failed",
            details=(
                "The custom controls configuration is missing required fields "
                "or has invalid structure"
            ),
            suggestions=[
                "Ensure 'filter_column' has 'name' pointing at a column",
                "Example: {'chart_type': 'custom_controls', "
                "'filter_column': {'name': 'region'}, "
                "'control_type': 'Dropdown'}",
            ],
            error_code="CUSTOM_CONTROLS_VALIDATION_ERROR",
        )
