import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { MarketingFooter, MarketingNav } from "@/components/layout/MarketingChrome";
import { BRAND } from "@/config/brand";
import { usePageTitle } from "@/hooks/usePageTitle";

type LegalSection = { title: string; body: ReactNode };

type LegalDocument = {
  eyebrow: string;
  title: string;
  intro: string;
  sections: LegalSection[];
};

const CONTACT_EMAIL = BRAND.contactEmail;

const documents: Record<"terms" | "privacy" | "withdrawal", LegalDocument> = {
  terms: {
    eyebrow: "Legal",
    title: "Términos y condiciones",
    intro:
      `Estos términos regulan el uso de ${BRAND.name}, el servicio que toma tus ventas de Mercado Pago POS y emite los comprobantes electrónicos correspondientes ante ARCA.`,
    sections: [
      {
        title: "1. Aceptación",
        body: "Al crear una cuenta o usar el servicio aceptás estos términos. Si los usás en nombre de una empresa, declarás que tenés facultades para obligarla.",
      },
      {
        title: "2. El servicio",
        body: `${BRAND.name} automatiza la lectura de ventas, la emisión de comprobantes y la generación de PDFs según el plan contratado. La habilitación para operar en producción está sujeta a la revisión del perfil fiscal y de las integraciones.`,
      },
      {
        title: "3. Responsabilidades de tu empresa",
        body: `Sos responsable de la exactitud de tus datos fiscales, de mantener vigentes tus credenciales y certificados, y de revisar los comprobantes emitidos. ${BRAND.name} no reemplaza el asesoramiento contable ni impositivo.`,
      },
      {
        title: "4. Planes, precios y pagos",
        body: "Los precios de cada plan se informan antes de contratar. La suscripción se cobra por adelantado mediante el medio de pago que elijas. Podés cancelarla en cualquier momento desde el portal.",
      },
      {
        title: "5. Disponibilidad",
        body: "Trabajamos para que el servicio esté disponible de forma continua, pero puede haber interrupciones por mantenimiento o por fallas de terceros (Mercado Pago, ARCA, Google).",
      },
      {
        title: "6. Baja y arrepentimiento",
        body: (
          <>
            Podés dar de baja el servicio cuando quieras. Dentro de los 10 días corridos desde la contratación podés
            revocar la aceptación sin costo desde el <Link to="/arrepentimiento">Botón de arrepentimiento</Link>.
          </>
        ),
      },
      {
        title: "7. Contacto",
        body: `Para consultas sobre estos términos escribinos a ${CONTACT_EMAIL}.`,
      },
    ],
  },
  privacy: {
    eyebrow: "Legal",
    title: "Política de privacidad",
    intro:
      "Esta política explica qué datos tratamos, para qué los usamos y cómo podés ejercer tus derechos, en el marco de la Ley 25.326 de Protección de Datos Personales.",
    sections: [
      {
        title: "1. Datos que recolectamos",
        body: "Datos de la cuenta (nombre comercial, email y usuarios), datos fiscales de tu empresa, información de las ventas que leemos de Mercado Pago y los comprobantes emitidos.",
      },
      {
        title: "2. Para qué los usamos",
        body: "Para prestar el servicio: emitir comprobantes, generar PDFs, avisarte sobre el estado de tu cuenta y brindarte soporte. No vendemos tus datos.",
      },
      {
        title: "3. Credenciales e integraciones",
        body: "Las credenciales de Mercado Pago, ARCA y Google se guardan cifradas y se usan solo para operar las integraciones que configuraste.",
      },
      {
        title: "4. Con quién los compartimos",
        body: "Con los proveedores necesarios para prestar el servicio (por ejemplo ARCA, Mercado Pago, Google y nuestro proveedor de email), y con autoridades cuando la ley lo exija.",
      },
      {
        title: "5. Conservación",
        body: "Conservamos los datos mientras tu cuenta esté activa y durante los plazos que exige la normativa fiscal.",
      },
      {
        title: "6. Tus derechos",
        body: `Podés pedir acceso, rectificación o supresión de tus datos escribiendo a ${CONTACT_EMAIL}. La Agencia de Acceso a la Información Pública es el órgano de control de la Ley 25.326.`,
      },
    ],
  },
  withdrawal: {
    eyebrow: "Defensa del consumidor",
    title: "Botón de arrepentimiento",
    intro:
      `Si contrataste ${BRAND.name} a distancia, tenés derecho a revocar la aceptación dentro de los 10 días corridos desde la contratación, sin costo y sin necesidad de explicar el motivo (Resolución 424/2020 de la Secretaría de Comercio Interior).`,
    sections: [
      {
        title: "Cómo pedirlo",
        body: `Escribinos a ${CONTACT_EMAIL} con el asunto "Arrepentimiento", indicando el identificador de tu empresa y el email de la cuenta. No necesitás iniciar sesión para hacerlo.`,
      },
      {
        title: "Qué pasa después",
        body: "Dentro de las 24 horas te enviamos un código de identificación del trámite. Cancelamos la suscripción y, si corresponde, te devolvemos lo que hayas pagado por el mismo medio de pago.",
      },
      {
        title: "Fuera del plazo de 10 días",
        body: "Podés cancelar la suscripción en cualquier momento desde el portal del cliente, en la sección Suscripción.",
      },
    ],
  },
};

export function LegalPage({ document }: { document: keyof typeof documents }) {
  const content = documents[document];
  usePageTitle(content.title);

  return (
    <main className="marketing-page">
      <MarketingNav />
      <article className="legal-page">
        <span className="eyebrow">{content.eyebrow}</span>
        <h1>{content.title}</h1>
        <p className="legal-draft-note" role="note">
          <strong>Texto provisorio.</strong> Este contenido es un modelo genérico de referencia y todavía no fue revisado
          por un profesional. No constituye la versión definitiva.
        </p>
        <p>{content.intro}</p>
        {content.sections.map((section) => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </section>
        ))}
        <nav className="legal-nav" aria-label="Documentos legales">
          <Link to="/terminos">Términos y condiciones</Link>
          <Link to="/privacidad">Política de privacidad</Link>
          <Link to="/arrepentimiento">Botón de arrepentimiento</Link>
        </nav>
      </article>
      <MarketingFooter />
    </main>
  );
}

export function TermsPage() {
  return <LegalPage document="terms" />;
}

export function PrivacyPage() {
  return <LegalPage document="privacy" />;
}

export function WithdrawalPage() {
  return <LegalPage document="withdrawal" />;
}
