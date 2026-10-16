import type { CSSProperties } from "react";
import { cx } from "@/components/ui/cx";

type SkeletonProps = {
  /** line: renglón de texto · block: rectángulo · circle: avatar/ícono. */
  variant?: "line" | "block" | "circle";
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
  /** Cantidad de renglones (solo `line`); el último sale más corto. */
  lines?: number;
  className?: string;
};

/** Marcador de carga decorativo. Anunciá la carga aparte (aria-busy o un texto). */
export function Skeleton({ variant = "line", width, height, lines = 1, className }: SkeletonProps) {
  if (variant === "line" && lines > 1) {
    return (
      <span className={cx("ui-skeleton-group", className)} aria-hidden="true">
        {Array.from({ length: lines }, (_, index) => (
          <span
            key={index}
            className="ui-skeleton ui-skeleton--line"
            style={{ width: index === lines - 1 ? "60%" : width, height }}
          />
        ))}
      </span>
    );
  }

  return (
    <span
      className={cx("ui-skeleton", `ui-skeleton--${variant}`, className)}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}
