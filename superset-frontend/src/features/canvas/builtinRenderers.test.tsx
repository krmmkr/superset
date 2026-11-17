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
import { useState } from 'react';
import fetchMock from 'fetch-mock';
import { fireEvent, render, screen } from 'spec/helpers/testing-library';
import ActiveFiltersBar from './ActiveFiltersBar';
import CanvasGrid, { emptyScopeValues, ScopeValues } from './CanvasGrid';
import { MetricTileRenderer } from './dataRenderers';
import { registerBuiltinRenderers } from './builtinRenderers';
import { CanvasDefinitionResult } from './types';

const inline = (
  widgetType: string,
  props: Record<string, unknown> = {},
  children?: string[],
) => ({ widgetType, schemaVersion: 1, props, layout: {}, children });

const result: CanvasDefinitionResult = {
  version: 1,
  revision: 1,
  definition: {
    version: 1,
    root: {
      layout: { columns: 24, gap: 16, rowUnit: 40 },
      children: ['overview', 'kpis'],
    },
    nodes: {
      overview: inline('tabs', {}, ['emea', 'apac']),
      emea: inline('tab', { title: 'EMEA' }, ['notes']),
      apac: inline('tab', {}, []),
      notes: inline('markdown', { content: '**Quarterly** notes' }),
      kpis: inline('group', { title: 'Key numbers' }, []),
    },
    interactions: { filters: {}, crossFilters: {}, customizations: {} },
    settings: {
      refresh: { interval: 0, stagger: 0, exempt: [] },
      colors: { labelColors: {} },
      display: { showTimestamps: false },
      crossFilters: { enabled: true },
    },
  },
  filterScopes: {},
  crossFilterScopes: {},
  customizationScopes: {},
  eventScopes: {},
  placements: {},
  layouts: {},
  childOrder: { root: ['overview', 'kpis'] },
  widgetTypes: {
    overview: 'tabs',
    emea: 'tab',
    apac: 'tab',
    notes: 'markdown',
    kpis: 'group',
  },
  gridColumns: { emea: 24, apac: 24, kpis: 12 },
  layoutConstraints: {},
  canEdit: false,
};

