'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  Plus,
  Save,
  Trash2,
  Building2,
  MapPin,
  Receipt,
  Cloud,
  Users,
  AlertTriangle,
  Power,
  PowerOff,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

interface Tenant {
  id: string
  name: string
  code: string | null
  siren: string | null
  siret: string | null
  vat_number: string | null
  address: string | null
  postal_code: string | null
  city: string | null
  country: string | null
  email: string | null
  phone: string | null
  logo_url: string | null
  is_active: boolean
  created_at: string
}

interface TenantSettings {
  sendcloud_api_key: string | null
  sendcloud_secret: string | null
  sync_enabled: boolean
  invoice_prefix: string | null
  invoice_next_number: number | null
  payment_terms: string | null
  bank_details: string | null
  default_vat_rate: number | null
}

interface User {
  id: string
  email: string
  role: string
  created_at: string
}

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  ops: 'Operations',
  sav: 'SAV',
}

export default function TenantDetailPage() {
  const params = useParams()
  const router = useRouter()
  const tenantId = params.id as string

  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [settings, setSettings] = useState<TenantSettings>({
    sendcloud_api_key: null,
    sendcloud_secret: null,
    sync_enabled: true,
    invoice_prefix: 'FAC',
    invoice_next_number: 1,
    payment_terms: null,
    bank_details: null,
    default_vat_rate: 20.00,
  })
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Editable tenant fields
  const [tenantForm, setTenantForm] = useState({
    name: '',
    code: '',
    siren: '',
    siret: '',
    vat_number: '',
    address: '',
    postal_code: '',
    city: '',
    country: 'France',
    email: '',
    phone: '',
  })

  // Create user dialog
  const [createUserOpen, setCreateUserOpen] = useState(false)
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [newUserRole, setNewUserRole] = useState('ops')
  const [creatingUser, setCreatingUser] = useState(false)

  useEffect(() => {
    fetchTenant()
  }, [tenantId])

  async function fetchTenant() {
    try {
      const response = await fetch(`/api/admin/tenants/${tenantId}`)
      const data = await response.json()
      setTenant(data.tenant)
      setSettings({
        sendcloud_api_key: data.settings?.sendcloud_api_key || null,
        sendcloud_secret: data.settings?.sendcloud_secret || null,
        sync_enabled: data.settings?.sync_enabled ?? true,
        invoice_prefix: data.settings?.invoice_prefix || 'FAC',
        invoice_next_number: data.settings?.invoice_next_number || 1,
        payment_terms: data.settings?.payment_terms || null,
        bank_details: data.settings?.bank_details || null,
        default_vat_rate: data.settings?.default_vat_rate || 20.00,
      })
      setTenantForm({
        name: data.tenant?.name || '',
        code: data.tenant?.code || '',
        siren: data.tenant?.siren || '',
        siret: data.tenant?.siret || '',
        vat_number: data.tenant?.vat_number || '',
        address: data.tenant?.address || '',
        postal_code: data.tenant?.postal_code || '',
        city: data.tenant?.city || '',
        country: data.tenant?.country || 'France',
        email: data.tenant?.email || '',
        phone: data.tenant?.phone || '',
      })
      setUsers(data.users || [])
    } catch (error) {
      console.error('Error fetching tenant:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const response = await fetch(`/api/admin/tenants/${tenantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...tenantForm,
          ...settings,
        }),
      })
      const data = await response.json()
      if (data.success) {
        toast.success('Configuration enregistree')
        fetchTenant()
      } else if (data.error) {
        toast.error(data.error)
      }
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive() {
    const newStatus = !tenant?.is_active
    try {
      const response = await fetch(`/api/admin/tenants/${tenantId}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: newStatus }),
      })
      const data = await response.json()
      if (data.success) {
        toast.success(data.message)
        fetchTenant()
      }
    } catch (error) {
      console.error('Error toggling active status:', error)
      toast.error('Erreur lors du changement de statut')
    }
  }

  async function handleCreateUser() {
    if (!newUserEmail || !newUserPassword) return
    setCreatingUser(true)
    try {
      const response = await fetch(`/api/admin/tenants/${tenantId}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newUserEmail,
          password: newUserPassword,
          role: newUserRole,
        }),
      })
      const data = await response.json()
      if (data.success) {
        setCreateUserOpen(false)
        setNewUserEmail('')
        setNewUserPassword('')
        setNewUserRole('ops')
        fetchTenant()
        toast.success('Utilisateur cree')
      } else {
        toast.error(data.error || 'Erreur lors de la creation')
      }
    } catch (error) {
      console.error('Error creating user:', error)
    } finally {
      setCreatingUser(false)
    }
  }

  async function handleDeleteTenant() {
    if (!confirm('Supprimer ce client et toutes ses donnees? Cette action est irreversible.')) {
      return
    }
    try {
      const response = await fetch(`/api/admin/tenants/${tenantId}`, {
        method: 'DELETE',
      })
      const data = await response.json()
      if (data.success) {
        toast.success('Client supprime')
        router.push('/admin/tenants')
      }
    } catch (error) {
      console.error('Error deleting tenant:', error)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted animate-pulse rounded w-48" />
        <div className="h-96 bg-muted animate-pulse rounded" />
      </div>
    )
  }

  if (!tenant) {
    return <div className="p-4">Client non trouve</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/tenants">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{tenant.name}</h1>
              {tenant.is_active === false && (
                <Badge variant="destructive">Inactif</Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm font-mono">
              {tenant.code || tenant.id}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">
            <Building2 className="h-4 w-4 mr-2" />
            General
          </TabsTrigger>
          <TabsTrigger value="address">
            <MapPin className="h-4 w-4 mr-2" />
            Coordonnees
          </TabsTrigger>
          <TabsTrigger value="billing">
            <Receipt className="h-4 w-4 mr-2" />
            Facturation
          </TabsTrigger>
          <TabsTrigger value="sendcloud">
            <Cloud className="h-4 w-4 mr-2" />
            Sendcloud
          </TabsTrigger>
          <TabsTrigger value="users">
            <Users className="h-4 w-4 mr-2" />
            Utilisateurs ({users.length})
          </TabsTrigger>
          <TabsTrigger value="danger">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Danger
          </TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>Informations generales</CardTitle>
              <CardDescription>
                Identite et statut du client
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom du client *</Label>
                  <Input
                    id="name"
                    value={tenantForm.name}
                    onChange={(e) =>
                      setTenantForm({ ...tenantForm, name: e.target.value })
                    }
                    placeholder="Ex: ACME LOGISTICS"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">Code client</Label>
                  <Input
                    id="code"
                    value={tenantForm.code}
                    onChange={(e) =>
                      setTenantForm({ ...tenantForm, code: e.target.value.toUpperCase() })
                    }
                    placeholder="Ex: ACME"
                    maxLength={8}
                    className="font-mono uppercase"
                  />
                  <p className="text-xs text-muted-foreground">
                    Utilise dans les references factures et exports
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="siren">SIREN</Label>
                  <Input
                    id="siren"
                    value={tenantForm.siren}
                    onChange={(e) =>
                      setTenantForm({ ...tenantForm, siren: e.target.value.replace(/\D/g, '') })
                    }
                    placeholder="9 chiffres"
                    maxLength={9}
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="siret">SIRET</Label>
                  <Input
                    id="siret"
                    value={tenantForm.siret}
                    onChange={(e) =>
                      setTenantForm({ ...tenantForm, siret: e.target.value.replace(/\D/g, '') })
                    }
                    placeholder="14 chiffres"
                    maxLength={14}
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vat_number">N° TVA</Label>
                  <Input
                    id="vat_number"
                    value={tenantForm.vat_number}
                    onChange={(e) =>
                      setTenantForm({ ...tenantForm, vat_number: e.target.value.toUpperCase() })
                    }
                    placeholder="Ex: FR12345678901"
                    className="font-mono uppercase"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <div>
                  <Label>Statut du client</Label>
                  <p className="text-sm text-muted-foreground">
                    {tenant.is_active !== false
                      ? 'Le client est actif et ses utilisateurs peuvent se connecter'
                      : 'Le client est desactive, ses utilisateurs ne peuvent plus se connecter'}
                  </p>
                </div>
                <Button
                  variant={tenant.is_active !== false ? 'outline' : 'default'}
                  onClick={handleToggleActive}
                >
                  {tenant.is_active !== false ? (
                    <>
                      <PowerOff className="h-4 w-4 mr-2" />
                      Desactiver
                    </>
                  ) : (
                    <>
                      <Power className="h-4 w-4 mr-2" />
                      Activer
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Address Tab */}
        <TabsContent value="address">
          <Card>
            <CardHeader>
              <CardTitle>Coordonnees</CardTitle>
              <CardDescription>
                Adresse et contact du client
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address">Adresse</Label>
                <Input
                  id="address"
                  value={tenantForm.address}
                  onChange={(e) =>
                    setTenantForm({ ...tenantForm, address: e.target.value })
                  }
                  placeholder="Numero et rue"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="postal_code">Code postal</Label>
                  <Input
                    id="postal_code"
                    value={tenantForm.postal_code}
                    onChange={(e) =>
                      setTenantForm({ ...tenantForm, postal_code: e.target.value })
                    }
                    placeholder="Ex: 75001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Ville</Label>
                  <Input
                    id="city"
                    value={tenantForm.city}
                    onChange={(e) =>
                      setTenantForm({ ...tenantForm, city: e.target.value })
                    }
                    placeholder="Ex: Paris"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Pays</Label>
                  <Input
                    id="country"
                    value={tenantForm.country}
                    onChange={(e) =>
                      setTenantForm({ ...tenantForm, country: e.target.value })
                    }
                    placeholder="Ex: France"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={tenantForm.email}
                    onChange={(e) =>
                      setTenantForm({ ...tenantForm, email: e.target.value })
                    }
                    placeholder="contact@client.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telephone</Label>
                  <Input
                    id="phone"
                    value={tenantForm.phone}
                    onChange={(e) =>
                      setTenantForm({ ...tenantForm, phone: e.target.value })
                    }
                    placeholder="Ex: +33 1 23 45 67 89"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing">
          <Card>
            <CardHeader>
              <CardTitle>Configuration facturation</CardTitle>
              <CardDescription>
                Parametres pour la generation des factures
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="invoice_prefix">Prefixe facture</Label>
                  <Input
                    id="invoice_prefix"
                    value={settings.invoice_prefix || ''}
                    onChange={(e) =>
                      setSettings({ ...settings, invoice_prefix: e.target.value.toUpperCase() })
                    }
                    placeholder="FAC"
                    maxLength={5}
                    className="font-mono uppercase"
                  />
                  <p className="text-xs text-muted-foreground">
                    Ex: FAC-2026-001
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invoice_next_number">Prochain numero</Label>
                  <Input
                    id="invoice_next_number"
                    type="number"
                    min={1}
                    value={settings.invoice_next_number || 1}
                    onChange={(e) =>
                      setSettings({ ...settings, invoice_next_number: parseInt(e.target.value) || 1 })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="default_vat_rate">Taux TVA (%)</Label>
                  <Input
                    id="default_vat_rate"
                    type="number"
                    step="0.01"
                    min={0}
                    max={100}
                    value={settings.default_vat_rate || 20}
                    onChange={(e) =>
                      setSettings({ ...settings, default_vat_rate: parseFloat(e.target.value) || 20 })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_terms">Conditions de paiement</Label>
                <Textarea
                  id="payment_terms"
                  value={settings.payment_terms || ''}
                  onChange={(e) =>
                    setSettings({ ...settings, payment_terms: e.target.value })
                  }
                  placeholder="Ex: Paiement a 30 jours fin de mois. Escompte: neant. Penalite de retard: 3 fois le taux d'interet legal."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bank_details">Coordonnees bancaires</Label>
                <Textarea
                  id="bank_details"
                  value={settings.bank_details || ''}
                  onChange={(e) =>
                    setSettings({ ...settings, bank_details: e.target.value })
                  }
                  placeholder="IBAN: FR76 XXXX XXXX XXXX&#10;BIC: BNPAFRPP"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Apparait sur les factures pour le reglement
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sendcloud Tab */}
        <TabsContent value="sendcloud">
          <Card>
            <CardHeader>
              <CardTitle>Configuration Sendcloud</CardTitle>
              <CardDescription>
                Credentials API pour la synchronisation des expeditions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="api_key">API Key</Label>
                  <Input
                    id="api_key"
                    type="password"
                    value={settings.sendcloud_api_key || ''}
                    onChange={(e) =>
                      setSettings({ ...settings, sendcloud_api_key: e.target.value || null })
                    }
                    placeholder="Entrez la cle API Sendcloud"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secret">Secret</Label>
                  <Input
                    id="secret"
                    type="password"
                    value={settings.sendcloud_secret || ''}
                    onChange={(e) =>
                      setSettings({ ...settings, sendcloud_secret: e.target.value || null })
                    }
                    placeholder="Entrez le secret Sendcloud"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <div>
                  <Label>Synchronisation automatique</Label>
                  <p className="text-sm text-muted-foreground">
                    Synchroniser les expeditions depuis Sendcloud (cron toutes les 15 min)
                  </p>
                </div>
                <Switch
                  checked={settings.sync_enabled}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, sync_enabled: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Utilisateurs</CardTitle>
                <CardDescription>
                  Utilisateurs associes a ce client
                </CardDescription>
              </div>
              <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nouvel utilisateur</DialogTitle>
                    <DialogDescription>
                      Creer un utilisateur pour {tenant.name}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="user_email">Email</Label>
                      <Input
                        id="user_email"
                        type="email"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        placeholder="user@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="user_password">Mot de passe</Label>
                      <Input
                        id="user_password"
                        type="password"
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        placeholder="Minimum 8 caracteres"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="user_role">Role</Label>
                      <Select value={newUserRole} onValueChange={setNewUserRole}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="ops">Operations</SelectItem>
                          <SelectItem value="sav">SAV</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCreateUserOpen(false)}>
                      Annuler
                    </Button>
                    <Button onClick={handleCreateUser} disabled={creatingUser}>
                      {creatingUser ? 'Creation...' : 'Creer'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {users.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Aucun utilisateur pour ce client
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.email}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {roleLabels[user.role] || user.role}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Danger Tab */}
        <TabsContent value="danger">
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-600 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Zone dangereuse
              </CardTitle>
              <CardDescription>
                Actions irreversibles - A utiliser avec precaution
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <h4 className="font-medium text-red-800 mb-2">Supprimer ce client</h4>
                <p className="text-sm text-red-600 mb-4">
                  Cette action supprimera definitivement le client et toutes ses donnees:
                  expeditions, produits, factures, utilisateurs, etc.
                  Cette action est irreversible.
                </p>
                <Button
                  variant="destructive"
                  onClick={handleDeleteTenant}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer definitivement
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
