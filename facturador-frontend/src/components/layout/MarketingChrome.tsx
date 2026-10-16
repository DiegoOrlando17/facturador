import { Link } from "react-router-dom";
import { BrandMark } from "@/components/brand/BrandMark";
import { ButtonLink } from "@/components/ui/Button";
import { BRAND } from "@/config/brand";

type MarketingNavProps = {
  /** En la landing, "Cómo funciona" y "Planes" son anclas de la misma página. */
  showPlans?: boolean;
};

export function MarketingNav({ showPlans = false }: MarketingNavProps) {
  const anchor = (id: string) => (showPlans ? `#${id}` : `/#${id}`);
  return (
    <header className="marketing-header">
      <nav className="marketing-nav" aria-label="Principal">
        <Link to="/" className="marketing-brand" aria-label={`${BRAND.name}, inicio`}>
          <BrandMark />
        </Link>
        <div className="marketing-nav__links">
          <a className="marketing-nav__link" href={anchor("como-funciona")}>
            Cómo funciona
          </a>
          <a className="marketing-nav__link" href={anchor("planes")}>
            Planes
          </a>
          <Link className="marketing-nav__link" to="/tutoriales">
            Ayuda
          </Link>
          <Link className="marketing-nav__link marketing-nav-login" to="/portal-cliente/login">
            Ingresar
          </Link>
          <ButtonLink to="/registro" variant="accent" className="marketing-nav__cta">
            Crear mi cuenta
          </ButtonLink>
        </div>
      </nav>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="marketing-footer">
      <div className="marketing-footer__inner">
        <span className="marketing-footer__brand">
          <BrandMark size="sm" />
          <span>© 2026 {BRAND.name}</span>
        </span>
        <nav className="marketing-footer__links" aria-label="Legales y ayuda">
          <Link to="/tutoriales">Centro de ayuda</Link>
          <Link to="/terminos">Términos y condiciones</Link>
          <Link to="/privacidad">Política de privacidad</Link>
          <Link to="/arrepentimiento">Botón de arrepentimiento</Link>
          <a href={`mailto:${BRAND.supportEmail}`}>Contacto</a>
        </nav>
      </div>
    </footer>
  );
}
