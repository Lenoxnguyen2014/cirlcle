import type { Flight } from '../../types/chat';
import { FlightCard } from './FlightCard';

interface FlightListProps {
  flights: Flight[];
}

export function FlightList({ flights }: FlightListProps) {
  if (flights.length === 0) {
    return <div className="flight-list-empty">No flights found for that search.</div>;
  }

  return (
    <div className="flight-list">
      {flights.map((flight) => (
        <FlightCard key={flight.id} flight={flight} />
      ))}
    </div>
  );
}
