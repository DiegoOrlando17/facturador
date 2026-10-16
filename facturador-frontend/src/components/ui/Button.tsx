import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";
import { Spinner } from "@/components/ui/Spinner";
import { cx } from "@/components/ui/cx";

/**
 * primary: acción principal (yerba) · accent: CTA de marketing (terracota) ·
 * secondary: papel con borde de tinta · ghost · danger · danger-soft · link.
 */
export type ButtonVariant = "primary" | "accent" | "secondary" | "ghost" | "danger" | "danger-soft" | "link";
export type ButtonSize = "sm" | "md" | "lg";

type ButtonOwnProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Ícono a la izquierda (nombre de AppIcon o nodo). */
  iconLeft?: AppIconName | ReactNode;
  iconRight?: AppIconName | ReactNode;
  /** Muestra un spinner, deshabilita el botón y anuncia aria-busy. */
  loading?: boolean;
  /** Texto para lectores de pantalla mientras carga (por defecto "Procesando…"). */
  loadingLabel?: string;
  fullWidth?: boolean;
  /** Botón solo ícono: el texto va en aria-label y el contenido se oculta. */
  iconOnly?: boolean;
  children?: ReactNode;
  className?: string;
};

export type ButtonProps = ButtonOwnProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonOwnProps>;

function renderIcon(icon: AppIconName | ReactNode) {
  if (!icon) return null;
  if (typeof icon === "string") return <AppIcon name={icon as AppIconName} className="ui-button__icon" />;
  return <span className="ui-button__icon" aria-hidden="true">{icon}</span>;
}

function buttonClassName({ variant = "secondary", size = "md", fullWidth, loading, iconOnly, className }: ButtonOwnProps) {
  return cx(
    "ui-button",
    `ui-button--${variant}`,
    `ui-button--${size}`,
    fullWidth && "ui-button--full",
    loading && "ui-button--loading",
    iconOnly && "ui-button--icon-only",
    className,
  );
}

function ButtonContent({ iconLeft, iconRight, loading, loadingLabel, children }: ButtonOwnProps) {
  return (
    <>
      {loading ? (
        <span className="ui-button__spinner">
          <Spinner size="sm" label={null} />
          <span className="ui-sr-only">{loadingLabel ?? "Procesando…"}</span>
        </span>
      ) : null}
      <span className="ui-button__content">
        {renderIcon(iconLeft)}
        {children !== undefined && children !== null ? <span className="ui-button__label">{children}</span> : null}
        {renderIcon(iconRight)}
      </span>
    </>
  );
}

/** Botón del sistema. Para navegar usá `ButtonLink` (misma apariencia, semántica de enlace). */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, iconLeft, iconRight, loading = false, loadingLabel, fullWidth, iconOnly, children, className, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClassName({ variant, size, fullWidth, loading, iconOnly, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      <ButtonContent iconLeft={iconLeft} iconRight={iconRight} loading={loading} loadingLabel={loadingLabel}>
        {children}
      </ButtonContent>
    </button>
  );
});

type ButtonLinkOwnProps = Omit<ButtonOwnProps, "loading" | "loadingLabel"> & {
  /** Ruta interna (usa react-router). */
  to?: LinkProps["to"];
  /** URL externa o descarga. */
  href?: string;
  replace?: boolean;
  state?: unknown;
  /** Abre en otra pestaña con rel seguro. */
  external?: boolean;
};

export type ButtonLinkProps = ButtonLinkOwnProps & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof ButtonLinkOwnProps>;

/** Enlace con apariencia de botón: `to` para rutas internas, `href` para externas. */
export const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(function ButtonLink(
  { variant, size, iconLeft, iconRight, fullWidth, iconOnly, children, className, to, href, replace, state, external, ...rest },
  ref,
) {
  const classes = buttonClassName({ variant, size, fullWidth, iconOnly, className });
  const content = (
    <ButtonContent iconLeft={iconLeft} iconRight={iconRight ?? (external ? "external" : undefined)}>
      {children}
    </ButtonContent>
  );

  if (to !== undefined) {
    return (
      <Link ref={ref} to={to} replace={replace} state={state} className={classes} {...rest}>
        {content}
      </Link>
    );
  }

  return (
    <a
      ref={ref}
      href={href}
      className={classes}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      {...rest}
    >
      {content}
    </a>
  );
});
