import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/notifications/resend-sender', async (original) => ({
  ...(await original<typeof import('@/lib/notifications/resend-sender')>()),
  resendSenderFromEnv: vi.fn(),
}))

import { createAdminClient } from '@/lib/supabase/admin'
import { resendSenderFromEnv, buildEmailBody } from '@/lib/notifications/resend-sender'
import { traiterDemande, empreinte } from './mot-de-passe-oublie'
import { construireLien, origineDuLien, ORIGINE_PAR_DEFAUT } from './lien-mot-de-passe'

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8')

function faux({ autorise = true, profil = { id: 'u1', tenant_id: 't1' } as Record<string, string> | null, jeton = 'jeton-abc' } = {}) {
  const rpc = vi.fn().mockResolvedValue({ data: autorise, error: null })
  const ilike = vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: profil, error: null }) }))
  const generateLink = vi.fn().mockResolvedValue({
    data: jeton ? { properties: { hashed_token: jeton, action_link: 'https://x.supabase.co/verify' } } : null,
    error: jeton ? null : { message: 'User not found' },
  })
  const client = { rpc, from: vi.fn(() => ({ select: vi.fn(() => ({ ilike })) })), auth: { admin: { generateLink } } }
  const send = vi.fn().mockResolvedValue({ ok: true })
  vi.mocked(createAdminClient).mockReturnValue(client as never)
  vi.mocked(resendSenderFromEnv).mockReturnValue({ name: 'resend', send } as never)
  return { rpc, ilike, generateLink, send }
}

describe('origine du lien', () => {
  it('garde une origine de la liste, rejette toute autre', () => {
    expect(origineDuLien('https://app.homemade-elogistics.com')).toBe('https://app.homemade-elogistics.com')
    expect(origineDuLien('https://mlc-elogistics-inventory-pilot.onrender.com/')).toBe('https://mlc-elogistics-inventory-pilot.onrender.com')
    // Une requete forgee ne doit pas faire envoyer un lien vers un site tiers.
    expect(origineDuLien('https://site-pirate.example')).toBe(ORIGINE_PAR_DEFAUT)
    expect(origineDuLien(null)).toBe(ORIGINE_PAR_DEFAUT)
  })

  it('refuse localhost en production : le lien partirait vers le poste du client', () => {
    vi.stubEnv('NODE_ENV', 'production')
    try {
      expect(origineDuLien('http://localhost:3000')).toBe(ORIGINE_PAR_DEFAUT)
    } finally {
      vi.unstubAllEnvs()
    }
    expect(origineDuLien('http://localhost:3000')).toBe('http://localhost:3000')
  })

  it('mene a la page de choix du mot de passe, avec le jeton hache', () => {
    expect(construireLien('https://app.homemade-elogistics.com', 'a+b/c'))
      .toBe('https://app.homemade-elogistics.com/nouveau-mot-de-passe?token_hash=a%2Bb%2Fc')
  })
})

describe('traitement d une demande', () => {
  beforeEach(() => vi.clearAllMocks())

  it('envoie un lien vers notre page a un compte existant', async () => {
    const { generateLink, send } = faux()
    expect(await traiterDemande('client@exemple.fr', '1.2.3.4', 'https://app.homemade-elogistics.com')).toBe('envoye')
    // Toujours « recovery » : « invite » est refuse pour un compte existant.
    expect(generateLink).toHaveBeenCalledWith({ type: 'recovery', email: 'client@exemple.fr' })
    const message = send.mock.calls[0][0]
    expect(message.recipient).toBe('client@exemple.fr')
    expect(message.payload.link).toBe('https://app.homemade-elogistics.com/nouveau-mot-de-passe?token_hash=jeton-abc')
    expect(buildEmailBody(message)).toContain(message.payload.link)
  })

  it('au-dela de la limite, rien n est genere ni envoye', async () => {
    const { generateLink, send } = faux({ autorise: false })
    expect(await traiterDemande('client@exemple.fr', '1.2.3.4', '')).toBe('limite')
    expect(generateLink).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })

  it('une adresse inconnue ne declenche rien', async () => {
    const { generateLink, send } = faux({ profil: null })
    expect(await traiterDemande('personne@exemple.fr', '1.2.3.4', '')).toBe('inconnu')
    expect(generateLink).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })

  it('compte la demande sur des empreintes, jamais sur l adresse en clair', async () => {
    const { rpc } = faux()
    await traiterDemande('client@exemple.fr', '1.2.3.4', '')
    expect(rpc).toHaveBeenCalledWith('password_reset_allowed', {
      p_email_hash: empreinte('client@exemple.fr'),
      p_ip_hash: empreinte('1.2.3.4'),
    })
    expect(JSON.stringify(rpc.mock.calls)).not.toContain('client@exemple.fr')
  })

  it('echappe les jokers : « jean_dupont » ne vise pas « jeanXdupont »', async () => {
    const { ilike } = faux()
    await traiterDemande('jean_dupont@exemple.fr', '1.2.3.4', '')
    expect(ilike).toHaveBeenCalledWith('email', 'jean\\_dupont@exemple.fr')
  })
})

