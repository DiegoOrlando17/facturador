import { Link } from "react-router-dom";
import { MarketingFooter, MarketingNav } from "@/components/layout/MarketingChrome";

const guides = [
  {
    title: "Conectar Mercado Pago POS",
    steps: [
      "Identificá el Point/POS que recibe las ventas.",
      "Generá una credencial de lectura para la cuenta correcta.",
      "Cargá la configuración desde Integraciones y ejecutá la prueba.",
    ],
  },
  {
    title: "Preparar ARCA",
    steps: [
      "Habilitá los comprobantes electrónicos y el punto de venta.",
      "Generá el certificado y la clave para el ambiente correspondiente.",
      "Completá el perfil fiscal y pedí su revisión.",
    ],
  },
  {
    title: "Configurar Drive y Sheets",
    steps: [
      "Autorizá la cuenta de Google desde Integraciones.",
      "Elegí una carpeta y una planilla accesibles.",
      "Ejecutá ambas pruebas antes de procesar ventas.",
    ],
  },
  {
    title: "Completar el onboarding",
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
        <span className="eyebrow">Centro de ayuda</span>
        <h1>Todo lo necesario para empezar a facturar.</h1>
        <p>Guías breves para preparar tus cuentas sin compartir datos sensibles por canales inseguros.</p>
      </section>
      <section className="tutorial-grid">
        {guides.map((guide, index) => (
          <article key={guide.title}>
            <span>Guía {index + 1}</span>
            <h2>{guide.title}</h2>
            <ol>
              {guide.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </article>
        ))}
      </section>
      <section className="marketing-cta">
        <h2>¿Ya tenés la información preparada?</h2>
        <Link className="primary-button" to="/registro">
          Crear cuenta
        </Link>
      </section>
      <MarketingFooter />
    </main>
  );
}
