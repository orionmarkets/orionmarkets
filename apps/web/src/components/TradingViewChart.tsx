"use client";

import React, { useEffect, useRef, useState } from "react";
import { createChart, ColorType, IChartApi, ISeriesApi, AreaSeries } from "lightweight-charts";
import { useTheme } from "../providers/ThemeProvider";

// The chart draws to a canvas, which cannot read CSS variables, so each theme carries its own palette.
const CHART_PALETTE = {
  light: {
    lineColor: "#010101",
    textColor: "#656462",
    gridColor: "rgba(1,1,1, 0.06)",
    crosshairColor: "rgba(1,1,1, 0.35)",
    areaTopColor: "rgba(1,1,1, 0.12)",
    areaBottomColor: "rgba(1,1,1, 0.0)",
  },
  dark: {
    lineColor: "#e5e5e5",
    textColor: "#7d7d7d",
    gridColor: "rgba(255,255,255, 0.03)",
    crosshairColor: "rgba(229,229,229, 0.3)",
    areaTopColor: "rgba(229,229,229, 0.16)",
    areaBottomColor: "rgba(229,229,229, 0.0)",
  },
} as const;

export interface ChartProps {
  data: any[];
  colors?: {
    backgroundColor?: string;
    lineColor?: string;
    textColor?: string;
    areaTopColor?: string;
    areaBottomColor?: string;
  };
}

export function TradingViewChart({ data, colors = {} }: ChartProps) {
  const { theme } = useTheme();
  const palette = CHART_PALETTE[theme];
  const {
    backgroundColor = "transparent",
    lineColor = palette.lineColor,
    textColor = palette.textColor,
    areaTopColor = palette.areaTopColor,
    areaBottomColor = palette.areaBottomColor,
  } = colors;
  const { gridColor, crosshairColor } = palette;
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [, setSeries] = useState<ISeriesApi<"Area"> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    const initialWidth = container.clientWidth || 300;
    const initialHeight = container.clientHeight || 300;

    const newChart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: backgroundColor },
        textColor,
        fontFamily: "'Inter', sans-serif",
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      crosshair: {
        vertLine: {
          color: crosshairColor,
          width: 1,
          style: 3,
        },
        horzLine: {
          color: crosshairColor,
          width: 1,
          style: 3,
        },
      },
      width: initialWidth,
      height: initialHeight,
      rightPriceScale: {
        borderVisible: false,
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = newChart;

    let precision = 2;
    if (data && data.length > 0) {
      const sample = data[0].value;
      if (sample < 0.000001) precision = 10;
      else if (sample < 0.0001) precision = 8;
      else if (sample < 0.01) precision = 6;
      else if (sample < 1) precision = 4;
    }
    const minMove = 1 / Math.pow(10, precision);

    const newSeries = newChart.addSeries(AreaSeries, {
      lineColor,
      topColor: areaTopColor,
      bottomColor: areaBottomColor,
      lineWidth: 2,
      priceFormat: {
        type: 'price',
        precision: precision,
        minMove: minMove,
      },
    });

    newSeries.setData(data);
    setSeries(newSeries);

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      if (chartRef.current && width > 0) {
        chartRef.current.applyOptions({
          width: Math.floor(width),
          height: Math.floor(height) || initialHeight,
        });
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      newChart.remove();
      chartRef.current = null;
    };
  }, [data, backgroundColor, lineColor, textColor, areaTopColor, areaBottomColor, gridColor, crosshairColor]);

  return (
    <div
      ref={chartContainerRef}
      className="w-full h-[300px] sm:h-[360px] lg:h-full lg:min-h-[480px] flex-1"
      style={{ outline: "none" }}
    />
  );
}
