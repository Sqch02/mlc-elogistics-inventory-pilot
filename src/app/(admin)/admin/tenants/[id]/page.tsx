'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
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
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react'
import Link from 'next/link'

interface Tenant {
  id: string
  name: string
  created_at: string
}

interface TenantSettings {
  sendcloud_api_key: string | null
  sendcloud_secret: string | null
  sync_enabled: boolean
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
    sendcloud_api_key: '',
    sendcloud_secret: '',
    sync_enabled: true,
  })
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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
        sendcloud_api_key: data.settings?.sendcloud_api_key || '',
        sendcloud_secret: data.settings?.sendcloud_secret || '',
        sync_enabled: data.settings?.sync_enabled ?? true,
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
        body: JSON.stringify(settings),
      })
      const data = await response.json()
      if (data.success) {
        alert('Configuration enregistree')
      }
    } catch (error) {
      console.error('Error saving settings:', error)
    } finally {
      setSaving(false)
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
      } else {
        alert(data.error || 'Erreur lors de la creation')
      }
    } catch (error) {
      console.error('Error creating user:', error)
    } finally {
      setCreatingUser(false)
    }
  }

  async function handleDeleteTenant() {
    if (!confirm('Supprimer ce tenant et toutes ses donnees? Cette action est irreversible.')) {
      return
    }
    try {
      const response = await fetch(`/api/admin/tenants/${tenantId}`, {
        method: 'DELETE',
      })
      const data = await response.json()
      if (data.success) {
        router.push('/admin/tenants')
      }
    } catch (error) {
      console.error('Error deleting tenant:', error)
    }
  }

  if (loading) {
    return <div className="p-4">Chargement...</div>
  }

  if (!tenant) {
    return <div className="p-4">Tenant non trouve</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/tenants">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{tenant.name}</h1>
          <p className="text-muted-foreground text-sm">ID: {tenant.id}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Sendcloud Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Configuration Sendcloud</CardTitle>
            <CardDescription>
              Credentials API pour la synchronisation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api_key">API Key</Label>
              <Input
                id="api_key"
                type="password"
                value={settings.sendcloud_api_key || ''}
                onChange={(e) =>
                  setSettings({ ...settings, sendcloud_api_key: e.target.value })
                }
                placeholder="Entrez la cle API"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="secret">Secret</Label>
              <Input
                id="secret"
                type="password"
                value={settings.sendcloud_secret || ''}
                onChange={(e) =>
                  setSettings({ ...settings, sendcloud_secret: e.target.value })
                }
                placeholder="Entrez le secret"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Synchronisation active</Label>
                <p className="text-sm text-muted-foreground">
                  Activer la sync quotidienne
                </p>
              </div>
              <Switch
                checked={settings.sync_enabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, sync_enabled: checked })
                }
              />
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">Zone dangereuse</CardTitle>
            <CardDescription>
              Actions irreversibles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              onClick={handleDeleteTenant}
              className="w-full"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer ce tenant
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Cette action supprime le tenant et toutes ses donnees associees.
            </p>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Users */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Utilisateurs</CardTitle>
            <CardDescription>
              Utilisateurs associes a ce tenant
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
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="user@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Mot de passe</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="Minimum 8 caracteres"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
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
            <p className="text-center text-muted-foreground py-4">
              Aucun utilisateur
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
                    <TableCell>{user.email}</TableCell>
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
    </div>
  )
}
