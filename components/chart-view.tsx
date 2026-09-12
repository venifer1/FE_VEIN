"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type CandlestickData,
  type LineData,
  type LogicalRange,
  type MouseEventParams,
  type SeriesMarker,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle, Evidence, IndicatorSummary, Invalidation } from "@/lib/types";
import { formatPrice, toChartTime } from "@/lib/format";
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

interface LegendState {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

// Renders candles + evidence overlays for all pattern types:
//  - ABC/TOP: pivots (PIVOT_0/A/B) via setMarkers + C target priceLine
//  - TRIANGLE: trendlines (TREND_UPPER/LOWER) via LineSeries
//  - IMALOL: bollinger bands (BOLL_UPPER/MID/LOWER) via LineSeries + MATCH_BOX markers
//  - invalidation price via createPriceLine
//
// 조작감(R47): 차트는 마운트 시 한 번만 생성하고, 이후 캔들/오버레이/증거/지표/가격선은 각각
// 별도 effect가 시리즈만 갱신한다. 과거 캔들 로드·리사이즈·페이지네이션 상태 변화에도 차트를
// 재생성(remove)하지 않아 팬/줌·크로스헤어 상태가 유지된다. onLoadOlder 등 콜백은 ref로 읽어
// 재구독을 피한다. hover 시 상단 레전드에 날짜·OHLC·등락%를 표시한다.
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
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  // Dynamically-added series/price-lines are tracked so each update effect can
  // remove exactly what it added instead of tearing down the whole chart.
  const evidenceSeriesRef = useRef<ISeriesApi<"Line">[]>([]);
  const overlaySeriesRef = useRef<ISeriesApi<"Line">[]>([]);
  const indicatorSeriesRef = useRef<ISeriesApi<"Line">[]>([]);
  const priceLinesRef = useRef<IPriceLine[]>([]);

  const visibleRangeRef = useRef<LogicalRange | null>(null);
  const previousCandleCountRef = useRef(0);
  const lastCandleRef = useRef<LegendState | null>(null);
  // Pagination callbacks live in a ref so the range handler stays stable.
  const loadCbRef = useRef({ onLoadOlder, hasOlder, isLoadingOlder });

  const [legend, setLegend] = useState<LegendState | null>(null);

  const maOn = !!overlays?.ma;
  const bbOn = !!overlays?.bollinger;

  useEffect(() => {
    loadCbRef.current = { onLoadOlder, hasOlder, isLoadingOlder };
  }, [onLoadOlder, hasOlder, isLoadingOlder]);

  // Compute client-side overlay line data once per candles/overlay change.
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

