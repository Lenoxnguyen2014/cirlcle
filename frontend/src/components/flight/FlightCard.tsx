import type { Flight } from '../../types/chat';

interface FlightCardProps {
  flight: Flight;
}

export function FlightCard({ flight }: FlightCardProps) {
  return (
    <div className="flight-card">
      <div className="flight-card-row">
        <span className="flight-card-airline">{flight.airline}</span>
        <span className="flight-card-flightno">{flight.flightNo}</span>
      </div>
      <div className="flight-card-route">
        <span>{flight.origin}</span>
        <span className="flight-card-arrow">→</span>
        <span>{flight.destination}</span>
      </div>
      <div className="flight-card-times">
        <span>{flight.departureTime || '—'}</span>
        <span className="flight-card-arrow">→</span>
        <span>{flight.arrivalTime || '—'}</span>
      </div>
      <div className="flight-card-price">
        {flight.priceUsdc} {flight.currency}
      </div>
    </div>
  );
}
