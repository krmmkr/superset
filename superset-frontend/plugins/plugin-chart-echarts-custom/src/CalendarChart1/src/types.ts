/**
 * Licensed under the Apache License, Version 2.0
 * Superset Calendar Heatmap Plugin - Type Definitions
 */
import {
  ChartProps,
  DataRecord,
  QueryFormColumn,
  SetDataMaskHook,
  ChartDataResponseResult,
  FilterState,
  QueryFormData,
  ContextMenuFilters,
  HandlerFunction,
} from '@superset-ui/core';
import type { EChartsCoreOption } from 'echarts/core';
import {
  CalendarOrient,
  VisualMapType,
  VisualMapOrient,
  VisualMapPosition,
  DayLabelFormat,
  MonthLabelFormat,
} from './constants';

// Form data shape matching all control panel options
export interface CalendarHeatmapFormData extends QueryFormData {
  temporalColumn: string;
  metric: string;
  colorScheme: string;

  // Calendar layout
  calendarOrient: CalendarOrient;
  calendarTimeRange: string;
  layoutMode: string;
  cellSize: number;
  showMonthSeparator: boolean;
  monthSeparatorColor: string;
  monthSeparatorWidth: number;

  // Day labels
  showDayLabel: boolean;
  dayLabelFormat: DayLabelFormat;
  showMonthLabel: boolean;
  monthLabelFormat: MonthLabelFormat;
  showYearLabel: boolean;

  // VisualMap
  visualMapType: VisualMapType;
  visualMapOrient: VisualMapOrient;
  visualMapPosition: VisualMapPosition;
  showVisualMap: boolean;
  piecewiseNum: number;
  emptyCellColor: string;
  visualMapMin?: number;
  visualMapMax?: number;

  // Cell styling
  cellBorderColor: string;
  cellBorderWidth: number;
  cellBorderRadius: number;

  // Cell labels
  showCellLabel: boolean;
  showCellDate: boolean;

  // Tooltip
  dateFormat: string;
  numberFormat: string;

  // Crossfilter
  emitFilter: boolean;
  crossfilterMode: string;
}

// Chart props as received from Superset
export interface CalendarHeatmapChartProps extends ChartProps {
  formData: CalendarHeatmapFormData;
  queriesData: ChartDataResponseResult[];
}

// Refs for the echart instance
export type Refs = {
  echartRef?: React.Ref<any>;
  divRef?: React.RefObject<HTMLDivElement>;
};

// Data for an individual day tile in the React calendar grid
export interface CalendarDayData {
  dateStr: string; // 'YYYY-MM-DD'
  dayOfMonth: number;
  value: number | string | null;
  formattedValue: string;
  intensity: number; // 0 to 1
  color: string; // Background color for tile
  textColor: string;
  rawRecord?: DataRecord;
}

// Data for a month calendar block
export interface CalendarMonthData {
  year: number;
  month: number; // 0-11
  monthName: string; // 'Jun 2026'
  days: (CalendarDayData | null)[]; // 7-column array with null for leading/trailing empty cells
}

// Transformed props passed to the React component
export interface CalendarHeatmapTransformedProps {
  echartOptions: EChartsCoreOption;
  formData: CalendarHeatmapFormData;
  height: number;
  echartHeight: number;
  width: number;
  echartWidth: number;
  setDataMask: SetDataMaskHook;
  selectedValues: Record<number, string>;
  labelMap: Record<string, string[]>;
  groupby: QueryFormColumn[];
  emitCrossFilters: boolean;
  filterState?: FilterState;
  refs: Refs;
  temporalColumn: string;
  crossfilterMode?: string;
  onContextMenu?: (
    clientX: number,
    clientY: number,
    filters?: ContextMenuFilters,
  ) => void;
  coltypeMapping?: Record<string, number>;
  setControlValue?: HandlerFunction;

  // React Calendar fields
  months: CalendarMonthData[];
  metricLabel: string;
  cellSize: number;
  calendarOrient: string;
  layoutMode: string;
  showDayLabel: boolean;
  dayLabels: string[];
  showMonthLabel: boolean;
  showCellLabel: boolean;
  showCellDate: boolean;
  labelFontSize: number;
  dayLabelFontSize: number;
  showVisualMap: boolean;
  visualMapColors: string[];
  visualMapMin: number;
  visualMapMax: number;
  visualMapType: string;
  visualMapOrient: string;
  visualMapPosition: string;
  formattedMin: string;
  formattedMax: string;
}
