import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

// Next.js 16 : "middleware" est déprécié → utilise "proxy" mais le fichier
// middleware.ts fonctionne encore. On garde la logique ici + protection
// redondante dans dashboard/layout.tsx (Server Component).
export default auth((req) => {
  const isLoggedIn  = !!req.auth
  const isDashboard = req.nextUrl.pathname.startsWith('/dashboard')
  const isLogin     = req.nextUrl.pathname === '/login'
  const isApiSetup  = req.nextUrl.pathname === '/api/setup'
  const isApiAuth   = req.nextUrl.pathname.startsWith('/api/auth')

  if (isApiSetup || isApiAuth || isLogin) return NextResponse.next()

  if (isDashboard && !isLoggedIn) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Redirige / → /login ou /dashboard selon l'état
  if (req.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL(isLoggedIn ? '/dashboard/flux' : '/login', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}