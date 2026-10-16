import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AppIcon } from "@/components/ui/AppIcon";
import { cx } from "@/components/ui/cx";
import { usePageTitle } from "@/hooks/usePageTitle";

export type BreadcrumbItem = { label: string; to?: string };

type PageHeaderProps = {
  title: string;
  /** Línea chica en mono arriba del título ("MIÉRCOLES 15 DE OCTUBRE", "FACTURA C"). */
  eyebrow?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: BreadcrumbItem[];
  /** Línea secundaria: "Actualizado 10:42", estado de la empresa, etc. */
  meta?: ReactNode;
  /** Pone el título en la pestaña del navegador (por defecto sí). */
  setDocumentTitle?: boolean;
  className?: string;
};

/** Encabezado de página: migas, título (h1), descripción, meta y acciones. */
export function PageHeader({ title, eyebrow, description, actions, breadcrumb, meta, setDocumentTitle = true, className }: PageHeaderProps) {
  usePageTitle(setDocumentTitle ? title : undefined);

  return (
    <header className={cx("ui-page-header", className)}>
      {breadcrumb && breadcrumb.length > 0 ? (
        <nav className="ui-breadcrumb" aria-label="Migas de pan">
          <ol>
            {breadcrumb.map((item, index) => {
              const isLast = index === breadcrumb.length - 1;
              return (
                <li key={`${item.label}-${index}`}>
                  {item.to && !isLast ? (
                    <Link to={item.to}>{item.label}</Link>
                  ) : (
                    <span aria-current={isLast ? "page" : undefined}>{item.label}</span>
                  )}
                  {!isLast ? <AppIcon name="chevron-right" className="ui-breadcrumb__sep" /> : null}
                </li>
              );
            })}
          </ol>
        </nav>
      ) : null}
      <div className="ui-page-header__row">
        <div className="ui-page-header__text">
          {eyebrow ? <p className="ui-page-header__eyebrow">{eyebrow}</p> : null}
          <h1 className="ui-page-header__title">{title}</h1>
          {description ? <p className="ui-page-header__description">{description}</p> : null}
          {meta ? <div className="ui-page-header__meta">{meta}</div> : null}
        </div>
        {actions ? <div className="ui-page-header__actions">{actions}</div> : null}
      </div>
    </header>
  );
}
