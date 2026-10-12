# Funktionsguide & Arbetsflöden

Den här guiden går igenom alla funktioner och arbetsflöden i CALLFLOW, och hur de är utformade för att maximera effektivitet och momentum vid kalla samtal och mötesbokning.

---

## 1. Fokusläge (Ringpass)

Fokusläget är hjärtat i CALLFLOW. Det är ett distraktionfritt helskärmsläge optimerat för att genomföra många samtal på kort tid utan manuellt klickande eller administrativ friktion.

### Välj grupp och urval
Välj **alla grupper**, **utan grupp** eller en egen grupp innan du startar. Gruppen visar hur många leads den innehåller; förhandsvisningen visar hur många som går att ringa med ditt valda urval just nu och vilket företag som kommer först.

Under **Anpassa urval** kan du välja en importlista, en källa och vilka statusar som ingår. Framtida återringningar och leads utan telefonnummer visas separat. Passet kan startas när minst ett lead går att ringa.

Under passet visar raden ovanför företaget aktuell grupp och antalet leads som återstår. **Ändra urval** pausar passet och öppnar samma val. **Spara och fortsätt** behåller tid, samtal, XP och tidigare genomgångna leads. **Behåll pausat** lämnar ditt tidigare urval orört. Urvalet följer med vid omladdning, backup och molnsynkning.

Om en grupp eller importlista tas bort pausas berörda pass. Välj ett nytt urval för att fortsätta; kön utökas aldrig automatiskt till alla leads. Föregående företag håller sig inom det aktuella grupp-, källa- och importurvalet. Ett direkt ringval utanför det pågående urvalet avslutar det passet och öppnar ett nytt pass i företagets grupp.

### Köprioriteringsalgoritm (`rankedLeads`)
När ett ringpass startas sorteras alla tillgängliga leads automatiskt enligt följande prioriteringsordning:
1. **Försenade uppföljningar**: Personer du lovat att återkomma till där datumet redan passerat.
2. **Dagens uppföljningar**: Återringningar som förfaller under innevarande dag.
3. **Ej kontaktade företag**: Nya leads som ännu inte ringts.
4. **Inget svar**: Leads som inte svarat vid tidigare försök (äldsta först).
5. **Övriga öppna statusar**: Intresserade eller leads som väntar på nästa kontakt.

> Företag som du redan hanterat under pågående pass dyker inte upp igen förrän du väljer Föregående eller startar om listan. Framtida återringningar som ännu inte har hanterats kommer in i kön när tiden infaller. Leads utan telefonnummer hoppas över i nya pass.

### Tangentbordsgenvägar & 1-klicksregistrering
När du ringer behöver du aldrig släppa tangentbordet:

| Tangent | Åtgärd | Beskrivning |
| :---: | :--- | :--- |
| **`1`** | Inget svar | Registrerar missat samtal och går omedelbart till nästa företag. |
| **`2`** | Inte intresserad | Avslutar leadet och går vidare. |
| **`3`** | Ring tillbaka | Öppnar snabbpanel för återringning (t.ex. *Om 2 timmar*, *Imorgon kl 09*, *Nästa vecka*). |
| **`4`** | Intresserad | Markerar leadet som intresserat och går till nästa. |
| **`5`** | Möte bokat | Öppnar datum- och tidsväljare för inbokad mötestid (+30 XP). |
| **`6`** | Kund | Registrerar avslutad affär (+100 XP). |
| **`N`** | Nästa lead | Hoppar över aktuellt lead utan att skapa samtalslogg. |
| **`P`** | Föregående lead | Går tillbaka till föregående företag i samma pass. |
| **Mellanslag** | Pausa / Fortsätt | Växlar mellan aktivt och pausat pass, utanför fält, länkar och knappar. |
| **`/`** | Sök | Öppnar den globala snabbsökningen. |
| **`Esc`** | Avbryt / Stäng | Stänger aktiva dialoger eller datumväljare. |

> **Obs:** Genvägarna är inaktiverade när markören står i ett textfält, en anteckningsruta eller en öppen dialog.

### 10-sekunders Ångra-funktion (`UndoCall`)
Om du råkar trycka fel eller registrerar fel utfall visas en flytande ångra-knapp i 10 sekunder:
- Återställer leadets tidigare status.
- Raderar det skapade samtalet.
- Återställer eventuella ändrade uppföljningsdatum.
- Drar tillbaka utdelade XP-poäng.
- Bevarar eventuella nya anteckningar du skrivit under tiden.

### Tidsmätning & Paus
- **Aktiv tid**: Tiduret räknar endast faktisk aktiv samtalstid. När du klickar på **Pausa** stannar klockan.
- **Automatisk paus**: Om du navigerar bort från `/focus` eller stänger fliken pausas passet automatiskt. När du återvänder kan du återuppta passet där du slutade.
- **Sammanfattning**: När du avslutar passet visas en rapport med antal samtal, samtalstid, bokade möten och intjänad XP.

---

## 2. Leadshantering & Grupper