test('renders core containers and markdown without extensions', async () => {
  registerBuiltinRenderers();
  render(
    <CanvasGrid
      canvasId={1}
      result={result}
      values={emptyScopeValues()}
      onValueChange={jest.fn()}
      layout={{
        placements: result.placements,
        layouts: result.layouts,
        childOrder: result.childOrder,
        layoutConstraints: result.layoutConstraints,
        revision: result.revision,
        saving: false,
        place: jest.fn(),
        move: jest.fn(),
        swap: jest.fn(),
        filterScopes: {},
        crossFilterScopes: {},
        customizationScopes: {},
        remove: jest.fn(),
        removed: new Set<string>(),
        dismissError: jest.fn(),
      }}
      editable={false}
    />,
  );

  expect(screen.getByRole('tab', { name: 'EMEA' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Untitled tab' })).toBeInTheDocument();
  // react-markdown is stubbed in tests (spec/helpers/shim.tsx) to echo its source.
  expect(await screen.findByText(/Quarterly/)).toBeInTheDocument();
  expect(screen.getByText('Key numbers')).toBeInTheDocument();

  // A group's title fills exactly the row the server keeps above its grid,
  // and nothing more: the container clips, so chrome taller than its
  // reservation cuts the bottom off the grid's last row. Taking the figure
  // from the grid rather than carrying its own is what stops the two
  // drifting -- a fixed margin plus a heading's line box came to more than
  // the row kept for it, and every titled group clipped by the difference.
  const style = getComputedStyle(screen.getByText('Key numbers'));

  expect(style.height).toContain('var(--canvas-chrome-rows');
  expect(style.marginTop).toBe('0px');
});

test('renders callout, header, and filter.date_range widgets', () => {
  registerBuiltinRenderers();
  const onValueChange = jest.fn();
  const extraResult: CanvasDefinitionResult = {
    ...result,
    definition: {
      ...result.definition,
      root: {
        layout: { columns: 24, gap: 16, rowUnit: 40 },
        children: ['banner', 'notice', 'dateFilter'],
      },
      nodes: {
        banner: inline('header', {
          title: 'Sales Overview',
          subtitle: 'Updated daily',
          level: 2,
        }),
        notice: inline('callout', {
          variant: 'warning',
          title: 'Data note',
          message: 'Excludes refunded orders.',
        }),
        dateFilter: inline('filter.date_range', {
          datasetId: 13,
          column: 'order_date',
          label: 'Order Date',
          defaultRange: 'Last 30 days',
        }),
      },
    },
    childOrder: { root: ['banner', 'notice', 'dateFilter'] },
    widgetTypes: {
      banner: 'header',
      notice: 'callout',
      dateFilter: 'filter.date_range',
    },
    gridColumns: {},
  };

  render(
    <CanvasGrid
      canvasId={1}
      result={extraResult}
      values={emptyScopeValues()}
      onValueChange={onValueChange}
      layout={{
        placements: extraResult.placements,
        layouts: extraResult.layouts,
        childOrder: extraResult.childOrder,
        layoutConstraints: extraResult.layoutConstraints,
        revision: extraResult.revision,
        saving: false,
        place: jest.fn(),
        move: jest.fn(),
        swap: jest.fn(),
        filterScopes: {},
        crossFilterScopes: {},
        customizationScopes: {},
        remove: jest.fn(),
        removed: new Set<string>(),
        dismissError: jest.fn(),
      }}
      editable={false}
    />,
  );

  expect(screen.getByText('Sales Overview')).toBeInTheDocument();
  expect(screen.getByText('Updated daily')).toBeInTheDocument();
  expect(screen.getByText('Data note')).toBeInTheDocument();
  expect(screen.getByText('Excludes refunded orders.')).toBeInTheDocument();
  expect(screen.getByText('Order Date')).toBeInTheDocument();
  expect(screen.getByPlaceholderText('Start date')).toBeInTheDocument();
  expect(screen.getByPlaceholderText('End date')).toBeInTheDocument();
  expect(onValueChange).toHaveBeenCalledWith('filter', 'dateFilter', {
    datasetId: 13,
    column: 'order_date',
    op: 'TEMPORAL_RANGE',
    timeRange: 'Last 30 days',
  });
});

test('renders filter.select in checkbox and radio display modes', () => {
  registerBuiltinRenderers();
  const onValueChange = jest.fn();
  const filterModesResult: CanvasDefinitionResult = {
    ...result,
    definition: {
      ...result.definition,
      root: {
        layout: { columns: 24, gap: 16, rowUnit: 40 },
        children: ['dealCheckboxes', 'territoryRadios'],
      },
      nodes: {
        dealCheckboxes: inline('filter.select', {
          datasetId: 13,
          column: 'deal_size',
          label: 'Deal Size',
          displayMode: 'checkbox',
          options: ['Small', 'Medium', 'Large'],
        }),
        territoryRadios: inline('filter.select', {
          datasetId: 13,
          column: 'territory',
          label: 'Territory',
          displayMode: 'radio',
          options: ['NA', 'EMEA'],
        }),
      },
    },
    childOrder: { root: ['dealCheckboxes', 'territoryRadios'] },
    widgetTypes: {
      dealCheckboxes: 'filter.select',
      territoryRadios: 'filter.select',
    },
    gridColumns: {},
  };

  render(
    <CanvasGrid
      canvasId={1}
      result={filterModesResult}
      values={emptyScopeValues()}
      onValueChange={onValueChange}
      layout={{
        placements: filterModesResult.placements,
        layouts: filterModesResult.layouts,
        childOrder: filterModesResult.childOrder,
        layoutConstraints: filterModesResult.layoutConstraints,
        revision: filterModesResult.revision,
        saving: false,
        place: jest.fn(),
        move: jest.fn(),
        swap: jest.fn(),
        filterScopes: {},
        crossFilterScopes: {},
        customizationScopes: {},
        remove: jest.fn(),
        removed: new Set<string>(),
        dismissError: jest.fn(),
      }}
      editable={false}
    />,
  );

  expect(screen.getByRole('checkbox', { name: 'Small' })).toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: 'Medium' })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'NA' })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'EMEA' })).toBeInTheDocument();
});

