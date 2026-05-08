'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'

const NAV = [
  { href: '/dashboard/flux',           label: 'Flux',           icon: '⇌' },
  { href: '/dashboard/synthese',       label: 'Synthèse',       icon: '◎' },
  { href: '/dashboard/compte',         label: 'Mon Compte',     icon: '◈' },
  { href: '/dashboard/transactions',   label: 'Transactions',   icon: '⊞' },
  { href: '/dashboard/patrimoine',     label: 'Patrimoine',     icon: '◆' },
  { href: '/dashboard/investissements',label: 'Investissements',icon: '▲' },
  { href: '/dashboard/outils',         label: 'Outils',         icon: '⚙' },
  { href: '/dashboard/cours',          label: 'Cours',          icon: '📈' },
  { href: '/dashboard/config',         label: 'Config',         icon: '⊟' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  return (
    <div style={{
      width: 220, minWidth: 220, height: '100vh',
      background: '#0e0e16', borderRight: '1px solid #252535',
      display: 'flex', flexDirection: 'column',
      position: 'sticky', top: 0, overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{ padding: '22px 20px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: 'oklch(63% 0.19 250)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 800, color: '#fff', flexShrink: 0,
        }}>F</div>
        <span style={{ fontWeight: 700, fontSize: 15, color: '#e8e8f2' }}>FinDash</span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '4px 10px', overflowY: 'auto' }}>
        {NAV.map(item => {
          const active = pathname === item.href
          return (
            <Link key={item.href} href={item.href} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 9, marginBottom: 2,
              color: active ? '#fff' : '#636385',
              background: active ? 'oklch(63% 0.19 250 / 0.18)' : 'transparent',
              textDecoration: 'none', fontSize: 13, fontWeight: active ? 600 : 400,
              transition: 'color 0.15s, background 0.15s',
            }}>
              <span style={{ fontSize: 14, width: 18, textAlign: 'center', opacity: active ? 1 : 0.6 }}>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div style={{ padding: '12px 10px' }}>
        <button onClick={async () => {
          await signOut({ redirect: false })
          router.push('/login')
        }} style={{
          width: '100%', padding: '9px 12px', borderRadius: 9,
          background: 'transparent', border: '1px solid #252535',
          color: '#636385', cursor: 'pointer', fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 10,
          fontFamily: 'Inter, sans-serif',
        }}>
          <span style={{ fontSize: 14 }}>⎋</span> Déconnexion
        </button>
      </div>
    </div>
  )
}
