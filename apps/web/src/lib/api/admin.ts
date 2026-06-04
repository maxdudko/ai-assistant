import { adminApiFetch } from './admin-client';
import type {
  AdminChangePasswordRequest,
  AdminDto,
  AdminLoginRequest,
  AdminSubscriptionListItemDto,
  AdminUpdateEmailRequest,
  AdminUserListItemDto,
} from './types';

export const adminApi = {
  login: (dto: AdminLoginRequest) =>
    adminApiFetch<AdminDto>('/api/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  me: () => adminApiFetch<AdminDto>('/api/admin/auth/me'),

  logout: () =>
    adminApiFetch<{ message: string }>('/api/admin/auth/logout', {
      method: 'POST',
    }),

  getDashboard: () => adminApiFetch<Record<string, never>>('/api/admin/dashboard'),

  getUsers: () => adminApiFetch<AdminUserListItemDto[]>('/api/admin/users'),

  getSubscriptions: () => adminApiFetch<AdminSubscriptionListItemDto[]>('/api/admin/subscriptions'),

  updateEmail: (dto: AdminUpdateEmailRequest) =>
    adminApiFetch<AdminDto>('/api/admin/profile/email', {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),

  changePassword: (dto: AdminChangePasswordRequest) =>
    adminApiFetch<{ message: string }>('/api/admin/profile/password', {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),
};
