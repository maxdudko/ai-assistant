import { apiFetch } from './client';
import type {
  LoginRequest,
  RegisterRequest,
  UserDto,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  ChangePasswordRequest,
} from './types';

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

  forgotPassword: (dto: ForgotPasswordRequest) =>
    apiFetch<{ message: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  resetPassword: (dto: ResetPasswordRequest) =>
    apiFetch<{ message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  changePassword: (dto: ChangePasswordRequest) =>
    apiFetch<{ message: string }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),
};
