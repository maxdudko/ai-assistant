import type { FC, ReactNode } from 'react';

interface ContactLinkConfig {
  id: string;
  label: string;
  href: string | undefined;
  icon: ReactNode;
  external: boolean;
}

type ContactLink = ContactLinkConfig & { href: string };

function isConfiguredLink(link: ContactLinkConfig): link is ContactLink {
  return Boolean(link.href);
}

function trimEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function toHref(value: string | undefined, kind: 'url' | 'email'): string | undefined {
  const trimmed = trimEnv(value);
  if (!trimmed) return undefined;
  if (kind === 'email' && !trimmed.startsWith('mailto:') && !/^https?:\/\//i.test(trimmed)) {
    return `mailto:${trimmed}`;
  }
  return trimmed;
}

const iconClassName = 'h-4 w-4 shrink-0 text-[#615FFF]';

const GlobeIcon = () => (
  <svg className={iconClassName} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
    <path
      d="M3.5 12h17M12 3c2.6 2.6 3.9 5.7 3.9 9s-1.3 6.4-3.9 9c-2.6-2.6-3.9-5.7-3.9-9s1.3-6.4 3.9-9Z"
      stroke="currentColor"
      strokeWidth="1.8"
    />
  </svg>
);

const LinkedInIcon = () => (
  <svg className={iconClassName} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M19.7 3H4.3A1.3 1.3 0 0 0 3 4.3v15.4A1.3 1.3 0 0 0 4.3 21h15.4a1.3 1.3 0 0 0 1.3-1.3V4.3A1.3 1.3 0 0 0 19.7 3ZM8.3 18.3H5.7V9.7h2.6v8.6ZM7 8.5A1.5 1.5 0 1 1 7 5.5a1.5 1.5 0 0 1 0 3ZM18.3 18.3h-2.6v-4.2c0-1 0-2.3-1.4-2.3s-1.6 1.1-1.6 2.2v4.3H10V9.7h2.5v1.2h.1a2.7 2.7 0 0 1 2.5-1.4c2.6 0 3.2 1.7 3.2 4v4.8Z" />
  </svg>
);

const MailIcon = () => (
  <svg className={iconClassName} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3.5" y="5.5" width="17" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
    <path d="M5 8l7 5 7-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const GitHubIcon = () => (
  <svg className={iconClassName} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.269 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.523 2 12 2Z" />
  </svg>
);

const ContactLinks: FC = () => {
  const candidates: ContactLinkConfig[] = [
    {
      id: 'landing',
      label: 'My Landing',
      href: toHref(process.env.NEXT_PUBLIC_CONTACT_LANDING_URL, 'url'),
      icon: <GlobeIcon />,
      external: true,
    },
    {
      id: 'linkedin',
      label: 'LinkedIn',
      href: toHref(process.env.NEXT_PUBLIC_CONTACT_LINKEDIN_URL, 'url'),
      icon: <LinkedInIcon />,
      external: true,
    },
    {
      id: 'email',
      label: 'Email',
      href: toHref(process.env.NEXT_PUBLIC_CONTACT_EMAIL, 'email'),
      icon: <MailIcon />,
      external: false,
    },
    {
      id: 'github',
      label: 'GitHub',
      href: toHref(process.env.NEXT_PUBLIC_GITHUB_URL, 'url'),
      icon: <GitHubIcon />,
      external: true,
    },
  ];
  const links = candidates.filter(isConfiguredLink);

  if (links.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Contact links">
      <ul className="flex flex-wrap items-center justify-center gap-3">
        {links.map(link => (
          <li key={link.id}>
            <a
              href={link.href}
              target={link.external ? '_blank' : undefined}
              rel={link.external ? 'noopener noreferrer' : undefined}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-5 py-2.5 text-sm font-medium text-neutral-100 transition-colors hover:border-white/30 hover:bg-white/5"
            >
              {link.icon}
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default ContactLinks;
