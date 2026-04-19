import express from "express";
import dotenv from "dotenv";

import webhookRouter from "./routes/webhook.routes.js";
import paymentsRouter from "./routes/payments.routes.js";
import healthRouter from "./routes/health.routes.js";
import googleRouter from "./routes/google.routes.js";
import adminRouter from "./routes/admin.routes.js";
import portalRouter from "./routes/portal.routes.js";

dotenv.config();

const app = express();

app.use(express.json());
app.use("/health", healthRouter);
app.use("/webhook", webhookRouter);
app.use("/google", googleRouter);
app.use("/admin", adminRouter);
app.use("/portal", portalRouter);
app.use("/api", paymentsRouter);

export default app;
