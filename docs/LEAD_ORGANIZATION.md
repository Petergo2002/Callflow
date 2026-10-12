# Ordna leads

I **Leads** visas sökning och status direkt. **Filter** öppnar källa, bransch, importlista och importdatum. Aktiva filter visas som avtagbara etiketter även när filterpanelen är stängd. Välj grupp i menyn ovanför listan. Sorteringen finns i menyn **Sortera leads** och i tabellrubrikerna. Datum visas i svensk tid; datumfiltret är inkluderande från och till.

Vid importens sista steg väljer du en källa, till exempel Google Maps eller Instagram, och en befintlig eller ny grupp. En mappad Källa-kolumn i filen gäller per rad; det valda importvärdet fyller tomma källor. Importdatum registreras automatiskt på varje behandlat lead och på importlistan. Vid uppdatering av en dubblett bevaras ID, skapandedatum, status och historik; senaste importdatum och importlista uppdateras. Överhoppade dubbletter flyttas inte.

**Hantera grupper** öppnar en sökbar lista med namn, färg och antal leads. **Ny grupp** öppnar en fokuserad skapandevy; redigering sker separat. En grupp kan öppnas direkt från listan. Nya företag och importer förväljer då den aktuella gruppen. Varje lead har högst en grupp och en oberoende källa. Du kan ändra dem i företagsdialogen eller för flera markerade leads med **Flytta till grupp** eller **Ändra källa**. Att ta bort en grupp behåller företagen. **Välj alla träffar** omfattar även andra sidor i den filtrerade listan.

Öppna ett företag eller dess detaljknapp för kontaktuppgifter, historik, grupptillhörighet och radering. Massåtgärder visas först när leads har markerats. Status, grupp och källa ändras i egna dialoger, och en ny grupp kan skapas samtidigt som leads flyttas dit. Filterbyten avmarkerar leads så att dolda företag inte ändras av misstag. Massradering tar bort markerade leads. **Ta bort import** visas när en import har valts och tar bort alla leads som nu tillhör importen, även när andra filter döljer dem. Samtal, uppföljningar och kopplad XP tas bort tillsammans med företagen. Bekräftelse krävs; exportera en JSON-säkerhetskopia om du vill kunna återställa.

CSV-export innehåller källa, grupp, importfil, importdatum och skapandedatum. JSON-säkerhetskopior innehåller också grupper. Äldre säkerhetskopior får automatiskt en tom gruppsamling och äldre importer visar datumet från sin importlista.

Databasen har `lead_groups`, RLS, ägarkopplade gruppreferenser samt index för källa, grupp och datum. Gruppen och importerade leads skrivs atomiskt via den befintliga synkningen. Den tidigare revisionskontrollen och lokala säkerhetskopian gäller fortsatt.

På mobil visas leads som kort med markering, kontaktuppgifter och snabbstart för ringpass. På dator är tabellen förenklad; **Visa fler detaljer** lägger till hemsida, senaste kontakt och antal försök. Alla uppgifter finns alltid i företagets detaljvy.

UX-valen följer principer för [tabeller och massåtgärder](https://www.nngroup.com/articles/data-tables/) och [progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/): vanliga funktioner ligger nära listan, medan mer omfattande filter och redigering öppnas vid behov.
