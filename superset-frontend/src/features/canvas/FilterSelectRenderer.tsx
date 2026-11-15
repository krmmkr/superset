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
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { canvas as canvasApi } from '@apache-superset/core';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { SupersetClient } from '@superset-ui/core';
import {
  Checkbox,
  Radio,
  Select,
  Typography,
} from '@superset-ui/core/components';
import type { SelectFilterValue } from './echarts/chartData';
import { CanvasFilterValuesContext } from './useWidgetRows';

const Wrapper = styled.div`
  ${({ theme }) => css`
    width: 100%;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit}px;
  `}
`;

const CheckboxList = styled.div<{ vertical: boolean }>`
  ${({ theme, vertical }) => css`
    .ant-checkbox-group {
      display: flex;
      flex-direction: ${vertical ? 'column' : 'row'};
      flex-wrap: wrap;
      gap: ${theme.sizeUnit * 1.5}px;
    }
  `}
`;

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(String) : [];

/**
 * A multi-select over one dataset column. Its value reaches the widgets in
 * its scope as `{datasetId, column, values}`, or clears when nothing is
 * selected.
 */
export default function FilterSelectRenderer({
  nodeId,
  props,
  setFilterValue,
}: canvasApi.CanvasWidgetProps) {
  const datasetId = Number(props?.datasetId);
  const column = typeof props?.column === 'string' ? props.column : '';
  const label =
    typeof props?.label === 'string' && props.label
      ? props.label
      : column || t('Filter');
  const displayMode =
    props?.displayMode === 'checkbox' || props?.displayMode === 'radio'
      ? props.displayMode
      : 'select';
  const orientation =
    props?.orientation === 'vertical' ? 'vertical' : 'horizontal';
  const staticOptions = strings(props?.options);
  const [fetched, setFetched] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>(() =>
    strings(props?.defaultSelection),
  );
  const published = useRef(false);
  const hadLiveValue = useRef(false);
  const liveFilterValue = useContext(CanvasFilterValuesContext)[nodeId];

  useEffect(() => {
    if (liveFilterValue !== undefined) {
      hadLiveValue.current = true;
    } else if (hadLiveValue.current) {
      hadLiveValue.current = false;
      setSelected([]);
    }
  }, [liveFilterValue]);

  useEffect(() => {
    if (staticOptions.length || !datasetId || !column) return undefined;
    let cancelled = false;
    SupersetClient.get({
      endpoint: `/api/v1/datasource/table/${datasetId}/column/${encodeURIComponent(column)}/values/`,
    })
      .then(({ json }) => {
        if (!cancelled) {
          setFetched(strings(json?.result).filter(value => value !== 'null'));
        }
      })
      .catch(() => {
        if (!cancelled) setFetched([]);
      });
    return () => {
      cancelled = true;
    };
    // staticOptions is recreated on every render; its length decides.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetId, column, staticOptions.length]);

  const publish = (values: string[]) => {
    const value: SelectFilterValue | null = values.length
      ? { datasetId, column, values }
      : null;
    setFilterValue(value);
  };

  // A default selection applies once, on first render.
  useEffect(() => {
    if (published.current) return;
    published.current = true;
    if (selected.length) publish(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const options = useMemo(
    () =>
      (staticOptions.length ? staticOptions : fetched).map(value => ({
        label: value,
        value,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fetched, staticOptions.join('\u0000')],
  );

  const updateSelection = (values: string[]) => {
    setSelected(values);
    publish(values);
  };

  return (
    <Wrapper>
      <Typography.Text strong>{label}</Typography.Text>
      {displayMode === 'checkbox' && (
        <CheckboxList vertical={orientation === 'vertical'}>
          <Checkbox.Group
            aria-label={label}
            options={options}
            value={selected}
            onChange={checked => updateSelection(strings(checked))}
          />
        </CheckboxList>
      )}
      {displayMode === 'radio' && (
        <Radio.Group
          aria-label={label}
          value={selected[0] ?? '__all__'}
          spaceConfig={{ direction: orientation, wrap: true }}
          options={[{ label: t('All'), value: '__all__' }, ...options]}
          onChange={e => {
            const val = String(e.target.value);
            updateSelection(val === '__all__' ? [] : [val]);
          }}
        />
      )}
      {displayMode === 'select' && (
        <Select
          ariaLabel={label}
          mode="multiple"
          allowClear
          placeholder={t('All')}
          options={options}
          value={selected}
          onChange={value => updateSelection(strings(value))}
        />
      )}
    </Wrapper>
  );
}
