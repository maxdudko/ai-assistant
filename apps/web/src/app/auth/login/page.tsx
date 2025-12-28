'use client'


import { useState } from 'react'
import { authApi } from '@/lib/api/auth'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/api/AuthContext'


export default function LoginPage() {
  const router = useRouter()
  const { refresh } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')


  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    await authApi.login({ email, password })
    await refresh()
    router.push('/app/chat')
  }


  return (
    <main className="flex min-h-screen items-center justify-center">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-xl bg-neutral-900 p-6">
        <h2 className="text-xl font-medium">Login</h2>
        <input value={email} onChange={e => setEmail(e.target.value)} className="w-full rounded bg-neutral-800 p-2" placeholder="Email" />
        <input value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded bg-neutral-800 p-2" type="password" placeholder="Password" />
        <button className="w-full rounded bg-indigo-600 py-2">Sign in</button>
      </form>
    </main>
  )
}