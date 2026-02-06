'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface Tenant {
  id: string
  name: string
  code: string | null
}

interface TenantContextType {
  tenants: Tenant[]
  activeTenantId: string | null
  activeTenant: Tenant | null
  setActiveTenantId: (id: string) => void
  isLoading: boolean
  isSuperAdmin: boolean
  isClient: boolean
  userRole: string
}

const TenantContext = createContext<TenantContextType | undefined>(undefined)

interface TenantProviderProps {
  children: ReactNode
  userRole: string
  userTenantId: string
}

// Helper to get cookie value
function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? match[2] : null
}

// Helper to set cookie
function setCookie(name: string, value: string, days: number = 30) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`
}

export function TenantProvider({ children, userRole, userTenantId }: TenantProviderProps) {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [activeTenantId, setActiveTenantIdState] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const isSuperAdmin = userRole === 'super_admin'
  const isClient = userRole === 'client'

  // Load tenants for super_admin
  useEffect(() => {
    async function loadTenants() {
      if (!isSuperAdmin) {
        setActiveTenantIdState(userTenantId)
        setIsLoading(false)
        return
      }

      try {
        const response = await fetch('/api/admin/tenants')
        const data = await response.json()
        setTenants(data.tenants || [])

        // Check cookie for previously selected tenant
        const savedTenantId = getCookie('mlc_active_tenant')
        if (savedTenantId && data.tenants?.some((t: Tenant) => t.id === savedTenantId)) {
          setActiveTenantIdState(savedTenantId)
        } else {
          setActiveTenantIdState(userTenantId)
          // Set initial cookie
          setCookie('mlc_active_tenant', userTenantId)
        }
      } catch (error) {
        console.error('Error loading tenants:', error)
        setActiveTenantIdState(userTenantId)
      } finally {
        setIsLoading(false)
      }
    }

    loadTenants()
  }, [isSuperAdmin, userTenantId])

  const setActiveTenantId = (id: string) => {
    setActiveTenantIdState(id)
    if (isSuperAdmin) {
      setCookie('mlc_active_tenant', id)
      // Refresh the page to reload data with new tenant
      window.location.reload()
    }
  }

  const activeTenant = tenants.find(t => t.id === activeTenantId) || null

  return (
    <TenantContext.Provider
      value={{
        tenants,
        activeTenantId,
        activeTenant,
        setActiveTenantId,
        isLoading,
        isSuperAdmin,
        isClient,
        userRole,
      }}
    >
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() {
  const context = useContext(TenantContext)
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider')
  }
  return context
}
