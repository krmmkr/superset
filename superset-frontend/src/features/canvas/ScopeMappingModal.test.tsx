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
import fetchMock from 'fetch-mock';
import {
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import ScopeMappingModal from './ScopeMappingModal';
import type { CanvasDefinitionResult } from './types';

beforeEach(() => {
  fetchMock.removeRoutes();
  fetchMock.clearHistory();
});

afterEach(() => {
  fetchMock.removeRoutes();
  fetchMock.clearHistory();
});

const baseResult: CanvasDefinitionResult = {
  version: 1,
  revision: 4,
  definition: {
    version: 1,
    root: { layout: { columns: 24, gap: 16, rowUnit: 40 }, children: [] },
    nodes: {},
    interactions: { filters: {}, crossFilters: {}, customizations: {} },
    settings: {
      refresh: { interval: 0, stagger: 0, exempt: [] },
      colors: { labelColors: {} },
      display: { showTimestamps: false },
      crossFilters: { enabled: true },
    },
  },
  filterScopes: {},
  crossFilterScopes: { chart1: ['chart2', 'table1'] },
  customizationScopes: {},
  eventScopes: {},
  placements: {},
  layouts: {},
  childOrder: {},
  widgetTypes: {
    chart1: 'echarts',
    chart2: 'echarts',
    table1: 'ag-grid-table',
  },
  titles: {
    chart1: 'Sales by Year',
    chart2: 'Sales by Product',
    table1: 'Top Countries',
  },
  gridColumns: {},
  layoutConstraints: {},
  canEdit: true,
};

test('ScopeMappingModal applies custom targets and global cross-filter toggle', async () => {
  fetchMock.patch('glob:*/api/v1/canvas/draft', {
    result: { revision: 5 },
  });
  const onApplied = jest.fn();
  const onClose = jest.fn();

  render(
    <ScopeMappingModal
      open
      onClose={onClose}
      result={baseResult}
      draftToken="draft-123"
      revision={4}
      onApplied={onApplied}
    />,
  );

  await userEvent.click(
    screen.getByRole('switch', { name: 'Enable Cross-Filtering on Canvas' }),
  );
  await userEvent.click(screen.getByText('Custom targets'));
  await userEvent.click(screen.getByText('Top Countries (ag-grid-table)'));
  await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

  await waitFor(() => expect(onApplied).toHaveBeenCalled());
  expect(onClose).toHaveBeenCalled();

  const [call] = fetchMock.callHistory.calls();
  const body = JSON.parse(String(call.options.body));
  expect(body.revision).toBe(4);
  expect(body.ops).toEqual([
    { op: 'set_settings', key: 'crossFilters', value: { enabled: false } },
    {
      op: 'set_scope',
      kind: 'crossFilter',
      id: 'chart1',
      scope: { mode: 'custom', targets: ['chart2'] },
    },
  ]);
  fetchMock.removeRoutes();
});

test('ScopeMappingModal resets scope to auto', async () => {
  fetchMock.patch('glob:*/api/v1/canvas/draft', {
    result: { revision: 5 },
  });
  const onApplied = jest.fn();
  const onClose = jest.fn();

  render(
    <ScopeMappingModal
      open
      onClose={onClose}
      result={baseResult}
      draftToken="draft-123"
      revision={4}
      onApplied={onApplied}
    />,
  );

  await userEvent.click(screen.getByRole('button', { name: 'Reset to Auto' }));
  await waitFor(() => expect(onApplied).toHaveBeenCalled());

  const [call] = fetchMock.callHistory.calls();
  const body = JSON.parse(String(call.options.body));
  expect(body.ops).toEqual([
    {
      op: 'set_scope',
      kind: 'crossFilter',
      id: 'chart1',
      scope: null,
    },
  ]);
  fetchMock.removeRoutes();
});
