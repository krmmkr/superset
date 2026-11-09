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
import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { useSelector } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { NO_TIME_RANGE, fetchTimeRange, SEPARATOR } from '@superset-ui/core';
import { styled, useTheme } from '@apache-superset/core/theme';
import {
  RangePicker,
  Button,
  AntdThemeProvider,
  InfoTooltip,
  Popover,
} from '@superset-ui/core/components';
import {
  CommonFrame,
  CalendarFrame,
  CurrentCalendarFrame,
  CustomFrame,
} from 'src/explore/components/controls/DateFilterControl/components';
import { DateFilterTestKey } from 'src/explore/components/controls/DateFilterControl/utils';
import { FilterPluginStyle } from '../common';
import { PluginFilterDateTimeProps } from './types';
import { useLocale } from 'src/hooks/useLocale';
import dayjs from 'dayjs';

// Matches date strings returned by fetchTimeRange, e.g.:
//   "2026-04-23 ≤ col < 2026-04-29"
//   "2026-04-23 00:00:00 ≤ col < 2026-04-29 00:00:00"
const RESOLVED_DATE_RE = /(\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}:\d{2})?)/g;

function formatResolvedWithTime(resolved: string): string {
  if (!resolved) return '';
  return resolved.replace(
    /(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}:\d{2}))?/g,
    (_match, datePart, timePart) => `${datePart} ${timePart || '00:00:00'}`,
  );
}

/* ------------------------------------------------------------------ */
/*  Frame → Tab mapping                                                 */
/* ------------------------------------------------------------------ */

type TabKey = 'basic' | 'last' | 'previous' | 'current' | 'custom' | 'advanced';

const TAB_CONFIG: { key: TabKey; label: string }[] = [
  { key: 'basic', label: 'Basic' },
  { key: 'current', label: 'Current' },
  { key: 'last', label: 'Last' },
  { key: 'previous', label: 'Previous' },
  { key: 'custom', label: 'Custom' },
];

/* ------------------------------------------------------------------ */
/*  Styled wrappers                                                     */
/* ------------------------------------------------------------------ */

const DateTimeFilterStyles = styled(FilterPluginStyle)`
  display: flex;
  align-items: center;
  overflow-x: visible;
`;

const ControlContainer = styled.div<{
  validateStatus?: 'error' | 'warning' | 'info';
}>`
  display: flex;
  height: 100%;
  max-width: 100%;
  width: 100%;

  & > .ant-picker,
  .ant-picker {
    width: 100%;
    flex: 1;
    border-radius: 8px;
  }

  .trigger-clear-btn {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: ${({ theme }) => theme.colorBgContainer};
    color: ${({ theme }) =>
      theme.colorTextQuaternary || theme.colorTextTertiary};
    cursor: pointer;
    opacity: 0;
    transition:
      opacity 0.15s,
      color 0.15s;

    &:hover {
      color: ${({ theme }) =>
        theme.colorTextSecondary || theme.colorTextTertiary};
    }
  }

  &:hover .trigger-clear-btn {
    opacity: 1;
  }
`;

