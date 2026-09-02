import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { requireAdminPermission } from "../src/middlewares/adminAuth.middleware.js";
import { createAdminPaymentActionsRouter } from "../src/routes/adminPaymentActions.routes.js";

const ADMIN_USER = Object.freeze({ id: "7", role: "OPERATOR", email: "operator@example.test" });

async function withTestApi(dependencies, callback) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const role = req.headers["x-test-admin-role"];
    if (role) req.adminAuth = { adminUser: { ...ADMIN_USER, role } };
    next();
  });
  app.use("/admin", createAdminPaymentActionsRouter({
    requireAdminPermission,
    ...dependencies,
  }));

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });

  try {
    const { port } = server.address();
    await callback(`http://127.0.0.1:${port}/admin`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function createDependencies(overrides = {}) {
  return {
    getAdminPaymentDetail: async (paymentId) => ({ id: paymentId, tenantId: 11n }),
    reprocessPaymentAsAdmin: async (_payment, _admin, step) => ({ queued: true, step, jobId: 99n }),
    deliverPaymentToGoogleAsAdmin: async () => ({ queued: true, jobId: 100n }),
    issuePaymentAsAdmin: async () => ({ queued: true, step: "afip" }),
    cancelInvoiceAsAdmin: async () => ({ queued: true, creditNoteId: 200n, status: "QUEUED" }),
    ...overrides,
  };
}

async function post(baseUrl, path, { role = "OPERATOR", body } = {}) {
  const headers = {};
  if (role) headers["x-test-admin-role"] = role;
  if (body !== undefined) headers["content-type"] = "application/json";

  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  return { response, json: await response.json() };
}

test("endpoints administrativos de pagos exigen permiso de operacion", async () => {
  await withTestApi(createDependencies(), async (baseUrl) => {
    for (const path of ["/payments/1/reprocess", "/payments/1/deliver-google"]) {
      const missingAuth = await post(baseUrl, path, { role: null });
      assert.equal(missingAuth.response.status, 403);
      assert.equal(missingAuth.json.error, "Permiso admin insuficiente");

      const viewer = await post(baseUrl, path, { role: "VIEWER" });
      assert.equal(viewer.response.status, 403);
      assert.equal(viewer.json.error, "Permiso admin insuficiente");
    }
  });
});

test("emision y anulacion administrativa requieren permiso y confirmacion explicita", async () => {
  await withTestApi(createDependencies(), async (baseUrl) => {
    const issue = await post(baseUrl, "/payments/12/issue");
    assert.equal(issue.response.status, 202);
    assert.equal(issue.json.step, "afip");

    const missingConfirmation = await post(baseUrl, "/payments/12/credit-note", { body: {} });
    assert.equal(missingConfirmation.response.status, 400);
    assert.match(missingConfirmation.json.error, /ANULAR/);

    const cancellation = await post(baseUrl, "/payments/12/credit-note", { body: { confirmation: "ANULAR" } });
    assert.equal(cancellation.response.status, 202);
    assert.equal(cancellation.json.creditNoteId, "200");

    const viewer = await post(baseUrl, "/payments/12/credit-note", { role: "VIEWER", body: { confirmation: "ANULAR" } });
    assert.equal(viewer.response.status, 403);
  });
});

test("reprocess valida ID, existencia y normaliza el paso solicitado", async () => {
  const calls = [];
  const dependencies = createDependencies({
    getAdminPaymentDetail: async (paymentId) => paymentId === 404n ? null : { id: paymentId, tenantId: 11n },
    reprocessPaymentAsAdmin: async (payment, admin, step) => {
      calls.push({ payment, admin, step });
      return { queued: true, step, jobId: 99n };
    },
  });

  await withTestApi(dependencies, async (baseUrl) => {
    const invalid = await post(baseUrl, "/payments/not-a-number/reprocess");
    assert.equal(invalid.response.status, 400);
    assert.match(invalid.json.error, /paymentId invalido/);

    const missing = await post(baseUrl, "/payments/404/reprocess");
    assert.equal(missing.response.status, 404);
    assert.equal(missing.json.error, "Pago no encontrado");

    const accepted = await post(baseUrl, "/payments/12/reprocess", { body: { step: "  GOOGLE  " } });
    assert.equal(accepted.response.status, 202);
    assert.deepEqual(accepted.json, {
      ok: true,
      paymentId: "12",
      tenantId: "11",
      queued: true,
      step: "google",
      jobId: "99",
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].payment.id, 12n);
    assert.equal(calls[0].admin.role, "OPERATOR");
    assert.equal(calls[0].step, "google");
  });
});

test("reprocess devuelve de forma segura los rechazos del servicio", async () => {
  const dependencies = createDependencies({
    reprocessPaymentAsAdmin: async () => {
      throw new Error("No se puede reemitir ARCA para una factura ya emitida");
    },
  });

  await withTestApi(dependencies, async (baseUrl) => {
    const result = await post(baseUrl, "/payments/12/reprocess", { body: { step: "arca" } });
    assert.equal(result.response.status, 400);
    assert.equal(result.json.error, "No se puede reemitir ARCA para una factura ya emitida");
  });
});

test("deliver-google diferencia entrega encolada de entrega ya completa", async () => {
  let queued = true;
  const dependencies = createDependencies({
    deliverPaymentToGoogleAsAdmin: async (payment, admin) => ({
      queued,
      alreadyDelivered: !queued,
      paymentSeen: payment.id,
      adminSeen: admin.id,
    }),
  });

  await withTestApi(dependencies, async (baseUrl) => {
    const accepted = await post(baseUrl, "/payments/13/deliver-google");
    assert.equal(accepted.response.status, 202);
    assert.equal(accepted.json.paymentSeen, "13");
    assert.equal(accepted.json.adminSeen, "7");

    queued = false;
    const complete = await post(baseUrl, "/payments/13/deliver-google");
    assert.equal(complete.response.status, 200);
    assert.equal(complete.json.alreadyDelivered, true);
  });
});
