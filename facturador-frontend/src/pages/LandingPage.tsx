import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MarketingFooter, MarketingNav } from "@/components/layout/MarketingChrome";
import { apiRequest } from "@/lib/api";

type Plan = {
  code: string;
  name: string;
  description: string | null;
  price: number | null;
  currency: string;
  policy: { entitlements?: Record<string, boolean> };
};

const featureLabels: Record<string, string> = {
  automaticInvoicing: "Facturación automática desde Mercado Pago POS",
  pdfDownload: "Descarga de comprobantes PDF",
  clientApproval: "Confirmación y emisión diferida",
  creditNotes: "Notas de crédito",
  manualInvoicing: "Facturación manual",
  googleDriveSheets: "Google Drive y Sheets",
  ocrImport: "Carga asistida con OCR",
};

function formatPlanPrice(plan: Plan) {
  if (plan.price == null) return "Precio a confirmar";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: plan.currency }).format(plan.price);
}

export function LandingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    void apiRequest<{ items: Plan[] }>("/public/plans")
      .then((value) => setPlans(value.items))
      .catch(() => setPlans([]));
  }, []);

  return (
    <main className="marketing-page">
      <MarketingNav showPlans />

      <section className="marketing-hero">
        <div>
          <span className="eyebrow">Facturación argentina, sin trabajo repetitivo</span>
          <h1>De Mercado Pago POS a ARCA, con control y trazabilidad.</h1>
          <p>
            Automatizá comprobantes, revisá excepciones y entregá PDFs desde un portal preparado para cada etapa de tu
            negocio.
          </p>
          <div className="marketing-actions">
            <Link className="primary-button" to="/registro">
              Crear mi cuenta
            </Link>
            <a className="secondary-button" href="#como-funciona">
              Cómo funciona
            </a>
          </div>
        </div>
        <aside>
          <strong>Un flujo ordenado</strong>
          <ol>
            <li>Detectamos tus ventas POS.</li>
            <li>Emitimos o te pedimos confirmación.</li>
            <li>Generamos el PDF y registramos cada resultado.</li>
          </ol>
        </aside>
      </section>

      <section id="como-funciona" className="marketing-section">
        <span className="eyebrow">Todo en un mismo lugar</span>
        <h2>Crecé desde la automatización esencial hasta operaciones avanzadas.</h2>
        <div className="marketing-benefits">
          <article>
            <h3>Separado por empresa</h3>
            <p>Credenciales, usuarios y datos aislados para cada empresa.</p>
          </article>
          <article>
            <h3>Operable</h3>
            <p>Estados, errores y reintentos visibles, sin perder trazabilidad.</p>
          </article>
          <article>
            <h3>Flexible</h3>
            <p>Procesamiento inmediato, programado o con confirmación, según el plan.</p>
          </article>
        </div>
      </section>

      <section id="planes" className="marketing-section">
        <span className="eyebrow">Planes</span>
        <h2>Elegí el nivel de automatización que necesitás.</h2>
        <div className="marketing-plans">
          {plans.length ? (
            plans.map((plan) => (
              <article key={plan.code}>
                <span>{plan.code.replace("TIER_", "Nivel ")}</span>
                <h3>{plan.name}</h3>
                <strong>{formatPlanPrice(plan)}</strong>
                <p>{plan.description}</p>
                <ul>
                  {Object.entries(plan.policy.entitlements || {})
                    .filter(([, enabled]) => enabled)
                    .map(([key]) => (featureLabels[key] ? <li key={key}>{featureLabels[key]}</li> : null))}
                </ul>
                <Link className="secondary-button" to={`/registro?plan=${plan.code}`}>
                  Elegir plan
                </Link>
              </article>
            ))
          ) : (
            <p>Estamos cargando los planes disponibles.</p>
          )}
        </div>
      </section>

      <section className="marketing-section">
        <span className="eyebrow">Preguntas frecuentes</span>
        <h2>Lo importante antes de empezar.</h2>
        <div className="marketing-benefits">
          <article>
            <h3>¿Empieza a facturar en producción apenas me registro?</h3>
            <p>No. Primero revisamos el perfil fiscal y las integraciones; la habilitación queda auditada.</p>
          </article>
          <article>
            <h3>¿Puedo descargar los comprobantes?</h3>
            <p>Sí. Todos los planes incluyen el PDF de cada comprobante emitido.</p>
          </article>
          <article>
            <h3>¿Tengo que compartir contraseñas?</h3>
            <p>No. El onboarding no te pide contraseñas, tokens ni certificados por texto libre.</p>
          </article>
        </div>
      </section>

      <section className="marketing-cta">
        <h2>Empezá con una cuenta preparada para tu empresa.</h2>
        <p>El alta crea tu espacio y te guía por la configuración fiscal y las integraciones.</p>
        <Link className="primary-button" to="/registro">
          Registrarme
        </Link>
      </section>

      <MarketingFooter />
    </main>
  );
}
