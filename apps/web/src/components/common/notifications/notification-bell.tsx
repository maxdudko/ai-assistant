'use client';

import type { FC } from 'react';
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/api/notifications';
import { queryKeys } from '@/lib/query-keys';
import { registerWebPush } from '@/lib/notifications/push';

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
      />
    </svg>
  );
}

const NotificationBell: FC = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pushStatus, setPushStatus] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const { data: unread } = useQuery({
    queryKey: queryKeys.notificationUnreadCount,
    queryFn: getUnreadNotificationCount,
    refetchInterval: 60_000,
  });

  const { data: notifications } = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => listNotifications({ limit: 10 }),
    enabled: open,
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const refreshNotifications = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
      queryClient.invalidateQueries({ queryKey: queryKeys.notificationUnreadCount }),
    ]);
  };

  const handleOpen = () => {
    setOpen(prev => !prev);
  };

  const handleEnablePush = async () => {
    setPushStatus(null);
    try {
      const enabled = await registerWebPush();
      setPushStatus(enabled ? 'Push notifications enabled.' : 'Could not enable push notifications.');
    } catch {
      setPushStatus('Could not enable push notifications.');
    }
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    await refreshNotifications();
  };

  const handleOpenNotification = async (id: string, deepLink?: string | null) => {
    await markNotificationRead(id);
    await refreshNotifications();
    setOpen(false);
    if (deepLink && typeof window !== 'undefined') {
      window.location.href = deepLink;
    }
  };

  const unreadCount = unread?.count ?? 0;

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={handleOpen}
        className="p-2 rounded-lg hover:bg-neutral-800 transition-colors relative"
        aria-label="Notifications"
      >
        <BellIcon className="w-5 h-5 text-neutral-300" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[1rem] h-4 px-1 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-neutral-800 border border-neutral-700 rounded-lg shadow-lg z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700">
            <span className="text-sm font-medium text-neutral-100">Notifications</span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-xs text-indigo-300 hover:text-indigo-200"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {(notifications?.items ?? []).length === 0 ? (
              <div className="px-4 py-6 text-sm text-neutral-400">No notifications yet.</div>
            ) : (
              notifications?.items.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleOpenNotification(item.id, item.deepLink)}
                  className={`w-full text-left px-4 py-3 border-b border-neutral-700/60 hover:bg-neutral-700/40 ${
                    item.readAt ? 'opacity-70' : ''
                  }`}
                >
                  <div className="text-sm font-medium text-neutral-100">{item.title}</div>
                  <div className="mt-1 text-xs text-neutral-300 line-clamp-2">{item.body}</div>
                  <div className="mt-2 text-[11px] text-neutral-500">
                    {new Date(item.createdAt).toLocaleString()}
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="px-4 py-3 border-t border-neutral-700 space-y-2">
            <button
              type="button"
              onClick={handleEnablePush}
              className="w-full rounded border border-indigo-600/40 bg-indigo-600/10 px-3 py-2 text-xs text-indigo-200 hover:bg-indigo-600/20"
            >
              Enable browser notifications
            </button>
            {pushStatus && <p className="text-xs text-neutral-400">{pushStatus}</p>}
            <Link
              href="/me/profile"
              onClick={() => setOpen(false)}
              className="block text-xs text-neutral-400 hover:text-neutral-200"
            >
              Manage notification preferences
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
