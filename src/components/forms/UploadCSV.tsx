'use client'

import { useState, useCallback } from 'react'
import { Upload, File, X, CheckCircle, AlertCircle, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

interface UploadCSVProps {
  onUpload: (file: File) => Promise<UploadResult>
  accept?: string
  maxSize?: number // in MB
  templateUrl?: string
  templateName?: string
  description?: string
}

interface UploadResult {
  success: boolean
  message: string
  imported?: number
  errors?: string[]
}

export function UploadCSV({
  onUpload,
  accept = '.csv',
  maxSize = 5,
  templateUrl,
  templateName,
  description,
}: UploadCSVProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && droppedFile.name.endsWith('.csv')) {
      setFile(droppedFile)
      setResult(null)
    }
  }, [])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0]
      if (selectedFile) {
        setFile(selectedFile)
        setResult(null)
      }
    },
    []
  )

  const handleUpload = async () => {
    if (!file) return

    // Check file size
    if (file.size > maxSize * 1024 * 1024) {
      setResult({
        success: false,
        message: `Fichier trop volumineux (max ${maxSize} MB)`,
      })
      return
    }

    setUploading(true)
    try {
      const uploadResult = await onUpload(file)
      setResult(uploadResult)
      if (uploadResult.success) {
        setFile(null)
      }
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Erreur lors de l\'import',
      })
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveFile = () => {
    setFile(null)
    setResult(null)
  }

  return (
    <div className="space-y-4">
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}

      {templateUrl && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={templateUrl} download>
              <Download className="h-4 w-4 mr-2" />
              Telecharger le modele {templateName}
            </a>
          </Button>
        </div>
      )}

      <Card
        className={cn(
          'border-2 border-dashed transition-colors',
          isDragging && 'border-primary bg-primary/5',
          file && 'border-green-500 bg-green-50'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <CardContent className="p-6">
          {!file ? (
            <label className="flex flex-col items-center justify-center cursor-pointer py-6">
              <Upload className="h-10 w-10 text-muted-foreground mb-4" />
              <p className="text-sm font-medium">
                Glissez-deposez un fichier CSV ici
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                ou cliquez pour selectionner (max {maxSize} MB)
              </p>
              <input
                type="file"
                accept={accept}
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <File className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRemoveFile}
                disabled={uploading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {file && (
        <Button onClick={handleUpload} disabled={uploading} className="w-full">
          {uploading ? 'Import en cours...' : 'Importer'}
        </Button>
      )}

      {result && (
        <Alert variant={result.success ? 'default' : 'destructive'}>
          <div className="flex items-start gap-2">
            {result.success ? (
              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
            ) : (
              <AlertCircle className="h-4 w-4 mt-0.5" />
            )}
            <div className="flex-1">
              <AlertDescription>
                <p className="font-medium">{result.message}</p>
                {result.imported !== undefined && (
                  <p className="text-sm mt-1">
                    {result.imported} ligne(s) importee(s)
                  </p>
                )}
                {result.errors && result.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm font-medium">Erreurs:</p>
                    <ul className="text-sm mt-1 space-y-1 max-h-32 overflow-y-auto">
                      {result.errors.slice(0, 10).map((error, i) => (
                        <li key={i} className="text-xs">{error}</li>
                      ))}
                      {result.errors.length > 10 && (
                        <li className="text-xs font-medium">
                          ... et {result.errors.length - 10} autres erreurs
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </AlertDescription>
            </div>
          </div>
        </Alert>
      )}
    </div>
  )
}
