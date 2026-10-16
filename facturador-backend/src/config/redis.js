import IORedis from "ioredis";
import { config } from "../config/index.js";
import logger from "../utils/logger.js";

export const connection = new IORedis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// ioredis reintenta solo; sin listener cada corte se reporta como "Unhandled error event".
connection.on("error", (error) => {
  logger.warn(`Redis: ${error.code || error.message}`);
});
