'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, Loader2 } from 'lucide-react'

export function NewClaimButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    order_ref: '',
    description: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_ref: formData.order_ref || null,
          description: formData.description || null,
          status: 'ouverte',
        }),
      })

      const result = await response.json()

      if (!result.success) {
        setError(result.error || 'Erreur lors de la création')
        return
      }

      setOpen(false)
      setFormData({ order_ref: '', description: '' })
      router.refresh()
    } catch (err) {
      setError('Erreur de connexion')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Nouveau Ticket
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle Réclamation</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Référence commande</label>
            <Input
              placeholder="ORD-12345"
              value={formData.order_ref}
              onChange={(e) => setFormData({ ...formData, order_ref: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea
              placeholder="Décrivez le problème..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Créer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface UpdateClaimStatusProps {
  claimId: string
  currentStatus: string
}

export function UpdateClaimStatus({ claimId, currentStatus }: UpdateClaimStatusProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState(currentStatus)

  const handleChange = async (newStatus: string) => {
    if (newStatus === status) return
    setIsLoading(true)

    try {
      const response = await fetch(`/api/claims/${claimId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.ok) {
        setStatus(newStatus)
        router.refresh()
      }
    } catch (err) {
      console.error('Error updating claim:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Select value={status} onValueChange={handleChange} disabled={isLoading}>
      <SelectTrigger className="w-[140px] h-8 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ouverte">Ouvert</SelectItem>
        <SelectItem value="en_analyse">En analyse</SelectItem>
        <SelectItem value="indemnisee">Indemnisée</SelectItem>
        <SelectItem value="refusee">Refusée</SelectItem>
        <SelectItem value="cloturee">Clôturée</SelectItem>
      </SelectContent>
    </Select>
  )
}
