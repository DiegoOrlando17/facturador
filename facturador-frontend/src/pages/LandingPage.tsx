import { useEffect, useState } from "react";
import { MarketingFooter, MarketingNav } from "@/components/layout/MarketingChrome";
import { ButtonLink } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import { Stamp, Ticket, TicketDivider, TicketRow, TicketRows } from "@/components/ui/Ticket";
import { BRAND } from "@/config/brand";
import { usePageTitle } from "@/hooks/usePageTitle";
import { apiRequest } from "@/lib/api";
import { formatNumber } from "@/lib/formatters";
import { enabledPlanFeatures as enabledFeatures, isMonthlyPlan, PLAN_BILLING_NOTE, planFeatureLabel, type PublicPlan as Plan } from "@/lib/publicPlans";

function tierLabel(plan: Plan, index: number) {
  const tier = plan.policy.tier ?? (Number(plan.code.replace(/\D+/g, "")) || index + 1);
  return `Nivel ${tier}`;
}

function PlanPrice({ plan }: { plan: Plan }) {
  if (plan.price == null) return <p className="marketing-plan__price marketing-plan__price--tbd">Precio a confirmar</p>;
  const amount = plan.currency === "ARS" ? <Money value={plan.price} decimals={0} /> : `${plan.currency} ${formatNumber(plan.price)}`;
  return (
    <p className="marketing-plan__price">
      <span className="marketing-plan__amount">{amount}</span>
      {isMonthlyPlan(plan) ? <span className="marketing-plan__cycle"> /mes</span> : null}
    </p>
  );
}

const HERO_ITEMS = [
  { label: "2 × Alfajor triple", amount: 3200 },
  { label: "1 × Gaseosa 1,5 l", amount: 2650 },
  { label: "1 × Yerba 1 kg", amount: 4900 },
];

