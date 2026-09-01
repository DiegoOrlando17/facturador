import test from "node:test";
import assert from "node:assert/strict";
import { requestGoogleAccessToken, sanitizeGoogleTokenError } from "../src/services/googleToken.service.js";

test("el refresh Google envia secretos en el cuerpo y no en la URL", async () => {
  let request;
  const httpClient = {
    post: async (url, body, options) => {
      request = { url, body, options };
      return { data: { access_token: "access-token" } };
    },
  };

  await requestGoogleAccessToken({
    clientId: "client-id",
    clientSecret: "client-secret",
    refreshToken: "refresh-token",
  }, { httpClient });

  assert.equal(request.url, "https://oauth2.googleapis.com/token");
  assert.equal(request.url.includes("client-secret"), false);
  assert.match(request.body, /client_secret=client-secret/);
  assert.equal(request.options.params, undefined);
});

test("el error OAuth sanitizado no expone secretos ni la configuracion HTTP", () => {
  const error = {
    response: { status: 400, data: { error: "invalid_grant" } },
    config: { data: "client_secret=secret&refresh_token=token" },
  };

  const sanitized = sanitizeGoogleTokenError(error);

  assert.equal(sanitized.message, "No se pudo renovar la autorizacion Google (HTTP 400 - invalid_grant)");
  assert.equal(sanitized.message.includes("secret"), false);
  assert.equal(sanitized.message.includes("token"), false);
});
