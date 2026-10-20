# Partyspiele

Fünf Spiele:

- **Verräter** – alle kennen einen geheimen Begriff, nur die Verräter nicht. Pass & Play oder online.
- **Wer bin ich?** – jeder bekommt eine Person, die alle kennen außer ihm selbst. Pass & Play oder online.
- **SPIEGEL** – Karten, Lügen und Fallen für genau 2 Spieler. Pass & Play oder online.
- **Stadt Land Fluss** – ein Buchstabe, eigene Kategorien, Zeitdruck. Nur online, 1 bis 20 Spieler.
- **Kritzeln** – einer zeichnet, alle anderen raten. Nur online, 2 bis 20 Spieler.

Auf der Startseite wählt man das Spiel, danach den Modus:

- **Pass & Play** – ein Gerät für alle, wird reihum weitergegeben. Funktioniert auch offline: einfach `index.html` im Browser öffnen.
- **Online** – jeder spielt auf seinem eigenen Gerät in einer gemeinsamen Lobby. Dafür muss der kleine Server (`server.js`) laufen, siehe unten.

## Ablauf
Das Spiel läuft in drei Phasen (oben als Fortschrittsanzeige sichtbar). Zwischen den Phasen erscheint jeweils ein animierter Übergangsbildschirm.

1. **Start:** Spieleranzahl (3–20) und Namen, Anzahl der Verräter, Kategorie und Schwierigkeit wählen. Optional sieht der Verräter die Kategorie und/oder bekommt einen **vagen Hinweis** (siehe unten).
2. **Rollen verteilen:** Ein zufälliger Spielername wird angezeigt. Dieser Spieler nimmt das Gerät, tippt auf seinen Namen und sieht seine Rolle (Begriff oder „IMPOSTER“). Erneut tippen → nächster Spieler.
3. **Spielrunde** (Tipps, Votes und Ergebnis auf einer Seite):
   - Jeder Spieler hat ein Profil, auf dem seine Tipps stehen. Reihum gibt der Spieler, der am Zug ist, einen Tipp ins Textfeld ein.
   - Erst wenn alle einen Tipp abgegeben haben, erscheint die **Abstimmung**. Ab dann kann jederzeit ein Vote gestartet werden.
   - Beim Vote wird das Gerät reihum weitergegeben; jeder wählt geheim einen Spieler oder enthält sich. Raus ist, wer allein die meisten Stimmen hat und mehr Stimmen als Enthaltungen bekommt.
   - Nach einem Vote muss wieder jeder einen Tipp abgeben, bevor der nächste Vote möglich ist – auch wenn der Vote mitten in einer Runde gestartet wurde (dann geht es weiter, bis derjenige wieder dran ist).
   - Wird ein unschuldiger Spieler rausgewählt, gewinnen die Verräter. Sind alle Verräter raus, gewinnen die Spieler.
   - **Verräter können jederzeit den Begriff raten** (Name wählen + Begriff eingeben). Richtig = gewonnen, falsch = verloren, ausgeschieden ist man in jedem Fall. Die anderen erfahren den Begriff nicht. Ist er der einzige (verbleibende) Verräter, entscheidet sein Tipp das ganze Spiel.
   - Am Ende erscheint das Ergebnis direkt auf derselben Seite, inklusive Begriff und aufgedeckter Rollen.

Beim Raten werden Groß-/Kleinschreibung, Umlaute, kleine Tippfehler und alternative Namen (z. B. „USA“/„Amerika“, bei Personen auch der Nachname) toleriert.

## Online-Modus

- Einer erstellt eine **Lobby** und ist Host. Die anderen treten mit dem **4-stelligen Code** oder über den **Einladungslink** bei.
- Nur der Host ändert die Einstellungen und startet das Spiel. Er kann außerdem Spieler entfernen, einen abwesenden Spieler überspringen, eine Abstimmung vorzeitig auswerten oder abbrechen und das Spiel beenden.
- Jeder sieht **nur seine eigene Rolle**. Der Server kennt alle Rollen und den Begriff und schickt jedem Gerät nur, was es sehen darf. Das Feld „Begriff raten“ erscheint nur bei Verrätern.
- Tipps, Abstimmung und Regeln sind dieselben wie bei Pass & Play – abgestimmt wird gleichzeitig, jeder auf seinem Gerät.
- Lädt jemand die Seite neu oder verliert kurz die Verbindung, kommt er automatisch zurück ins Spiel.

