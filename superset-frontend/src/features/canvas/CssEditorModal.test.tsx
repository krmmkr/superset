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
  fireEvent,
  render,
  screen,
  waitFor,
} from 'spec/helpers/testing-library';
import CssEditorModal from './CssEditorModal';

beforeEach(() => {
  fetchMock.removeRoutes();
  fetchMock.clearHistory();
  document
    .querySelectorAll('style.CssEditor-css')
    .forEach(node => node.remove());
});

afterEach(() => {
  fetchMock.removeRoutes();
  fetchMock.clearHistory();
});

test('CssEditorModal live-previews CSS, saves via PUT /api/v1/canvas/:id, and invokes onSaved', async () => {
  fetchMock.put('glob:*/api/v1/canvas/2', {
    result: { css: '.canvas-widget { border-radius: 12px; }' },
  });

  const onSaved = jest.fn();
  const onHide = jest.fn();

  render(
    <CssEditorModal
      show
      canvasId={2}
      initialCss=".canvas-widget { border-radius: 4px; }"
      onSaved={onSaved}
      onHide={onHide}
    />,
  );

  const textarea = screen.getByTestId('canvas-css-textarea');
  expect(textarea).toHaveValue('.canvas-widget { border-radius: 4px; }');

  fireEvent.change(textarea, {
    target: { value: '.canvas-widget { border-radius: 12px; }' },
  });

  const styleEl = document.querySelector('style.CssEditor-css');
  expect(styleEl?.innerHTML).toContain('border-radius: 12px');

  fireEvent.click(screen.getByTestId('canvas-css-save'));

  await waitFor(() => {
    expect(onSaved).toHaveBeenCalledWith(
      '.canvas-widget { border-radius: 12px; }',
    );
  });
  expect(onHide).toHaveBeenCalled();

  const calls = fetchMock.callHistory.calls('glob:*/api/v1/canvas/2');
  expect(calls).toHaveLength(1);
  const body = JSON.parse(String(calls[0].options?.body ?? '{}'));
  expect(body).toEqual({ css: '.canvas-widget { border-radius: 12px; }' });
});

test('CssEditorModal reverts live preview on cancel', () => {
  const onHide = jest.fn();

  render(
    <CssEditorModal
      show
      canvasId={2}
      initialCss=".canvas-widget { opacity: 1; }"
      onSaved={jest.fn()}
      onHide={onHide}
    />,
  );

  fireEvent.change(screen.getByTestId('canvas-css-textarea'), {
    target: { value: '.canvas-widget { opacity: 0.5; }' },
  });
  expect(document.querySelector('style.CssEditor-css')?.innerHTML).toContain(
    'opacity: 0.5',
  );

  fireEvent.click(screen.getByTestId('canvas-css-cancel'));
  expect(document.querySelector('style.CssEditor-css')?.innerHTML).toContain(
    'opacity: 1',
  );
  expect(onHide).toHaveBeenCalled();
});
