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
import { fireEvent, render, screen } from 'spec/helpers/testing-library';
import ActiveFiltersBar from './ActiveFiltersBar';
import { emptyScopeValues } from './CanvasGrid';

test('renders nothing when no filters or cross-filters are active', () => {
  const values = emptyScopeValues();
  values.filter.region = { column: 'region', values: [] };
  values.crossFilter.chart1 = undefined;

  const { container } = render(
    <ActiveFiltersBar
      values={values}
      onClear={jest.fn()}
      onClearAll={jest.fn()}
    />,
  );

  expect(container.firstChild).toBeNull();
});

test('renders active filter and cross-filter chips and clears individually or all', () => {
  const values = emptyScopeValues();
  values.filter.region_filter = {
    datasetId: 1,
    column: 'region',
    values: ['East', 'West'],
  };
  values.crossFilter.sales_chart = {
    column: 'category',
    values: ['Electronics'],
  };

  const onClear = jest.fn();
  const onClearAll = jest.fn();

  render(
    <ActiveFiltersBar
      values={values}
      titles={{ region_filter: 'Region Filter' }}
      onClear={onClear}
      onClearAll={onClearAll}
    />,
  );

  expect(screen.getByText('Region Filter: East, West')).toBeInTheDocument();
  expect(screen.getByText('category: Electronics')).toBeInTheDocument();

  const closeButtons = screen.getAllByRole('button', { name: 'Close' });
  fireEvent.click(closeButtons[0]);
  expect(onClear).toHaveBeenCalledWith('filter', 'region_filter');

  fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
  expect(onClearAll).toHaveBeenCalledTimes(1);
});
