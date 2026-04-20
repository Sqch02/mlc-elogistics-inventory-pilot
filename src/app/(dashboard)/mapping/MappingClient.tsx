'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AlertCircle, CheckCircle2, Loader2, Plus, Search, Link as LinkIcon } from 'lucide-react'

interface UnmappedGroup {
  raw_sku: string | null
  raw_description: string | null
  raw_variant_id: string | null
  total_qty: number
  nb_shipments: number
  first_seen: string | null
  last_seen: string | null
  sample_orders: string[]
}

interface SkuOption {
  id: string
  sku_code: string
  name: string
}

type ResolveAction = 'map_to_sku' | 'create_sku' | 'add_rule'

interface ResolvePayload {
  action: ResolveAction
  raw_sku?: string | null
  raw_description?: string | null
  raw_variant_id?: string | null
  target_sku_id?: string
  new_sku?: { sku_code: string; name: string }
}

async function fetchUnmapped(): Promise<{ groups: UnmappedGroup[] }> {
  const res = await fetch('/api/mapping/unmapped')
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Erreur lors du chargement')
  }
  return res.json()
}

async function fetchSkus(): Promise<{ skus: SkuOption[] }> {
  const res = await fetch('/api/skus?all=true')
  if (!res.ok) throw new Error('Erreur lors du chargement des SKUs')
  return res.json()
}

async function resolveMapping(payload: ResolvePayload) {
  const res = await fetch('/api/mapping/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Erreur lors de la resolution')
  }
  return res.json()
}

function groupKey(g: UnmappedGroup): string {
  return [g.raw_sku ?? '', g.raw_description ?? '', g.raw_variant_id ?? ''].join('||')
}

function formatDate(iso: string | null): string {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return '-'
  }
}

