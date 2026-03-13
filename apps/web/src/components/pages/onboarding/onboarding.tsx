'use client';

import type { FC } from 'react';
import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/lib/api/AuthContext';
import { userApi } from '@/lib/api/user';
import type {
  HelpStyleOption,
  PrimaryUseCaseOption,
  TimePreferenceOption,
  ToneOption,
  VerbosityOption,
} from '@/lib/api/types';
import Container from '@/components/common/container';
import Button from '@/components/common/button';

type Step = 1 | 2 | 3;

const Onboarding: FC = () => {
  const router = useRouter();
  const { refresh, user, loading: authLoading } = useAuth();
  const [step, setStep] = useState<Step>(1);

  // Step 2 form state
  const [name, setName] = useState('');
  const [tone, setTone] = useState<ToneOption>('neutral');
  const [verbosity, setVerbosity] = useState<VerbosityOption>('normal');
  const [primaryUseCase, setPrimaryUseCase] = useState<PrimaryUseCaseOption>('mixed');
  const [helpStyle, setHelpStyle] = useState<HelpStyleOption>('passive');
  const [dayPlanningTime, setDayPlanningTime] = useState<TimePreferenceOption>('anytime');
  const [reflectionTime, setReflectionTime] = useState<TimePreferenceOption>('anytime');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace('/auth/login');
      return;
    }

    if (user.profile?.onboardingCompleted) {
      router.replace('/me');
    }
  }, [authLoading, user, router]);

  const handleNext = useCallback(() => {
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      // Validate step 2 before proceeding
      if (!name.trim()) {
        setError('Please enter your name');
        return;
      } else {
        setError(null);
      }
      setStep(3);
    }
  }, [step, name]);

  const handleComplete = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await userApi.updateMe({
        profile: {
          displayName: name,
          tone: tone as ToneOption,
          verbosity: verbosity as VerbosityOption,
          primaryUseCase,
          helpStyle,
          dayPlanningTime,
          reflectionTime,
          onboardingCompleted: true,
        },
      });

      await refresh();
      router.push('/me');
    } catch (error) {
      console.error('Onboarding failed:', error);
      setError('Failed to save your preferences. Please try again.');
      setLoading(false);
    }
  }, [
    name,
    tone,
    verbosity,
    primaryUseCase,
    helpStyle,
    dayPlanningTime,
    reflectionTime,
    refresh,
    router,
  ]);

  if (authLoading || !user || user.profile?.onboardingCompleted) {
    return <Container className="w-full max-w-2xl rounded-xl bg-neutral-900 p-6" />;
  }

  const renderStep1 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold mb-2">👋 Welcome! My name is Mira 💕</h2>
      <p className="text-lg mb-2">
        I am your thoughtful personal companion for thinking, planning and reflection.
      </p>
      <p className="text-lg mb-2">I will help you:</p>
      <ul className="space-y-2 text-neutral-300">
        <li>✅ Manage your daily tasks and goals;</li>
        <li>🧠 Reflect on your day and learn from your experiences;</li>
        <li>⏰ Plan your day effectively and mindfully;</li>
        <li>🎯 Stay focused on what matters most to you;</li>
        <li>💡 And much more, tailored to your needs and preferences!</li>
      </ul>
      <Button type="button" onClick={handleNext} content="Next" className="w-full" />
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">
        Let&apos;s configure your personal profile and preferences:
      </h2>

      <div className="space-y-4">
        <div>
          <label htmlFor="name" className="mb-2 block text-sm font-medium text-neutral-300">
            What is your name?
          </label>
          <input
            name="name"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full rounded bg-neutral-800 p-2"
            placeholder="Your name"
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="tone" className="mb-2 block text-sm font-medium text-neutral-300">
            What tone do you prefer in my responses?
          </label>
          {(
            ['neutral', 'friendly', 'professional', 'casual', 'humorous', 'empathetic'] as const
          ).map(option => (
            <label key={option} className="flex items-center gap-2">
              <input
                type="radio"
                name="tone"
                value={option}
                checked={tone === option}
                onChange={() => setTone(option)}
                className="rounded"
              />
              <span className="capitalize">{option}</span>
            </label>
          ))}
        </div>

        <div>
          <label htmlFor="verbosity" className="mb-2 block text-sm font-medium text-neutral-300">
            How do you prefer me to answer?
          </label>
          <div className="space-y-2">
            {(['short', 'normal', 'detailed'] as const).map(option => (
              <label key={option} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="verbosity"
                  value={option}
                  checked={verbosity === option}
                  onChange={() => setVerbosity(option)}
                  className="rounded"
                />
                <span className="capitalize">{option}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="helpStyle" className="mb-2 block text-sm font-medium text-neutral-300">
            Do you want me to offer help myself, or just respond to requests?
          </label>
          <div className="space-y-2">
            {(['active', 'passive'] as const).map(option => (
              <label key={option} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="helpStyle"
                  value={option}
                  checked={helpStyle === option}
                  onChange={() => setHelpStyle(option)}
                  className="rounded"
                />
                <span className="capitalize">
                  {option === 'active'
                    ? 'Active (I will offer help myself)'
                    : 'Passive (Just respond to requests)'}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label
            htmlFor="primaryUseCase"
            className="mb-2 block text-sm font-medium text-neutral-300"
          >
            What is your primary use case?
          </label>
          <div className="space-y-2">
            {(['day-planning', 'task-tracking', 'reflection', 'mixed'] as const).map(option => (
              <label key={option} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="primaryUseCase"
                  value={option}
                  checked={primaryUseCase === option}
                  onChange={() => setPrimaryUseCase(option)}
                  className="rounded"
                />
                <span className="capitalize">{option.replace('-', ' ')}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label
            htmlFor="dayPlanningTime"
            className="mb-2 block text-sm font-medium text-neutral-300"
          >
            When is it usually more convenient for you to plan your day?
          </label>
          <div className="space-y-2">
            {(['morning', 'evening', 'anytime'] as const).map(option => (
              <label key={option} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="dayPlanningTime"
                  value={option}
                  checked={dayPlanningTime === option}
                  onChange={() => setDayPlanningTime(option)}
                  className="rounded"
                />
                <span className="capitalize">{option}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label
            htmlFor="reflectionTime"
            className="mb-2 block text-sm font-medium text-neutral-300"
          >
            When is it usually more convenient for you to reflect on your day?
          </label>
          <div className="space-y-2">
            {(['morning', 'evening', 'anytime'] as const).map(option => (
              <label key={option} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="reflectionTime"
                  value={option}
                  checked={reflectionTime === option}
                  onChange={() => setReflectionTime(option)}
                  className="rounded"
                />
                <span className="capitalize">{option}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <p className="text-sm text-neutral-400">
        You can change your answers later in the profile settings.
      </p>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <Button type="button" onClick={handleNext} content="Next" className="w-full" />
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Congratulations 🎉</h2>
      <p className="text-lg">Your profile and preferences are successfully configured ⚙️</p>
      <p className="text-lg">
        Nice to meet you, <span className="font-semibold">{name || 'there'}</span> 🤗
      </p>
      <p className="text-lg">Let&apos;s start your journey! 🚀</p>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <Button
        type="button"
        onClick={handleComplete}
        disabled={loading}
        content={loading ? 'Saving...' : 'Start'}
        className="w-full"
      />
    </div>
  );

  return (
    <Container className="w-full max-w-2xl space-y-4 rounded-xl bg-neutral-900 p-6">
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
    </Container>
  );
};

export default Onboarding;
