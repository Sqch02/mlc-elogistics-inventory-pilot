import { NextRequest, NextResponse, after } from 'next/server'
import { traiterDemande } from '@/lib/auth/mot-de-passe-oublie'

/**
 * « Mot de passe oublie » : envoie au client un lien pour choisir un nouveau
 * mot de passe, sans intervention de l'equipe.
 *
 * Le SMTP de Supabase n'est pas configure (constate le 07/07), donc son propre
 * envoi ne partirait jamais. On genere le lien cote serveur et on l'envoie par
 * Resend, le fournisseur deja utilise pour les factures et les alertes.
 *
 * TROIS PROTECTIONS
 * - Reponse identique que l'adresse existe ou non, et renvoyee AVANT tout
 *   traitement : ni le contenu ni le delai ne revelent si un compte existe.
 * - Limite : 3 demandes par adresse et 10 par adresse IP, par heure.
 * - Le lien n'est ni journalise ni stocke : il vaut un mot de passe.
 */

const REPONSE = {
  success: true,
  message:
    "Si un compte existe pour cette adresse, vous allez recevoir un email avec un lien pour choisir un nouveau mot de passe. Pensez à vérifier vos courriers indésirables.",
}

function adresseIp(request: NextRequest): string {
  return (request.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || 'inconnue'
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''

  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Adresse email invalide' }, { status: 400 })
  }

  const ip = adresseIp(request)
  const origine = request.headers.get('origin') ?? request.nextUrl.origin

  // Le travail se fait APRES la reponse : une adresse inconnue repondrait
  // sinon plus vite qu'une adresse connue, ce qui suffit a les distinguer.
  after(async () => {
    try {
      await traiterDemande(email, ip, origine)
    } catch (error) {
      console.error('[MotDePasseOublie] echec du traitement :', error instanceof Error ? error.message : error)
    }
  })

  return NextResponse.json(REPONSE)
}
