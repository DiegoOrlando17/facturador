import { Link } from "react-router-dom";
import { BrandMark } from "@/components/brand/BrandMark";
import { BRAND } from "@/config/brand";

type MarketingNavProps = {
  showPlans?: boolean;
};

export function MarketingNav({ showPlans = false }: MarketingNavProps) {
  return (
    <nav className="marketing-nav" aria-label="Principal">
      <Link to="/" className="marketing-brand" aria-label={`${BRAND.name}, inicio`}>
        <BrandMark />
      </Link>
      <div>
        {showPlans ? <a href="#planes">Planes</a> : null}
        <Link to="/tutoriales">Tutoriales</Link>
        <Link className="marketing-nav-login" to="/portal-cliente/login">
          Ingresar
        </Link>
        <Link className="primary-button" to="/registro">
          Comenzar
        </Link>
      </div>
    </nav>
  );
}

export function MarketingFooter() {
  return (
    <footer className="marketing-footer">
      <BrandMark size="sm" />
      <Link to="/tutoriales">Centro de ayuda</Link>
      <Link to="/terminos">Términos y condiciones</Link>
      <Link to="/privacidad">Política de privacidad</Link>
      <Link to="/arrepentimiento">Botón de arrepentimiento</Link>
      <a href={`mailto:${BRAND.supportEmail}`}>Contacto</a>
    </footer>
  );
}
