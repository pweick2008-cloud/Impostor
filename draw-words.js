"use strict";

/* =========================================================
   Begriffe für „Kritzeln“ mit Schwierigkeitsbewertung
   Jeder Eintrag: "Wort:ZBS" – drei Noten von 1 (leicht) bis 5 (schwer):
     Z = wie schwer es zu zeichnen ist
     B = wie unbekannt der Begriff ist (1 = kennt jeder)
     S = wie schwer es zu buchstabieren ist
   Wertung: Z × 3 + B × 1 + S × 0,5  (ergibt 4,5 bis 22,5)
     einfach      bis 8
     mittel       bis 11
     schwer       bis 14,5
     sehr schwer  darüber
   Liegt nur auf dem Server, damit niemand die Wörter vorher sehen kann.
   ========================================================= */
const RATED = `
Sonne:111 Mond:111 Stern:111 Herz:111 Ball:111 Haus:111 Baum:111 Blume:111 Apfel:111 Birne:111
Banane:111 Kirsche:111 Fisch:111 Ei:111 Auge:111 Nase:111 Mund:111 Ohr:111 Hand:111 Fuß:112
Zahn:111 Wolke:111 Regen:111 Regenbogen:112 Schneemann:112 Schnee:111 Blitz:111 Feuer:111 Berg:111 Insel:111
Welle:111 Brille:111 Hut:111 Krone:111 Ring:111 Schlüssel:112 Tür:111 Fenster:111 Tisch:111 Stuhl:111
Bett:111 Lampe:111 Uhr:111 Tasse:111 Teller:111 Löffel:112 Gabel:111 Messer:111 Flasche:111 Glas:111
Kerze:111 Ballon:112 Geschenk:112 Buch:111 Brief:111 Stift:111 Schere:111 Auto:111 Bus:111 Zug:111
Boot:111 Schiff:111 Fahrrad:211 Rakete:111 Flugzeug:211 Ampel:111 Leiter:111 Treppe:111 Brücke:211 Zelt:111
Fahne:111 Pfeil:111 Würfel:111 Dreieck:112 Pilz:111 Blatt:111 Kaktus:111 Palme:111 Gras:111 Karotte:111
Tomate:111 Erdbeere:211 Zitrone:111 Melone:111 Ananas:211 Eis:111 Lolli:111 Torte:111 Pizza:111 Pommes:111
Donut:111 Brot:111 Käse:111 Keks:111 Wurst:111 Bonbon:112 Maus:211 Schlange:111 Schnecke:111 Wurm:111
Spinne:211 Biene:211 Igel:211 Ente:211 Katze:211 Hund:211 Schwein:211 Huhn:211 Hase:211 Frosch:211
Raupe:211 Marienkäfer:212 Schildkröte:212 Socke:111 Schuh:111 Hose:111 T-Shirt:112 Kleid:111 Mütze:111 Schal:111
Handschuh:212 Regenschirm:212 Koffer:111 Rucksack:212 Tasche:111 Gitarre:212 Trommel:111 Glocke:111 Telefon:211 Handy:111
Fernseher:211 Computer:212 Kamera:211 Zahnbürste:212 Kamm:111 Seife:111 Badewanne:211 Toilette:212 Dusche:211 Spiegel:111
Sofa:111 Kissen:111 Vase:111 Topf:111 Pfanne:111 Eimer:111 Besen:111 Hammer:111 Nagel:111 Schraube:111
Säge:111 Anker:111 Schwert:111 Schild:111 Bogen:111 Kanone:211 Burg:211 Turm:111 Kirche:211 Iglu:111
Pyramide:112 Fußball:111 Tor:111 Seil:111 Kette:111 Knopf:111 Nadel:111 Gesicht:111 Skelett:212 Geist:111
Monster:211 Roboter:211 Alien:211 Ufo:111 Clown:211 König:211 Pirat:211 Engel:211 Hexe:211 Ritter:211
Baby:111 Zebra:211 Schaf:211 Hai:211 Wal:211 Seestern:211 Ameise:211 Osterhase:212 Schneeflocke:212 Taxi:211
U-Boot:211 Roller:211 Leuchtturm:212 Schaukel:211 Rutsche:211 Sandburg:211 Lagerfeuer:212 Kühlschrank:212 Toaster:211 Laptop:211
Tastatur:212 Kopfhörer:212 Batterie:212 Steckdose:212 Glühbirne:212 Magnet:211 Fernglas:212 Lupe:211 Sanduhr:211 Gießkanne:212
Blumentopf:212 Briefmarke:212 Kalender:211 Pinsel:211 Puzzle:212 Pokal:211 Mikrofon:212 Ski:211 Surfbrett:212 Angel:211
Zauberstab:212 Schatztruhe:212 Kerzenständer:212 Wecker:211 Kochtopf:211 Hotdog:212 Burger:211 Brezel:211 Muffin:211 Popcorn:211
Spiegelei:211 Paprika:211 Gurke:211 Kürbis:211 Mais:211 Zwiebel:212 Avocado:212 Kokosnuss:212 Brokkoli:212 Honig:211
Milch:211 Kaffee:212 Vulkan:211 Wasserfall:212 Tornado:211 Höhle:211 Eisberg:211 Komet:211 Planet:211 Rose:211
Tulpe:211 Sonnenblume:212 Tannenbaum:212 Kleeblatt:212 Pflaster:212 Spritze:211 Tablette:211 Knochen:211 Muschel:211 Perle:211
Windrad:211 Tropfen:111 Feder:111 Pfote:111 Kreuz:111 Zaun:111 Tunnel:211 Straße:211 Mauer:111 Kuchen:111

Elefant:311 Giraffe:311 Löwe:311 Tiger:311 Pinguin:311 Eule:311 Krokodil:312 Pferd:311 Kuh:311 Ziege:311
Affe:311 Bär:311 Fuchs:311 Känguru:312 Kamel:311 Nashorn:312 Flamingo:312 Papagei:312 Fledermaus:312 Delfin:311
Krake:311 Qualle:311 Krabbe:311 Schmetterling:213 Einhorn:311 Drache:311 Vampir:311 Mumie:311 Zwerg:311 Riese:311
Krankenwagen:312 Polizeiauto:312 Bagger:311 Traktor:311 Hubschrauber:312 Heißluftballon:213 Motorrad:311 Skateboard:213 Achterbahn:312 Riesenrad:312
Spielplatz:312 Tankstelle:312 Flughafen:312 Bauernhof:312 Schule:311 Krankenhaus:312 Staubsauger:312 Mikrowelle:312 Radiergummi:213 Palette:221
Medaille:222 Hantel:221 Trompete:312 Geige:311 Klavier:312 Tennisschläger:213 Schneebesen:222 Nudelholz:221 Spaghetti:213 Sushi:221
Croissant:223 Sandwich:213 Taco:221 Knoblauch:222 Wassermelone:213 Wüste:311 Saturn:221 Tannenzapfen:213 Gehirn:311 Arzt:311
Koch:311 Polizist:312 Maler:311 Taucher:311 Astronaut:312 Cowboy:312 Ninja:311 Superheld:312 Sänger:311 Tänzerin:312
Bauarbeiter:312 Winter:311 Sommer:311 Frühling:312 Herbst:311 Panda:311 Wolf:311 Windmühle:312 Zahnpasta:312 Zahnarzt:312
Gewitter:311 Hochhaus:311 Gartenschlauch:313 Schornstein:312 Briefkasten:312 Mülleimer:312 Kinderwagen:312 Einkaufswagen:312 Waschbecken:312
Duschkopf:312 Bilderrahmen:312 Wäscheleine:312 Fußabtreter:313 Kleiderbügel:312 Haarbürste:312 Stoppuhr:221 Papierflieger:313 Wasserpistole:313 Seifenblase:312
Schneeball:211 Schlitten:311 Weihnachtsbaum:213 Adventskranz:322 Osterei:212 Kürbislaterne:313 Feuerwerk:312 Luftballon:212 Konfetti:221 Piñata:232
Zauberhut:212 Kristallkugel:322 Besenstiel:212 Hexenhut:212 Spinnennetz:212 Fischgräte:222 Vogelnest:312 Bienenstock:312 Ameisenhaufen:313 Maulwurf:312
Wellensittich:313 Goldfisch:211 Hamster:311 Meerschweinchen:313 Dackel:312 Pudel:311 Hahn:311 Gans:311 Storch:321 Schwan:311

Eichhörnchen:313 Hummer:321 Dinosaurier:313 Meerjungfrau:313 Weihnachtsmann:313 Feuerwehrauto:313 Karussell:313 Picknick:313 Bahnhof:321 Bäckerei:322
Waschmaschine:313 Kompass:321 Thermometer:313 Schach:322 Saxophon:323 Harfe:321 Bowling:322 Schlittschuh:313 Fingerabdruck:313 Feuerwehrmann:313
Detektiv:322 Fußballspieler:313 Stethoskop:334 Mikroskop:323 Teleskop:322 Satellit:323 Staudamm:331 Zahnrad:321 Kettensäge:322 Bohrmaschine:322
Werkzeugkasten:323 Zirkus:321 Theater:331 Museum:331 Bibliothek:333 Gefängnis:322 Rathaus:331 Friedhof:321 Supermarkt:322 Kino:321
Schwimmbad:322 Labyrinth:324 Hängematte:323 Kronleuchter:333 Kamin:321 Wasserhahn:322 Ventilator:323 Klimaanlage:323 Rollstuhl:321 Krücke:321
Fallschirm:322 Zeppelin:333 Seilbahn:322 Gondel:331 Straßenbahn:323 Kreisverkehr:323 Zebrastreifen:322 Baustelle:321 Wolkenkratzer:323 Freiheitsstatue:324
Eiffelturm:322 Chamäleon:335 Gürteltier:332 Faultier:321 Seepferdchen:323 Pfau:321 Tukan:331 Pelikan:331 Koala:321 Waschbär:322
Biber:321 Ameisenbär:332 Nilpferd:322 Elch:321 Hirsch:321 Skorpion:322 Libelle:322 Mücke:321 Schreibmaschine:323 Plattenspieler:323
Kassette:322 Joystick:322 Fernbedienung:323 Drucker:321 USB-Stick:323 Ladekabel:322 Rasenmäher:322 Gartenzwerg:322 Vogelscheuche:324 Schubkarre:322
Mistgabel:331 Hufeisen:322 Sattel:331 Kutsche:331 Ritterrüstung:323 Kanu:321 Floß:321 Rettungsring:322 Taucherbrille:323 Schnorchel:333
Flossen:321 Liegestuhl:322 Strandkorb:332 Sandale:321 Krawatte:322 Perücke:333 Lippenstift:322 Nagellack:322 Föhn:322 Rasierer:322
Wäscheklammer:323 Bügeleisen:323 Nähmaschine:333 Wollknäuel:323 Stricknadel:333 Fingerhut:342 Lasagne:323 Döner:321 Burrito:332 Pfannkuchen:322
Waffel:321 Zuckerwatte:323 Lebkuchen:322 Müsli:332 Rührei:322 Schaschlik:334 Taschenrechner:323 Sternschnuppe:323 Schiedsrichter:333 Elfmeter:333
Werwolf:332 Kuckucksuhr:334 Pendeluhr:332 Dampflok:332 Kran:321 Einrad:331 Selfie:321 Graffiti:333 Turm von Pisa:323 Mount Everest:323
Glück:421 Angst:421 Mut:421 Schatten:421 Fieber:421 Flut:421 Nebel:421 Yoga:421 Weltall:411 Musik:411
Liebe:411 Traum:411 Zeit:411 Wind:411 Geburtstag:412 Hochzeit:412 Urlaub:411 Ferien:411 Party:411 Kuss:411

Demokratie:534 Gerechtigkeit:534 Freiheit:422 Freundschaft:423 Eifersucht:534 Langeweile:523 Hoffnung:522 Müdigkeit:523 Schwerkraft:533 Elektrizität:535
Internet:522 Erinnerung:523 Gedanke:523 Zukunft:522 Vergangenheit:523 Geduld:532 Stille:521 Echo:431 Spiegelbild:422 Gänsehaut:423
Schluckauf:424 Kopfschmerzen:423 Lampenfieber:534 Heimweh:533 Déjà-vu:555 Ohrwurm:533 Muskelkater:533 Sonnenfinsternis:434 Polarlicht:442 Fata Morgana:454
Erdbeben:422 Lawine:422 Tsunami:433 Ebbe:431 Mitternacht:422 Sonnenaufgang:423 Morgengrauen:533 Schneesturm:422 Schwarzes Loch:442 Galaxie:433
Atom:442 DNA:441 Magnetfeld:542 Photosynthese:555 Evolution:543 Recycling:434 Klimawandel:533 Inflation:543 Steuern:532 Bürokratie:545
Wahl:432 Parlament:443 Grundgesetz:543 Olympia:432 Weltmeisterschaft:434 Marathon:432 Triathlon:444 Abseits:534 Jongleur:345 Bauchredner:453
Hypnose:443 Origami:443 Karaoke:433 Podcast:433 Hashtag:443 Influencer:434 Algorithmus:555 Passwort:422 Virus:422 Impfung:423
Quarantäne:445 Rezept:422 Diät:422 Allergie:433 Schlafwandler:443 Albtraum:423 Tagtraum:533 Telepathie:555 Zeitreise:432 Paralleluniversum:555
Wurmloch:542 Archäologe:445 Paläontologe:555 Astronom:443 Dirigent:443 Bildhauer:443 Notar:542 Diplomat:543 Philosoph:545 Psychologe:545
Hebamme:443 Schornsteinfeger:434 Imker:442 Förster:432 Schmied:432 Zahnfee:432 Kobold:432 Sphinx:445 Minotaurus:455 Zyklop:444
Phönix:445 Pegasus:443 Medusa:443 Zentaur:444 Akkordeon:435 Dudelsack:443 Xylophon:435 Stimmgabel:443 Metronom:444 Tuba:432
Oboe:452 Kontrabass:433 Mundharmonika:434 Tamburin:434 Panflöte:443 Sextant:554 Astrolabium:555 Abakus:443 Rechenschieber:453 Lötkolben:453
Schraubstock:443 Flaschenzug:443 Wasserwaage:433 Maßband:432 Periskop:444 Seismograph:555 Barometer:444 Hygrometer:555 Spinnrad:442 Webstuhl:442
Töpferscheibe:443 Druckerpresse:443 Dampfmaschine:443 Gabelstapler:433 Mähdrescher:443 Planierraupe:443 Betonmischer:433 Müllabfuhr:432 Containerschiff:433 Flugzeugträger:433
Katamaran:444 Gleitschirm:432 Hovercraft:455 Segway:443 Tandem:442 Rikscha:454 Sessellift:432 Sumo:442 Fechten:442 Curling:452
Kricket:452 Bogenschießen:433 Stabhochsprung:434 Synchronschwimmen:445 Breakdance:443 Ballett:422 Meditation:533 Pantomime:443 Bermudadreieck:454 Atlantis:443
Venedig:422 Hollywood:432 Chinesische Mauer:424 Kolosseum:434 Taj Mahal:444 Mondlandung:432 Titanic:422 Router:422 Solarzelle:433 Sonnencreme:423
Parfüm:423 Kaugummi:422 Smoothie:433 Korallenriff:423 Schnabeltier:443 Stachelrochen:443 Stonehenge:434 Gewissen:533 Neugier:532 Sehnsucht:533
`;

