import { Router } from "express";
import { requireTenantAuth } from "../middlewares/tenantAuth.middleware.js";
import {
  authenticateTenantUser,
  getTenantPortalPaymentDetail,
  getTenantPortalDashboard,
  getTenantPortalIntegrations,
  getTenantPortalReportsSummary,
  getTenantPortalReportsTimeseries,
  listTenantPortalPaymentsForExport,
  listTenantPortalPayments,
} from "../services/tenantPortal.service.js";
import { buildPaymentsCsv } from "../services/csvExport.service.js";
import { ensureInvoicePdfForPayment, getInvoicePdfFilename } from "../services/invoicePdf.service.js";
import { createTenantToken } from "../utils/tenantToken.js";
import { toBigIntId } from "../utils/bigint.js";

const router = Router();

function normalizeJsonBigInts(value) {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map(normalizeJsonBigInts);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, current]) => [key, normalizeJsonBigInts(current)])
  );
}

router.post("/auth/login", async (req, res) => {
  try {
    const tenantSlug = String(req.body.tenantSlug || "").trim().toLowerCase();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!tenantSlug) throw new Error("tenantSlug es obligatorio");
    if (!email) throw new Error("email es obligatorio");
    if (!password) throw new Error("password es obligatoria");

    const tenantUser = await authenticateTenantUser(tenantSlug, email, password);
    if (!tenantUser) {
      return res.status(401).json({ error: "Credenciales invalidas" });
    }

    const token = createTenantToken(tenantUser);
    return res.json(normalizeJsonBigInts({
      token,
      tenantUser,
    }));
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo iniciar sesion" });
  }
});

router.post("/auth/logout", (_req, res) => {
  return res.status(204).send();
});

router.get("/me", requireTenantAuth, (req, res) => {
  return res.json(normalizeJsonBigInts(req.tenantAuth.tenantUser));
});

router.use(requireTenantAuth);

router.get("/dashboard", async (req, res) => {
  try {
    const summary = await getTenantPortalDashboard(req.tenantAuth.tenantId);
    return res.json(normalizeJsonBigInts(summary));
  } catch (error) {
    return res.status(500).json({ error: error.message || "No se pudo obtener dashboard portal" });
  }
});

router.get("/payments", async (req, res) => {
  try {
    const payload = await listTenantPortalPayments(req.tenantAuth.tenantId, {
      page: req.query.page,
      pageSize: req.query.pageSize,
      status: req.query.status,
      provider: req.query.provider,
      search: req.query.search,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
    });

    return res.json(normalizeJsonBigInts(payload));
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudieron listar pagos" });
  }
});

router.get("/payments/export.csv", async (req, res) => {
  try {
    const payload = await listTenantPortalPaymentsForExport(req.tenantAuth.tenantId, {
      status: req.query.status,
      provider: req.query.provider,
      search: req.query.search,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
    });

    const csv = buildPaymentsCsv(payload.items, { includeTenant: false });
    const tenantSlug = req.tenantAuth.tenantUser.tenant?.slug || "tenant";

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="payments-${tenantSlug}.csv"`);
    res.setHeader("X-Export-Max-Rows", String(payload.exportInfo.maxRows));
    res.setHeader("X-Export-Truncated", String(payload.exportInfo.truncated));
    return res.status(200).send(csv);
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo exportar CSV" });
  }
});

router.get("/payments/:id", async (req, res) => {
  try {
    const paymentId = toBigIntId(req.params.id, "paymentId");
    const payment = await getTenantPortalPaymentDetail(req.tenantAuth.tenantId, paymentId);

    if (!payment) {
      return res.status(404).json({ error: "Pago no encontrado" });
    }

    return res.json(normalizeJsonBigInts(payment));
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo obtener el pago" });
  }
});

router.get("/payments/:id/pdf", async (req, res) => {
  try {
    const paymentId = toBigIntId(req.params.id, "paymentId");
    const { payment, filePath } = await ensureInvoicePdfForPayment(req.tenantAuth.tenantId, paymentId);
    const filename = getInvoicePdfFilename(payment);
    const asDownload = String(req.query.download || "false") === "true";

    if (asDownload) {
      return res.download(filePath, filename);
    }

    return res.sendFile(filePath, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo obtener el PDF" });
  }
});

router.get("/reports/summary", async (req, res) => {
  try {
    const summary = await getTenantPortalReportsSummary(req.tenantAuth.tenantId, {
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
    });

    return res.json(normalizeJsonBigInts(summary));
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo obtener resumen de reportes" });
  }
});

router.get("/reports/timeseries", async (req, res) => {
  try {
    const series = await getTenantPortalReportsTimeseries(req.tenantAuth.tenantId, {
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      granularity: req.query.granularity,
    });

    return res.json(normalizeJsonBigInts(series));
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo obtener serie temporal" });
  }
});

router.get("/integrations", async (req, res) => {
  try {
    const integrations = await getTenantPortalIntegrations(req.tenantAuth.tenantId);
    return res.json(normalizeJsonBigInts(integrations));
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudieron listar integraciones" });
  }
});

export default router;
