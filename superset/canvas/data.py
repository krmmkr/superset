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
"""
A placement's data, queried on the server from its stored ``dataBinding``.

The binding always comes from the canvas (or draft) definition; a caller only
adds runtime filters, which narrow the binding's own dataset. The canvas page,
MCP tools and anything else reading a placement therefore run the same query.
This stands in for SIP-231's ``build_queries`` until widgets declare their own.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from superset.utils.core import GenericDataType

# Values a select filter publishes.
FilterScalar = str | int | float | bool

ALLOWED_TIME_GRAINS: frozenset[str] = frozenset(
    {
        "PT1S",
        "PT1M",
        "PT5M",
        "PT10M",
        "PT15M",
        "PT30M",
        "PT1H",
        "PT6H",
        "P1D",
        "P1W",
        "P1M",
        "P3M",
        "P1Y",
    }
)

TIME_GRAIN_ALIASES: dict[str, str] = {
    "second": "PT1S",
    "minute": "PT1M",
    "5 minutes": "PT5M",
    "10 minutes": "PT10M",
    "15 minutes": "PT15M",
    "30 minutes": "PT30M",
    "hour": "PT1H",
    "6 hours": "PT6H",
    "day": "P1D",
    "week": "P1W",
    "month": "P1M",
    "quarter": "P3M",
    "year": "P1Y",
}


def normalize_time_grain(value: str | None) -> str | None:
    """Accept ISO-8601 durations (e.g. ``P1M``) or human labels (e.g. ``Month``)."""
    if value is None:
        return None
    stripped = value.strip()
    if stripped in ALLOWED_TIME_GRAINS:
        return stripped
    if (mapped := TIME_GRAIN_ALIASES.get(stripped.lower())) is not None:
        return mapped
    raise ValueError(f"Unsupported time_grain: {value!r}")


class RuntimeFilter(BaseModel):
    """A filter value reaching the placement, as the canvas filter bus has it."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    dataset_id: int = Field(alias="datasetId")
    column: str = Field(min_length=1)
    op: Literal["IN", "TEMPORAL_RANGE"] = "IN"
    values: list[FilterScalar] = Field(default_factory=list, max_length=10_000)
    time_range: str | None = Field(default=None, alias="timeRange")


class PlacementDataRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    runtime_filters: list[RuntimeFilter] = Field(default_factory=list, max_length=100)
    time_grain: str | None = Field(default=None, max_length=32)
    dimension: str | None = Field(default=None, min_length=1, max_length=255)
    metric: str | None = Field(default=None, min_length=1, max_length=255)
    template_params: dict[str, Any] = Field(default_factory=dict)

    @field_validator("time_grain")
    @classmethod
    def _validate_time_grain(cls, value: str | None) -> str | None:
        return normalize_time_grain(value)


@dataclass(frozen=True)
class PlacementData:
    rows: list[dict[str, Any]]
    # The query that produced the rows, as the datasource ran it.
    query: str | None
    language: str | None


def binding_dataset_id(props: dict[str, Any]) -> int | None:
    binding = props.get("dataBinding")
    if not isinstance(binding, dict):
        return None
    dataset_id = binding.get("datasetId")
    return dataset_id if isinstance(dataset_id, int) and dataset_id > 0 else None


def _apply_dimension_and_time_grain(
    binding: dict[str, Any],
    metrics: list[Any],
    *,
    time_grain: str | None,
    dimension: str | None,
    metric: str | None = None,
) -> tuple[list[Any], list[Any], list[list[Any]]]:
    """Resolve metrics, dimensions, time-grain wrapping, and orderby."""

    def label(item: Any) -> Any:
        return item.get("label") if isinstance(item, dict) else item

    original_metric = label(metrics[0]) if metrics else None
    effective_metrics = list(metrics)
    if metric:
        matched = next((m for m in metrics if label(m) == metric), metric)
        matched_label = label(matched)
        effective_metrics = [
            matched,
            *(m for m in metrics[1:] if label(m) != matched_label),
        ]

    columns: list[Any] = [d for d in binding.get("dimensions") or [] if d]
    original_dim = columns[0] if columns and isinstance(columns[0], str) else None
    if dimension:
        columns = [dimension, *columns[1:]] if columns else [dimension]

    def resolve_order_field(field: str) -> Any:
        if metric and original_metric is not None and field == original_metric:
            return effective_metrics[0]
        if dimension and original_dim and field == original_dim:
            return dimension
        return next((m for m in effective_metrics if label(m) == field), field)

    orderby = [
        [resolve_order_field(key["field"]), not key.get("descending", False)]
        for key in binding.get("orderBy") or []
    ]

    effective_grain = normalize_time_grain(time_grain or binding.get("timeGrain"))
    if effective_grain and columns:
        target_col = binding.get("timeGrainColumn") or (
            columns[0] if isinstance(columns[0], str) else None
        )
        if isinstance(target_col, str):
            columns = [
                {
                    "sqlExpression": col,
                    "columnType": "BASE_AXIS",
                    "timeGrain": effective_grain,
                    "label": col,
                }
                if col == target_col
                else col
                for col in columns
            ]
    return effective_metrics, columns, orderby