export function LandingPage() {
  usePageTitle(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansState, setPlansState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    void apiRequest<{ items: Plan[] }>("/public/plans")
      .then((value) => {
        setPlans(value.items);
        setPlansState("ready");
      })
      .catch(() => {
        setPlans([]);
        setPlansState("error");
      });
  }, []);

  return (
    <main className="marketing-page">
      <MarketingNav showPlans />

      <section className="marketing-hero">
        <div className="marketing-hero__copy">
          <span className="marketing-kicker">Facturación electrónica para comercios</span>
          <h1>
            Vendés con Mercado Pago. <span className="marketing-hero__accent">La factura sale sola.</span>
          </h1>
          <p className="marketing-hero__lead">
            {BRAND.name} lee los cobros de tu caja de Mercado Pago, emite el comprobante en ARCA y te deja el PDF listo.
            Vos atendés el mostrador.
          </p>
          <div className="marketing-actions">
            <ButtonLink to="/registro" variant="accent" size="lg">
              Crear mi cuenta
            </ButtonLink>
            <ButtonLink href="#como-funciona" variant="secondary" size="lg">
              Ver cómo funciona
            </ButtonLink>
          </div>
        </div>

        <figure className="marketing-hero__visual" aria-label="Ejemplo de una factura emitida con su CAE">
          <p className="marketing-hero__toast" aria-hidden="true">
            <span className="marketing-hero__toast-dot" />
            Venta detectada · Mercado Pago · 10:42
          </p>
          <Ticket
            as="div"
            className="marketing-hero__ticket"
            padding="lg"
            eyebrow={
              <>
                <span>Factura C</span>
                <span>00003-00001842</span>
              </>
            }
            stamp={<Stamp size="lg" sublabel="15/10/2026" />}
          >
            <p className="marketing-hero__shop">Kiosco Don Luis</p>
            <TicketDivider />
            <TicketRows>
              {HERO_ITEMS.map((item) => (
                <TicketRow key={item.label} label={item.label} value={<Money value={item.amount} />} />
              ))}
              <TicketRow label="Total" value={<Money value={10750} />} emphasis />
            </TicketRows>
            <p className="marketing-hero__cae">
              <span>CAE 75412345678901</span>
              <span>Vto. 25/10/2026</span>
            </p>
          </Ticket>
        </figure>
      </section>

      <section className="marketing-strip" aria-label="Integraciones">
        <div className="marketing-strip__inner">
          <span className="marketing-strip__label">Funciona con</span>
          <ul>
            <li>Mercado Pago</li>
            <li>ARCA</li>
            <li>Google Drive</li>
            <li>Google Sheets</li>
          </ul>
        </div>
      </section>

      <section id="como-funciona" className="marketing-section" aria-labelledby="como-funciona-titulo">
        <header className="marketing-section__header">
          <span className="marketing-kicker marketing-kicker--accent">Cómo funciona</span>
          <h2 id="como-funciona-titulo">Del cobro al comprobante, sin tocar nada.</h2>
        </header>
        <ol className="marketing-steps">
          <li>
            <Ticket as="div" padding="lg" className="marketing-step">
              <span className="marketing-step__number" aria-hidden="true">01</span>
              <h3>Detectamos la venta</h3>
              <p>Leemos cada cobro de tu caja de Mercado Pago, al instante o en los horarios que elijas.</p>
            </Ticket>
          </li>
          <li>
            <Ticket as="div" padding="lg" className="marketing-step">
              <span className="marketing-step__number" aria-hidden="true">02</span>
              <h3>Emitimos en ARCA</h3>
              <p>Automático, o esperando tu confirmación si preferís revisar antes. Cada comprobante sale con su CAE.</p>
            </Ticket>
          </li>
          <li>
            <Ticket as="div" padding="lg" className="marketing-step">
              <span className="marketing-step__number" aria-hidden="true">03</span>
              <h3>Te queda el PDF</h3>
              <p>Descargalo cuando quieras. Según tu plan, también queda en tu Google Drive con una planilla al día para tu contador.</p>
            </Ticket>
          </li>
        </ol>
      </section>

      <section id="planes" className="marketing-plans-band" aria-labelledby="planes-titulo">
        <div className="marketing-plans-band__inner">
          <header className="marketing-plans-band__header">
            <div>
              <span className="marketing-kicker marketing-kicker--inverse">Planes</span>
              <h2 id="planes-titulo">Elegí cuánto querés automatizar.</h2>
            </div>
            <p>{PLAN_BILLING_NOTE}</p>
          </header>

          {plansState === "ready" && plans.length ? (
            <ul className="marketing-plans">
              {plans.map((plan, index) => {
                const previous = index > 0 ? plans[index - 1] : undefined;
                const previousFeatures = new Set(enabledFeatures(previous));
                const features = enabledFeatures(plan).filter((key) => !previousFeatures.has(key));
                return (
                  <li key={plan.code}>
                    <Ticket as="article" className="marketing-plan" eyebrow={tierLabel(plan, index)} title={plan.name}>
                      <PlanPrice plan={plan} />
                      <TicketDivider />
                      {previous ? <p className="marketing-plan__includes">Todo {previous.name}, más:</p> : null}
                      <ul className="marketing-plan__features">
                        {features.map((key) => (
                          <li key={key}>{planFeatureLabel(key)}</li>
                        ))}
                      </ul>
                      <ButtonLink to={`/registro?plan=${plan.code}`} variant="secondary" fullWidth aria-label={`Elegir el plan ${plan.name}`}>
                        Elegir plan
                      </ButtonLink>
                    </Ticket>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="marketing-plans-band__status" role="status">
              {plansState === "error" ? "No pudimos cargar los planes. Recargá la página para verlos." : "Cargando planes…"}
            </p>
          )}
        </div>
      </section>

      <section className="marketing-section marketing-faq" aria-labelledby="preguntas-titulo">
        <header className="marketing-section__header">
          <span className="marketing-kicker marketing-kicker--accent">Preguntas</span>
          <h2 id="preguntas-titulo">Lo que todos preguntan.</h2>
        </header>
        <div className="marketing-faq__list">
          <article>
            <h3>¿Empiezo a facturar apenas me registro?</h3>
            <p>No. Primero revisamos tus datos fiscales y las conexiones; cuando está todo bien, te habilitamos.</p>
          </article>
          <article>
            <h3>¿Tengo que pasarles contraseñas?</h3>
            <p>Nunca. La puesta en marcha no te pide contraseñas ni claves por texto libre, y las credenciales se guardan cifradas.</p>
          </article>
          <article>
            <h3>¿Puedo descargar los comprobantes?</h3>
            <p>Sí. Todos los planes incluyen el PDF de cada comprobante emitido.</p>
          </article>
          <article>
            <h3>¿Y si una factura sale mal?</h3>
            <p>Desde el plan Control, la anulás con una nota de crédito desde el portal.</p>
          </article>
        </div>
      </section>

      <section className="marketing-cta" aria-labelledby="cta-titulo">
        <div className="marketing-cta__band">
          <h2 id="cta-titulo">{BRAND.tagline}</h2>
          <ButtonLink to="/registro" variant="secondary" size="lg">
            Crear mi cuenta
          </ButtonLink>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
