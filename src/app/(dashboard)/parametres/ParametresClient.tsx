'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Save, RefreshCw, Upload, User, Package, MapPin, DollarSign, Boxes, Truck, Loader2, CheckCircle, Clock } from 'lucide-react'
import { UploadCSV } from '@/components/forms/UploadCSV'
import { toast } from 'sonner'

interface UserProfile {
  id: string
  email: string
  tenant_id: string
  role: string
  full_name: string | null
}

interface ParametresClientProps {
  profile: UserProfile
}

export function ParametresClient({ profile }: ParametresClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('profil')
  const [isSaving, setIsSaving] = useState(false)
  const [fullName, setFullName] = useState(profile.full_name || '')
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string; stats?: { fetched: number; created: number } } | null>(null)
  const [syncProgress, setSyncProgress] = useState<{ created: number; total: number; elapsed: number } | null>(null)
  const syncStartTime = useRef<number | null>(null)
  const progressInterval = useRef<NodeJS.Timeout | null>(null)

  const handleSaveProfile = async () => {
    setIsSaving(true)
    setSaveSuccess(false)
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName }),
      })
      if (response.ok) {
        setSaveSuccess(true)
        toast.success('Profil mis à jour')
        router.refresh()
      } else {
        toast.error('Erreur lors de la sauvegarde')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCSVUpload = async (file: File, endpoint: string) => {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    })

    const result = await response.json()

    if (result.success) {
      router.refresh()
    }

    return {
      success: result.success,
      message: result.message || (result.success ? 'Import reussi' : 'Erreur'),
      imported: result.imported,
      errors: result.errors,
    }
  }

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current)
      }
    }
  }, [])

  const pollSyncStatus = async () => {
    try {
      const response = await fetch('/api/sync/sendcloud/status')
      const data = await response.json()
      if (data.status === 'running' && data.stats) {
        const elapsed = syncStartTime.current ? Math.floor((Date.now() - syncStartTime.current) / 1000) : 0
        setSyncProgress({
          created: data.stats.created || 0,
          total: data.stats.totalExpected || data.stats.fetched || 0,
          elapsed,
        })
      }
    } catch (err) {
      // Ignore polling errors
    }
  }

  const handleSendcloudSync = async () => {
    setIsSyncing(true)
    setSyncResult(null)
    setSyncProgress({ created: 0, total: 0, elapsed: 0 })
    syncStartTime.current = Date.now()

    // Start polling for progress every 2 seconds
    progressInterval.current = setInterval(() => {
      pollSyncStatus()
      const elapsed = syncStartTime.current ? Math.floor((Date.now() - syncStartTime.current) / 1000) : 0
      setSyncProgress(prev => prev ? { ...prev, elapsed } : null)
    }, 2000)

    try {
      const response = await fetch('/api/sync/sendcloud/run', {
        method: 'POST',
      })
      const result = await response.json()
      setSyncResult({
        success: result.success,
        message: result.message || (result.success ? 'Synchronisation terminee' : 'Erreur'),
        stats: result.stats,
      })
      if (result.success) {
        toast.success('Synchronisation terminée', {
          description: result.stats ? `${result.stats.created} expéditions importées` : undefined,
        })
      } else {
        toast.error(result.message || 'Erreur lors de la synchronisation')
      }
      if (result.stats) {
        setSyncProgress({
          created: result.stats.created,
          total: result.stats.fetched,
          elapsed: syncStartTime.current ? Math.floor((Date.now() - syncStartTime.current) / 1000) : 0,
        })
      }
    } catch {
      setSyncResult({
        success: false,
        message: 'Erreur de connexion',
      })
      toast.error('Erreur de connexion au serveur')
    } finally {
      setIsSyncing(false)
      if (progressInterval.current) {
        clearInterval(progressInterval.current)
        progressInterval.current = null
      }
    }
  }

  const roleLabel = {
    super_admin: 'Super Admin',
    admin: 'Administrateur',
    ops: 'Operateur',
  }[profile.role] || profile.role

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Parametres</h1>
          <p className="text-muted-foreground text-sm">Configuration et imports</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="profil" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Profil
          </TabsTrigger>
          <TabsTrigger value="import" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Import
          </TabsTrigger>
          <TabsTrigger value="sync" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Sync
          </TabsTrigger>
        </TabsList>

        {/* Profil Tab */}
        <TabsContent value="profil" className="space-y-6">
          <Card className="shadow-sm border-border">
            <CardHeader>
              <CardTitle>Profil Utilisateur</CardTitle>
              <CardDescription>Gerez vos informations personnelles</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Nom complet</label>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Votre nom"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Email</label>
                  <Input value={profile.email} disabled />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Role</label>
                  <div>
                    <Badge variant="outline">{roleLabel}</Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Tenant ID</label>
                  <Input value={profile.tenant_id} disabled className="font-mono text-xs" />
                </div>
              </div>
              <div className="flex justify-end pt-4 gap-2">
                {saveSuccess && (
                  <span className="text-sm text-green-600 flex items-center gap-1">
                    <CheckCircle className="h-4 w-4" />
                    Enregistre
                  </span>
                )}
                <Button onClick={handleSaveProfile} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Enregistrer
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Import Tab */}
        <TabsContent value="import" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* SKUs Import */}
            <Card className="shadow-sm border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">Produits (SKUs)</CardTitle>
                </div>
                <CardDescription>
                  Colonnes: sku_code, name, description, unit_cost_eur, alert_threshold
                </CardDescription>
              </CardHeader>
              <CardContent>
                <UploadCSV
                  onUpload={(file) => handleCSVUpload(file, '/api/import/skus')}
                  description="Importez votre catalogue produits"
                />
              </CardContent>
            </Card>

            {/* Pricing Import */}
            <Card className="shadow-sm border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">Grille Tarifaire</CardTitle>
                </div>
                <CardDescription>
                  Colonnes: carrier, weight_min_grams, weight_max_grams, price_eur
                </CardDescription>
              </CardHeader>
              <CardContent>
                <UploadCSV
                  onUpload={(file) => handleCSVUpload(file, '/api/import/pricing')}
                  description="Importez vos tarifs transporteurs"
                />
              </CardContent>
            </Card>

            {/* Locations Import */}
            <Card className="shadow-sm border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">Emplacements</CardTitle>
                </div>
                <CardDescription>
                  Colonnes: code, label, active
                </CardDescription>
              </CardHeader>
              <CardContent>
                <UploadCSV
                  onUpload={(file) => handleCSVUpload(file, '/api/import/locations')}
                  description="Importez vos emplacements d'entrepot"
                />
              </CardContent>
            </Card>

            {/* Bundles Import */}
            <Card className="shadow-sm border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Boxes className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">Bundles (BOM)</CardTitle>
                </div>
                <CardDescription>
                  Colonnes: bundle_sku_code, component_sku_code, qty_component
                </CardDescription>
              </CardHeader>
              <CardContent>
                <UploadCSV
                  onUpload={(file) => handleCSVUpload(file, '/api/import/bundles')}
                  description="Importez vos compositions de bundles"
                />
              </CardContent>
            </Card>

            {/* Restock Import */}
            <Card className="shadow-sm border-border lg:col-span-2">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-green-600" />
                  <CardTitle className="text-base">Reappro Stock</CardTitle>
                </div>
                <CardDescription>
                  Colonnes: sku_code, qty, movement_type (in/out), location_code (optionnel)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <UploadCSV
                  onUpload={(file) => handleCSVUpload(file, '/api/import/restock')}
                  description="Importez des mouvements de stock (entrees/sorties)"
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Sync Tab */}
        <TabsContent value="sync" className="space-y-6">
          <Card className="shadow-sm border-border">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />
                <CardTitle>Sendcloud</CardTitle>
              </div>
              <CardDescription>
                Synchronisez automatiquement vos expeditions depuis Sendcloud
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">Synchronisation manuelle</p>
                    <p className="text-sm text-muted-foreground">
                      Recupere les nouvelles expeditions depuis Sendcloud
                    </p>
                  </div>
                  <Button onClick={handleSendcloudSync} disabled={isSyncing} className="shrink-0">
                    {isSyncing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    {isSyncing ? 'Sync en cours...' : 'Lancer sync'}
                  </Button>
                </div>

                {/* Progress indicator */}
                {isSyncing && syncProgress && (
                  <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-blue-700">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="font-medium">Synchronisation en cours...</span>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-blue-600">
                        <Clock className="h-4 w-4" />
                        <span>
                          {Math.floor(syncProgress.elapsed / 60)}:{String(syncProgress.elapsed % 60).padStart(2, '0')}
                        </span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-700 font-medium">
                          {syncProgress.created} / {syncProgress.total} expéditions
                        </span>
                        <span className="text-blue-600">
                          {syncProgress.total > 0 ? Math.round((syncProgress.created / syncProgress.total) * 100) : 0}%
                        </span>
                      </div>
                      <div className="h-3 bg-blue-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out"
                          style={{
                            width: `${syncProgress.total > 0 ? (syncProgress.created / syncProgress.total) * 100 : 0}%`
                          }}
                        />
                      </div>
                    </div>

                    <p className="text-xs text-blue-500">
                      {syncProgress.total === 0
                        ? 'Récupération des données depuis Sendcloud...'
                        : 'Import en cours - veuillez patienter'}
                    </p>
                  </div>
                )}

                {/* Result */}
                {syncResult && !isSyncing && (
                  <div className={`p-4 rounded-lg border ${syncResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center gap-2">
                      {syncResult.success ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <RefreshCw className="h-5 w-5 text-red-600" />
                      )}
                      <span className={`font-medium ${syncResult.success ? 'text-green-700' : 'text-red-700'}`}>
                        {syncResult.message}
                      </span>
                    </div>
                    {syncResult.stats && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        {syncResult.stats.created} expeditions importees sur {syncResult.stats.fetched} recuperees
                        {syncProgress && syncProgress.elapsed > 0 && (
                          <span className="ml-2">
                            (en {Math.floor(syncProgress.elapsed / 60)}:{String(syncProgress.elapsed % 60).padStart(2, '0')})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                Note: Les cles API Sendcloud sont configurees dans les variables d&apos;environnement du serveur.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
