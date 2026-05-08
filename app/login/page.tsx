'use client'

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [isSetup,  setIsSetup]  = useState<boolean | null>(null)
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [showPwd,  setShowPwd]  = useState(false)

  useEffect(() => {
    fetch('/api/setup').then(r => r.json()).then(d => setIsSetup(!d.configured))
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const res = await signIn('credentials', { email, password, redirect: false })
    if (res?.error) {
      setError('Email ou mot de passe incorrect.')
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) { setError('Minimum 6 caractères.'); return }
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas.'); return }
    setLoading(true); setError('')
    const res = await fetch('/api/setup', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      setError('Erreur lors de la configuration.')
      setLoading(false)
      return
    }
    // Auto-login après setup
    await signIn('credentials', { email, password, redirect: false })
    router.push('/dashboard')
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px',
    background: '#1c1c27', border: '1px solid #252535',
    borderRadius: 9, color: '#e8e8f2', fontSize: 15,
    fontFamily: 'Inter, sans-serif', boxSizing: 'border-box',
    outline: 'none',
  }

  if (isSetup === null) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0c0c11' }}>
        <div style={{ color: '#636385', fontSize: 14 }}>Chargement…</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0c0c11' }}>
      <div style={{
        width: '100%', maxWidth: 380,
        background: '#13131b', border: '1px solid #252535',
        borderRadius: 18, padding: '40px 36px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28,
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: 'oklch(63% 0.19 250)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, fontWeight: 800, color: '#fff',
        }}>F</div>

        <div style={{ textAlign: 'center', width: '100%' }}>
          <div style={{ fontSize: 19, fontWeight: 700, color: '#e8e8f2', marginBottom: 6 }}>
            {isSetup ? 'Créer un compte' : 'FinDash'}
          </div>
          <div style={{ fontSize: 13, color: '#636385', lineHeight: 1.5 }}>
            {isSetup
              ? 'Première configuration — définissez vos identifiants.'
              : 'Connectez-vous pour accéder à votre tableau de bord.'}
          </div>
        </div>

        <form onSubmit={isSetup ? handleSetup : handleLogin}
          style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>

          <input type="email" placeholder="Email" value={email} required
            onChange={e => { setEmail(e.target.value); setError('') }}
            autoFocus style={inputStyle} />

          <div style={{ position: 'relative' }}>
            <input type={showPwd ? 'text' : 'password'} placeholder="Mot de passe"
              value={password} required
              onChange={e => { setPassword(e.target.value); setError('') }}
              style={inputStyle} />
            <button type="button" onClick={() => setShowPwd(v => !v)}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#636385', fontSize: 14, padding: 4 }}>
              {showPwd ? '🙈' : '👁'}
            </button>
          </div>

          {isSetup && (
            <input type="password" placeholder="Confirmer le mot de passe"
              value={confirm} required
              onChange={e => { setConfirm(e.target.value); setError('') }}
              style={inputStyle} />
          )}

          {error && (
            <div style={{ fontSize: 12, color: 'oklch(62% 0.20 25)', textAlign: 'center', background: 'rgba(255,92,92,0.08)', borderRadius: 7, padding: '8px 12px' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '13px',
            background: 'oklch(63% 0.19 250)', border: 'none', borderRadius: 9,
            color: '#fff', fontSize: 14, fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1, marginTop: 6,
            fontFamily: 'Inter, sans-serif',
          }}>
            {loading ? '…' : isSetup ? 'Créer le compte' : 'Se connecter'}
          </button>
        </form>

        <div style={{ fontSize: 11, color: '#636385', textAlign: 'center', lineHeight: 1.6 }}>
          Session JWT · Données sur Vercel Postgres
        </div>
      </div>
    </div>
  )
}
