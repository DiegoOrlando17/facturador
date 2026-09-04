import axios from "axios";
import { config } from "../config/index.js";
import { parseBnaUsdSellingRate } from "../domain/billingSubscription.js";

export async function getBnaUsdSellingRate() {
  const response = await axios.get(config.BILLING.BNA_URL, { timeout: 10000, responseType: "text", headers: { "User-Agent": "Facturador/1.0" } });
  return { rate: parseBnaUsdSellingRate(response.data), source: "BNA_BILLETE_VENDEDOR", quotedAt: new Date() };
}
