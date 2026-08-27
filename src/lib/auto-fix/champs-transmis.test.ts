import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ADDRESS_FIELDS_PUBLIC } from './address'

/**
 * Le moteur doit transmettre au planificateur TOUT ce que celui-ci sait
 * traiter.
 *
 * Trois commandes en trois jours ont echoue par ce meme trou, un champ que la
 * conversion commande -> adresse ne transmettait pas :
 *
 *   25/08  #553869  le numero de voie, lu dans un champ vide
 *   26/08  #554363  le pays, sans lequel le nettoyage du code postal s'abstient
 *   27/08  #554551  le nom, dont la limite est pourtant geree
 *
 * A chaque fois la reparation existait, etait correcte, etait testee — et
 * n'etait jamais atteinte. A chaque fois j'ai corrige le champ manquant sans
 * regarder ce qui manquait d'autre.
 *
 * Ce test ne verifie donc pas UN champ mais la correspondance entiere. Le
 * prochain champ ajoute au planificateur sera couvert sans que personne y
 * pense.
 */
const source = readFileSync(
  join(process.cwd(), 'src/lib/auto-fix/live-worker.ts'),
  'utf8',
)

const conversion = source.slice(
  source.indexOf('function ordreVersAdresse'),
  source.indexOf('function adresseVersOrdre'),
)

/**
 * Le chemin du RETOUR. Le 27/08, j'ai complete l'aller et ecrit un test pour
 * lui sans regarder celui-ci : la reparation du nom etait calculee puis PERDUE
 * au moment de construire la charge utile, et Sendcloud recevait un objet vide.
 * Meme faute, meme journee, sens inverse.
 */
const retour = source.slice(
  source.indexOf('function adresseVersOrdre'),
  source.indexOf('function adresseVersOrdre') + 1200,
)

describe('champs transmis au planificateur', () => {
  it('retrouve bien la conversion', () => {
    // Sans cette garde, une fonction renommee rendrait le test vide donc vert.
    expect(conversion.length).toBeGreaterThan(200)
    expect(ADDRESS_FIELDS_PUBLIC.length).toBeGreaterThan(5)
  })

  it('transmet chaque champ que le planificateur sait traiter', () => {
    // `address_1` est le nom que Sendcloud emploie dans ses messages de refus ;
    // le planificateur le ramene sur `address`, qui est bien transmis.
    const attendus = ADDRESS_FIELDS_PUBLIC.filter((champ) => champ !== 'address_1')
    const manquants = attendus.filter(
      (champ) => !new RegExp(`^\\s*${champ}:`, 'm').test(conversion),
    )
    expect(manquants).toEqual([])
  })

  it('transmet aussi le pays et l e-mail, qui ne sont pas des champs a raccourcir', () => {
    // Le pays conditionne le nettoyage du code postal ; l'e-mail sert a savoir
    // si un e-mail recopie dans le nom fait double emploi.
    expect(conversion).toMatch(/^\s*country_code:/m)
    expect(conversion).toMatch(/^\s*email:/m)
  })

  it('sait renvoyer a Sendcloud chaque champ qu il sait corriger', () => {
    // Une reparation calculee mais non transmise est pire qu'une absence de
    // reparation : le moteur croit avoir agi.
    const attendus = ADDRESS_FIELDS_PUBLIC.filter((champ) => champ !== 'address_1')
    const manquants = attendus.filter(
      (champ) => !new RegExp(`patch\\.${champ} !== undefined`).test(retour),
    )
    expect(manquants).toEqual([])
  })
})
