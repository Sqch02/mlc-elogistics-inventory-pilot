'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { KeyRound } from 'lucide-react'

export default function MotDePasseOubliePage() {
  const [email, setEmail] = useState('')
  const [envoye, setEnvoye] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [chargement, setChargement] = useState(false)

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault()
    setErreur(null)
    setChargement(true)
    try {
      const response = await fetch('/api/auth/mot-de-passe-oublie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await response.json().catch(() => ({}))
      if (response.ok) {
        setEnvoye(data.message ?? 'Si un compte existe pour cette adresse, vous allez recevoir un email.')
      } else {
        setErreur(data.error ?? 'La demande n a pas pu etre envoyee, reessayez dans un instant.')
      }
    } catch {
      setErreur('Le serveur n a pas repondu, reessayez dans un instant.')
    } finally {
      setChargement(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <KeyRound className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Mot de passe oublié</CardTitle>
          <CardDescription>
            Indiquez votre adresse email, vous recevrez un lien pour choisir un nouveau mot de passe.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {envoye ? (
            <Alert>
              <AlertDescription>{envoye}</AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={envoyer} className="space-y-4">
              {erreur && (
                <Alert variant="destructive">
                  <AlertDescription>{erreur}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="vous@exemple.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={chargement}
                />
              </div>
              <Button type="submit" className="w-full" disabled={chargement}>
                {chargement ? 'Envoi...' : 'Recevoir le lien'}
              </Button>
            </form>
          )}
          <p className="text-center text-sm">
            <Link href="/login" className="text-primary underline-offset-4 hover:underline">
              Retour à la connexion
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
