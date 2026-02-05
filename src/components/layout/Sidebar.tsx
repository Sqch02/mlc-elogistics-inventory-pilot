'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Package,
  Truck,
  RotateCcw,
  Boxes,
  MapPin,
  DollarSign,
  FileText,
  AlertTriangle,
  Settings,
  LogOut,
  Menu,
  X,
  BarChart3,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { features } from '@/lib/config/features'

// Menus hidden for client role (brand users)
const clientHiddenMenus = ['/analytics', '/emplacements', '/pricing', '/facturation', '/parametres']

// Base navigation items
const baseNavigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, feature: null },
  { name: 'Analytics', href: '/analytics', icon: BarChart3, feature: null },
  { name: 'Expeditions', href: '/expeditions', icon: Truck, feature: null },
  { name: 'Retours', href: '/retours', icon: RotateCcw, feature: 'returnsModule' as const },
  { name: 'Produits & Stock', href: '/produits', icon: Package, feature: null },
  { name: 'Bundles', href: '/bundles', icon: Boxes, feature: null },
  { name: 'Emplacements', href: '/emplacements', icon: MapPin, feature: null },
  { name: 'Pricing', href: '/pricing', icon: DollarSign, feature: null },
  { name: 'Facturation', href: '/facturation', icon: FileText, feature: null },
  { name: 'Reclamations', href: '/reclamations', icon: AlertTriangle, feature: null },
  { name: 'Parametres', href: '/parametres', icon: Settings, feature: null },
]

interface SidebarContentProps {
  pathname: string
  onClose: () => void
  onLogout: () => void
  userRole?: string
}

function SidebarContent({ pathname, onClose, onLogout, userRole }: SidebarContentProps) {
  // Filter navigation based on feature flags and user role
  const navigation = useMemo(() => {
    return baseNavigation.filter((item) => {
      // Feature flag check
      if (item.feature === 'returnsModule' && !features.returnsModule) return false
      // Client role: hide certain menus
      if (userRole === 'client' && clientHiddenMenus.includes(item.href)) return false
      return true
    })
  }, [userRole])

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between h-16 px-5 lg:px-6 border-b border-border/50 bg-white">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Package className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-base tracking-tight text-foreground">HME Logistics</span>
            <span className="text-[10px] text-muted-foreground font-medium tracking-wide uppercase">Inventory ERP</span>
          </div>
        </div>
        {/* Close button on mobile */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden hover:bg-muted"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        <div className="mb-2 px-3">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Menu principal</span>
        </div>
        {navigation.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 font-medium group relative',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <item.icon className={cn(
                "h-[18px] w-[18px] flex-shrink-0 transition-colors",
                isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
              )} />
              <span className="tracking-tight">{item.name}</span>
              {isActive && (
                <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-primary-foreground/60" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border/50">
        <button
          onClick={onLogout}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm w-full font-medium',
            'text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-all duration-200'
          )}
        >
          <LogOut className="h-[18px] w-[18px] flex-shrink-0" />
          <span>Deconnexion</span>
        </button>
      </div>
    </>
  )
}

interface SidebarProps {
  onMobileToggle?: (isOpen: boolean) => void
  userRole?: string
}

export function Sidebar({ onMobileToggle, userRole }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const prevPathnameRef = useRef(pathname)

  // Close mobile menu on route change
  useEffect(() => {
    if (prevPathnameRef.current !== pathname) {
      prevPathnameRef.current = pathname
      // Use setTimeout to avoid setState during render cycle
      setTimeout(() => setMobileOpen(false), 0)
    }
  }, [pathname])

  // Notify parent of mobile state
  useEffect(() => {
    onMobileToggle?.(mobileOpen)
  }, [mobileOpen, onMobileToggle])

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const handleClose = () => setMobileOpen(false)
  const handleOpen = () => setMobileOpen(true)

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-3 left-3 z-50 lg:hidden bg-white shadow-md border border-border/50 hover:bg-muted"
        onClick={handleOpen}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={handleClose}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[280px] bg-white border-r border-border/50 flex flex-col transform transition-transform duration-300 ease-out lg:hidden shadow-xl",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent pathname={pathname} onClose={handleClose} onLogout={handleLogout} userRole={userRole} />
      </aside>

      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex flex-col h-screen bg-white border-r border-border/50 shrink-0 fixed top-0 left-0 bottom-0 w-[260px] z-40"
        style={{ boxShadow: '1px 0 3px rgba(0, 0, 0, 0.02)' }}
      >
        <SidebarContent pathname={pathname} onClose={handleClose} onLogout={handleLogout} userRole={userRole} />
      </aside>
    </>
  )
}
