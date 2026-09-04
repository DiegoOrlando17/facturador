export function mapMercadoPagoSubscriptionStatus(status) {
  const value = String(status || "").toLowerCase();
  if (value === "authorized") return "ACTIVE";
  if (value === "cancelled" || value === "canceled") return "CANCELED";
  return "PAST_DUE";
}

export function calculateArsAmount(usdAmount, sellingRate) {
  const usd = Number(usdAmount); const rate = Number(sellingRate);
  if (!Number.isFinite(usd) || usd <= 0 || !Number.isFinite(rate) || rate <= 0) throw new Error("No se pudo calcular el importe de la suscripcion");
  return Math.round(usd * rate * 100) / 100;
}

export function parseBnaUsdSellingRate(html) {
  const text = String(html || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ");
  const match = text.match(/Dolar\s+U\.S\.A[\s\S]{0,120}?(\d[\d.,]*)\s+(\d[\d.,]*)/i);
  if (!match) throw new Error("No se encontro la cotizacion vendedor USD en Banco Nacion");
  const normalized = match[2].includes(",") ? match[2].replace(/\./g, "").replace(",", ".") : match[2];
  const rate = Number(normalized);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error("Cotizacion Banco Nacion invalida");
  return rate;
}
