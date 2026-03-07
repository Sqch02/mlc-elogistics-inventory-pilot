'use client'

import React from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <Card className="shadow-sm border-border">
          <CardContent className="p-6 flex flex-col items-center justify-center gap-4 text-center min-h-[200px]">
            <AlertTriangle className="h-10 w-10 text-warning" />
            <div className="space-y-1">
              <h3 className="font-semibold text-lg">Une erreur est survenue</h3>
              <p className="text-sm text-muted-foreground">
                {this.state.error?.message || 'Erreur inattendue'}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Réessayer
            </Button>
          </CardContent>
        </Card>
      )
    }

    return this.props.children
  }
}
