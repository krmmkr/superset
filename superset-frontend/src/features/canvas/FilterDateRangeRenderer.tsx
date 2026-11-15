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
import { RangePicker, Typography } from '@superset-ui/core/components';
import type { RangePickerProps } from '@superset-ui/core/components/DatePicker/types';
import { extendedDayjs } from '@superset-ui/core/utils/dates';
import type { DateRangeFilterValue } from './echarts/chartData';
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

type DayjsValue = NonNullable<RangePickerProps['value']>;

function parseDefaultRange(raw: string): DayjsValue | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.includes(' : ')) {
    const [startStr, endStr] = trimmed.split(' : ').map(s => s.trim());
    const start = extendedDayjs(startStr);
    const end = extendedDayjs(endStr);
    if (start.isValid() && end.isValid()) {
      return [start, end];
    }
  }
  return null;
}

/**
 * A calendar date-range picker with quick presets over one dataset column.
 * Publishes a `TEMPORAL_RANGE` filter value to widgets in its scope, or clears
 * when reset.
 */
export default function FilterDateRangeRenderer({
  nodeId,
  props,
  setFilterValue,
}: canvasApi.CanvasWidgetProps) {
  const datasetId = Number(props?.datasetId);
  const column = typeof props?.column === 'string' ? props.column : '';
  const label =
    typeof props?.label === 'string' && props.label
      ? props.label
      : column || t('Date range');
  const defaultRange =
    typeof props?.defaultRange === 'string' ? props.defaultRange : '';
  const [rangeValue, setRangeValue] = useState<DayjsValue | null>(() =>
    parseDefaultRange(defaultRange),
  );
  const published = useRef(false);
  const hadLiveValue = useRef(false);
  const liveFilterValue = useContext(CanvasFilterValuesContext)[nodeId];

  useEffect(() => {
    if (liveFilterValue !== undefined) {
      hadLiveValue.current = true;
    } else if (hadLiveValue.current) {
      hadLiveValue.current = false;
      setRangeValue(null);
    }
  }, [liveFilterValue]);

  const publish = (timeRange?: string) => {
    const value: DateRangeFilterValue | null =
      timeRange && datasetId && column
        ? { datasetId, column, op: 'TEMPORAL_RANGE', timeRange }
        : null;
    setFilterValue(value);
  };

  // A default range applies once, on first render.
  useEffect(() => {
    if (published.current) return;
    published.current = true;
    if (defaultRange) publish(defaultRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const presets = useMemo<NonNullable<RangePickerProps['presets']>>(() => {
    const today = extendedDayjs();
    return [
      {
        label: t('Last 7 days'),
        value: [today.subtract(7, 'day'), today],
      },
      {
        label: t('Last 30 days'),
        value: [today.subtract(30, 'day'), today],
      },
      {
        label: t('Last 90 days'),
        value: [today.subtract(90, 'day'), today],
      },
      {
        label: t('This month'),
        value: [today.startOf('month'), today],
      },
      {
        label: t('This year'),
        value: [today.startOf('year'), today],
      },
      {
        label: t('Last year'),
        value: [
          today.subtract(1, 'year').startOf('year'),
          today.subtract(1, 'year').endOf('year'),
        ],
      },
    ];
  }, []);

  return (
    <Wrapper>
      <Typography.Text strong>{label}</Typography.Text>
      <RangePicker
        aria-label={label}
        allowClear
        presets={presets}
        value={rangeValue}
        placeholder={[t('Start date'), t('End date')]}
        style={{ width: '100%' }}
        onChange={dates => {
          if (dates && dates[0] && dates[1]) {
            const next: DayjsValue = [dates[0], dates[1]];
            setRangeValue(next);
            publish(
              `${dates[0].format('YYYY-MM-DD')} : ${dates[1].format('YYYY-MM-DD')}T23:59:59`,
            );
          } else {
            setRangeValue(null);
            publish(undefined);
          }
        }}
      />
    </Wrapper>
  );
}
