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
import { ReactNode, useCallback, useMemo, useState } from 'react';
import type { canvas as canvasApi } from '@apache-superset/core';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import {
  Button,
  Icons,
  Input,
  Popover,
  Switch,
  Tag,
  Tooltip,
} from '@superset-ui/core/components';
import { ErrorBoundary } from 'src/components/ErrorBoundary';
import { useWidgetRenderers } from 'src/core';
import CanvasGridSurface from './CanvasGridSurface';
import type { CanvasLayout } from './useCanvasLayout';
import {
  CanvasDefinitionResult,
  CardStyle,
  DraftChange,
  GridPlacement,
} from './types';
import { MARKS, OUTLINED } from './changeMarks';
import {
  CanvasDraftContext,
  CanvasFilterValuesContext,
  CanvasVersionContext,
} from './useWidgetRows';
import { CanvasDragProvider } from './useCanvasDrag';
import { CanvasActiveTabContext } from './widgetChrome';
import { fitPlacements } from './resolveGrid';

/** Current values set by nodes, per scope kind, by node id. */
export type ScopeValues = Record<canvasApi.ScopeKind, Record<string, unknown>>;

export const emptyScopeValues = (): ScopeValues => ({
  filter: {},
  crossFilter: {},
  customization: {},
});

/** Current values published under other kinds, by kind, by node id. */
export type EventValues = Record<string, Record<string, unknown>>;

const SCOPE_KINDS: ReadonlySet<string> = new Set<canvasApi.ScopeKind>([
  'filter',
  'crossFilter',
  'customization',
]);

const NO_VALUES: canvasApi.FilterValue[] = [];
const NO_EVENTS: canvasApi.CanvasEvent[] = [];

/** The key the root grid's child order is reported under. */
const ROOT_NODE_ID = 'root';

/** For each node, the values that reach it from the nodes whose scope includes it. */
function valuesByNode(
  scopes: Record<string, string[]>,
  values: Record<string, unknown>,
): Record<string, canvasApi.FilterValue[]> {
  const byNode: Record<string, canvasApi.FilterValue[]> = {};
  Object.entries(scopes).forEach(([filterNodeId, targets]) => {
    if (values[filterNodeId] === undefined) return;
    targets.forEach(nodeId => {
      (byNode[nodeId] ??= []).push({
        filterNodeId,
        value: values[filterNodeId],
      });
    });
  });
  return byNode;
}

function eventsByNode(
  scopes: Record<string, string[]>,
  events: EventValues,
): Record<string, canvasApi.CanvasEvent[]> {
  const byNode: Record<string, canvasApi.CanvasEvent[]> = {};
  Object.entries(events).forEach(([kind, values]) => {
    Object.entries(valuesByNode(scopes, values)).forEach(
      ([nodeId, reaching]) => {
        reaching.forEach(({ filterNodeId, value }) => {
          (byNode[nodeId] ??= []).push({
            kind,
            sourceNodeId: filterNodeId,
            value,
          });
        });
      },
    );
  });
  return byNode;
}
const Stack = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 2}px;
  `}
`;

/** Never squeezed by a long title, and no taller than the row it sits in. */
const Mark = styled(Tag)`
  ${({ theme }) => css`
    flex: none;
    margin: 0;
    line-height: ${theme.sizeUnit * 5}px;
  `}
`;

const Titled = styled.div<{
  $mark?: DraftChange['kind'];
  $bg?: string;
  $borderless?: boolean;
  $highlighted?: boolean;
}>`
  ${({ theme, $mark, $bg, $borderless, $highlighted }) => css`
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit}px;
    ${
      $bg &&
      css`
        background: ${$bg};
        border-radius: ${theme.borderRadius}px;
      `
    }
    ${
      $borderless &&
      css`
        border: none;
        box-shadow: none;
      `
    }
    ${
      $highlighted &&
      css`
        box-shadow: inset 0 0 0 2px ${theme.colorPrimary};
        border-radius: ${theme.borderRadius}px;
        transition: box-shadow 0.15s ease;
      `
    }
    ${
      $mark &&
      OUTLINED.has($mark) &&
      css`
        /* Inset, so marking a widget moves nothing on the grid around it. */
        box-shadow: inset 0 0 0 2px
          ${$mark === 'new' ? theme.colorSuccess : theme.colorPrimary};
        border-radius: ${theme.borderRadius}px;
      `
    }
  `}
`;

/** Where the title sits across the strip, as `display.titleAlign` asks. */
const ALIGNMENT = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end',
} as const;

