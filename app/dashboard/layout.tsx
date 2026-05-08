import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0c0c11', overflow: 'hidden' }}>
      {children}
    </div>
  )
}
