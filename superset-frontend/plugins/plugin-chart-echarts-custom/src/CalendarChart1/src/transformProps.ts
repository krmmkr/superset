/* eslint-disable theme-colors/no-literal-colors */
import {
  getMetricLabel,
  getNumberFormatter,
  getSequentialSchemeRegistry,
  getCategoricalSchemeRegistry,
  NumberFormats,
  DataRecord,
  tooltipHtml,
  CategoricalColorNamespace,
} from '@superset-ui/core';
import type { EChartsCoreOption } from 'echarts/core';
import {
  CalendarHeatmapChartProps,
  CalendarHeatmapTransformedProps,
  CalendarDayData,
  CalendarMonthData,
  Refs,
} from './types';
import {
  DEFAULT_FORM_DATA,
  CalendarOrient,
  VisualMapType,
  VisualMapPosition,
  DayLabelFormat,
  MonthLabelFormat,
} from './constants';

// Day-of-week labels for different formats
const DAY_LABELS: Record<string, string[]> = {
  [DayLabelFormat.Short]: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
  [DayLabelFormat.Medium]: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  [DayLabelFormat.Full]: [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ],
};

const MONTH_LABELS: Record<string, string[]> = {
  [MonthLabelFormat.Short]: [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ],
  [MonthLabelFormat.Full]: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
};

/**
 * Extract visual map position into ECharts left/top/right/bottom props
 */
function getVisualMapPositionProps(position: string) {
  switch (position) {
    case VisualMapPosition.TopLeft:
      return { left: 'left', top: 'top' };
    case VisualMapPosition.TopRight:
      return { right: 0, top: 'top' };
    case VisualMapPosition.BottomRight:
      return { right: 0, bottom: 0 };
    case VisualMapPosition.BottomLeft:
    default:
      return { left: 'left', bottom: 0 };
  }
}

/**
 * Parse any color string (hex or rgb) into [r, g, b]
 */
function parseToRgb(colorStr: string): [number, number, number] {
  if (!colorStr) return [59, 130, 246];
  if (colorStr.startsWith('#')) {
    let hex = colorStr.slice(1);
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map(c => c + c)
        .join('');
    }
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    return [r, g, b];
  }
  if (colorStr.startsWith('rgb')) {
    const parts = colorStr.match(/\d+/g);
    if (parts && parts.length >= 3) {
      return [Number(parts[0]), Number(parts[1]), Number(parts[2])];
    }
  }
  return [59, 130, 246];
}

/**
 * Interpolate smoothly between two colors
 */
