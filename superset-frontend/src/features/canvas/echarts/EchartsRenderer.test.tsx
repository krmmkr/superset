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
import type { canvas as canvasApi } from '@apache-superset/core';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import EchartsRenderer from './EchartsRenderer';

const mockOnHandlers: Record<string, (params: { name?: unknown }) => void> = {};

jest.mock('../useWidgetRows', () => ({
  ...jest.requireActual('../useWidgetRows'),
  useWidgetRows: () => ({
    rows: [],
    loading: false,
    query: 'SELECT 1',
    language: 'sql',
    datasource: '13__table',
  }),
}));

jest.mock('echarts', () => ({
  init: () => ({
    setOption: jest.fn(),
    dispose: jest.fn(),
    resize: jest.fn(),
    on: jest.fn(
      (event: string, handler: (params: { name?: unknown }) => void) => {
        mockOnHandlers[event] = handler;
      },
    ),
    off: jest.fn(),
  }),
}));

const widget = {
  canvasId: 7,
  nodeId: 'chart',
  widgetType: 'echarts',
  props: { echartsOptions: {} },
  filters: [],
  crossFilters: [],
  customizations: [],
  colors: { labelColors: {} },
  refreshKey: 0,
} as unknown as canvasApi.CanvasWidgetProps;

test('the chart opts its canvas out of the widget drag', () => {
  // ECharts paints its own drag targets -- a dataZoom slider, a brush, graph
  // roam -- onto its canvas, where they are pixels rather than elements. The
  // check that stops a press on a control becoming a widget move walks the
  // DOM, so it has nothing to match, and dragging a zoom handle in a plan
  // would move the widget and persist it on release.
  render(<EchartsRenderer {...widget} />, { useRedux: true, useRouter: true });

  expect(screen.getByTestId('canvas-echarts')).toHaveAttribute(
    'data-canvas-no-drag',
  );
});

test('clicking a bar toggles cross-filter via setCrossFilter with datasetId and values', async () => {
  delete mockOnHandlers.click;
  const setCrossFilter = jest.fn();
  render(
    <EchartsRenderer
      {...widget}
      props={{
        crossFilter: true,
        dataBinding: {
          datasetId: 13,
          dimensions: ['territory'],
          metrics: ['sales'],
        },
        echartsOptions: {},
      }}
      setCrossFilter={setCrossFilter}
    />,
    { useRedux: true, useRouter: true },
  );

  await waitFor(() => expect(mockOnHandlers.click).toBeDefined());
  mockOnHandlers.click({ name: 'EMEA' });
  expect(setCrossFilter).toHaveBeenCalledWith({
    datasetId: 13,
    column: 'territory',
    values: ['EMEA'],
  });

  mockOnHandlers.click({ name: 'EMEA' });
  expect(setCrossFilter).toHaveBeenLastCalledWith(undefined);
});
