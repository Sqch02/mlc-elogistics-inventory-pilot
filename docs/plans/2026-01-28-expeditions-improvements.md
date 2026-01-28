# Expeditions Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add error indicators, edit functionality, and date picker to expeditions/analytics pages.

**Architecture:** Extend existing ExpeditionsClient with error badge styling and edit modal. Add DateRangePicker component to Analytics page with API filter support.

**Tech Stack:** Next.js, React, TanStack Query, Tailwind CSS, Lucide icons, shadcn/ui

---

## Task 1: Add Error Indicator to Expeditions Status Badge

**Files:**
- Modify: `src/app/(dashboard)/expeditions/ExpeditionsClient.tsx`

**Step 1: Add error status detection helper**

Add this constant at the top of the file (after imports):

```tsx
// Sendcloud error status IDs
const ERROR_STATUS_IDS = [62, 80, 91, 92, 93, 1999, 2000, 2001]

function isErrorStatus(statusId: number | null): boolean {
  return statusId !== null && ERROR_STATUS_IDS.includes(statusId)
}
```

**Step 2: Import AlertTriangle icon**

Add `AlertTriangle` to the lucide-react import.

**Step 3: Update status badge rendering**

Find the status badge in the table row and update to show error state:

```tsx
{/* Status badge with error indicator */}
{isErrorStatus(shipment.status_id) ? (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger>
        <Badge variant="error" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          {shipment.status_message || 'Erreur'}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p>{shipment.status_message || 'Erreur Sendcloud'}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
) : (
  <Badge variant={getStatusVariant(shipment.status_id)}>
    {shipment.status_message || 'En attente'}
  </Badge>
)}
```

**Step 4: Import Tooltip components**

Add imports for Tooltip from shadcn:

```tsx
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
```

**Step 5: Test manually**

- Open expeditions page
- Find shipment 444815 (or any with error status)
- Verify orange/red badge with triangle icon appears
- Hover to see tooltip with error message

**Step 6: Commit**

```bash
git add src/app/(dashboard)/expeditions/ExpeditionsClient.tsx
git commit -m "feat: Add error indicator to expeditions status badge"
```

---

## Task 2: Add Edit Button and Modal to Expedition Detail

**Files:**
- Modify: `src/app/(dashboard)/expeditions/ExpeditionsClient.tsx`

**Step 1: Add edit state**

Add state for edit modal:

```tsx
const [editingShipment, setEditingShipment] = useState<Shipment | null>(null)
const [editForm, setEditForm] = useState({
  recipient_name: '',
  recipient_email: '',
  recipient_phone: '',
  recipient_company: '',
  address_line1: '',
  address_line2: '',
  city: '',
  postal_code: '',
  country_code: '',
  order_ref: '',
  weight_grams: 0,
})
```

**Step 2: Add edit handlers**

```tsx
const updateShipment = useUpdateShipment()

const openEdit = (shipment: Shipment) => {
  setEditForm({
    recipient_name: shipment.recipient_name || '',
    recipient_email: shipment.recipient_email || '',
    recipient_phone: shipment.recipient_phone || '',
    recipient_company: shipment.recipient_company || '',
    address_line1: shipment.address_line1 || '',
    address_line2: shipment.address_line2 || '',
    city: shipment.city || '',
    postal_code: shipment.postal_code || '',
    country_code: shipment.country_code || '',
    order_ref: shipment.order_ref || '',
    weight_grams: shipment.weight_grams || 0,
  })
  setEditingShipment(shipment)
}

const handleEditSubmit = async () => {
  if (!editingShipment) return
  await updateShipment.mutateAsync({
    id: editingShipment.id,
    data: editForm,
  })
  setEditingShipment(null)
}
```

**Step 3: Add Edit button in detail panel**

Find the action buttons (Rafraichir statut, Annuler) and add before them:

```tsx
{/* Only show edit if not yet shipped (status_id < 1000) */}
{(!shipment.status_id || shipment.status_id < 1000) && (
  <Button
    variant="outline"
    size="sm"
    onClick={() => openEdit(shipment)}
    className="gap-2"
  >
    <Pencil className="h-4 w-4" />
    Modifier
  </Button>
)}
```

**Step 4: Add Edit Dialog**

Add the dialog component at the end of the component (before closing tags):

