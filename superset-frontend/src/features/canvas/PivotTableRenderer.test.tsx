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
import { fireEvent, render, screen } from 'spec/helpers/testing-library';
import PivotTableRenderer from './PivotTableRenderer';

afterEach(() => fetchMock.removeRoutes());

test('cross-tabulates rows, columns, and totals', async () => {
  fetchMock.post('glob:*/api/v1/canvas/2/placement/pivot1/data', {
    result: {
      datasets: [
        {
          name: 'main',
          row_count: 3,
          inline_data: [
            { territory: 'NA', deal_size: 'Large', sales: 500 },
            { territory: 'NA', deal_size: 'Small', sales: 150 },
            { territory: 'EMEA', deal_size: 'Large', sales: 300 },
          ],
          query: 'SELECT territory, deal_size, SUM(sales) FROM sales',
          language: 'sql',
        },
      ],
    },
  });

  render(
    <PivotTableRenderer
      canvasId={2}
      nodeId="pivot1"
      widgetType="pivot-table"
      props={{
        dataBinding: { datasetId: 13, metrics: ['sales'] },
        rowFields: ['territory'],
        columnFields: ['deal_size'],
        metric: 'sales',
        prefix: '$',
        decimals: 0,
        showRowTotals: true,
        showColTotals: true,
      }}
      filters={[]}
      events={[]}
      refreshKey={0}
      setFilterValue={jest.fn()}
      setCrossFilterValue={jest.fn()}
      emitEvent={jest.fn()}
      childNodes={[]}
      renderGrid={jest.fn()}
    />,
    { useRedux: true, useRouter: true },
  );

  expect(await screen.findByText('NA')).toBeInTheDocument();
  expect(screen.getByText('EMEA')).toBeInTheDocument();
  expect(screen.getByText('Large')).toBeInTheDocument();
  expect(screen.getByText('Small')).toBeInTheDocument();
  expect(screen.getByText('$500')).toBeInTheDocument();
  expect(screen.getByText('$650')).toBeInTheDocument();
  expect(screen.getByText('$800')).toBeInTheDocument();
  expect(screen.getByText('$950')).toBeInTheDocument();
});

test('groups multi-level rowFields with rowSpan and supports sorting by header click', async () => {
  fetchMock.post('glob:*/api/v1/canvas/2/placement/pivot2/data', {
    result: {
      datasets: [
        {
          name: 'main',
          row_count: 3,
          inline_data: [
            { region: 'NA', country: 'USA', deal_size: 'Large', sales: 500 },
            { region: 'NA', country: 'Canada', deal_size: 'Large', sales: 150 },
            { region: 'EMEA', country: 'UK', deal_size: 'Large', sales: 300 },
          ],
          query: 'SELECT region, country, deal_size, SUM(sales) FROM sales',
          language: 'sql',
        },
      ],
    },
  });

  const { container } = render(
    <PivotTableRenderer
      canvasId={2}
      nodeId="pivot2"
      widgetType="pivot-table"
      props={{
        dataBinding: { datasetId: 13, metrics: ['sales'] },
        rowFields: ['region', 'country'],
        columnFields: ['deal_size'],
        metric: 'sales',
        showRowTotals: true,
        showColTotals: true,
      }}
      filters={[]}
      events={[]}
      refreshKey={0}
      setFilterValue={jest.fn()}
      setCrossFilterValue={jest.fn()}
      emitEvent={jest.fn()}
      childNodes={[]}
      renderGrid={jest.fn()}
    />,
    { useRedux: true, useRouter: true },
  );

  const naCell = await screen.findByText('NA');
  expect(naCell.closest('td')).toHaveAttribute('rowspan', '2');

  // Click "Total" header to sort ascending: Canada (150), UK (300), USA (500)
  fireEvent.click(screen.getByRole('columnheader', { name: 'Total' }));
  const rowsAsc = Array.from(
    container.querySelectorAll('tbody tr:not(.total-row)'),
  ).map(tr => tr.textContent);
  expect(rowsAsc[0]).toContain('Canada');
  expect(rowsAsc[1]).toContain('UK');
  expect(rowsAsc[2]).toContain('USA');

  // Click again to sort descending: USA (500), UK (300), Canada (150)
  fireEvent.click(screen.getByRole('columnheader', { name: /Total/ }));
  const rowsDesc = Array.from(
    container.querySelectorAll('tbody tr:not(.total-row)'),
  ).map(tr => tr.textContent);
  expect(rowsDesc[0]).toContain('USA');
  expect(rowsDesc[1]).toContain('UK');
  expect(rowsDesc[2]).toContain('Canada');
});

