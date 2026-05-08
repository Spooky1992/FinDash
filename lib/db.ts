import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

// Connexion lazy — ne s'instancie qu'au runtime, pas au build
export function getDb() {
  return drizzle(neon(process.env.DATABASE_URL!), { schema })
}