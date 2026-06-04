const docLinks = [
  { href: 'README.md', icon: '📋', label: 'Project Readme' },
  { href: 'docs/idea.md', icon: '💡', label: 'Project Idea' },
  { href: 'docs/specification.md', icon: '📐', label: 'Technical Specification' },
  { href: 'docs/architecture.md', icon: '🏗️', label: 'Project Architecture' },
  { href: 'docs/roadmap.md', icon: '📅', label: 'Roadmap' },
] as const;

export default function AdminDashboardPage() {
  const gitHubUrl = 'https://github.com/maxdudko/ai-assistant/blob/main';

  return (
    <main className="rounded border border-neutral-800 bg-neutral-900/50 p-6">
      <h2 className="text-xl font-semibold mb-2">Dashboard</h2>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        {docLinks.map(link => (
          <a
            key={link.href}
            href={`${gitHubUrl}/${link.href}`}
            target="_blank"
            rel="noreferrer"
            className="flex justify-center items-center rounded border border-neutral-800 bg-neutral-900 p-4 transition-colors hover:border-neutral-600 hover:bg-neutral-800"
          >
            <span className="text-2xl" aria-hidden>
              {link.icon}
            </span>
            <span className="mt-2 block font-medium text-neutral-100">{link.label}</span>
          </a>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
        <a
          href={`http://localhost:3000/`}
          target="_blank"
          className="flex justify-center items-center rounded border border-neutral-800 bg-neutral-900 p-4 transition-colors hover:border-neutral-600 hover:bg-neutral-800"
          rel="noreferrer"
        >
          🌐 Frontend (localhost:3000)
        </a>
        <a
          href={`http://localhost:4000/`}
          target="_blank"
          className="flex justify-center items-center rounded border border-neutral-800 bg-neutral-900 p-4 transition-colors hover:border-neutral-600 hover:bg-neutral-800"
          rel="noreferrer"
        >
          ⚡ Backend (localhost:4000)
        </a>
      </div>
    </main>
  );
}
