'use client'


import {useCallback, useState} from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/api/AuthContext'


export default function LoginPage() {
  const router = useRouter()
  const { refresh } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')


  const onSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch(`http://localhost:4000/api/auth/login`, {
        method: 'POST',
        mode: 'cors',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })
      if (response.ok) {
        await refresh()
        router.push('/dashboard')
      }
    } catch (error) {
      console.error('Registration failed:', error)
    }
  }, [email, password])


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