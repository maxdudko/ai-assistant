import { apiFetch } from './client';
import type { LoginRequest, RegisterRequest, UserDto } from './types';

export const authApi = {
  login: (dto: LoginRequest) =>
    apiFetch<{ user: UserDto }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  register: (dto: RegisterRequest) =>
    apiFetch<{ user: UserDto }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  me: () => apiFetch<UserDto>('/api/users/me'),

  logout: () => apiFetch<void>('/api/auth/logout', { method: 'POST' }),
};
