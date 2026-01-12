'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, MapPin, Package, Calendar, AlertTriangle } from 'lucide-react'
import { useUpdateLocation, type Location } from '@/hooks/useLocations'
import { useSkus } from '@/hooks/useSkus'
import { cn } from '@/lib/utils'

interface EditLocationDialogProps {
  location: Location | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditLocationDialog({ location, open, onOpenChange }: EditLocationDialogProps) {
  const [status, setStatus] = useState<'occupied' | 'empty' | 'blocked'>('empty')
  const [content, setContent] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [skuCode, setSkuCode] = useState('')

  const updateMutation = useUpdateLocation()
  const { data: skusData } = useSkus()
  const skus = skusData?.skus || []

  // Sync form with location when it changes
  useEffect(() => {
    if (location) {
      setStatus(location.status || 'empty')
      setContent(location.content || '')
      setExpiryDate(location.expiry_date || '')
      setSkuCode(location.assignment?.sku?.sku_code || '')
    }
  }, [location])

  const handleSave = async () => {
    if (!location) return

    try {
      await updateMutation.mutateAsync({
        id: location.id,
        status,
        content: content || null,
        expiry_date: expiryDate || null,
        sku_code: skuCode || null,
      })
      onOpenChange(false)
    } catch {
      // Error handled by mutation
    }
  }

  const handleClear = async () => {
    if (!location) return

    try {
      await updateMutation.mutateAsync({
        id: location.id,
        status: 'empty',
        content: null,
        expiry_date: null,
        sku_code: null,
      })
      onOpenChange(false)
    } catch {
      // Error handled by mutation
    }
  }

  const statusOptions = [
    { value: 'occupied', label: 'Occupé', color: 'bg-blue-100 text-blue-700' },
    { value: 'empty', label: 'Vide', color: 'bg-gray-100 text-gray-700' },
    { value: 'blocked', label: 'Bloqué', color: 'bg-orange-100 text-orange-700' },
  ] as const

  // Check expiry status
  const isExpiringSoon = expiryDate &&
    new Date(expiryDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) &&
    new Date(expiryDate) >= new Date()

  const isExpired = expiryDate && new Date(expiryDate) < new Date()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Modifier l&apos;emplacement
          </DialogTitle>
          <DialogDescription>
            {location && (
              <span className="font-mono text-sm">{location.code}</span>
            )}
            {location?.label && (
              <span className="ml-2 text-muted-foreground">- {location.label}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Status */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Statut</label>
            <div className="flex gap-2">
              {statusOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStatus(opt.value)}
                  className={cn(
                    'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all',
                    'border-2',
                    status === opt.value
                      ? cn(opt.color, 'border-current')
                      : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4" />
              Contenu
            </label>
            <Input
              placeholder="Description du contenu stocké..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Ex: FLORNA X20 Boites, Palettes Anxiété...
            </p>
          </div>

          {/* Expiry Date */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Date de péremption
              {isExpired && (
                <Badge variant="destructive" className="text-[10px]">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Expiré!
                </Badge>
              )}
              {isExpiringSoon && (
                <Badge variant="warning" className="text-[10px]">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Expire bientôt
                </Badge>
              )}
            </label>
            <Input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
          </div>

          {/* SKU Assignment */}
          <div className="space-y-2">
            <label className="text-sm font-medium">SKU assigné (optionnel)</label>
            <Select value={skuCode} onValueChange={setSkuCode}>
              <SelectTrigger>
                <SelectValue placeholder="Aucun SKU assigné" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Aucun</SelectItem>
                {skus.map((sku) => (
                  <SelectItem key={sku.id} value={sku.sku_code}>
                    {sku.sku_code} - {sku.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="ghost"
            onClick={handleClear}
            disabled={updateMutation.isPending}
            className="text-muted-foreground"
          >
            Vider l&apos;emplacement
          </Button>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
