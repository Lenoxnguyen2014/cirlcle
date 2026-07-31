import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

interface AIDecision {
  shouldBook: boolean;
  selectedFlightId?: string;
  reason: string;
}


const evaluateFlightBookingWithAI = async (
  flights: any[],
  userInstruction: string
): Promise<AIDecision> => {
  if (!flights || flights.length === 0) {
    return {
      shouldBook: false,
      reason: 'No flight offers were provided to evaluate.',
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [
        {
          text: `You are an autonomous flight booking agent. 
Analyze the provided flight offers against the user's instructions and decide if one should be booked right now.

User Instruction: "${userInstruction}"

Available Flights:
${JSON.stringify(flights, null, 2)}`
        }
      ],
      config: {
        // Enforce exact JSON schema output from Gemini
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            shouldBook: {
              type: Type.BOOLEAN,
              description: 'True if a flight matches the user instructions and criteria.',
            },
            selectedFlightId: {
              type: Type.STRING,
              description: 'The flight ID (e.g., off_001) to book if shouldBook is true. Omit if false.',
            },
            reason: {
              type: Type.STRING,
              description: 'Concise explanation for why the decision was made.',
            },
          },
          required: ['shouldBook', 'reason'],
        },
      },
    });

    // Parse Gemini's structured JSON response
    const decision: AIDecision = JSON.parse(response.text || '{}');
    return decision;
  } catch (error: any) {
    console.error('Error in evaluateFlightBookingWithAI:', error.message);
    return {
      shouldBook: false,
      reason: `AI Evaluation failed: ${error.message}`,
    };
  }
}

export { evaluateFlightBookingWithAI };