def query_context_payload(
    binding: dict[str, Any],
    runtime_filters: list[RuntimeFilter] | None = None,
    *,
    time_grain: str | None = None,
    dimension: str | None = None,
    metric: str | None = None,
    template_params: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """A chart data query context for ``binding``, narrowed by the runtime
    filters on the binding's dataset."""
    metrics = [m for m in binding.get("metrics") or [] if m not in (None, "")]
    filters: list[dict[str, Any]] = []
    where: list[str] = []
    for adhoc in binding.get("filters") or []:
        if adhoc.get("expressionType") == "SQL":
            if adhoc.get("sqlExpression"):
                where.append(f"({adhoc['sqlExpression']})")
        elif adhoc.get("subject"):
            filters.append(
                {
                    "col": adhoc["subject"],
                    "op": adhoc.get("operator"),
                    "val": adhoc.get("comparator"),
                }
            )
    for runtime in runtime_filters or []:
        if runtime.dataset_id != binding["datasetId"]:
            continue
        if runtime.op == "TEMPORAL_RANGE" and runtime.time_range:
            filters.append(
                {
                    "col": runtime.column,
                    "op": "TEMPORAL_RANGE",
                    "val": runtime.time_range,
                }
            )
        elif runtime.values:
            filters.append({"col": runtime.column, "op": "IN", "val": runtime.values})

    effective_metrics, columns, orderby = _apply_dimension_and_time_grain(
        binding,
        metrics,
        time_grain=time_grain,
        dimension=dimension,
        metric=metric,
    )

    query_obj: dict[str, Any] = {
        "columns": columns,
        "metrics": effective_metrics,
        "filters": filters,
        "extras": {"where": " AND ".join(where)} if where else {},
        "orderby": orderby,
        "row_limit": binding.get("rowLimit") or 1000,
    }
    if template_params:
        query_obj["template_params"] = template_params

    return {
        "datasource": {"id": binding["datasetId"], "type": "table"},
        "queries": [query_obj],
        "result_format": "json",
        "result_type": "full",
    }


def _format_temporal_value(value: Any, grain: str | None) -> Any:
    """Convert Superset's epoch-millisecond temporal scalars into readable labels."""
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return value
    # Guard against formatting plain numeric years/counts (e.g. 2004) as 1970-01-01.
    if abs(value) < 86_400_000:
        return value
    try:
        dt = datetime.fromtimestamp(value / 1000, tz=timezone.utc)
    except (OverflowError, OSError, ValueError):
        return value
    if grain == "P1Y":
        return dt.strftime("%Y")
    if grain == "P3M":
        return f"{dt.year}-Q{(dt.month - 1) // 3 + 1}"
    if grain == "P1M":
        return dt.strftime("%Y-%m")
    if grain in {"P1W", "P1D"} or (
        grain is None and dt.hour == 0 and dt.minute == 0 and dt.second == 0
    ):
        return dt.strftime("%Y-%m-%d")
    return dt.strftime("%Y-%m-%d %H:%M:%S" if dt.second else "%Y-%m-%d %H:%M")


def _format_temporal_rows(
    rows: list[dict[str, Any]],
    colnames: list[str] | None,
    coltypes: list[GenericDataType] | None,
    grain: str | None,
    extra_temporal_cols: set[str] | None = None,
) -> list[dict[str, Any]]:
    """Format temporal columns in query rows so charts show dates instead of ms."""
    if not rows:
        return rows
    temporal_cols: set[str] = set(extra_temporal_cols or ())
    if colnames and coltypes:
        temporal_cols.update(
            name
            for name, coltype in zip(colnames, coltypes, strict=False)
            if coltype == GenericDataType.TEMPORAL
        )
    if not temporal_cols:
        return rows
    return [
        {
            **row,
            **{
                col: _format_temporal_value(row[col], grain)
                for col in temporal_cols
                if col in row
            },
        }
        for row in rows
    ]


def run_binding(
    binding: dict[str, Any],
    runtime_filters: list[RuntimeFilter] | None = None,
    *,
    time_grain: str | None = None,
    dimension: str | None = None,
    metric: str | None = None,
    template_params: dict[str, Any] | None = None,
) -> PlacementData:
    """
    Run a binding's query as the caller, through the chart data pipeline:
    dataset access, row level security and caching apply as for any chart.

    Raises what ``ChartDataCommand`` raises: ``SupersetSecurityException``
    without dataset access, ``DatasourceNotFound``, ``QueryObjectValidationError``
    or ``ChartDataQueryFailedError``.
    """
    from superset.charts.schemas import ChartDataQueryContextSchema
    from superset.commands.chart.data.get_data_command import ChartDataCommand

    effective_grain = normalize_time_grain(time_grain or binding.get("timeGrain"))
    query_context = ChartDataQueryContextSchema().load(
        query_context_payload(
            binding,
            runtime_filters,
            time_grain=effective_grain,
            dimension=dimension,
            metric=metric,
            template_params=template_params,
        )
    )
    command = ChartDataCommand(query_context)
    command.validate()
    result = command.run()["queries"][0]
    dttm_cols: set[str] = set(getattr(query_context.datasource, "dttm_cols", []) or [])
    if effective_grain:
        dims = [d for d in binding.get("dimensions") or [] if isinstance(d, str) and d]
        target_col = binding.get("timeGrainColumn") or (dims[0] if dims else None)
        if isinstance(target_col, str):
            dttm_cols.add(target_col)
    rows = _format_temporal_rows(
        result.get("data") or [],
        result.get("colnames"),
        result.get("coltypes"),
        effective_grain,
        extra_temporal_cols=dttm_cols,
    )
    return PlacementData(
        rows=rows,
        query=result.get("query") or None,
        language=getattr(query_context.datasource, "query_language", None),
    )
