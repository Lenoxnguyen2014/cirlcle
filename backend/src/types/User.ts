// src/types/User.ts
interface TravelDocData {
  passportNumber?: string;
  issuingCountry?: string;
  expirationDate?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  travelDocUrl?: string;
  travelDocData?: TravelDocData;
  createdAt?: string;
}

export type { User, TravelDocData };