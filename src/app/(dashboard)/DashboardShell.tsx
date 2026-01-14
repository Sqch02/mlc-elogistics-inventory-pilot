'use client'

import { ReactNode } from 'react'
import { Header } from '@/components/layout/Header'
import { TenantProvider } from '@/components/providers/TenantProvider'

interface User {
  id: string
  email: string
  tenant_id: string
  role: 'super_admin' | 'admin' | 'ops'
  full_name: string | null
}

interface DashboardShellProps {
  user: User
  children: ReactNode
}

export function DashboardShell({ user, children }: DashboardShellProps) {
  return (
    <TenantProvider userRole={user.role} userTenantId={user.tenant_id}>
      <Header user={user} />
      {children}
    </TenantProvider>
  )
}