/**
 * The title row: the widget's name, and what just happened to it.
 *
 * The same strip the handles occupy, and the same height as them
 * (`sizeUnit * 8`, see `Grip`), so the name, the tag, the grip, the remove
 * button and the menu all sit on one line. Left to its content height the row
 * hugged the widget's top edge and the text read as sitting on the border
 * rather than inside it.
 *
 * The clearances are the row's rather than the title's, because the handles
 * float over the row as a whole: an unnamed widget's tag would otherwise
 * start under the grip, and a long name would push the tag under the remove
 * button.
 *
 * The alignment is the row's rather than the text's for the same reason: the
 * name and the tag beside it read as one thing, and centring the text inside
 * its own box would leave the tag stranded at the far edge of the widget.
 */
const TitleRow = styled.div<{ $align: 'left' | 'center' | 'right' }>`
  ${({ theme, $align }) => css`
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: ${ALIGNMENT[$align]};
    gap: ${theme.sizeUnit * 2}px;
    min-width: 0;
    min-height: ${theme.sizeUnit * 8}px;
    /* Clear of the grip: 4 units of corner, then its own 8. */
    padding-left: ${theme.sizeUnit * 12}px;
    /* Clear of the menu (5 units in, 8 wide) and the remove button beside it. */
    padding-right: ${theme.sizeUnit * 21}px;
  `}
`;

/**
 * A widget's name, in the strip its handles share.
 *
 * The grip sits at the top left and the remove button and menu at the top
 * right, all absolutely positioned over this row, so the title is inset past
 * both rather than running under them. Horizontal room rather than a band of
 * its own: a tile is short, and a reserved strip above every title would cost
 * more of it than the handles do.
 */
const WidgetTitle = styled.div`
  ${({ theme }) => css`
    /* Shrinks so the tag beside it is never the thing that gets cut. */
    min-width: 0;
    overflow: hidden;
    color: ${theme.colorTextHeading};
    font-size: ${theme.fontSizeLG}px;
    font-weight: ${theme.fontWeightStrong};
    line-height: ${theme.lineHeightLG};
    text-overflow: ellipsis;
    white-space: nowrap;
  `}
`;

const WidgetSubtitle = styled.div<{ $align: 'left' | 'center' | 'right' }>`
  ${({ theme, $align }) => css`
    flex-shrink: 0;
    padding-left: ${theme.sizeUnit * 12}px;
    padding-right: ${theme.sizeUnit * 21}px;
    text-align: ${$align};
    color: ${theme.colorTextSecondary};
    font-size: ${theme.fontSizeSM}px;
    line-height: ${theme.lineHeightSM};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `}
`;