const PopoverContent = styled.div`
  width: 580px;
  max-width: 90vw;
  margin: -12px;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  .tab-nav {
    display: flex;
    flex-shrink: 0;
    border-bottom: 1px solid ${({ theme }) => theme.colorBorderSecondary};
    padding: 4px 20px 0;
    margin-bottom: 0;
    gap: 28px;
  }

  .tab-nav-item {
    padding: 8px 0 8px;
    cursor: pointer;
    font-size: 14px;
    line-height: 20px;
    font-weight: 400;
    color: ${({ theme }) => theme.colorText};
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    transition: all 0.2s;

    &:hover {
      color: ${({ theme }) => theme.colorPrimary};
    }

    &.active {
      color: ${({ theme }) => theme.colorPrimary};
      border-bottom-color: ${({ theme }) => theme.colorPrimary};
    }
  }

  .tab-body {
    padding: 0 20px;
    flex: 1 1 auto;
    min-height: 100px;

    &.tab-body--padded {
      padding: 12px 20px 14px;
    }

    .section-title {
      font-weight: 600;
      font-size: 14px;
      line-height: 20px;
      margin-bottom: 8px;
    }

    .control-label {
      font-size: 14px;
      line-height: 20px;
      font-weight: 400;
      color: ${({ theme }) => theme.colorText};
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 6px;

      .anticon {
        color: ${({ theme }) => theme.colorTextSecondary};
        font-size: 14px;
      }
    }

    .ant-input {
      background: color-mix(
        in srgb,
        ${({ theme }) => theme.colorBgContainer} 82%,
        ${({ theme }) => theme.colorBgBase}
      ) !important;
      border: 1px solid
        color-mix(
          in srgb,
          ${({ theme }) => theme.colorBorder} 70%,
          ${({ theme }) => theme.colorBorderSecondary}
        ) !important;
      color: color-mix(
        in srgb,
        ${({ theme }) => theme.colorText} 72%,
        ${({ theme }) => theme.colorTextSecondary}
      ) !important;
      height: 34px;
      padding: 4px 12px;
      font-size: 14px;
      border-radius: 8px;
      transition:
        border-color 0.2s,
        box-shadow 0.2s,
        color 0.2s;

      &:hover {
        border-color: ${({ theme }) => theme.colorPrimary} !important;
      }

      &:focus {
        color: ${({ theme }) => theme.colorText} !important;
        border-color: ${({ theme }) => theme.colorPrimary} !important;
        box-shadow: 0 0 0 2px ${({ theme }) => theme.colorPrimary}22 !important;
        outline: none;
      }

      &::placeholder {
        color: ${({ theme }) =>
          theme.colorTextPlaceholder || theme.colorTextQuaternary} !important;
      }
    }

    .suggested-row {
      margin-top: 6px;
      font-size: 12px;
      line-height: 18px;
      color: color-mix(
        in srgb,
        ${({ theme }) => theme.colorTextSecondary} 60%,
        ${({ theme }) => theme.colorTextTertiary}
      );

      .suggested-link,
      .suggested-sep {
        color: color-mix(
          in srgb,
          ${({ theme }) => theme.colorPrimary} 78%,
          ${({ theme }) => theme.colorTextSecondary}
        );
      }

      .suggested-link {
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        font: inherit;
        text-decoration: none;
        display: inline;
        transition: color 0.15s;

        &:hover {
          color: ${({ theme }) => theme.colorPrimary};
        }
      }
    }

    .ant-row {
      margin-top: 8px;
    }
    .ant-picker {
      padding: 4px 17px 4px;
      border-radius: 4px;
    }
    .ant-divider-horizontal {
      margin: 10px -20px;
      width: calc(100% + 40px);
      border-color: ${({ theme }) => theme.colorBorderSecondary};
    }
    .control-anchor-to {
      margin-top: 16px;
    }
    .control-anchor-to-datetime {
      width: 217px;
    }

    .bottom-inputs-section {
      display: flex;
      gap: 20px;
      box-sizing: border-box;
      margin: 0 -20px;
      padding: 12px 20px;
      background: color-mix(
        in srgb,
        ${({ theme }) => theme.colorBgContainer} 92%,
        #000000
      );
    }
  }

  .popover-footer {
    flex-shrink: 0;
    border-top: 1px solid ${({ theme }) => theme.colorBorderSecondary};
    padding: 10px 20px;
    text-align: right;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    background: color-mix(
      in srgb,
      ${({ theme }) => theme.colorBgContainer} 92%,
      #000000
    );
  }
`;

const ActualTimeRangeBar = styled.div`
  margin: 0 -20px;
  padding: 9px 20px;
  border-top: 1px solid ${({ theme }) => theme.colorBorderSecondary};
  border-bottom: 1px solid ${({ theme }) => theme.colorBorderSecondary};
`;

