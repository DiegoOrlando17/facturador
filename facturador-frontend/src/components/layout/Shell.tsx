import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Link, matchPath, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";
import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";
import { useDialogFocus } from "@/components/ui/useDialogFocus";

export type ShellNavItem = {
  label: string;
  icon: AppIconName;
  /** Destino; puede llevar query (?tab=...). */
  to: string;
  /** Coincidencia exacta de ruta (para "Inicio"). */
  end?: boolean;
  /** Activo calculado por el layout. Sin valor: se compara la ruta de `to` con la actual. */
  isActive?: boolean;
  /** Contador opcional (píldora mostaza). Se oculta si es 0 o no viene. */
  count?: number;
  /** Texto para lectores de pantalla del contador: "3 alertas activas". */
  countLabel?: string;
};

export type ShellNavGroup = {
  /** Título del grupo; sin título, los ítems van sueltos. */
  label?: string;
  items: ShellNavItem[];
};

export type ShellUser = {
  /** Línea principal: nombre de la persona o de la empresa. */
  name: string;
  /** Línea secundaria: rol o email. */
  detail?: string;
  initials: string;
  /** Si viene, la tarjeta es un enlace (por ejemplo a "Mi cuenta"). */
  to?: string;
  ariaLabel?: string;
};

type ShellProps = {
  /** Subtítulo de la marca: "Panel interno", "Portal del cliente". */
  brandSubtitle: string;
  /** Destino del logo. */
  homeTo: string;
  /** Nombre accesible de la navegación. */
  navLabel: string;
  groups: ShellNavGroup[];
  user: ShellUser;
  onLogout: () => void;
  children: ReactNode;
};

const DESKTOP_QUERY = "(min-width: 1024px)";
const DRAWER_ID = "app-frame-nav";

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window === "undefined" ? true : window.matchMedia(DESKTOP_QUERY).matches,
  );

  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY);
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return isDesktop;
}

function isItemActive(item: ShellNavItem, pathname: string) {
  if (typeof item.isActive === "boolean") return item.isActive;
  const path = item.to.split("?")[0];
  return Boolean(matchPath({ path, end: Boolean(item.end) }, pathname));
}

/**
 * Shell común del panel interno y del portal del cliente.
 * Escritorio (≥ 1024px): barra lateral fija de tinta. Menos ancho: barra superior
 * con hamburguesa y la misma barra lateral como cajón modal.
 */
export function Shell({ brandSubtitle, homeTo, navLabel, groups, user, onLogout, children }: ShellProps) {
  const location = useLocation();
  const isDesktop = useIsDesktop();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const isDrawer = !isDesktop;
  const isModalOpen = isDrawer && drawerOpen;

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  useDialogFocus({ open: isModalOpen, containerRef: sidebarRef, onEscape: closeDrawer });

  // Se cierra al navegar y al pasar a escritorio.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (isDesktop) setDrawerOpen(false);
  }, [isDesktop]);

  const activeItem = groups.flatMap((group) => group.items).find((item) => isItemActive(item, location.pathname));
  const sectionTitle = activeItem?.label ?? brandSubtitle;

  function skipToContent(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    mainRef.current?.focus();
    mainRef.current?.scrollIntoView({ block: "start" });
  }

  // Cerrado en móvil: fuera del orden de tabulación y del árbol de accesibilidad.
  const hiddenDrawerProps = isDrawer && !drawerOpen ? { inert: "", "aria-hidden": true as const } : {};
  const dialogProps = isModalOpen
    ? { role: "dialog", "aria-modal": true as const, "aria-label": "Menú", "data-ui-dialog": "" }
    : {};

  const userContent = (
    <>
      <span className="app-frame__avatar" aria-hidden="true">{user.initials}</span>
      <span className="app-frame__user-text">
        <strong>{user.name}</strong>
        {user.detail ? <small>{user.detail}</small> : null}
      </span>
    </>
  );

  return (
    <div className={`app-frame${isModalOpen ? " app-frame--drawer-open" : ""}`}>
      <a className="app-frame__skip" href="#contenido" onClick={skipToContent}>
        Saltar al contenido
      </a>

      <header className="app-frame__topbar">
        <Link to={homeTo} className="app-frame__topbar-brand" aria-label={`Inicio, ${brandSubtitle}`}>
          <BrandMark variant="mark" size="sm" />
        </Link>
        <span className="app-frame__topbar-title">{sectionTitle}</span>
        <button
          type="button"
          className="app-frame__menu-button"
          aria-expanded={isModalOpen}
          aria-controls={DRAWER_ID}
          aria-label="Abrir menú"
          onClick={() => setDrawerOpen(true)}
        >
          <Menu aria-hidden="true" focusable="false" />
        </button>
      </header>

      <div className="app-frame__overlay" hidden={!isModalOpen} onClick={closeDrawer} aria-hidden="true" />

      <aside
        id={DRAWER_ID}
        ref={sidebarRef}
        className="app-frame__sidebar"
        tabIndex={-1}
        {...dialogProps}
        {...hiddenDrawerProps}
      >
        <div className="app-frame__brand-row">
          <Link to={homeTo} className="app-frame__brand">
            <BrandMark tone="inverse" subtitle={brandSubtitle} />
          </Link>
          {isDrawer ? (
            <button
              type="button"
              className="app-frame__close-button"
              aria-label="Cerrar menú"
              onClick={closeDrawer}
              data-autofocus
            >
              <AppIcon name="close" />
            </button>
          ) : null}
        </div>

        <nav className="app-frame__nav" aria-label={navLabel}>
          {groups.map((group, groupIndex) => (
            <div className="app-frame__group" key={group.label ?? groupIndex}>
              {group.label ? <span className="app-frame__group-label">{group.label}</span> : null}
              <ul className="app-frame__list">
                {group.items.map((item) => {
                  const active = isItemActive(item, location.pathname);
                  const count = item.count ?? 0;
                  return (
                    <li key={item.to + item.label}>
                      <Link
                        to={item.to}
                        className={`app-frame__link${active ? " app-frame__link--active" : ""}`}
                        aria-current={active ? "page" : undefined}
                      >
                        <AppIcon name={item.icon} />
                        <span className="app-frame__link-label">{item.label}</span>
                        {count > 0 ? (
                          <>
                            <span className="app-frame__count" aria-hidden="true">
                              {count > 99 ? "99+" : count}
                            </span>
                            <span className="ui-sr-only">{`, ${item.countLabel ?? count}`}</span>
                          </>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="app-frame__footer">
          {user.to ? (
            <Link to={user.to} className="app-frame__user app-frame__user--link" aria-label={user.ariaLabel}>
              {userContent}
            </Link>
          ) : (
            <div className="app-frame__user">{userContent}</div>
          )}
          <button type="button" className="app-frame__logout" onClick={onLogout}>
            <AppIcon name="logout" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <main id="contenido" ref={mainRef} className="app-frame__main" tabIndex={-1}>
        <div className="app-frame__content">{children}</div>
      </main>
    </div>
  );
}
