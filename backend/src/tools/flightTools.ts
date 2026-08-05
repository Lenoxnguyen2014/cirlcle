import { z } from 'zod';
import { mcpServer } from '../config/mcp.js';
import { searchFlights } from '../services/searchFlight.js';

export function registerFlightTools() {
  mcpServer.registerTool(
    'ping_flight_agent',
    {
      title: 'Ping Agent',
      description: 'Check status of the flight agent backend.',
      inputSchema: {
        query: z.string().optional().describe('Optional message input'),
      },
    },
    async ({ query }) => {
      return {
        content: [
          {
            type: 'text',
            text: `Flight Agent MCP active! Received: ${query || 'No query provided'}`,
          },
        ],
      };
    },
  );

  mcpServer.registerTool(
    'search_flights',
    {
      title: 'Search Flights',
      description:
        'Search for available flights between two airports on a given date for a number of adult passengers. ' +
        'If origin, destination, date, or passenger count is missing from the user request, ask a clarifying question instead of guessing.',
      inputSchema: {
        origin: z.string().length(3).describe('Origin airport IATA code, e.g. "LAX"'),
        destination: z.string().length(3).describe('Destination airport IATA code, e.g. "JFK"'),
        departureDate: z.string().describe('Departure date in YYYY-MM-DD format'),
        passengers: z.number().int().min(1).describe('Number of adult passengers'),
        cabinClass: z
          .enum(['economy', 'premium_economy', 'business', 'first'])
          .optional()
          .default('economy')
          .describe('Cabin class'),
      },
      outputSchema: {
        flights: z.array(
          z.object({
            id: z.string(),
            airline: z.string(),
            flightNo: z.string(),
            origin: z.string(),
            destination: z.string(),
            priceUsdc: z.string(),
            currency: z.string(),
            departureTime: z.string(),
            arrivalTime: z.string(),
          }),
        ),
      },
    },
    async ({ origin, destination, departureDate, passengers, cabinClass }) => {
      const flights = await searchFlights(origin, destination, departureDate, passengers, cabinClass);
      return {
        content: [{ type: 'text', text: JSON.stringify({ flights }) }],
        structuredContent: { flights },
      };
    },
  );
}