test('clearing a filter in ActiveFiltersBar resets the filter widget selection', () => {
  registerBuiltinRenderers();
  const filterResult: CanvasDefinitionResult = {
    ...result,
    definition: {
      ...result.definition,
      root: {
        layout: { columns: 24, gap: 16, rowUnit: 40 },
        children: ['dealCheckboxes'],
      },
      nodes: {
        dealCheckboxes: inline('filter.select', {
          datasetId: 13,
          column: 'deal_size',
          label: 'Deal Size',
          displayMode: 'checkbox',
          options: ['Small', 'Medium'],
        }),
      },
    },
    childOrder: { root: ['dealCheckboxes'] },
    widgetTypes: { dealCheckboxes: 'filter.select' },
    gridColumns: {},
  };

  function Harness() {
    const [values, setValues] = useState<ScopeValues>(emptyScopeValues);
    const onValueChange = (
      kind: 'filter' | 'crossFilter' | 'customization',
      nodeId: string,
      val: unknown,
    ) =>
      setValues(prev => {
        const nextKind = { ...prev[kind] };
        if (val === undefined || val === null) {
          delete nextKind[nodeId];
        } else {
          nextKind[nodeId] = val;
        }
        return { ...prev, [kind]: nextKind };
      });
    return (
      <>
        <ActiveFiltersBar
          values={values}
          onClear={(kind, nodeId) => onValueChange(kind, nodeId, undefined)}
          onClearAll={() => setValues(emptyScopeValues())}
        />
        <CanvasGrid
          canvasId={1}
          result={filterResult}
          values={values}
          onValueChange={onValueChange}
          layout={{
            placements: filterResult.placements,
            layouts: filterResult.layouts,
            childOrder: filterResult.childOrder,
            layoutConstraints: filterResult.layoutConstraints,
            revision: filterResult.revision,
            saving: false,
            place: jest.fn(),
            move: jest.fn(),
            swap: jest.fn(),
            filterScopes: {},
            crossFilterScopes: {},
            customizationScopes: {},
            remove: jest.fn(),
            removed: new Set<string>(),
            dismissError: jest.fn(),
          }}
          editable={false}
        />
      </>
    );
  }

  render(<Harness />);
  const smallCheckbox = screen.getByRole('checkbox', { name: 'Small' });
  fireEvent.click(smallCheckbox);
  expect(smallCheckbox).toBeChecked();
  expect(screen.getByText('deal_size: Small')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
  expect(smallCheckbox).not.toBeChecked();
  expect(screen.queryByText('deal_size: Small')).not.toBeInTheDocument();
});

test('MetricTileRenderer prefers configured metric over numeric dimensions and computes delta', async () => {
  fetchMock.post('glob:*/api/v1/canvas/2/placement/kpi1/data', {
    result: {
      datasets: [
        {
          name: 'main',
          row_count: 2,
          inline_data: [
            { year: 2005, 'Total Sales': 1500 },
            { year: 2004, 'Total Sales': 1000 },
          ],
          query:
            'SELECT year, SUM(sales) AS "Total Sales" FROM sales GROUP BY year',
          language: 'sql',
        },
      ],
    },
  });

  render(
    <MetricTileRenderer
      canvasId={2}
      nodeId="kpi1"
      widgetType="metric-tile"
      props={{
        label: 'Total Sales',
        prefix: '$',
        decimals: 0,
        showDelta: true,
        comparisonLabel: 'vs prior year',
        dataBinding: {
          datasetId: 13,
          metrics: [{ label: 'Total Sales' }],
          dimensions: ['year'],
        },
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

  expect(await screen.findByText('$1,500')).toBeInTheDocument();
  expect(screen.getByText('+50.0%')).toBeInTheDocument();
  expect(screen.getByText('vs prior year')).toBeInTheDocument();
  fetchMock.removeRoutes();
});

test('MetricTileRenderer applies crossFilters to its data query', async () => {
  fetchMock.clearHistory();
  fetchMock.post('glob:*/api/v1/canvas/2/placement/kpi1/data', {
    result: {
      datasets: [
        {
          name: 'main',
          row_count: 1,
          inline_data: [{ 'Total Sales': 420 }],
          query: 'SELECT SUM(sales) FROM tbl WHERE region IN ("EMEA")',
          language: 'sql',
        },
      ],
    },
  });

  render(
    <MetricTileRenderer
      canvasId={2}
      nodeId="kpi1"
      widgetType="metric-tile"
      props={{
        label: 'Total Sales',
        prefix: '$',
        decimals: 0,
        dataBinding: {
          datasetId: 13,
          metrics: [{ label: 'Total Sales' }],
        },
      }}
      filters={[]}
      crossFilters={[
        {
          sourceId: 'c1',
          value: { datasetId: 13, column: 'region', values: ['EMEA'] },
        },
      ]}
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

  expect(await screen.findByText('$420')).toBeInTheDocument();
  const [call] = fetchMock.callHistory.calls();
  const body = JSON.parse(String(call.options.body));
  expect(body.runtime_filters).toEqual([
    { datasetId: 13, column: 'region', values: ['EMEA'] },
  ]);
  fetchMock.removeRoutes();
});
