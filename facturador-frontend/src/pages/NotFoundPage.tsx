import { Link, isRouteErrorResponse, useRouteError } from "react-router-dom";

type ErrorScreenProps = {
  eyebrow: string;
  title: string;
  description: string;
};

function ErrorScreen({ eyebrow, title, description }: ErrorScreenProps) {
  return (
    <main className="not-found-page">
      <section className="not-found-card">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
        <div className="public-form-actions">
          <Link className="primary-button" to="/">
            Ir al inicio
          </Link>
          <Link className="secondary-button" to="/portal-cliente">
            Portal del cliente
          </Link>
          <Link className="secondary-button" to="/admin">
            Panel de administración
          </Link>
        </div>
      </section>
    </main>
  );
}

export function NotFoundPage() {
  return (
    <ErrorScreen
      eyebrow="Error 404"
      title="No encontramos esta página"
      description="Puede que el enlace esté mal escrito o que la página ya no exista. Elegí a dónde querés ir."
    />
  );
}

/** Se usa como errorElement del router: cubre rutas inexistentes y errores al renderizar. */
export function RouteErrorPage() {
  const error = useRouteError();

  if (isRouteErrorResponse(error) && error.status === 404) {
    return <NotFoundPage />;
  }

  if (import.meta.env.DEV) {
    console.error(error);
  }

  return (
    <ErrorScreen
      eyebrow="Algo salió mal"
      title="No pudimos mostrar esta página"
      description="Tuvimos un problema inesperado. Recargá la página o volvé a intentarlo en unos minutos."
    />
  );
}
