# Leadminne och trygg CSV-import

## Importera nya listor

Välj **Hoppa över dubbletter** som standard. Importen jämför hela arbetsrummet, oavsett grupp, källa eller tidigare importfil. Svenska telefonnummer normaliseras så att `0701234567` och `+46 70 123 45 67` matchar. Även domän och normaliserat företagsnamn jämförs. Namnträffar och träffar på flera olika företag hoppas över vid uppdatering och behöver granskas manuellt.

**Uppdatera matchande företag** behåller leadets ID, status, samtalsloggar, senaste kontakt och bokade uppföljningar. Icke-tomma kontaktuppgifter uppdateras. Nya anteckningar läggs efter befintliga anteckningar; samma anteckning läggs inte till igen. Om anteckningarna skulle bli för långa hoppas hela raden över och visas i rapporten. Grupp och importlista kan ändras enligt importvalet. Upprepade telefonträffar inom samma fil pekar på samma lead.

**Separata företag** skapar egna poster med egen historik. Använd det bara avsiktligt. Företagsdialogen varnar också när namn, telefon eller domän redan finns.

## Ringkön minns dagens samtal

Den automatiska kön tar med samma normaliserade telefonnummer en gång. Den jämför senaste kontakt och samtalsloggar över hela arbetsrummet, så att byte av grupp, ny import eller nytt ringpass inte automatiskt leder till att samma nummer rings igen samma svenska kalenderdag.

En uttryckligt bokad återringning efter senaste samtalet blir ringbar när tiden infaller, även samma dag. Framtida återringningar väntar. Föregående och direktval av ett lead kan fortfarande öppna det manuellt; fokusvyn visar då en varning om numret redan ringts idag. Ringknappen i sig registrerar inget samtal: välj resultat efter varje försök så att kontaktminnet uppdateras.

Antalet redan ringda leads visas i urvalet. Kön deduplicerar telefonnummer, inte domäner: företag med olika nummer kan avsiktligt dela en webbplats. Samma telefonnummer på flera legitima företag kräver därför ett manuellt val om du ska kontakta båda samma dag.

## Uppföljningar

Boka eller boka om **Nästa uppföljning** direkt i leadkortet utan att skapa ett samtalsförsök eller XP. Det använder sparade anteckningar; spara eventuella redigeringar först. Den tidigare väntande uppföljningen arkiveras som avklarad utan XP och den nya visas under Uppföljningar.

**Inget svar** lämnar en förfallen uppföljning väntande och ger inga uppföljningspoäng. Den finns kvar tills du faktiskt följer upp, markerar den avklarad eller bokar om. **Inte intresserad** och **Kund** avslutar väntande uppföljningar även vid manuell eller gemensam statusändring. Historiken bevaras. Ångra ett registrerat samtal återställer dess tidigare uppföljningar.

## Lagring och gränser

Ändringarna använder befintlig lokal lagring och molnsynk och kräver ingen databasmigrering. Registrerad historik finns kvar efter omladdning. Radering av ett lead eller en importlista raderar fortfarande dess kopplade historik enligt den befintliga bekräftelsen; exportera en JSON-säkerhetskopia om du vill bevara borttagna leads.

Kontrollera synkstatus innan du byter enhet. Samtidiga ringpass på två enheter kan inte garanteras fånga varandras senaste samtal innan synkningen hunnit fram. Revisionskonflikter hanteras av den befintliga synkmotorn.

## När ett företag ringer tillbaka

