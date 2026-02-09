'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Save, RefreshCw, Upload, User, Package, MapPin, DollarSign, Boxes, Truck, Loader2, CheckCircle, Clock, Building2 } from 'lucide-react'
import { UploadCSV } from '@/components/forms/UploadCSV'
import { toast } from 'sonner'
import { useTenant } from '@/components/providers/TenantProvider'

interface UserProfile {
  id: string
  email: string
  tenant_id: string
  role: string
  full_name: string | null
}

interface CompanySettings {
  company_name: string
  company_address: string
  company_city: string
  company_postal_code: string
  company_country: string
  company_vat_number: string
  company_siret: string
  company_email: string
  company_phone: string
  invoice_payment_terms: string
  invoice_bank_details: string
  invoice_prefix: string
  invoice_next_number: number
}

interface ParametresClientProps {
  profile: UserProfile
}

export function ParametresClient({ profile }: ParametresClientProps) {
  const router = useRouter()
  const { isClient } = useTenant()
  const [activeTab, setActiveTab] = useState('profil')
  const [isSaving, setIsSaving] = useState(false)
  const [fullName, setFullName] = useState(profile.full_name || '')
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Company settings state
  const [companySettings, setCompanySettings] = useState<CompanySettings>({
    company_name: '',
    company_address: '',
    company_city: '',
    company_postal_code: '',
    company_country: 'France',
    company_vat_number: '',
    company_siret: '',
    company_email: '',
    company_phone: '',
    invoice_payment_terms: 'Paiement à 30 jours',
    invoice_bank_details: '',
    invoice_prefix: 'FAC',
    invoice_next_number: 1,
  })
  const [isSavingCompany, setIsSavingCompany] = useState(false)
  const [saveCompanySuccess, setSaveCompanySuccess] = useState(false)
  const [isLoadingCompany, setIsLoadingCompany] = useState(false)

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string; stats?: { fetched: number; created: number } } | null>(null)
  const [syncProgress, setSyncProgress] = useState<{ created: number; total: number; elapsed: number } | null>(null)
  const syncStartTime = useRef<number | null>(null)
  const progressInterval = useRef<NodeJS.Timeout | null>(null)

  // Stock recalculation state
  const [isRecalculating, setIsRecalculating] = useState(false)
  const [recalcResult, setRecalcResult] = useState<{ success: boolean; message: string; stats?: { processed: number; skipped: number; errors: number } } | null>(null)

  // Load company settings when tab changes to 'societe'
  useEffect(() => {
    if (activeTab === 'societe' && !companySettings.company_name) {
      loadCompanySettings()
    }
  }, [activeTab])

  const loadCompanySettings = async () => {
    setIsLoadingCompany(true)
    try {
      const response = await fetch('/api/settings/company')
      if (response.ok) {
        const data = await response.json()
        setCompanySettings(data)
      }
    } catch (error) {
      console.error('Error loading company settings:', error)
    } finally {
      setIsLoadingCompany(false)
    }
  }

  const handleSaveCompany = async () => {
    setIsSavingCompany(true)
    setSaveCompanySuccess(false)
    try {
      const response = await fetch('/api/settings/company', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(companySettings),
      })
      if (response.ok) {
        setSaveCompanySuccess(true)
        toast.success('Informations société enregistrées')
      } else {
        toast.error('Erreur lors de la sauvegarde')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setIsSavingCompany(false)
    }
  }

  const updateCompanyField = (field: keyof CompanySettings, value: string | number) => {
    setCompanySettings(prev => ({ ...prev, [field]: value }))
    setSaveCompanySuccess(false)
  }

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

  const handleStockRecalculate = async () => {
    setIsRecalculating(true)
    setRecalcResult(null)
    try {
      const response = await fetch('/api/stock/recalculate', {
        method: 'POST',
      })
      const result = await response.json()
      setRecalcResult({
        success: result.success,
        message: result.message || (result.success ? 'Recalcul terminé' : 'Erreur'),
        stats: result.stats,
      })
      if (result.success) {
        toast.success('Recalcul du stock terminé', {
          description: result.stats ? `${result.stats.processed} mouvements créés` : undefined,
        })
      } else {
        toast.error(result.message || 'Erreur lors du recalcul')
      }
    } catch {
      setRecalcResult({
        success: false,
        message: 'Erreur de connexion',
      })
      toast.error('Erreur de connexion au serveur')
    } finally {
      setIsRecalculating(false)
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
        <TabsList className={`grid w-full ${isClient ? 'grid-cols-1 lg:w-[200px]' : 'grid-cols-4 lg:w-[500px]'}`}>
          <TabsTrigger value="profil" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Profil
          </TabsTrigger>
          {!isClient && (
            <TabsTrigger value="societe" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Societe
            </TabsTrigger>
          )}
          {!isClient && (
            <TabsTrigger value="import" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Import
            </TabsTrigger>
          )}
          {!isClient && (
            <TabsTrigger value="sync" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Sync
            </TabsTrigger>
          )}
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

        {/* Societe Tab */}
        <TabsContent value="societe" className="space-y-6">
          <Card className="shadow-sm border-border">
            <CardHeader>
              <CardTitle>Informations Societe</CardTitle>
              <CardDescription>Ces informations apparaitront sur vos factures PDF</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoadingCompany ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {/* Identite */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Identite</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">Nom de la societe *</label>
                        <Input
                          value={companySettings.company_name}
                          onChange={(e) => updateCompanyField('company_name', e.target.value)}
                          placeholder="HME LOGISTICS"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">SIRET</label>
                        <Input
                          value={companySettings.company_siret}
                          onChange={(e) => updateCompanyField('company_siret', e.target.value)}
                          placeholder="123 456 789 00012"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">N° TVA Intracommunautaire</label>
                        <Input
                          value={companySettings.company_vat_number}
                          onChange={(e) => updateCompanyField('company_vat_number', e.target.value)}
                          placeholder="FR12345678901"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Adresse */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Adresse</h3>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Adresse</label>
                      <Input
                        value={companySettings.company_address}
                        onChange={(e) => updateCompanyField('company_address', e.target.value)}
                        placeholder="123 Rue de la Logistique"
                      />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">Code postal</label>
                        <Input
                          value={companySettings.company_postal_code}
                          onChange={(e) => updateCompanyField('company_postal_code', e.target.value)}
                          placeholder="75001"
                        />
                      </div>
                      <div className="space-y-2 col-span-1 md:col-span-2">
                        <label className="text-xs font-medium text-muted-foreground">Ville</label>
                        <Input
                          value={companySettings.company_city}
                          onChange={(e) => updateCompanyField('company_city', e.target.value)}
                          placeholder="Paris"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">Pays</label>
                        <Input
                          value={companySettings.company_country}
                          onChange={(e) => updateCompanyField('company_country', e.target.value)}
                          placeholder="France"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Contact */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Contact</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">Email</label>
                        <Input
                          type="email"
                          value={companySettings.company_email}
                          onChange={(e) => updateCompanyField('company_email', e.target.value)}
                          placeholder="contact@mlcproject.fr"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">Telephone</label>
                        <Input
                          value={companySettings.company_phone}
                          onChange={(e) => updateCompanyField('company_phone', e.target.value)}
                          placeholder="+33 1 23 45 67 89"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Facturation */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Facturation</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">Prefixe facture</label>
                        <Input
                          value={companySettings.invoice_prefix}
                          onChange={(e) => updateCompanyField('invoice_prefix', e.target.value.toUpperCase())}
                          placeholder="FAC"
                          maxLength={10}
                        />
                        <p className="text-xs text-muted-foreground">Ex: FAC-2025-001</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">Prochain numero</label>
                        <Input
                          type="number"
                          min={1}
                          value={companySettings.invoice_next_number}
                          onChange={(e) => updateCompanyField('invoice_next_number', parseInt(e.target.value) || 1)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Conditions de paiement</label>
                      <Input
                        value={companySettings.invoice_payment_terms}
                        onChange={(e) => updateCompanyField('invoice_payment_terms', e.target.value)}
                        placeholder="Paiement à 30 jours"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Coordonnees bancaires (IBAN)</label>
                      <textarea
                        className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={companySettings.invoice_bank_details}
                        onChange={(e) => updateCompanyField('invoice_bank_details', e.target.value)}
                        placeholder="IBAN: FR76 1234 5678 9012 3456 7890 123&#10;BIC: BNPAFRPP"
                      />
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="flex justify-end pt-4 gap-2 border-t">
                    {saveCompanySuccess && (
                      <span className="text-sm text-green-600 flex items-center gap-1">
                        <CheckCircle className="h-4 w-4" />
                        Enregistre
                      </span>
                    )}
                    <Button onClick={handleSaveCompany} disabled={isSavingCompany}>
                      {isSavingCompany ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      Enregistrer
                    </Button>
                  </div>
                </>
              )}
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

          {/* Stock Recalculation Card */}
          <Card className="shadow-sm border-border">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-orange-500" />
                <CardTitle>Recalcul du Stock</CardTitle>
              </div>
              <CardDescription>
                Recalculez le stock en fonction des expéditions historiques non traitées
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                <p className="text-sm text-orange-800 mb-3">
                  Cette action parcourt toutes les expéditions et crée les mouvements de stock manquants.
                  Utile après un import initial ou si le stock ne correspond pas aux expéditions.
                </p>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-orange-900">Démarrer le recalcul</p>
                    <p className="text-sm text-orange-700">
                      Décrémente le stock pour chaque expédition non encore traitée
                    </p>
                  </div>
                  <Button
                    onClick={handleStockRecalculate}
                    disabled={isRecalculating}
                    variant="outline"
                    className="shrink-0 border-orange-300 text-orange-700 hover:bg-orange-100"
                  >
                    {isRecalculating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    {isRecalculating ? 'Recalcul en cours...' : 'Recalculer le stock'}
                  </Button>
                </div>
              </div>

              {/* Recalc Result */}
              {recalcResult && !isRecalculating && (
                <div className={`p-4 rounded-lg border ${recalcResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex items-center gap-2">
                    {recalcResult.success ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <RefreshCw className="h-5 w-5 text-red-600" />
                    )}
                    <span className={`font-medium ${recalcResult.success ? 'text-green-700' : 'text-red-700'}`}>
                      {recalcResult.message}
                    </span>
                  </div>
                  {recalcResult.stats && (
                    <div className="mt-2 text-sm text-muted-foreground">
                      {recalcResult.stats.processed} mouvements créés, {recalcResult.stats.skipped} déjà traités
                      {recalcResult.stats.errors > 0 && (
                        <span className="text-red-600 ml-2">({recalcResult.stats.errors} erreurs)</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
