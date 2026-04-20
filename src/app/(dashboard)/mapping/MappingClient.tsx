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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  HelpCircle,
  Info,
  Loader2,
  Plus,
  Search,
  Link as LinkIcon,
} from 'lucide-react'

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

type AnomalyType =
  | 'order_ref_as_description'
  | 'empty_sku'
  | 'sku_with_spaces'
  | 'sku_with_accents'

interface SampleOrder {
  order_ref: string
  date: string | null
  client: string | null
}

interface AnomalyGroup {
  type: AnomalyType
  raw_sku: string | null
  raw_description: string | null
  nb_occurrences: number
  total_qty: number
  sample_orders: SampleOrder[]
  suggested_action: string
}

const ANOMALY_LABELS: Record<AnomalyType, string> = {
  order_ref_as_description: 'Numero de commande comme description',
  empty_sku: 'SKU vide dans Shopify',
  sku_with_spaces: 'SKU avec espaces (probablement un nom)',
  sku_with_accents: 'SKU avec accents',
}

const ANOMALY_VARIANTS: Record<
  AnomalyType,
  'error' | 'warning' | 'info' | 'gold'
> = {
  order_ref_as_description: 'error',
  empty_sku: 'warning',
  sku_with_spaces: 'gold',
  sku_with_accents: 'info',
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

async function fetchAnomalies(): Promise<{
  anomalies: AnomalyGroup[]
  total_anomalies: number
}> {
  const res = await fetch('/api/mapping/anomalies')
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Erreur lors du chargement des anomalies')
  }
  return res.json()
}

function anomalyKey(a: AnomalyGroup): string {
  return [a.type, a.raw_sku ?? '', a.raw_description ?? ''].join('||')
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

function normalizeStr(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function findMatchingSku(
  hint: string | null,
  skus: SkuOption[]
): SkuOption | null {
  if (!hint) return null
  const nh = normalizeStr(hint).replace(
    /^(flacon|pack|coffret|bundle|kit|lot)\s+/i,
    ''
  )
  if (nh.length < 3) return null
  const tokens = nh.split(/\s+/).filter((t) => t.length >= 3)
  if (tokens.length === 0) return null

  let best: { sku: SkuOption; score: number } | null = null
  for (const sku of skus) {
    const nname = normalizeStr(sku.name)
    if (!nname) continue
    let score = 0
    for (const t of tokens) if (nname.includes(t)) score += 1
    if (nname.includes(nh) || nh.includes(nname)) score += 2
    if (score > 0 && (!best || score > best.score)) best = { sku, score }
  }
  return best && best.score >= 2 ? best.sku : null
}

interface FixGuide {
  problem: string
  impact: string
  steps: string[]
  suggestedSku?: SkuOption
  suggestedValue?: string
}

function buildFixGuide(a: AnomalyGroup, skus: SkuOption[]): FixGuide {
  switch (a.type) {
    case 'empty_sku': {
      const match = findMatchingSku(a.raw_description, skus)
      return {
        problem: `Le produit "${a.raw_description ?? '(sans nom)'}" est vendu sur Shopify sans code SKU.`,
        impact: `${a.total_qty} unite(s) ne sont pas rattachees a ton stock ni a tes statistiques.`,
        steps: [
          `Ouvrir Shopify Admin > Produits.`,
          `Rechercher "${a.raw_description ?? ''}" et ouvrir la fiche.`,
          `Descendre a la section "Inventaire" > champ "SKU".`,
          match
            ? `Saisir le code : ${match.sku_code} (correspond au produit "${match.name}" deja dans l'app).`
            : `Saisir le code SKU (format Florna : FLRN-XXXXXX-FBCG, ex: FLRN-PPOIDS-FBCG pour "Perte de poids").`,
          `Cliquer sur "Enregistrer". La correction sera prise en compte au prochain sync (sous 5 min).`,
        ],
        suggestedSku: match ?? undefined,
      }
    }
    case 'sku_with_spaces': {
      const match =
        findMatchingSku(a.raw_sku, skus) ??
        findMatchingSku(a.raw_description, skus)
      return {
        problem: `Le champ SKU contient du texte libre ("${a.raw_sku}") au lieu d'un code court.`,
        impact: `Un SKU doit etre un identifiant unique sans espaces. ${a.total_qty} unite(s) ne peuvent pas etre reliees a l'inventaire.`,
        steps: [
          `Ouvrir Shopify Admin > Produits.`,
          `Ouvrir la fiche (champ SKU actuel : "${a.raw_sku}").`,
          `Section "Inventaire" > champ "SKU".`,
          match
            ? `Remplacer par : ${match.sku_code} (correspond au produit "${match.name}" deja dans l'app).`
            : `Remplacer par un vrai code court (ex: FLRN-XXXXXX-FBCG).`,
          `Cliquer sur "Enregistrer".`,
        ],
        suggestedSku: match ?? undefined,
      }
    }
    case 'sku_with_accents': {
      const match =
        findMatchingSku(a.raw_sku, skus) ??
        findMatchingSku(a.raw_description, skus)
      const cleaned = normalizeStr(a.raw_sku ?? '')
        .toUpperCase()
        .replace(/\s+/g, '-')
      return {
        problem: `Le code SKU contient des accents ("${a.raw_sku}"). Les codes SKU ne doivent pas contenir d'accents.`,
        impact: `${a.total_qty} unite(s) risquent de ne pas etre matchees avec l'inventaire.`,
        steps: [
          `Ouvrir Shopify Admin > Produits.`,
          `Ouvrir la fiche avec SKU "${a.raw_sku}".`,
          `Section "Inventaire" > champ "SKU".`,
          match
            ? `Remplacer par : ${match.sku_code} (correspond au produit "${match.name}" deja dans l'app).`
            : `Remplacer par : ${cleaned} (version sans accents).`,
          `Cliquer sur "Enregistrer".`,
        ],
        suggestedSku: match ?? undefined,
        suggestedValue: match ? undefined : cleaned,
      }
    }
    case 'order_ref_as_description': {
      return {
        problem: `Commandes traitees manuellement par le SAV : le numero de commande ("${a.raw_description}") a ete saisi a la place du nom du produit dans Shopify.`,
        impact: `${a.total_qty} unite(s) ne sont pas identifiables par produit dans les stats. Pour les stocks, il faut rattacher chacune de ces commandes au bon produit dans Shopify.`,
        steps: [
          `Pour chaque commande listee ci-dessous, ouvrir la commande dans Shopify Admin.`,
          `Identifier quel produit physique a reellement ete expedie (voir notes SAV ou communication client).`,
          `Remplacer la ligne generique par le bon produit Shopify (avec SKU correct).`,
          `Si recurrence importante : demander au SAV de toujours utiliser le produit du catalogue plutot qu'une description libre.`,
          `La correction sera prise en compte au prochain sync (sous 5 min).`,
        ],
      }
    }
    default:
      return {
        problem: 'Anomalie detectee dans Shopify.',
        impact: `${a.total_qty} unite(s) concernees.`,
        steps: ['Corriger la fiche produit dans Shopify.'],
      }
  }
}

function OrderBadgeList({
  orders,
  showAll,
  label,
}: {
  orders: SampleOrder[]
  showAll: boolean
  label: string
}) {
  const [expanded, setExpanded] = useState(false)
  const initialLimit = showAll ? 8 : 3
  const display = expanded ? orders : orders.slice(0, initialLimit)
  const hidden = orders.length - display.length

  return (
    <div className="pt-1">
      <div className="text-xs text-muted-foreground mb-1.5 font-medium">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {display.map((o) => (
          <Badge
            key={o.order_ref}
            variant="muted"
            className="font-mono text-[11px]"
          >
            {o.order_ref}
            {o.date ? ` - ${formatDate(o.date)}` : ''}
            {o.client ? ` - ${o.client}` : ''}
          </Badge>
        ))}
        {hidden > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-[11px] font-medium text-primary hover:underline px-1.5"
          >
            + {hidden} autre{hidden > 1 ? 's' : ''} commande{hidden > 1 ? 's' : ''}
          </button>
        )}
        {expanded && orders.length > initialLimit && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="text-[11px] font-medium text-muted-foreground hover:underline px-1.5"
          >
            Reduire
          </button>
        )}
      </div>
    </div>
  )
}

