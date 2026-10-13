# 🕵️ Imposter – Partyspiel für ein Gerät

Einfach `index.html` im Browser öffnen (Handy, Tablet oder PC) – keine Installation nötig.

## Ablauf
Das Spiel läuft in drei Phasen (oben als Fortschrittsanzeige sichtbar). Zwischen den Phasen erscheint jeweils ein animierter Übergangsbildschirm.

1. **Start:** Spieleranzahl (3–20) und Namen, Anzahl der Imposter, Kategorie und Schwierigkeit wählen.
2. **Rollen verteilen:** Ein zufälliger Spielername wird angezeigt. Dieser Spieler nimmt das Gerät, tippt auf seinen Namen und sieht seine Rolle (Begriff oder „IMPOSTER“). Erneut tippen → nächster Spieler.
3. **Spielrunde** (Tipps, Votes und Ergebnis auf einer Seite):
   - Jeder Spieler hat ein Profil, auf dem seine Tipps stehen. Reihum gibt der Spieler, der am Zug ist, einen Tipp ins Textfeld ein.
   - Erst wenn alle einen Tipp abgegeben haben, erscheint die **Abstimmung**. Ab dann kann jederzeit ein Vote gestartet werden.
   - Beim Vote wird das Gerät reihum weitergegeben; jeder wählt geheim einen Spieler oder enthält sich. Raus ist, wer allein die meisten Stimmen hat und mehr Stimmen als Enthaltungen bekommt.
   - Nach einem Vote muss wieder jeder einen Tipp abgeben, bevor der nächste Vote möglich ist – auch wenn der Vote mitten in einer Runde gestartet wurde (dann geht es weiter, bis derjenige wieder dran ist).
   - Wird ein unschuldiger Spieler rausgewählt, gewinnen die Imposter. Sind alle Imposter raus, gewinnen die Spieler.
   - **Imposter können jederzeit den Begriff raten** (Name wählen + Begriff eingeben). Richtig = gewonnen, falsch = verloren, ausgeschieden ist man in jedem Fall. Die anderen erfahren den Begriff nicht. Ist er der einzige (verbleibende) Imposter, entscheidet sein Tipp das ganze Spiel.
   - Am Ende erscheint das Ergebnis direkt auf derselben Seite, inklusive Begriff und aufgedeckter Rollen.

Beim Raten werden Groß-/Kleinschreibung, Umlaute, kleine Tippfehler und alternative Namen (z. B. „USA“/„Amerika“, bei Personen auch der Nachname) toleriert.

## Kategorien
Länder · Historische Persönlichkeiten · Promis · Deutsche Streamer · Obst & Gemüse (oder zufällig) – jeweils in **leicht**, **mittel**, **schwer** oder **gemischt**.

Eigene Begriffe lassen sich in `words.js` ergänzen.
