# Utvecklarguide & Testning

Denna guide riktar sig till utvecklare och AI-agenter som arbetar med kodbasen i CALLFLOW. Den beskriver arkitekturmönster, kodkonventioner och testrutiner.

---

## 1. Projektstruktur

```
/
├── docs/                        # Dokumentation och QA-skärmdumpar
│   ├── ARCHITECTURE.md          # Systemarkitektur & datamodell
│   ├── FEATURES.md              # Funktionsguide & arbetsflöden
│   ├── GETTING_STARTED.md       # Snabbstart & Vercel/Supabase-setup
│   ├── DEVELOPMENT.md           # Denna utvecklarguide
│   └── screenshots/             # Visuella QA-skärmdumpar
├── public/                      # Statiska tillgångar (ikoner m.m.)
├── src/
│   ├── app/                     # Next.js 16 App Router
│   │   ├── [section]/page.tsx   # Dynamisk sektionsrouting (/leads, /focus etc.)
│   │   ├── globals.css          # Designsystem & global Tailwind 4 styling
│   │   ├── layout.tsx           # Rotlayout och metadata
│   │   └── page.tsx             # Rotsida (omdirigerar till workspace/dashboard)
│   ├── components/              # React UI-komponenter
│   │   ├── cloud-access.tsx     # Inloggningsvy & synkroniseringsstatus
│   │   ├── dashboard.tsx        # Översiktsvyn och veckodiagram
│   │   ├── focus.tsx            # Fokusläge (ringpass & tangentbordsgenvägar)
│   │   ├── followups.tsx        # Uppföljningslistor & ombokningsdialog
│   │   ├── import-wizard.tsx    # Steg-för-steg importdialog för CSV/XLSX
│   │   ├── lead-dialog.tsx      # Detaljkort och redigering av lead
│   │   ├── lead-groups.tsx      # Grupphanterare med färgval
│   │   ├── leads.tsx            # Huvudtabell för leads med sök och filter
│   │   ├── settings.tsx         # Målinställningar, säkerhetskopiering & export
│   │   ├── statistics.tsx       # Detaljerad statistik och mätvärden
│   │   ├── workspace.tsx        # Huvudlayout, sidonavigering & kortkommandon
│   │   └── ui/                  # Grundkomponenter (Button, Dialog)
│   └── lib/                     # Kärnlogik och motorer
│       ├── clean-data.ts        # Radering av demodata
│       ├── cloud-repository.ts  # Supabase-adapter, synkkö & konflikthantering
│       ├── demo.ts              # Validering och hantering av demoposter
│       ├── engine.ts            # Ren affärsmotor: samtal, ångra, rangordning
│       ├── import.ts            # Mappning, dublettkontroll & normalisering
│       ├── import.worker.ts     # Web Worker för filavläsning
│       ├── model.ts             # Typer, scheman, svensk tidszon och mätvärden
│       ├── organization.ts      # Logik för leadgrupper och importborttagning
│       ├── repository.ts        # Zod-validering & LocalStorage-adapter
│       ├── store.tsx            # React Context-brygga för hela appens state
│       └── supabase.ts          # Supabase-klient och miljökonfiguration
├── supabase/
│   └── migrations/              # SQL-migreringar, RLS-regler & triggers
└── tests/                       # Testsviter
    ├── auth-e2e/                # Playwright-tester för autentisering
    ├── cloud-e2e/               # Playwright-tester för synk och nätbortfall
    ├── e2e/                     # Playwright-tester för användarresor och UI
    ├── clean-data.test.ts       # Vitest för demodatastädning
    ├── cloud-repository.test.ts # Vitest för Supabase-synk och köer
    └── engine.test.ts           # Vitest för transaktionsmotorn och ångra
```

---

## 2. Arkitekturprinciper & Konventioner

### Funktionsrena motorer (Pure Engines)
Affärslogiken i `src/lib/engine.ts` och `src/lib/organization.ts` är **100% oberoende av webbläsaren och DOM**:
- Funktioner som `logCall`, `undoCall`, `completeFollowUp` och `startSession` tar emot ett `Data`-objekt plus parametrar och returnerar ett nytt `Data`-objekt.
- Detta gör affärslogiken deterministisk, enkel att enhetstesta med Vitest och helt fri från svårupptäckta biverkningar.

### Svensk tidszon & Datumhantering
All datum- och tidsberäkning sker i zonen `Europe/Stockholm`:
- Använd alltid `dateKey()` för att extrahera `YYYY-MM-DD` i svensk tid.
- Samtalsmål, streaks och veckodiagram beräknas efter svensk kalendervecka via `weekStart()`.
- Hantering av övergångar mellan sommartid och normaltid (DST) valideras strikt via `fromStockholm()` och `stockholmInput()` så att omöjliga klockslag inte kan sparas.

### Strikt Idempotens
Varje samtalsloggning genererar ett unikt händelse-ID (`eventId`) innan anropet skickas. Om användaren råkar dubbelklicka eller om ett nätverksanrop återsänds ignoreras dubbletten utan att skapa fler samtal eller dubbla XP-poäng.

---

## 3. Testning

Projektet har två nivåer av automatiserade tester:

### 1. Snabba Enhetstester (Vitest)

Körs med:
```sh
npm test
```

Täcker:
- `engine.test.ts`: Samtalsregistrering, köprioritering, återringningar, 10-sekunders ångra och XP-beräkningar.
- `cloud-repository.test.ts`: Synkronisering mot mockat Supabase-transport, köhantering vid pågående skrivning, nätbortfall och revisionskonflikter.
- `clean-data.test.ts`: Säker borttagning av demodata utan att radera riktiga importer.

### 2. End-to-End Användartester (Playwright)

Installera webbläsare vid behov:
```sh
npx playwright install chromium
```

Kör standardresor:
```sh
npm run test:e2e
```

Kör molnsynk-tester:
```sh
npm run test:cloud
```

Kör autentiseringstester:
```sh
npm run test:auth
```

Playwright-testerna testar verkliga scenarier i isolerade browserprofiler:
- Import av 500 leads med kolumnmappning och dublettkontroll.
- Excel med flera blad, textnummer och formelceller.
- Fokusläge, tangentbordsgenvägar (`1`–`6`, `N`, `P`), snabbval för återringning.
- Paus och omladdning av flik mitt i ett ringpass.
- Ångra-funktion och återställning av XP.
- Exporter och säkerhetskopior.

---

## 4. Kvalitetskontroll före kodleverans

Innan ändringar slås ihop eller levereras ska alla kontroller köras:

```sh
# 1. Kontrollera TypeScript-typer
npm run typecheck

# 2. Kontrollera kodstil och ESLint
npm run lint

# 3. Kör enhetstesterna
npm test

# 4. Verifiera autentiserings- och produktionsregler
npm run test:auth

# 5. Verifiera produktionsbygge
npm run build
```
