import Button from '@/components/common/button';
import Container from '@/components/common/container';

export default function Home() {
  const howItWorks = [
    {
      title: '1. Capture Your Days',
      points: ['Tasks', 'Reflections', 'Conversations', 'Decisions'],
    },
    {
      title: '2. Detect Patterns',
      points: ['Procrastination', 'Overload', 'Productivity peaks', 'Recurring behaviors'],
    },
    {
      title: '3. Generate Insights',
      points: ['Weekly reports', 'Goal alignment', 'Reality checks', 'Actionable observations'],
    },
  ];

  const differentiators = [
    {
      title: 'Long-Term Memory',
      description: 'MIRA remembers important patterns and insights across weeks and months.',
    },
    {
      title: 'Behavioral Analysis',
      description: 'Detects recurring behaviors instead of simply tracking completed tasks.',
    },
    {
      title: 'Goal Alignment',
      description: 'Shows whether your daily actions actually contribute to your long-term goals.',
    },
    {
      title: 'Reality Checks',
      description: 'TruthLens compares perception with evidence to reduce self-deception.',
    },
  ];

  const reflectionCycle = ['Day', 'Reflection', 'Pattern Detection', 'Insight', 'Better Decisions'];

  const exampleInsight = [
    '78% of completed tasks were low-impact',
    'Most postponed tasks required deep focus',
    'Your productivity peaked between 09:00–12:00',
  ];

  return (
    <main className="flex min-h-screen flex-col items-center px-4 py-12">
      <Container className="w-full max-w-5xl space-y-16 p-4 md:p-8">
        <section className="space-y-5 text-center">
          <p className="text-sm font-medium tracking-wide text-indigo-400 uppercase md:text-base">
            Personal Intelligence System
          </p>
          <h1 className="text-4xl font-bold text-neutral-50 md:text-6xl">AI Daily OS</h1>
          <h2 className="mx-auto max-w-3xl text-xl font-semibold text-neutral-200 md:text-3xl">
            MIRA helps you discover patterns, make better decisions, and stay aligned with your
            goals.
          </h2>
          <p className="mx-auto max-w-3xl text-base leading-relaxed text-neutral-400 md:text-lg">
            Most AI assistants answer questions. MIRA helps you understand why you make certain
            decisions, where your time goes, and what actually moves you forward.
          </p>
          <div className="mx-auto grid max-w-3xl gap-3 text-left text-sm sm:grid-cols-2 md:text-base">
            <p className="text-neutral-400">Instead of collecting endless productivity data…</p>
            <p className="font-medium text-neutral-100">Discover meaningful patterns.</p>

            <p className="text-neutral-400">Instead of guessing why progress feels slow…</p>
            <p className="font-medium text-neutral-100">See where your effort actually goes.</p>

            <p className="text-neutral-400">Instead of relying on motivation…</p>
            <p className="font-medium text-neutral-100">Build self-awareness.</p>
          </div>
          <div className="flex flex-col items-center justify-center gap-4 pt-4 sm:flex-row">
            <Button
              type="link"
              href="/auth/register"
              content="Get Early Access"
              className="w-full bg-indigo-500 sm:w-auto"
            />
            <Button type="link" href="/auth/login" content="Login" className="w-full sm:w-auto" />
          </div>
        </section>

        <section className="space-y-6 border-t border-[#6366F133] pt-10">
          <h3 className="text-center text-2xl font-semibold text-neutral-50 md:text-3xl">
            Example Weekly Insight
          </h3>
          <div className="mx-auto max-w-3xl space-y-4 rounded-lg border border-[#6366F133] bg-neutral-900/40 p-6">
            <p className="text-sm font-medium text-neutral-300">This week:</p>
            <ul className="space-y-2 text-sm text-neutral-400 md:text-base">
              {exampleInsight.map(item => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-0.5 text-indigo-400">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="border-t border-[#6366F133] pt-4 text-sm text-neutral-200 md:text-base">
              <span className="font-semibold text-indigo-300">Insight:</span> You are staying busy,
              but consistently avoiding cognitively demanding work.
            </p>
          </div>
        </section>

        <section className="space-y-6 border-t border-[#6366F133] pt-10">
          <h3 className="text-center text-2xl font-semibold text-neutral-50 md:text-3xl">
            How It Works
          </h3>
          <p className="mx-auto max-w-3xl text-center text-neutral-400">
            AI Daily OS is not a todo app. It is a system that continuously understands your day.
          </p>
          <div className="grid gap-6 md:grid-cols-3">
            {howItWorks.map(step => (
              <article
                key={step.title}
                className="space-y-3 rounded-lg border border-[#6366F133] bg-neutral-900/40 p-5"
              >
                <h4 className="text-lg font-semibold text-neutral-100">{step.title}</h4>
                <ul className="space-y-2 text-sm text-neutral-400">
                  {step.points.map(point => (
                    <li key={point} className="flex items-start gap-2">
                      <span className="mt-0.5 text-indigo-400">–</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-6 border-t border-[#6366F133] pt-10">
          <h3 className="text-center text-2xl font-semibold text-neutral-50 md:text-3xl">
            TruthLens
          </h3>
          <p className="mx-auto max-w-3xl text-center text-neutral-400">
            Compare perception with reality using your own data.
          </p>
          <div className="mx-auto max-w-3xl space-y-4 rounded-lg border border-[#6366F133] bg-neutral-900/40 p-6">
            <p className="text-sm text-neutral-400 md:text-base">
              <span className="font-semibold text-neutral-200">You:</span> &ldquo;I did nothing
              today.&rdquo;
            </p>
            <div className="space-y-2 text-sm text-neutral-400 md:text-base">
              <p className="font-semibold text-neutral-200">TruthLens — completed:</p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-indigo-400">•</span>
                  <span>4 tasks</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-indigo-400">•</span>
                  <span>2 high-priority tasks</span>
                </li>
              </ul>
            </div>
            <p className="border-t border-[#6366F133] pt-4 text-sm text-neutral-200 md:text-base">
              <span className="font-semibold text-indigo-300">Conclusion:</span> Your perception was
              harsher than reality.
            </p>
          </div>
        </section>

        <section className="space-y-6 border-t border-[#6366F133] pt-10">
          <h3 className="text-center text-2xl font-semibold text-neutral-50 md:text-3xl">
            What Makes It Different
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {differentiators.map(item => (
              <article
                key={item.title}
                className="space-y-2 rounded-lg border border-[#6366F133] bg-neutral-900/40 p-5"
              >
                <h4 className="text-lg font-semibold text-neutral-100">{item.title}</h4>
                <p className="text-sm leading-relaxed text-neutral-400 md:text-base">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-6 border-t border-[#6366F133] pt-10">
          <h3 className="text-center text-2xl font-semibold text-neutral-50 md:text-3xl">
            Reflection Cycle
          </h3>
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-3">
            {reflectionCycle.map((step, index) => (
              <div key={step} className="flex items-center gap-3">
                <span className="rounded-lg border border-[#6366F133] bg-neutral-900/40 px-4 py-2 text-sm font-medium text-neutral-200 md:text-base">
                  {step}
                </span>
                {index < reflectionCycle.length - 1 && <span className="text-indigo-400">→</span>}
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6 border-t border-[#6366F133] pt-10">
          <h3 className="text-center text-2xl font-semibold text-neutral-50 md:text-3xl">
            Built for Control
          </h3>
          <ul className="mx-auto max-w-2xl space-y-2 text-neutral-400">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-indigo-400">–</span>
              <span>Nothing executes without confirmation.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-indigo-400">–</span>
              <span>Every action can be undone.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-indigo-400">–</span>
              <span>Full transparency on why decisions are made.</span>
            </li>
          </ul>
        </section>

        <section className="space-y-6 border-t border-[#6366F133] pt-10 text-center">
          <h3 className="text-2xl font-semibold text-neutral-50 md:text-3xl">Who Is It For?</h3>
          <p className="mx-auto max-w-2xl text-neutral-400">
            Engineers and builders, founders, knowledge workers, and anyone tired of managing tasks
            manually.
          </p>
          <h3 className="pt-4 text-2xl font-semibold text-neutral-50 md:text-3xl">Vision</h3>
          <p className="mx-auto max-w-3xl text-neutral-400">
            AI Daily OS is a personal operating system that understands your behavior, helps you
            make better decisions, and evolves with you.
          </p>
        </section>

        <section className="space-y-5 border-t border-[#6366F133] pt-10 text-center">
          <h3 className="text-2xl font-semibold text-neutral-50 md:text-3xl">
            Start Running Your Day &amp; Understanding Yourself
          </h3>
          <p className="mx-auto max-w-2xl text-neutral-400">
            Join the beta and help shape the future of personal AI.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 pt-2 sm:flex-row">
            <Button
              type="link"
              href="/auth/register"
              content="Get Early Access"
              className="w-full bg-indigo-500 sm:w-auto"
            />
            <Button type="link" href="/auth/login" content="Login" className="w-full sm:w-auto" />
          </div>
        </section>

        <section className="space-y-3 border-t border-[#6366F133] pt-8 text-center">
          <h3 className="text-xl font-semibold text-neutral-50 md:text-2xl">Contact</h3>
          <p className="mx-auto max-w-2xl text-neutral-400">
            Built by engineers who were tired of broken productivity systems. Let&apos;s build a
            better way to work.
          </p>
        </section>
      </Container>
    </main>
  );
}