```tsx
{/* Edit Shipment Dialog */}
<Dialog open={!!editingShipment} onOpenChange={() => setEditingShipment(null)}>
  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>Modifier l'expedition #{editingShipment?.order_ref}</DialogTitle>
      <DialogDescription>
        Modifiez les informations de l'expedition. Les changements seront synchronises avec Sendcloud.
      </DialogDescription>
    </DialogHeader>

    <div className="grid gap-4 py-4">
      {/* Recipient */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="recipient_name">Nom</Label>
          <Input
            id="recipient_name"
            value={editForm.recipient_name}
            onChange={(e) => setEditForm({ ...editForm, recipient_name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="recipient_company">Entreprise</Label>
          <Input
            id="recipient_company"
            value={editForm.recipient_company}
            onChange={(e) => setEditForm({ ...editForm, recipient_company: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="recipient_email">Email</Label>
          <Input
            id="recipient_email"
            type="email"
            value={editForm.recipient_email}
            onChange={(e) => setEditForm({ ...editForm, recipient_email: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="recipient_phone">Telephone</Label>
          <Input
            id="recipient_phone"
            value={editForm.recipient_phone}
            onChange={(e) => setEditForm({ ...editForm, recipient_phone: e.target.value })}
          />
        </div>
      </div>

      {/* Address */}
      <div className="space-y-2">
        <Label htmlFor="address_line1">Adresse</Label>
        <Input
          id="address_line1"
          value={editForm.address_line1}
          onChange={(e) => setEditForm({ ...editForm, address_line1: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="address_line2">Adresse (suite)</Label>
        <Input
          id="address_line2"
          value={editForm.address_line2}
          onChange={(e) => setEditForm({ ...editForm, address_line2: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="postal_code">Code postal</Label>
          <Input
            id="postal_code"
            value={editForm.postal_code}
            onChange={(e) => setEditForm({ ...editForm, postal_code: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">Ville</Label>
          <Input
            id="city"
            value={editForm.city}
            onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="country_code">Pays</Label>
          <Input
            id="country_code"
            value={editForm.country_code}
            onChange={(e) => setEditForm({ ...editForm, country_code: e.target.value })}
            placeholder="FR"
            maxLength={2}
          />
        </div>
      </div>

      {/* Order info */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="order_ref">Reference commande</Label>
          <Input
            id="order_ref"
            value={editForm.order_ref}
            onChange={(e) => setEditForm({ ...editForm, order_ref: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="weight_grams">Poids (grammes)</Label>
          <Input
            id="weight_grams"
            type="number"
            value={editForm.weight_grams}
            onChange={(e) => setEditForm({ ...editForm, weight_grams: Number(e.target.value) })}
          />
        </div>
      </div>
    </div>

    <DialogFooter>
      <Button variant="outline" onClick={() => setEditingShipment(null)}>
        Annuler
      </Button>
      <Button onClick={handleEditSubmit} disabled={updateShipment.isPending}>
        {updateShipment.isPending ? 'Enregistrement...' : 'Enregistrer'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Step 5: Import required components**

```tsx
import { useUpdateShipment } from '@/hooks/useShipments'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Pencil } from 'lucide-react'
```

**Step 6: Test manually**

- Open expeditions page
- Expand a shipment detail (one that is "En attente")
- Click "Modifier" button
- Change the city field
- Click "Enregistrer"
- Verify success toast and data updates

**Step 7: Commit**

```bash
git add src/app/(dashboard)/expeditions/ExpeditionsClient.tsx
git commit -m "feat: Add edit button and modal for expeditions"
```

---

## Task 3: Create DateRangePicker Component

**Files:**
- Create: `src/components/ui/date-range-picker.tsx`

**Step 1: Create the component**

```tsx
'use client'

