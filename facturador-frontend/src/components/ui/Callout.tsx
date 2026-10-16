import type { HTMLAttributes, ReactNode } from "react";
import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";
import { cx } from "@/components/ui/cx";
import type { StatusTone } from "@/lib/statusLabels";

const TONE_ICONS: Record<StatusTone, AppIconName> = {
  success: "check-circle",
  warning: "alert",
  danger: "alert-circle",
  info: "info",
  neutral: "info",
};

export type CalloutProps = {
  tone?: StatusTone;
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  icon?: AppIconName | null;
  /** Botón de cerrar (×) a la derecha. */
  onDismiss?: () => void;
} & Omit<HTMLAttributes<HTMLDivElement>, "title">;

/**
 * Aviso dentro de la página. No se anuncia solo: si aparece como resultado de
 * una acción, pasale role="alert" (error) o role="status" (éxito/info).
 */
export function Callout({ tone = "info", title, children, actions, icon, onDismiss, className, ...rest }: CalloutProps) {
  const iconName = icon === null ? null : icon ?? TONE_ICONS[tone];
  return (
    <div className={cx("ui-callout", `ui-callout--${tone}`, className)} {...rest}>
      {iconName ? (
        <span className="ui-callout__icon" aria-hidden="true">
          <AppIcon name={iconName} />
        </span>
      ) : null}
      <div className="ui-callout__body">
        {title ? <p className="ui-callout__title">{title}</p> : null}
        {children ? <div className="ui-callout__text">{children}</div> : null}
        {actions ? <div className="ui-callout__actions">{actions}</div> : null}
      </div>
      {onDismiss ? (
        <button type="button" className="ui-callout__close" onClick={onDismiss} aria-label="Cerrar aviso">
          <AppIcon name="close" />
        </button>
      ) : null}
    </div>
  );
}
