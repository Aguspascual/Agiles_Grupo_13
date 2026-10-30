export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  zone: string;
  level: string;
  position: string;
  hand: string;
  fairPlay: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface UpdateProfileRequest {
  name: string;
  zone: string;
  level: string;
  position: string;
  hand: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  zone: string;
  level: string;
  position?: string;
  hand?: string;
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
}

export interface ApiErrorResponse {
  error: string;
}
