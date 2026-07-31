import { executeCircleBooking } from './purchaseFlight.ts';
import type { Flight } from '../types/Flight.ts';
import { findCheapestFlight  } from '../utils/sortFlightByPrice.ts';

const processFlightDecision = async (flights: Flight[]) => {
  const cheapestFlight = findCheapestFlight(flights);

  if (!cheapestFlight) {
    console.log('No valid flights found to evaluate.');
    return { status: 'skipped', reason: 'No flights available' };
  }

  const price = parseFloat(cheapestFlight.priceUsdc);

  console.log(
    ` Cheapest flight identified: ${cheapestFlight?.airline} (${cheapestFlight.flightNo}) at $${price} USDC.`
  );
  console.log(`Executing Circle payment for flight ID: ${cheapestFlight.id}...`);

  // Automatically book the cheapest option found
  const bookingResult = await executeCircleBooking(
    cheapestFlight.id,
    cheapestFlight.priceUsdc
  );

  return {
    status: 'booked',
    bookedFlight: cheapestFlight,
    transaction: bookingResult,
  };
}


export { processFlightDecision };