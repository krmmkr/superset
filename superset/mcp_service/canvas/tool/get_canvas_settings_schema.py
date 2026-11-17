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

"""MCP tool: get_canvas_settings_schema"""

from __future__ import annotations

from typing import Any

from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.canvas.definition.schemas import (
    DEFINITION_VERSION,
    Settings,
    SettingsKey,
)
from superset.mcp_service.canvas.schemas import CanvasSettingsSchemaResponse

_SETTINGS_KEYS: list[str] = ["refresh", "colors", "display", "crossFilters"]


def _get_canvas_settings_schema_impl(
    key: SettingsKey | None = None,
) -> dict[str, Any]:
    """Return the JSON schema for canvas-level ``settings`` (all or one key)."""
    schema = Settings.model_json_schema(by_alias=True)
    if key is not None and key in schema.get("properties", {}):
        section = schema["properties"][key]
        scoped: dict[str, Any] = {
            "type": "object",
            "properties": {key: section},
        }
        if "$defs" in schema:
            scoped["$defs"] = schema["$defs"]
        return {
            "definition_version": DEFINITION_VERSION,
            "keys": _SETTINGS_KEYS,
            "settings_schema": scoped,
        }
    return {
        "definition_version": DEFINITION_VERSION,
        "keys": _SETTINGS_KEYS,
        "settings_schema": schema,
    }


@tool(
    tags=["discovery"],
    class_permission_name="Canvas",
    annotations=ToolAnnotations(
        title="Get canvas settings schema",
        readOnlyHint=True,
        destructiveHint=False,
        openWorldHint=False,
    ),
)
def get_canvas_settings_schema(
    key: SettingsKey | None = None,
) -> CanvasSettingsSchemaResponse:
    """Return the JSON schema for canvas-level ``settings`` used by ``set_settings``.

    Pass ``key`` (``"refresh"``, ``"colors"``, ``"display"``, or
    ``"crossFilters"``) to scope the schema to one section, or omit it for all
    sections. Use ``display`` to discover per-widget ``cardStyles``
    (``backgroundColor``, ``borderless``, ``hideTitle``, ``titleAlign``,
    ``subtitle``), ``titleAlign``, ``hiddenTitles``, and ``showTimestamps``.
    """
    return CanvasSettingsSchemaResponse.model_validate(
        _get_canvas_settings_schema_impl(key)
    )
