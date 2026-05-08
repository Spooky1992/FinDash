import NextAuth from 'next-auth'
import { authConfig } from './auth.config'
import { NextResponse } from 'next/server'

const { auth } = NextAuth(authConfig)

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

  if (req.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL(isLoggedIn ? '/dashboard/flux' : '/login', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}