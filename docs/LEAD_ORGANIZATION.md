# Ordna leads

I **Leads** kan du filtrera på källa, grupp, import och importdatum. Sorteringen finns i menyn **Sortera leads** och i tabellrubrikerna. Datum visas i svensk tid; datumfiltret är inkluderande från och till.

Vid importens sista steg väljer du en källa, till exempel Google Maps eller Instagram, och en befintlig eller ny grupp. En mappad Källa-kolumn i filen gäller per rad; det valda importvärdet fyller tomma källor. Importdatum registreras automatiskt på varje behandlat lead och på importlistan. Vid uppdatering av en dubblett bevaras ID, skapandedatum, status och historik; senaste importdatum och importlista uppdateras. Överhoppade dubbletter flyttas inte.

**Hantera grupper** skapar, döper om och tar bort grupper. Varje lead har högst en grupp och en oberoende källa. Du kan ändra dem i företagsdialogen eller för flera markerade leads med **Spara gruppering**. Att ta bort en grupp behåller företagen. **Välj alla träffar** omfattar även andra sidor i den filtrerade listan.

Papperskorgen på varje rad tar bort det företaget. Massradering tar bort markerade leads. **Ta bort import** visas när en import har valts och tar bort alla leads som nu tillhör importen, även när andra filter döljer dem. Samtal, uppföljningar och kopplad XP tas bort tillsammans med företagen. Bekräftelse krävs; exportera en JSON-säkerhetskopia om du vill kunna återställa.

CSV-export innehåller källa, grupp, importfil, importdatum och skapandedatum. JSON-säkerhetskopior innehåller också grupper. Äldre säkerhetskopior får automatiskt en tom gruppsamling och äldre importer visar datumet från sin importlista.

Databasen har `lead_groups`, RLS, ägarkopplade gruppreferenser samt index för källa, grupp och datum. Gruppen och importerade leads skrivs atomiskt via den befintliga synkningen. Den tidigare revisionskontrollen och lokala säkerhetskopian gäller fortsatt.
