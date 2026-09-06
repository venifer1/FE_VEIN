"use client";
import { useEffect, useMemo, useRef } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type LineData,
  type LogicalRange,
  type SeriesMarker,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle, Evidence, IndicatorSummary, Invalidation } from "@/lib/types";
import { toChartTime } from "@/lib/format";
import { sma, bollinger } from "@/lib/indicators";

// Toggles for client-computed line overlays drawn across ALL candles.
export interface ChartOverlays {
  ma?: boolean; // MA20 / MA60 / MA120 group
  bollinger?: boolean; // Bollinger Bands (20, 2)
}

interface ChartViewProps {
  candles: Candle[];
  evidence?: Evidence[];
  invalidation?: Invalidation | null;
  // optional MA overlays from the indicators endpoint (flat reference lines)
  indicators?: IndicatorSummary | null;
  showIndicators?: boolean;
  // client-side computed overlays (full-length line series)
  overlays?: ChartOverlays;
  onLoadOlder?: () => void;
  hasOlder?: boolean;
  isLoadingOlder?: boolean;
  height?: number;
}

const PIVOT_LABEL: Record<string, string> = {
  PIVOT_0: "0",
  PIVOT_A: "A",
  PIVOT_B: "B",
};

// Renders candles + evidence overlays for all 4 pattern types:
//  - ABC/TOP: pivots (PIVOT_0/A/B) via setMarkers + C target priceLine
//  - TRIANGLE: trendlines (TREND_UPPER/LOWER) via LineSeries
//  - IMALOL: bollinger bands (BOLL_UPPER/MID/LOWER) via LineSeries + MATCH_BOX markers
//  - invalidation price via createPriceLine
export function ChartView({
  candles,
  evidence = [],
  invalidation,
  indicators,
  showIndicators = false,
  overlays,
  onLoadOlder,
  hasOlder = false,
  isLoadingOlder = false,
  height = 320,
}: ChartViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const visibleRangeRef = useRef<LogicalRange | null>(null);
  const previousCandleCountRef = useRef(0);

  const maOn = !!overlays?.ma;
  const bbOn = !!overlays?.bollinger;

  // Compute client-side overlay line data once per candles/overlay change.
  // null entries (window not yet full) are dropped so series start where valid.
  const overlayData = useMemo(() => {
    if (!maOn && !bbOn) return null;
    const times = candles.map((c) => toChartTime(c.open_time) as UTCTimestamp);
    const closes = candles.map((c) => Number(c.close));
    const toLine = (vals: (number | null)[]): LineData[] => {
      const pts: LineData[] = [];
      for (let i = 0; i < vals.length; i++) {
        const v = vals[i];
        if (v != null && Number.isFinite(v)) pts.push({ time: times[i], value: v });
      }
      return pts;
    };
    const result: {
      ma20?: LineData[];
      ma60?: LineData[];
      ma120?: LineData[];
      bbUpper?: LineData[];
      bbMid?: LineData[];
      bbLower?: LineData[];
    } = {};
    if (maOn) {
      result.ma20 = toLine(sma(closes, 20));
      result.ma60 = toLine(sma(closes, 60));
      result.ma120 = toLine(sma(closes, 120));
    }
    if (bbOn) {
      const bb = bollinger(closes, 20, 2);
      result.bbUpper = toLine(bb.upper);
      result.bbMid = toLine(bb.middle);
      result.bbLower = toLine(bb.lower);
    }
    return result;
  }, [candles, maOn, bbOn]);

  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return;
    const el = containerRef.current;

    const chart = createChart(el, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#9aa4b2",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.1)" },
      timeScale: { borderColor: "rgba(255,255,255,0.1)", timeVisible: true, secondsVisible: false },
      crosshair: { mode: CrosshairMode.Normal },
      handleScale: true,
      handleScroll: true,
    });
    chartRef.current = chart;

    const candleSeries: ISeriesApi<"Candlestick"> = chart.addCandlestickSeries({
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    const data: CandlestickData[] = candles.map((c) => ({
      time: toChartTime(c.open_time) as UTCTimestamp,
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close),
    }));
    candleSeries.setData(data);

    // ----- markers: pivots (0/A/B) + match box -----
    const markers: SeriesMarker<UTCTimestamp>[] = [];
    for (const ev of evidence) {
      if (ev.type in PIVOT_LABEL && ev.candle_time) {
        const isLow = ev.type === "PIVOT_A";
        markers.push({
          time: toChartTime(ev.candle_time) as UTCTimestamp,
          position: isLow ? "belowBar" : "aboveBar",
          color: isLow ? "#38bdf8" : "#f59e0b",
          shape: isLow ? "arrowUp" : "arrowDown",
          text: PIVOT_LABEL[ev.type],
        });
      }
      if (ev.type === "MATCH_BOX" && ev.candle_time) {
        markers.push({
          time: toChartTime(ev.candle_time) as UTCTimestamp,
          position: "belowBar",
          color: "#a855f7",
          shape: "circle",
          text: "매치",
        });
      }
    }
    if (markers.length) {
      markers.sort((a, b) => (a.time as number) - (b.time as number));
      candleSeries.setMarkers(markers);
    }

    // ----- line overlays from sequential evidence points -----
    const buildLine = (type: Evidence["type"], color: string, dashed = false) => {
      const pts = evidence
        .filter((e) => e.type === type && e.candle_time && e.price != null)
        .sort((a, b) => (a.sequence_no ?? 0) - (b.sequence_no ?? 0))
        .map<LineData>((e) => ({
          time: toChartTime(e.candle_time!) as UTCTimestamp,
          value: Number(e.price),
        }));
      if (pts.length >= 2) {
        const series = chart.addLineSeries({
          color,
          lineWidth: 2,
          lineStyle: dashed ? LineStyle.Dashed : LineStyle.Solid,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        series.setData(pts);
      }
    };
    // TRIANGLE
    buildLine("TREND_UPPER", "#f43f5e");
    buildLine("TREND_LOWER", "#0ea5e9");
    // IMALOL bollinger bands
    buildLine("BOLL_UPPER", "#f59e0b", true);
    buildLine("BOLL_MID", "#94a3b8", true);
    buildLine("BOLL_LOWER", "#f59e0b", true);

    // ----- MA reference lines from indicators (optional toggle) -----
    if (showIndicators && indicators) {
      const firstT = toChartTime(candles[0].open_time) as UTCTimestamp;
      const lastT = toChartTime(candles[candles.length - 1].open_time) as UTCTimestamp;
      const maLine = (value: string | null | undefined, color: string) => {
        if (value == null) return;
        const series = chart.addLineSeries({
          color,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        series.setData([
          { time: firstT, value: Number(value) },
          { time: lastT, value: Number(value) },
        ]);
      };
      maLine(indicators.ma20, "#eab308");
      maLine(indicators.ma60, "#06b6d4");
      maLine(indicators.ma120, "#8b5cf6");
    }

    // ----- client-computed overlays: MA20/60/120 + Bollinger (20,2) -----
    if (overlayData) {
      const addLine = (
        pts: LineData[] | undefined,
        color: string,
        dashed = false,
      ) => {
        if (!pts || pts.length === 0) return;
        const series = chart.addLineSeries({
          color,
          lineWidth: 1,
          lineStyle: dashed ? LineStyle.Dashed : LineStyle.Solid,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        series.setData(pts);
      };
      // moving averages (solid, distinct muted hues)
      addLine(overlayData.ma20, "#eab308");
      addLine(overlayData.ma60, "#06b6d4");
      addLine(overlayData.ma120, "#8b5cf6");
      // bollinger bands: upper/lower dashed, middle solid
      addLine(overlayData.bbUpper, "#94a3b8", true);
      addLine(overlayData.bbMid, "#64748b");
      addLine(overlayData.bbLower, "#94a3b8", true);
    }

    // ----- price lines: C target + invalidation -----
    const cTarget = evidence.find((e) => e.type === "C_TARGET" && e.price != null);
    if (cTarget?.price) {
      candleSeries.createPriceLine({
        price: Number(cTarget.price),
        color: "#a855f7",
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "C 목표가",
      });
    }
    if (invalidation?.price) {
      candleSeries.createPriceLine({
        price: Number(invalidation.price),
        color: "#ef4444",
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: "무효화",
      });
    }

    const previousRange = visibleRangeRef.current;
    const previousCandleCount = previousCandleCountRef.current;
    const addedCandles = Math.max(candles.length - previousCandleCount, 0);
    if (previousRange && previousCandleCount > 0 && addedCandles > 0) {
      chart.timeScale().setVisibleLogicalRange({
        from: (previousRange.from as number) + addedCandles,
        to: (previousRange.to as number) + addedCandles,
      });
    } else if (!previousRange) {
      chart.timeScale().fitContent();
    }
    previousCandleCountRef.current = candles.length;

    const handleVisibleRangeChange = (range: LogicalRange | null) => {
      visibleRangeRef.current = range;
      if (!range || !hasOlder || isLoadingOlder) return;
      const bars = candleSeries.barsInLogicalRange(range);
      if (bars && bars.barsBefore < 50) {
        onLoadOlder?.();
      }
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth });
    });
    ro.observe(el);
    chart.applyOptions({ width: el.clientWidth });

    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [
    candles,
    evidence,
    invalidation,
    indicators,
    showIndicators,
    overlayData,
    height,
    onLoadOlder,
    hasOlder,
    isLoadingOlder,
  ]);

  if (candles.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground"
        style={{ height }}
      >
        캔들 데이터가 없습니다.
      </div>
    );
  }

  return <div ref={containerRef} className="w-full" style={{ height }} />;
}
