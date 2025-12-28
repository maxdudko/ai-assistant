'use client'

import { useState } from 'react'
import { authApi } from '@/lib/api/auth'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/api/AuthContext'


export default function RegisterPage() {
  const router = useRouter()
  const { refresh } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    await authApi.register({ name, email, password })
    await refresh()
    router.push('/app/chat')
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-xl bg-neutral-900 p-6">
        <h2 className="text-xl font-medium">Register</h2>
        <input value={name} onChange={e => setName(e.target.value)} className="w-full rounded bg-neutral-800 p-2" placeholder="Name" />
        <input value={email} onChange={e => setEmail(e.target.value)} className="w-full rounded bg-neutral-800 p-2" placeholder="Email" />
        <input value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded bg-neutral-800 p-2" type="password" placeholder="Password" />
        <button type="submit" className="w-full rounded bg-indigo-600 py-2 cursor-pointer">Create account</button>
      </form>
    </main>
  )
}