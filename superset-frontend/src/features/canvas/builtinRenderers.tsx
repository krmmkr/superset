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
import { useContext } from 'react';
import type { ComponentType } from 'react';
import type { canvas as canvasApi } from '@apache-superset/core';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { SafeMarkdown, Tabs, Typography } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { canvas } from 'src/core';
import EchartsRenderer from './echarts/EchartsRenderer';
import type { DataBinding } from './echarts/chartData';
import { renderTemplate } from './markdownTemplate';
import { MetricTileRenderer, TableRenderer } from './dataRenderers';
import { useWidgetRows } from './useWidgetRows';
import WithQuery from './WithQuery';
import FilterDateRangeRenderer from './FilterDateRangeRenderer';
import FilterSelectRenderer from './FilterSelectRenderer';
import ParameterRenderer from './ParameterRenderer';
import PivotTableRenderer from './PivotTableRenderer';
import { CanvasActiveTabContext } from './widgetChrome';

type Props = canvasApi.CanvasWidgetProps;

const text = (value: unknown): string =>
  typeof value === 'string' ? value : '';

function interpolateParams(
  template: string,
  customizations: canvasApi.CanvasWidgetProps['customizations'],
): string {
  if (!template || !Array.isArray(customizations) || customizations.length === 0) {
    return template;
  }
  const map = new Map<string, string>();
  for (const item of customizations) {
    const val = item?.value as { name?: unknown; value?: unknown } | undefined;
    if (val && typeof val.name === 'string' && val.value !== undefined) {
      map.set(
        val.name,
        typeof val.value === 'number'
          ? val.value.toLocaleString()
          : String(val.value),
      );
    }
  }
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (match, key) =>
    map.has(key) ? map.get(key)! : match,
  );
}

const TabsRenderer = ({ nodeId, childNodes }: Props) => {
  const onTabChange = useContext(CanvasActiveTabContext);
  return (
    <Tabs
      onChange={key => onTabChange?.(nodeId, key)}
      items={childNodes.map(child => ({
        key: child.nodeId,
        label: text(child.props?.title) || t('Untitled tab'),
        children: child.element,
      }))}
    />
  );
};

/**
 * A container's box, with its grid filling whatever its own chrome leaves.
 *
 * A container is as tall as it was placed. A grid left at its content height
 * would end at the last row its children fill, so the space below them --
 * plainly inside the container -- would belong to the grid outside it, and
 * the rows the container really has room for could not be measured. Anything
 * the container draws for itself, such as a title, comes off the top.
 */
/**
 * A container's title, clear of the grip above it.
 *
 * The grip is a `sizeUnit * 8` square pinned to the container's top left (see
 * `Grip`), so a title flush with the top would be covered by it the moment
 * anyone hovered. Reserving the strip rather than dodging on hover keeps the
 * container's contents from shifting under the pointer.
 */
const GroupTitle = styled(Typography.Title)`
  ${({ theme }) => css`
    /*
     * Exactly the row the server keeps for it, so the grid below starts where
     * the container's own box says it does. Taller than that and the last row
     * of the group is drawn past the container's edge, which clips it.
     *
     * Doubled selector because the heading's own margins come from Ant
     * Design's rule for h5, which outranks a plain class: left to itself its
     * bottom margin is added to the height below and overflows the row again.
     *
     * The fallback is that row at the default metrics, for a title rendered
     * outside a canvas grid.
     */
    && {
      height: var(--canvas-chrome-rows, ${theme.sizeUnit * 14}px);
      box-sizing: border-box;
      margin-top: 0;
      margin-bottom: 0;
      /* Sat at the bottom of the strip, clear of the grip at the top of it. */
      display: flex;
      align-items: flex-end;
    }
  `}
`;

const Container = styled.section`
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
`;

const GridRenderer = ({ renderGrid }: Props) => (
  <Container>{renderGrid()}</Container>
);

const GroupRenderer = ({ props, renderGrid }: Props) => {
  const title = text(props?.title);
  return (
    <Container>
      {title && <GroupTitle level={5}>{title}</GroupTitle>}
      {/* A title takes the strip the group's own handles sit in, so no child
          of it has handles to clear; see `stepsAside`. */}
      {renderGrid({ chromeAbove: Boolean(title) })}
    </Container>
  );
};

const Markdown = styled.div`
  ${({ theme }) => css`
    height: 100%;
    overflow: auto;
    color: ${theme.colorText};

    h1,
    h2,
    h3,
    h4,
    h5,
    h6 {
      color: ${theme.colorTextHeading};
    }

    a {
      color: ${theme.colorLink};
    }

    code {
      background: ${theme.colorFillTertiary};
      border-radius: ${theme.borderRadiusSM}px;
      padding: 0 ${theme.sizeUnit}px;
    }

    table {
      border-collapse: collapse;
    }

    th,
    td {
      border-bottom: 1px solid ${theme.colorBorderSecondary};
      padding: ${theme.sizeUnit}px ${theme.sizeUnit * 2}px;
    }
  `}
`;

