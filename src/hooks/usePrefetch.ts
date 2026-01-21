'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

/**
 * Prefetch data for navigation - call on mouse enter
 * Reduces perceived latency by loading data before navigation
 */
export function usePrefetch() {
  const queryClient = useQueryClient()

  const prefetchRoute = useCallback(async (route: string) => {
    // Map routes to their query keys
    const routePrefetchMap: Record<string, () => Promise<void>> = {
      '/': async () => {
        // Dashboard - prefetch main dashboard data
        await queryClient.prefetchQuery({
          queryKey: ['dashboard'],
          queryFn: async () => {
            const res = await fetch('/api/dashboard')
            return res.json()
          },
          staleTime: 60 * 1000, // 1 minute
        })
      },
      '/produits': async () => {
        // Products page
        await queryClient.prefetchQuery({
          queryKey: ['products', {}],
          queryFn: async () => {
            const res = await fetch('/api/products')
            return res.json()
          },
          staleTime: 2 * 60 * 1000,
        })
      },
      '/expeditions': async () => {
        // Shipments page
        await queryClient.prefetchQuery({
          queryKey: ['shipments', {}],
          queryFn: async () => {
            const res = await fetch('/api/shipments')
            return res.json()
          },
          staleTime: 2 * 60 * 1000,
        })
      },
      '/pricing': async () => {
        // Pricing page
        await queryClient.prefetchQuery({
          queryKey: ['pricing'],
          queryFn: async () => {
            const res = await fetch('/api/pricing')
            return res.json()
          },
          staleTime: 5 * 60 * 1000,
        })
      },
      '/bundles': async () => {
        // Bundles page
        await queryClient.prefetchQuery({
          queryKey: ['bundles'],
          queryFn: async () => {
            const res = await fetch('/api/bundles')
            return res.json()
          },
          staleTime: 5 * 60 * 1000,
        })
      },
      '/emplacements': async () => {
        // Locations page
        await queryClient.prefetchQuery({
          queryKey: ['locations'],
          queryFn: async () => {
            const res = await fetch('/api/locations')
            return res.json()
          },
          staleTime: 5 * 60 * 1000,
        })
      },
      '/facturation': async () => {
        // Invoices page
        await queryClient.prefetchQuery({
          queryKey: ['invoices'],
          queryFn: async () => {
            const res = await fetch('/api/invoices')
            return res.json()
          },
          staleTime: 2 * 60 * 1000,
        })
      },
      '/reclamations': async () => {
        // Claims page
        await queryClient.prefetchQuery({
          queryKey: ['claims', {}],
          queryFn: async () => {
            const res = await fetch('/api/claims')
            return res.json()
          },
          staleTime: 2 * 60 * 1000,
        })
      },
    }

    const prefetchFn = routePrefetchMap[route]
    if (prefetchFn) {
      try {
        await prefetchFn()
      } catch {
        // Silently fail - prefetching is an optimization
      }
    }
  }, [queryClient])

  return { prefetchRoute }
}
