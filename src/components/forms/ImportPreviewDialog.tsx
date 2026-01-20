'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Plus,
  RefreshCw,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { ImportPreviewResult, ImportPreviewRow } from '@/lib/utils/fuzzy-match'

type ImportType = 'skus' | 'pricing' | 'locations' | 'bundles' | 'claims'

interface ImportPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  importType: ImportType
  importEndpoint: string
  title: string
  description?: string
  onSuccess?: () => void
  keyField: string // e.g., "sku_code", "order_ref"
}

const TYPE_LABELS: Record<ImportType, string> = {
  skus: 'SKUs',
  pricing: 'Règles de pricing',
  locations: 'Emplacements',
  bundles: 'Bundles',
  claims: 'Réclamations',
}

export function ImportPreviewDialog({
  open,
  onOpenChange,
  importType,
  importEndpoint,
  title,
  description,
  onSuccess,
  keyField,
}: ImportPreviewDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null)
  const [step, setStep] = useState<'upload' | 'preview'>('upload')

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0])
      setPreview(null)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    maxFiles: 1,
  })

  const analyzeFile = async () => {
    if (!file) return

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', importType)

      const response = await fetch('/api/import/preview', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!data.success) {
        toast.error(data.message || 'Erreur lors de l\'analyse')
        return
      }

      setPreview(data.preview)
      setStep('preview')
    } catch (error) {
      toast.error('Erreur lors de l\'analyse du fichier')
    } finally {
      setLoading(false)
    }
  }

  const executeImport = async () => {
    if (!file) return

    setImporting(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(importEndpoint, {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (data.success) {
        toast.success(`Import terminé: ${data.imported} ${TYPE_LABELS[importType]} importé(s)`)
        onSuccess?.()
        handleClose()
      } else {
        toast.error(data.message || 'Erreur lors de l\'import')
      }
    } catch (error) {
      toast.error('Erreur lors de l\'import')
    } finally {
      setImporting(false)
    }
  }

  const handleClose = () => {
    setFile(null)
    setPreview(null)
    setStep('upload')
    onOpenChange(false)
  }

  const renderPreviewRow = (row: ImportPreviewRow, type: 'update' | 'create' | 'warning' | 'error') => {
    const key = row.data[keyField] as string
    const icons = {
      update: <RefreshCw className="h-4 w-4 text-blue-500" />,
      create: <Plus className="h-4 w-4 text-green-500" />,
      warning: <AlertTriangle className="h-4 w-4 text-amber-500" />,
      error: <XCircle className="h-4 w-4 text-red-500" />,
    }
    const bgColors = {
      update: 'bg-blue-50 border-blue-200',
      create: 'bg-green-50 border-green-200',
      warning: 'bg-amber-50 border-amber-200',
      error: 'bg-red-50 border-red-200',
    }

    return (
      <div
        key={row.rowNumber}
        className={cn(
          'flex items-start gap-3 p-3 rounded-lg border text-sm',
          bgColors[type]
        )}
      >
        <div className="mt-0.5">{icons[type]}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium">Ligne {row.rowNumber}</span>
            <Badge variant="outline" className="font-mono text-xs">
              {key}
            </Badge>
          </div>
          {type === 'update' && row.matchedRecord && (
            <p className="text-muted-foreground text-xs">
              Va mettre à jour l&apos;enregistrement existant
            </p>
          )}
          {type === 'create' && (
            <p className="text-muted-foreground text-xs">
              Nouvel enregistrement
            </p>
          )}
          {type === 'warning' && row.similarRecords && (
            <div className="space-y-1">
              <p className="text-amber-700 text-xs font-medium">
                Ressemble à des enregistrements existants :
              </p>
              {row.similarRecords.map((similar) => (
                <div key={similar.id} className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className="font-mono bg-white">
                    {similar.code}
                  </Badge>
                  <span className="text-muted-foreground">
                    ({similar.similarity}% similaire)
                  </span>
                </div>
              ))}
              <p className="text-amber-600 text-xs mt-1">
                ⚠️ Sera créé comme nouveau si vous continuez
              </p>
            </div>
          )}
          {type === 'error' && row.errors && (
            <ul className="text-red-600 text-xs space-y-0.5">
              {row.errors.map((err, i) => (
                <li key={i}>• {err}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description || `Importez vos ${TYPE_LABELS[importType]} depuis un fichier CSV ou Excel`}
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <>
            <div
              {...getRootProps()}
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                isDragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              )}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center gap-3">
                {file ? (
                  <>
                    <FileSpreadsheet className="h-10 w-10 text-green-500" />
                    <div>
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} Ko
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <Upload className="h-10 w-10 text-muted-foreground" />
                    <div>
                      <p className="font-medium">
                        {isDragActive
                          ? 'Déposez le fichier ici'
                          : 'Glissez un fichier ou cliquez'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        CSV, XLS ou XLSX
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Annuler
              </Button>
              <Button onClick={analyzeFile} disabled={!file || loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Analyser
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'preview' && preview && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {preview.summary.updates}
                </div>
                <div className="text-xs text-blue-600/80">Mises à jour</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-600">
                  {preview.summary.creates}
                </div>
                <div className="text-xs text-green-600/80">Créations</div>
              </div>
              <div className="bg-amber-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-amber-600">
                  {preview.summary.warnings}
                </div>
                <div className="text-xs text-amber-600/80">Attention</div>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-red-600">
                  {preview.summary.errors}
                </div>
                <div className="text-xs text-red-600/80">Erreurs</div>
              </div>
            </div>

            {/* Details */}
            <ScrollArea className="flex-1 max-h-[400px] -mx-6 px-6">
              <div className="space-y-4">
                {/* Warnings first - most important */}
                {preview.warnings.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2 text-amber-600">
                      <AlertTriangle className="h-4 w-4" />
                      Attention - Similitudes détectées ({preview.warnings.length})
                    </h4>
                    <div className="space-y-2">
                      {preview.warnings.map((row) => renderPreviewRow(row, 'warning'))}
                    </div>
                  </div>
                )}

                {/* Errors */}
                {preview.errors.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2 text-red-600">
                      <XCircle className="h-4 w-4" />
                      Erreurs - Ne seront pas importées ({preview.errors.length})
                    </h4>
                    <div className="space-y-2">
                      {preview.errors.slice(0, 10).map((row) => renderPreviewRow(row, 'error'))}
                      {preview.errors.length > 10 && (
                        <p className="text-sm text-muted-foreground text-center py-2">
                          ... et {preview.errors.length - 10} autres erreurs
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Updates */}
                {preview.toUpdate.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2 text-blue-600">
                      <RefreshCw className="h-4 w-4" />
                      Mises à jour ({preview.toUpdate.length})
                    </h4>
                    <div className="space-y-2">
                      {preview.toUpdate.slice(0, 5).map((row) => renderPreviewRow(row, 'update'))}
                      {preview.toUpdate.length > 5 && (
                        <p className="text-sm text-muted-foreground text-center py-2">
                          ... et {preview.toUpdate.length - 5} autres mises à jour
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Creates */}
                {preview.toCreate.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2 text-green-600">
                      <Plus className="h-4 w-4" />
                      Créations ({preview.toCreate.length})
                    </h4>
                    <div className="space-y-2">
                      {preview.toCreate.slice(0, 5).map((row) => renderPreviewRow(row, 'create'))}
                      {preview.toCreate.length > 5 && (
                        <p className="text-sm text-muted-foreground text-center py-2">
                          ... et {preview.toCreate.length - 5} autres créations
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* All good */}
                {preview.warnings.length === 0 &&
                  preview.errors.length === 0 &&
                  (preview.toUpdate.length > 0 || preview.toCreate.length > 0) && (
                    <div className="flex items-center justify-center gap-2 py-4 text-green-600">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="font-medium">Tout est bon ! Prêt à importer.</span>
                    </div>
                  )}
              </div>
            </ScrollArea>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Retour
              </Button>
              <Button
                onClick={executeImport}
                disabled={importing || preview.summary.errors === preview.summary.total}
              >
                {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {preview.warnings.length > 0 ? 'Importer quand même' : 'Importer'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
