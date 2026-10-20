/* eslint-disable theme-colors/no-literal-colors */
/**
 * Licensed under the Apache License, Version 2.0
 * Superset Calendar Heatmap Plugin - Constants
 */

// Calendar orientation
export enum CalendarOrient {
  Horizontal = 'horizontal',
  Vertical = 'vertical',
}

// VisualMap type
export enum VisualMapType {
  Continuous = 'continuous',
  Piecewise = 'piecewise',
}

// VisualMap orientation
export enum VisualMapOrient {
  Horizontal = 'horizontal',
  Vertical = 'vertical',
}

// VisualMap position
export enum VisualMapPosition {
  TopLeft = 'top-left',
  TopRight = 'top-right',
  BottomLeft = 'bottom-left',
  BottomRight = 'bottom-right',
}

// Day label format
export enum DayLabelFormat {
  Short = 'short', // M, T, W, ...
  Medium = 'medium', // Mon, Tue, Wed, ...
  Full = 'full', // Monday, Tuesday, ...
}

// Month label format
export enum MonthLabelFormat {
  Short = 'short', // Jan, Feb, ...
  Full = 'full', // January, February, ...
}

export const DEFAULT_FORM_DATA = {
  // Calendar layout
  calendarOrient: CalendarOrient.Horizontal,
  cellSize: 34,
  showMonthSeparator: true,
  monthSeparatorColor: '#000000',
  monthSeparatorWidth: 2,

  // Day labels
  showDayLabel: true,
  dayLabelFormat: DayLabelFormat.Short,
  showMonthLabel: true,
  monthLabelFormat: MonthLabelFormat.Short,

  // VisualMap
  visualMapType: VisualMapType.Continuous,
  visualMapOrient: VisualMapOrient.Horizontal,
  visualMapPosition: VisualMapPosition.BottomLeft,
  showVisualMap: false,
  piecewiseNum: 5,
  emptyCellColor: '#efefef',

  // Cell styling
  cellBorderColor: '#ffffff',
  cellBorderWidth: 1,
  cellBorderRadius: 1,

  // Cell labels
  showCellLabel: true,
  showCellDate: true,
  labelFontSize: 10,
  dayLabelFontSize: 11,

  // Tooltip
  dateFormat: '%Y-%m-%d',
  numberFormat: 'SMART_NUMBER',

  // Crossfilter
  emitFilter: true,
};
