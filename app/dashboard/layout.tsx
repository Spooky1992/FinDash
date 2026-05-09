import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { MobileNav } from '@/components/Sidebar'
import { AppDataProvider } from '@/hooks/useAppData'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <AppDataProvider>
      <div className="dashboard-root">
        <Sidebar />
        <main className="dashboard-main">
          {children}
        </main>
        <MobileNav />
      </div>
    </AppDataProvider>
  )
}
