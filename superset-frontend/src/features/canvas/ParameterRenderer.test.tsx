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
import type { canvas as canvasApi } from '@apache-superset/core';
import { fireEvent, render, screen } from 'spec/helpers/testing-library';
import ParameterRenderer from './ParameterRenderer';
import { BUILTIN_RENDERERS } from './builtinRenderers';
import { MetricTileRenderer, TableRenderer } from './dataRenderers';

function makeWidgetProps(
  overrides: Partial<canvasApi.CanvasWidgetProps> = {},
): canvasApi.CanvasWidgetProps {
  return {
    nodeId: 'p1',
    canvasId: 1,
    widgetType: 'parameter',
    props: {},
    filters: [],
    crossFilters: [],
    customizations: [],
    events: [],
    refreshKey: 0,
    childNodes: [],
    renderGrid: jest.fn(),
    setFilterValue: jest.fn(),
    setCrossFilterValue: jest.fn(),
    setCustomizationValue: jest.fn(),
    emitEvent: jest.fn(),
    ...overrides,
  };
}

test('ParameterRenderer publishes defaultValue on mount and updates on text change', () => {
  const setCustomizationValue = jest.fn();
  render(
    <ParameterRenderer
      {...makeWidgetProps({
        props: {
          name: 'regionLabel',
          label: 'Region Label',
          inputType: 'text',
          defaultValue: 'North America',
        },
        setCustomizationValue,
      })}
    />,
  );

  expect(setCustomizationValue).toHaveBeenCalledWith({
    name: 'regionLabel',
    value: 'North America',
  });

  const input = screen.getByDisplayValue('North America');
  fireEvent.change(input, { target: { value: 'EMEA' } });
  expect(setCustomizationValue).toHaveBeenLastCalledWith({
    name: 'regionLabel',
    value: 'EMEA',
  });
});

test('ParameterRenderer publishes numeric changes for number inputType', () => {
  const setCustomizationValue = jest.fn();
  render(
    <ParameterRenderer
      {...makeWidgetProps({
        props: {
          name: 'revenueGoal',
          label: 'Revenue Goal',
          inputType: 'number',
          defaultValue: 1000,
        },
        setCustomizationValue,
      })}
    />,
  );

  expect(setCustomizationValue).toHaveBeenCalledWith({
    name: 'revenueGoal',
    value: 1000,
  });

  const input = screen.getByRole('spinbutton');
  fireEvent.change(input, { target: { value: '2500' } });
  expect(setCustomizationValue).toHaveBeenLastCalledWith({
    name: 'revenueGoal',
    value: 2500,
  });
});

test('CalloutRenderer interpolates {{paramName}} tokens from customizations', () => {
  const CalloutRenderer = BUILTIN_RENDERERS.callout;
  render(
    <CalloutRenderer
      {...makeWidgetProps({
        widgetType: 'callout',
        props: {
          title: 'Goal for {{regionLabel}}',
          message: 'Target is ${{revenueGoal}}',
        },
        customizations: [
          { sourceId: 'p1', value: { name: 'regionLabel', value: 'EMEA' } },
          { sourceId: 'p2', value: { name: 'revenueGoal', value: 2500 } },
        ],
      })}
    />,
  );

  expect(screen.getByText('Goal for EMEA')).toBeInTheDocument();
  expect(screen.getByText('Target is $2,500')).toBeInTheDocument();
});

test('MetricTileRenderer uses targetParam from customizations to compute target delta', async () => {
  fetchMock.post('glob:*/api/v1/canvas/1/placement/kpi1/data', {
    result: {
      datasets: [
        {
          name: 'main',
          row_count: 1,
          inline_data: [{ revenue: 1200 }],
          query: 'SELECT SUM(revenue) AS revenue FROM sales',
          language: 'sql',
        },
      ],
    },
  });

  render(
    <MetricTileRenderer
      {...makeWidgetProps({
        nodeId: 'kpi1',
        widgetType: 'metric-tile',
        props: {
          label: 'Revenue',
          decimals: 0,
          targetParam: 'revenueGoal',
          dataBinding: {
            datasetId: 13,
            metrics: [{ label: 'revenue' }],
            dimensions: [],
          },
        },
        customizations: [
          { sourceId: 'p2', value: { name: 'revenueGoal', value: 1000 } },
        ],
      })}
    />,
    { useRedux: true, useRouter: true },
  );

  expect(await screen.findByText('1,200')).toBeInTheDocument();
  expect(screen.getByText('+20.0%')).toBeInTheDocument();
  expect(screen.getByText('vs target (1,000)')).toBeInTheDocument();
  fetchMock.removeRoutes();
});

test('MetricTileRenderer formats compact numbers, static target progress bar, and inverted delta', async () => {
  fetchMock.removeRoutes();
  fetchMock.post('glob:*/api/v1/canvas/1/placement/kpi2/data', {
    result: {
      datasets: [
        {
          name: 'main',
          row_count: 2,
          inline_data: [{ cost: 1500000 }, { cost: 1200000 }],
          query: 'SELECT cost FROM ops',
          language: 'sql',
        },
      ],
    },
  });

  render(
    <MetricTileRenderer
      {...makeWidgetProps({
        nodeId: 'kpi2',
        widgetType: 'metric-tile',
        props: {
          label: 'Operating Cost',
          prefix: '$',
          abbreviate: true,
          showDelta: true,
          invertDelta: true,
          target: 2000000,
          showProgress: true,
          align: 'center',
          dataBinding: {
            datasetId: 13,
            metrics: [{ label: 'cost' }],
            dimensions: [],
          },
        },
      })}
    />,
    { useRedux: true, useRouter: true },
  );

  expect(await screen.findByText('$1.5M')).toBeInTheDocument();
  expect(screen.getByText('+25.0%')).toBeInTheDocument();
  expect(screen.getByText('vs target ($2.0M)')).toBeInTheDocument();
  const progressbar = screen.getByRole('progressbar');
  expect(progressbar).toHaveAttribute('aria-valuenow', '75');
  fetchMock.removeRoutes();
});

