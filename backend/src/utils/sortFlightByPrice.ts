import type { Flight } from '../types/Flight.ts';

// --- HELPER 1: Find the cheapest flight from an array ---
const findCheapestFlight = (flights: Flight[]) => {
  if (!flights || flights.length === 0) {
    return null;
  }

  const sortedFlights = [...flights].sort((a, b) => {
    return parseFloat(a.priceUsdc) - parseFloat(b.priceUsdc);
  });

  return sortedFlights[0];
}


export { findCheapestFlight };