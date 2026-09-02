import { Queue } from "bullmq";
import { connection } from "../config/redis.js";
export const manualInvoicesQueue = new Queue("manual-invoices", { connection });
