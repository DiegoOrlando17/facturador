import { Queue } from "bullmq";
import { connection } from "../config/redis.js";

export const creditNotesQueue = new Queue("credit-notes", { connection });
