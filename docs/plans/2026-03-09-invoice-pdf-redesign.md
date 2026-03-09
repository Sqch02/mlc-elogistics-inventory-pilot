# Invoice PDF Redesign - Professional Layout

## Context

Current PDF (generated via jsPDF) is basic. Client wants it to match their real invoices (F2600027 template) with:
- HME logo, dual-column header (Emetteur/Destinataire)
- Lines grouped by destination zone + delivery type (not carrier + weight)
- Payment conditions, RIB, legal footer, pagination

## Design

### 1. PDF Layout (matching F2600027)

```
+--------------------------------------------------+
| Facture {NUMBER}              [HME LOGO]         |
| {DATE}                                           |
|                                                  |
| Emetteur               Destinataire              |
| MLC PROJECT (HME)      {CLIENT NAME}             |
| Address, SIRET, TVA    Address, Country           |
| Phone, Email, Website                            |
|                                                  |
| "Prestation logistique du {FROM} au {TO}         |
|  pour la marque {CLIENT} pour un total de        |
|  {N} commandes expediees."                       |
|                                                  |
| Detail                                           |
| +----------------------------------------------+ |
| | Type | Description | PU HT | Qty | Total HT | |
| +----------------------------------------------+ |
| | Abonnement | Connexion CMS...  | 49€ | 1 |..| |
| | Stockage   | Stockage produit  | 25€ | 1 |..| |
| | Reception  | Calcule au 1/4h   | 30€ |1.25|.| |
| | Prepa & Exp| DOMICILE FR 0-250g| 5.87| 42 |..| |
| | Prepa & Exp| POINT RELAIS FR   | 5.87| 80 |..| |
| | Prepa & Exp| BELGIQUE 0-100g   | 8.25| 2  |..| |
| | Surcharge  | 4% du cout...     | ... |0.04|..| |
| +----------------------------------------------+ |
|                                                  |
|                    TVA note or TVA 20% + TTC     |
|                    Total: {TOTAL}                |
|                                                  |
| Conditions              RIB                      |
| Reglement: 10 jours     IBAN: FR76...           |
| Mode: Virement          BIC: CCBPFRPPLIL        |
| Interets: 10 pts        Titulaire: MLC PROJECT  |
| Notes: contact@hme...                           |
|                                                  |
| [Legal footer]                    Page X sur Y   |
+--------------------------------------------------+
```

### 2. Destination Zone Mapping

From `to_country` field in shipments:
- FR -> France
- BE -> Belgique
- CH -> Suisse
- LU -> Luxembourg
- GP,MQ,RE,GF,YT,NC,PF -> DOM-TOM
- EU countries -> EU
- Other -> WORLD

Delivery type from carrier:
- mondial_relay -> POINT RELAIS
- All others -> DOMICILE (or LETTRE SUIVIE for lightweight)

Line description format: "{ZONE}\n{WEIGHT_BRACKET}"
Example: "COLIS DOMICILE FR\n101 - 250g."

### 3. Data Requirements

**New fields needed in tenant_settings (or use tenants table):**
- `company_website` (for header)
- `invoice_iban`, `invoice_bic`, `invoice_bank_holder` (RIB section)
- `logo_url` already exists in tenants table

**Invoice generate changes:**
- Group by (destination_zone, delivery_type, weight_bracket) instead of (carrier, weight_bracket)
- Need `to_country` from shipments (already stored from Sendcloud)

### 4. Files to Modify

| File | Change |
|------|--------|
| `src/lib/utils/invoice-pdf.ts` | Complete rewrite of PDF template |
| `src/app/api/invoices/generate/route.ts` | New grouping logic (zone+type+weight) |
| `src/lib/utils/invoice-calculations.ts` | Add zone mapping helpers |
| `src/app/api/settings/company/route.ts` | Add RIB fields |
| `src/app/(dashboard)/parametres/` | Add RIB fields to settings UI |

### 5. VAT Logic

- If client has FR VAT number -> TVA 20%
- If client is EU with valid VAT -> "TVA non applicable, art. 293 B du CGI" (or reverse charge)
- Keep current default: TVA 20% for French clients