test('TableRenderer applies headerBgColor, headerTextColor, and striped wrapper styles', async () => {
  fetchMock.removeRoutes();
  fetchMock.post('glob:*/api/v1/canvas/1/placement/tbl1/data', {
    result: {
      datasets: [
        {
          name: 'main',
          row_count: 2,
          inline_data: [
            { country: 'USA', sales: 100 },
            { country: 'Canada', sales: 50 },
          ],
          query: 'SELECT country, sales FROM orders',
          language: 'sql',
        },
      ],
    },
  });

  const { container } = render(
    <TableRenderer
      {...makeWidgetProps({
        nodeId: 'tbl1',
        widgetType: 'ag-grid-table',
        props: {
          headerBgColor: '#1e293b',
          headerTextColor: '#ffffff',
          striped: true,
          dataBinding: {
            datasetId: 13,
            metrics: [{ label: 'sales' }],
            dimensions: ['country'],
          },
        },
      })}
    />,
    { useRedux: true, useRouter: true },
  );

  expect(await screen.findByText('USA')).toBeInTheDocument();
  expect(container.querySelector('[data-striped="true"]')).toBeInTheDocument();

  // Click "sales" header to sort ascending (50 before 100)
  fireEvent.click(screen.getAllByText('sales')[0]);
  const bodyRows = Array.from(
    container.querySelectorAll('tbody tr.ant-table-row'),
  ).map(tr => tr.textContent);
  expect(bodyRows[0]).toContain('Canada');
  expect(bodyRows[1]).toContain('USA');
  fetchMock.removeRoutes();
});

test('ParameterRenderer switch inputType publishes onValue and offValue', () => {
  const setCustomizationValue = jest.fn();
  render(
    <ParameterRenderer
      {...makeWidgetProps({
        props: {
          name: 'showNet',
          label: 'Net Revenue',
          inputType: 'switch',
          defaultValue: 'gross',
          onValue: 'net',
          offValue: 'gross',
        },
        setCustomizationValue,
      })}
    />,
  );

  expect(setCustomizationValue).toHaveBeenCalledWith({
    name: 'showNet',
    value: 'gross',
  });
  const toggle = screen.getByRole('switch', { name: 'Net Revenue' });
  fireEvent.click(toggle);
  expect(setCustomizationValue).toHaveBeenLastCalledWith({
    name: 'showNet',
    value: 'net',
  });
});

test('ParameterRenderer select supports {label, value} options and emits value', async () => {
  const setCustomizationValue = jest.fn();
  render(
    <ParameterRenderer
      {...makeWidgetProps({
        props: {
          name: 'breakdownDim',
          label: 'Breakdown Dimension',
          inputType: 'select',
          defaultValue: 'product_line',
          options: [
            { label: 'Product Line', value: 'product_line' },
            { label: 'Territory', value: 'territory' },
          ],
        },
        setCustomizationValue,
      })}
    />,
  );

  expect(setCustomizationValue).toHaveBeenCalledWith({
    name: 'breakdownDim',
    value: 'product_line',
  });
  expect(screen.getByText('Product Line')).toBeInTheDocument();
  const combo = screen.getByRole('combobox', { name: 'Breakdown Dimension' });
  fireEvent.mouseDown(combo);
  fireEvent.click(await screen.findByText('Territory'));
  expect(setCustomizationValue).toHaveBeenLastCalledWith({
    name: 'breakdownDim',
    value: 'territory',
  });
});

test('TableRenderer supports searchable quick filter and row-click crossFilter', async () => {
  fetchMock.clearHistory();
  fetchMock.removeRoutes();
  fetchMock.post('glob:*/api/v1/canvas/1/placement/tbl2/data', {
    result: {
      datasets: [
        {
          name: 'main',
          row_count: 2,
          inline_data: [
            { country: 'USA', sales: 100 },
            { country: 'Canada', sales: 50 },
          ],
          query: 'SELECT country, sales FROM orders',
          language: 'sql',
        },
      ],
    },
  });

  const setCrossFilter = jest.fn();
  render(
    <TableRenderer
      {...makeWidgetProps({
        nodeId: 'tbl2',
        widgetType: 'ag-grid-table',
        props: {
          searchable: true,
          crossFilter: true,
          density: 'comfortable',
          wrapText: true,
          dataBinding: {
            datasetId: 13,
            metrics: [{ label: 'sales' }],
            dimensions: ['country'],
          },
        },
        setCrossFilter,
      })}
    />,
    { useRedux: true, useRouter: true },
  );

  expect(await screen.findByText('USA')).toBeInTheDocument();
  const search = screen.getByPlaceholderText('Search rows...');
  fireEvent.change(search, { target: { value: 'Can' } });
  expect(screen.queryByText('USA')).not.toBeInTheDocument();
  expect(screen.getByText('Canada')).toBeInTheDocument();

  fireEvent.click(screen.getByText('Canada'));
  expect(setCrossFilter).toHaveBeenCalledWith({
    datasetId: 13,
    column: 'country',
    values: ['Canada'],
  });
  fireEvent.click(screen.getByText('Canada'));
  expect(setCrossFilter).toHaveBeenLastCalledWith(undefined);
  fetchMock.removeRoutes();
});
