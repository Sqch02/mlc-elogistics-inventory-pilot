'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { UploadCSV } from '@/components/forms/UploadCSV'
import { useSearchParams } from 'next/navigation'

async function uploadFile(endpoint: string, file: File) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  })

  return response.json()
}

export default function ParametresPage() {
  const searchParams = useSearchParams()
  const defaultTab = searchParams.get('tab') || 'import'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Parametres</h1>
        <p className="text-muted-foreground">
          Configuration et import de donnees
        </p>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="import">Import donnees</TabsTrigger>
          <TabsTrigger value="sync">Synchronisation</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* SKUs Import */}
            <Card>
              <CardHeader>
                <CardTitle>SKUs et Stock</CardTitle>
                <CardDescription>
                  Importer le catalogue produits et le stock initial
                </CardDescription>
              </CardHeader>
              <CardContent>
                <UploadCSV
                  onUpload={(file) => uploadFile('/api/import/skus', file)}
                  description="Colonnes: sku_code, name, weight_grams (opt), qty_current (opt), active (opt)"
                />
              </CardContent>
            </Card>

            {/* Bundles Import */}
            <Card>
              <CardHeader>
                <CardTitle>Bundles (BOM)</CardTitle>
                <CardDescription>
                  Importer la nomenclature des bundles
                </CardDescription>
              </CardHeader>
              <CardContent>
                <UploadCSV
                  onUpload={(file) => uploadFile('/api/import/bundles', file)}
                  description="Colonnes: bundle_sku_code, component_sku_code, qty_component"
                />
              </CardContent>
            </Card>

            {/* Pricing Import */}
            <Card>
              <CardHeader>
                <CardTitle>Grille tarifaire</CardTitle>
                <CardDescription>
                  Importer les tarifs transport par transporteur et tranche de poids
                </CardDescription>
              </CardHeader>
              <CardContent>
                <UploadCSV
                  onUpload={(file) => uploadFile('/api/import/pricing', file)}
                  description="Colonnes: carrier, weight_min_grams, weight_max_grams, price_eur"
                />
              </CardContent>
            </Card>

            {/* Locations Import */}
            <Card>
              <CardHeader>
                <CardTitle>Emplacements</CardTitle>
                <CardDescription>
                  Importer les emplacements de stockage
                </CardDescription>
              </CardHeader>
              <CardContent>
                <UploadCSV
                  onUpload={(file) => uploadFile('/api/import/locations', file)}
                  description="Colonnes: code, label (opt), sku_code (opt pour assignation), active (opt)"
                />
              </CardContent>
            </Card>

            {/* Shipment Items Import (Fallback) */}
            <Card>
              <CardHeader>
                <CardTitle>Items expeditions (fallback)</CardTitle>
                <CardDescription>
                  Importer les lignes SKU manquantes pour les expeditions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <UploadCSV
                  onUpload={(file) => uploadFile('/api/import/shipment-items', file)}
                  description="Colonnes: sendcloud_id, sku_code, qty"
                />
              </CardContent>
            </Card>

            {/* Restock Import */}
            <Card>
              <CardHeader>
                <CardTitle>Reassorts attendus</CardTitle>
                <CardDescription>
                  Importer les commandes de reapprovisionnement prevues
                </CardDescription>
              </CardHeader>
              <CardContent>
                <UploadCSV
                  onUpload={(file) => uploadFile('/api/import/restock', file)}
                  description="Colonnes: sku_code, qty, eta_date (YYYY-MM-DD), note (opt)"
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sync" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Synchronisation Sendcloud</CardTitle>
              <CardDescription>
                Synchroniser les expeditions depuis Sendcloud
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                La synchronisation recupere les nouvelles expeditions depuis la derniere execution.
                Elle est idempotente: vous pouvez la lancer plusieurs fois sans risque de doublons.
              </p>
              <SyncButton />
              <SyncHistory />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Informations du compte</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Les parametres generaux seront disponibles prochainement.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function SyncButton() {
  return (
    <button
      onClick={async () => {
        const response = await fetch('/api/sync/sendcloud/run', { method: 'POST' })
        const result = await response.json()
        if (result.success) {
          alert(`Sync terminee: ${result.stats?.created || 0} nouvelles expeditions`)
          window.location.reload()
        } else {
          alert(`Erreur: ${result.message}`)
        }
      }}
      className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
    >
      Lancer la synchronisation
    </button>
  )
}

function SyncHistory() {
  // This would typically fetch from an API
  return (
    <div className="mt-4">
      <h4 className="text-sm font-medium mb-2">Historique des syncs</h4>
      <p className="text-sm text-muted-foreground">
        L historique des synchronisations sera affiche ici.
      </p>
    </div>
  )
}
