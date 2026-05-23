'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useState } from 'react'

const NAV = [
  { href: '/dashboard/transactions',    label: 'Transactions',   icon: '⊞' },
  { href: '/dashboard/flux',            label: 'Flux',           icon: '⇌' },
  { href: '/dashboard/synthese',        label: 'Synthèse',       icon: '◎' },
  { href: '/dashboard/compte',          label: 'Mon Compte',     icon: '◈' },
  { href: '/dashboard/livrets',         label: 'Livrets',        icon: '🏦' },
  { href: '/dashboard/patrimoine',      label: 'Patrimoine',     icon: '◆' },
  { href: '/dashboard/investissements', label: 'Investissements',icon: '▲' },
  { href: '/dashboard/simulation',      label: 'Simulation',     icon: '🧪' },
  { href: '/dashboard/journal',         label: 'Journal',        icon: '◑' },
  { href: '/dashboard/outils',          label: 'Outils',         icon: '⚙' },
  { href: '/dashboard/cours',           label: 'Cours',          icon: '📈' },
  { href: '/dashboard/config',          label: 'Config',         icon: '⊟' },
]

// ── Mobile menu drawer ────────────────────────────────────────────────────────
export function MobileNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const current = NAV.find(n => n.href === pathname)

  return (
    <>
      {/* Bottom bar */}
      <nav className="bottom-nav">
        {/* Current page indicator */}
        <div className="bottom-nav-current">
          <span style={{ fontSize: 16 }}>{current?.icon ?? '◎'}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#e8e8f2' }}>{current?.label ?? 'Dashboard'}</span>
        </div>
        {/* Burger button */}
        <button
          className="burger-btn"
          onClick={() => setOpen(o => !o)}
          aria-label="Menu"
        >
          <span className={`burger-line${open ? ' open' : ''}`} />
          <span className={`burger-line${open ? ' open' : ''}`} />
          <span className={`burger-line${open ? ' open' : ''}`} />
        </button>
      </nav>

      {/* Overlay */}
      {open && (
        <div className="drawer-overlay" onClick={() => setOpen(false)} />
      )}

      {/* Drawer from bottom */}
      <div className={`nav-drawer${open ? ' open' : ''}`}>
        <div className="nav-drawer-handle" />
        <div style={{ padding: '8px 16px 4px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: 'oklch(63% 0.19 250)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff' }}>F</div>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#e8e8f2' }}>FinDash</span>
        </div>
        <nav style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(item => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', borderRadius: 10,
                  color: active ? '#fff' : '#9898b0',
                  background: active ? 'oklch(63% 0.19 250 / 0.18)' : 'transparent',
                  textDecoration: 'none', fontSize: 15, fontWeight: active ? 600 : 400,
                  borderLeft: active ? '3px solid oklch(63% 0.19 250)' : '3px solid transparent',
                }}>
                <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div style={{ padding: '8px 12px', borderTop: '1px solid #252535' }}>
          <button onClick={async () => { await signOut({ redirect: false }); router.push('/login'); setOpen(false) }}
            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, background: 'transparent', border: '1px solid #252535', color: '#636385', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'Inter, sans-serif' }}>
            <span style={{ fontSize: 18 }}>⎋</span> Déconnexion
          </button>
        </div>
      </div>
    </>
  )
}

// ── Desktop sidebar ───────────────────────────────────────────────────────────
export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  return (
    <div className="sidebar">
      <div style={{ padding: '22px 20px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: 'oklch(63% 0.19 250)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#fff', flexShrink: 0 }}>F</div>
        <span style={{ fontWeight: 700, fontSize: 15, color: '#e8e8f2' }}>FinDash</span>
      </div>
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
      <div style={{ padding: '12px 10px' }}>
        <button onClick={async () => { await signOut({ redirect: false }); router.push('/login') }} style={{ width: '100%', padding: '9px 12px', borderRadius: 9, background: 'transparent', border: '1px solid #252535', color: '#636385', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'Inter, sans-serif' }}>
          <span style={{ fontSize: 14 }}>⎋</span> Déconnexion
        </button>
      </div>
    </div>
  )
}
