import fs from "fs";
import path from "path";
import axios from "axios";
import readline from "readline/promises";
import { google } from "googleapis";
import { config } from "../config/index.js";
import logger from "../utils/logger.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TOKEN_PATH = path.resolve(__dirname, "../../", config.GOOGLE.TOKEN);

export async function getAccessToken() {
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
      if (token.expiry_date && Date.now() < token.expiry_date) {
        return token.access_token;
      }
      if (token.refresh_token) {
        const refreshed = await refresh(token.refresh_token);
        const merged = { ...token, ...refreshed, expiry_date: Date.now() + refreshed.expires_in * 1000 };
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(merged, null, 2), { mode: 0o600 });
        return merged.access_token;
      }
    }
  } catch (error) {
    logger.error("Error en el getAccessToken: " + error);
    return null;
  }
}

async function refresh(refreshToken) {
  const response = await axios.post("https://oauth2.googleapis.com/token", null, {
    params: {
      client_id: config.GOOGLE.CLIENT_ID,
      client_secret: config.GOOGLE.CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    },
  });
  return response.data;
}

export async function getNewToken() {
  const scopes = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/spreadsheets",
  ];
  const oAuth2Client = new google.auth.OAuth2(
    config.GOOGLE.CLIENT_ID,
    config.GOOGLE.CLIENT_SECRET,
    "urn:ietf:wg:oauth:2.0:oob"
  );
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: scopes,
  });

  console.log("Authorize this app by visiting this URL:", authUrl);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    const code = await rl.question("Enter the code from that page here: ");
    if (!code.trim()) throw new Error("El codigo OAuth no puede estar vacio");

    const { tokens } = await oAuth2Client.getToken(code.trim());
    fs.mkdirSync(path.dirname(TOKEN_PATH), { recursive: true });
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2), { mode: 0o600 });
    console.log("Tokens stored to", TOKEN_PATH);

    return { tokenPath: TOKEN_PATH, hasRefreshToken: Boolean(tokens.refresh_token) };
  } finally {
    rl.close();
  }
}