const TitledBody = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
`;

function renderQuickWidgetSettings(
  widgetType: string,
  widgetProps: Record<string, unknown>,
  updateWidgetProps: (
    patch: Record<string, unknown>,
    chromePatch?: Record<string, unknown>,
  ) => void,
): React.ReactNode {
  const chrome =
    (widgetProps.chrome as Record<string, unknown> | undefined) ?? {};
  const toggleRows: Array<{
    key: string;
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
  }> = [];

  if (widgetType === 'echarts') {
    toggleRows.push(
      {
        key: 'crossFilter',
        label: t('Cross-filter'),
        checked: Boolean(widgetProps.crossFilter),
        onChange: checked => updateWidgetProps({ crossFilter: checked }),
      },
      {
        key: 'legendShow',
        label: t('Show legend'),
        checked: Boolean(chrome.legendShow),
        onChange: checked => updateWidgetProps({}, { legendShow: checked }),
      },
      {
        key: 'labelShow',
        label: t('Show labels'),
        checked: Boolean(chrome.labelShow),
        onChange: checked => updateWidgetProps({}, { labelShow: checked }),
      },
      {
        key: 'showGridLines',
        label: t('Grid lines'),
        checked: chrome.showGridLines !== false,
        onChange: checked => updateWidgetProps({}, { showGridLines: checked }),
      },
      {
        key: 'stack',
        label: t('Stacked'),
        checked: Boolean(chrome.stack),
        onChange: checked => updateWidgetProps({}, { stack: checked }),
      },
      {
        key: 'horizontal',
        label: t('Horizontal'),
        checked: Boolean(chrome.horizontal),
        onChange: checked => updateWidgetProps({}, { horizontal: checked }),
      },
    );
  } else if (widgetType === 'ag-grid-table') {
    toggleRows.push(
      {
        key: 'crossFilter',
        label: t('Cross-filter'),
        checked: Boolean(widgetProps.crossFilter),
        onChange: checked => updateWidgetProps({ crossFilter: checked }),
      },
      {
        key: 'searchable',
        label: t('Search bar'),
        checked: Boolean(widgetProps.searchable),
        onChange: checked => updateWidgetProps({ searchable: checked }),
      },
      {
        key: 'wrapText',
        label: t('Wrap text'),
        checked: Boolean(widgetProps.wrapText),
        onChange: checked => updateWidgetProps({ wrapText: checked }),
      },
    );
  } else if (widgetType === 'pivot-table') {
    toggleRows.push(
      {
        key: 'crossFilter',
        label: t('Cross-filter'),
        checked: Boolean(widgetProps.crossFilter),
        onChange: checked => updateWidgetProps({ crossFilter: checked }),
      },
      {
        key: 'compactNumbers',
        label: t('Compact numbers'),
        checked: Boolean(widgetProps.compactNumbers),
        onChange: checked => updateWidgetProps({ compactNumbers: checked }),
      },
      {
        key: 'freezeRowFields',
        label: t('Freeze row cols'),
        checked: widgetProps.freezeRowFields !== false,
        onChange: checked => updateWidgetProps({ freezeRowFields: checked }),
      },
    );
  } else {
    return null;
  }

  return (
    <StylePopoverBody
      onPointerDown={e => e.stopPropagation()}
      data-test="canvas-widget-props-popover"
    >
      {toggleRows.map(row => (
        <StyleRow key={row.key}>
          <span>{row.label}</span>
          <Switch
            size="small"
            aria-label={row.label}
            checked={row.checked}
            onChange={row.onChange}
          />
        </StyleRow>
      ))}
      {widgetType === 'echarts' && (
        <StyleRow>
          <span>{t('Format')}</span>
          <SwatchRow>
            {(
              [
                ['none', t('Raw')],
                ['compact', '1.2k'],
                ['currency', '$'],
                ['percent', '%'],
              ] as const
            ).map(([fmt, label]) => (
              <Button
                key={fmt}
                size="small"
                type={
                  (chrome.numberFormat ?? 'none') === fmt
                    ? 'primary'
                    : 'default'
                }
                onClick={() => updateWidgetProps({}, { numberFormat: fmt })}
              >
                {label}
              </Button>
            ))}
          </SwatchRow>
        </StyleRow>
      )}
      {widgetType === 'ag-grid-table' && (
        <StyleRow>
          <span>{t('Density')}</span>
          <SwatchRow>
            {(
              [
                ['compact', 'S'],
                ['normal', 'M'],
                ['comfortable', 'L'],
              ] as const
            ).map(([density, label]) => (
              <Button
                key={density}
                size="small"
                type={
                  (widgetProps.density ?? 'compact') === density
                    ? 'primary'
                    : 'default'
                }
                onClick={() => updateWidgetProps({ density })}
              >
                {label}
              </Button>
            ))}
          </SwatchRow>
        </StyleRow>
      )}
    </StylePopoverBody>
  );
}

const Placeholder = styled.div`
  ${({ theme }) => css`
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: ${theme.sizeUnit}px;
    padding: ${theme.sizeUnit * 2}px;
    border: 1px dashed ${theme.colorBorder};
    border-radius: ${theme.borderRadius}px;
    color: ${theme.colorTextSecondary};
    text-align: center;
  `}
`;

const QuickActions = styled.span`
  ${({ theme }) => css`
    display: inline-flex;
    align-items: center;
    gap: 2px;
    opacity: 0;
    transition: opacity 0.15s ease;
    .canvas-titled-card:hover &,
    .canvas-titled-card:focus-within & {
      opacity: 1;
    }
    .ant-btn {
      width: 22px;
      height: 22px;
      min-width: 22px;
      padding: 0;
      color: ${theme.colorTextTertiary};
      &:hover {
        color: ${theme.colorText};
        background: ${theme.colorFillTertiary};
      }
    }
  `}
`;

const StylePopoverBody = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 2}px;
    width: 240px;
  `}
`;

const StyleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

const SwatchRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const SwatchButton = styled.button<{ $color?: string; $active?: boolean }>`
  ${({ theme, $color, $active }) => css`
    width: 20px;
    height: 20px;
    border-radius: 50%;
    cursor: pointer;
    background: ${$color || theme.colorBgContainer};
    border: 2px solid ${$active ? theme.colorPrimary : theme.colorBorder};
    padding: 0;
  `}
