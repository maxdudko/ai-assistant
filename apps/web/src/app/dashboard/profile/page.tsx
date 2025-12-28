'use client'

import React from 'react';
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/api/AuthContext'
import { userApi } from '@/lib/api/user'

export default function ProfilePage() {
  const { user, refresh } = useAuth()


  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [tone, setTone] = useState<'neutral' | 'friendly' | 'strict'>('neutral')
  const [verbosity, setVerbosity] = useState<'low' | 'medium' | 'high'>('medium')
  const [useEmoji, setUseEmoji] = useState(false)


  useEffect(() => {
    if (!user) return
    setEmail(user.email)
    setDisplayName(user.profile?.displayName ?? '')
    setTone((user.profile?.tone as any) ?? 'neutral')
    setVerbosity((user.profile?.verbosity as any) ?? 'medium')
    setUseEmoji(user.profile?.useEmoji ?? false)
  }, [user])


  async function onSave() {
    await userApi.updateMe({
      email,
      profile: {
        displayName,
        tone,
        verbosity,
        useEmoji,
      },
    })
    await refresh()
  }


  if (!user) return null


  return (
    <div className="max-w-xl space-y-6">
      <h2 className="text-2xl font-semibold">Profile</h2>


      <section className="space-y-3 rounded-xl bg-neutral-900 p-4">
        <h3 className="text-lg font-medium">Account</h3>
        <input
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full rounded bg-neutral-800 p-2"
          placeholder="Email"
        />
      </section>


      <section className="space-y-3 rounded-xl bg-neutral-900 p-4">
        <h3 className="text-lg font-medium">Assistant Preferences</h3>


        <input
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          className="w-full rounded bg-neutral-800 p-2"
          placeholder="Display name"
        />


        <div className="flex flex-col gap-1">
          <label className="text-sm text-neutral-400">Tone</label>
          <select
            value={tone}
            onChange={e => setTone(e.target.value as any)}
            className="rounded bg-neutral-800 p-2"
          >
            <option value="neutral">Neutral</option>
            <option value="friendly">Friendly</option>
            <option value="strict">Strict</option>
          </select>
        </div>


        <div className="flex flex-col gap-1">
          <label className="text-sm text-neutral-400">Verbosity</label>
          <select
            value={verbosity}
            onChange={e => setVerbosity(e.target.value as any)}
            className="rounded bg-neutral-800 p-2"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>


        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={useEmoji}
            onChange={e => setUseEmoji(e.target.checked)}
          />
          Use emoji in responses
        </label>
      </section>


      <button
        onClick={onSave}
        className="rounded bg-indigo-600 px-4 py-2"
      >
        Save changes
      </button>
    </div>
  )
}