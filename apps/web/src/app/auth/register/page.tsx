'use client'

import {useCallback, useState} from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/api/AuthContext'


export default function RegisterPage() {
  const router = useRouter()
  const { refresh } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const onSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch(`http://localhost:4000/api/auth/register`, {
        method: 'POST',
        mode: 'cors',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
      })
      if (response.ok) {
        await refresh()
        router.push('/dashboard')
      }
    } catch (error) {
      console.error('Registration failed:', error)
    }
  }, [name, email, password])
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