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

  return (
    <main className="flex min-h-screen flex-col items-center px-4 py-12">
      <Container className="max-w-5xl w-full space-y-12 p-4 md:p-8">
        <section className="space-y-5 text-center">
          <p className="text-sm md:text-base font-medium text-white-600">
            Personal Intelligence System
          </p>
          <h1 className="text-3xl md:text-5xl font-bold text-white-900">AI Daily OS</h1>
          <h2 className="text-xl md:text-3xl font-semibold text-white-700">
            MIRA helps you discover patterns, make better decisions, and stay aligned with your
            goals.
          </h2>
          <p className="text-base md:text-lg text-white-600 max-w-3xl mx-auto leading-relaxed">
            Most AI assistants answer questions. MIRA helps you understand why you make certain
            where your time goes, and what actually moves you forward.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 text-sm md:text-base max-w-3xl mx-auto text-left">
            <p className="text-white-600">Instead of collecting endless productivity data...</p>
            <p className="text-white-700 font-medium">Discover meaningful patterns.</p>

            <p className="text-white-600">Instead of guessing why progress feels slow...</p>
            <p className="text-white-700 font-medium">See where your effort actually goes.</p>

            <p className="text-white-600">Instead of relying on motivation...</p>
            <p className="text-white-700 font-medium">Build self-awareness.</p>
          </div>
        </section>

        <section className="space-y-6 border-t border-[#6366F133] pt-10">
          <h3 className="text-2xl md:text-3xl font-semibold text-white-900 text-center">
            Example Weekly Insight
          </h3>

          <div className="max-w-3xl mx-auto rounded-lg border border-[#6366F133] p-6 space-y-4">
            This week: • 78% of completed tasks were low-impact • Most postponed tasks required deep
            focus focus • Your productivity peaked between 09:00–12:00 Insight: You are staying
            busy, but but consistently avoiding cognitively demanding work.
          </div>
        </section>

        <section className="space-y-6 border-t border-[#6366F133] pt-10">
          <h3 className="text-2xl md:text-3xl font-semibold text-white-900 text-center">
            How It Works
          </h3>
          <p className="text-white-600 text-center max-w-3xl mx-auto">
            AI Daily OS is not a todo app. It is a system that continuously understands your day.
          </p>
          <div className="grid gap-6 md:grid-cols-3">
            {howItWorks.map(step => (
              <article
                key={step.title}
                className="rounded-lg border border-[#6366F133] p-5 space-y-3"
              >
                <h4 className="text-lg font-semibold text-white-800">{step.title}</h4>
                <ul className="space-y-2 text-sm text-white-600">
                  {step.points.map(point => (
                    <li key={point} className="flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">-</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-6 border-t border-[#6366F133] pt-10">
          <h3 className="text-2xl md:text-3xl font-semibold text-white-900 text-center">
            TruthLens
          </h3>
          <p className="text-center text-white-600 max-w-3xl mx-auto">
            Compare perception with reality using your own data.
          </p>
          <div className="max-w-3xl mx-auto rounded-lg border border-[#6366F133] p-6 space-y-4">
            You: &#34;I did nothing today.&#34; TruthLens: Completed: • 4 tasks • 2 high-priority
            tasks Conclusion: Your perception was harsher than reality.
          </div>
        </section>

        <section className="space-y-6 border-t border-[#6366F133] pt-10">
          <h3 className="text-2xl md:text-3xl font-semibold text-white-900 text-center">
            What Makes It Different
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {differentiators.map(item => (
              <article
                key={item.title}
                className="rounded-lg border border-[#6366F133] p-5 space-y-2"
              >
                <h4 className="text-lg font-semibold text-white-800">{item.title}</h4>
                <p className="text-sm md:text-base text-white-600 leading-relaxed">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-5 border-t border-[#6366F133] pt-10">
          <h3 className="text-2xl md:text-3xl font-semibold text-white-900 text-center">
            Reflection Cycle
          </h3>
          <div className="max-w-3xl mx-auto rounded-lg border border-[#6366F133] p-6 space-y-4">
            Day ↓ Reflection ↓ Pattern Detection ↓ Insight ↓ Better Decisions
          </div>
        </section>

        <section className="space-y-6 border-t border-[#6366F133] pt-10">
          <h3 className="text-2xl md:text-3xl font-semibold text-white-900 text-center">
            Built for Control
          </h3>
          <ul className="space-y-2 text-white-600 max-w-2xl mx-auto">
            <li>- Nothing executes without confirmation.</li>
            <li>- Every action can be undone.</li>
            <li>- Full transparency on why decisions are made.</li>
          </ul>
        </section>

        <section className="space-y-6 border-t border-[#6366F133] pt-10 text-center">
          <h3 className="text-2xl md:text-3xl font-semibold text-white-900">Who Is It For?</h3>
          <p className="text-white-600 max-w-2xl mx-auto">
            Engineers and builders, founders, knowledge workers, and anyone tired of managing tasks
            manually.
          </p>
          <h3 className="text-2xl md:text-3xl font-semibold text-white-900 pt-4">Vision</h3>
          <p className="text-white-600 max-w-3xl mx-auto">
            AI Daily OS is a personal operating system that understands your behavior, helps you
            make better decisions, and evolves with you.
          </p>
        </section>

        <section className="space-y-5 border-t border-[#6366F133] pt-10 text-center">
          <h3 className="text-2xl md:text-3xl font-semibold text-white-900">
            Start Running Your Day & And Understanding Yourself
          </h3>
          <p className="text-white-600 max-w-2xl mx-auto">
            Join the beta and help shape the future of personal AI.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-2">
            <Button
              type="link"
              href="/auth/register"
              content="Get Early Access"
              className="min-w-38 w-full sm:w-auto px-8 py-3 bg-white-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors duration-200 shadow-md hover:shadow-lg"
            ></Button>
            <Button
              type="link"
              href="/auth/login"
              content="Login"
              className="min-w-38 w-full sm:w-auto px-8 py-3 text-white-900 font-semibold rounded-lg border-2 border-gray-300 hover:border-gray-400 transition-colors duration-200 shadow-sm hover:shadow-md"
            ></Button>
          </div>
        </section>

        <section className="space-y-3 border-t border-[#6366F133] pt-8 text-center">
          <h3 className="text-xl md:text-2xl font-semibold text-white-900">Contact</h3>
          <p className="text-white-600 max-w-2xl mx-auto">
            Built by engineers who were tired of broken productivity systems. Let&apos;s build a
            better way to work.
          </p>
        </section>
      </Container>
    </main>
  );
}
