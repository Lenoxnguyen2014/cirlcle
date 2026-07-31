import { Request, Response } from 'express';
import { executeCircleBooking }from '../services/purchaseFlight.js';

const bookFlightHandler = async (req: Request, res: Response): Promise<Response> => {
  const { flightId, priceUsdc, recipientAddress } = req.body;

  if (!flightId || !priceUsdc) {
    return res.status(400).json({ 
      success: false, 
      error: 'flightId and priceUsdc are required parameters.' 
    });
  }

  try {
    const result = await executeCircleBooking(flightId, priceUsdc, recipientAddress);
    return res.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Flight booking failed';
    return res.status(500).json({ success: false, error: message });
  }
};

export { bookFlightHandler };