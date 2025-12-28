'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

interface Bundle {
  id: string
  bundle_sku_id: string
  bundle_sku: { sku_code: string; name: string }
  components: Array<{
    component_sku: { sku_code: string; name: string }
    qty_component: number
  }>
}

export default function BundlesPage() {
  const [bundles, setBundles] = useState<Bundle[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBundles()
  }, [])

  async function fetchBundles() {
    try {
      const response = await fetch('/api/bundles')
      const data = await response.json()
      setBundles(data.bundles || [])
    } catch (error) {
      console.error('Error fetching bundles:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="p-4">Chargement...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bundles (BOM)</h1>
        <p className="text-muted-foreground">
          Nomenclature des kits et bundles produits
        </p>
      </div>

      {bundles.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              Aucun bundle configure. Importez vos bundles depuis Parametres &gt; Import.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {bundles.map((bundle) => (
            <Card key={bundle.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Badge>{bundle.bundle_sku?.sku_code}</Badge>
                  {bundle.bundle_sku?.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Composant</TableHead>
                      <TableHead>Nom</TableHead>
                      <TableHead className="text-right">Quantite</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bundle.components?.map((comp, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">
                          {comp.component_sku?.sku_code}
                        </TableCell>
                        <TableCell>{comp.component_sku?.name}</TableCell>
                        <TableCell className="text-right">{comp.qty_component}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
