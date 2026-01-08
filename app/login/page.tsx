'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const VALID_PASSWORD = 'hfyj54hf'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (password === VALID_PASSWORD) {
      localStorage.setItem('authenticated', 'true')
      router.push('/campaigns')
    } else {
      setError('Mot de passe incorrect')
      setPassword('')
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '80vh'
    }}>
      <h1>Connexion</h1>

      <form onSubmit={handleSubmit} style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '15px',
        width: '300px',
        padding: '30px',
        border: '1px solid #ddd',
        borderRadius: '8px',
        background: '#f9f9f9'
      }}>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mot de passe"
          style={{
            padding: '12px',
            fontSize: '16px',
            borderRadius: '4px',
            border: '1px solid #ccc',
            color: 'black'
          }}
          autoFocus
        />

        {error && (
          <p style={{ color: 'red', margin: 0, textAlign: 'center' }}>{error}</p>
        )}

        <button
          type="submit"
          style={{
            padding: '12px',
            fontSize: '16px',
            background: '#4caf50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Se connecter
        </button>
      </form>
    </div>
  )
}
