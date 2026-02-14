'use client';

import type { FC } from 'react';
import React, { useEffect, useState } from 'react';

import { useAuth } from '@/lib/api/AuthContext';
import { userApi } from '@/lib/api/user';
import type {
  HelpStyleOption,
  PrimaryUseCaseOption,
  TimePreferenceOption,
  ToneOption,
  VerbosityOption,
} from '@/lib/api/types';

const Profile: FC = () => {
  const { user, refresh } = useAuth();

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [tone, setTone] = useState<ToneOption>('neutral');
  const [verbosity, setVerbosity] = useState<VerbosityOption>('normal');
  const [useEmoji, setUseEmoji] = useState(false);
  const [primaryUseCase, setPrimaryUseCase] = useState<PrimaryUseCaseOption>('mixed');
  const [helpStyle, setHelpStyle] = useState<HelpStyleOption>('passive');
  const [dayPlanningTime, setDayPlanningTime] = useState<TimePreferenceOption>('anytime');
  const [reflectionTime, setReflectionTime] = useState<TimePreferenceOption>('anytime');

  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEmail(user.email);
    setDisplayName(user.profile?.displayName ?? '');
    setTone((user.profile?.tone as ToneOption) ?? 'neutral');
    setVerbosity((user.profile?.verbosity as VerbosityOption) ?? 'normal');
    setUseEmoji(user.profile?.useEmoji ?? false);
    setPrimaryUseCase((user.profile?.primaryUseCase as PrimaryUseCaseOption) ?? 'mixed');
    setHelpStyle((user.profile?.helpStyle as HelpStyleOption) ?? 'passive');
    setDayPlanningTime((user.profile?.dayPlanningTime as TimePreferenceOption) ?? 'anytime');
    setReflectionTime((user.profile?.reflectionTime as TimePreferenceOption) ?? 'anytime');
  }, [user]);

  async function onSave() {
    await userApi.updateMe({
      email,
      profile: {
        displayName,
        tone,
        verbosity,
        useEmoji,
        primaryUseCase,
        helpStyle,
        dayPlanningTime,
        reflectionTime,
      },
    });
    await refresh();
  }

  if (!user) return null;

  return (
    <div className="space-y-6 max-w-full 2xl:max-w-2/3">
      <h2 className="text-2xl font-semibold">Profile</h2>

      <div className="grid grid-cols-2 gap-4">
        <section className="space-y-4 rounded-xl bg-neutral-900 p-4">
          <h3 className="text-lg font-medium">Account</h3>
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-neutral-300">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded bg-neutral-800 p-2"
              placeholder="Email"
            />
          </div>
        </section>

        <section className="space-y-4 rounded-xl bg-neutral-900 p-4">
          <h3 className="text-lg font-medium">Personal Information</h3>

          <div>
            <label
              htmlFor="displayName"
              className="mb-2 block text-sm font-medium text-neutral-300"
            >
              Display Name
            </label>
            <input
              id="displayName"
              name="displayName"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="w-full rounded bg-neutral-800 p-2"
              placeholder="Display name"
            />
          </div>
        </section>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <section className="space-y-4 rounded-xl bg-neutral-900 p-4">
          <h3 className="text-lg font-medium">Assistant Preferences</h3>

          <div>
            <label htmlFor="tone" className="mb-2 block text-sm font-medium text-neutral-300">
              What tone do you prefer in my responses?
            </label>
            <div className="space-y-2">
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
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={useEmoji}
                onChange={e => setUseEmoji(e.target.checked)}
                className="rounded"
              />
              Use emoji in responses
            </label>
          </div>
        </section>

        <section className="space-y-4 rounded-xl bg-neutral-900 p-4">
          <h3 className="text-lg font-medium">Usage Preferences</h3>

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
        </section>
      </div>

      <button
        onClick={onSave}
        className="rounded bg-indigo-600 px-4 py-2 font-medium hover:bg-indigo-700 cursor-pointer"
      >
        Save changes
      </button>
    </div>
  );
};

export default Profile;
