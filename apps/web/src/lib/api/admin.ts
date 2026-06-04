import { adminApiFetch } from './admin-client';
import type {
  AdminChangePasswordRequest,
  AdminDto,
  AdminLoginRequest,
  AdminSubscriptionCatalogDto,
  AdminSubscriptionDetailDto,
  AdminSubscriptionListItemDto,
  AdminUpdateEmailRequest,
  AdminUserListItemDto,
  SetAdminFeatureOverridesRequest,
  UpdateAdminSubscriptionRequest,
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

  suspendUser: (userId: string) =>
    adminApiFetch<AdminUserListItemDto>(`/api/admin/users/${userId}/suspend`, {
      method: 'PATCH',
    }),

  unsuspendUser: (userId: string) =>
    adminApiFetch<AdminUserListItemDto>(`/api/admin/users/${userId}/unsuspend`, {
      method: 'PATCH',
    }),

  deleteUser: (userId: string) =>
    adminApiFetch<{ message: string }>(`/api/admin/users/${userId}`, {
      method: 'DELETE',
    }),

  getSubscriptionCatalog: () =>
    adminApiFetch<AdminSubscriptionCatalogDto>('/api/admin/subscriptions/catalog'),

  getSubscriptions: () => adminApiFetch<AdminSubscriptionListItemDto[]>('/api/admin/subscriptions'),

  getSubscription: (subscriptionId: string) =>
    adminApiFetch<AdminSubscriptionDetailDto>(`/api/admin/subscriptions/${subscriptionId}`),

  updateSubscription: (subscriptionId: string, dto: UpdateAdminSubscriptionRequest) =>
    adminApiFetch<AdminSubscriptionDetailDto>(`/api/admin/subscriptions/${subscriptionId}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),

  setSubscriptionFeatures: (subscriptionId: string, dto: SetAdminFeatureOverridesRequest) =>
    adminApiFetch<AdminSubscriptionDetailDto>(
      `/api/admin/subscriptions/${subscriptionId}/features`,
      {
        method: 'PUT',
        body: JSON.stringify(dto),
      },
    ),

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
