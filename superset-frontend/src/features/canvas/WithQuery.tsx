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
import { ReactNode, useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import { t } from '@apache-superset/core/translation';
import { css, styled, useTheme } from '@apache-superset/core/theme';
import {
  Button,
  Modal,
  NoAnimationDropdown,
} from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { Menu, MenuItem } from '@superset-ui/core/components/Menu';
import type { SupportedLanguage } from '@superset-ui/core/components/CodeSyntaxHighlighter';
import ViewQuery from 'src/explore/components/controls/ViewQuery';
import { CanvasWidgetChromeContext } from './widgetChrome';

const Frame = styled.div`
  ${({ theme }) => css`
    /*
     * Deliberately not positioned, so the controls below anchor to the
     * widget's box rather than to this frame.
     *
     * The frame sits inside the canvas's scrolling content box, while the
     * drag and resize handles are siblings of that box. Anchoring the
     * controls here lines them up with the handles only as long as nothing
     * overflows: give a widget a scrollbar -- a wide chart, a long table --
     * and the frame's corner is no longer the widget's corner, so the two
     * drift apart. Worse, the controls scroll away with the content. An
     * absolutely positioned element whose containing block lies outside a
     * scroll container is neither clipped by it nor scrolled with it, so
     * leaving this static pins them where the handles are.
     */
    height: 100%;

    .canvas-widget-controls {
      position: absolute;
      top: 0;
      /*
       * Clear of the widget's right edge, always.
       *
       * Two things live there. While a plan is open it is the layout's
       * resize handle, which would otherwise sit under these controls or be
       * pushed out of the corner where it stops matching the other three.
       * And because these controls anchor to the widget's box rather than to
       * its content, the edge is also where a scrollbar appears -- so flush
       * against it puts the menu on top of the scrollbar on any widget whose
       * content scrolls, in a plan or not.
       *
       * One inset covers both: wider than a resize handle, and wider than a
       * scrollbar on the platforms that give one width.
       */
      right: ${theme.sizeUnit * 5}px;
      z-index: 1;
      opacity: 0;
    }

    &:hover .canvas-widget-controls,
    &:focus-within .canvas-widget-controls,
    .canvas-widget-controls.ant-dropdown-open {
      opacity: 1;
    }
  `}
`;

const VIEW_QUERY = 'view_query';
const MAXIMIZE = 'maximize';
const EXPORT_CSV = 'export_csv';
const LANGUAGES: SupportedLanguage[] = ['sql', 'htmlbars', 'markdown', 'json'];

function downloadCsv(rows: Record<string, unknown>[], filename: string) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escapeCell = (val: unknown) => {
    const str = val === null || val === undefined ? '' : String(val);
    return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const lines = [
    headers.map(escapeCell).join(','),
    ...rows.map(row => headers.map(h => escapeCell(row[h])).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename || 'widget-data'}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export interface WithQueryProps {
  /** The query that produced the widget's data, when the user may see it. */
  query?: string;
  language?: string;
  /** The widget's dataset, `<id>__table`, for opening the query in SQL Lab. */
  datasource?: string;
  /** Optional rows for CSV export. */
  rows?: Record<string, unknown>[];
  /** Optional title used for the maximize modal and CSV filename. */
  title?: string;
  /** Optional renderer for the maximized modal body (e.g. charts needing a fresh DOM container). */
  renderMaximized?: () => ReactNode;
  children: ReactNode;
}

/**
 * A data widget with the dashboard chart menu, holding "View query": the
 * query its data came from, as the server ran it for this user, current
 * filters and row level security included.
 */
export default function WithQuery({
  query,
  language,
  datasource = '',
  rows,
  title,
  renderMaximized,
  children,
}: WithQueryProps) {
  const theme = useTheme();
  // Where a canvas wants this widget's chrome; null when rendered on its own.
  const chrome = useContext(CanvasWidgetChromeContext);
  const [open, setOpen] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [queryOpen, setQueryOpen] = useState(false);
  if (!query && !rows?.length) return <>{children}</>;

  const items: MenuItem[] = [
    {
      key: MAXIMIZE,
      label: (
        <div data-test="maximize-widget-menu-item">{t('Maximize')}</div>
      ),
    },
    ...(rows && rows.length > 0
      ? [
          {
            key: EXPORT_CSV,
            label: (
              <div data-test="export-csv-menu-item">{t('Export to CSV')}</div>
            ),
          },
        ]
      : []),
    ...(query
      ? [
          {
            key: VIEW_QUERY,
            label: (
              <div data-test="view-query-menu-item">{t('View query')}</div>
            ),
          },
        ]
      : []),
  ];

  const controls = (
    <NoAnimationDropdown
      popupRender={() => (
        <Menu
          selectable={false}
          items={items}
          onClick={({ key }) => {
            if (key === VIEW_QUERY) {
              setQueryOpen(true);
            } else if (key === MAXIMIZE) {
              setMaximized(true);
            } else if (key === EXPORT_CSV && rows?.length) {
              downloadCsv(rows, title || 'widget-data');
            }
            setOpen(false);
          }}
        />
      )}
      trigger={['click']}
      placement="bottomRight"
      open={open}
      onOpenChange={setOpen}
    >
      <Button
        className="canvas-widget-controls"
        buttonStyle="link"
        aria-label={t('More Options')}
        aria-haspopup="true"
        css={css`
          width: ${theme.sizeUnit * 8}px;
          height: ${theme.sizeUnit * 8}px;
          padding: 0;
        `}
      >
        <Icons.EllipsisOutlined
          iconSize="xl"
          css={css`
            transform: rotate(90deg);
          `}
        />
      </Button>
    </NoAnimationDropdown>
  );

  return (
    <Frame>
      {children}
      {/*
       * Into the canvas's chrome node where there is one, so these controls
       * sit beside the content rather than inside it -- out of its scrolling,
       * its clipping and its stacking. A table's sticky header outranks them
       * otherwise, and buries the menu at the top right. Rendered in place
       * when nothing provides a node, which is how this component behaves on
       * its own.
       */}
      {chrome ? createPortal(controls, chrome) : controls}
      <Modal
        show={maximized}
        onHide={() => setMaximized(false)}
        title={title || t('Widget')}
        hideFooter
        responsive
      >
        {maximized && (
          <div
            css={css`
              height: 65vh;
              overflow: auto;
            `}
          >
            {renderMaximized ? renderMaximized() : children}
          </div>
        )}
      </Modal>
      {query && (
        <Modal
          show={queryOpen}
          onHide={() => setQueryOpen(false)}
          title={t('View query')}
          hideFooter
          draggable
          resizable
          responsive
        >
          {queryOpen && (
            <ViewQuery
              sql={query}
              datasource={datasource}
              language={
                LANGUAGES.find(supported => supported === language) ?? 'sql'
              }
            />
          )}
        </Modal>
      )}
    </Frame>
  );
}
