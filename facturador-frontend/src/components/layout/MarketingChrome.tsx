import { Link } from "react-router-dom";

type MarketingNavProps = {
  showPlans?: boolean;
};

export function MarketingNav({ showPlans = false }: MarketingNavProps) {
  return (
    <nav className="marketing-nav" aria-label="Principal">
      <Link to="/" className="marketing-brand">
        Facturador
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
      <span>Facturador</span>
      <Link to="/tutoriales">Centro de ayuda</Link>
      <Link to="/terminos">Términos y condiciones</Link>
      <Link to="/privacidad">Política de privacidad</Link>
      <Link to="/arrepentimiento">Botón de arrepentimiento</Link>
      <a href="mailto:contacto@facturador.app">Contacto</a>
    </footer>
  );
}
