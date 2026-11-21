import client from 'prom-client';
import pino from 'pino';

// Initialize logger with pretty output for development
export const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true },
  },
});

// Initialize Prometheus registry
const register = new client.Registry();

// Histogram metric to track AI processing time
const aiProcessingTime = new client.Histogram({
  name: 'ai_processing_time_ms',
  help: 'Time taken to process AI requests in milliseconds',
  labelNames: ['service'], // Labels: whisper, ollama, nllb
});

register.registerMetric(aiProcessingTime);

export { register, aiProcessingTime };
