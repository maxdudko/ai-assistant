import { apiFetch } from './client';
import type { UpdateMeRequest, UserDto } from './types';

export const userApi = {
  me: () => apiFetch<UserDto>('/api/users/me'),

  updateMe: (dto: UpdateMeRequest) =>
    apiFetch<UserDto>('/api/users/me', {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),
};
