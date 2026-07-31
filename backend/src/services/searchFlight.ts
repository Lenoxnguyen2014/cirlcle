import { Duffel } from '@duffel/api';
import type {Flight } from '../types/Flight.ts';
const duffel = new Duffel({
  token: process.env.DUFFEL_API_KEY || '',
});


const searchFlights = async (
  origin: string = 'LAX',
  destination: string = 'JFK',
  date: string = '2026-10-15'
): Promise<Flight[]> => {
  const apiKey = process.env.DUFFEL_API_KEY;

  if (!apiKey || apiKey === 'duffel_test_mock') {
    console.warn('[Duffel SDK] Missing valid DUFFEL_API_KEY. Returning empty results.');
    return [];
  }

  try {
    const offerRequest = await duffel.offerRequests.create({
      slices: [
        {
          origin,
          destination,
          departure_date: date,
          arrival_time: null,
          departure_time: null
        },
      ],
      passengers: [{ type: 'adult' }],
      cabin_class: 'economy',
    });

    const offers = await duffel.offers.list({
      offer_request_id: offerRequest.data.id,
      limit: 5,
    });

    // Filter and map only USD offers to prevent 1:1 USDC conversion mismatches
    return offers.data
      .filter((offer) => {
        if (offer.total_currency !== 'USD') {
          console.warn(
            `[Duffel SDK] Skipping Offer ID ${offer.id}: Currency is '${offer.total_currency}', expected 'USD'.`
          );
          return false;
        }
        return true;
      })
      .map((offer) => {
        const firstSegment = offer.slices?.[0]?.segments?.[0];

        return {
          id: offer.id,
          airline: offer.owner?.name || 'Airline',
          flightNo: firstSegment?.marketing_carrier_flight_number || 'N/A',
          origin,
          destination,
          priceUsdc: offer.total_amount, // Safe to use directly as USDC because currency is USD
          currency: offer.total_currency,
          departureTime: firstSegment?.departing_at || '',
          arrivalTime: firstSegment?.arriving_at || '',
        };
      });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Duffel API Error]:', message);
    return [];
  }
};

export { searchFlights };