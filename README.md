# CALLFLOW

Ett modernt, högpresterande CRM skräddarsytt för **svensk soloförsäljning, mötesbokning och kalla samtal**. Byggt för maximal ringhastighet, noll administrativ friktion, offline-funktionalitet och privat molnsynkronisering i Supabase.

Byggt med **Next.js 16 (App Router)**, **React 19**, **TypeScript 5.9**, **Tailwind CSS v4**, **Radix UI**, **Lucide Icons**, **Motion**, **Recharts**, **Zod**, **PapaParse** och **ExcelJS**.

---

## 📚 Dokumentation

För djupgående genomgångar, se de specialiserade dokumenten i `docs/`:

- **[Systemarkitektur & Datamodell](docs/ARCHITECTURE.md)** — Teknisk arkitektur, PostgreSQL-triggers, atomära skrivningar, revisioner och RLS-säkerhet.
- **[Funktionsguide & Arbetsflöden](docs/FEATURES.md)** — Detaljerad guide till Fokusläge, leadshantering, grupper, uppföljningar, import/export och XP.
- **[Kom igång & Konfiguration](docs/GETTING_STARTED.md)** — Snabbstartsguide, miljövariabler, Supabase-inställningar och driftsättning på Vercel.
- **[Utvecklarguide & Testning](docs/DEVELOPMENT.md)** — Kodkonventioner, projektstruktur och automatiserad testning med Vitest och Playwright.

---

## ⚡️ Snabbstart

### Förutsättningar
Kräver **Node.js 22.x** och **npm**.

### Installation och lokal körning

```sh
# 1. Installera beroenden
npm install

# 2. Starta utvecklingsservern
npm run dev
```

Öppna [http://127.0.0.1:3000](http://127.0.0.1:3000) i webbläsaren.

- **Autentisering:** Utloggade användare möter alltid inloggningssidan, även vid direktlänkar till leads eller fokus.
- **Data:** Inloggade användare öppnar sitt riktiga arbetsrum. Inga demoposter skapas automatiskt.
- **Produktion:** I Vercel måste `NEXT_PUBLIC_SUPABASE_URL=https://wnexrlghlmotkysrofkl.supabase.co` och `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` finnas i Environment Variables för Production.

För produktionsbygge lokalt:

```sh
npm run build
npm start
```

---

## 🚀 Kärnfunktioner

### 1. Fokusläge (Ringpass)
- **Gruppval:** Välj en grupp, alla grupper eller leads utan grupp. Importlista, källa och statusar finns under **Anpassa urval**, med förhandsvisning av ringbara leads.
- **Byt urval under passet:** **Ändra urval** pausar tiden. Spara och fortsätt med samma historik, poäng och genomgångna leads. Gruppvalet sparas även efter omladdning och synkning.
- **Tydlig kö:** Leads utan telefonnummer hoppas över. Framtida återringningar visas separat och blir tillgängliga när deras tid infaller. Borttagna grupper och importlistor kräver ett nytt urval.
- **Automatisk köprioritering:** Prioriterar automatiskt försenade uppföljningar, dagens uppföljningar, ej kontaktade företag och obesvarade leads.
- **Blixtsnabb tangentbordsstyrning:**
  - **`1`**: Inget svar
  - **`2`**: Inte intresserad
  - **`3`**: Ring tillbaka (öppnar snabbval för återringning)
  - **`4`**: Intresserad
  - **`5`**: Möte bokat (anger mötestid)
  - **`6`**: Kund (avslutad affär)
  - **`N` / `P`**: Nästa / Föregående företag utan att skapa samtal
  - **Mellanslag**: Pausar / fortsätter (utanför fält och knappar)
  - **`/`**: Öppnar snabbsökning
  - **`Esc`**: Stänger öppna dialoger och paneler
- **10-sekunders Ångra:** Återställer omedelbart samtal, status, uppföljningar och XP vid felregistrering utan att radera dina senare anteckningar.
- **Aktiv tidsmätning:** Mäter endast aktiv samtalstid; pausar vid sidbyte eller när fliken stängs.

### 2. Leads & Grupper
- **Blixtsnabb sökning och filtrering:** Sök i realtid på företagsnamn, telefonnummer, ort, kontaktperson och bransch.
- **Grupphantering:** Skapa anpassade listor med färger (t.ex. *Stockholm Hantverkare*, *Mötesbokning v42*).
- **Källspårning:** Spåra var varje lead kommer ifrån (Google Maps, Instagram, LinkedIn, Webbplats m.fl.).
- **Massåtgärder:** Ändra status, tilldela grupper eller radera flera företag samtidigt.

### 3. Import & Export
- **Stöd för CSV och Excel (.xlsx):** Arkval för flersidiga Excel-filer, bevarade ledande nollor i telefonnummer och skydd mot formelceller.
- **Hög prestanda:** Web Worker-avläsning i bakgrunden för filer upp till **20 MB** och **50 000 rader**.
- **Smart dubletthantering:** Normalisering av telefon (`+46`), domän och företagsnamn. Välj mellan att hoppa över, uppdatera eller skapa separata poster.
- **Säker CSV-export:** UTF-8 BOM för svensk Excel och automatiskt skydd mot formelinjektion.

### 4. Uppföljningar
- Samlar alla löften om återkoppling uppdelat i **Försenade**, **Idag**, **Kommande** och **Avklarade**.
- Direkt ringknapp och snabb ombokning i svensk tidszon (`Europe/Stockholm`).

### 5. Statistik & Gamification (XP)
- **Riktiga mätvärden:** Samtalsförsök skiljs från unika företag; första mötet/kundavslutet räknas som konvertering.
- **Mål & Streaks:** Dagliga och veckovisa mål för samtal, möten och kunder. Smarta vilodagar bryter inte din streak.
- **XP-system:** Samtal (+5 XP), slutförd uppföljning (+10 XP), bokat möte (+30 XP), ny kund (+100 XP).

---

## 🔐 Säkerhet & Supabase

- **Projekt:** Kopplat till Supabase-projektet `wnexrlghlmotkysrofkl` (Callflow).
- **Åtkomstkontroll:** Begränsat till en enda auktoriserad ägare via tabellen `callflow_access` (`agenter0202@gmail.com`).
- **RLS (Row Level Security):** Aktiverat på samtliga tabeller (`leads`, `call_logs`, `follow_ups`, `calling_sessions`, `import_batches`, `xp_events`, `goal_settings`).
- **Offline-synk:** Ändringar sparas omedelbart i webbläsarens lokala cache och synkroniseras i bakgrunden. Versionskontroll förhindrar att olika flikar eller enheter skriver över varandra.

---

## 🧪 Tester & Kvalitetskontroll

Projektet har fullständig testtäckning med både Vitest och Playwright:

```sh
# Kontrollera typer
npm run typecheck

# Kontrollera kodstil
npm run lint

# Kör enhetstester (Vitest)
npm test

# Kör användarresor och E2E-tester (Playwright)
npm run test:e2e

# Kör molnsynk- och nätbortfallstester
npm run test:cloud

# Kör autentiseringstester
npm run test:auth
```