const ActualTimeRange = styled.div`
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  color: ${({ theme }) => theme.colorText};
  padding: 0;
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 20px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  .label {
    font-size: 14px;
    font-weight: 400;
    color: ${({ theme }) => theme.colorText};
    flex-shrink: 0;
  }
`;

/**
 * Container that holds the inline calendar.
 *
 * The RangePicker renders two elements:
 *   1. The <input> row — we collapse it to zero height so it's invisible.
 *   2. The dropdown panel — we un-position it so it flows inline in the div.
 *
 * pointer-events on the input are set to none so clicks pass through to the
 * calendar panels, which explicitly restore pointer-events.
 */
const InlineCalendarContainer = styled.div`
  position: relative;
  margin: 0 -20px;
  width: calc(100% + 40px);
  /* Enough height for two calendar months side by side */
  min-height: 222px;

  /* Collapse the picker INPUT element */
  .ant-picker {
    position: absolute !important;
    top: 0;
    left: 0;
    width: 0 !important;
    height: 0 !important;
    padding: 0 !important;
    border: none !important;
    overflow: hidden !important;
    pointer-events: none !important;
    opacity: 0 !important;
  }

  /* Hide the inner dropdown arrow */
  .ant-picker-range-arrow {
    display: none !important;
  }

  /* Make the dropdown render statically inside this div */
  .ant-picker-dropdown {
    position: static !important;
    box-shadow: none !important;
    padding: 0 !important;
    background: transparent !important;
    width: 100% !important;
  }

  .ant-picker-range-wrapper,
  .ant-picker-panel-container,
  .ant-picker-panel-layout {
    box-shadow: none !important;
    border: none !important;
    background: transparent !important;
    width: 100% !important;
    display: flex !important;
  }

  .ant-picker-panels {
    display: flex !important;
    width: 100% !important;
    justify-content: space-between;
    gap: 0 !important;
  }

  .ant-picker-panel {
    flex: 1 1 0 !important;
    width: 50% !important;
    border: none !important;
  }

  .ant-picker-date-panel,
  .ant-picker-content {
    width: 100% !important;
  }

  .ant-picker-body {
    width: 100% !important;
    padding: 2px 16px 6px !important;
  }

  .ant-picker-header {
    border-bottom: 1px solid ${({ theme }) => theme.colorBorderSecondary} !important;
    padding: 6px 20px !important;
    margin-bottom: 2px !important;
    align-items: center;

    button {
      line-height: 24px !important;
      color: ${({ theme }) => theme.colorTextSecondary} !important;

      &:hover {
        color: ${({ theme }) => theme.colorText} !important;
      }
    }
  }

  .ant-picker-header-view,
  .ant-picker-header-view > button {
    font-weight: 700 !important;
    font-size: 14px !important;
    line-height: 24px !important;
    color: ${({ theme }) => theme.colorText} !important;
  }

  .ant-picker-content th {
    font-size: 13px !important;
    color: ${({ theme }) => theme.colorText} !important;
    font-weight: 400 !important;
    height: 26px !important;
    line-height: 26px !important;
  }

  .ant-picker-cell {
    padding: 1px 0 !important;
    font-size: 13px !important;

    &::before {
      height: 26px !important;
    }
  }

  .ant-picker-cell-inner {
    min-width: 26px !important;
    height: 26px !important;
    line-height: 26px !important;
    border-radius: 8px !important;
    font-size: 13px !important;
  }

  /* Range selection colors — Preset Green */
  .ant-picker-cell-in-view.ant-picker-cell-in-range::before {
    background: ${({ theme }) => theme.colorPrimary}22 !important;
  }
  .ant-picker-cell-in-view.ant-picker-cell-range-start .ant-picker-cell-inner,
  .ant-picker-cell-in-view.ant-picker-cell-range-end .ant-picker-cell-inner {
    background: ${({ theme }) => theme.colorPrimary} !important;
    color: white !important;
    border-radius: 8px !important;
  }
  .ant-picker-cell-in-view.ant-picker-cell-today
    .ant-picker-cell-inner::before {
    border-color: ${({ theme }) => theme.colorPrimary} !important;
    border-radius: 8px !important;
  }

  /* Restore click events on the actual calendar UI */
  .ant-picker-panel-container,
  .ant-picker-panel-layout,
  .ant-picker-panels,
  .ant-picker-panel,
  .ant-picker-body,
  .ant-picker-content,
  .ant-picker-header,
  table,
  th,
  td {
    pointer-events: auto !important;
  }
`;

