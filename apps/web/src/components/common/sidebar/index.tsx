'use client';

import type { FC } from 'react';
import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

import { authApi } from '@/lib/api/auth';
import { useAuth } from '@/lib/api/AuthContext';
import NotificationBell from '@/components/common/notifications/notification-bell';

// Navigation items for left sidebar
const navItems = [
  { href: '/me', label: 'Dashboard', icon: DashboardIcon },
  { href: '/me/chat', label: 'Chat', icon: ChatIcon },
  { href: '/me/conversations', label: 'Conversations', icon: ConversationsIcon },
  { href: '/me/tasks', label: 'Tasks', icon: TasksIcon },
  { href: '/me/goals', label: 'Goals', icon: GoalsIcon },
  { href: '/me/insights', label: 'Insights', icon: InsightsIcon },
  { href: '/me/info-digests', label: 'Info Digests', icon: InfoDigestsIcon },
  { href: '/me/memory', label: 'Memory', icon: MemoryIcon },
  { href: '/me/logs', label: 'Logs', icon: LogsIcon },
];

// Icon components
function DashboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
      />
    </svg>
  );
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  );
}

function ConversationsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
      />
    </svg>
  );
}

function TasksIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
      />
    </svg>
  );
}

function GoalsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
      />
    </svg>
  );
}

function InsightsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 17l5-5 4 4 8-8m0 0v6m0-6h-6"
      />
    </svg>
  );
}

function SubscriptionIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
      />
    </svg>
  );
}

function ProfileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function InfoDigestsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
      />
    </svg>
  );
}

function MemoryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
      />
    </svg>
  );
}

function LogsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-6 0v-1m6-10V5a3 3 0 00-6 0v1a3 3 0 006 0z"
      />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

// Top Navbar Component
const TopNavbar: FC = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const profileLinkClass = `flex gap-2 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-700 transition-colors ${pathname === '/me/profile' ? 'text-indigo-400' : 'text-neutral-400 group-hover:text-neutral-200'}`;
  const subscriptionLinkClass = `flex gap-2 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-700 transition-colors ${pathname === '/me/subscription' ? 'text-indigo-400' : 'text-neutral-400 group-hover:text-neutral-200'}`;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } finally {
      router.push('/auth/login');
    }
  };

  const userInitials = user?.profile?.displayName
    ? user.profile.displayName.charAt(0).toUpperCase()
    : user?.email?.charAt(0).toUpperCase() || 'U';

  return (
    <nav className="h-16 border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-between px-4 md:px-6 sticky top-0 z-50">
      {/* Logo */}
      <Link href="/me" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
        <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
          <span className="text-white font-bold text-lg">AI</span>
        </div>
        <span className="hidden md:block text-xl font-semibold text-neutral-100">Assistant</span>
      </Link>

      {/* Right side: Notifications and User */}
      <div className="flex items-center gap-3">
        <NotificationBell />

        {/* User Avatar Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-10 p-1 rounded-full hover:bg-neutral-800 transition-colors hover:cursor-pointer"
            aria-label="User menu"
          >
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-medium text-sm">
              {userInitials}
            </div>
            <ChevronDownIcon className="w-4 h-4 text-neutral-300 hidden md:block" />
          </button>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-neutral-800 border border-neutral-700 rounded-lg shadow-lg py-1 z-50">
              <Link
                href="/me/profile"
                onClick={() => setDropdownOpen(false)}
                className={profileLinkClass}
              >
                <ProfileIcon className="w-5 h-5 shrink-0" />
                Profile
              </Link>
              <Link
                href="/me/subscription"
                onClick={() => setDropdownOpen(false)}
                className={subscriptionLinkClass}
              >
                <SubscriptionIcon className="w-5 h-5 shrink-0" />
                Subscription
              </Link>
              <button
                onClick={handleLogout}
                className="flex gap-2 w-full text-left px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-700 transition-colors cursor-pointer"
              >
                <LogoutIcon
                  className={`w-5 h-5 flex-shrink-0 text-neutral-400 group-hover:text-neutral-200`}
                />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

// Left Sidebar Component
const LeftSidebar: FC = () => {
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <aside
      className={`
        fixed md:absolute
        top-16 md:top-0 left-0
        h-[calc(100vh-4rem)] md:h-full
        bg-neutral-900/95 md:bg-neutral-900/50
        backdrop-blur-sm
        border-r border-neutral-800
        z-30
        w-16 md:w-64
      `}
    >
      <nav className="flex flex-col gap-1 p-2 md:p-4 h-full">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <div key={item.href} className="relative group">
              <Link
                href={item.href}
                className={`
                  flex items-center
                  ${isMobile ? 'justify-center w-12 h-12' : 'justify-start gap-3 px-3 py-2.5'}
                  rounded-lg
                  transition-all
                  ${
                    isActive
                      ? 'bg-indigo-500/20 border border-indigo-500/50'
                      : 'hover:bg-neutral-800/50'
                  }
                `}
                title={isMobile ? item.label : undefined}
              >
                <Icon
                  className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-indigo-400' : 'text-neutral-400 group-hover:text-neutral-200'}`}
                />
                {/* Text label - only visible on desktop */}
                {!isMobile && (
                  <span className="text-neutral-300 whitespace-nowrap">{item.label}</span>
                )}
              </Link>
              {/* Tooltip - only visible on mobile */}
              {isMobile && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-neutral-800 text-neutral-200 text-sm rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50 border border-neutral-700">
                  {item.label}
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-neutral-800"></div>
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
};

// Main Sidebar Component (exports both navbar and sidebar)
const Sidebar: FC = () => {
  return (
    <>
      <TopNavbar />
      <LeftSidebar />
    </>
  );
};

export default Sidebar;
export { TopNavbar, LeftSidebar };
