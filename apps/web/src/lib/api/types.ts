export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserProfileDto {
  displayName?: string;
  tone: 'neutral' | 'friendly' | 'strict';
  verbosity: 'low' | 'medium' | 'high';
  useEmoji: boolean;
}

export interface UserDto {
  id: string;
  email: string;
  profile?: UserProfileDto;
}

export interface UpdateMeRequest {
  email?: string;
  profile?: Partial<UserProfileDto>;
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
