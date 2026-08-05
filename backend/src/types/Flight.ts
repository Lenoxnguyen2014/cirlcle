export interface Flight {
  id: string;
  airline: string;
  flightNo: string;
  origin: string;
  destination: string;
  priceUsdc: string;
  currency: string;
  departureTime?: string;
  arrivalTime?: string;
  [key: string]: any;
}