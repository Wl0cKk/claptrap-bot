import axios from 'axios';
import { config } from '../config';

export const aiClient = axios.create({
  baseURL: config.AI_SERVER_URL,
  headers: {
    'X-API-Key': config.API_KEY,
  },
  timeout: 30000,
});