`;

const CARD_BG_PRESETS = [
  { label: 'Default', value: undefined },
  { label: 'Blue', value: 'rgba(22, 119, 255, 0.10)' },
  { label: 'Green', value: 'rgba(82, 196, 26, 0.10)' },
  { label: 'Amber', value: 'rgba(250, 140, 22, 0.10)' },
  { label: 'Purple', value: 'rgba(114, 46, 209, 0.10)' },
] as const;

function widgetBindsParam(
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
  for (const key of ['message', 'content', 'label'] as const) {
    const val = props[key];
    if (typeof val === 'string' && val.includes(token)) return true;
  }
  return false;
}

export interface CanvasGridProps {
  canvasId: number;
  result: CanvasDefinitionResult;
  values: ScopeValues;
  onValueChange: (
    kind: canvasApi.ScopeKind,
    nodeId: string,
    value: unknown,
  ) => void;
  events?: EventValues;
  onPublish?: (kind: string, nodeId: string, value: unknown) => void;
  /** Per node, how many automatic refreshes have reached it. */
  refreshKeys?: Record<string, number>;
  /** Placements to render and the write path drag and resize commit through. */
  layout: CanvasLayout;
  /**
   * Whether this canvas may be rearranged by hand. Decided by the caller, not
   * read from `canEdit`: having permission is necessary but not sufficient --
   * editing happens in a plan, and the published canvas is read-only.
   */
  editable: boolean;
  /** The draft being shown; widgets read their data from it. */
  draftToken?: string;
  /** The version being previewed; widgets read their data from it. */
  versionUuid?: string;
  /** Apply draft operations (rename, set_settings, set_props) in edit mode. */
  onApplyOps?: (ops: Record<string, unknown>[]) => Promise<void>;
}

/**
 * Renders a canvas definition: nodes on the root grid, each through the
 * renderer registered for its widget type. Placement comes resolved from the
 * server, so nothing here re-implements auto-placement.
 */
export default function CanvasGrid({
  canvasId,
  result,
  values,
  onValueChange,
  events = {},
  onPublish,
  refreshKeys = {},
  layout,
  editable,
  draftToken,
  versionUuid,
  onApplyOps,
}: CanvasGridProps) {
  const [editingTitleNode, setEditingTitleNode] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [hoveredSourceId, setHoveredSourceId] = useState<string | null>(null);
  const getRenderer = useWidgetRenderers();
  const {
    definition,
    widgetTypes,
    gridColumns,
    chromeRows = {},
    eventScopes,
    titles = {},
    changes,
    widgets = {},
  } = result;
  // Span limits come from the layout rather than the fetched definition: a
  // container's row minimum follows the rows its children occupy, so a write
  // that moves a child moves the minimum with it.
  // Scopes come from the layout for the same reason: a scope follows the
  // tree, so a widget dragged from one group into another is driven by the
  // second group's filters from the moment the write lands -- not from the
  // next refetch, which a canvas with polling off never makes.
  const {
    placements,
    layouts,
    childOrder,
    layoutConstraints,
    filterScopes,
    crossFilterScopes,
    customizationScopes,
    place,
    move,
    swap,
    remove,
    removed,
  } = layout;
  /**
   * The placements with every container grown to hold what is in it.
   *
   * The server does this on the write (`_fit`), but a layout written here
   * lands optimistically and the response does not come back for a round
   * trip. A container clips what does not fit, so without this a widget
   * dropped past a group's last row is drawn cut in half at the group's edge
   * until the server says what the client could already work out.
   *
   * Falls through to the server's own answer whenever nothing needed growing,
   * which is almost always: re-deriving placements that are already right
   * gains nothing and gives the two somewhere to disagree.
   */
  const [activeTabs, setActiveTabs] = useState<Record<string, string>>({});
  const onTabChange = useCallback((tabsId: string, activeTabId: string) => {
    setActiveTabs(prev =>
      prev[tabsId] === activeTabId ? prev : { ...prev, [tabsId]: activeTabId },
    );
  }, []);

  const fitted = useMemo(() => {
    const base =
      fitPlacements(
        {
          childOrder: childOrder ?? {},
          columns: gridColumns,
          chromeRows,
        },
        layouts,
        ROOT_NODE_ID,
        definition.root.layout.columns,
      ) ?? placements;
    if (editable) return base;
    const adjusted = { ...base };
    for (const [nodeId, widgetType] of Object.entries(widgetTypes ?? {})) {
      if (widgetType !== 'tabs' || !adjusted[nodeId]) continue;
      const tabIds = childOrder?.[nodeId] ?? [];
      const activeTabId = activeTabs[nodeId] ?? tabIds[0];
      if (!activeTabId) continue;
      const chrome = chromeRows[nodeId] ?? 1;
      const tabHeaderRows = Math.max(2, chrome + 1);
      const explicitRowSpan = definition.nodes[activeTabId]?.props?.rowSpan;
      if (typeof explicitRowSpan === 'number' && explicitRowSpan >= 1) {
        adjusted[nodeId] = {
          ...adjusted[nodeId],
          rowSpan: explicitRowSpan + tabHeaderRows,
        };
        continue;
      }
      const tabChildIds = childOrder?.[activeTabId] ?? [];
      const tabPlacements = tabChildIds
        .map(cid => base[cid])
        .filter((p): p is GridPlacement => Boolean(p));
      if (tabPlacements.length === 0) continue;
      const maxRow = Math.max(
        1,
        ...tabPlacements.map(p => p.row + p.rowSpan - 1),
      );
      adjusted[nodeId] = {
        ...adjusted[nodeId],
        rowSpan: maxRow + tabHeaderRows,
      };
    }
    return adjusted;
  }, [
    childOrder,
    gridColumns,
    chromeRows,
    layouts,
    placements,
    definition.root.layout.columns,
    definition.nodes,
    editable,
    widgetTypes,
    activeTabs,
  ]);

  /**
   * A grid's children in reading order. The server's order wins where it has
   * one: a `place` reorders them so the dropped widget keeps the spot it
   * landed on, and the fetched definition does not catch up until the next
   * poll. Containers that are not grids (tabs, say) are not reordered, so
   * they keep the definition's order.
   */
  const orderOf = (nodeId: string, children: string[]) =>
    // Tolerant of the field being absent altogether, which is what a response
    // from a server that predates it looks like. Rendering a canvas in the
    // order it was stored in is a stale preview; throwing here would be a
    // blank page.
    (childOrder?.[nodeId] ?? children).filter(child => !removed.has(child));
  // Props and schema version live on the placement for a structural widget,
  // and with the widget entity otherwise.
  const contentOf = (nodeId: string) => {
    const node = definition.nodes[nodeId];
    return node.widgetId ? widgets[node.widgetId] : node;
  };
  const { gap, rowUnit, columns, widthMode, fixedWidth } =
    definition.root.layout;
  const { colors, display, crossFilters } = definition.settings;
  const scopeTargetsBySource = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const [sourceId, targets] of Object.entries(filterScopes ?? {})) {
      if (targets.length > 0) map[sourceId] = targets;
    }
    if (crossFilters.enabled) {
      for (const [sourceId, targets] of Object.entries(
        crossFilterScopes ?? {},
      )) {
        const srcNode = definition.nodes[sourceId];
        const srcProps = srcNode?.widgetId
          ? widgets[srcNode.widgetId]?.props
          : srcNode?.props;
        if (targets.length > 0 && srcProps?.crossFilter) {
          map[sourceId] = [...new Set([...(map[sourceId] ?? []), ...targets])];
        }
      }
    }
    for (const [sourceId, targets] of Object.entries(
      customizationScopes ?? {},
    )) {
      if (targets.length === 0) continue;
      const srcNode = definition.nodes[sourceId];
      const srcProps = srcNode?.widgetId
        ? widgets[srcNode.widgetId]?.props
        : srcNode?.props;
      const paramName = srcProps?.name;
      const bound =
        typeof paramName === 'string' && paramName
          ? targets.filter(tId => {
              const tNode = definition.nodes[tId];
              const tProps = tNode?.widgetId
                ? widgets[tNode.widgetId]?.props
                : tNode?.props;
              return widgetBindsParam(tProps, paramName);
            })
          : [];
      const effective = bound.length > 0 ? bound : targets;
      map[sourceId] = [...new Set([...(map[sourceId] ?? []), ...effective])];
    }
    return map;
  }, [
    filterScopes,
    crossFilterScopes,
    customizationScopes,
    crossFilters.enabled,
    definition.nodes,
    widgets,
  ]);
  const highlightedTargets = useMemo(
    () =>
      hoveredSourceId
        ? new Set(scopeTargetsBySource[hoveredSourceId] ?? [])
        : new Set<string>(),
    [hoveredSourceId, scopeTargetsBySource],
  );
  const sharedColors = useMemo<canvasApi.CanvasColors>(
    () => ({ scheme: colors.scheme, labelColors: colors.labelColors }),
    [colors.scheme, colors.labelColors],
  );

  /**
   * What to mark each widget with, from the draft's list of changes.
   *
   * Content wins over layout where a widget has both: a chart that was
   * recoloured and then nudged is still a chart whose numbers changed, and
   * marking it "Moved" would hide that. Within a kind the newest wins, and
   * the list arrives newest first.
   */
  const marks = useMemo(() => {
    const found: Record<string, DraftChange['kind']> = {};
    (changes ?? []).forEach(({ nodeId, kind }) => {
      const held = found[nodeId];
      if (held && (OUTLINED.has(held) || !OUTLINED.has(kind))) return;
      found[nodeId] = kind;
    });
    return found;
  }, [changes]);

  const filtersByNode = useMemo(
    () => valuesByNode(filterScopes, values.filter),
    [filterScopes, values.filter],
  );
  const crossFiltersByNode = useMemo(
    () => valuesByNode(crossFilterScopes, values.crossFilter),
    [crossFilterScopes, values.crossFilter],
  );
  const customizationsByNode = useMemo(
    () => valuesByNode(customizationScopes, values.customization),
    [customizationScopes, values.customization],
  );
  const publishedByNode = useMemo(
    () => eventsByNode(eventScopes, events),
    [eventScopes, events],
  );

  // How deeply a grid is nested, so its handles can sit clear of the handles
  // of the widgets inside it: a container's own box starts where its first
  // child's does, and the container's handles are painted last.
  const renderGrid = (
    parentId: string,
    childIds: string[],
    gridColumnCount: number,
    render: (nodeId: string) => ReactNode,
    depth: number,
    // Only the container knows whether it drew anything above its grid, so it
    // is the one that says so; see `stepsAside`.
    chromeAbove = false,
  ) => (
    <CanvasGridSurface
      parentId={parentId}
      chromeAbove={chromeAbove}
      childIds={childIds}
      columns={gridColumnCount}
      gap={gap}
      rowUnit={rowUnit}
      isContainer={nodeId => gridColumns[nodeId] !== undefined}
      // What the widget is, rather than its id: the id is a slug nobody chose.
      labelOf={nodeId => widgetTypes[nodeId] ?? nodeId}
      placements={fitted}
      layouts={layouts}
      constraints={layoutConstraints}
      editable={editable}
      onPlace={place}
      onSwap={swap}
      onMove={move}
      onRemove={remove}
      renderNode={render}
      depth={depth}
    />
  );

  function renderNode(nodeId: string, depth = 0): ReactNode {
    const node = definition.nodes[nodeId];
    const childIds = orderOf(nodeId, node.children ?? []);
    const widgetType = widgetTypes[nodeId];

    if (widgetType === undefined) {
      return (
        <Placeholder>
          <span>{t('This widget is unavailable')}</span>
          {childIds.length > 0 && (
            <Stack>
              {childIds.map(childId => (
                <div key={childId}>{renderNode(childId, depth + 1)}</div>
              ))}
            </Stack>
          )}
        </Placeholder>
      );
    }

    const Renderer = getRenderer(widgetType);
    if (Renderer === undefined) {
      return (
        <Placeholder>
          {t('No renderer for widget type "%s"', widgetType)}
        </Placeholder>
      );
    }

    const childNodes: canvasApi.CanvasChild[] = childIds.map(childId => ({
      nodeId: childId,
      widgetType: widgetTypes[childId],
      props: contentOf(childId)?.props,
      layout: definition.nodes[childId].layout,
      element: renderNode(childId, depth + 1),
    }));
    const childGridColumns = gridColumns[nodeId];
    const title = titles[nodeId];
    const widget = (
      <ErrorBoundary>
        <Renderer
          canvasId={canvasId}
          nodeId={nodeId}
          widgetType={widgetType}
          widgetId={node.widgetId}
          props={contentOf(nodeId)?.props}
          schemaVersion={contentOf(nodeId)?.schemaVersion}
          title={title}
          filters={filtersByNode[nodeId] ?? NO_VALUES}
          crossFilters={crossFiltersByNode[nodeId] ?? NO_VALUES}
          customizations={customizationsByNode[nodeId] ?? NO_VALUES}
          setFilterValue={value => onValueChange('filter', nodeId, value)}
          setCrossFilter={value => {
            if (crossFilters.enabled) {
              onValueChange('crossFilter', nodeId, value);
            }
          }}
          crossFiltersEnabled={crossFilters.enabled}
          setCustomizationValue={value =>
            onValueChange('customization', nodeId, value)
          }
          events={publishedByNode[nodeId] ?? NO_EVENTS}
          publish={(kind, value) => {
            if (!SCOPE_KINDS.has(kind)) onPublish?.(kind, nodeId, value);
          }}
          colors={sharedColors}
          showTimestamp={display.showTimestamps}
          refreshKey={refreshKeys[nodeId] ?? 0}
          childNodes={childNodes}
          renderGrid={options =>
            childGridColumns !== undefined ? (
              renderGrid(
                nodeId,
                childIds,
                childGridColumns,
                childId => renderNode(childId, depth + 1),
                depth + 1,
                options?.chromeAbove,
              )
            ) : (
              <Stack>
                {childNodes.map(child => (
                  <div key={child.nodeId}>{child.element}</div>
                ))}
              </Stack>
            )
          }
        />
      </ErrorBoundary>
    );
    const mark = marks[nodeId];
    const cardStyle = display.cardStyles?.[nodeId];
    const effectiveTitle = cardStyle?.hideTitle ? undefined : title;
    const subtitle = cardStyle?.subtitle;
    const titleAlign = cardStyle?.titleAlign ?? display.titleAlign ?? 'left';
    const canQuickEdit = editable && Boolean(onApplyOps);
    const sourceTargets = scopeTargetsBySource[nodeId];
    const isScopeSource = Boolean(sourceTargets && sourceTargets.length > 0);
    const isHighlighted = highlightedTargets.has(nodeId);
    const isEditingTitle = canQuickEdit && editingTitleNode === nodeId;
    const commitTitle = () => {
      const nextName = draftTitle.trim();
      setEditingTitleNode(null);
      if (nextName && nextName !== title && onApplyOps) {
        void onApplyOps([{ op: 'rename', id: nodeId, name: nextName }]);
      }
    };
    const updateCardStyle = (patch: Partial<CardStyle>) => {
      if (!onApplyOps) return;
      const merged: CardStyle = { ...cardStyle, ...patch };
      if (!merged.backgroundColor) delete merged.backgroundColor;
      if (!merged.subtitle) delete merged.subtitle;
      const nextCardStyles = {
        ...display.cardStyles,
        [nodeId]: merged,
      };
      void onApplyOps([
        {
          op: 'set_settings',
          key: 'display',
          value: { ...display, cardStyles: nextCardStyles },
        },
      ]);
    };
    const widgetProps = (contentOf(nodeId)?.props ?? {}) as Record<
      string,
      unknown
    >;
    const updateWidgetProps = (
      patch: Record<string, unknown>,
      chromePatch?: Record<string, unknown>,
    ) => {
      if (!onApplyOps) return;
      const nextProps: Record<string, unknown> = { ...widgetProps, ...patch };
      if (chromePatch) {
        const prevChrome =
          (widgetProps.chrome as Record<string, unknown> | undefined) ?? {};
        nextProps.chrome = { ...prevChrome, ...chromePatch };
      }
      void onApplyOps([
        {
          op: 'set_props',
          id: nodeId,
          props: nextProps,
        },
      ]);
    };
    const quickSettingsContent = canQuickEdit
      ? renderQuickWidgetSettings(widgetType, widgetProps, updateWidgetProps)
      : null;
    // A widget with no title, subtitle, mark, card style, or scope link needs
    // no wrapper unless quick edit controls are active.
    if (
      !effectiveTitle &&
      !subtitle &&
      !mark &&
      !cardStyle?.backgroundColor &&
      !cardStyle?.borderless &&
      !canQuickEdit &&
      !isScopeSource &&
      !isHighlighted
    ) {
      return widget;
    }
    return (
      <Titled
        className="canvas-titled-card"
        $mark={mark}
        $bg={cardStyle?.backgroundColor}
        $borderless={cardStyle?.borderless}
        $highlighted={isHighlighted}
        data-test="canvas-widget-card"
        data-borderless={cardStyle?.borderless ? 'true' : undefined}
        data-scope-highlighted={isHighlighted ? 'true' : undefined}
        onMouseEnter={
          isScopeSource ? () => setHoveredSourceId(nodeId) : undefined
        }
        onMouseLeave={
          isScopeSource
            ? () => setHoveredSourceId(prev => (prev === nodeId ? null : prev))
            : undefined
        }
      >
        {(effectiveTitle ||
          (mark && mark !== 'removed') ||
          canQuickEdit ||
          isScopeSource) && (
          <TitleRow $align={titleAlign}>
            {isEditingTitle ? (
              <Input
                size="small"
                autoFocus
                value={draftTitle}
                data-test="canvas-widget-title-input"
                onPointerDown={e => e.stopPropagation()}
                onChange={e => setDraftTitle(e.target.value)}
                onPressEnter={commitTitle}
                onBlur={commitTitle}
                onKeyDown={e => {
                  if (e.key === 'Escape') {
                    setEditingTitleNode(null);
                  }
                }}
              />
            ) : (
              effectiveTitle && (
                <WidgetTitle
                  title={effectiveTitle}
                  data-test="canvas-widget-title"
                  onDoubleClick={() => {
                    if (!canQuickEdit) return;
                    setDraftTitle(effectiveTitle);
                    setEditingTitleNode(nodeId);
                  }}
                >
                  {effectiveTitle}
                </WidgetTitle>
              )
            )}
            {canQuickEdit && !isEditingTitle && (
              <QuickActions>
                {effectiveTitle && (
                  <Tooltip title={t('Rename')}>
                    <Button
                      type="text"
                      size="small"
                      icon={<Icons.EditOutlined />}
                      aria-label={t('Rename widget')}
                      data-test="canvas-widget-rename-btn"
                      onPointerDown={e => e.stopPropagation()}
                      onClick={() => {
                        setDraftTitle(effectiveTitle);
                        setEditingTitleNode(nodeId);
                      }}
                    />
                  </Tooltip>
                )}
                <Popover
                  trigger="click"
                  placement="bottomRight"
                  content={
                    <StylePopoverBody
                      onPointerDown={e => e.stopPropagation()}
                      data-test="canvas-widget-style-popover"
                    >
                      <StyleRow>
                        <span>{t('Hide title')}</span>
                        <Switch
                          size="small"
                          checked={Boolean(cardStyle?.hideTitle)}
                          onChange={checked =>
                            updateCardStyle({ hideTitle: checked })
                          }
                        />
                      </StyleRow>
                      <StyleRow>
                        <span>{t('Borderless')}</span>
                        <Switch
                          size="small"
                          checked={Boolean(cardStyle?.borderless)}
                          onChange={checked =>
                            updateCardStyle({ borderless: checked })
                          }
                        />
                      </StyleRow>
                      <StyleRow>
                        <span>{t('Title align')}</span>
                        <SwatchRow>
                          {(['left', 'center', 'right'] as const).map(align => (
                            <Button
                              key={align}
                              size="small"
                              type={
                                titleAlign === align ? 'primary' : 'default'
                              }
                              onClick={() =>
                                updateCardStyle({ titleAlign: align })
                              }
                            >
                              {align[0].toUpperCase()}
                            </Button>
                          ))}
                        </SwatchRow>
                      </StyleRow>
                      <StyleRow>
                        <span>{t('Tint')}</span>
                        <SwatchRow>
                          {CARD_BG_PRESETS.map(preset => (
                            <SwatchButton
                              key={preset.label}
                              type="button"
                              aria-label={preset.label}
                              $color={preset.value}
                              $active={
                                cardStyle?.backgroundColor === preset.value
                              }
                              onClick={() =>
                                updateCardStyle({
                                  backgroundColor: preset.value,
                                })
                              }
                            />
                          ))}
                        </SwatchRow>
                      </StyleRow>
                      <Input
                        size="small"
                        placeholder={t('Subtitle (Enter to save)')}
                        defaultValue={cardStyle?.subtitle ?? ''}
                        onPressEnter={e =>
                          updateCardStyle({
                            subtitle: (
                              e.target as HTMLInputElement
                            ).value.trim(),
                          })
                        }
                        onBlur={e => {
                          const nextSub = e.target.value.trim();
                          if (nextSub !== (cardStyle?.subtitle ?? '')) {
                            updateCardStyle({ subtitle: nextSub });
                          }
                        }}
                      />
                    </StylePopoverBody>
                  }
                >
                  <Tooltip title={t('Customize card')}>
                    <Button
                      type="text"
                      size="small"
                      icon={<Icons.BgColorsOutlined />}
                      aria-label={t('Customize card')}
                      data-test="canvas-widget-style-btn"
                      onPointerDown={e => e.stopPropagation()}
                    />
                  </Tooltip>
                </Popover>
                {quickSettingsContent && (
                  <Popover
                    trigger="click"
                    placement="bottomRight"
                    content={quickSettingsContent}
                  >
                    <Tooltip title={t('Widget settings')}>
                      <Button
                        type="text"
                        size="small"
                        icon={<Icons.SettingOutlined />}
                        aria-label={t('Widget settings')}
                        data-test="canvas-widget-props-btn"
                        onPointerDown={e => e.stopPropagation()}
                      />
                    </Tooltip>
                  </Popover>
                )}
              </QuickActions>
            )}
            {isScopeSource && (
              <Tooltip
                title={
                  <div>
                    <div>
                      {t('Affects %s widget(s):', sourceTargets?.length ?? 0)}
                    </div>
                    {(sourceTargets ?? []).map(targetId => (
                      <div key={targetId}>
                        {`• ${titles[targetId] || widgetTypes[targetId] || targetId}`}
                      </div>
                    ))}
                  </div>
                }
              >
                <span
                  data-test="canvas-scope-source-icon"
                  style={{ display: 'inline-flex', opacity: 0.55 }}
                >
                  <Icons.FilterOutlined iconSize="s" />
                </span>
              </Tooltip>
            )}
            {mark && mark !== 'removed' && (
              <Mark color={MARKS[mark].color} data-test="canvas-widget-mark">
                {MARKS[mark].label()}
              </Mark>
            )}
          </TitleRow>
        )}
        {subtitle && (
          <WidgetSubtitle
            $align={titleAlign}
            title={subtitle}
            data-test="canvas-widget-subtitle"
          >
            {subtitle}
          </WidgetSubtitle>
        )}
        <TitledBody>{widget}</TitledBody>
      </Titled>
    );
  }

  return (
    <CanvasDraftContext.Provider value={draftToken}>
      {/* One drag at a time, shared by every grid: dragging a widget out of
          its container is a conversation between two of them. */}
      <CanvasDragProvider>
        <CanvasVersionContext.Provider value={versionUuid}>
          <CanvasFilterValuesContext.Provider value={values.filter}>
            <CanvasActiveTabContext.Provider value={onTabChange}>
              <div
                data-test="canvas-grid"
                data-width-mode={widthMode ?? 'responsive'}
                style={
                  widthMode === 'fixed'
                    ? { maxWidth: `${fixedWidth ?? 1280}px`, margin: '0 auto' }
                    : undefined
                }
              >
                {renderGrid(
                  ROOT_NODE_ID,
                  orderOf(ROOT_NODE_ID, definition.root.children),
                  columns,
                  renderNode,
                  0,
                )}
              </div>
            </CanvasActiveTabContext.Provider>
          </CanvasFilterValuesContext.Provider>
        </CanvasVersionContext.Provider>
      </CanvasDragProvider>
    </CanvasDraftContext.Provider>
  );
}
