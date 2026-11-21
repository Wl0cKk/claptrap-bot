import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { logger, aiProcessingTime } from './metrics';

// Initialize Axios client with base URL and API key
const aiClient = axios.create({
  baseURL: config.AI_SERVER_URL,
  headers: {
    'X-API-Key': config.API_KEY,
  },
  timeout: 30000,
});

// Helper to load prompts from markdown files
const loadPrompt = (filename: string): string => {
  return fs.readFileSync(path.join(__dirname, '../../prompts', filename), 'utf-8');
};

/**
 * Step 1: Transcribe audio using Whisper
 */
export async function transcribeAudio(fileBuffer: Buffer, fileName: string): Promise<string> {
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
}

/**
 * Step 2: Route intent and detect languages using Ollama
 */
export async function routeIntent(text: string): Promise<{ src: string; tgt: string; cleanText: string }> {
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
    
    const content = response.data.message.content;
    return JSON.parse(content);
  } catch (error) {
    endTimer();
    logger.error({ err: error }, 'Ollama routing failed');
    throw new Error('Failed to route intent');
  }
}

/**
 * Step 3: Translate text using NLLB-200
 */
export async function translateText(text: string, src: string, tgt: string): Promise<string> {
  const endTimer = aiProcessingTime.startTimer({ service: 'nllb' });
  try {
    const response = await aiClient.post('/nllb/translate', {
      text,
      src,
      tgt,
    }, {
      timeout: 30000,
    });
    endTimer();
    return response.data.translated;
  } catch (error) {
    endTimer();
    logger.error({ err: error }, 'NLLB translation failed');
    throw new Error('Failed to translate text');
  }
}
