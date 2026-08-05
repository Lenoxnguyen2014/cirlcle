import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';

const gemini = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

// Kept for existing consumers (aiDecisionService.ts, aiParseTravelDocs.ts)
// that call the Gemini SDK directly.
const ai = gemini;

export { gemini, deepseek, ai };
