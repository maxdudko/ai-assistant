import Button from '@/components/common/button';
import Container from '@/components/common/container';

export default function Home() {
  const howItWorks = [
    {
      title: '1. Understands Your Context',
      points: ['Your tasks', 'Your patterns', 'Your past behavior', 'Your available time'],
    },
    {
      title: '2. Decides What Matters',
      points: [
        'Detects overload',
        'Finds your most impactful tasks',
        "Identifies when you're stuck",
      ],
    },
    {
      title: '3. Takes Action With You',
      points: [
        'Suggests concrete actions',
        'Waits for your confirmation',
        'Executes safely (with undo)',
      ],
    },
  ];

  const differentiators = [
    {
      title: 'Real Daily Engine',
      description:
        'Not reminders. A system that reacts to your activity, time of day, and energy patterns.',
    },
    {
      title: 'Smart Decisions',
      description:
        'Not random AI advice. Deterministic decisions based on workload, deadlines, and behavior patterns.',
    },
    {
      title: 'Action System',
      description:
        'Not just suggestions: simplify your day, split complex tasks, and reschedule intelligently with full control and undo.',
    },
    {
      title: 'Memory That Learns',
      description: 'Remembers what works for you, adapts to your habits, and improves over time.',
    },
  ];

  return (
    <main className="flex min-h-screen flex-col items-center px-4 py-12">
      <Container className="max-w-5xl w-full space-y-12 p-4 md:p-8">
        <section className="space-y-5 text-center">
          <p className="text-sm md:text-base font-medium text-white-600">
            Your Personal Operating System for Every Day
          </p>
          <h1 className="text-3xl md:text-5xl font-bold text-white-900">AI Daily OS</h1>
          <h2 className="text-xl md:text-3xl font-semibold text-white-700">
            Stop Managing Tasks. Start Running Your Day.
          </h2>
          <p className="text-base md:text-lg text-white-600 max-w-3xl mx-auto leading-relaxed">
            Most productivity tools give you lists. AI Daily OS gives you decisions so you can
            execute with clarity instead of constantly wondering what to do next.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 text-sm md:text-base max-w-2xl mx-auto text-left">
            <p className="text-white-600">Instead of asking what to do next...</p>
            <p className="text-white-700 font-medium">You get clear priorities.</p>
            <p className="text-white-600">Instead of guessing if you are overloaded...</p>
            <p className="text-white-700 font-medium">You get smart nudges.</p>
            <p className="text-white-600">Instead of planning from scratch every day...</p>
            <p className="text-white-700 font-medium">You get automatic planning.</p>
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
            Example Flow
          </h3>
          <div className="grid gap-4 md:grid-cols-3">
            <article className="rounded-lg border border-[#6366F133] p-5 space-y-3">
              <h4 className="text-lg font-semibold text-white-800">Morning</h4>
              <p className="text-sm text-white-600">
                You planned 6 hours, but only have 3 available. Keep 2 tasks and move the rest.
              </p>
            </article>
            <article className="rounded-lg border border-[#6366F133] p-5 space-y-3">
              <h4 className="text-lg font-semibold text-white-800">Afternoon</h4>
              <p className="text-sm text-white-600">
                The system detects you have been stuck for 2 hours and suggests smaller concrete
                steps.
              </p>
            </article>
            <article className="rounded-lg border border-[#6366F133] p-5 space-y-3">
              <h4 className="text-lg font-semibold text-white-800">Evening</h4>
              <p className="text-sm text-white-600">
                You reflect on what worked and what did not while patterns are updated
                automatically.
              </p>
            </article>
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
            Start Running Your Day
          </h3>
          <p className="text-white-600 max-w-2xl mx-auto">
            Stop planning endlessly. Start executing intelligently.
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