function AnomaliesSection({
  anomalies,
  isLoading,
  skus,
}: {
  anomalies: AnomalyGroup[]
  isLoading: boolean
  skus: SkuOption[]
}) {
  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="flex items-center text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Analyse des produits Shopify...
        </div>
      </Card>
    )
  }

  const total = anomalies.length

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="p-2 rounded-lg bg-error/10 text-error shrink-0">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-foreground">
                Anomalies Shopify a corriger
              </h2>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="Aide sur les anomalies"
                      className="text-muted-foreground hover:text-foreground inline-flex"
                    >
                      <HelpCircle className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-[11px] leading-relaxed">
                    Cette section detecte les erreurs de saisie dans vos fiches
                    produits Shopify (SKU manquant, numero de commande a la place
                    du nom, espaces ou accents dans le SKU). Corrigez directement
                    dans Shopify : le prochain sync mettra a jour les donnees
                    automatiquement.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {total > 0 && (
                <Badge variant="error" className="ml-1">
                  {total} anomalie{total > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Problemes detectes dans vos produits Shopify depuis le debut de
              l&apos;annee. Chaque anomalie est detaillee ci-dessous avec la
              marche a suivre.
            </p>
          </div>
        </div>

        {total === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-success/5 border border-success/20 rounded-md p-3">
            <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
            <span>
              Aucune anomalie detectee. Vos fiches produits Shopify semblent
              propres.
            </span>
          </div>
        ) : (
          <div className="grid gap-4">
            {anomalies.map((a) => {
              const guide = buildFixGuide(a, skus)
              return (
                <div
                  key={anomalyKey(a)}
                  className="rounded-md border border-border bg-background p-3.5 space-y-3"
                >
                  {/* Header */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={ANOMALY_VARIANTS[a.type]}>
                      {ANOMALY_LABELS[a.type]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      <strong className="text-foreground">{a.total_qty}</strong>{' '}
                      unite(s) sur{' '}
                      <strong className="text-foreground">
                        {a.nb_occurrences}
                      </strong>{' '}
                      occurrence(s)
                    </span>
                  </div>

                  {/* Raw data */}
                  <div className="text-sm space-y-1 bg-muted/40 rounded-md p-2.5">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground w-24 shrink-0">
                        SKU Shopify:
                      </span>
                      <span className="font-mono break-all">
                        {a.raw_sku && a.raw_sku.length > 0 ? (
                          a.raw_sku
                        ) : (
                          <span className="text-muted-foreground italic">
                            (vide)
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground w-24 shrink-0">
                        Description:
                      </span>
                      <span className="break-words">
                        {a.raw_description && a.raw_description.length > 0 ? (
                          a.raw_description
                        ) : (
                          <span className="text-muted-foreground italic">
                            (vide)
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Problem block */}
                  <div className="flex items-start gap-2 rounded-md bg-error/5 border border-error/15 p-2.5">
                    <AlertTriangle className="h-4 w-4 text-error shrink-0 mt-0.5" />
                    <div className="text-sm leading-relaxed">
                      <span className="font-semibold text-error text-[11px] uppercase tracking-wide block mb-0.5">
                        Le probleme
                      </span>
                      <span className="text-foreground">{guide.problem}</span>
                    </div>
                  </div>

                  {/* Impact block */}
                  <div className="flex items-start gap-2 rounded-md bg-warning/5 border border-warning/15 p-2.5">
                    <Info className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                    <div className="text-sm leading-relaxed">
                      <span className="font-semibold text-warning text-[11px] uppercase tracking-wide block mb-0.5">
                        L'impact
                      </span>
                      <span className="text-foreground">{guide.impact}</span>
                    </div>
                  </div>

                  {/* Fix block */}
                  <div className="rounded-md bg-success/5 border border-success/15 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                      <span className="font-semibold text-success text-[11px] uppercase tracking-wide">
                        Comment corriger (etape par etape)
                      </span>
                    </div>
                    <ol className="list-decimal list-inside space-y-1.5 text-sm text-foreground marker:text-success marker:font-semibold">
                      {guide.steps.map((step, i) => (
                        <li key={i} className="leading-relaxed">
                          {step}
                        </li>
                      ))}
                    </ol>
                    {guide.suggestedSku && (
                      <div className="mt-3 rounded-md border border-primary/20 bg-primary/5 p-2.5 text-xs flex items-start gap-2">
                        <LinkIcon className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                        <div>
                          <span className="text-muted-foreground">
                            SKU suggere (existe deja dans l'app) :
                          </span>{' '}
                          <code className="font-mono font-semibold text-primary">
                            {guide.suggestedSku.sku_code}
                          </code>
                          <span className="text-muted-foreground">
                            {' '}
                            — {guide.suggestedSku.name}
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="mt-3">
                      <Button asChild variant="outline" size="sm">
                        <a
                          href="https://admin.shopify.com/products"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Ouvrir Shopify Admin
                        </a>
                      </Button>
                    </div>
                  </div>

                  {/* Examples — for SAV type, show all orders (important for the workflow). */}
                  {a.sample_orders.length > 0 && (
                    <OrderBadgeList
                      orders={a.sample_orders}
                      showAll={a.type === 'order_ref_as_description'}
                      label={
                        a.type === 'order_ref_as_description'
                          ? `${a.sample_orders.length} commande(s) SAV a retraiter`
                          : 'Exemples de commandes'
                      }
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
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
    staleTime: 2 * 60 * 1000, // 2 min (refreshed by cron every 5 min)
  })

  const {
    data: anomaliesData,
    isLoading: isAnomaliesLoading,
  } = useQuery({
    queryKey: ['mapping', 'anomalies'],
    queryFn: fetchAnomalies,
    staleTime: 5 * 60 * 1000, // 5 min (RPC scans 7 days of raw_json)
  })

  const anomalies = useMemo<AnomalyGroup[]>(
    () => anomaliesData?.anomalies ?? [],
    [anomaliesData]
  )

  const { data: skusData } = useQuery({
    queryKey: ['skus', 'all'],
    queryFn: fetchSkus,
    staleTime: 10 * 60 * 1000, // 10 min (SKU list changes rarely)
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

  const groups = useMemo<UnmappedGroup[]>(
    () => unmappedData?.groups ?? [],
    [unmappedData]
  )

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

      {/* Anomalies Shopify section */}
      <AnomaliesSection
        anomalies={anomalies}
        isLoading={isAnomaliesLoading}
        skus={skusData?.skus ?? []}
      />

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
