'use client';

import type { FC } from 'react';
import React, { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/lib/api/AuthContext';
import { userApi } from '@/lib/api/user';
import { authApi } from '@/lib/api/auth';
import { getNotificationPreferences, updateNotificationPreferences } from '@/lib/api/notifications';
import { queryKeys } from '@/lib/query-keys';
import { registerWebPush } from '@/lib/notifications/push';
import type {
  HelpStyleOption,
  PrimaryUseCaseOption,
  TimePreferenceOption,
  ToneOption,
  VerbosityOption,
} from '@/lib/api/types';
import Container from '@/components/common/container';
import Button from '@/components/common/button';
import PasswordInput from '@/components/common/password-input';

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
  const [pushEnabled, setPushEnabled] = useState(true);
  const [morningBriefingEnabled, setMorningBriefingEnabled] = useState(true);
  const [eveningReflectionEnabled, setEveningReflectionEnabled] = useState(true);
  const [nudgesEnabled, setNudgesEnabled] = useState(true);
  const [weeklyInsightEnabled, setWeeklyInsightEnabled] = useState(true);
  const [pushStatus, setPushStatus] = useState<string | null>(null);

  const { data: notificationPreferences } = useQuery({
    queryKey: queryKeys.notificationPreferences,
    queryFn: getNotificationPreferences,
  });

  const [isChangePasswordFormVisible, setIsChangePasswordFormVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

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

  useEffect(() => {
    if (!notificationPreferences) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPushEnabled(notificationPreferences.pushEnabled);
    setMorningBriefingEnabled(notificationPreferences.morningBriefingEnabled);
    setEveningReflectionEnabled(notificationPreferences.eveningReflectionEnabled);
    setNudgesEnabled(notificationPreferences.nudgesEnabled);
    setWeeklyInsightEnabled(notificationPreferences.weeklyInsightEnabled);
  }, [notificationPreferences]);

  async function onSave() {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
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
        timezone,
      },
    });
    await updateNotificationPreferences({
      pushEnabled,
      morningBriefingEnabled,
      eveningReflectionEnabled,
      nudgesEnabled,
      weeklyInsightEnabled,
    });
    await refresh();
  }

  const onEnablePush = useCallback(async () => {
    setPushStatus(null);
    try {
      const enabled = await registerWebPush();
      setPushStatus(enabled ? 'Browser notifications enabled.' : 'Could not enable push.');
    } catch {
      setPushStatus('Could not enable push notifications.');
    }
  }, []);

  const onChangePassword = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setPasswordError(null);
      setPasswordSuccess(false);
      if (newPassword.length < 8) {
        setPasswordError('New password must be at least 8 characters');
        return;
      }
      if (newPassword !== confirmNewPassword) {
        setPasswordError('New passwords do not match');
        return;
      }
      try {
        await authApi.changePassword({
          currentPassword,
          newPassword,
        });
        setPasswordSuccess(true);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        setIsChangePasswordFormVisible(false);
      } catch (err) {
        console.error('Change password failed:', err);
        setPasswordError('Current password is incorrect or something went wrong.');
      }
    },
    [currentPassword, newPassword, confirmNewPassword],
  );

  if (!user) return null;

  return (
    <div className="space-y-6 max-w-full 2xl:max-w-2/3">
      <h2 className="text-2xl font-semibold">Profile</h2>

      <div className="grid md:grid-cols-2 gap-4">
        <Container className="space-y-4 p-4">
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
          {isChangePasswordFormVisible ? (
            <Container className="space-y-4 p-4">
              <h3 className="text-lg font-medium">Change password</h3>
              <form onSubmit={onChangePassword} className="space-y-4">
                <div>
                  <label
                    htmlFor="currentPassword"
                    className="mb-2 block text-sm font-medium text-neutral-300"
                  >
                    Current password
                  </label>
                  <PasswordInput
                    id="currentPassword"
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    placeholder="Current password"
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="newPassword"
                    className="mb-2 block text-sm font-medium text-neutral-300"
                  >
                    New password
                  </label>
                  <PasswordInput
                    id="newPassword"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="New password (min 8 characters)"
                    minLength={8}
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="confirmNewPassword"
                    className="mb-2 block text-sm font-medium text-neutral-300"
                  >
                    Confirm new password
                  </label>
                  <PasswordInput
                    id="confirmNewPassword"
                    value={confirmNewPassword}
                    onChange={e => setConfirmNewPassword(e.target.value)}
                    placeholder="Confirm new password"
                    minLength={8}
                    required
                  />
                </div>
                {passwordError && <p className="text-red-500 text-sm">{passwordError}</p>}
                {passwordSuccess && (
                  <p className="text-green-500 text-sm">Password updated successfully.</p>
                )}
                <div className="flex justify-end">
                  <Button
                    type="button"
                    content="Cancel"
                    onClick={() => setIsChangePasswordFormVisible(false)}
                    className="mr-2"
                  />
                  <Button type="submit" content="Update password" />
                </div>
              </form>
            </Container>
          ) : (
            <div className="flex justify-end">
              <Button
                type="button"
                content="Change password"
                onClick={() => setIsChangePasswordFormVisible(true)}
              />
            </div>
          )}
        </Container>

        <Container className="space-y-4 p-4">
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
        </Container>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Container className="space-y-4 p-4">
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
        </Container>

        <Container className="space-y-4 p-4">
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
        </Container>
      </div>

      <Container className="space-y-4 p-4">
        <h3 className="text-lg font-medium">Notifications</h3>
        <p className="text-sm text-neutral-400">
          Get morning briefings, evening reflections, and check-ins even when the app is closed.
        </p>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={pushEnabled}
            onChange={e => setPushEnabled(e.target.checked)}
            className="rounded"
          />
          Send browser push notifications
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={morningBriefingEnabled}
            onChange={e => setMorningBriefingEnabled(e.target.checked)}
            className="rounded"
          />
          Morning briefing
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={eveningReflectionEnabled}
            onChange={e => setEveningReflectionEnabled(e.target.checked)}
            className="rounded"
          />
          Evening reflection
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={nudgesEnabled}
            onChange={e => setNudgesEnabled(e.target.checked)}
            className="rounded"
          />
          Daily nudges and check-ins
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={weeklyInsightEnabled}
            onChange={e => setWeeklyInsightEnabled(e.target.checked)}
            className="rounded"
          />
          Weekly insights
        </label>

        <Button type="button" onClick={onEnablePush} content="Enable browser notifications" />
        {pushStatus && <p className="text-sm text-neutral-400">{pushStatus}</p>}
      </Container>

      <div className="flex justify-end">
        <Button type="button" onClick={onSave} content="Save changes" />
      </div>
    </div>
  );
};

export default Profile;
