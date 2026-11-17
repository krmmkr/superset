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
Pydantic control models for built-in Dashboard V2 widgets.

Field aliases are the camelCase names the frontend reads from ``node.props``
(e.g. ``datasetId``); Pydantic emits JSON Schema by alias by default, so the
served schema's property names match what widgets and ``fetchQueryData`` use.

Genuinely-required controls (``datasetId``, ``metrics``, ``dataBinding``) carry
no default so they land in the schema's ``required`` array. That is what makes
the MCP "minimum viable object" view meaningful: it surfaces exactly those
mandatory leaves, leaving optional/styling fields behind a drill-in.
"""

from __future__ import annotations

from typing import Any, ClassVar, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.json_schema import SkipJsonSchema
from superset_core.widgets import MetricControl


class SortKey(BaseModel):
    """One sort key of a ``dataBinding``: a metric label or a dimension."""

    field: str = Field(
        min_length=1,
        description="A metric's label or a dimension column name.",
    )
    descending: bool = False


class DataBinding(MetricControl):
    """Query binding for a data-backed widget (mirrors the frontend
    ``DataBindingSpec``). ``datasetId`` and ``metrics`` are mandatory; the rest
    are optional."""

    model_config = ConfigDict(populate_by_name=True)

    # Pydantic places an inherited field (``metrics``, from ``MetricControl``)
    # ahead of this class's own fields in ``model_fields`` regardless of
    # declaration order, so the rendered field order needs to be pinned
    # explicitly to match what this class served before composing MetricControl.
    field_order: ClassVar[list[str]] = [
        "datasetId",
        "metrics",
        "dimensions",
        "timeGrain",
        "timeGrainColumn",
        "orderBy",
        "rowLimit",
    ]

    dataset_id: int = Field(
        alias="datasetId",
        title="Dataset ID",
        description="Numeric id of the dataset to query.",
    )
    dimensions: list[str] = Field(
        default_factory=list,
        title="Dimensions",
        description="Columns to group by (the categories / series).",
        json_schema_extra={"x-control": "column-multi"},
    )
    time_grain: str | None = Field(
        default=None,
        alias="timeGrain",
        title="Time grain",
        description=(
            "Optional time grain (Hour, Day, Week, Month, Quarter, Year, or "
            "ISO-8601 duration) applied to the temporal dimension."
        ),
        json_schema_extra={
            "x-control": "select",
            "x-options": ["Hour", "Day", "Week", "Month", "Quarter", "Year"],
        },
    )
    time_grain_column: str | None = Field(
        default=None,
        alias="timeGrainColumn",
        title="Time grain column",
        description=(
            "Datetime column to truncate when `timeGrain` is set. "
            "Defaults to the first dimension when omitted."
        ),
    )
    # No `x-control` yet authors it through the control panel or MCP — it's
    # populated by other means (e.g. a dashboard filter binding a chart).
    # `SkipJsonSchema` keeps it out of the control schema (so `field_order`
    # doesn't need it) while still round-tripping through `model_dump`;
    # without it, committing the backend-normalized dump (see
    # `commitWidgetProps`) would silently discard any authored filters, since
    # Pydantic's default `extra="ignore"` drops fields the model doesn't
    # declare.
    filters: SkipJsonSchema[list[dict[str, Any]]] = Field(default_factory=list)
    row_limit: int = Field(
        default=1000,
        ge=1,
        alias="rowLimit",
        title="Row limit",
        description="Maximum number of rows to fetch.",
    )
    order_by: list[SortKey] = Field(
        default_factory=list,
        alias="orderBy",
        title="Sort",
        description=(
            "Sort keys applied before the row limit, e.g. "
            '`[{"field": "revenue", "descending": true}]` for a top N.'
        ),
    )


class MetricTileControls(BaseModel):
    """Controls for the ``metric-tile`` widget (a single "big number")."""

    model_config = ConfigDict(populate_by_name=True)

    data_binding: DataBinding = Field(
        alias="dataBinding",
        title="Data",
        description=(
            "The query behind the tile. Resolve one metric; the first result "
            "row's value is shown."
        ),
    )
    decimals: int = Field(
        default=0,
        ge=0,
        le=10,
        title="Decimal places",
        description="How many decimal places to show.",
    )
    prefix: str = Field(
        default="",
        title="Prefix",
        description='Text shown before the value (e.g. "$").',
    )
    suffix: str = Field(
        default="",
        title="Suffix",
        description='Text shown after the value (e.g. "%").',
    )
    label: str = Field(
        default="",
        title="Label",
        description="Caption under the number. Defaults to the column name.",
    )
    target_param: str = Field(
        default="",
        alias="targetParam",
        title="Target parameter",
        description=(
            "Optional parameter name from a Parameter widget; compares the "
            "metric against that live target."
        ),
    )
    show_delta: bool = Field(
        default=False,
        alias="showDelta",
        title="Show period delta",
        description=(
            "When two or more rows are returned, display the percentage change "
            "between the first and second row."
        ),
    )
    show_sparkline: bool = Field(
        default=False,
        alias="showSparkline",
        title="Show sparkline",
        description=(
            "When multiple rows are returned, render a compact trend sparkline "
            "beneath the metric."
        ),
    )
    comparison_label: str = Field(
        default="",
        alias="comparisonLabel",
        title="Comparison label",
        description='Optional label next to the delta (e.g. "vs prior period").',
    )
    abbreviate: bool = Field(
        default=False,
        title="Compact number format",
        description="Format large numbers with compact suffixes (K, M, B, T).",
    )
    invert_delta: bool = Field(
        default=False,
        alias="invertDelta",
        title="Invert delta polarity",
        description=(
            "Treat decreases as positive (green) and increases as negative "
            "(red), useful for cost, latency, or churn metrics."
        ),
    )
    target: float | None = Field(
        default=None,
        title="Static target",
        description=(
            "Optional static target value used for target delta and progress "
            "bar when no target parameter is bound."
        ),
    )
    show_progress: bool = Field(
        default=False,
        alias="showProgress",
        title="Show target progress bar",
        description=(
            "Render a progress bar toward the resolved target value "
            "(from targetParam or static target)."
        ),
    )
    align: Literal["left", "center", "right"] = Field(
        default="left",
        title="Alignment",
        description="Horizontal text alignment inside the KPI card.",
    )
    sparkline_area: bool = Field(
        default=False,
        alias="sparklineArea",
        title="Sparkline area fill",
        description="Fill the area beneath the sparkline curve.",
    )
    accent_color: str = Field(
        default="",
        alias="accentColor",
        title="Accent color",
        description="Optional CSS color for a left accent bar and sparkline.",
    )


class AgGridTableControls(BaseModel):
    """Controls for the ``ag-grid-table`` widget (query results as a table)."""

    model_config = ConfigDict(populate_by_name=True)

    data_binding: DataBinding = Field(
        alias="dataBinding",
        title="Data",
        description="The query whose rows fill the table.",
    )
    column_defs: list[dict[str, Any]] = Field(
        default_factory=list,
        alias="columnDefs",
        title="Column definitions",
        description=(
            "Optional column definitions (field, headerName, prefix, suffix, "
            "decimals). When empty, columns are derived from the query result."
        ),
        json_schema_extra={"x-control": "code", "x-language": "json"},
    )
    conditional_formatting: list[dict[str, Any]] = Field(
        default_factory=list,
        alias="conditionalFormatting",
        title="Conditional formatting",
        description=(
            "Optional list of conditional color rules ({column, operator, "
            "value, valueTo, tone, color, backgroundColor})."
        ),
        json_schema_extra={"x-control": "code", "x-language": "json"},
    )
    threshold_param: str = Field(
        default="",
        alias="thresholdParam",
        title="Threshold parameter",
        description=(
            "Optional numeric parameter name from a Parameter widget; highlights "
            "the first numeric column against that live threshold."
        ),
    )
    page_size: int = Field(
        default=10,
        ge=0,
        le=500,
        alias="pageSize",
        title="Page size",
        description="Number of rows per page (0 disables pagination).",
    )
    header_bg_color: str = Field(
        default="",
        alias="headerBgColor",
        title="Header background color",
        description="Optional CSS color for the table header background.",
    )
    header_text_color: str = Field(
        default="",
        alias="headerTextColor",
        title="Header text color",
        description="Optional CSS color for the table header text.",
    )
    striped: bool = Field(
        default=False,
        title="Striped rows",
        description="Shade alternating table rows for easier scanning.",
    )
    sortable: bool = Field(
        default=True,
        title="Sortable columns",
        description="Allow clicking column headers to sort rows.",
    )
    cross_filter: bool = Field(
        default=False,
        alias="crossFilter",
        title="Emit cross-filter",
        description=(
            "Click a table row to filter other widgets in scope by the first dimension."
        ),
    )
    searchable: bool = Field(
        default=False,
        title="Show search box",
        description="Display a quick-filter search input above the table.",
    )
    density: Literal["compact", "normal", "comfortable"] = Field(
        default="compact",
        title="Row density",
        description="Vertical spacing for table rows.",
        json_schema_extra={
            "x-control": "select",
            "x-options": ["compact", "normal", "comfortable"],
        },
    )
    wrap_text: bool = Field(
        default=False,
        alias="wrapText",
        title="Wrap cell text",
        description="Wrap long cell values across multiple lines instead of clipping.",
    )


class SeriesStyle(BaseModel):
    """Per-series balloon styling, populated dynamically once the grouping
    dimension is set and its distinct values are known."""

    color: str = Field(
        default="#e74c3c",
        title="Color",
        json_schema_extra={"x-control": "color"},
    )
    size_scale: float = Field(
        default=1.0,
        ge=0.25,
        le=4.0,
        alias="sizeScale",
        title="Size scale (×)",
        description=(
            "Multiplier on the metric-derived balloon size for this series "
            "(1 = as-is, 2 = twice as big)."
        ),
        json_schema_extra={"x-step": 0.25},
    )


class Customization(BaseModel):
    """Per-series customization for the balloons widget.

    ``series`` is ``x-dynamic``: empty until the ``dataBinding`` grouping
    dimension is set, then the backend fills in one styled entry per distinct
    dimension value the frontend discovered from the query results.
    """

    series: dict[str, SeriesStyle] = Field(
        default_factory=dict,
        title="Per-series styling",
        json_schema_extra={
            "x-dynamic": True,
            "x-dependsOn": ["dataBinding"],
            # The valid keys of this map are the distinct values of the widget's
            # color dimension — named by the ``colorDimension`` prop, or the last
            # ``dataBinding`` dimension when that's unset. Declaring the source
            # lets a generic client enumerate/validate the keys (rather than a
            # consumer guessing values like "F" for "girl").
            "x-key-source": {
                "dimensionFromProp": "colorDimension",
                "fallback": "lastDimension",
            },
        },
    )


class BalloonsControls(BaseModel):
    """Controls for the ``balloons`` chart widget (Chart Framework v2 POC).

    One balloon per query row, colored and sized per series (the distinct
    values of the first grouping dimension). ``customize`` is optional and
    populated on demand.
    """

    model_config = ConfigDict(populate_by_name=True)

    data_binding: DataBinding = Field(
        alias="dataBinding",
        title="Data",
        description=(
            "The query behind the balloons. Group by one or more dimensions "
            "(one balloon per resulting row); the metric sizes each balloon."
        ),
    )
    color_dimension: str = Field(
        default="",
        alias="colorDimension",
        title="Color dimension",
        description=(
            "Which grouping dimension colors the balloons — its distinct values "
            "become the customizable series. The value MUST be one of "
            "`dataBinding.dimensions`; if the dimension you want to color by "
            "isn't grouped yet, add it to `dimensions` as well (it is not enough "
            "to name it here). Leave empty to color by the last dimension. "
            'E.g. to color by gender: set this to "gender" AND include "gender" '
            'in dimensions (e.g. dimensions ["name", "gender"]).'
        ),
        json_schema_extra={"x-control": "column"},
    )
    customize: Customization = Field(
        default_factory=Customization,
        title="Customize",
        description="Per-series color and size overrides.",
    )

    @model_validator(mode="after")
    def _color_dimension_must_be_grouped(self) -> "BalloonsControls":
        """``colorDimension`` colors balloons by a dimension's distinct values,
        so that dimension must actually be grouped. Naming it here without
        adding it to ``dataBinding.dimensions`` would silently color by nothing;
        surface it as a validation error instead (the message tells the caller
        exactly what to fix)."""
        dimensions = self.data_binding.dimensions
        if self.color_dimension and self.color_dimension not in dimensions:
            raise ValueError(
                f'colorDimension "{self.color_dimension}" must be one of the '
                f"dataBinding dimensions {dimensions}; add it to `dimensions` "
                f"as well."
            )
        return self


class MarkdownControls(BaseModel):
    """Controls for the ``markdown`` widget (rich text)."""

    model_config = ConfigDict(populate_by_name=True)

    content: str = Field(
        title="Text",
        description=(
            "Markdown content rendered by the widget. With a dataBinding, "
            "`{{alias}}` is replaced by the first row's value for a metric "
            "or dimension alias, `{{alias|format}}` formats a number with a "
            "d3-format string (e.g. `{{revenue|$,.2s}}`), and "
            "`{{#rows}}...{{/rows}}` repeats its content once per row."
        ),
        json_schema_extra={"x-control": "markdown"},
    )
    data_binding: DataBinding | None = Field(
        default=None,
        alias="dataBinding",
        title="Data",
        description="Optional query whose results fill the content's placeholders.",
    )


class SeriesOverride(BaseModel):
    """One structured chart series' visual override, matched to a
    ``dataBinding`` metric by its stable label (the same label ECharts'
    `getMetricLabel`-equivalent computes and the query result column is
    named after), not by array position."""

    color: str = Field(
        default="",
        title="Color",
        description="Empty keeps the palette-assigned default.",
        json_schema_extra={"x-control": "color"},
    )
    visible: bool = Field(
        default=True,
        title="Visible",
        description="Unchecking omits this series from the rendered chart.",
    )
    display_name: str = Field(
        default="",
        alias="displayName",
        title="Display name",
        description=(
            "Overrides the series' legend/tooltip label. Empty keeps the "
            "metric's own label."
        ),
    )


class EchartsCustomization(BaseModel):
    """Per-series overrides for a structured (``chartType`` set) echarts
    chart.

    ``series`` is ``x-dynamic``: inlined with one entry per ``dataBinding``
    metric once ``chartType`` is set, plus any already-stored override whose
    metric was since removed from ``dataBinding.metrics`` — so switching
    metrics around doesn't silently discard configuration (see
    ``Echarts._populate_chart_series``).
    """

    series: dict[str, SeriesOverride] = Field(
        default_factory=dict,
        title="Per-series overrides",
        json_schema_extra={
            "x-dynamic": True,
            "x-dependsOn": ["dataBinding", "chartType"],
        },
    )


class EchartsChrome(BaseModel):
    """Structured chart chrome — title, legend, tooltip, axis labels — each
    field independently optional and layered on top of the matching
    `echartsOptions` section. A field left at its default doesn't touch
    `echartsOptions` at all; only the specific key(s) a set field manages are
    merged onto that section, so an unmanaged sibling property there (e.g. a
    hand-authored `legend.orient`) survives.

    Deliberately flat (not grouped into `title`/`legend`/`tooltip`/`xAxis`/
    `yAxis` sub-objects — the natural modeling) rather than nested two levels
    under `chrome`: JsonForms' generated control panel only renders one level
    of nested-object properties (the same depth `DataBinding`/`Customization`
    already rely on), so a `chrome.title.text`-style double nesting would
    render an empty group with no fields inside it.
    """

    model_config = ConfigDict(populate_by_name=True)

    title_text: str = Field(
        default="",
        alias="titleText",
        title="Title",
        description="Empty leaves echartsOptions.title exactly as authored.",
    )
    legend_show: bool = Field(
        default=True,
        alias="legendShow",
        title="Show legend",
        description="Unchecking hides the legend, regardless of echartsOptions.",
    )
    legend_position: Literal["top", "bottom", "left", "right"] | None = Field(
        default=None,
        alias="legendPosition",
        title="Legend position",
        description=(
            "Unset leaves echartsOptions.legend's own position (or "
            "ECharts' default) untouched."
        ),
        json_schema_extra={
            "x-control": "select",
            "x-options": ["top", "bottom", "left", "right"],
        },
    )
    tooltip_trigger: Literal["item", "axis"] | None = Field(
        default=None,
        alias="tooltipTrigger",
        title="Tooltip trigger",
        description=(
            "Unset leaves echartsOptions.tooltip's own trigger (or "
            "ECharts' default) untouched."
        ),
        json_schema_extra={
            "x-control": "select",
            "x-options": ["item", "axis"],
        },
    )
    tooltip_show: bool = Field(
        default=True,
        alias="tooltipShow",
        title="Show tooltip",
        description="Uncheck to disable hover tooltips on the chart.",
    )
    tooltip_format: str = Field(
        default="",
        alias="tooltipFormat",
        title="Tooltip format",
        description='ECharts tooltip template (e.g. "{b}: ${c}").',
    )
    label_show: bool = Field(
        default=False,
        alias="labelShow",
        title="Show data labels",
        description="Display value labels directly on chart elements.",
    )
    label_position: Literal["top", "inside", "bottom", "left", "right"] | None = Field(
        default=None,
        alias="labelPosition",
        title="Data label position",
        description="Placement of value labels relative to each bar/point.",
        json_schema_extra={
            "x-control": "select",
            "x-options": ["top", "inside", "bottom", "left", "right"],
        },
    )
    label_format: str = Field(
        default="",
        alias="labelFormat",
        title="Data label format",
        description='ECharts label template (e.g. "${c}" or "{c}%").',
    )
    label_color: str = Field(
        default="",
        alias="labelColor",
        title="Data label color",
        description="Text color for chart data labels.",
        json_schema_extra={"x-control": "color"},
    )
    label_font_size: int | None = Field(
        default=None,
        ge=8,
        le=32,
        alias="labelFontSize",
        title="Data label font size",
        description="Font size in pixels for chart data labels.",
    )
    label_rotate: int = Field(
        default=0,
        ge=-90,
        le=90,
        alias="labelRotate",
        title="Data label rotation (°)",
        description="0 leaves the series' own `label.rotate` untouched.",
    )
    label_decimals: int | None = Field(
        default=None,
        ge=0,
        le=10,
        alias="labelDecimals",
        title="Data label decimals",
        description="Optional decimal places for numeric data labels.",
    )
    x_axis_name: str = Field(
        default="",
        alias="xAxisName",
        title="X axis name",
        description="Empty leaves the axis's own `name` (or none) untouched.",
    )
    x_axis_rotate: int = Field(
        default=0,
        ge=-90,
        le=90,
        alias="xAxisRotate",
        title="X axis label rotation (°)",
        description="0 leaves the axis's own `axisLabel.rotate` (or none) untouched.",
    )
    x_axis_format: str = Field(
        default="",
        alias="xAxisFormat",
        title="X axis label format",
        description=(
            'An ECharts axisLabel formatter template, e.g. "{value} kg". Empty '
            "leaves the axis's own `axisLabel.formatter` (or none) untouched."
        ),
    )
    x_axis_date_format: str = Field(
        default="",
        alias="xAxisDateFormat",
        title="X axis date format",
        description=(
            'Optional date format pattern (e.g. "YYYY-MM-DD", "MMM D, YYYY", '
            '"MM/DD") applied to X axis date labels.'
        ),
    )
    y_axis_name: str = Field(
        default="",
        alias="yAxisName",
        title="Y axis name",
        description="Empty leaves the axis's own `name` (or none) untouched.",
    )
    y_axis_rotate: int = Field(
        default=0,
        ge=-90,
        le=90,
        alias="yAxisRotate",
        title="Y axis label rotation (°)",
        description="0 leaves the axis's own `axisLabel.rotate` (or none) untouched.",
    )
    y_axis_format: str = Field(
        default="",
        alias="yAxisFormat",
        title="Y axis label format",
        description=(
            'An ECharts axisLabel formatter template, e.g. "{value} kg". Empty '
            "leaves the axis's own `axisLabel.formatter` (or none) untouched."
        ),
    )
    target_param: str = Field(
        default="",
        alias="targetParam",
        title="Target parameter",
        description=(
            "Optional parameter name (from a Parameter widget in scope) whose "
            "numeric value renders as a horizontal target markLine on Cartesian charts."
        ),
    )
    scroll_mode: Literal["none", "zoombar", "scrollbar"] = Field(
        default="none",
        alias="scrollMode",
        title="Horizontal scroll mode",
        description=(
            "Optional X-axis horizontal scrolling for wide datasets: 'zoombar' "
            "adds an interactive ECharts dataZoom slider; 'scrollbar' locks the "
            "window to `visibleBars` items with a horizontal scrollbar."
        ),
        json_schema_extra={
            "x-control": "select",
            "x-options": ["none", "zoombar", "scrollbar"],
        },
    )
    visible_bars: int | None = Field(
        default=None,
        ge=1,
        le=500,
        alias="visibleBars",
        title="Visible bars / points",
        description=(
            "Number of X-axis categories shown at once when `scrollMode` is "
            "'scrollbar' (defaults to 15) or initial window in 'zoombar' mode."
        ),
    )
    time_grain_param: str = Field(
        default="",
        alias="timeGrainParam",
        title="Time grain parameter",
        description=(
            "Optional Parameter widget name whose value overrides "
            "dataBinding.timeGrain (e.g. P1D, P1W, P1M)."
        ),
    )
    dimension_param: str = Field(
        default="",
        alias="dimensionParam",
        title="Dimension parameter",
        description=(
            "Optional Parameter widget name whose value overrides the first "
            "grouping dimension."
        ),
    )
    metric_param: str = Field(
        default="",
        alias="metricParam",
        title="Metric parameter",
        description=(
            "Optional Parameter widget name whose value overrides the first metric."
        ),
    )
    number_format: Literal["none", "compact", "currency", "percent"] = Field(
        default="none",
        alias="numberFormat",
        title="Number format",
        description=(
            "Compact number formatting applied to value axis ticks, data "
            "labels, and tooltips."
        ),
        json_schema_extra={
            "x-control": "select",
            "x-options": ["none", "compact", "currency", "percent"],
        },
    )
    currency_symbol: str = Field(
        default="$",
        alias="currencySymbol",
        title="Currency symbol",
        description="Prefix symbol used when `numberFormat` is 'currency'.",
    )
    above_target_color: str = Field(
        default="",
        alias="aboveTargetColor",
        title="Above-target color",
        description="Color for bars/points at or above `targetParam`.",
        json_schema_extra={"x-control": "color"},
    )
    below_target_color: str = Field(
        default="",
        alias="belowTargetColor",
        title="Below-target color",
        description="Color for bars/points below `targetParam`.",
        json_schema_extra={"x-control": "color"},
    )
    stack: bool = Field(
        default=False,
        title="Stack series",
        description="Stack Cartesian bar/line/area series on the same stack group.",
    )
    horizontal: bool = Field(
        default=False,
        title="Horizontal bars",
        description=(
            "Swap X and Y axes on Cartesian charts so bars render horizontally."
        ),
    )
    y_axis_min: float | None = Field(
        default=None,
        alias="yAxisMin",
        title="Y axis minimum",
        description="Optional fixed lower bound for the value axis.",
    )
    y_axis_max: float | None = Field(
        default=None,
        alias="yAxisMax",
        title="Y axis maximum",
        description="Optional fixed upper bound for the value axis.",
    )
    show_grid_lines: bool = Field(
        default=True,
        alias="showGridLines",
        title="Show grid lines",
        description="Uncheck to hide value-axis split grid lines.",
    )


class EchartsControls(BaseModel):
    """Controls for the ``echarts`` widget (a chart from a raw ECharts option).

    Not modeled field-by-field: ``echartsOptions`` is a near-raw ECharts
    ``option`` edited as JSON, with ``$bind`` markers splicing in the queried
    data. The query itself is the standard ``dataBinding``.

    ``chartType``/``customize`` are an optional structured layer on top:
    when ``chartType`` is set, the frontend replaces `option.series` with one
    generated series per ``dataBinding`` metric (styled per ``customize``).
    Leaving ``chartType`` unset ("Custom") keeps ``echartsOptions.series``
    fully authoritative, including mixed-series or non-Cartesian (e.g. pie)
    shapes the structured layer doesn't cover.

    ``chrome`` is a second, independent structured layer — title, legend,
    tooltip, and axis labels — each leaf optional and applying (or not)
    regardless of ``chartType``. See ``EchartsChrome`` for its own
    leaf-by-leaf precedence.
    """

    model_config = ConfigDict(populate_by_name=True)

    data_binding: DataBinding = Field(
        alias="dataBinding",
        title="Data",
        description="The query whose rows the ECharts option's $bind markers read.",
    )
    echarts_options: dict[str, Any] = Field(
        default_factory=dict,
        alias="echartsOptions",
        title="ECharts option",
        description=(
            "A near-raw ECharts 6 `option` object "
            "(https://echarts.apache.org/en/option.html). Anywhere a literal "
            "value would normally go, use a $bind marker to splice in the "
            'queried data or a theme token: {"$bind": {"source": "metric", '
            '"alias": "<metric name>"}} or {"source": "dimension", "alias": '
            '"<column name>"}} yields one array of that column\'s values (add '
            '"single": true to unwrap a single-row value); {"$bind": {"source": '
            '"records", "fields": {"name": "<col>", "value": "<col>"}}} yields '
            "an array of {name, value} objects (e.g. for pie series data; a "
            'dotted key such as "label.fontSize" nests); {"$bind": {"source": '
            '"tuples", "fields": ["<col>", "<col>", ...]}} yields one array per '
            "row, for series whose data items are arrays (themeRiver, "
            "candlestick, boxplot, heatmap); and "
            '{"$bind": {"source": "theme", "token": "<token>"}} yields a Superset '
            "theme value. The $bind wrapper is required. Function-valued "
            "options (formatter functions, renderItem) are not allowed; use "
            "template strings. Features new in ECharts 6 are available: a "
            "beeswarm is a scatter on a category axis with `jitter` and "
            "`jitterOverlap: false`, and an axis takes `breaks` to skip a "
            "value range."
        ),
        json_schema_extra={
            "x-control": "code",
            "x-language": "json",
            "x-spec-dialect": "echarts",
            # The Inspector's JSON tab already edits the whole `node.props`
            # record as text — including this field — so a second, redundant
            # raw-JSON box in the Form tab just duplicates it. Hidden there;
            # still fully editable via the JSON tab (or `chartType`/
            # `customize` for what those manage).
            "x-hidden-in-form": True,
        },
    )
    chart_type: (
        Literal[
            "bar",
            "line",
            "scatter",
            "sankey",
            "calendar",
            "treemap",
            "sunburst",
            "tree",
        ]
        | None
    ) = Field(
        default=None,
        alias="chartType",
        title="Chart type",
        description=(
            "Renders a structured chart — one series per dataBinding metric — "
            "layered on top of echartsOptions. Leave unset ('Custom') to use "
            "echartsOptions exactly as authored, including mixed-series or "
            "non-Cartesian (e.g. pie) configurations. Pie isn't offered here: "
            "its data shape (one series, categories as data points) doesn't "
            "match the one-series-per-metric model this picker drives."
        ),
        json_schema_extra={
            "x-control": "select",
            "x-options": [
                "bar",
                "line",
                "scatter",
                "sankey",
                "calendar",
                "treemap",
                "sunburst",
                "tree",
            ],
        },
    )
    customize: EchartsCustomization = Field(
        default_factory=EchartsCustomization,
        title="Customize",
        description="Per-series color, visibility, and display-name overrides.",
    )
    chrome: EchartsChrome = Field(
        default_factory=EchartsChrome,
        title="Chrome",
        description="Structured title, legend, tooltip, and axis label overrides.",
    )
    cross_filter: bool = Field(
        default=False,
        alias="crossFilter",
        title="Cross-filter on click",
        description=(
            "Emit a cross-filter from the first grouping dimension when a "
            "point is clicked (requires dataBinding.dimensions to have at "
            "least one entry). Clicking the same point again clears it."
        ),
    )
    drill_down: bool = Field(
        default=False,
        alias="drillDown",
        title="Drill-down on click",
        description=(
            "When multiple dimensions are bound on a Cartesian chart, clicking "
            "a point drills into the next dimension with a breadcrumb trail."
        ),
    )
    fit_mode: Literal["auto", "fit", "scroll"] = Field(
        default="auto",
        alias="fitMode",
        title="Sizing mode",
        description=(
            "'auto' scrolls only when needed (e.g. multi-year calendars); "
            "'fit' always scales to the widget box without scrollbars; "
            "'scroll' preserves minimum readable dimensions."
        ),
    )


class FilterSelectControls(BaseModel):
    """Controls for the ``filter.select`` widget (a value/multi-select
    dashboard filter).

    Deliberately not a ``dataBinding`` — a filter has no metrics, just a
    target column. ``datasetId``'s enum (every dataset the caller can view)
    and ``column``'s enum (that dataset's own columns, populated once
    ``datasetId`` is set) are both populated dynamically — see
    ``FilterSelect.enrichers``.
    """

    model_config = ConfigDict(populate_by_name=True)

    dataset_id: int = Field(
        alias="datasetId",
        title="Dataset ID",
        description="Numeric id of the dataset this filter targets.",
        json_schema_extra={"x-dynamic": True},
    )
    # Defaulted (unlike `dataset_id`) even though a real filter needs one:
    # the control panel posts control_values as the author fills fields in,
    # and until a dataset is chosen there's no `column` value to send at
    # all. Without a default, validating that partial payload would raise
    # on the *missing* field, `Widget.get_control_schema` would swallow that
    # and fall back to `parsed=None`, and the column enricher would never
    # see the `dataset_id` it needs to populate this very field's `enum` —
    # i.e. picking a dataset would never turn `column` into a working
    # dropdown. `min_length=1` keeps an explicit empty value invalid at
    # commit time (`validate_control_values`), since Pydantic only checks
    # defaults against a field's validators when asked to, not on every
    # validate() (see `validate_default` if that ever needs to change).
    column: str = Field(
        default="",
        min_length=1,
        title="Column",
        description="The column this filter constrains.",
        json_schema_extra={"x-dynamic": True, "x-dependsOn": ["datasetId"]},
    )
    # Both hidden from the generated Form (see `x-hidden` in `buildUiSchema`):
    # a raw string-list "Add one at a time" control is more clutter than help
    # for what's meant to be an edge case, not the primary way to configure a
    # filter. Still real fields — present in the schema/JSON tab and fully
    # functional — just not offered as a first-class Form control.
    options: list[str] = Field(
        default_factory=list,
        title="Options",
        description=(
            "Optional static list of selectable values. Leave empty to query "
            "the target column's own distinct values at render time instead."
        ),
        json_schema_extra={"x-hidden": True},
    )
    default_selection: list[str] = Field(
        default_factory=list,
        alias="defaultSelection",
        title="Default selection",
        description=(
            "Starting selection, applied once the first time this filter "
            "renders with no live viewer selection yet."
        ),
        json_schema_extra={"x-hidden": True},
    )
    label: str = Field(
        default="",
        title="Label",
        description="Optional label shown above the filter control.",
    )
    display_mode: Literal["select", "checkbox", "radio"] = Field(
        default="select",
        alias="displayMode",
        title="Display mode",
        description="Render as a dropdown select, checkbox group, or radio buttons.",
    )
    orientation: Literal["horizontal", "vertical"] = Field(
        default="horizontal",
        title="Orientation",
        description="Layout direction when displayMode is checkbox or radio.",
    )


class FilterBarControls(BaseModel):
    """Controls for the ``filter.bar`` widget — a plain arranging container
    for ``filter.*`` children; it holds no data of its own."""

    model_config = ConfigDict(populate_by_name=True)

    orientation: Literal["horizontal", "vertical"] = Field(
        default="horizontal",
        title="Orientation",
        description="Whether filters lay out side by side or stacked.",
    )


class TabsControls(BaseModel):
    """Controls for the ``tabs`` container; its tabs are its children."""

    model_config = ConfigDict(populate_by_name=True)


class TabControls(BaseModel):
    """Controls for a ``tab`` inside ``tabs``."""

    model_config = ConfigDict(populate_by_name=True)

    title: str = Field(
        default="",
        title="Title",
        description="The tab's label.",
    )
    row_span: int | None = Field(
        default=None,
        alias="rowSpan",
        ge=1,
        title="Tab height (rows)",
        description=(
            "Optional explicit height in grid rows for this tab in view mode."
        ),
    )


class GroupControls(BaseModel):
    """Controls for a ``group``: a container with its own grid."""

    model_config = ConfigDict(populate_by_name=True)

    title: str = Field(
        default="",
        title="Title",
        description="Optional heading shown above the group.",
    )


class FilterDateRangeControls(BaseModel):
    """Controls for the ``filter.date_range`` widget (a temporal range filter)."""

    model_config = ConfigDict(populate_by_name=True)

    dataset_id: int = Field(
        alias="datasetId",
        title="Dataset ID",
        description="Numeric id of the dataset this filter targets.",
        json_schema_extra={"x-dynamic": True},
    )
    column: str = Field(
        default="",
        min_length=1,
        title="Column",
        description="Temporal column name on the dataset to filter.",
        json_schema_extra={"x-dynamic": True},
    )
    label: str = Field(
        default="",
        title="Label",
        description="Optional label shown next to the date range picker.",
    )
    default_range: str = Field(
        default="",
        alias="defaultRange",
        title="Default time range",
        description='Optional initial preset (e.g. "Last 7 days", "Last 30 days").',
    )


class CalloutControls(BaseModel):
    """Controls for a ``callout`` insight/notice box."""

    model_config = ConfigDict(populate_by_name=True)

    variant: Literal["info", "success", "warning", "error"] = Field(
        default="info",
        title="Variant",
        description="Visual tone of the callout box.",
    )
    title: str = Field(
        default="",
        title="Title",
        description="Short heading for the callout.",
    )
    message: str = Field(
        default="",
        title="Message",
        description="Body text of the callout.",
    )


class HeaderControls(BaseModel):
    """Controls for a ``header`` section banner."""

    model_config = ConfigDict(populate_by_name=True)

    title: str = Field(
        default="",
        title="Title",
        description="Primary heading text.",
    )
    subtitle: str = Field(
        default="",
        title="Subtitle",
        description="Optional supporting description beneath the heading.",
    )
    level: int = Field(
        default=3,
        ge=1,
        le=5,
        title="Heading level",
        description="HTML heading level (1 = largest, 5 = smallest).",
    )


class PivotTableControls(BaseModel):
    """Controls for the ``pivot-table`` widget (cross-tabulated summary)."""

    model_config = ConfigDict(populate_by_name=True)

    data_binding: DataBinding = Field(
        alias="dataBinding",
        title="Data",
        description="The query behind the pivot table.",
    )
    row_fields: list[str] = Field(
        default_factory=list,
        alias="rowFields",
        title="Row dimensions",
        description="Dimension columns used for pivot rows.",
    )
    column_fields: list[str] = Field(
        default_factory=list,
        alias="columnFields",
        title="Column dimensions",
        description="Dimension columns used for pivot columns.",
    )
    metric: str = Field(
        default="",
        title="Value column",
        description="Numeric column to aggregate. Defaults to the first numeric column.",
    )
    label: str = Field(
        default="",
        title="Title",
        description="Optional title used for export and maximize modal.",
    )
    show_row_totals: bool = Field(
        default=True,
        alias="showRowTotals",
        title="Show row totals",
        description="Append a Total column summing each row.",
    )
    show_col_totals: bool = Field(
        default=True,
        alias="showColTotals",
        title="Show column totals",
        description="Append a Total row summing each column.",
    )
    decimals: int = Field(
        default=0,
        ge=0,
        le=10,
        title="Decimal places",
        description="How many decimal places to display.",
    )
    prefix: str = Field(default="", title="Prefix")
    suffix: str = Field(default="", title="Suffix")
    conditional_formatting: list[dict[str, Any]] = Field(
        default_factory=list,
        alias="conditionalFormatting",
        title="Conditional formatting",
        description=(
            "Optional list of conditional color rules ({operator, value, "
            "valueTo, tone, color, backgroundColor})."
        ),
        json_schema_extra={"x-control": "code", "x-language": "json"},
    )
    cross_filter: bool = Field(
        default=False,
        alias="crossFilter",
        title="Cross-filter on click",
        description=(
            "Emit a cross-filter when a row dimension cell or data cell is clicked. "
            "Clicking the same cell again clears it."
        ),
    )
    display_mode: Literal["value", "row_percent", "col_percent", "total_percent"] = (
        Field(
            default="value",
            alias="displayMode",
            title="Display mode",
            description=(
                "Show raw values or percentages of row, column, or grand total."
            ),
            json_schema_extra={
                "x-control": "select",
                "x-options": ["value", "row_percent", "col_percent", "total_percent"],
            },
        )
    )
    compact_numbers: bool = Field(
        default=False,
        alias="compactNumbers",
        title="Compact numbers",
        description="Abbreviate large numbers (e.g. 1.2M, 450K).",
    )
    freeze_row_fields: bool = Field(
        default=True,
        alias="freezeRowFields",
        title="Freeze row columns",
        description=(
            "Pin row dimension columns on the left when scrolling horizontally."
        ),
    )


class ParameterOption(BaseModel):
    """Display label and emitted value for a ``parameter`` select option."""

    label: str = Field(min_length=1, title="Label")
    value: bool | str | int | float = Field(title="Value")


class ParameterControls(BaseModel):
    """Controls for a Tableau-style ``parameter`` widget."""

    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(
        min_length=1,
        title="Parameter name",
        description="Key published to target widgets (e.g. 'salesTarget').",
    )
    label: str = Field(
        default="",
        title="Label",
        description="Display label shown above the parameter input.",
    )
    input_type: Literal["number", "slider", "select", "text", "switch"] = Field(
        default="number",
        alias="inputType",
        title="Input type",
        description="UI control for adjusting the parameter value.",
    )
    default_value: bool | str | int | float = Field(
        default=0,
        alias="defaultValue",
        title="Default value",
        description="Initial parameter value published on load.",
    )
    on_value: bool | str | int | float = Field(
        default=True,
        alias="onValue",
        title="Switch ON value",
        description="Value published when inputType is 'switch' and toggled on.",
    )
    off_value: bool | str | int | float = Field(
        default=False,
        alias="offValue",
        title="Switch OFF value",
        description="Value published when inputType is 'switch' and toggled off.",
    )
    min_value: float | None = Field(
        default=None,
        alias="minValue",
        title="Minimum value",
    )
    max_value: float | None = Field(
        default=None,
        alias="maxValue",
        title="Maximum value",
    )
    step: float = Field(default=1, gt=0, title="Step")
    options: list[str | ParameterOption] = Field(
        default_factory=list,
        title="Options",
        description=(
            "Selectable values (or `{label, value}` pairs) when inputType is 'select'."
        ),
    )
