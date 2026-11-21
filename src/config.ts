import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  BOT_TOKEN: z.string().min(1),
  AI_SERVER_URL: z.string().url().default('http://localhost:11434'),
  API_KEY: z.string().min(1).default('local-dev-key'),
  PORT: z.string().transform(Number).default('3000'),
});

export const config = envSchema.parse(process.env);