  // ---- create the chart once (mount) ----
  useEffect(() => {
    if (!containerRef.current) return;
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
      timeScale: {
        borderColor: "rgba(255,255,255,0.1)",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 3,
      },
      crosshair: { mode: CrosshairMode.Normal },
      // 모바일 우선 조작감: 가로 드래그/핀치/휠·키네틱은 켜되, 세로 터치 드래그는 꺼서
      // 차트 위에서도 페이지 세로 스크롤이 막히지 않게 한다.
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
      kineticScroll: { touch: true, mouse: false },
    });
    chartRef.current = chart;

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });
    candleSeriesRef.current = candleSeries;

    const handleVisibleRangeChange = (range: LogicalRange | null) => {
      visibleRangeRef.current = range;
      const { onLoadOlder: cb, hasOlder: more, isLoadingOlder: loading } = loadCbRef.current;
      if (!range || !more || loading) return;
      const bars = candleSeries.barsInLogicalRange(range);
      if (bars && bars.barsBefore < 50) {
        cb?.();
      }
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);

    // Crosshair legend: show the hovered candle, or fall back to the latest bar.
    const handleCrosshairMove = (param: MouseEventParams) => {
      const bar = param.seriesData.get(candleSeries) as CandlestickData | undefined;
      if (bar && param.time != null) {
        setLegend({
          time: param.time as number,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
        });
      } else {
        setLegend(lastCandleRef.current);
      }
    };
    chart.subscribeCrosshairMove(handleCrosshairMove);

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth });
    });
    ro.observe(el);
    chart.applyOptions({ width: el.clientWidth });

    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      evidenceSeriesRef.current = [];
      overlaySeriesRef.current = [];
      indicatorSeriesRef.current = [];
      priceLinesRef.current = [];
      previousCandleCountRef.current = 0;
      visibleRangeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- height changes without recreating ----
  useEffect(() => {
    chartRef.current?.applyOptions({ height });
  }, [height]);

  // ---- candle data: update series + preserve view across older-loads ----
  useEffect(() => {
    const chart = chartRef.current;
    const series = candleSeriesRef.current;
    if (!chart || !series) return;

    const data: CandlestickData[] = candles.map((c) => ({
      time: toChartTime(c.open_time) as UTCTimestamp,
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close),
    }));
    series.setData(data);

    const last = data[data.length - 1];
    lastCandleRef.current = last
      ? { time: last.time as number, open: last.open, high: last.high, low: last.low, close: last.close }
      : null;
    setLegend((cur) => cur ?? lastCandleRef.current);

    const previousRange = visibleRangeRef.current;
    const previousCandleCount = previousCandleCountRef.current;
    const addedCandles = Math.max(candles.length - previousCandleCount, 0);
    if (previousRange && previousCandleCount > 0 && addedCandles > 0) {
      // Older bars are prepended → shift the logical range so the view stays put.
      chart.timeScale().setVisibleLogicalRange({
        from: (previousRange.from as number) + addedCandles,
        to: (previousRange.to as number) + addedCandles,
      });
    } else if (previousCandleCount === 0 && candles.length > 0) {
      chart.timeScale().fitContent();
    }
    previousCandleCountRef.current = candles.length;
  }, [candles]);

  // ---- markers + evidence lines + price lines (evidence / invalidation) ----
  useEffect(() => {
    const chart = chartRef.current;
    const series = candleSeriesRef.current;
    if (!chart || !series) return;

    // markers: pivots (0/A/B) + match box
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
    markers.sort((a, b) => (a.time as number) - (b.time as number));
    series.setMarkers(markers);

    // clear previously-added evidence lines + price lines
    for (const s of evidenceSeriesRef.current) chart.removeSeries(s);
    evidenceSeriesRef.current = [];
    for (const pl of priceLinesRef.current) series.removePriceLine(pl);
    priceLinesRef.current = [];

    const buildLine = (type: Evidence["type"], color: string, dashed = false) => {
      const pts = evidence
        .filter((e) => e.type === type && e.candle_time && e.price != null)
        .sort((a, b) => (a.sequence_no ?? 0) - (b.sequence_no ?? 0))
        .map<LineData>((e) => ({
          time: toChartTime(e.candle_time!) as UTCTimestamp,
          value: Number(e.price),
        }));
      if (pts.length >= 2) {
        const line = chart.addLineSeries({
          color,
          lineWidth: 2,
          lineStyle: dashed ? LineStyle.Dashed : LineStyle.Solid,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        line.setData(pts);
        evidenceSeriesRef.current.push(line);
      }
    };
    buildLine("TREND_UPPER", "#f43f5e");
    buildLine("TREND_LOWER", "#0ea5e9");
    buildLine("BOLL_UPPER", "#f59e0b", true);
    buildLine("BOLL_MID", "#94a3b8", true);
    buildLine("BOLL_LOWER", "#f59e0b", true);

    const cTarget = evidence.find((e) => e.type === "C_TARGET" && e.price != null);
    if (cTarget?.price) {
      priceLinesRef.current.push(series.createPriceLine({
        price: Number(cTarget.price),
        color: "#a855f7",
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "C 목표가",
      }));
    }
    if (invalidation?.price) {
      priceLinesRef.current.push(series.createPriceLine({
        price: Number(invalidation.price),
        color: "#ef4444",
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: "무효화",
      }));
    }
  }, [evidence, invalidation]);

  // ---- client-computed overlays: MA20/60/120 + Bollinger (20,2) ----
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    for (const s of overlaySeriesRef.current) chart.removeSeries(s);
    overlaySeriesRef.current = [];
    if (!overlayData) return;

    const addLine = (pts: LineData[] | undefined, color: string, dashed = false) => {
      if (!pts || pts.length === 0) return;
      const line = chart.addLineSeries({
        color,
        lineWidth: 1,
        lineStyle: dashed ? LineStyle.Dashed : LineStyle.Solid,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      line.setData(pts);
      overlaySeriesRef.current.push(line);
    };
    addLine(overlayData.ma20, "#eab308");
    addLine(overlayData.ma60, "#06b6d4");
    addLine(overlayData.ma120, "#8b5cf6");
    addLine(overlayData.bbUpper, "#94a3b8", true);
    addLine(overlayData.bbMid, "#64748b");
    addLine(overlayData.bbLower, "#94a3b8", true);
  }, [overlayData]);

  // ---- flat MA reference lines from the indicators endpoint (optional) ----
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    for (const s of indicatorSeriesRef.current) chart.removeSeries(s);
    indicatorSeriesRef.current = [];
    if (!showIndicators || !indicators || candles.length === 0) return;

    const firstT = toChartTime(candles[0].open_time) as UTCTimestamp;
    const lastT = toChartTime(candles[candles.length - 1].open_time) as UTCTimestamp;
    const maLine = (value: string | null | undefined, color: string) => {
      if (value == null) return;
      const line = chart.addLineSeries({
        color,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      line.setData([
        { time: firstT, value: Number(value) },
        { time: lastT, value: Number(value) },
      ]);
      indicatorSeriesRef.current.push(line);
    };
    maLine(indicators.ma20, "#eab308");
    maLine(indicators.ma60, "#06b6d4");
    maLine(indicators.ma120, "#8b5cf6");
  }, [showIndicators, indicators, candles]);

  const changePct = legend && legend.open !== 0 ? ((legend.close - legend.open) / legend.open) * 100 : null;
  const up = changePct != null && changePct >= 0;

  return (
    <div className="relative w-full" style={{ height }}>
      {legend && (
        <div className="pointer-events-none absolute left-2 top-2 z-10 flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md bg-background/70 px-2 py-1 text-[11px] tabular-nums backdrop-blur-sm">
          <span className="text-muted-foreground">
            {new Date(legend.time * 1000).toLocaleString("ko-KR", {
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })}
          </span>
          <span className="text-muted-foreground">시 <span className="text-foreground">{formatPrice(String(legend.open))}</span></span>
          <span className="text-muted-foreground">고 <span className="text-foreground">{formatPrice(String(legend.high))}</span></span>
          <span className="text-muted-foreground">저 <span className="text-foreground">{formatPrice(String(legend.low))}</span></span>
          <span className="text-muted-foreground">종 <span className="text-foreground">{formatPrice(String(legend.close))}</span></span>
          {changePct != null && (
            <span className={up ? "text-emerald-500" : "text-red-500"}>
              {up ? "+" : ""}{changePct.toFixed(2)}%
            </span>
          )}
        </div>
      )}
      <div ref={containerRef} className="h-full w-full" />
      {candles.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
          캔들 데이터가 없습니다.
        </div>
      )}
    </div>
  );
}
