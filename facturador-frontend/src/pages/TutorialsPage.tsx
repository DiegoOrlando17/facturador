import { MarketingFooter, MarketingNav } from "@/components/layout/MarketingChrome";
import { ButtonLink } from "@/components/ui/Button";
import { Ticket } from "@/components/ui/Ticket";

const guides = [
  {
    title: "Conectar Mercado Pago",
    steps: [
      "Identificá la caja (POS) de Mercado Pago que recibe las ventas.",
      "Generá una credencial de lectura para la cuenta correcta.",
      "Cargá la configuración desde Integraciones y ejecutá la prueba.",
    ],
  },
  {
    title: "Preparar ARCA",
    steps: [
      "Habilitá los comprobantes electrónicos y el punto de venta.",
      "Generá el certificado y la clave para el ambiente correspondiente.",
      "Completá tus datos fiscales y pedí su revisión.",
    ],
  },
  {
    title: "Configurar Drive y Sheets",
    steps: [
      "Conectá tu cuenta de Google desde Integraciones.",
      "Elegí una carpeta y una planilla a las que tengas acceso.",
      "Ejecutá ambas pruebas antes de procesar ventas.",
    ],
  },
  {
    title: "Completar la puesta en marcha",
    steps: [
      "Completá los datos fiscales obligatorios.",
      "Conectá y probá las integraciones de tu plan.",
      "Enviá la información a revisión y esperá la aprobación.",
    ],
  },
];

export function TutorialsPage() {
  return (
    <main className="marketing-page">
      <MarketingNav />
      <section className="tutorial-hero">
        <span className="marketing-kicker marketing-kicker--accent">Centro de ayuda</span>
        <h1>Todo lo necesario para empezar a facturar.</h1>
        <p>Guías cortas para preparar tus cuentas sin compartir datos sensibles por canales inseguros.</p>
      </section>
      <ul className="tutorial-grid">
        {guides.map((guide, index) => (
          <li key={guide.title}>
            <Ticket as="article" padding="lg" eyebrow={`Guía ${String(index + 1).padStart(2, "0")}`} title={guide.title}>
              <ol className="tutorial-steps">
                {guide.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </Ticket>
          </li>
        ))}
      </ul>
      <section className="marketing-cta" aria-labelledby="tutoriales-cta">
        <div className="marketing-cta__band">
          <h2 id="tutoriales-cta">¿Ya tenés todo a mano?</h2>
          <ButtonLink to="/registro" variant="secondary" size="lg">
            Crear mi cuenta
          </ButtonLink>
        </div>
      </section>
      <MarketingFooter />
    </main>
  );
}
