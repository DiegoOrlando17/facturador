import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import { getStatus, type StatusKind, type StatusTone } from "@/lib/statusLabels";

type BadgeBaseProps = {
  size?: "sm" | "md";
  /** Punto de color antes del texto (útil en tablas densas). */
  dot?: boolean;
  /**
   * Aspecto de sello de goma (borde, mayúsculas, levemente inclinado), como el
   * "CAE OK" del ticket. Con `kind="invoice"` se activa solo para emitida y
   * anulada; pasá `stamp={false}` para desactivarlo.
   */
  stamp?: boolean;
  className?: string;
} & Omit<HTMLAttributes<HTMLSpanElement>, "children">;

type ManualBadgeProps = BadgeBaseProps & {
  tone?: StatusTone;
  children: ReactNode;
  kind?: never;
  value?: never;
};

type StatusKindBadgeProps = BadgeBaseProps & {
  /** Tipo de estado: resuelve etiqueta y tono desde lib/statusLabels. */
  kind: StatusKind;
  value: string | null | undefined;
  /** Reemplaza la etiqueta calculada (el tono se mantiene). */
  children?: ReactNode;
  tone?: never;
};

export type StatusBadgeProps = ManualBadgeProps | StatusKindBadgeProps;

/** Estados de comprobante que se muestran como sello por defecto. */
const STAMPED_INVOICE_STATUSES = new Set(["ISSUED", "CANCELED", "CANCELLED"]);

function isStampedByDefault(kind: StatusKind, value: string | null | undefined) {
  return kind === "invoice" && Boolean(value && STAMPED_INVOICE_STATUSES.has(value.toUpperCase()));
}

/**
 * Píldora de estado.
 *  - Manual: `<StatusBadge tone="success">Conectado</StatusBadge>`
 *  - Desde el backend: `<StatusBadge kind="payment" value={payment.status} />`
 *  - Sello: `<StatusBadge tone="success" stamp>CAE OK</StatusBadge>`
 * Con `kind`, la descripción del estado queda como title (tooltip nativo).
 */
export function StatusBadge(props: StatusBadgeProps) {
  const { size = "sm", dot = false, stamp, className, ...rest } = props;
  let tone: StatusTone = "neutral";
  let content: ReactNode;
  let title: string | undefined;
  let htmlProps: HTMLAttributes<HTMLSpanElement>;
  let stamped = Boolean(stamp);

  if ("kind" in props && props.kind) {
    const { kind, value, children, ...others } = rest as StatusKindBadgeProps;
    const status = getStatus(kind, value);
    tone = status.tone;
    content = children ?? status.label;
    title = status.description;
    htmlProps = others;
    stamped = stamp ?? isStampedByDefault(kind, value);
  } else {
    const { tone: manualTone = "neutral", children, ...others } = rest as ManualBadgeProps;
    tone = manualTone;
    content = children;
    htmlProps = others;
  }

  return (
    <span
      title={title}
      {...htmlProps}
      className={cx("ui-badge", `ui-badge--${tone}`, `ui-badge--${size}`, stamped && "ui-badge--stamp", className)}
    >
      {dot && !stamped ? <span className="ui-badge__dot" aria-hidden="true" /> : null}
      <span className="ui-badge__label">{content}</span>
    </span>
  );
}
