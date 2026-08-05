import { Type } from '@google/genai';
import { gemini, deepseek } from '../config/ai.js';
import { provider } from './llmClient.js';

interface ExtractedLocation {
  name: string;
  confidence?: number;
}

interface LocationExtractionInput {
  type: 'text' | 'link' | 'photo';
  text?: string;
  imageBuffer?: Buffer;
  mimeType?: string;
}

const PROMPT =
  'Identify every distinct real-world place, city, region, or landmark mentioned or shown ' +
  'that a traveler could visit. There is often more than one — do not stop after finding the ' +
  'single most prominent one. List ALL of them as separate entries; never collapse multiple ' +
  'distinct places into one entry or summarize them away. For example, if the content mentions ' +
  'a multi-city itinerary or several attractions, return every one of them individually. ' +
  'Ignore generic or fictional places. Return an empty list if none are found.';

const extractWithGemini = async (input: LocationExtractionInput): Promise<{ locations: ExtractedLocation[] }> => {
  const contents: any[] = [{ text: `${PROMPT}\n\nContent:\n${input.text || '(see attached image)'}` }];

  if (input.imageBuffer && input.mimeType) {
    contents.push({
      inlineData: {
        data: input.imageBuffer.toString('base64'),
        mimeType: input.mimeType,
      },
    });
  }

  const response = await gemini.models.generateContent({
    model: 'gemini-2.5-flash',
    contents,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          locations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                confidence: { type: Type.NUMBER },
              },
              required: ['name'],
            },
          },
        },
        required: ['locations'],
      },
    },
  });

  const parsed = JSON.parse(response.text || '{}');
  return { locations: parsed.locations || [] };
};

const extractWithDeepSeek = async (input: LocationExtractionInput): Promise<{ locations: ExtractedLocation[] }> => {
  const response = await deepseek.chat.completions.create({
    model: 'deepseek-chat',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        content:
          `${PROMPT}\n\nRespond with JSON only, in exactly this shape: ` +
          `{"locations":[{"name":string,"confidence":number}]}\n\nContent:\n${input.text || ''}`,
      },
    ],
  });

  const parsed = JSON.parse(response.choices[0]?.message?.content || '{}');
  return { locations: parsed.locations || [] };
};

const extractLocationsFromContent = async (
  input: LocationExtractionInput
): Promise<{ locations: ExtractedLocation[] }> => {
  try {
    // DeepSeek's chat API here is text-only — photos always go through Gemini
    // regardless of the dev/prod provider setting.
    if (provider === 'gemini' || input.type === 'photo') {
      return await extractWithGemini(input);
    }
    return await extractWithDeepSeek(input);
  } catch (error: any) {
    console.error('Error in extractLocationsFromContent:', error.message);
    return { locations: [] };
  }
};

export { extractLocationsFromContent };
export type { ExtractedLocation, LocationExtractionInput };
