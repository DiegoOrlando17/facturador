import express from "express";
import dotenv from "dotenv";

import healthRouter from "./routes/health.routes.js";
import googleRouter from "./routes/google.routes.js";
import adminRouter from "./routes/admin.routes.js";
import portalRouter from "./routes/portal.routes.js";
import publicRouter from "./routes/public.routes.js";

dotenv.config();

const app = express();

app.use(express.json());
app.use("/health", healthRouter);
app.use("/public", publicRouter);
app.use("/google", googleRouter);
app.use("/admin", adminRouter);
app.use("/portal", portalRouter);

export default app;
