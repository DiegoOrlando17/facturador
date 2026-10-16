import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "@/components/brand/BrandMark";
import { BRAND } from "@/config/brand";
import { usePageTitle } from "@/hooks/usePageTitle";

type AuthLayoutProps = {
  /** Línea bajo el logo: "Portal del cliente", "Panel interno". */
  subtitle?: string;
  eyebrow?: ReactNode;
  /** Título de la tarjeta; también es el <h1> y el título de la pestaña. */
  title: string;
  description?: ReactNode;
  /** Contenido de marca al costado (en móvil va debajo del formulario). */
  aside?: ReactNode;
  /** Renglón final de la tarjeta, separado por una línea punteada. */
  footer?: ReactNode;
  /** Enlace "← Volver" arriba de la tarjeta. */
  backTo?: string;
  children?: ReactNode;
};

/** Pantallas públicas con formulario: ingresos, registro, verificación y contraseña. */
export function AuthLayout({ subtitle, eyebrow, title, description, aside, footer, backTo, children }: AuthLayoutProps) {
  usePageTitle(title);
  return (
    <main className={aside ? "auth-page" : "auth-page auth-page--solo"}>
      <div className="auth-page__brand">
        <Link to="/" aria-label={`${BRAND.name}, inicio`}>
          <BrandMark size="lg" subtitle={subtitle} />
        </Link>
      </div>

      {aside ? <section className="auth-page__aside">{aside}</section> : null}

      <section className="auth-page__main">
        <div className="auth-card">
          {backTo ? (
            <Link className="auth-card__back" to={backTo}>
              ← Volver
            </Link>
          ) : null}
          <header className="auth-card__heading">
            {eyebrow ? <p className="auth-card__eyebrow">{eyebrow}</p> : null}
            <h1>{title}</h1>
            {description ? <p className="auth-card__description">{description}</p> : null}
          </header>
          <div className="auth-card__body">{children}</div>
          {footer ? <div className="auth-card__footer">{footer}</div> : null}
        </div>
      </section>

      <footer className="auth-page__legal">
        <span>&copy; 2026 {BRAND.name}</span>
        <Link to="/terminos">Términos y condiciones</Link>
        <Link to="/privacidad">Política de privacidad</Link>
        <Link to="/arrepentimiento">Botón de arrepentimiento</Link>
      </footer>
    </main>
  );
}

type AuthAsideProps = {
  headline: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
};

/** Bloque de marca estándar del costado: titular grande, bajada y contenido extra. */
export function AuthAside({ headline, lead, children }: AuthAsideProps) {
  return (
    <>
      <p className="auth-aside__headline">{headline}</p>
      {lead ? <p className="auth-aside__lead">{lead}</p> : null}
      {children}
    </>
  );
}

/** Puntos clave del costado, como renglones de ticket. */
export function AuthPoints({ items }: { items: { title: string; text: string }[] }) {
  return (
    <ul className="auth-points">
      {items.map((item) => (
        <li key={item.title}>
          <strong>{item.title}</strong>
          <span>{item.text}</span>
        </li>
      ))}
    </ul>
  );
}