const LEVELS = ["einfach", "mittel", "schwer", "sehrschwer"];
const LEVEL_NAMES = { einfach: "Einfach", mittel: "Mittel", schwer: "Schwer", sehrschwer: "Sehr schwer" };

// Gewichtung: Zeichnen dreifach, Bekanntheit einfach, Buchstabieren halb
function drawScore(z, b, s) {
  return z * 3 + b + s * 0.5;
}

function levelOf(score) {
  if (score <= 8) return "einfach";
  if (score <= 11) return "mittel";
  if (score <= 14.5) return "schwer";
  return "sehrschwer";
}

const DRAW_WORDS = [];
const seen = new Set();
// Einträge "Name:ZBS"; Namen dürfen Leerzeichen und Bindestriche enthalten
for (const m of RATED.matchAll(/([^\s:\d][^:\d]*?):([1-5])([1-5])([1-5])(?!\d)/g)) {
  const word = m[1].trim();
  if (seen.has(word.toLowerCase())) continue; // doppelte Einträge ignorieren
  seen.add(word.toLowerCase());
  const [z, b, s] = [Number(m[2]), Number(m[3]), Number(m[4])];
  const score = drawScore(z, b, s);
  DRAW_WORDS.push({ word, z, b, s, score, level: levelOf(score) });
}

const DRAW_POOLS = Object.fromEntries(LEVELS.map((l) => [l, DRAW_WORDS.filter((w) => w.level === l).map((w) => w.word)]));

if (typeof module !== "undefined") {
  module.exports = { DRAW_WORDS, DRAW_POOLS, LEVELS, LEVEL_NAMES, drawScore, levelOf };
}
