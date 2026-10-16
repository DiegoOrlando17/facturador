import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cx } from "@/components/ui/cx";

export type ColumnDatum = {
  key: string;
  /** Etiqueta corta del eje X ("16 oct", "oct"). */
  label: string;
  value: number;
  /** Contenido del tooltip (título del período y valores). */
  tooltip: ReactNode;
  /** Texto para lectores de pantalla de la columna. */
  ariaLabel: string;
};

type ColumnChartProps = {
  data: ColumnDatum[];
  /** Formato compacto de los ticks del eje Y ("$ 1,2 M"). */
  formatTick: (value: number) => string;
  /** Describe el gráfico; la tabla de la página es la vista accesible completa. */
  ariaLabel: string;
  height?: number;
  className?: string;
};

/** Paso "redondo" para los ticks: 1, 2, 2,5 o 5 × 10^n. */
function niceStep(max: number, ticks: number) {
  const raw = max / ticks;
  const magnitude = 10 ** Math.floor(Math.log10(raw || 1));
  const normalized = raw / magnitude;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

/** Cada cuántas columnas mostrar etiqueta en X para que no se pisen (~48px por etiqueta). */
function labelEvery(count: number, width: number) {
  const fits = Math.max(1, Math.floor(width / 48));
  return Math.max(1, Math.ceil(count / fits));
}

/**
 * Columnas de una sola serie (sin leyenda: el título de la sección dice qué se
 * grafica). Tooltip al pasar el mouse o al enfocar con teclado.
 */
export function ColumnChart({ data, formatTick, ariaLabel, height = 240, className }: ColumnChartProps) {
  const tooltipId = useId();
  const [active, setActive] = useState<number | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const [plotWidth, setPlotWidth] = useState(600);

  useEffect(() => {
    const node = plotRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setPlotWidth(entry.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const max = Math.max(0, ...data.map((item) => item.value));
  const step = niceStep(max || 1, 4);
  const top = Math.max(step, Math.ceil(max / step) * step);
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, index) => index * step);
  const every = labelEvery(data.length, plotWidth);
  const activeItem = active !== null ? data[active] : null;

  return (
    <figure className={cx("ui-column-chart", className)} aria-label={ariaLabel} style={{ ["--_height" as string]: `${height}px` }}>
      <div className="ui-column-chart__axis" aria-hidden="true">
        {ticks
          .slice()
          .reverse()
          .map((tick) => (
            <span key={tick}>{formatTick(tick)}</span>
          ))}
      </div>
      <div className="ui-column-chart__plot" ref={plotRef} onMouseLeave={() => setActive(null)}>
        <div className="ui-column-chart__grid" aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick} style={{ bottom: `${(tick / top) * 100}%` }} />
          ))}
        </div>
        <ol className="ui-column-chart__columns">
          {data.map((item, index) => (
            <li
              key={item.key}
              className={cx("ui-column-chart__slot", active === index && "is-active")}
              tabIndex={0}
              aria-label={item.ariaLabel}
              aria-describedby={active === index ? tooltipId : undefined}
              onMouseEnter={() => setActive(index)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
            >
              <span className="ui-column-chart__bar" style={{ height: `${top ? (item.value / top) * 100 : 0}%` }} />
              <span className={cx("ui-column-chart__label", index % every !== 0 && "ui-sr-only")} aria-hidden="true">
                {item.label}
              </span>
            </li>
          ))}
        </ol>
        {activeItem && active !== null ? (
          <div
            id={tooltipId}
            role="tooltip"
            className={cx("ui-column-chart__tooltip", active > data.length / 2 && "ui-column-chart__tooltip--left")}
            style={{ left: `${((active + 0.5) / data.length) * 100}%` }}
          >
            {activeItem.tooltip}
          </div>
        ) : null}
      </div>
    </figure>
  );
}
