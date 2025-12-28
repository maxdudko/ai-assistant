export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserDto {
  id: string;
  email: string;
  name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface MessageDto {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}
