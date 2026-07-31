// src/services/passportParserService.ts
import { ai } from '../config/ai';

const aiParseTravelDocs = async (fileBuffer: Buffer, mimeType: string) => {
  try {
    const prompt = `
      Extract passport or identity document details from this photo.
      Return a JSON object with:
      - "passportNumber": string or null
      - "issuingCountry": string (3-letter country code like USA, CAN) or null
      - "expirationDate": string (YYYY-MM-DD) or null
      - "firstName": string or null
      - "lastName": string or null
      - "dateOfBirth": string (YYYY-MM-DD) or null
    `;

    const result = await ai.models.generateContent({
     model: 'gemini-2.5-flash',
     contents: [   
      prompt,
      {
        inlineData: {
          data: fileBuffer.toString('base64'),
          mimeType: mimeType
        }
      }]
    });

    return JSON.parse(result.response.text());
  } catch (error) {
    console.error('Failed to parse travel document with Gemini:', error);
    return {};
  }
}

export { aiParseTravelDocs };