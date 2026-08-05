export interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
}
