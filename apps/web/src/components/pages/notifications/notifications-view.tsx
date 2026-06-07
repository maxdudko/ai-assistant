'use client';

import type { FC } from 'react';
import React from 'react';
import { useQuery } from '@tanstack/react-query';

import Container from '@/components/common/container';
import NotificationList from '@/components/common/notifications/notification-list';
import { listNotifications, getUnreadNotificationCount } from '@/lib/api/notifications';
import { queryKeys } from '@/lib/query-keys';

const NotificationsView: FC = () => {
  const { data: notifications, isPending } = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => listNotifications({ limit: 50 }),
  });

  const { data: unread } = useQuery({
    queryKey: queryKeys.notificationUnreadCount,
    queryFn: getUnreadNotificationCount,
  });

  return (
    <Container className="p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-100">Notifications</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Morning briefings, reflections, and check-ins from Mira.
        </p>
      </div>

      {isPending ? (
        <p className="text-sm text-neutral-400">Loading notifications...</p>
      ) : (
        <NotificationList
          items={notifications?.items ?? []}
          unreadCount={unread?.count ?? 0}
        />
      )}
    </Container>
  );
};

export default NotificationsView;