### Företagslistan (`/leads`)
- **Blixtsnabb sökning**: Sökning sker mot företagsnamn, telefonnummer, ort, bransch och kontaktperson med `useDeferredValue` för mjuk inmatning utan fördröjning.
- **Filtrering**: Filtrera på status, bransch eller specifika importomgångar (batches).
- **Paginering**: 50 leads per sida med omedelbar växling.

### Gruppering (`LeadGroups`)
Grupper låter dig strukturera dina leads i hanterbara ringlistor:
- Skapa anpassade grupper med namn och accentfärg (t.ex. *Göteborg · Restauranger*, *Måleri Stockholm*, *Heta prospekts*).
- Tilldela leads till en grupp individuellt eller via massmarkering.
- Ta bort en grupp när som helst utan att radera de underliggande företagen.

### Källor (`leadSources`)
Varje lead kan spåras till sin anskaffningskälla:
- Standardkällor: *Google Maps*, *Instagram*, *Facebook*, *LinkedIn*, *Webbplats*, *Manuellt*.
- Sätts automatiskt vid import eller redigeras i lead-kortet.

### Massåtgärder
Genom att markera kryssrutorna i leadstabellen kan du utföra åtgärder på flera företag samtidigt:
- Ändra status i klump.
- Tilldela gemensam källa eller grupp.
- Exportera markerade rader som CSV.
- Radera valda leads och relaterad historik.

---

## 3. Import & Export

CALLFLOW har en avancerad importmotor som kan hantera stora registerfiler utan att webbläsaren hänger sig.

### Web Worker & Filformat
- Stöder både **CSV** och **Excel (.xlsx)**.
- Filer bearbetas i en separat Web Worker (`import.worker.ts`) i batcher om 250 rader.
- Klarar filer upp till **20 MB** och **50 000 rader**.
- För Excel med flera datablad kan du enkelt välja vilket blad som ska läsas in.

### Kolumnmappning med synonymstöd
Importguiden känner automatiskt igen vanliga svenska och engelska kolumnrubriker:
- **Företagsnamn**: *företag*, *company*, *bolag*, *businessname*, *namn*.
- **Telefon**: *telefonnummer*, *tel*, *mobil*, *phone*, *mobile*.
- **Webbplats**: *hemsida*, *url*, *web*, *webbplats*.
- **Bransch**: *industry*, *kategori*.
- **Ort**: *city*, *stad*.
- **Kontaktperson**: *kontakt*, *contactname*.
- **Källa**: *källa*, *kalla*, *source*.

### Normalisering & Dubletthantering
Vid inläsning normaliseras telefonnummer automatiskt till svenskt format (`070...` blir `+4670...`) och webbadresser tvättas till rena domäner.

Du kan välja mellan tre strategier för dubletter:
1. **Hoppa över dubletter (Standard)**: Befintliga företag rörs inte.
2. **Uppdatera befintliga leads**: Tomma fält fylls i från importen medan befintlig historik, status och uppföljningar behålls intakta.
3. **Skapa separata leads**: Importerar posten som ett nytt separat lead.

### Säker CSV-Export
- Exporterar med **UTF-8 BOM** och semikolonavgränsare för direkt kompatibilitet med svensk Excel.
- Celler som börjar med `=`, `+`, `-` eller `@` saneras automatiskt för att förhindra CSV Formula Injection.

---

## 4. Uppföljningar (`/followups`)

Alla samtal som resulterar i *Återkom senare* landar i uppföljningsvyn:
- **Försenade**: Tydligt rödmarkerade så att inget lovat återkopplingssamtal glöms bort.
- **Idag**: Uppföljningar som ska göras under aktuell arbetsdag.
- **Kommande**: Schemalagda uppföljningar framåt i tiden.
- **Avklarade**: Historik över slutförda uppföljningar.

Från uppföljningsvyn kan du:
- Ringa direkt med telefonikonen.
- Boka om tiden med ett klick.
- Markera uppföljningen som klar (+10 XP).

---

## 5. Statistik, Mål & Momentum (`/statistics`)

Statistiken drivs av samtalshistoriken och beräknas strikt efter svensk kalendertid i tidszonen `Europe/Stockholm`.

### Mätvärden
- **Samtalsförsök**: Totalt antal loggade samtal under perioden.
- **Unika företag**: Hur många unika organisationer som kontaktats.
- **Svarsfrekvens**: Andelen samtal som resulterade i kontakt (alla utom *Inget svar*).
- **Konverteringsgrad**: Andel kontaktade företag som ledde till ett första bokat möte eller kund.
- **Veckodiagram**: Tydliga stapeldiagram med aktivitet dag för dag.

### Mål & Streaks
- **Dags- och veckomål**: Ställ in dina personliga mål i Inställningar.
- **Streaks (Obrutna sviter)**: Räknar hur många på varandra följande arbetsdagar du nått ditt dagsmål.
- **Smarta vilodagar**: Helgdagar eller dagar som inte är markerade som arbetsdagar bryter inte din streak.

### XP & Gamification
Varje framsteg belönas med erfarenhetspoäng:
- **Loggat samtal**: +5 XP
- **Genomförd uppföljning**: +10 XP
- **Bokat möte (första per företag)**: +30 XP
- **Ny kund (första per företag)**: +100 XP