I fokusläget: klicka **Sök nummer** eller tryck **/**. Ringpasset pausas och samma företag, urval och genomgångna leads ligger kvar. Klistra in det inkommande numret. `070…`, `+46…`, `0046…`, mellanslag och bindestreck matchar samma sparade nummer. Du kan också söka på en del av numret, företagsnamn eller kontaktperson.

Sökningen omfattar hela arbetsrummet, inklusive **Inget svar**, andra grupper och avslutade leads. Exakta nummerträffar visas först, tillsammans med status, senaste kontakt och nästa uppföljning. Klicka på företaget för anteckningar och samtalshistorik. **Enter** öppnar den enda exakta nummerträffen eller den enda sökträffen; om flera företag delar numret väljer du själv rätt företag.

Stäng företagskortet och klicka **Fortsätt** för att fortsätta från samma plats i ringkön. Att bara söka och öppna kortet skapar inget samtal och ändrar ingen status. Nummersökningen fungerar också i Leads-listans vanliga sökfält.

## Smarta återförsök vid Inget svar

Varje registrerat **Inget svar** sparar en föreslagen tid för nästa försök. Förslaget ligger på nästa valda arbetsdag, på eftermiddagen om du ringde på förmiddagen och på förmiddagen om du ringde senare. Efter tre obesvarade försök i rad läggs nästa försök minst en vecka framåt. Dina arbetsdagar hämtas från Inställningar; om inga dagar är valda används måndag–fredag.

Ringkön väntar till förslagets tid. Du kan alltid välja en annan tid via **Nästa steg** på företagskortet. En ny bokad återringning ersätter det automatiska förslaget. Företagskortet och fokus visar antal försök och **aldrig svarat** när samtliga försök varit obesvarade. En redan utlovad men obesvarad uppföljning ligger kvar i historiken och under Uppföljningar; den markeras inte som utförd bara för att du ringt utan svar.

## Registrera ett inkommande samtal

Öppna företagets kort från nummersökningen och välj **Registrera inkommande samtal**. Välj resultat, skriv samtalsanteckningen och ange eventuell återringnings- eller mötestid. **Spara inkommande samtal** skapar en enda samtalslogg märkt Inkommande och uppdaterar företagets status och kontaktminne. Samtalsanteckningen finns i historiken. Ditt pausade ringpass, dess grupp och dess plats i kön behålls, även om återringaren tillhör en annan grupp. Du kan ångra resultatet i tio sekunder.

## Ett tydligt nästa steg

**Nästa steg** på företagskortet har tre val:

- **Ring**: bokar en uppföljning vid angiven tid och tar bort det automatiska återförsöksförslaget.
- **Skicka offert**: anger när offerten ska vara klar. Markera steget klart när du har skickat den.
- **Invänta svar**: anger när du ska kontrollera om svaret kommit. Det är en kontrolltid, inte ett automatiskt utskick.

Skriv en kort beskrivning för att minnas vad du lovat. Offert eller invänta svar ersätter eventuella väntande återringningar efter den tydliga informationen i formuläret, och företaget lämnar den automatiska ringkön tills du planerar ett nytt ringsteg. Tidigare uppföljningar behålls som ersatta i historiken, utan uppföljningspoäng eller genomförandestatistik. Avslutade leads behöver öppnas igen innan ett nytt steg bokas.

Nästa steg syns i Leads, i fokus och på företagets kort. **Intresserad**, **Möte bokat** och **Återkom senare** utan plan visas som **Bestäm nästa steg** i översikten. Efter ett intresserat samtal finns också en direktknapp i återkopplingen för att planera nästa steg.

## Gör detta nu

Översikten visar företag att agera på, i ordningen förfallna löften, steg som är redo nu, företag utan nästa steg och nya kontakter. Försök utan svar kommer därefter när deras nästa försök är tillgängligt. Framtida steg och avslutade företag visas inte som något att göra nu. Du kan filtrera på **Saknar nästa steg**, **Ring**, **Offert** och **Kontrollera svar**. Öppna företaget från raden för att genomföra eller planera åtgärden. Vyn uppdateras när data ändras och minst var 30:e sekund när en ny tid infaller.

## Granska och slå ihop dubbletter

I **Leads → Granska dubbletter** samlas möjliga träffar på telefon, domän eller normaliserat namn. Gemensam domän eller namn är bara en möjlighet, inte ett bevis på att det är samma företag. Jämför korten sida vid sida, välj vilka poster som ska vara med och välj huvudpost.

**Slå ihop valda företag** behåller huvudpostens ID, namn, status och grupp. Tomma kontaktfält fylls från de andra posterna. Alla samtal och uppföljningar flyttas till huvudposten med sina ursprungliga ID:n och datum; XP-historiken behålls utan nya poäng. Alla anteckningar bevaras tillsammans med uppgifter om de sammanslagna posterna. Om anteckningarna tillsammans blir för långa avvisas sammanslagningen utan att någon post ändras.

Alternativa nummer, webbplatser och företagsnamn bevaras, så att gamla nummer fortfarande går att söka och kommande importer hittar huvudposten. Om flera väntande uppföljningar finns bevaras samtliga och den tidigaste visas som nästa återringning. Ett huvudsakligt nästa steg väljs från huvudposten, annars från en annan vald post; övriga stegs beskrivningar finns i de samlade anteckningarna.

**Ångra sammanslagning** återställer de ursprungliga posterna under den öppna granskningsdialogen. Ångring stoppas om arbetsrummet ändrats sedan sammanslagningen, så att senare data inte skrivs över. Att stänga dialogen eller ladda om lämnar sammanslagningen sparad.

## Kompatibilitet och verifiering

Nya uppgifter är valfria fält i det befintliga arbetsrumsdokumentet. Äldre säkerhetskopior fungerar fortfarande. Nästa steg, återförsök, inkommande riktning och alternativa kontaktuppgifter ingår i JSON-säkerhetskopior och molnsynk. CSV-export visar nästa steg, återförsök och alternativa nummer och hemsidor. Kör den uppdaterade appversionen på alla enheter; en äldre klient med ett äldre valideringsschema kan sakna stöd för de nya fälten.

Affärsreglerna verifieras i `tests/lead-intelligence.test.ts`. Användarflödena och omladdning verifieras i `tests/e2e/smart-workflow.spec.ts`; molntransporten, inklusive nästa steg och alternativa nummer på en annan enhet, verifieras med kontrollerade Supabase-svar i `tests/cloud-e2e/cloud.spec.ts`. Inga riktiga leads eller produktionsdata ändras av testerna.