function interpolateColor(
  color1: string,
  color2: string,
  factor: number,
): string {
  const [r1, g1, b1] = parseToRgb(color1);
  const [r2, g2, b2] = parseToRgb(color2);

  const r = Math.round(r1 + factor * (r2 - r1));
  const g = Math.round(g1 + factor * (g2 - g1));
  const b = Math.round(b1 + factor * (b2 - b1));

  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Compute the color for a given normalized intensity (0..1)
 */
function getColorForIntensity(
  intensity: number,
  colorStops: string[],
  isPiecewise: boolean,
): string {
  if (!colorStops || colorStops.length === 0) return '#3b82f6';
  if (colorStops.length === 1) return colorStops[0];

  const clamped = Math.max(0, Math.min(1, intensity));

  if (isPiecewise) {
    const idx = Math.min(
      colorStops.length - 1,
      Math.floor(clamped * colorStops.length),
    );
    return colorStops[idx];
  }

  // Continuous gradient interpolation across multi-stop colorStops
  const scaled = clamped * (colorStops.length - 1);
  const index = Math.floor(scaled);
  const nextIndex = Math.min(index + 1, colorStops.length - 1);
  const factor = scaled - index;

  return interpolateColor(colorStops[index], colorStops[nextIndex], factor);
}

/**
 * Calculate high-contrast text color based on tile background brightness
 */
function getContrastTextColor(bg: string): string {
  const [r, g, b] = parseToRgb(bg);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#0f172a' : '#ffffff';
}

/**
 * Resolve sequential or categorical color scheme into an array of hex colors
 */
function getSequentialColors(colorScheme?: string, steps = 7): string[] {
  let baseColors: string[] = [];

  if (colorScheme) {
    const seqRegistry = getSequentialSchemeRegistry();
    const seqScheme = seqRegistry.get(colorScheme);
    if (seqScheme?.colors && seqScheme.colors.length > 0) {
      baseColors = seqScheme.colors as string[];
    } else {
      try {
        const catRegistry = getCategoricalSchemeRegistry();
        const catScheme = catRegistry.get(colorScheme);
        if (catScheme?.colors && catScheme.colors.length > 0) {
          baseColors = catScheme.colors as string[];
        }
      } catch {
        // ignore
      }
    }
  }

  if (baseColors.length === 0) {
    const defaultSeq = getSequentialSchemeRegistry().get();
    if (defaultSeq?.colors && defaultSeq.colors.length > 0) {
      baseColors = defaultSeq.colors as string[];
    } else {
      baseColors = [
        '#1e3a8a',
        '#1d4ed8',
        '#2563eb',
        '#3b82f6',
        '#60a5fa',
        '#93c5fd',
      ];
    }
  }

  if (baseColors.length === 1 || steps <= 1) {
    return Array(Math.max(1, steps)).fill(baseColors[0]);
  }

  const result: string[] = [];
  for (let i = 0; i < steps; i += 1) {
    const factor = i / (steps - 1);
    result.push(getColorForIntensity(factor, baseColors, false));
  }
  return result;
}

/**
 * Parses a YYYY-MM-DD string tightly into a local Date object.
 * Prevents the ES5 UTC trap where `new Date("2026-03-01")` is treated as UTC midnight
 * and shifts to "Feb 28" in American timezones.
 */
function parseLocalDate(dateStr: string | Date | number): Date {
  if (typeof dateStr === 'string') {
    const parts = dateStr.split(' ')[0].split('-');
    if (parts.length >= 3) {
      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    }
  }
  return new Date(dateStr);
}

/**
 * Format a date to YYYY-MM-DD string securely in the local timezone
 */
function toDateString(date: Date | string | number): string {
  const d = parseLocalDate(date);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Safely parse Superset's strict time_range outputs (e.g. "Last 2 months", "DATEADD(DATETIME('now'), -2, MONTH)")
 * into a physical Date object synchronously for ECharts boundary logic.
 */
function evaluateRelativeDate(dateStr: string): Date | null {
  if (!dateStr || dateStr === '' || dateStr.toLowerCase() === 'no filter')
    return null;

  const lower = dateStr.trim().toLowerCase();
  const now = new Date();
  // Default to midnight for consistent boundary logic
  now.setHours(0, 0, 0, 0);

  if (lower === 'now' || lower === 'today') return new Date(now);

  // ISO 8601 or standard formatting (e.g. 2025-01-01)
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
    return parseLocalDate(dateStr);
  }

  // Match "Last X days/weeks/months/years" or "Next X days/weeks/months/years"
  const simpleMatch = lower.match(
    /^(last|previous|next)\s+(\d+)?\s*(day|week|month|year)s?/,
  );
  if (simpleMatch) {
    const direction = simpleMatch[1] === 'next' ? 1 : -1;
    const amount = parseInt(simpleMatch[2] || '1', 10);
    const unit = simpleMatch[3];
    const d = new Date(now);
    if (unit === 'day') d.setDate(d.getDate() + amount * direction);
    if (unit === 'week') d.setDate(d.getDate() + amount * 7 * direction);
    if (unit === 'month') d.setMonth(d.getMonth() + amount * direction);
    if (unit === 'year') d.setFullYear(d.getFullYear() + amount * direction);
    return d;
  }

  // Match Superset internal parsing output: DATEADD(DATETIME("now"), -2, MONTH)
  const dateAddMatch = dateStr.match(
    /DATEADD\(DATETIME\("([^"]+)"\),\s*(-?\d+),\s*([A-Za-z]+)\)/i,
  );
  if (dateAddMatch) {
    const anchorStr = dateAddMatch[1].toLowerCase();
    const anchor =
      anchorStr === 'now' || anchorStr === 'today'
        ? new Date(now)
        : parseLocalDate(dateAddMatch[1]);
    const amount = parseInt(dateAddMatch[2], 10);
    const unit = dateAddMatch[3].toLowerCase();

    if (unit === 'day') anchor.setDate(anchor.getDate() + amount);
    if (unit === 'week') anchor.setDate(anchor.getDate() + amount * 7);
    if (unit === 'month') anchor.setMonth(anchor.getMonth() + amount);
    if (unit === 'year') anchor.setFullYear(anchor.getFullYear() + amount);
    return anchor;
  }

  return null;
}

/**
 * Detect if a color is "dark" by hex or rgb value.
 */
function isColorDark(color: string): boolean {
  if (!color) return false;

  let r = 0,
    g = 0,
    b = 0;

  if (color.startsWith('#')) {
    const clean = color.replace('#', '');
    if (clean.length === 3) {
      r = parseInt(clean[0] + clean[0], 16);
      g = parseInt(clean[1] + clean[1], 16);
      b = parseInt(clean[2] + clean[2], 16);
    } else {
      r = parseInt(clean.substring(0, 2), 16) || 0;
      g = parseInt(clean.substring(2, 4), 16) || 0;
      b = parseInt(clean.substring(4, 6), 16) || 0;
    }
  } else if (color.startsWith('rgb')) {
    const parts = color.match(/\d+/g);
    if (parts && parts.length >= 3) {
      r = parseInt(parts[0], 10);
      g = parseInt(parts[1], 10);
      b = parseInt(parts[2], 10);
    }
  } else {
    return false; // Default to treating unknown colors as "light" (dark text)
  }

  // Perceived brightness formula
  return 0.299 * r + 0.587 * g + 0.114 * b > 127 ? false : true;
}

/**
 * Main transform function
 */
export default function transformProps(
  chartProps: CalendarHeatmapChartProps,
): CalendarHeatmapTransformedProps {
  const {
    formData,
    height,
    width,
    hooks,
    filterState,
    queriesData,
    emitCrossFilters,
  } = chartProps;

  // Access theme via Ant Design token properties
  const theme = (chartProps as any).theme || {};

  // ──────────────────────────────────────────────
  // Read all form data controls
  // ──────────────────────────────────────────────
  // ──────────────────────────────────────────────
  // Normalize FormData (handle snake_case vs camelCase, string bools)
  // ──────────────────────────────────────────────
  const fd = formData as any;

  const getBool = (val: any, def: boolean): boolean => {
    if (val === 'true') return true;
    if (val === 'false') return false;
    if (typeof val === 'boolean') return val;
    return def;
  };

  // Helper to try both keys
  const getVal = (keyCamel: string, keySnake: string, def: any) =>
    fd[keyCamel] ?? fd[keySnake] ?? def;

  const { sliceId } = fd;
  const granularitySqla = getVal(
    'granularitySqla',
    'granularity_sqla',
    undefined,
  );
  const metricsRaw: any[] = fd.metrics || [];
  const linearColorScheme = getVal(
    'linearColorScheme',
    'linear_color_scheme',
    undefined,
  );
  const colorSchemeAlt = getVal('colorScheme', 'color_scheme', undefined);
  const calendarOrient = getVal(
    'calendarOrient',
    'calendar_orient',
    DEFAULT_FORM_DATA.calendarOrient,
  );
  const cellSize = Number(
    getVal('cellSize', 'cell_size', DEFAULT_FORM_DATA.cellSize),
  );
  const isVertical = calendarOrient === CalendarOrient.Vertical;

  const showMonthSeparator = getBool(
    getVal(
      'showMonthSeparator',
      'show_month_separator',
      DEFAULT_FORM_DATA.showMonthSeparator,
    ),
    true,
  );
  // Inherit from controls, but explicitly cap at 5px because ECharts Calendar `splitLine` natively stretches the entire Global Grid to match its max stroke width!
  const monthSeparatorWidth = Math.max(
    1,
    Math.min(
      Number(getVal('monthSeparatorWidth', 'month_separator_width', 3)),
      5,
    ),
  );

  const showDayLabel = getBool(
    getVal('showDayLabel', 'show_day_label', DEFAULT_FORM_DATA.showDayLabel),
    true,
  );
  const dayLabelFormat = getVal(
    'dayLabelFormat',
    'day_label_format',
    DEFAULT_FORM_DATA.dayLabelFormat,
  );

  const showMonthLabel = getBool(
    getVal(
      'showMonthLabel',
      'show_month_label',
      DEFAULT_FORM_DATA.showMonthLabel,
    ),
    true,
  );
  const monthLabelFormat = getVal(
    'monthLabelFormat',
    'month_label_format',
    DEFAULT_FORM_DATA.monthLabelFormat,
  );

  // Force hide year label as requested by user ("remove option for year label")
  // We'll ignore the control value unless they explicitly enable it?
  // Actually, user said "remove option", so let's default it to false but allow override if controls exist.
  // Year label is hidden by default and control is removed
  const showYearLabel = false;

  const visualMapType = getVal(
    'visualMapType',
    'visual_map_type',
    DEFAULT_FORM_DATA.visualMapType,
  );
  const visualMapOrient = getVal(
    'visualMapOrient',
    'visual_map_orient',
    DEFAULT_FORM_DATA.visualMapOrient,
  );
  const visualMapPosition = getVal(
    'visualMapPosition',
    'visual_map_position',
    DEFAULT_FORM_DATA.visualMapPosition,
  );
  const showVisualMap = getBool(
    getVal('showVisualMap', 'show_visual_map', DEFAULT_FORM_DATA.showVisualMap),
    true,
  );
  const piecewiseNum = getVal(
    'piecewiseNum',
    'piecewise_num',
    DEFAULT_FORM_DATA.piecewiseNum,
  );
  const visualMapMinRaw = getVal('visualMapMin', 'visual_map_min', undefined);
  const visualMapMaxRaw = getVal('visualMapMax', 'visual_map_max', undefined);

  const cellBorderWidth = getVal(
    'cellBorderWidth',
    'cell_border_width',
    DEFAULT_FORM_DATA.cellBorderWidth,
  );
  const cellBorderRadius = getVal(
    'cellBorderRadius',
    'cell_border_radius',
    DEFAULT_FORM_DATA.cellBorderRadius,
  );
  const numberFormat = getVal(
    'numberFormat',
    'number_format',
    DEFAULT_FORM_DATA.numberFormat,
  );
  const emitFilter = getBool(
    getVal('emitFilter', 'emit_filter', DEFAULT_FORM_DATA.emitFilter),
    true,
  );
  const crossfilterMode = getVal(
    'crossfilterMode',
    'crossfilter_mode',
    'temporal',
  );

  const showCellLabel = getBool(
    getVal('showCellLabel', 'show_cell_label', DEFAULT_FORM_DATA.showCellLabel),
    false,
  );
  const showCellDate = getBool(
    getVal('showCellDate', 'show_cell_date', DEFAULT_FORM_DATA.showCellDate),
    false,
  );

  const labelFontSizeUser = getVal(
    'labelFontSize',
    'label_font_size',
    DEFAULT_FORM_DATA.labelFontSize,
  );
  const labelFontSize = Number(labelFontSizeUser) || 11;

  const dayLabelFontSizeUser = getVal(
    'dayLabelFontSize',
    'day_label_font_size',
    DEFAULT_FORM_DATA.dayLabelFontSize,
  );
  const dayLabelFontSize = Number(dayLabelFontSizeUser) || 9;

  // ──────────────────────────────────────────────
  // Theme-aware colors using Ant Design tokens
  // ──────────────────────────────────────────────
  const bgContainer: string = theme.colorBgContainer || '#ffffff';
  const darkMode = isColorDark(bgContainer);

  // Fallback to light text in dark mode if theme doesn't provide it
  const textColor: string =
    theme.colorText || (darkMode ? '#E0E0E0' : '#333333');
  const secondaryTextColor: string = theme.colorTextSecondary || '#666666';
  // Removed duplicate bgContainer and darkMode declarations

  const emptyCellColor = darkMode ? '#2a2a2a' : '#efefef';
  const cellBorderColor = darkMode ? '#1a1a1a' : '#ffffff';
  const tooltipBg = darkMode ? 'rgba(30,30,30,0.96)' : 'rgba(255,255,255,0.96)';
  const tooltipTextColor = darkMode ? '#e0e0e0' : '#333333';
  const tooltipBorderColor = darkMode ? '#555' : '#e0e0e0';

  const colorScheme = linearColorScheme || colorSchemeAlt || 'greens';

  const { setDataMask = () => {}, setControlValue } = hooks;
  const queryData = queriesData[0] || {};
  const data: DataRecord[] = queryData.data || [];
  const colnames: string[] = (queryData as any).colnames || [];

  // ──────────────────────────────────────────────
  // Resolve column and metric labels
  // ──────────────────────────────────────────────
  const temporalColumnRawStr =
    typeof granularitySqla === 'object'
      ? (granularitySqla as any)?.label ||
        (granularitySqla as any)?.column_name ||
        String(granularitySqla)
      : String(granularitySqla || '');

  const metricLabel = metricsRaw.length ? getMetricLabel(metricsRaw[0]) : '';

  const temporalColumn =
    colnames.find(c => c === temporalColumnRawStr) ||
    colnames.find(
      c => c.toLowerCase() === temporalColumnRawStr.toLowerCase(),
    ) ||
    colnames[0] ||
    temporalColumnRawStr;

  const metricColName =
    colnames.find(c => c === metricLabel) ||
    colnames.find(c => c.toLowerCase() === metricLabel.toLowerCase()) ||
    (colnames.length > 1 ? colnames[1] : metricLabel);

  // ──────────────────────────────────────────────
  // Transform data: [dateStr, value, row] tuples
  // ──────────────────────────────────────────────
  const calendarData: [string, number | string, DataRecord][] = [];
  let minValue = Infinity;
  let maxValue = -Infinity;
  let minDateStr = '';
  let maxDateStr = '';

  const labelMap: Record<string, string[]> = {};
  const numberFormatter = getNumberFormatter(
    numberFormat || NumberFormats.SMART_NUMBER,
  );

  data.forEach((row: DataRecord) => {
    const dateRaw = row[temporalColumn];
    const value = row[metricColName];

    if (dateRaw == null || value == null) return;

    let dateStr: string;
    if (typeof dateRaw === 'number') {
      const ts = dateRaw > 1e12 ? dateRaw : dateRaw * 1000;
      dateStr = toDateString(new Date(ts));
    } else {
      dateStr = toDateString(dateRaw as string | Date);
    }

    if (!dateStr) return;

    const numValue = Number(value);
    let displayVal: number | string;
    if (isNaN(numValue)) {
      displayVal = String(value);
    } else {
      displayVal = numValue;
      minValue = Math.min(minValue, numValue);
      maxValue = Math.max(maxValue, numValue);
    }

    calendarData.push([dateStr, displayVal, row]);

    labelMap[dateStr] = [String(dateRaw)];

    if (!minDateStr || dateStr < minDateStr) minDateStr = dateStr;
    if (!maxDateStr || dateStr > maxDateStr) maxDateStr = dateStr;
  });

  if (minValue === Infinity) minValue = 0;
  if (maxValue === -Infinity) maxValue = 1;

  const calendarTimeRange = getVal(
    'calendarTimeRange',
    'calendar_time_range',
    undefined,
  );

  // Helper to completely override data-driven boundaries if custom range specifies bounds
  const applyCustomTimeRangeOverrides = () => {
    if (!calendarTimeRange || typeof calendarTimeRange !== 'string') return;

    // Superset's DateFilterControl joins start and end bounds by ' : '
    const parts = calendarTimeRange.split(' : ');
    if (parts.length > 0) {
      const startStr = parts[0].trim();
      const endStr = parts.length > 1 ? parts[1].trim() : '';

      const explicitStart = evaluateRelativeDate(startStr);
      const explicitEnd = evaluateRelativeDate(endStr);

      if (explicitStart) {
        // Snap purely visual boundary exactly to the 1st day of the given month so blocks align
        explicitStart.setDate(1);
        minDateStr = toDateString(explicitStart);
      }
      if (explicitEnd) {
        // Snap visual boundary to the last day of its month
        explicitEnd.setMonth(explicitEnd.getMonth() + 1);
        explicitEnd.setDate(0);
        maxDateStr = toDateString(explicitEnd);
      }
    }
  };

  if (calendarData.length === 0) {
    minValue = 0;
    maxValue = 1;
    // Default to current year if no data
    const now = new Date();
    maxDateStr = `${now.getFullYear()}-12-31`;
    minDateStr = `${now.getFullYear()}-01-01`;

    applyCustomTimeRangeOverrides();
  } else {
    // Snap the absolute highest date to the end of its containing month
    const maxD = parseLocalDate(maxDateStr);
    maxD.setMonth(maxD.getMonth() + 1);
    maxD.setDate(0);
    maxDateStr = toDateString(maxD);

    // Snap the lowest actual data point to the 1st of its month
    const minD = parseLocalDate(minDateStr);
    minD.setDate(1);
    minDateStr = toDateString(minD);

    applyCustomTimeRangeOverrides();
  }

  const resolvedMin =
    visualMapMinRaw !== '' && visualMapMinRaw != null
      ? Number(visualMapMinRaw)
      : minValue;
  let resolvedMax =
    visualMapMaxRaw !== '' && visualMapMaxRaw != null
      ? Number(visualMapMaxRaw)
      : maxValue;

  if (resolvedMax <= resolvedMin) {
    resolvedMax = resolvedMin + 1;
  }

  // ──────────────────────────────────────────────
  // Build month labels (Dynamic Month+Year if possible)
  // ──────────────────────────────────────────────
  let monthNameMap =
    MONTH_LABELS[monthLabelFormat] || MONTH_LABELS[MonthLabelFormat.Short];

  // If the data spans <= 12 months, we can be smart and append the Year to the month label
  // e.g. "Dec" -> "Dec 2022", "Jan" -> "Jan 2023"
  // This works because ECharts maps month index (0-11) to the name.
  // If we have distinct months (no index repeats), we can map specific indices to specific strings.
  // If span > 12 months, indices repeat (e.g. Jan 2022 and Jan 2023 both map to index 0), so we definitely can't do this.

  const startDate = parseLocalDate(minDateStr);
  const endDate = parseLocalDate(maxDateStr);
  const monthSpan =
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth()) +
    1;

  if (monthSpan <= 12 && monthSpan > 0) {
    // Clone the base map to avoid mutating global constant
    const customMap = [...monthNameMap];

    // Iterate through each month in the range
    const curr = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    // Safety break
    let loops = 0;
    while (curr <= end && loops < 20) {
      const mIndex = curr.getMonth();
      const yyyy = curr.getFullYear();
      // Append year. e.g. "Dec" -> "Dec 2022"
      // Use Short format always for this? Or respect format?
      // "Dec 2022" is nicer than "December 2022" usually.
      const baseName = MONTH_LABELS[MonthLabelFormat.Short][mIndex];
      customMap[mIndex] = `${baseName} ${yyyy}`;

      curr.setMonth(curr.getMonth() + 1);
      loops++;
    }
    monthNameMap = customMap;
  }

  const layoutMode = getVal('layoutMode', 'layout_mode', 'scrollable');

  // For larger cellSizes, we calculate explicit scrolling height.
  // However, if we are in 'fit' mode, Echarts flexes to the container height, so we don't need padding offsets.
  let calendarHeight = height;
  let explicitCellSize: any = [cellSize, cellSize];

  if (layoutMode === 'scrollable') {
    calendarHeight = isVertical
      ? cellSize * Math.ceil(monthSpan * 4.5) + 100
      : cellSize * 8 + 60;
  } else {
    explicitCellSize = ['auto', 'auto'];
    // Reduce the top margin significantly in fit mode so it doesn't push the chart out of bounds
  }

  // Single calendar with a date range instead of multiple year-based calendars
  const calendar = {
    range: [minDateStr, maxDateStr],
    orient: calendarOrient,
    cellSize: explicitCellSize,
    top: layoutMode === 'fit' ? 30 : 60,
    left: 80,
    right: 30,
    bottom: 50,
    yearLabel: {
      show: showYearLabel,
      fontSize: 24,
      fontWeight: 'bold' as const,
      color: textColor,
      position: 'top',
      margin: 10,
    },
    monthLabel: {
      show: showMonthLabel,
      nameMap: monthNameMap,
      fontSize: 12,
      color: textColor,
      fontWeight: 'bold' as const,
    },
    // ... existing ...
    dayLabel: {
      show: showDayLabel,
      nameMap: DAY_LABELS[dayLabelFormat] || DAY_LABELS[DayLabelFormat.Short],
      firstDay: 0,
      fontSize: 10,
      color: secondaryTextColor,
    },
    splitLine: {
      show: showMonthSeparator,
      lineStyle: {
        color: bgContainer, // Match the exact dashboard background to simulate a physical void/gap
        width: monthSeparatorWidth,
        type: 'solid' as const,
      },
    },
    itemStyle: {
      color: emptyCellColor,
      borderColor: cellBorderColor,
      borderWidth: cellBorderWidth,
    },
  };

  // ──────────────────────────────────────────────
  // Resolve Categories and Colors
  // ──────────────────────────────────────────────
  let isCategorical = false;
  const uniqueValues = new Set<string>();
  calendarData.forEach(item => {
    const val = item[1];
    if (val !== undefined && val !== null) {
      uniqueValues.add(String(val));
      if (typeof val === 'string') {
        isCategorical = true;
      }
    }
  });

  const categories = Array.from(uniqueValues).sort();
  const colorFn = CategoricalColorNamespace.getScale(colorScheme);
  const categoryColors = categories.map(cat => colorFn(cat, sliceId));

  const colorSteps =
    visualMapType === VisualMapType.Piecewise ? piecewiseNum : 7;
  const colors = getSequentialColors(colorScheme, colorSteps);

  // ──────────────────────────────────────────────
  // Build series with optional cell labels
  // ──────────────────────────────────────────────
  const showLabel = !!(showCellLabel || showCellDate);

  const series = {
    type: 'heatmap' as const,
    coordinateSystem: 'calendar' as const,
    calendarIndex: 0,
    data: calendarData,
    label: {
      show: showLabel,
      formatter: (params: any) => {
        if (!params?.data || !Array.isArray(params.data)) return '';
        const dateStr = params.data[0] as string;
        const value = params.data[1];

        // ECharts doesn't always pass the computed `color` to the calendar formatter.
        // To guarantee high contrast text, we must manually deduce the background color
        // by finding its position on our gradient scale.
        let cellColor = params.color;
        if (!cellColor && colors.length > 0) {
          if (typeof value === 'number' && resolvedMax > resolvedMin) {
            const ratio = Math.max(
              0,
              Math.min(1, (value - resolvedMin) / (resolvedMax - resolvedMin)),
            );
            const colorIndex = Math.min(
              colors.length - 1,
              Math.floor(ratio * colors.length),
            );
            cellColor = colors[colorIndex];
          } else if (typeof value === 'string') {
            const catIdx = categories.indexOf(value);
            if (catIdx !== -1 && categoryColors.length > 0) {
              cellColor = categoryColors[catIdx];
            }
          }
        }

        // Default empty cells to the emptyCellColor
        const actualColor = cellColor || emptyCellColor;
        const isDark = isColorDark(actualColor);
        const suffix = isDark ? '_light' : '_dark';

        const parts: string[] = [];
        // Date ALWAYS first if exists
        if (showCellDate && dateStr) {
          const dateParts = dateStr.split('-');
          if (dateParts.length === 3) {
            // Day number
            parts.push(`{date${suffix}|${parseInt(dateParts[2], 10)}}`);
          }
        }

        if (showCellLabel) {
          // Force new line for metric
          parts.push('\n');
          const formatted =
            typeof value === 'number'
              ? numberFormatter
                ? numberFormatter(value)
                : String(value)
              : String(value);
          parts.push(`{metric${suffix}|${formatted}}`);
        }

        return parts.join('');
      },
      rich: {
        // LIGHT TEXT (Dark Background)
        date_light: {
          fontSize: dayLabelFontSize,
          color: '#ffffff',
          align: 'center',
        },
        metric_light: {
          fontSize: labelFontSize,
          color: '#ffffff',
          fontWeight: 600,
          align: 'center',
        },

        // DARK TEXT (Light Background)
        date_dark: {
          fontSize: dayLabelFontSize,
          color: '#000000',
          align: 'center',
        },
        metric_dark: {
          fontSize: labelFontSize,
          color: '#2c3e50',
          fontWeight: 600,
          align: 'center',
        },
      },
      position: 'inside',
      distance: 0,
    },
    emphasis: {
      itemStyle: {
        shadowBlur: 10,
        shadowColor: 'rgba(0, 0, 0, 0.3)',
        borderColor: textColor,
        borderWidth: 2,
      },
    },
    itemStyle: {
      borderColor: cellBorderColor,
      borderWidth: cellBorderWidth,
      borderRadius: cellBorderRadius,
    },
    progressive: 0,
  };

  // ──────────────────────────────────────────────
  // Build Visual Map
  // ──────────────────────────────────────────────
  const vmPositionProps = getVisualMapPositionProps(visualMapPosition);
  let visualMap: any;

  if (isCategorical) {
    visualMap = {
      type: 'piecewise' as const,
      categories,
      inRange: { color: categoryColors },
      show: showVisualMap,
      orient: visualMapOrient,
      textStyle: { color: textColor },
      dimension: 1,
      ...vmPositionProps,
    };
  } else {
    const visualMapBase = {
      min: resolvedMin,
      max: resolvedMax,
      calculable: true,
      orient: visualMapOrient,
      show: showVisualMap,
      inRange: { color: colors },
      textStyle: { color: textColor },
      dimension: 1,
      ...vmPositionProps,
    };

    visualMap =
      visualMapType === VisualMapType.Piecewise
        ? {
            ...visualMapBase,
            type: 'piecewise' as const,
            splitNumber: piecewiseNum,
          }
        : { ...visualMapBase, type: 'continuous' as const, realtime: false };
  }

  // ──────────────────────────────────────────────
  // Build tooltip
  // ──────────────────────────────────────────────
  const tooltip = {
    trigger: 'item' as const,
    formatter: (params: any) => {
      if (!params?.data || !Array.isArray(params.data)) return '';
      const [dateStr, value, row] = params.data;

      const rows: [string, string][] = [];
      // Add temporal column
      rows.push([temporalColumn, dateStr]);
      // Add main metric
      const displayVal =
        typeof value === 'number'
          ? numberFormatter
            ? numberFormatter(value)
            : String(value)
          : String(value);
      rows.push([metricLabel, displayVal]);

      // Add all other keys from original row (except temporalColumn and metricColName)
      if (row) {
        Object.keys(row).forEach(key => {
          if (key !== temporalColumn && key !== metricColName) {
            rows.push([key, String(row[key])]);
          }
        });
      }
      return tooltipHtml(rows, dateStr);
    },
    confine: false,
    appendToBody: true,
    backgroundColor: tooltipBg,
    borderColor: tooltipBorderColor,
    borderWidth: 1,
    padding: [10, 14],
    textStyle: { fontSize: 13, color: tooltipTextColor },
    extraCssText:
      'box-shadow: 0 4px 14px rgba(0,0,0,0.12); border-radius: 8px;',
  };

  // ──────────────────────────────────────────────
  // Calculate sizing — adapt to data range
  // ──────────────────────────────────────────────
  let requiredHeight = height;
  let requiredWidth = width;

  if (layoutMode === 'scrollable') {
    requiredHeight = Math.max(height, calendarHeight + 130);
    // Calendar width needs approximately 53 weeks * cellSize + left/right margins
    const calendarComputedWidth = isVertical
      ? cellSize * 8 + 120
      : cellSize * 55 + 120;
    requiredWidth = Math.max(width, calendarComputedWidth);
  }

  // ──────────────────────────────────────────────
  // Build React Calendar Heatmap month/day matrix
  // ──────────────────────────────────────────────
  const startMonthDate = parseLocalDate(minDateStr);
  const endMonthDate = parseLocalDate(maxDateStr);

  const startYear = startMonthDate.getFullYear();
  const startMonthIdx = startMonthDate.getMonth();
  const endYear = endMonthDate.getFullYear();
  const endMonthIdx = endMonthDate.getMonth();

  const dataMap = new Map<
    string,
    { value: number | string; row: DataRecord }
  >();
  calendarData.forEach(([dStr, val, r]) => {
    dataMap.set(dStr, { value: val, row: r });
  });

  const months: CalendarMonthData[] = [];
  let curYear = startYear;
  let curMonthIdx = startMonthIdx;

  while (
    curYear < endYear ||
    (curYear === endYear && curMonthIdx <= endMonthIdx)
  ) {
    const monthDate = new Date(curYear, curMonthIdx, 1);
    const baseMonth =
      monthLabelFormat === MonthLabelFormat.Full
        ? MONTH_LABELS[MonthLabelFormat.Full][curMonthIdx]
        : MONTH_LABELS[MonthLabelFormat.Short][curMonthIdx];
    const monthName = `${baseMonth} ${curYear}`;

    const firstDayOfWeek = monthDate.getDay(); // 0 = Sunday, 1 = Monday, ... 6 = Saturday
    const totalDays = new Date(curYear, curMonthIdx + 1, 0).getDate();

    const days: (CalendarDayData | null)[] = [];
    // Add empty slots before day 1
    for (let i = 0; i < firstDayOfWeek; i += 1) {
      days.push(null);
    }

    for (let day = 1; day <= totalDays; day += 1) {
      const mStr = String(curMonthIdx + 1).padStart(2, '0');
      const dStr = String(day).padStart(2, '0');
      const dateStr = `${curYear}-${mStr}-${dStr}`;

      const entry = dataMap.get(dateStr);
      const val = entry !== undefined ? entry.value : null;
      const raw = entry?.row;

      let numVal: number | null = null;
      let formattedValue = '';
      let intensity = 0;

      if (val !== null && val !== undefined) {
        numVal = Number(val);
        if (!isNaN(numVal)) {
          formattedValue = numberFormatter(numVal);
          if (resolvedMax > resolvedMin) {
            intensity = Math.max(
              0,
              Math.min(1, (numVal - resolvedMin) / (resolvedMax - resolvedMin)),
            );
          } else {
            intensity = 0.5;
          }
        } else {
          formattedValue = String(val);
          intensity = 0.5;
        }
      }

      // Dynamic color scheme resolution (Continuous gradient or Piecewise steps)
      let color = darkMode ? '#1a1d26' : '#f1f5f9'; // Dark slate placeholder for empty
      let textColor = darkMode ? '#64748b' : '#94a3b8';

      if (val !== null && val !== undefined) {
        if (isCategorical) {
          color = colorFn(String(val), sliceId);
        } else {
          color = getColorForIntensity(
            intensity,
            colors,
            visualMapType === VisualMapType.Piecewise,
          );
        }
        textColor = getContrastTextColor(color);
      }

      days.push({
        dateStr,
        dayOfMonth: day,
        value: val,
        formattedValue,
        intensity,
        color,
        textColor,
        rawRecord: raw,
      });
    }

    months.push({
      year: curYear,
      month: curMonthIdx,
      monthName,
      days,
    });

    curMonthIdx += 1;
    if (curMonthIdx > 11) {
      curMonthIdx = 0;
      curYear += 1;
    }
  }

  // ──────────────────────────────────────────────
  // Assemble ECharts options
  // ──────────────────────────────────────────────
  const echartOptions: EChartsCoreOption = {
    tooltip,
    visualMap,
    calendar,
    series: [series],
  };

  // ──────────────────────────────────────────────
  // Build crossfilter props
  // ──────────────────────────────────────────────
  const refs: Refs = {};
  const selectedValues = filterState?.selectedValues
    ? (filterState.selectedValues as Record<number, string>)
    : {};

  return {
    echartOptions,
    formData: fd,
    height, // Lock outer component to strict Dashboard bounds
    echartHeight: requiredHeight, // Allow inner Echart to independently expand
    width,
    echartWidth: requiredWidth,
    setDataMask,
    selectedValues,
    labelMap,
    groupby: temporalColumn ? [temporalColumn as any] : [],
    emitCrossFilters: emitFilter && (emitCrossFilters ?? false),
    filterState,
    refs,
    temporalColumn,
    crossfilterMode,
    onContextMenu: hooks.onContextMenu,
    coltypeMapping: queriesData[0]?.coltypes
      ? Object.fromEntries(
          (queriesData[0].colnames || []).map((col: string, idx: number) => [
            col,
            queriesData[0].coltypes![idx],
          ]),
        )
      : undefined,
    setControlValue,
    // React Calendar Heatmap props
    months,
    metricLabel,
    cellSize,
    calendarOrient,
    layoutMode: getVal('layoutMode', 'layout_mode', 'scrollable'),
    showDayLabel,
    dayLabels: DAY_LABELS[dayLabelFormat] || DAY_LABELS[DayLabelFormat.Short],
    showMonthLabel,
    showCellLabel: getBool(
      getVal(
        'showCellLabel',
        'show_cell_label',
        DEFAULT_FORM_DATA.showCellLabel,
      ),
      true,
    ),
    showCellDate: getBool(
      getVal('showCellDate', 'show_cell_date', DEFAULT_FORM_DATA.showCellDate),
      true,
    ),
    labelFontSize: Number(
      getVal(
        'labelFontSize',
        'label_font_size',
        DEFAULT_FORM_DATA.labelFontSize,
      ),
    ),
    dayLabelFontSize: Number(
      getVal(
        'dayLabelFontSize',
        'day_label_font_size',
        DEFAULT_FORM_DATA.dayLabelFontSize,
      ),
    ),
    showVisualMap: getBool(
      getVal(
        'showVisualMap',
        'show_visual_map',
        DEFAULT_FORM_DATA.showVisualMap,
      ),
      false,
    ),
    visualMapColors: colors,
    visualMapMin: resolvedMin,
    visualMapMax: resolvedMax,
    visualMapType,
    visualMapOrient,
    visualMapPosition,
    formattedMin: numberFormatter(resolvedMin),
    formattedMax: numberFormatter(resolvedMax),
  };
}
