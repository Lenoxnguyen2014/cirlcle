import { Request, Response } from 'express';
import { searchFlights } from '../services/searchFlight.js';

const searchFlightsHandler = async (req: Request, res: Response): Promise<Response> => {
  const origin = (req.query.origin as string) || 'LAX';
  const destination = (req.query.destination as string) || 'JFK';
  const date = (req.query.date as string) || '2026-10-15';

  try {
    const flights = await searchFlights(origin, destination, date);
    return res.json({ success: true, flights });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to search flights';
    return res.status(500).json({ success: false, error: message });
  }
};

export { searchFlightsHandler };