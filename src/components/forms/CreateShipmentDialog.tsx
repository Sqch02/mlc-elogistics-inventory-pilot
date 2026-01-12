'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import { Loader2, Plus, Trash2, Package, MapPin, Truck, User } from 'lucide-react'
import { useCreateShipment, CreateShipmentData } from '@/hooks/useShipments'
import { useSkus } from '@/hooks/useSkus'

interface CreateShipmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ShipmentItem {
  sku_code: string
  qty: number
}

const COUNTRY_CODES = [
  { code: 'FR', name: 'France' },
  { code: 'BE', name: 'Belgique' },
  { code: 'NL', name: 'Pays-Bas' },
  { code: 'DE', name: 'Allemagne' },
  { code: 'ES', name: 'Espagne' },
  { code: 'IT', name: 'Italie' },
  { code: 'PT', name: 'Portugal' },
  { code: 'GB', name: 'Royaume-Uni' },
  { code: 'CH', name: 'Suisse' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'AT', name: 'Autriche' },
]

const defaultFormData = {
  name: '',
  email: '',
  telephone: '',
  company_name: '',
  address: '',
  address_2: '',
  city: '',
  postal_code: '',
  country: 'FR',
  weight: 500,
  order_number: '',
  request_label: true,
}

export function CreateShipmentDialog({ open, onOpenChange }: CreateShipmentDialogProps) {
  const [formData, setFormData] = useState(defaultFormData)
  const [items, setItems] = useState<ShipmentItem[]>([])
  const [showItems, setShowItems] = useState(false)

  const createMutation = useCreateShipment()
  const { data: skusData } = useSkus()
  const skus = skusData?.skus || []

  const updateField = (field: string, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const addItem = () => {
    setItems(prev => [...prev, { sku_code: '', qty: 1 }])
  }

  const updateItem = (index: number, field: keyof ShipmentItem, value: string | number) => {
    setItems(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    const data: CreateShipmentData = {
      name: formData.name,
      email: formData.email || undefined,
      telephone: formData.telephone || undefined,
      company_name: formData.company_name || undefined,
      address: formData.address,
      address_2: formData.address_2 || undefined,
      city: formData.city,
      postal_code: formData.postal_code,
      country: formData.country,
      weight: formData.weight,
      order_number: formData.order_number || undefined,
      request_label: formData.request_label,
      items: items.filter(item => item.sku_code && item.qty > 0).length > 0
        ? items.filter(item => item.sku_code && item.qty > 0)
        : undefined,
    }

    await createMutation.mutateAsync(data)
    handleClose()
  }

  const handleClose = () => {
    setFormData(defaultFormData)
    setItems([])
    setShowItems(false)
    onOpenChange(false)
  }

  const isValid = formData.name && formData.address && formData.city && formData.postal_code && formData.country && formData.weight > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Nouvelle expedition
          </DialogTitle>
          <DialogDescription>
            Creer une nouvelle expedition dans Sendcloud
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Recipient Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <User className="h-4 w-4" />
              Destinataire
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom *</Label>
                <Input
                  id="name"
                  placeholder="Jean Dupont"
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_name">Societe</Label>
                <Input
                  id="company_name"
                  placeholder="Nom de l'entreprise"
                  value={formData.company_name}
                  onChange={(e) => updateField('company_name', e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@example.com"
                  value={formData.email}
                  onChange={(e) => updateField('email', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telephone">Telephone</Label>
                <Input
                  id="telephone"
                  placeholder="+33 6 12 34 56 78"
                  value={formData.telephone}
                  onChange={(e) => updateField('telephone', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Address Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <MapPin className="h-4 w-4" />
              Adresse de livraison
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Adresse *</Label>
              <Input
                id="address"
                placeholder="123 rue de la Paix"
                value={formData.address}
                onChange={(e) => updateField('address', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address_2">Complement d&apos;adresse</Label>
              <Input
                id="address_2"
                placeholder="Batiment A, 2eme etage"
                value={formData.address_2}
                onChange={(e) => updateField('address_2', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="postal_code">Code postal *</Label>
                <Input
                  id="postal_code"
                  placeholder="75001"
                  value={formData.postal_code}
                  onChange={(e) => updateField('postal_code', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Ville *</Label>
                <Input
                  id="city"
                  placeholder="Paris"
                  value={formData.city}
                  onChange={(e) => updateField('city', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Pays *</Label>
                <Select
                  value={formData.country}
                  onValueChange={(v) => updateField('country', v)}
                >
                  <SelectTrigger id="country">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRY_CODES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Shipment Details Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Truck className="h-4 w-4" />
              Details de l&apos;expedition
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="weight">Poids (grammes) *</Label>
                <Input
                  id="weight"
                  type="number"
                  min="1"
                  placeholder="500"
                  value={formData.weight}
                  onChange={(e) => updateField('weight', parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="order_number">Reference commande</Label>
                <Input
                  id="order_number"
                  placeholder="CMD-12345"
                  value={formData.order_number}
                  onChange={(e) => updateField('order_number', e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="request_label"
                checked={formData.request_label}
                onCheckedChange={(checked) => updateField('request_label', !!checked)}
              />
              <Label htmlFor="request_label" className="text-sm font-normal">
                Demander l&apos;etiquette immediatement
              </Label>
            </div>
          </div>

          {/* Items Section (Optional) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Package className="h-4 w-4" />
                Articles (optionnel)
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowItems(!showItems)
                  if (!showItems && items.length === 0) {
                    addItem()
                  }
                }}
              >
                {showItems ? 'Masquer' : 'Ajouter des articles'}
              </Button>
            </div>

            {showItems && (
              <div className="space-y-3 p-4 rounded-lg bg-muted/50">
                {items.map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="flex-1">
                      <Select
                        value={item.sku_code}
                        onValueChange={(v) => updateItem(index, 'sku_code', v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selectionner un SKU" />
                        </SelectTrigger>
                        <SelectContent>
                          {skus.map((sku) => (
                            <SelectItem key={sku.sku_code} value={sku.sku_code}>
                              {sku.sku_code} - {sku.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-24">
                      <Input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        value={item.qty}
                        onChange={(e) => updateItem(index, 'qty', parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground hover:text-error"
                      onClick={() => removeItem(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addItem} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter un article
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Les articles seront lies a l&apos;expedition et le stock sera automatiquement mis a jour.
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending || !isValid}>
            {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Creer l&apos;expedition
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
