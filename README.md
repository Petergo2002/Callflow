# CALLFLOW

Ett CRM för svensk soloförsäljning med privat Supabase-lagring och lokal säkerhetskopia. Next.js 16, React 19, TypeScript, Tailwind 4, Radix/shadcn-komponenter, Lucide, Motion, Recharts, Zod, PapaParse och ExcelJS.

## Starta

Kräver Node.js 22 eller senare.

```sh
npm install
npm run dev
```

Öppna http://127.0.0.1:3000. För produktion:

```sh
npm run build
npm start
```

## Första ringpasset

1. Öppna **Leads → Importera** och välj CSV eller XLSX.
2. Välj blad om Excel-filen innehåller flera datablader.
3. Kontrollera kolumnmappningen och förhandsvisningen.
4. Välj hantering av dubbletter. Standardvalet hoppar över dem.
5. Importera och välj **Starta ringpass**, eller gå till **Fokusläge** och välj en lista.
6. Ring med telefonlänken. Registrera resultat efter samtalet.

**1–6** registrerar utfall. **3** öppnar snabbval för återringning; **5** låter dig ange valfri mötestid. **N/P** byter företag utan att skapa samtal. **/** öppnar sökning, **Esc** stänger sekundära paneler. Genvägar ignoreras i textfält och dialoger.

Anteckningar sparas direkt. Varje registrering ger en tio sekunder lång **Ångra** som återställer berört samtal, status, uppföljningar och XP utan att radera senare anteckningar. Snabba dubbelklick och tangenttryck skyddas med både UI-spärr och idempotenta händelse-ID:n.

Framtida återringningar visas först när tiden är inne. Försenade uppföljningar prioriteras, sedan uppföljningar som förfallit idag, nya företag och obesvarade leads. Avslutade statusar är exkluderade som standard och kan väljas uttryckligen. Besökta företag dyker inte upp igen automatiskt under samma pass. Paus stoppar den aktiva tiden. När du lämnar sidan eller laddar om pausas passet och kan återupptas.

## Import & export

- CSV: automatisk avgränsare, komma/semikolon, UTF-8 och Windows-1252-fallback.
- XLSX: bladval, texttelefoner, rena nollformat (t.ex. `0000000000`) och ignorerade formelceller. Inga formler exekveras. Nollor som redan har försvunnit i Excels numeriska celler kan inte återskapas utan ett format; guiden varnar om detta.
- Storleksgräns: 20 MB och 50 000 datarader. Filavläsning sker i Web Worker. Importen behandlar 250 rader åt gången, visar faktisk förloppsinformation och sparar hela resultatet atomärt.
- Dubbletter: normaliserade telefoner/domäner och exakta normaliserade namn. Namnträffar och flera motstridiga träffar uppdateras aldrig automatiskt. Ingen fuzzy merge.
- Uppdatering fyller icke-tomma importfält och bevarar status, samtal och uppföljningar. Uppdaterade företag får importens källa. Rapporten beskriver alla avvisade och överhoppade rader.
- CSV-export: UTF-8 BOM, semikolon, citerade celler och skydd mot formelinjektion. Export från leadtabellen omfattar aktuella sök-/filterträffar; från Inställningar exporteras alla företag.

## Supabase & data

CALLFLOW är kopplat till projektet `wnexrlghlmotkysrofkl` (Callflow). Ett enda konto, `agenter0202@gmail.com`, har åtkomst. Ingen teamhantering eller öppen registreringsfunktion ingår.

1. Skapa kontot manuellt under **Supabase → Authentication → Users → Add user** med `agenter0202@gmail.com` och ett lösenord. Om kontot redan finns, sätt lösenordet på det befintliga kontot; radera inte användaren eftersom arbetsrummet är kopplat till dess ID.
2. Stäng av **Allow new users to sign up** under **Authentication → Sign In / Providers**. Detta är en projektinställning som måste göras i dashboarden; MCP saknar verktyg för att ändra den. Befintliga konton kan fortfarande logga in, och admin kan skapa konton.
3. Öppna appen och logga in med mejladress och lösenord. Appen har ingen registrering och skapar aldrig konton. Lösenordet skickas direkt till Supabase Auth och sparas aldrig av CALLFLOW.
4. Om ett lokalt arbetsrum finns och molnet är tomt: välj **Överför mitt lokala arbetsrum**. Originalet under `callflow.data.v1` behålls.

Databasen har riktiga tabeller: `leads`, `call_logs`, `follow_ups`, `calling_sessions`, `import_batches`, `xp_events` och `goal_settings`. Varje post har ägare, primärnyckel och relevanta kolumner, datum är `timestamptz`, telefonnummer är text. Samtal och uppföljningar refererar till leads via sammansatta främmande nycklar som även låser ägaren. Index stöder status, telefon, domän, historik och förfallodatum. Posternas kompletta JSON bevarar alla appfält och ordningen vid återställning.

Appen läser dessa tabeller genom `callflow_read_workspace`, en funktion med SECURITY INVOKER och samma RLS. Skrivningar använder fortsatt `callflow_workspaces` som atomiskt skrivunderlag och återställningskopia med revision. En privat databastrigger uppdaterar alla CRM-tabeller i samma transaktion; ett fel rullar tillbaka hela skrivningen. Oförändrade poster skrivs inte om. Redigera genom appen, inte genom tabellernas kolumner i dashboarden: de är avsiktligt skrivskyddade för klienten för att undvika att historik och XP skiljer sig mellan två versioner. Den befintliga molndatan kopieras till tabellerna vid migreringen utan att byta användar-ID eller revision.

`callflow_access` begränsar åtkomst till `agenter0202@gmail.com`. RLS är aktivt på samtliga tabeller; anonyma användare saknar rättigheter. Klienten använder en publishable key. Den privata triggern har inga klienträttigheter och är inte en exponerad RPC. Supabases rådgivare rapporterar inga tabell- eller RLS-varningar; Auths skydd mot läckta lösenord är däremot avstängt och kan aktiveras separat i dashboarden (https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Nya index visas som oanvända tills databasen börjar användas.

Ändringar sparas först i webbläsarens lokala kopia, sedan i Supabase. Indikatorn skiljer mellan **Sparat lokalt · synkar**, **Sparat i Supabase**, nätavbrott och versionskonflikter. En kö ser till att senare anteckningar inte försvinner när en tidigare skrivning pågår. Versionskontroll förhindrar att två enheter tyst skriver över varandra. Vid en konflikt kan du välja molnversionen eller din lokala version; båda sparas först som konfliktkopia som går att hämta i Inställningar. Molnändringar hämtas när fönstret får fokus och var 30:e sekund när inga osynkade ändringar finns.

Om nätverket bryts under arbetet finns ändringarna kvar lokalt och synkas när anslutningen återkommer. Första inloggningen/verifieringen på en enhet kräver nätåtkomst. Ett separat lokalt utvecklingsläge kan aktiveras med `NEXT_PUBLIC_CALLFLOW_STORAGE_MODE=local`. Molnappen kräver inloggning.

**Inställningar** har full JSON-säkerhetskopiering och validerad återställning. CSV innehåller företagsuppgifter och kontaktstatistik; JSON innehåller också samtal, XP, uppföljningar, inställningar och pass. Tom eller raderad demodata återställs aldrig automatiskt.

Konfigurationen finns i ignorerade `.env.local`; använd `.env.example` vid flytt till en annan miljö. Schemaändringen sparas i `supabase/migrations/`. Den tillåtna ägaren konfigureras i `callflow_access`.

Statistik räknas från samtalsloggen med datum i **Europe/Stockholm**. Samtalsförsök skiljs från unika företag. Första mötes- och kundutfallet per företag räknas som konvertering; återregistrering ökar bara antalet försök. Svarsfrekvens använder alla försök som nämnare. Målgraden och streak jämför historiska samtal mot nuvarande mål och arbetsdagar; vilodagar bryter inte streaken.

XP: samtal +5, slutförd uppföljning +10, första mötet per företag +30, första kunden per företag +100. Redigering av företagsstatus ger aldrig XP.

## Arkitektur

- `src/lib/model.ts`: typer, validering, svensk tid, normalisering, kö och statistik.
- `src/lib/engine.ts`: rena transaktioner för samtal, sessioner, uppföljningar och ångra.
- `src/lib/repository.ts`: versionerad lagringsadapter och validering av säkerhetskopior.
- `src/lib/store.tsx`: lagring, React-prenumeration, teman och sessionslivscykel.
- `src/lib/import.ts` och `import.worker.ts`: filavläsning, mappning, dubbletter och atomär import.
- `src/components`: separata arbetsytor och UI-komponenter.

Affärslogiken tar ett datatillstånd och returnerar nästa tillstånd utan webbläsarberoenden. `cloud-repository.ts` sköter Supabase, versionskontroll och lokala kopior. `store.tsx` kopplar ihop inloggning, synkning och React. `cloud-access.tsx` visar inloggning och synkstatus. Den tidigare `api/auth/login`-rutten är pensionerad (HTTP 410); klienten använder enbart Supabase Auths lösenordsinloggning.

## Kontrollera

```sh
npm run typecheck
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
npm run test:cloud
npm run build
```

Playwright använder isolerade profiler och testar 500-företagsimport, mappning, dubbletter, Excel med flera blad, ledande nollor, formelceller, ringpass, kortkommandon, återringning imorgon, paus/omladdning, ångra/XP, export, redigering/radering, inställningar, lagringsfel och responsivitet. Vitest täcker transaktioner, köprioritering, svensk tidszon, streak, dubbletter, CSV-säkerhet och återställning.

Visuella QA-bilder skrivs till `docs/screenshots/`. Utveckling och produktion har separata byggkataloger (`.next-dev` / `.next`) så att produktionsbygget inte stör det öppna arbetsrummet.

Molntesterna använder simulerade Supabase-svar och isolerade browserprofiler. De skickar inga mejl och lägger inte in testdata i den riktiga databasen. Databasens positiva och negativa åtkomstregler samt revisionskontroll verifierades också genom SQL-transaktioner som rullades tillbaka. En verklig första inloggning och dataöverföring görs av dig i appen.
