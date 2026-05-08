import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { getDb } from './db'
import { users } from './schema'
import { eq } from 'drizzle-orm'
import { authConfig } from '@/auth.config'

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email:    { label: 'Email',    type: 'email'    },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const db = getDb()

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, credentials.email as string))
          .limit(1)

        if (!user) return null

        const ok = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        )
        if (!ok) return null

        return { id: String(user.id), email: user.email }
      },
    }),
  ],
})
