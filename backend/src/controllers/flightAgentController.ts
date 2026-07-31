// src/controllers/flightAgentController.ts
import type { Request, Response } from 'express';
import { searchFlights } from '../services/searchFlight.js';
import { executeCircleBooking } from '../services/purchaseFlight.js';
import { evaluateFlightBookingWithAI } from '../services/aiDecisionService.js';

const runAgentHandler = async (req: Request, res: Response): Promise<Response> => {
  const { 
    userInstruction, 
    origin = 'LAX', 
    destination = 'JFK', 
    date = '2026-10-15' 
  } = req.body;

  if (!userInstruction) {
    return res.status(400).json({ 
      success: false, 
      error: 'userInstruction parameter is required.' 
    });
  }

  try {
    // 1. Fetch available flight offers
    const flights = await searchFlights(origin, destination, date);

    // 2. Pass flights and prompt to Gemini AI
    const decision = await evaluateFlightBookingWithAI(flights, userInstruction);

    let bookingResult = null;

    // 3. Execute Circle USDC payment if AI approves
    if (decision.shouldBook && decision.selectedFlightId) {
      const selectedFlight = flights.find((f: any) => f.id === decision.selectedFlightId);
      bookingResult = await executeCircleBooking(
        decision.selectedFlightId,
        selectedFlight?.priceUsdc
      );
    }

    return res.json({
      success: true,
      decision,
      bookingResult,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Agent execution failed';
    return res.status(500).json({ success: false, error: message });
  }
};

export { runAgentHandler };

