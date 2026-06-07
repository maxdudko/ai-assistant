'use client';

import type { FC } from 'react';
import React from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';

import type { NotificationDto } from '@/lib/api/types';
import { markAllNotificationsRead, markNotificationRead } from '@/lib/api/notifications';
import { queryKeys } from '@/lib/query-keys';

type NotificationListProps = {
  items: NotificationDto[];
  unreadCount: number;
  compact?: boolean;
  onAction?: () => void;
};

const NotificationList: FC<NotificationListProps> = ({
  items,
  unreadCount,
  compact = false,
  onAction,
}) => {
  const router = useRouter();
  const queryClient = useQueryClient();

  const refreshNotifications = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
      queryClient.invalidateQueries({ queryKey: queryKeys.notificationUnreadCount }),
    ]);
  };

  const handleMarkRead = async (event: React.MouseEvent, id: string) => {
    event.stopPropagation();
    await markNotificationRead(id);
    await refreshNotifications();
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    await refreshNotifications();
  };

  const handleOpen = async (item: NotificationDto) => {
    if (!item.readAt) {
      await markNotificationRead(item.id);
      await refreshNotifications();
    }
    onAction?.();
    if (item.deepLink) {
      router.push(item.deepLink);
    }
  };

  if (items.length === 0) {
    return <div className="px-4 py-6 text-sm text-neutral-400">No notifications yet.</div>;
  }

  return (
    <div>
      {unreadCount > 0 && (
        <div
          className={`flex justify-end ${compact ? 'px-4 py-2' : 'px-4 py-3 border-b border-neutral-700'}`}
        >
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="text-xs text-indigo-300 hover:text-indigo-200"
          >
            Mark all read
          </button>
        </div>
      )}

      <div className={compact ? 'max-h-80 overflow-y-auto' : 'space-y-2'}>
        {items.map(item => {
          const isUnread = !item.readAt;
          return (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              onClick={() => handleOpen(item)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  void handleOpen(item);
                }
              }}
              className={`w-full text-left transition-colors hover:bg-neutral-700/40 cursor-pointer ${
                compact
                  ? 'px-4 py-3 border-b border-neutral-700/60'
                  : 'rounded-lg border border-neutral-700 px-4 py-3'
              } ${isUnread ? 'bg-indigo-500/5' : 'opacity-80'}`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    isUnread ? 'bg-indigo-400' : 'bg-transparent'
                  }`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-medium text-neutral-100">{item.title}</div>
                    {isUnread && (
                      <button
                        type="button"
                        onClick={event => handleMarkRead(event, item.id)}
                        className="shrink-0 rounded border border-neutral-600 px-2 py-0.5 text-[11px] text-neutral-300 hover:bg-neutral-700"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                  <div
                    className={`mt-1 text-neutral-300 ${compact ? 'text-xs line-clamp-2' : 'text-sm'}`}
                  >
                    {item.body}
                  </div>
                  <div className="mt-2 text-[11px] text-neutral-500">
                    {new Date(item.createdAt).toLocaleString()}
                    {isUnread ? ' · Unread' : ' · Read'}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default NotificationList;
