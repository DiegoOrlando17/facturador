import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import { getStatus, type StatusKind, type StatusTone } from "@/lib/statusLabels";

type BadgeBaseProps = {
  size?: "sm" | "md";
  /** Punto de color antes del texto (útil en tablas densas). */
  dot?: boolean;
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

/**
 * Píldora de estado.
 *  - Manual: `<StatusBadge tone="success">Conectado</StatusBadge>`
 *  - Desde el backend: `<StatusBadge kind="payment" value={payment.status} />`
 * Con `kind`, la descripción del estado queda como title (tooltip nativo).
 */
export function StatusBadge(props: StatusBadgeProps) {
  const { size = "sm", dot = false, className, ...rest } = props;
  let tone: StatusTone = "neutral";
  let content: ReactNode;
  let title: string | undefined;
  let htmlProps: HTMLAttributes<HTMLSpanElement>;

  if ("kind" in props && props.kind) {
    const { kind, value, children, ...others } = rest as StatusKindBadgeProps;
    const status = getStatus(kind, value);
    tone = status.tone;
    content = children ?? status.label;
    title = status.description;
    htmlProps = others;
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
      className={cx("ui-badge", `ui-badge--${tone}`, `ui-badge--${size}`, className)}
    >
      {dot ? <span className="ui-badge__dot" aria-hidden="true" /> : null}
      <span className="ui-badge__label">{content}</span>
    </span>
  );
}