const MarkdownRenderer = (widget: Props) => {
  const { props, filters, refreshKey, customizations } = widget;
  const binding = props?.dataBinding as DataBinding | undefined;
  const { rows, error, query, language, datasource } = useWidgetRows(
    widget,
    filters,
    refreshKey,
  );

  const content = interpolateParams(text(props?.content), customizations);
  return (
    <WithQuery query={query} language={language} datasource={datasource}>
      <Markdown>
        <SafeMarkdown
          source={
            error
              ? `${t('Data unavailable')}: ${error}`
              : binding?.datasetId
                ? renderTemplate(content, rows)
                : content
          }
        />
      </Markdown>
    </WithQuery>
  );
};

type CalloutVariant = 'info' | 'success' | 'warning' | 'error';

const CALLOUT_VARIANTS: ReadonlySet<string> = new Set<CalloutVariant>([
  'info',
  'success',
  'warning',
  'error',
]);

const CalloutBox = styled.div<{ variant: CalloutVariant }>`
  ${({ theme, variant }) => {
    const palette: Record<
      CalloutVariant,
      { bg: string; border: string; icon: string }
    > = {
      info: {
        bg: theme.colorInfoBg,
        border: theme.colorInfoBorder,
        icon: theme.colorInfo,
      },
      success: {
        bg: theme.colorSuccessBg,
        border: theme.colorSuccessBorder,
        icon: theme.colorSuccess,
      },
      warning: {
        bg: theme.colorWarningBg,
        border: theme.colorWarningBorder,
        icon: theme.colorWarning,
      },
      error: {
        bg: theme.colorErrorBg,
        border: theme.colorErrorBorder,
        icon: theme.colorError,
      },
    };
    const colors = palette[variant];
    return css`
      height: 100%;
      display: flex;
      align-items: flex-start;
      gap: ${theme.sizeUnit * 2.5}px;
      padding: ${theme.sizeUnit * 3}px;
      border-radius: ${theme.borderRadiusLG}px;
      border: 1px solid ${colors.border};
      background: ${colors.bg};
      overflow: auto;

      .callout-icon {
        color: ${colors.icon};
        margin-top: ${theme.sizeUnit * 0.5}px;
        flex-shrink: 0;
      }
    `;
  }}
`;

const CALLOUT_ICONS: Record<CalloutVariant, ComponentType<{ className?: string }>> = {
  info: Icons.InfoCircleOutlined,
  success: Icons.CheckCircleOutlined,
  warning: Icons.ExclamationCircleOutlined,
  error: Icons.CloseCircleOutlined,
};

const CalloutRenderer = ({ props, customizations }: Props) => {
  const rawVariant = text(props?.variant);
  const variant: CalloutVariant = CALLOUT_VARIANTS.has(rawVariant)
    ? (rawVariant as CalloutVariant)
    : 'info';
  const Icon = CALLOUT_ICONS[variant];
  const title = interpolateParams(text(props?.title), customizations);
  const message = interpolateParams(text(props?.message), customizations);

  return (
    <CalloutBox variant={variant} role="note">
      <Icon className="callout-icon" />
      <div>
        {title && (
          <div>
            <Typography.Text strong>{title}</Typography.Text>
          </div>
        )}
        {message && <Typography.Text>{message}</Typography.Text>}
      </div>
    </CalloutBox>
  );
};

const HeaderBox = styled.div`
  ${({ theme }) => css`
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: ${theme.sizeUnit * 0.5}px;
    border-bottom: 1px solid ${theme.colorBorderSecondary};
    padding-bottom: ${theme.sizeUnit * 2}px;
  `}
`;

const HeaderRenderer = ({ props }: Props) => {
  const title = text(props?.title);
  const subtitle = text(props?.subtitle);
  const rawLevel = typeof props?.level === 'number' ? props.level : 3;
  const level = Math.min(5, Math.max(1, Math.round(rawLevel))) as
    | 1
    | 2
    | 3
    | 4
    | 5;
  return (
    <HeaderBox>
      {title && (
        <Typography.Title level={level} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
      )}
      {subtitle && (
        <Typography.Text type="secondary">{subtitle}</Typography.Text>
      )}
    </HeaderBox>
  );
};

/** Renderers for the core containers, filters, text and the ECharts widget. */
export const BUILTIN_RENDERERS: Record<string, ComponentType<Props>> = {
  tabs: TabsRenderer,
  tab: GridRenderer,
  group: GroupRenderer,
  'filter.bar': GridRenderer,
  'filter.select': FilterSelectRenderer,
  'filter.date_range': FilterDateRangeRenderer,
  parameter: ParameterRenderer,
  markdown: MarkdownRenderer,
  callout: CalloutRenderer,
  header: HeaderRenderer,
  echarts: EchartsRenderer,
  'metric-tile': MetricTileRenderer,
  'ag-grid-table': TableRenderer,
  'pivot-table': PivotTableRenderer,
};

let registered = false;

/** Registers the built-in renderers once, before the first canvas renders. */
export function registerBuiltinRenderers(): void {
  if (registered) return;
  registered = true;
  Object.entries(BUILTIN_RENDERERS).forEach(([widgetType, component]) =>
    canvas.registerWidgetRenderer(widgetType, component),
  );
}
