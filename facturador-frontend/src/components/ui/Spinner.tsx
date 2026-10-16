import { cx } from "@/components/ui/cx";

type SpinnerProps = {
  size?: "sm" | "md" | "lg";
  /** Texto para lectores de pantalla. Con `null` el spinner es decorativo. */
  label?: string | null;
  className?: string;
};

export function Spinner({ size = "md", label = "Cargando…", className }: SpinnerProps) {
  return (
    <span className={cx("ui-spinner", `ui-spinner--${size}`, className)} role={label ? "status" : undefined}>
      <span className="ui-spinner__circle" aria-hidden="true" />
      {label ? <span className="ui-sr-only">{label}</span> : null}
    </span>
  );
}
