import { launchBot } from './bot';
import { startMetricsServer } from './services/metricsServer';
import { logger } from './services/metrics';

async function main() {
  try {
    logger.info('Starting Claptrap Bot...');
    
    // Start metrics server for Grafana/Prometheus
    startMetricsServer();
    
    // Launch Telegram bot
    await launchBot();
  } catch (error) {
    logger.error({ err: error }, 'Failed to start application');
    process.exit(1);
  }
}

main();