### Lokal starten (z. B. im selben WLAN)

Voraussetzung: [Node.js](https://nodejs.org) ab Version 18.

```bash
npm install
npm start
```

Dann `http://localhost:3000` öffnen. Andere Geräte im selben WLAN erreichen das Spiel über die IP-Adresse des Rechners, z. B. `http://192.168.0.23:3000`.

### Kostenlos ins Internet stellen (Render.com)

1. Bei [render.com](https://render.com) mit dem GitHub-Konto anmelden.
2. **New → Blueprint** wählen und dieses Repository auswählen. Render liest `render.yaml` und richtet alles ein.
3. Nach ein paar Minuten gibt es eine Adresse wie `https://imposter-xxxx.onrender.com` – diese Adresse an alle schicken.

Hinweis: Der kostenlose Plan schläft nach 15 Minuten ohne Besucher ein. Der erste Aufruf danach dauert bis zu einer Minute.

## Wer bin ich?

**Pass & Play**
1. Spieler eintragen (ab 2 Spielern).
2. **Personen ausdenken:** Reihum bekommt ein Spieler das Gerät und denkt sich eine Person für einen anderen Spieler aus (der darf nicht hinschauen). Mit „Vorschlag“ gibt es eine zufällige Person aus den Kategorien Musiker, Schauspieler, Politiker, Geschichte und Streamer.
3. **Personen zeigen:** Reihum hält jeder das Gerät mit dem Bildschirm zu den anderen und tippt blind auf das Feld – alle sehen seine Person, nur er nicht. Nochmal tippen verdeckt sie wieder.
4. **Spielrunde:** Für jeden Spieler gibt es ein Feld. Wer dran ist, stellt laut Ja/Nein-Fragen. Bei „Ja“ darf er weiterfragen, bei „Nein“ tippt er auf „Nächster“. Im Textfeld kann er seine Person raten: richtig = geschafft (mit Platzierung), falsch = der Nächste ist dran. Hat jemand eine Person vergessen, tippt man auf das Feld des Spielers.

**Online**
- Keine Aufdeck-Phase: Jeder sieht dauerhaft die Personen aller anderen, nur die eigene nicht.
- Jeder denkt sich auf seinem Gerät eine Person für einen anderen Spieler aus. Der Host kann fehlende Personen zufällig vergeben.
- Wer dran ist, **schreibt seine Frage auf**. Die anderen stimmen mit **Ja**, **Nein** oder **Enthaltung** ab. Enthaltungen zählen nicht; gibt es mehr Ja- als Nein-Stimmen, lautet die Antwort „Ja“ und man darf weiterfragen. Bei mehr Nein-Stimmen oder Gleichstand ist der Nächste dran.
- Unter dem eigenen Profil steht ein Textfeld zum Raten der eigenen Person.

Beim Raten spielen Groß-/Kleinschreibung, Umlaute und kleine Tippfehler keine Rolle; bei Personen reicht auch der Nachname. Das Spiel endet, wenn höchstens noch ein Spieler seine Person nicht erraten hat.

## SPIEGEL (2 Spieler)

- Jeder hat die Karten **1–9**, einen **Fallenjoker** und **2 Lügenjoker**. Jede Karte kann nur einmal gelegt werden – eine Karte bleibt am Ende übrig.
- **Vor dem Spiel** stellt jeder eine **Falle**: eine Karte des Gegners und eine Rundenspanne von höchstens 3 Runden. Spielt der Gegner die Karte in der Spanne, gibt es Punkte: 3 Runden = 3, 2 Runden = 6, 1 Runde = 9.
- Es gibt **8 Runden**, die Rollen wechseln jede Runde.
- Wer zuerst legt, wählt verdeckt eine Karte und nennt **3 Zahlen** („meine Karte ist eine davon“). Ist die Karte nicht dabei, ist es eine **Lüge** – das erkennt das Spiel automatisch.
- Der andere kann den **Lügenjoker** einschalten und legt dann seine Karte. Beide Karten werden aufgedeckt.
- **Karten:** Differenz ≥ 2 → die höhere Karte gewinnt ihren Wert. Differenz 1 → die niedrigere Karte gewinnt die Summe beider Karten. Gleiche Karten → keine Punkte.
- **Lügenjoker richtig:** Der Lügner bekommt in dieser Runde **0 Punkte** (auch keine Fallenpunkte), der Entlarver **+2**.
- **Lügenjoker falsch:** **−2** für den, der ihn eingesetzt hat.
- **Unentdeckte Lüge:** **+2**, solange der Gegner noch Lügenjoker hat.
- **Spielende:** Jeder ungenutzte Lügenjoker kostet **−1**. Danach gewinnt, wer mehr Punkte hat. Der Endbildschirm zeigt groß den Punktestand und darunter das Rundenlog.
- **Pass & Play:** Das Gerät wird vor jedem geheimen Zug übergeben (Falle stellen, Karte legen, Joker-Entscheidung). Das Aufdecken sehen beide.
- Die Wertung steht in `spiegel-rules.js` und wird von Pass & Play und vom Server gemeinsam benutzt.

## Stadt Land Fluss (nur online, 1–20 Spieler)

- **Lobby:** Der Host legt die Kategorien fest (Vorgabe: Stadt, Land, Fluss, Name, Tier, Beruf – eigene lassen sich eintippen, bis zu 12), die Zeit pro Runde (ohne Timer oder 1–5 Minuten) und die Rundenzahl (1–20). Alle sehen die Einstellungen.
- **Schreiben:** Jede Runde gibt es einen zufälligen Anfangsbuchstaben (ohne Q, X, Y). Jeder füllt auf seinem Gerät für jede Kategorie ein Feld aus. „Fertig“ geht erst, wenn jedes Feld mindestens 2 Zeichen hat. Wer fertig ist, kann noch einmal ändern, solange die Runde läuft.
- Die Runde endet, wenn **alle fertig** sind oder der **Timer abläuft** – dann wird gewertet, was bis dahin eingetippt ist. Der Host kann die Runde auch vorzeitig beenden.
- **Auswertung:** Unter jeder Kategorie stehen die Antworten aller Spieler. Jeder stimmt bei den Antworten der anderen mit **gültig** oder **ungültig** ab; ungültig ist eine Antwort, wenn mehr Stimmen dagegen als dafür sind.
- Gleiche Antworten erkennt das Spiel automatisch – auch mit Groß-/Kleinschreibung, Umlauten und kleinen Tippfehlern. Der Host kann mit **Gleichsetzen** weitere Antworten als gleich werten oder mit **Trennen** eine automatische Zuordnung aufheben.
- **Punkte:** als Einziger eine gültige Antwort in der Kategorie = **20**, eine Antwort, die kein anderer hat = **10**, gleiche Antwort wie ein anderer = **5**, ungültig oder leer = 0. Die Punkte werden schon während der Auswertung angezeigt.
- Nach jeder Runde gibt es einen **Punktestand** mit Rundentabelle; nach der letzten Runde den Endstand.

## Kritzeln (nur online, 2–20 Spieler)

- Reihum zeichnet jeder einmal pro Runde. Der Zeichner wählt eines von 3 Wörtern (nach 15 Sekunden wird automatisch gewählt), die anderen raten im Chat.
- **Einstellungen des Hosts:** Schwierigkeit der Begriffe (einfach, mittel, schwer, sehr schwer – auch mehrere gleichzeitig), Tipps (keine, wenig, mittel, viel), Zeichenzeit (60–150 Sekunden) und Rundenzahl (1–10).
- **Tipps:** Rater sehen das Wort als Lücken. Im Laufe der Zeit werden einzelne Buchstaben aufgedeckt, gleichmäßig verteilt zwischen 30 % und 90 % der Zeichenzeit. Die Anzahl hängt von der Wortlänge ab (wenig ≈ 15 %, mittel ≈ 30 %, viel ≈ 45 % der Buchstaben, mindestens 1, höchstens die Hälfte) – ein Wort mit 2 Buchstaben bekommt also auch bei „viel“ nur einen Tipp, eines mit 20 Buchstaben bekommt 9.
- **Mehrere Schwierigkeiten:** Für jeden der drei Vorschläge wird zuerst eine der gewählten Stufen ausgelost – alle gleich wahrscheinlich, unabhängig davon, wie viele Begriffe eine Stufe hat – und dann ein Begriff daraus. Es können also auch alle drei aus derselben Stufe kommen. Aus welcher Stufe ein Vorschlag stammt, wird nicht angezeigt.
- **Schwierigkeit:** Jeder Begriff hat drei Noten von 1 bis 5 – wie schwer er zu zeichnen ist, wie unbekannt er ist und wie schwer er zu buchstabieren ist. Wertung: Zeichnen × 3 + Bekanntheit × 1 + Buchstabieren × 0,5. Bis 8 Punkte = einfach, bis 11 = mittel, bis 14,5 = schwer, darüber = sehr schwer. Die Noten stehen in `draw-words.js` und lassen sich dort anpassen. „Knapp daneben“ sieht nur der Rater selbst. Wer das Wort erraten hat, schreibt danach nur noch für andere, die es auch kennen.
- **Punkte:** 50 bis 200 für richtiges Raten – je schneller, desto mehr. Der Zeichner bekommt 50 Punkte pro richtigem Rater. Der Zug endet, wenn alle erraten haben oder die Zeit abläuft.
- **Zeichenfeld:** Stift mit 18 Farben und 4 Stärken, Radierer, Füllen, Rückgängig und Leeren. Die Zeichnung wird live an alle übertragen und sieht auf jedem Gerät gleich aus; wer neu lädt, bekommt sie vollständig.
- **Apple Pencil:** Die Strichstärke folgt dem Druck. Es wird immer nur ein Strich gleichzeitig gezeichnet; sobald der Stift erkannt wurde, werden Finger und Handballen ignoriert. Setzt der Handballen vor dem Stift auf, wird dieser Strich wieder entfernt.
- **Zoom:** Beim Zeichner wird ein bestehender Zoom zurückgesetzt und Zwei-Finger- sowie Doppeltipp-Zoom gesperrt, solange er zeichnet. Danach ist Zoomen wieder möglich.
- Die Wortliste (749 Begriffe: 278 einfach, 120 mittel, 171 schwer, 180 sehr schwer) steht in `draw-words.js` und liegt nur auf dem Server.

## Kategorien (Verräter)

20 Kategorien mit insgesamt 1.460 Begriffen, jeweils **leicht**, **mittel** und **schwer** (oder gemischt bzw. zufällige Kategorie):

Länder · Städte · Automarken · Historische Persönlichkeiten · Politiker · Schauspieler · Musiker & Bands · Deutsche Streamer · Obst & Gemüse · Tiere · Fußballer · Sportler (ohne Fußball) · Sehenswürdigkeiten · Berufe · Modemarken · Lebensmittelmarken · Techmarken · Firmen · Filme & Serien · Animes

Eigene Begriffe lassen sich in `words.js` ergänzen – Browser und Server benutzen dieselbe Datei.

### Hinweis für den Verräter

Wenn die Einstellung „Verräter bekommt einen vagen Hinweis“ an ist, sieht der Verräter auf seiner Rollenkarte ein Stichwort zum Begriff, zum Beispiel *Linksverkehr* bei Großbritannien. Der Hinweis passt absichtlich auch zu mehreren anderen Begriffen der Kategorie. Er nennt nie das bekannteste Merkmal, keinen Slogan, kein Logo und keinen Namensteil. Am Ende der Runde sehen alle, welcher Hinweis es war.

Die Hinweise stehen in `verraeter-hints.js` (Schlüssel: Kategorie-ID und angezeigter Begriff). Online kennt sie nur der Server: Er schickt den Hinweis allein an die Verräter, sonst ließe sich der Begriff in der Liste nachschlagen. Bei Pass & Play wird die Datei erst beim Spielstart nachgeladen. Ein neuer Begriff in `words.js` braucht dort auch einen Hinweis, sonst spielt der Verräter ohne.
