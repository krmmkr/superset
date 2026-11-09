/* eslint-disable theme-colors/no-literal-colors, import/no-extraneous-dependencies */
/**
 * Licensed under the Apache License, Version 2.0
 * Superset Calendar Heatmap Plugin - Modern React Calendar Component
 *
 * Renders sleek 7-column calendar month grids with customizable dual-line day+metric tiles,
 * dynamic color scheme gradients, layout orientations, and interactive date cross-filtering.
 */
import { useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { DataMask } from '@superset-ui/core';
import { CalendarHeatmapTransformedProps, CalendarDayData } from './types';
import {
  CalendarOrient,
  VisualMapType,
  VisualMapOrient,
  VisualMapPosition,
} from './constants';

export default function EchartsCalendar(
  props: CalendarHeatmapTransformedProps,
) {
  const {
    months = [],
    width,
    height,
    setDataMask,
    selectedValues,
    emitCrossFilters,
    temporalColumn,
    crossfilterMode,
    metricLabel,
    refs,
    cellSize = 34,
    calendarOrient = CalendarOrient.Horizontal,
    layoutMode = 'scrollable',
    showDayLabel = true,
    dayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
    showMonthLabel = true,
    showCellLabel = true,
    showCellDate = true,
    labelFontSize = 10,
    dayLabelFontSize = 11,
    showVisualMap = false,
    visualMapColors = [],
    visualMapType = VisualMapType.Continuous,
    visualMapOrient = VisualMapOrient.Horizontal,
    visualMapPosition = VisualMapPosition.BottomLeft,
    formattedMin = '0',
    formattedMax = '100',
    textColor = '#f3f4f6',
    secondaryTextColor = '#9ca3af',
    borderColor = 'rgba(255, 255, 255, 0.08)',
    emptyCellColor = 'rgba(128, 128, 128, 0.08)',
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  if (refs) {
    refs.divRef = containerRef as any;
  }

  const [hoveredDay, setHoveredDay] = useState<CalendarDayData | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(
    null,
  );

  const selectedDates = Object.values(selectedValues || {});

  // ──────────────────────────────────────────────
  // Cross-filter click handler
  // ──────────────────────────────────────────────
  const handleDayClick = useCallback(
    (day: CalendarDayData) => {
      if (!emitCrossFilters || !setDataMask) return;

      const { dateStr } = day;
      const isSelected = selectedDates.includes(dateStr);

      if (isSelected) {
        // Clear filter
        const dataMask: DataMask = {
          extraFormData: { time_range: undefined, filters: [] } as any,
          filterState: { value: null, selectedValues: null },
        };
        setDataMask(dataMask);
      } else {
        // Apply filter
        const isCategorical = crossfilterMode === 'string';
        const extraFormData: any = {};

        if (isCategorical) {
          extraFormData.time_range = undefined;
          extraFormData.filters = [
            {
              col: temporalColumn,
              op: '==' as const,
              val: dateStr,
            },
          ];
        } else {
          extraFormData.time_range = `${dateStr} : ${dateStr}T23:59:59`;
          extraFormData.filters = [
            {
              col: temporalColumn,
              op: '==' as const,
              val: dateStr,
            },
          ];
        }

        const dataMask: DataMask = {
          extraFormData,
          filterState: {
            value: [dateStr],
            selectedValues: [dateStr],
          },
        };
        setDataMask(dataMask);
      }
    },
    [
      emitCrossFilters,
      setDataMask,
      selectedDates,
      crossfilterMode,
      temporalColumn,
    ],
  );

  const isVertical = calendarOrient === CalendarOrient.Vertical;
  const tileHeight =
    showCellLabel && showCellDate ? Math.round(cellSize * 1.22) : cellSize;

  // Visual Map Legend Component
  const renderVisualMapLegend = () => {
    if (!showVisualMap || !visualMapColors || visualMapColors.length === 0) {
      return null;
    }

    const isLegendVertical = visualMapOrient === VisualMapOrient.Vertical;
    const isPiecewise = visualMapType === VisualMapType.Piecewise;

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: isLegendVertical ? 'column' : 'row',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          fontSize: '11px',
          color: '#9ca3af',
          width: 'fit-content',
        }}
      >
        <span>{formattedMin}</span>
        {isPiecewise ? (
          <div
            style={{
              display: 'flex',
              flexDirection: isLegendVertical ? 'column-reverse' : 'row',
              gap: '2px',
            }}
          >
            {visualMapColors.map((c, i) => (
              <div
                key={`${c}-${i}`}
                style={{
                  width: isLegendVertical ? '14px' : '18px',
                  height: isLegendVertical ? '14px' : '10px',
                  backgroundColor: c,
                  borderRadius: '2px',
                }}
              />
            ))}
          </div>
        ) : (
          <div
            style={{
              width: isLegendVertical ? '10px' : '120px',
              height: isLegendVertical ? '100px' : '10px',
              borderRadius: '4px',
              background: isLegendVertical
                ? `linear-gradient(to top, ${visualMapColors.join(', ')})`
                : `linear-gradient(to right, ${visualMapColors.join(', ')})`,
            }}
          />
        )}
        <span>{formattedMax}</span>
      </div>
    );
  };

  const isLegendTop =
    visualMapPosition === VisualMapPosition.TopLeft ||
    visualMapPosition === VisualMapPosition.TopRight;
  const isLegendRight =
    visualMapPosition === VisualMapPosition.TopRight ||
    visualMapPosition === VisualMapPosition.BottomRight;

  return (
    <div
      ref={containerRef}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        overflow: 'auto',
        backgroundColor: 'transparent',
        padding: '16px 20px',
        boxSizing: 'border-box',
        fontFamily:
          "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        color: textColor,
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      {/* Top Legend if selected */}
      {showVisualMap && isLegendTop && (
        <div
          style={{
            display: 'flex',
            justifyContent: isLegendRight ? 'flex-end' : 'flex-start',
            marginBottom: '4px',
          }}
        >
          {renderVisualMapLegend()}
        </div>
      )}

      {/* Month Grids Container */}
      <div
        style={{
          display: 'flex',
          flexDirection: isVertical ? 'column' : 'row',
          flexWrap: layoutMode === 'fit' ? 'nowrap' : 'wrap',
          gap: `${Math.max(16, Math.round(cellSize * 0.7))}px`,
          justifyContent: 'flex-start',
          alignItems: isVertical ? 'center' : 'flex-start',
        }}
      >
        {months.map(m => (
          <div
            key={`${m.year}-${m.month}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              minWidth: `${7 * cellSize + 28}px`,
            }}
          >
            {/* Month & Year Title */}
            {showMonthLabel && (
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: textColor,
                  textAlign: 'center',
                  marginBottom: '8px',
                  letterSpacing: '-0.01em',
                }}
              >
                {m.monthName}
              </div>
            )}

            {/* Weekday Row */}
            {showDayLabel && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(7, ${cellSize}px)`,
                  gap: '4px',
                  marginBottom: '6px',
                  justifyContent: 'center',
                }}
              >
                {dayLabels.map((w, i) => (
                  <div
                    key={`${w}-${i}`}
                    style={{
                      fontSize: `${Math.max(9, Math.round(cellSize * 0.32))}px`,
                      fontWeight: 500,
                      color: secondaryTextColor,
                      textAlign: 'center',
                    }}
                  >
                    {w}
                  </div>
                ))}
              </div>
            )}

            {/* 7-Column Day Matrix */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(7, ${cellSize}px)`,
                gap: '4px',
                justifyContent: 'center',
              }}
            >
              {m.days.map((day, dIdx) => {
                if (!day) {
                  return (
                    <div
                      key={`empty-${dIdx}`}
                      style={{
                        width: `${cellSize}px`,
                        height: `${tileHeight}px`,
                        visibility: 'hidden',
                      }}
                    />
                  );
                }

                const isSelected = selectedDates.includes(day.dateStr);

                return (
                  <div
                    key={day.dateStr}
                    onClick={() => handleDayClick(day)}
                    onMouseEnter={e => {
                      setHoveredDay(day);
                      setTooltipPos({ x: e.clientX, y: e.clientY });
                    }}
                    onMouseMove={e => {
                      setTooltipPos({ x: e.clientX, y: e.clientY });
                    }}
                    onMouseLeave={() => {
                      setHoveredDay(null);
                      setTooltipPos(null);
                    }}
                    style={{
                      width: `${cellSize}px`,
                      height: `${tileHeight}px`,
                      borderRadius: `${Math.max(4, Math.round(cellSize * 0.16))}px`,
                      backgroundColor: day.color || emptyCellColor,
                      border: isSelected
                        ? '2px solid #38bdf8'
                        : `1px solid ${borderColor}`,
                      boxShadow: isSelected
                        ? '0 0 10px rgba(56, 189, 248, 0.5)'
                        : 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition:
                        'transform 0.15s ease, filter 0.15s ease, border-color 0.15s ease',
                      transform: isSelected ? 'scale(1.06)' : 'scale(1)',
                      userSelect: 'none',
                      boxSizing: 'border-box',
                    }}
                  >
                    {/* Day of Month */}
                    {showCellDate && (
                      <span
                        style={{
                          fontSize: `${dayLabelFontSize}px`,
                          fontWeight: 500,
                          color: day.textColor || '#ffffff',
                          lineHeight: 1.1,
                        }}
                      >
                        {day.dayOfMonth}
                      </span>
                    )}

                    {/* Metric Value */}
                    {showCellLabel && (
                      <span
                        style={{
                          fontSize: `${labelFontSize}px`,
                          fontWeight: 600,
                          color: day.textColor || '#ffffff',
                          opacity: day.value != null ? 0.95 : 0.4,
                          lineHeight: 1.1,
                          marginTop: showCellDate ? '2px' : '0px',
                          maxWidth: '100%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {day.value != null ? day.formattedValue : ''}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Legend if selected */}
      {showVisualMap && !isLegendTop && (
        <div
          style={{
            display: 'flex',
            justifyContent: isLegendRight ? 'flex-end' : 'flex-start',
            marginTop: '8px',
          }}
        >
          {renderVisualMapLegend()}
        </div>
      )}

      {/* Floating Tooltip mounted to document.body to prevent dashboard tile transform offset */}
      {hoveredDay &&
        tooltipPos &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              left: tooltipPos.x + 14,
              top: tooltipPos.y + 14,
              backgroundColor: '#1f222a',
              border: `1px solid ${borderColor}`,
              borderRadius: '8px',
              padding: '8px 12px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
              zIndex: 99999,
              pointerEvents: 'none',
              fontSize: '12px',
              minWidth: '130px',
            }}
          >
            <div
              style={{
                fontWeight: 600,
                color: '#f3f4f6',
                marginBottom: '4px',
              }}
            >
              {hoveredDay.dateStr}
            </div>
            <div
              style={{
                color: '#9ca3af',
                display: 'flex',
                gap: '8px',
                justifyContent: 'space-between',
              }}
            >
              <span>{metricLabel || 'Value'}:</span>
              <span style={{ color: '#38bdf8', fontWeight: 600 }}>
                {hoveredDay.value != null ? hoveredDay.formattedValue : '0'}
              </span>
            </div>
            {hoveredDay.extraMetrics && hoveredDay.extraMetrics.length > 0 && (
              <div
                style={{
                  marginTop: '4px',
                  paddingTop: '4px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                }}
              >
                {hoveredDay.extraMetrics.map(item => (
                  <div
                    key={item.label}
                    style={{
                      color: '#9ca3af',
                      display: 'flex',
                      gap: '8px',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>{item.label}:</span>
                    <span style={{ color: '#f3f4f6', fontWeight: 500 }}>
                      {item.formattedValue}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
