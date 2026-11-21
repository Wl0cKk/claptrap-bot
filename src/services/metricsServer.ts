import express from 'express';
import { register } from './metrics';
import { logger } from './metrics';
import { config } from '../config';

export function startMetricsServer() {
  const app = express();
  const port = config.PORT;

  app.get('/metrics', async (req, res) => {
    try {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch (ex) {
      res.status(500).end(ex);
    }
  });

  app.listen(port, () => {
    logger.info(`Metrics server is listening on port ${port}`);
  });
}
