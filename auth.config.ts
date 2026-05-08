import type { NextAuthConfig } from 'next-auth'

export const authConfig: NextAuthConfig = {
  trustHost: true,
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id
      return token
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string
      return session
    },
  },
  providers: [],
}
