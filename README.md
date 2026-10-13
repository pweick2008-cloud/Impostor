# 🕵️ Imposter – Partyspiel

Im Hauptmenü wählst du zwischen zwei Modi:

- **📱 Pass & Play** – ein Gerät für alle, wird reihum weitergegeben. Funktioniert auch offline: einfach `index.html` im Browser öffnen.
- **🌐 Online** – jeder spielt auf seinem eigenen Gerät in einer gemeinsamen Lobby. Dafür muss der kleine Server (`server.js`) laufen, siehe unten.

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

## Online-Modus

- Einer erstellt eine **Lobby** und ist Host. Die anderen treten mit dem **4-stelligen Code** oder über den **Einladungslink** bei.
- Nur der Host ändert die Einstellungen und startet das Spiel. Er kann außerdem Spieler entfernen, einen abwesenden Spieler überspringen, eine Abstimmung vorzeitig auswerten oder abbrechen und das Spiel beenden.
- Jeder sieht **nur seine eigene Rolle**. Der Server kennt alle Rollen und den Begriff und schickt jedem Gerät nur, was es sehen darf. Das Feld „Begriff raten“ erscheint nur bei Impostern.
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

## Kategorien
Länder · Historische Persönlichkeiten · Promis · Deutsche Streamer · Obst & Gemüse (oder zufällig) – jeweils in **leicht**, **mittel**, **schwer** oder **gemischt**.

Eigene Begriffe lassen sich in `words.js` ergänzen.
