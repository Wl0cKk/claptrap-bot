import { z } from 'zod';
import { aiClient } from './aiClient';
import { loadPrompt } from '../utils/promptLoader';
import { logger, aiProcessingTime } from './metrics';
import { aiQueue } from './queue';

// Schema for validating router output
const RoutingSchema = z.object({
  intent: z.enum(['TRANSLATE', 'GENERATE']).optional().default('TRANSLATE'),
  src: z.string().min(2),
  tgt: z.string().min(2),
  text: z.string().min(1).optional(),
  cleanText: z.string().min(1).optional(),
});

export interface RoutingResult {
  intent: 'TRANSLATE' | 'GENERATE';
  src: string;
  tgt: string;
  cleanText: string;
}

export async function transcribeAudio(fileBuffer: Buffer, fileName: string): Promise<string> {
  return aiQueue(async () => {
    const endTimer = aiProcessingTime.startTimer({ service: 'whisper' });
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: 'audio/ogg' });
    formData.append('file', blob, fileName);
    formData.append('response_format', 'json');

    try {
      const response = await aiClient.post('/whisper/inference', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });
      endTimer();
      return response.data.text;
    } catch (error) {
      endTimer();
      logger.error({ err: error }, 'Whisper transcription failed');
      throw new Error('Failed to transcribe audio');
    }
  });
}

export async function routeIntent(text: string): Promise<RoutingResult> {
  return aiQueue(async () => {
    const endTimer = aiProcessingTime.startTimer({ service: 'ollama' });
    try {
      const systemPrompt = loadPrompt('router_system.md');
      
      const response = await aiClient.post('/ollama/api/chat', {
        model: 'qwen2.5:3b',
        format: 'json',
        stream: false,
        keep_alive: -1,
        options: { temperature: 0.0, num_ctx: 1024 },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
      });
      endTimer();
      
      const rawContent = response.data.message.content;
      logger.info({ rawResponse: rawContent }, 'Raw Ollama Response');
      
      const parsed = JSON.parse(rawContent);
      const validated = RoutingSchema.parse(parsed);

      return {
        intent: validated.intent,
        src: validated.src,
        tgt: validated.tgt,
        cleanText: validated.cleanText || validated.text || text,
      };
    } catch (error) {
      endTimer();
      logger.error({ err: error }, 'Ollama routing processing failed');
      return {
        intent: 'TRANSLATE',
        src: 'auto',
        tgt: 'en',
        cleanText: text,
      };
    }
  });
}

export async function translateText(text: string, src: string, tgt: string): Promise<string> {
  return aiQueue(async () => {
    const endTimer = aiProcessingTime.startTimer({ service: 'nllb' });
    try {
      const response = await aiClient.post('/nllb/translate', { text, src, tgt }, { timeout: 30000 });
      endTimer();
      return response.data.translated;
    } catch (error) {
      endTimer();
      logger.error({ err: error }, 'NLLB translation failed');
      throw new Error('Failed to translate text');
    }
  });
}

export async function generateResponse(prompt: string, srcLang: string): Promise<string> {
  return aiQueue(async () => {
    const endTimer = aiProcessingTime.startTimer({ service: 'ollama-gen' });
    try {
      const englishPrompt = srcLang !== 'en' ? await translateText(prompt, srcLang, 'en') : prompt;
      const response = await aiClient.post('/ollama/api/chat', {
        model: 'qwen2.5:3b',
        stream: false,
        keep_alive: -1,
        options: { temperature: 0.7, num_ctx: 2048 },
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: englishPrompt },
        ],
      });
      endTimer();
      return response.data.message.content;
    } catch (error) {
      endTimer();
      logger.error({ err: error }, 'Qwen generation failed');
      throw new Error('Failed to generate response');
    }
  });
}
