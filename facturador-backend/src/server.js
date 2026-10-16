import app from "./app.js";
import logger from "./utils/logger.js";

import { config } from "./config/index.js";

const { PORT } = config;

app.listen(PORT, () => {
  logger.info(`API escuchando en http://localhost:${PORT}`);
});
