# Kom igång med CALLFLOW

Den här guiden visar hur du sätter upp, konfigurerar och kör CALLFLOW både lokalt för utveckling och i skarp produktion på Vercel.

---

## 1. Förutsättningar

- **Node.js**: Version `22.x` (se `engines` i `package.json`).
- **npm**: Version `10.x` eller senare.
- **Supabase-konto**: Ett projekt kopplat till Supabase med PostgreSQL 15+.

---

## 2. Snabbstart lokalt

### Klona och installera beroenden

```sh
cd /Users/petergorgees/Dev/Crm
npm install
```

### Konfigurera miljövariabler (`.env.local`)

Skapa eller verifiera filen `.env.local` i projektets rotkatalog:

```env
NEXT_PUBLIC_SUPABASE_URL=https://wnexrlghlmotkysrofkl.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=din_publika_anon_nyckel_här
CALLFLOW_OWNER_EMAIL=agenter0202@gmail.com
```

> **Tips:** Utgå från `.env.example` om du flyttar projektet till en ny miljö.

### Starta utvecklingsservern

```sh
npm run dev
```

Öppna webbläsaren på [http://127.0.0.1:3000](http://127.0.0.1:3000).

---

## 3. Supabase-konfiguration steg för steg

CALLFLOW är förkonfigurerat för projektet `wnexrlghlmotkysrofkl` och använder Supabase Auth samt RLS.

### Steg 1: Skapa användaren
Eftersom CALLFLOW har en strikt Single-Owner-princip och saknar öppen registrering måste ditt konto skapas i Supabase-panelen:
1. Gå till din **Supabase Dashboard**.
2. Öppna **Authentication → Users**.
3. Klicka på **Add user** och ange din e-postadress (t.ex. `agenter0202@gmail.com`) samt ett starkt lösenord.
4. *Obs!* Om användaren redan existerar, ändra bara lösenordet; radera inte användaren, då arbetsrummet är knutet till dess användar-ID (`auth.uid()`).

### Steg 2: Stäng av öppen registrering
För att förhindra obehöriga från att registrera konton i ditt Supabase-projekt:
1. Gå till **Authentication → Providers → Email**.
2. Slå av **"Allow new users to sign up"**.
3. Spara ändringen.

### Steg 3: Tillämpa databasmigreringar
Databasens scheman och triggers finns under `supabase/migrations/`:
- `20261012104855_callflow_single_owner_workspace.sql` (Arbetsytan och RLS)
- `20261012111459_callflow_cache_owner_claim.sql` (Optimering av behörighetskontroll)
- `20261012112426_callflow_relational_crm.sql` (Relationella tabeller och projektionstriggers)

Dessa körs antingen via Supabase CLI (`supabase db push`) eller genom att klistra in SQL-filerna i Supabases **SQL Editor**.

---

## 4. Logga in och kör ditt första ringpass

1. **Öppna inloggningssidan**: När du öppnar appen möts du av CALLFLOWs inloggningsskärm.
2. **Logga in**: Ange din e-postadress och ditt lösenord. Lösenordet skickas säkert direkt till Supabase Auth över TLS.
3. **Importera dina leads**:
   - Gå till **Leads → Importera**.
   - Dra in en CSV-fil eller en Excel-fil (.xlsx).
   - Verifiera kolumnmappningen (företagsnamn och telefonnummer).
   - Välj strategi för dubletter (Hoppa över är förvalt).
   - Klicka på **Slutför import**.
4. **Starta ringpasset**:
   - Välj **Starta ringpass** direkt från importrapporten eller gå till **Fokusläge**.
   - Ring med telefonlänken eller från mobil.
   - Tryck på tangenterna `1`–`6` för att registrera samtalsutfallet.

---

## 5. Produktionsbygge & Vercel-driftsättning

För att bygga och starta applikationen i produktionsläge lokalt:

```sh
npm run build
npm start
```

### Driftsättning på Vercel
1. Skapa ett nytt projekt på [Vercel](https://vercel.com) och länka ditt Git-arkiv.
2. Under **Project Settings → Environment Variables**, lägg till:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://wnexrlghlmotkysrofkl.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = *din_supabase_publishable_key*
3. Distribuera (Deploy).

> **Viktigt:** Om miljövariablerna saknas i produktion kommer appen att visa ett tydligt konfigurationsfel vid inloggning; den öppnar **aldrig** ett demorun som fallback.
