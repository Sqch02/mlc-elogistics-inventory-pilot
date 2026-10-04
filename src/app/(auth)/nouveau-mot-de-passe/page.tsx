'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { KeyRound } from 'lucide-react'

/**
 * Choix d'un mot de passe a partir d'un lien recu par email.
 *
 * LE JETON N'EST CONSOMME QU'A LA SOUMISSION, jamais a l'ouverture de la page.
 * Le lien ne sert qu'une fois, et les messageries d'entreprise (Outlook en
 * tete) ouvrent les liens recus pour les analyser avant que le destinataire
 * ne clique. Un jeton consomme a l'ouverture serait deja brule quand le client
 * arrive. Ici l'ouverture n'affiche qu'un formulaire.
 */

const MESSAGES: Record<string, string> = {
  'New password should be different from the old password.':
    'Le nouveau mot de passe doit être différent de l ancien.',
  'Password should be at least 6 characters.':
    'Le mot de passe doit contenir au moins 8 caractères.',
}

function Formulaire() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const jeton = searchParams.get('token_hash')

  const [motDePasse, setMotDePasse] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [lienPerime, setLienPerime] = useState(false)
  const [chargement, setChargement] = useState(false)

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault()
    setErreur(null)
    if (motDePasse.length < 8) {
      setErreur('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (motDePasse !== confirmation) {
      setErreur('Les deux mots de passe ne sont pas identiques.')
      return
    }
    if (!jeton) {
      setLienPerime(true)
      return
    }

    setChargement(true)
    try {
      const supabase = createClient()
      const { error: erreurLien } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: jeton })
      if (erreurLien) {
        setLienPerime(true)
        return
      }
      const { error } = await supabase.auth.updateUser({ password: motDePasse })
      if (error) {
        setErreur(MESSAGES[error.message] ?? error.message)
        return
      }
      router.push('/')
      router.refresh()
    } catch {
      setErreur('Une erreur est survenue, réessayez dans un instant.')
    } finally {
      setChargement(false)
    }
  }

  if (!jeton || lienPerime) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertDescription>
            Ce lien a expiré ou a déjà servi. Demandez-en un nouveau, il arrive en quelques instants.
          </AlertDescription>
        </Alert>
        <Button asChild className="w-full">
          <Link href="/mot-de-passe-oublie">Recevoir un nouveau lien</Link>
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={enregistrer} className="space-y-4">
      {erreur && (
        <Alert variant="destructive">
          <AlertDescription>{erreur}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <Label htmlFor="mot_de_passe">Nouveau mot de passe</Label>
        <Input
          id="mot_de_passe"
          type="password"
          autoComplete="new-password"
          placeholder="Au moins 8 caractères"
          value={motDePasse}
          onChange={(e) => setMotDePasse(e.target.value)}
          required
          disabled={chargement}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmation">Confirmez le mot de passe</Label>
        <Input
          id="confirmation"
          type="password"
          autoComplete="new-password"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          required
          disabled={chargement}
        />
      </div>
      <Button type="submit" className="w-full" disabled={chargement}>
        {chargement ? 'Enregistrement...' : 'Enregistrer et me connecter'}
      </Button>
    </form>
  )
}

export default function NouveauMotDePassePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <KeyRound className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Choisir votre mot de passe</CardTitle>
          <CardDescription>Votre espace HME Logistics</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<p className="text-center text-sm text-muted-foreground">Chargement...</p>}>
            <Formulaire />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