describe('protections du parcours', () => {
  const route = lire('src/app/api/auth/mot-de-passe-oublie/route.ts')
  const page = lire('src/app/(auth)/nouveau-mot-de-passe/page.tsx')
  const logique = lire('src/lib/auth/mot-de-passe-oublie.ts')

  it('repond avant de traiter, avec la meme reponse pour toute adresse valide', () => {
    expect(route).toContain('after(async () =>')
    expect(route.indexOf('after(async () =>')).toBeLessThan(route.indexOf('return NextResponse.json(REPONSE)'))
    // Deux reponses seulement : format invalide, ou le message generique.
    // Aucune ne depend de l'existence du compte.
    expect(route.match(/NextResponse\.json\(/g)).toHaveLength(2)
  })

  it('ne journalise jamais le lien', () => {
    for (const source of [route, logique]) {
      expect(source).not.toMatch(/console\.\w+\([^)]*lien/)
    }
  })

  it('ne consomme le jeton qu a la soumission, jamais a l ouverture', () => {
    // Les messageries d'entreprise ouvrent les liens pour les analyser : un
    // jeton consomme a l'ouverture serait brule avant le clic du client.
    expect(page).not.toContain('useEffect')
    const soumission = page.slice(page.indexOf('const enregistrer'), page.indexOf('if (!jeton || lienPerime)'))
    expect(soumission).toContain('verifyOtp')
    expect(soumission).toContain('updateUser({ password: motDePasse })')
  })

  it('les deux pages sont accessibles sans session, et la connexion y mene', () => {
    const middleware = lire('src/middleware.ts')
    expect(middleware).toContain("'/mot-de-passe-oublie'")
    expect(middleware).toContain("'/nouveau-mot-de-passe'")
    expect(lire('src/app/(auth)/login/page.tsx')).toContain('href="/mot-de-passe-oublie"')
  })

  it('les liens d administration passent par la meme page', () => {
    for (const chemin of [
      'src/app/api/admin/tenants/[id]/users/route.ts',
      'src/app/api/admin/users/[userId]/reset-link/route.ts',
    ]) {
      const source = lire(chemin)
      expect(source).toContain('genererLienMotDePasse(')
      expect(source).not.toContain("type: 'invite'")
      expect(source).not.toContain('action_link')
    }
  })

  it('la table de limitation n est accessible qu au role serveur', () => {
    const sql = lire('supabase/migrations/00144_demandes_de_reinitialisation.sql')
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY')
    expect(sql).toContain('REVOKE ALL ON TABLE public.password_reset_requests FROM PUBLIC, anon, authenticated')
    expect(sql).toMatch(/v_par_adresse < 3 AND v_par_ip < 10/)
  })

  it('la limite compte sous verrou : des demandes simultanees ne passent pas ensemble', () => {
    // Mesure le 04/10 sans verrou : 20 appels en parallele, 6 acceptes au lieu de 3.
    const sql = lire('supabase/migrations/00145_limite_reinitialisation_sous_verrou.sql')
    const verrouAdresse = sql.indexOf("pg_advisory_xact_lock(hashtext('password_reset:email:'")
    const verrouIp = sql.indexOf("pg_advisory_xact_lock(hashtext('password_reset:ip:'")
    const comptage = sql.indexOf('SELECT count(*) INTO v_par_adresse')
    expect(verrouAdresse).toBeGreaterThan(-1)
    // Toujours adresse puis IP : un ordre fixe exclut l'interblocage.
    expect(verrouIp).toBeGreaterThan(verrouAdresse)
    expect(comptage).toBeGreaterThan(verrouIp)
    expect(sql).toMatch(/v_par_adresse < 3 AND v_par_ip < 10/)
  })
})