import * as React from 'react'
import { format, subDays, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react'
import { DateRange } from 'react-day-picker'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface DateRangePickerProps {
  from: Date | undefined
  to: Date | undefined
  onSelect: (range: { from: Date | undefined; to: Date | undefined }) => void
  className?: string
}

const presets = [
  {
    label: "Aujourd'hui",
    getValue: () => ({
      from: startOfDay(new Date()),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: '7 derniers jours',
    getValue: () => ({
      from: startOfDay(subDays(new Date(), 6)),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: '14 derniers jours',
    getValue: () => ({
      from: startOfDay(subDays(new Date(), 13)),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: '30 derniers jours',
    getValue: () => ({
      from: startOfDay(subDays(new Date(), 29)),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: 'Ce mois calendaire',
    getValue: () => ({
      from: startOfMonth(new Date()),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: 'Dernier mois calendaire',
    getValue: () => {
      const lastMonth = new Date()
      lastMonth.setMonth(lastMonth.getMonth() - 1)
      return {
        from: startOfMonth(lastMonth),
        to: endOfMonth(lastMonth),
      }
    },
  },
]

export function DateRangePicker({
  from,
  to,
  onSelect,
  className,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [tempRange, setTempRange] = React.useState<DateRange | undefined>(
    from && to ? { from, to } : undefined
  )

  const handlePresetClick = (preset: (typeof presets)[0]) => {
    const range = preset.getValue()
    onSelect(range)
    setIsOpen(false)
  }

  const handleApply = () => {
    if (tempRange?.from && tempRange?.to) {
      onSelect({ from: tempRange.from, to: tempRange.to })
    }
    setIsOpen(false)
  }

  const formatDateRange = () => {
    if (!from || !to) return 'Selectionner une periode'

    // Check if it matches a preset
    for (const preset of presets) {
      const presetRange = preset.getValue()
      if (
        format(from, 'yyyy-MM-dd') === format(presetRange.from, 'yyyy-MM-dd') &&
        format(to, 'yyyy-MM-dd') === format(presetRange.to, 'yyyy-MM-dd')
      ) {
        return preset.label
      }
    }

    return `${format(from, 'd MMM', { locale: fr })} - ${format(to, 'd MMM yyyy', { locale: fr })}`
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'justify-start text-left font-normal gap-2',
            !from && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="h-4 w-4" />
          {formatDateRange()}
          <ChevronDown className="h-4 w-4 ml-auto" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          {/* Presets sidebar */}
          <div className="border-r p-3 space-y-1 min-w-[180px]">
            <p className="text-sm font-medium text-muted-foreground mb-2">
              Fourchette de dates
            </p>
            {presets.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                size="sm"
                className="w-full justify-start font-normal"
                onClick={() => handlePresetClick(preset)}
              >
                {preset.label}
              </Button>
            ))}
            <div className="pt-2 border-t mt-2">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'w-full justify-start font-normal',
                  'text-primary'
                )}
                onClick={() => setTempRange(undefined)}
              >
                Plage de dates personnalisee
              </Button>
            </div>
          </div>

          {/* Calendar */}
          <div className="p-3">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={from}
              selected={tempRange}
              onSelect={setTempRange}
              numberOfMonths={1}
              locale={fr}
            />
            <div className="flex justify-end pt-3 border-t">
              <Button size="sm" onClick={handleApply}>
                Appliquer
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/ui/date-range-picker.tsx
git commit -m "feat: Create DateRangePicker component"
```

---

## Task 4: Update Analytics API to Accept Date Range

**Files:**
- Modify: `src/app/api/dashboard/analytics/route.ts`

**Step 1: Update the route to accept from/to params**

Add at the beginning of the GET handler:

```tsx
const from = searchParams.get('from')
const to = searchParams.get('to')

// Default to last 12 months if no dates provided
const endDate = to ? new Date(to) : new Date()
const startDate = from ? new Date(from) : new Date(endDate.getFullYear(), endDate.getMonth() - 11, 1)
```

**Step 2: Update queries to use date range**

Replace hardcoded 12-month logic with dynamic date filtering based on `startDate` and `endDate`.

**Step 3: Commit**

```bash
git add src/app/api/dashboard/analytics/route.ts
git commit -m "feat: Add date range params to analytics API"
```

---

## Task 5: Add DateRangePicker to Analytics Page

**Files:**
- Modify: `src/app/(dashboard)/analytics/page.tsx`

**Step 1: Add date state**

```tsx
const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
  from: subDays(new Date(), 29),
  to: new Date(),
})
```

**Step 2: Update fetch to use dates**

```tsx
async function fetchAnalytics(from?: Date, to?: Date): Promise<AnalyticsData> {
  const params = new URLSearchParams()
  if (from) params.set('from', format(from, 'yyyy-MM-dd'))
  if (to) params.set('to', format(to, 'yyyy-MM-dd'))

  const res = await fetch(`/api/dashboard/analytics?${params.toString()}`)
  if (!res.ok) throw new Error('Failed to fetch analytics')
  return res.json()
}
```

**Step 3: Update useQuery**

```tsx
const { data, isLoading } = useQuery({
  queryKey: ['analytics', dateRange.from, dateRange.to],
  queryFn: () => fetchAnalytics(dateRange.from, dateRange.to),
  staleTime: 5 * 60 * 1000,
})
```

**Step 4: Add DateRangePicker to header**

```tsx
<div className="flex items-center justify-between">
  <div>
    <h1 className="text-2xl font-semibold flex items-center gap-2">
      <BarChart3 className="h-6 w-6 text-primary" />
      Analytics
    </h1>
    <p className="text-muted-foreground text-sm">
      Vue d&apos;ensemble des performances et tendances
    </p>
  </div>
  <DateRangePicker
    from={dateRange.from}
    to={dateRange.to}
    onSelect={setDateRange}
  />
</div>
```

**Step 5: Import required**

```tsx
import { useState } from 'react'
import { subDays, format } from 'date-fns'
import { DateRangePicker } from '@/components/ui/date-range-picker'
```

**Step 6: Test manually**

- Open Analytics page
- Click date picker
- Select "7 derniers jours"
- Verify data updates
- Select custom range
- Click "Appliquer"
- Verify data updates

**Step 7: Commit**

```bash
git add src/app/(dashboard)/analytics/page.tsx
git commit -m "feat: Add date range picker to Analytics page"
```

---

## Task 6: Final Testing and Push

**Step 1: Run build**

```bash
npm run build
```

**Step 2: Fix any errors**

**Step 3: Final commit and push**

```bash
git push origin main
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Error indicator badge | ExpeditionsClient.tsx |
| 2 | Edit button + modal | ExpeditionsClient.tsx |
| 3 | DateRangePicker component | date-range-picker.tsx |
| 4 | Analytics API date params | analytics/route.ts |
| 5 | Analytics page date picker | analytics/page.tsx |
| 6 | Build + push | - |
