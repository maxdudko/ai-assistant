import Button from '@/components/common/button';
import Container from '@/components/common/container';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Container className="max-w-4xl w-full space-y-8 text-center p-4 md:p-8">
        {/* Hero Section */}
        <div className="space-y-4">
          <h1 className="text-2xl md:text-4xl font-bold text-white-900">Personal AI Assistant</h1>
          <p className="text-xl md:text-2xl text-white-600 font-medium">
            v0.1 — Personal Daily Manager
          </p>
          <p className="text-lg text-white-500 max-w-2xl mx-auto">
            Your AI-powered assistant for managing daily life, reducing cognitive load, and thinking
            more clearly
          </p>
        </div>

        {/* Main Value Proposition */}
        <div className="py-8 space-y-6">
          <p className="text-base md:text-lg text-white-700 leading-relaxed max-w-2xl mx-auto">
            This is a <strong>stateful personal AI agent</strong> that understands your context
            through long-term memory. Unlike generic chatbots, it remembers your preferences,
            patterns, and habits, making interactions increasingly relevant and personalized.
          </p>

          <div className="flex flex-wrap justify-center gap-4 pt-4">
            <div className="flex items-center gap-2 text-sm text-white-600">
              <span className="text-green-500">✓</span>
              <span>Long-term memory</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-white-600">
              <span className="text-green-500">✓</span>
              <span>Task & goal management</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-white-600">
              <span className="text-green-500">✓</span>
              <span>Personalized responses</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-white-600">
              <span className="text-green-500">✓</span>
              <span>Daily planning assistance</span>
            </div>
          </div>
        </div>

        {/* Core Principle */}
        <div className="py-6 border-t border-white-200">
          <p className="text-sm md:text-base text-white-600 italic max-w-xl mx-auto">
            &#34;Augmenting individual autonomy, clarity, and control — not replacing humans with
            AI.&#34;
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
          <Button
            type="link"
            href="/auth/register"
            content="Get Started"
            className="min-w-38 w-full sm:w-auto px-8 py-3 bg-white-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors duration-200 shadow-md hover:shadow-lg"
          ></Button>
          <Button
            type="link"
            href="/auth/login"
            content="Login"
            className="min-w-38 w-full sm:w-auto px-8 py-3 text-white-900 font-semibold rounded-lg border-2 border-gray-300 hover:border-gray-400 transition-colors duration-200 shadow-sm hover:shadow-md"
          ></Button>
        </div>
      </Container>
    </main>
  );
}
