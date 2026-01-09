'use client'

import { useQuery } from '@tanstack/react-query'

export interface Bundle {
  id: string
  bundle_sku_id: string
  bundle_sku: { sku_code: string; name: string } | null
  components: Array<{
    qty_component: number
    component_sku: { sku_code: string; name: string } | null
  }>
}

async function fetchBundles(): Promise<{ bundles: Bundle[] }> {
  const response = await fetch('/api/bundles')
  if (!response.ok) throw new Error('Failed to fetch bundles')
  const data = await response.json()
  return { bundles: data.bundles || [] }
}

export function useBundles() {
  return useQuery({
    queryKey: ['bundles'],
    queryFn: fetchBundles,
    staleTime: 5 * 60 * 1000,
  })
}
