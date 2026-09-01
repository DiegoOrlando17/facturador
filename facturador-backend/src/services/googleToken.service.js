import axios from "axios";

export function buildGoogleTokenRequest({ clientId, clientSecret, refreshToken }) {
  if (!refreshToken) throw new Error("GOOGLE.REFRESH_TOKEN es obligatorio");
  if (!clientId) throw new Error("GOOGLE.CLIENT_ID es obligatorio");
  if (!clientSecret) throw new Error("GOOGLE.CLIENT_SECRET es obligatorio");

  return {
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  };
}

export function sanitizeGoogleTokenError(error, fallback = "No se pudo renovar la autorizacion Google") {
  const status = Number(error?.response?.status);
  const googleCode = String(error?.response?.data?.error || "").trim();
  const detail = [Number.isFinite(status) ? `HTTP ${status}` : null, googleCode || null]
    .filter(Boolean)
    .join(" - ");
  return new Error(detail ? `${fallback} (${detail})` : fallback);
}

export async function requestGoogleAccessToken(credentials, { httpClient = axios, timeout = 30000 } = {}) {
  const tokenRequest = buildGoogleTokenRequest(credentials);
  const body = new URLSearchParams(tokenRequest).toString();

  try {
    const response = await httpClient.post("https://oauth2.googleapis.com/token", body, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout,
    });
    return response.data;
  } catch (error) {
    throw sanitizeGoogleTokenError(error);
  }
}
