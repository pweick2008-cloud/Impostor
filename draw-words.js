"use strict";

// Begriffe für „Kritzeln“ – gut zeichenbar, gemischt von leicht bis knifflig.
// Liegt nur auf dem Server, damit niemand die Wörter vorher sehen kann.
const DRAW_WORDS = [
  // Tiere
  "Hund", "Katze", "Maus", "Elefant", "Giraffe", "Löwe", "Tiger", "Zebra", "Pinguin", "Eule",
  "Schlange", "Krokodil", "Schildkröte", "Frosch", "Schnecke", "Spinne", "Biene", "Schmetterling", "Ameise", "Marienkäfer",
  "Fisch", "Hai", "Wal", "Delfin", "Krake", "Krabbe", "Seestern", "Qualle", "Pferd", "Kuh",
  "Schwein", "Schaf", "Ziege", "Huhn", "Ente", "Hase", "Igel", "Eichhörnchen", "Fuchs", "Bär",
  "Affe", "Känguru", "Kamel", "Nashorn", "Flamingo", "Papagei", "Fledermaus", "Einhorn", "Drache", "Dinosaurier",
  // Essen & Trinken
  "Apfel", "Banane", "Erdbeere", "Kirsche", "Zitrone", "Ananas", "Wassermelone", "Karotte", "Brokkoli", "Pilz",
  "Pizza", "Burger", "Pommes", "Hotdog", "Brezel", "Croissant", "Torte", "Muffin", "Donut", "Eis",
  "Lolli", "Schokolade", "Popcorn", "Spiegelei", "Käse", "Sandwich", "Spaghetti", "Sushi", "Taco", "Kaffee",
  "Tee", "Milch", "Saft", "Honig", "Brot",
  // Haushalt & Gegenstände
  "Stuhl", "Tisch", "Bett", "Sofa", "Lampe", "Uhr", "Wecker", "Spiegel", "Tür", "Fenster",
  "Schlüssel", "Schloss", "Kerze", "Glühbirne", "Regenschirm", "Brille", "Hut", "Krone", "Schal", "Handschuh",
  "Socke", "Schuh", "Stiefel", "Hose", "Kleid", "Rucksack", "Koffer", "Geldbeutel", "Ring", "Kette",
  "Zahnbürste", "Kamm", "Schere", "Messer", "Gabel", "Löffel", "Teller", "Tasse", "Flasche", "Kochtopf",
  "Pfanne", "Besen", "Eimer", "Leiter", "Hammer", "Säge", "Schraube", "Nagel", "Bleistift", "Radiergummi",
  "Buch", "Brief", "Briefmarke", "Kalender", "Pinsel", "Farbeimer", "Kühlschrank", "Waschmaschine", "Toaster", "Staubsauger",
  "Fernseher", "Handy", "Laptop", "Tastatur", "Kopfhörer", "Kamera", "Batterie", "Steckdose", "Magnet", "Kompass",
  "Fernglas", "Lupe", "Sanduhr", "Thermometer", "Ballon", "Geschenk", "Kerzenständer", "Vase", "Blumentopf", "Gießkanne",
  // Natur & Wetter
  "Sonne", "Mond", "Stern", "Wolke", "Regen", "Schnee", "Blitz", "Regenbogen", "Tornado", "Vulkan",
  "Berg", "Insel", "Strand", "Welle", "Wasserfall", "Fluss", "Baum", "Palme", "Kaktus", "Blume",
  "Rose", "Sonnenblume", "Blatt", "Tannenzapfen", "Feuer", "Höhle", "Wüste", "Eisberg", "Komet", "Planet",
  // Fahrzeuge & Orte
  "Auto", "Bus", "Zug", "Fahrrad", "Motorrad", "Roller", "Flugzeug", "Hubschrauber", "Rakete", "Schiff",
  "Boot", "U-Boot", "Traktor", "Feuerwehrauto", "Krankenwagen", "Polizeiauto", "Taxi", "Bagger", "Heißluftballon", "Skateboard",
  "Haus", "Schloss", "Kirche", "Leuchtturm", "Brücke", "Turm", "Zelt", "Iglu", "Burg", "Mühle",
  "Ampel", "Tankstelle", "Spielplatz", "Rutsche", "Schaukel", "Achterbahn", "Riesenrad", "Bahnhof", "Flughafen", "Zoo",
  // Sport & Freizeit
  "Fußball", "Tor", "Basketball", "Tennisschläger", "Golf", "Bowling", "Schlittschuh", "Ski", "Surfbrett", "Angel",
  "Hantel", "Medaille", "Pokal", "Trommel", "Gitarre", "Klavier", "Geige", "Trompete", "Mikrofon", "Würfel",
  "Schach", "Puzzle", "Drachen", "Seifenblase", "Sandburg", "Schneemann", "Lagerfeuer", "Picknick", "Karussell", "Zauberer",
  // Menschen & Fantasie
  "Pirat", "Ritter", "Prinzessin", "Hexe", "Geist", "Vampir", "Roboter", "Alien", "Superheld", "Clown",
  "Astronaut", "Koch", "Arzt", "Feuerwehrmann", "Polizist", "Maler", "Taucher", "Cowboy", "Ninja", "Mumie",
  "Engel", "Teufel", "Zwerg", "Riese", "Meerjungfrau", "Weihnachtsmann", "Osterhase", "Schneeflocke", "Herz", "Lächeln",
  // Körper & Sonstiges
  "Auge", "Nase", "Mund", "Ohr", "Hand", "Fuß", "Zahn", "Knochen", "Skelett", "Gehirn",
  "Fingerabdruck", "Pflaster", "Spritze", "Tablette", "Fahne", "Karte", "Schatz", "Anker", "Ufo", "Zauberstab",
  "Glocke", "Pfeil", "Bogen", "Schwert", "Schild", "Kanone", "Bombe", "Falle", "Labyrinth", "Treppe"
];

if (typeof module !== "undefined") module.exports = { DRAW_WORDS: [...new Set(DRAW_WORDS)] };