test('emits and toggles cross-filter on row dimension click when crossFilter is enabled', async () => {
  fetchMock.post('glob:*/api/v1/canvas/2/placement/pivot3/data', {
    result: {
      datasets: [
        {
          name: 'main',
          row_count: 2,
          inline_data: [
            { territory: 'NA', deal_size: 'Large', sales: 500 },
            { territory: 'EMEA', deal_size: 'Large', sales: 300 },
          ],
          query: 'SELECT territory, deal_size, SUM(sales) FROM sales',
          language: 'sql',
        },
      ],
    },
  });

  const setCrossFilter = jest.fn();
  render(
    <PivotTableRenderer
      canvasId={2}
      nodeId="pivot3"
      widgetType="pivot-table"
      props={{
        dataBinding: { datasetId: 13, metrics: ['sales'] },
        rowFields: ['territory'],
        columnFields: ['deal_size'],
        metric: 'sales',
        crossFilter: true,
      }}
      filters={[]}
      crossFilters={[
        {
          nodeId: 'chart1',
          value: { datasetId: 13, column: 'year', values: [2025] },
        },
      ]}
      events={[]}
      refreshKey={0}
      setFilterValue={jest.fn()}
      setCrossFilter={setCrossFilter}
      emitEvent={jest.fn()}
      childNodes={[]}
      renderGrid={jest.fn()}
    />,
    { useRedux: true, useRouter: true },
  );

  const naCell = await screen.findByText('NA');
  const call = fetchMock.callHistory.lastCall(
    'glob:*/api/v1/canvas/2/placement/pivot3/data',
  );
  const body = JSON.parse(String(call?.options?.body ?? '{}'));
  expect(body.runtime_filters).toEqual([
    { datasetId: 13, column: 'year', values: [2025] },
  ]);

  fireEvent.click(naCell);
  expect(setCrossFilter).toHaveBeenCalledWith({
    datasetId: 13,
    column: 'territory',
    values: ['NA'],
  });
  expect(naCell.closest('td')).toHaveClass('cross-filter-active');

  fireEvent.click(naCell);
  expect(setCrossFilter).toHaveBeenLastCalledWith(undefined);
  expect(naCell.closest('td')).not.toHaveClass('cross-filter-active');

  // Clicking a data cell emits both row and column dimension filters.
  const dataCell = screen.getAllByText('500')[0];
  fireEvent.click(dataCell);
  expect(setCrossFilter).toHaveBeenLastCalledWith([
    { datasetId: 13, column: 'territory', values: ['NA'] },
    { datasetId: 13, column: 'deal_size', values: ['Large'] },
  ]);
  expect(dataCell.closest('td')).toHaveClass('cross-filter-active');

  fireEvent.click(dataCell);
  expect(setCrossFilter).toHaveBeenLastCalledWith(undefined);
  expect(dataCell.closest('td')).not.toHaveClass('cross-filter-active');
});

test('supports row_percent displayMode, compactNumbers, and sticky-row-col', async () => {
  fetchMock.clearHistory();
  fetchMock.removeRoutes();
  fetchMock.post('glob:*/api/v1/canvas/2/placement/pivot4/data', {
    result: {
      datasets: [
        {
          name: 'main',
          row_count: 2,
          inline_data: [
            { territory: 'NA', deal_size: 'Large', sales: 1500000 },
            { territory: 'NA', deal_size: 'Small', sales: 500000 },
          ],
          query: 'SELECT 1',
          language: 'sql',
        },
      ],
    },
  });

  const { rerender } = render(
    <PivotTableRenderer
      canvasId={2}
      nodeId="pivot4"
      widgetType="pivot-table"
      props={{
        dataBinding: { datasetId: 13, metrics: ['sales'] },
        rowFields: ['territory'],
        columnFields: ['deal_size'],
        metric: 'sales',
        prefix: '$',
        compactNumbers: true,
        freezeRowFields: true,
      }}
      filters={[]}
      crossFilters={[]}
      events={[]}
      refreshKey={0}
      setFilterValue={jest.fn()}
      setCrossFilter={jest.fn()}
      emitEvent={jest.fn()}
      childNodes={[]}
      renderGrid={jest.fn()}
    />,
    { useRedux: true, useRouter: true },
  );

  const naCell = await screen.findByText('NA');
  expect(naCell.closest('td')).toHaveClass('sticky-row-col');
  expect(screen.getAllByText('$1.5M').length).toBeGreaterThan(0);
  expect(screen.getAllByText('$500K').length).toBeGreaterThan(0);
  expect(screen.getAllByText('$2M').length).toBeGreaterThan(0);

  rerender(
    <PivotTableRenderer
      canvasId={2}
      nodeId="pivot4"
      widgetType="pivot-table"
      props={{
        dataBinding: { datasetId: 13, metrics: ['sales'] },
        rowFields: ['territory'],
        columnFields: ['deal_size'],
        metric: 'sales',
        displayMode: 'row_percent',
      }}
      filters={[]}
      crossFilters={[]}
      events={[]}
      refreshKey={0}
      setFilterValue={jest.fn()}
      setCrossFilter={jest.fn()}
      emitEvent={jest.fn()}
      childNodes={[]}
      renderGrid={jest.fn()}
    />,
  );

  expect(screen.getAllByText('75.0%').length).toBeGreaterThan(0);
  expect(screen.getAllByText('25.0%').length).toBeGreaterThan(0);
});