const InputWrapper = styled.div`
  position: relative;
  width: 100%;

  .clear-icon {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: ${({ theme }) =>
      theme.colorTextQuaternary || theme.colorTextTertiary};
    font-size: 14px;
    line-height: 1;
    transition: color 0.2s;

    &:hover {
      color: ${({ theme }) =>
        theme.colorTextSecondary || theme.colorTextTertiary};
    }
  }
`;

const ClearIconSvg = () => (
  <svg
    viewBox="64 64 896 896"
    focusable="false"
    data-icon="close-circle"
    width="14px"
    height="14px"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm165.4 618.2l-66-.3L512 563.4l-99.3 118.4-66.1.3c-4.4 0-8-3.5-8-8 0-1.9.7-3.7 1.9-5.2l130.1-155L340.5 359a8.32 8.32 0 01-1.9-5.2c0-4.4 3.6-8 8-8l66.1.3L512 464.6l99.3-118.4 66-.3c4.4 0 8 3.5 8 8 0 1.9-.7 3.7-1.9 5.2L553.5 514l130 155c1.2 1.5 1.9 3.3 1.9 5.2 0 4.4-3.6 8-8 8z" />
  </svg>
);

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

export default function DateTimeFilterPlugin(props: PluginFilterDateTimeProps) {
  const theme = useTheme();
  const {
    setDataMask,
    setHoveredFilter,
    unsetHoveredFilter,
    setFocusedFilter,
    unsetFocusedFilter,
    setFilterActive,
    width,
    height,
    filterState,
    inputRef,
    isOverflowingFilterBar = false,
    formData,
  } = props;

  const col: string = (formData as any).columnName?.trim() || '';

  // ---- State ----
  const [show, setShow] = useState(false);
  const triggerWrapperRef = useRef<HTMLDivElement>(null);
  const filterBarOrientation = useSelector<
    { dashboardInfo?: { filterBarOrientation?: string } },
    string | undefined
  >(state => state.dashboardInfo?.filterBarOrientation);
  const isVerticalFilterBar = filterBarOrientation === 'VERTICAL';
  const [timeRangeValue, setTimeRangeValue] = useState<string>(NO_TIME_RANGE);
  const [triggerDates, setTriggerDates] = useState<
    [dayjs.Dayjs | null, dayjs.Dayjs | null]
  >([null, null]);
  const [evalResponse, setEvalResponse] = useState<string>('');
  const [validTimeRange, setValidTimeRange] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('basic');
  const [defaultPickerValue, setDefaultPickerValue] = useState<
    [dayjs.Dayjs, dayjs.Dayjs]
  >(() => {
    const now = dayjs().startOf('month');
    return [now, now.add(1, 'month')];
  });

  const datePickerLocale = useLocale();

  // Parse since/until for the inline calendar value
  const [since, until] = useMemo(() => {
    if (
      timeRangeValue &&
      timeRangeValue !== NO_TIME_RANGE &&
      timeRangeValue.includes(SEPARATOR)
    ) {
      const parts = timeRangeValue.split(SEPARATOR);
      return [parts[0]?.trim() || '', parts[1]?.trim() || ''];
    }
    return ['', ''];
  }, [timeRangeValue]);

  const calValue: [dayjs.Dayjs | null, dayjs.Dayjs | null] = useMemo(() => {
    // If we have a successful resolved range string (e.g. "2026-04-23 <= col < 2026-04-29"),
    // use those dates to drive the calendar highlights even if the input is a formula.
    if (
      evalResponse &&
      !evalResponse.includes('Invalid') &&
      evalResponse.includes('col')
    ) {
      const matches = [...evalResponse.matchAll(RESOLVED_DATE_RE)];
      if (matches.length >= 2) {
        const start = dayjs(matches[0][1]);
        const end = dayjs(matches[1][1]);
        if (start.isValid() && end.isValid()) {
          return [start, end];
        }
      }
    }

    // Fallback to direct parsing if it's a fixed date string
    return [
      since && dayjs(since).isValid() ? dayjs(since) : null,
      until && dayjs(until).isValid() ? dayjs(until) : null,
    ];
  }, [since, until, evalResponse]);

  /* ---- Resolve filterState.value → trigger display --------------- */
  // Watch the dashboard's confirmed value and derive actual dates for the
  // trigger RangePicker display. This survives re-mounts and page reloads.
  useEffect(() => {
    const value = (filterState.value as string) || NO_TIME_RANGE;
    if (!value || value === NO_TIME_RANGE) {
      setTriggerDates([null, null]);
      return;
    }

    // Synchronous path: value is already ISO date strings (e.g. "2026-04-01 : 2026-05-01")
    if (value.includes(SEPARATOR)) {
      const parts = value.split(SEPARATOR);
      const s = parts[0]?.trim() ?? '';
      const e = parts[1]?.trim() ?? '';
      const start = s && dayjs(s).isValid() ? dayjs(s) : null;
      const end = e && dayjs(e).isValid() ? dayjs(e) : null;
      // ONLY use the fast path if BOTH are valid dates.
      // If either is a formula (invalid dayjs), we must use the async fetchTimeRange path.
      if (start && end) {
        setTriggerDates([start, end]);
        return;
      }
    }

    // Async path: resolve formula strings (e.g. "30 days ago : now")
    fetchTimeRange(value).then(({ value: resolved, error }) => {
      if (!error && resolved) {
        const matches = [...resolved.matchAll(RESOLVED_DATE_RE)];
        if (matches.length >= 2) {
          setTriggerDates([
            dayjs(matches[0][1]).isValid() ? dayjs(matches[0][1]) : null,
            dayjs(matches[1][1]).isValid() ? dayjs(matches[1][1]) : null,
          ]);
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterState.value]);

  /* ---- Resolve actual time range preview ------------------------- */
  useEffect(() => {
    let isCurrent = true;
    if (!timeRangeValue || timeRangeValue === NO_TIME_RANGE) {
      setEvalResponse('');
      setValidTimeRange(true);
      return undefined;
    }
    fetchTimeRange(timeRangeValue).then(({ value: resolved, error }) => {
      if (!isCurrent) return;
      if (error) {
        setEvalResponse(error || '');
        setValidTimeRange(false);
      } else {
        setEvalResponse(formatResolvedWithTime(resolved || ''));
        setValidTimeRange(true);
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [timeRangeValue]);

  /* ---- Emit filter ---------------------------------------------- */
  const emitFilter = useCallback(
    async (rangeStr: string) => {
      const isSet = rangeStr && rangeStr !== NO_TIME_RANGE;
      if (!isSet) {
        setDataMask({
          extraFormData: { filters: [] },
          filterState: { value: null, label: '' },
        });
        return;
      }

      const extra: Record<string, any> = { time_range: rangeStr };

      try {
        const { value: resolved, error } = await fetchTimeRange(rangeStr);
        if (!error && resolved) {
          const matches = [...resolved.matchAll(RESOLVED_DATE_RE)];
          if (matches.length >= 2) {
            const start = matches[0][1];
            const end = matches[1][1];
            if (col) {
              extra.filters = [
                { col, op: '>=', val: start },
                { col, op: '<=', val: end },
              ];
            }
          }
        }
      } catch {
        // fall back to time_range only
      }

      setDataMask({
        extraFormData: extra,
        filterState: { value: rangeStr, label: rangeStr },
      });
    },
    [col, setDataMask],
  );

  /* ---- Popover lifecycle ----------------------------------------- */
  function onOpen() {
    const current = (filterState.value as string) || NO_TIME_RANGE;
    setTimeRangeValue(current);

    // Compute defaultPickerValue once upon opening based on current value.
    // Note: in rc-picker RangePicker, pickerValue[0] is the left-panel month when
    // the Start field is active, and pickerValue[1] is the left-panel month when
    // the End field is active (the right panel is always pickerValue[activeIndex] + 1 month).
    // Setting both entries to `baseMonth` prevents the calendar from jumping forward
    // by a month when clicking a start date switches activeIndex from 0 to 1.
    let startVal: dayjs.Dayjs | null = null;

    if (current && current !== NO_TIME_RANGE && current.includes(SEPARATOR)) {
      const parts = current.split(SEPARATOR);
      const s = parts[0]?.trim() || '';
      if (s && dayjs(s).isValid()) {
        startVal = dayjs(s);
      }
    } else if (triggerDates[0] && triggerDates[0].isValid()) {
      startVal = triggerDates[0];
    }

    const baseMonth = (
      startVal && startVal.isValid() ? startVal : dayjs()
    ).startOf('month');
    setDefaultPickerValue([baseMonth, baseMonth]);

    // Always open on Basic tab so the inline calendar is shown immediately
    setActiveTab('basic');
    setShow(true);
    setFilterActive(true);
  }

  function onClose() {
    setShow(false);
    setFilterActive(false);
    unsetFocusedFilter();
    unsetHoveredFilter();
  }

  async function onApply() {
    await emitFilter(timeRangeValue);
    onClose();
  }

  function onTabChange(key: TabKey) {
    setActiveTab(key);
    if (key !== 'basic') {
      setTimeRangeValue(NO_TIME_RANGE);
    }
  }

  /* ---- Apply on mount if existing value -------------------------- */
  useEffect(() => {
    if (filterState.value) {
      emitFilter(filterState.value as string);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- Tab content ---------------------------------------------- */
  const frameProps = {
    value: timeRangeValue,
    onChange: setTimeRangeValue,
    isOverflowingFilterBar,
  };

  const renderBasicTab = () => (
    <AntdThemeProvider locale={datePickerLocale ?? undefined}>
      {/* Inline dual-month calendar */}
      <InlineCalendarContainer>
        <RangePicker
          open
          value={calValue}
          defaultPickerValue={defaultPickerValue}
          pickerValue={defaultPickerValue}
          onPickerValueChange={(dates, info) => {
            if (info.source === 'panel') {
              const nextMonth =
                info.range === 'end' ? dates?.[1] : dates?.[0];
              if (nextMonth) {
                setDefaultPickerValue([nextMonth, nextMonth]);
              }
            }
          }}
          onCalendarChange={(
            dates: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null,
          ) => {
            if (dates && (dates[0] || dates[1])) {
              const start = dates[0]
                ? dates[0].startOf('day').format('YYYY-MM-DD HH:mm:ss')
                : '';
              const end = dates[1]
                ? dates[1].startOf('day').format('YYYY-MM-DD HH:mm:ss')
                : '';
              setTimeRangeValue(`${start}${SEPARATOR}${end}`);
            } else {
              setTimeRangeValue(NO_TIME_RANGE);
            }
          }}
          onChange={(
            dates: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null,
          ) => {
            if (dates && dates[0] && dates[1]) {
              setTimeRangeValue(
                `${dates[0].startOf('day').format('YYYY-MM-DD HH:mm:ss')}${SEPARATOR}${dates[1].startOf('day').format('YYYY-MM-DD HH:mm:ss')}`,
              );
            } else {
              setTimeRangeValue(NO_TIME_RANGE);
            }
          }}
          allowClear={false}
          getPopupContainer={triggerNode =>
            (triggerNode.parentElement as HTMLElement) ?? document.body
          }
        />
      </InlineCalendarContainer>

      {/* Actual time range row right below calendar (matches Preset layout) */}
      <ActualTimeRangeBar>
        <ActualTimeRange title={evalResponse}>
          <span className="label">{t('Actual time range')}</span>
          <span>{evalResponse || t('No filter')}</span>
        </ActualTimeRange>
      </ActualTimeRangeBar>

      {/* Start / End text inputs with formula hints */}
      <div className="bottom-inputs-section">
        <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <div className="control-label">
            {t('Start (inclusive)')}{' '}
            <InfoTooltip
              tooltip={t('Start date included in time range')}
              placement="right"
            />
          </div>
          <InputWrapper>
            <input
              className="ant-input"
              value={since}
              onChange={e => {
                const val = e.target.value;
                setTimeRangeValue(`${val}${SEPARATOR}${until}`);
                if (val && dayjs(val).isValid()) {
                  const d = dayjs(val).startOf('month');
                  setDefaultPickerValue([d, d]);
                }
              }}
              placeholder={t('Select in calendar or type')}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                paddingRight: 30,
              }}
            />
            {since && (
              <span
                className="clear-icon"
                onClick={() => setTimeRangeValue(`${SEPARATOR}${until}`)}
              >
                <ClearIconSvg />
              </span>
            )}
          </InputWrapper>
          <div className="suggested-row">
            {t('Suggested:')}{' '}
            <button
              type="button"
              className="suggested-link"
              onClick={() =>
                setTimeRangeValue(`7 days ago${SEPARATOR}${until}`)
              }
            >
              {t('7 days ago')}
            </button>
            <span className="suggested-sep">{', '}</span>
            <button
              type="button"
              className="suggested-link"
              onClick={() =>
                setTimeRangeValue(`30 days ago${SEPARATOR}${until}`)
              }
            >
              {t('30 days ago')}
            </button>
          </div>
        </div>

        <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <div className="control-label">
            {t('End (exclusive)')}{' '}
            <InfoTooltip
              tooltip={t('End date excluded from time range')}
              placement="right"
            />
          </div>
          <InputWrapper>
            <input
              className="ant-input"
              value={until}
              onChange={e =>
                setTimeRangeValue(`${since}${SEPARATOR}${e.target.value}`)
              }
              placeholder={t('Select, type, or leave blank')}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                paddingRight: 30,
              }}
            />
            {until && (
              <span
                className="clear-icon"
                onClick={() => setTimeRangeValue(`${since}${SEPARATOR}`)}
              >
                <ClearIconSvg />
              </span>
            )}
          </InputWrapper>
          <div className="suggested-row">
            {t('Suggested:')}{' '}
            <button
              type="button"
              className="suggested-link"
              onClick={() => setTimeRangeValue(`${since}${SEPARATOR}now`)}
            >
              {t('now')}
            </button>
            <span className="suggested-sep">{', '}</span>
            <button
              type="button"
              className="suggested-link"
              onClick={() => setTimeRangeValue(`${since}${SEPARATOR}yesterday`)}
            >
              {t('yesterday')}
            </button>
          </div>
        </div>
      </div>
    </AntdThemeProvider>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'last':
        return <CommonFrame {...frameProps} />;
      case 'previous':
        return <CalendarFrame {...frameProps} />;
      case 'current':
        return <CurrentCalendarFrame {...frameProps} />;
      case 'custom':
        return <CustomFrame {...frameProps} />;
      default:
        return renderBasicTab();
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Popover overlay                                                   */
  /* ---------------------------------------------------------------- */
  const overlayContent = (
    <PopoverContent>
      <div className="tab-nav">
        {TAB_CONFIG.map(({ key, label }) => (
          <div
            key={key}
            className={`tab-nav-item${activeTab === key ? ' active' : ''}`}
            onClick={() => onTabChange(key)}
          >
            {t(label)}
          </div>
        ))}
      </div>

      <div
        className={`tab-body${activeTab !== 'basic' ? ' tab-body--padded' : ''}`}
      >
        {renderTabContent()}
      </div>

      {activeTab !== 'basic' && (
        <div
          style={{
            flexShrink: 0,
            padding: '9px 20px',
            borderTop: `1px solid ${theme.colorBorderSecondary}`,
          }}
        >
          <ActualTimeRange title={evalResponse}>
            <span className="label">{t('Actual time range')}</span>
            <span>{evalResponse || t('No filter')}</span>
          </ActualTimeRange>
        </div>
      )}

      <div className="popover-footer">
        <Button
          buttonStyle="secondary"
          key="cancel"
          onClick={onClose}
          styleConfig={{
            controlHeight: 32,
            paddingInline: 16,
            fontSize: 14,
            fontWeight: 600,
            borderRadius: 6,
          }}
          style={{ textTransform: 'none' }}
          data-test={DateFilterTestKey.CancelButton}
        >
          {t('Cancel')}
        </Button>
        <Button
          buttonStyle="primary"
          key="apply"
          onClick={onApply}
          disabled={!validTimeRange}
          styleConfig={{
            controlHeight: 32,
            paddingInline: 16,
            fontSize: 14,
            fontWeight: 600,
            borderRadius: 6,
          }}
          style={{ textTransform: 'none' }}
          data-test={DateFilterTestKey.ApplyButton}
        >
          {t('Apply')}
        </Button>
      </div>
    </PopoverContent>
  );

  /* ---------------------------------------------------------------- */
  /*  Render                                                            */
  /* ---------------------------------------------------------------- */
  return props.formData?.inView ? (
    <DateTimeFilterStyles width={width} height={height}>
      <ControlContainer
        ref={inputRef}
        validateStatus={filterState.validateStatus}
        onFocus={setFocusedFilter}
        onBlur={unsetFocusedFilter}
        onMouseEnter={setHoveredFilter}
        onMouseLeave={unsetHoveredFilter}
        tabIndex={-1}
      >
        <Popover
          trigger="click"
          placement={isVerticalFilterBar ? 'right' : 'bottomLeft'}
          autoAdjustOverflow={
            (isVerticalFilterBar || isOverflowingFilterBar
              ? {
                  adjustX: 1,
                  adjustY: 1,
                  shiftX: true,
                  shiftY: true,
                }
              : {
                  adjustX: true,
                  adjustY: false,
                }) as unknown as boolean
          }
          open={show}
          onOpenChange={openState => {
            if (openState) onOpen();
            else onClose();
          }}
          content={overlayContent}
          overlayStyle={{
            width: '580px',
            position:
              isVerticalFilterBar || isOverflowingFilterBar
                ? 'fixed'
                : undefined,
          }}
          destroyOnHidden
          getPopupContainer={triggerNode =>
            (!isVerticalFilterBar &&
              !isOverflowingFilterBar &&
              (triggerNode.closest(
                '[data-test="filter-bar"]',
              ) as HTMLElement)) ||
            document.body
          }
        >
          {/* Decorative RangePicker trigger — click captured by overlay div */}
          <div
            ref={triggerWrapperRef}
            style={{ position: 'relative', width: '100%' }}
          >
            <AntdThemeProvider locale={datePickerLocale ?? undefined}>
              <RangePicker
                value={triggerDates}
                format="YYYY-MM-DD"
                open={false}
                allowClear={false}
                style={{ width: '100%', pointerEvents: 'none' }}
                placeholder={[t('Start date'), t('End date')]}
                inputReadOnly
              />
            </AntdThemeProvider>
            {(triggerDates[0] || triggerDates[1]) && (
              <span
                className="trigger-clear-btn"
                title={t('Clear')}
                onClick={e => {
                  e.stopPropagation();
                  emitFilter(NO_TIME_RANGE);
                }}
              >
                <ClearIconSvg />
              </span>
            )}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                cursor: 'pointer',
                zIndex: 1,
              }}
            />
          </div>
        </Popover>
      </ControlContainer>
    </DateTimeFilterStyles>
  ) : null;
}