export function MappingClient() {
  const queryClient = useQueryClient()

  const [searchInput, setSearchInput] = useState('')
  const [mapOpen, setMapOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [activeGroup, setActiveGroup] = useState<UnmappedGroup | null>(null)
  const [selectedSkuId, setSelectedSkuId] = useState<string>('')
  const [skuSearch, setSkuSearch] = useState('')
  const [newSkuForm, setNewSkuForm] = useState({ sku_code: '', name: '' })

  const {
    data: unmappedData,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ['mapping', 'unmapped'],
    queryFn: fetchUnmapped,
    staleTime: 30 * 1000,
  })

  const { data: skusData } = useQuery({
    queryKey: ['skus', 'all'],
    queryFn: fetchSkus,
    staleTime: 2 * 60 * 1000,
  })

  const resolveMutation = useMutation({
    mutationFn: resolveMapping,
    onSuccess: () => {
      toast.success('Mapping cree. Les statistiques seront mises a jour.')
      queryClient.invalidateQueries({ queryKey: ['mapping', 'unmapped'] })
      queryClient.invalidateQueries({ queryKey: ['skus'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      setMapOpen(false)
      setCreateOpen(false)
      setActiveGroup(null)
      setSelectedSkuId('')
      setSkuSearch('')
      setNewSkuForm({ sku_code: '', name: '' })
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const groups = unmappedData?.groups ?? []

  const filteredGroups = useMemo(() => {
    if (!searchInput.trim()) return groups
    const q = searchInput.trim().toLowerCase()
    return groups.filter((g) => {
      return (
        (g.raw_sku ?? '').toLowerCase().includes(q) ||
        (g.raw_description ?? '').toLowerCase().includes(q) ||
        (g.raw_variant_id ?? '').toLowerCase().includes(q)
      )
    })
  }, [groups, searchInput])

  const skuOptions = useMemo(() => {
    const all = skusData?.skus ?? []
    if (!skuSearch.trim()) return all.slice(0, 100)
    const q = skuSearch.trim().toLowerCase()
    return all
      .filter(
        (s) =>
          s.sku_code.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q)
      )
      .slice(0, 100)
  }, [skusData, skuSearch])

  const openMap = (group: UnmappedGroup) => {
    setActiveGroup(group)
    setSelectedSkuId('')
    setSkuSearch('')
    setMapOpen(true)
  }

  const openCreate = (group: UnmappedGroup) => {
    setActiveGroup(group)
    setNewSkuForm({
      sku_code: group.raw_sku ?? '',
      name: group.raw_description ?? group.raw_sku ?? '',
    })
    setCreateOpen(true)
  }

  const submitMap = () => {
    if (!activeGroup || !selectedSkuId) return
    resolveMutation.mutate({
      action: 'map_to_sku',
      raw_sku: activeGroup.raw_sku,
      raw_description: activeGroup.raw_description,
      raw_variant_id: activeGroup.raw_variant_id,
      target_sku_id: selectedSkuId,
    })
  }

  const submitCreate = () => {
    if (!activeGroup) return
    if (!newSkuForm.sku_code.trim() || !newSkuForm.name.trim()) return
    resolveMutation.mutate({
      action: 'create_sku',
      raw_sku: activeGroup.raw_sku,
      raw_description: activeGroup.raw_description,
      raw_variant_id: activeGroup.raw_variant_id,
      new_sku: {
        sku_code: newSkuForm.sku_code.trim(),
        name: newSkuForm.name.trim(),
      },
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-foreground">Centre de mapping</h1>
        <p className="text-muted-foreground text-sm max-w-3xl">
          Articles non identifies dans les expeditions. Une fois resolus, les statistiques
          seront mises a jour retroactivement.
        </p>
      </div>

      {/* Summary + search */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-warning/10 text-warning">
              <AlertCircle className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs uppercase font-medium text-muted-foreground">
                Articles non mappes
              </p>
              <p className="text-lg font-semibold">
                {isLoading ? '...' : groups.length}
                {isFetching && !isLoading && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    (actualisation...)
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex-1" />

          <div className="relative min-w-[220px] max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher (SKU, description, variant)..."
              className="pl-9"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* Content */}
      {isLoading ? (
        <Card className="p-8">
          <div className="flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Chargement...
          </div>
        </Card>
      ) : filteredGroups.length === 0 ? (
        <Card className="p-10">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="p-3 rounded-full bg-success/10 text-success mb-4">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <p className="font-medium">Aucun article non mappe</p>
            <p className="text-sm text-muted-foreground mt-1">
              Tous les articles de vos expeditions sont correctement associes a des SKUs.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredGroups.map((group) => (
            <Card key={groupKey(group)}>
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                  {/* Info column */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-semibold text-sm">
                        {group.raw_sku || (
                          <span className="text-muted-foreground italic">(SKU vide)</span>
                        )}
                      </span>
                      {group.raw_variant_id && (
                        <Badge variant="muted" className="font-mono text-[11px]">
                          variant: {group.raw_variant_id}
                        </Badge>
                      )}
                    </div>

                    {group.raw_description && (
                      <p className="text-sm text-foreground break-words">
                        {group.raw_description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1">
                      <span>
                        <strong className="text-foreground">{group.total_qty}</strong> unite(s)
                      </span>
                      <span>
                        <strong className="text-foreground">{group.nb_shipments}</strong>{' '}
                        expedition(s)
                      </span>
                      <span>Premiere: {formatDate(group.first_seen)}</span>
                      <span>Derniere: {formatDate(group.last_seen)}</span>
                    </div>

                    {group.sample_orders.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 pt-1">
                        <span className="text-xs text-muted-foreground mr-1">Commandes:</span>
                        {group.sample_orders.map((ref) => (
                          <Badge key={ref} variant="muted" className="font-mono text-[11px]">
                            {ref}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions column */}
                  <div className="flex flex-col sm:flex-row lg:flex-col gap-2 lg:w-[220px] shrink-0">
                    <Button
                      variant="default"
                      size="sm"
                      className="w-full"
                      onClick={() => openMap(group)}
                    >
                      <LinkIcon className="h-4 w-4 mr-2" />
                      Mapper vers un SKU existant
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => openCreate(group)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Creer un nouveau SKU
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Map to existing SKU dialog */}
      <Dialog open={mapOpen} onOpenChange={setMapOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mapper vers un SKU existant</DialogTitle>
            <DialogDescription>
              Associer cet article a un SKU. Une regle de mapping sera creee pour
              resoudre automatiquement les futures occurrences.
            </DialogDescription>
          </DialogHeader>
          {activeGroup && (
            <div className="space-y-4 py-2">
              <div className="rounded-md bg-muted/50 p-3 space-y-1 text-sm">
                {activeGroup.raw_sku && (
                  <div>
                    <span className="text-muted-foreground">SKU brut: </span>
                    <span className="font-mono">{activeGroup.raw_sku}</span>
                  </div>
                )}
                {activeGroup.raw_description && (
                  <div>
                    <span className="text-muted-foreground">Description: </span>
                    <span>{activeGroup.raw_description}</span>
                  </div>
                )}
                {activeGroup.raw_variant_id && (
                  <div>
                    <span className="text-muted-foreground">Variant ID: </span>
                    <span className="font-mono">{activeGroup.raw_variant_id}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="sku-search">Rechercher un SKU</Label>
                <Input
                  id="sku-search"
                  placeholder="Code ou nom..."
                  value={skuSearch}
                  onChange={(e) => setSkuSearch(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sku-select">SKU cible</Label>
                <Select value={selectedSkuId} onValueChange={setSelectedSkuId}>
                  <SelectTrigger id="sku-select">
                    <SelectValue placeholder="Selectionner un SKU" />
                  </SelectTrigger>
                  <SelectContent>
                    {skuOptions.length === 0 ? (
                      <div className="py-6 text-center text-sm text-muted-foreground">
                        Aucun SKU trouve
                      </div>
                    ) : (
                      skuOptions.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          <span className="font-mono">{s.sku_code}</span>
                          <span className="text-muted-foreground ml-2">{s.name}</span>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMapOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={submitMap}
              disabled={!selectedSkuId || resolveMutation.isPending}
            >
              {resolveMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Mapper
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create new SKU dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Creer un nouveau SKU</DialogTitle>
            <DialogDescription>
              Creer un SKU et associer cet article. Une regle de mapping sera creee
              automatiquement.
            </DialogDescription>
          </DialogHeader>
          {activeGroup && (
            <div className="space-y-4 py-2">
              <div className="rounded-md bg-muted/50 p-3 space-y-1 text-sm">
                {activeGroup.raw_sku && (
                  <div>
                    <span className="text-muted-foreground">SKU brut: </span>
                    <span className="font-mono">{activeGroup.raw_sku}</span>
                  </div>
                )}
                {activeGroup.raw_description && (
                  <div>
                    <span className="text-muted-foreground">Description: </span>
                    <span>{activeGroup.raw_description}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="new-sku-code">Code SKU *</Label>
                  <Input
                    id="new-sku-code"
                    placeholder="ABC-123"
                    value={newSkuForm.sku_code}
                    onChange={(e) =>
                      setNewSkuForm({ ...newSkuForm, sku_code: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-sku-name">Nom *</Label>
                  <Input
                    id="new-sku-name"
                    placeholder="Nom du produit"
                    value={newSkuForm.name}
                    onChange={(e) =>
                      setNewSkuForm({ ...newSkuForm, name: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={submitCreate}
              disabled={
                !newSkuForm.sku_code.trim() ||
                !newSkuForm.name.trim() ||
                resolveMutation.isPending
              }
            >
              {resolveMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Creer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
