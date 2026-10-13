// Begriffe je Überkategorie und Schwierigkeit.
// Alternative Schreibweisen werden mit "|" getrennt – der erste Eintrag wird angezeigt,
// alle weiteren werden beim Raten des Imposters ebenfalls als richtig akzeptiert.
// "person: true" bedeutet: beim Raten reicht auch der Nachname (z. B. "Einstein").

const CATEGORIES = {
  laender: {
    name: "Länder",
    icon: "🌍",
    words: {
      leicht: [
        "Deutschland", "Frankreich", "Italien", "Spanien", "USA|Vereinigte Staaten|Amerika|Vereinigte Staaten von Amerika",
        "Großbritannien|England|Vereinigtes Königreich|UK", "China", "Japan", "Russland", "Brasilien",
        "Österreich", "Schweiz", "Türkei", "Griechenland", "Kanada", "Australien", "Mexiko",
        "Ägypten", "Indien", "Niederlande|Holland", "Polen", "Portugal"
      ],
      mittel: [
        "Thailand", "Argentinien", "Schweden", "Norwegen", "Dänemark", "Finnland", "Irland",
        "Kroatien", "Marokko", "Südafrika", "Kenia", "Peru", "Chile", "Kolumbien", "Vietnam",
        "Indonesien", "Südkorea|Korea", "Neuseeland", "Ungarn", "Tschechien|Tschechische Republik",
        "Island", "Kuba", "Jamaika", "Philippinen", "Saudi-Arabien", "Israel", "Iran", "Belgien"
      ],
      schwer: [
        "Burkina Faso", "Bhutan", "Kirgisistan", "Tadschikistan", "Turkmenistan", "Usbekistan",
        "Eswatini|Swasiland", "Lesotho", "Dschibuti", "Eritrea", "Malawi", "Burundi", "Suriname",
        "Guyana", "Paraguay", "Moldau|Moldawien|Republik Moldau", "Liechtenstein", "Andorra",
        "San Marino", "Brunei", "Laos", "Myanmar|Birma", "Mauretanien", "Tuvalu", "Vanuatu",
        "Palau", "Kiribati", "Nauru", "Tschad", "Benin", "Togo", "Gabun", "Montenegro",
        "Nordmazedonien|Mazedonien"
      ]
    }
  },

  geschichte: {
    name: "Historische Persönlichkeiten",
    icon: "📜",
    person: true,
    words: {
      leicht: [
        "Albert Einstein", "Napoleon|Napoleon Bonaparte", "Julius Caesar|Caesar|Cäsar", "Kleopatra|Cleopatra",
        "Martin Luther", "Johann Wolfgang von Goethe|Goethe", "Ludwig van Beethoven|Beethoven",
        "Wolfgang Amadeus Mozart|Mozart", "Christoph Kolumbus|Kolumbus", "Leonardo da Vinci|Da Vinci",
        "Abraham Lincoln", "Martin Luther King", "Mahatma Gandhi|Gandhi", "Isaac Newton",
        "Otto von Bismarck|Bismarck", "Karl der Große|Karl der Grosse", "Alexander der Große|Alexander der Grosse",
        "Marie Curie", "William Shakespeare", "Konrad Adenauer", "Queen Elizabeth II.|Queen Elizabeth|Elisabeth II."
      ],
      mittel: [
        "Friedrich der Große|Friedrich der Grosse|Der Alte Fritz", "Galileo Galilei|Galilei", "Charles Darwin",
        "Nelson Mandela", "Johann Sebastian Bach|Bach", "Karl Marx", "Sigmund Freud",
        "Dschingis Khan|Genghis Khan", "Marco Polo", "Johannes Gutenberg", "Michelangelo",
        "Winston Churchill", "Che Guevara", "Jeanne d'Arc|Johanna von Orleans", "Sophie Scholl",
        "Willy Brandt", "Marie Antoinette", "Nikola Tesla", "Florence Nightingale", "Ramses II.|Ramses",
        "Tutanchamun", "Thomas Edison"
      ],
      schwer: [
        "Hildegard von Bingen", "Friedrich Barbarossa|Barbarossa", "Kaiserin Sisi|Sisi|Elisabeth von Österreich",
        "Otto der Große|Otto der Grosse", "Hannibal", "Konfuzius", "Sokrates", "Aristoteles",
        "Immanuel Kant", "Ada Lovelace", "Simón Bolívar|Simon Bolivar", "Katharina die Große|Katharina die Grosse",
        "Suleiman der Prächtige|Süleyman", "Alexander von Humboldt", "Albrecht Dürer", "Hammurabi",
        "Nofretete", "Maria Theresia", "Wilhelm II.|Kaiser Wilhelm", "Rosa Luxemburg", "Karl V.",
        "Mustafa Kemal Atatürk|Atatürk", "Attila"
      ]
    }
  },

  promis: {
    name: "Promis",
    icon: "⭐",
    person: true,
    words: {
      leicht: [
        "Helene Fischer", "Thomas Gottschalk", "Dieter Bohlen", "Heidi Klum", "Taylor Swift",
        "Cristiano Ronaldo|Ronaldo", "Lionel Messi", "Beyoncé|Beyonce", "Leonardo DiCaprio|DiCaprio",
        "Elon Musk", "Kim Kardashian", "Justin Bieber", "Rihanna", "Brad Pitt", "Til Schweiger",
        "Stefan Raab", "Jan Böhmermann", "Michael Schumacher", "Thomas Müller", "Lady Gaga", "Ed Sheeran"
      ],
      mittel: [
        "Joko Winterscheidt|Joko", "Klaas Heufer-Umlauf|Klaas", "Barbara Schöneberger", "Sophia Thomalla",
        "Matthias Schweighöfer", "Elyas M'Barek|Elyas MBarek", "Daniela Katzenberger", "Lena Meyer-Landrut|Lena",
        "Mark Forster", "Sido", "Capital Bra", "Apache 207", "Zendaya", "Timothée Chalamet|Timothee Chalamet",
        "Billie Eilish", "Margot Robbie", "Ryan Reynolds", "Dua Lipa", "Harry Styles", "Bad Bunny",
        "Shirin David", "Luke Mockridge", "Florian Silbereisen", "Günther Jauch"
      ],
      schwer: [
        "Nora Tschirner", "Collien Ulmen-Fernandes", "Jürgen von der Lippe", "Hape Kerkeling",
        "Oliver Pocher", "Annette Frier", "Christoph Maria Herbst", "Bastian Pastewka",
        "Florian David Fitz", "Wincent Weiss", "Max Giesinger", "Cro", "Pedro Pascal", "Florence Pugh",
        "Anya Taylor-Joy", "Austin Butler", "Olivia Rodrigo", "Tom Hiddleston", "Cate Blanchett",
        "Riccardo Simonetti", "Sarah Connor", "Yvonne Catterfeld", "Ralf Schmitz", "Kurt Krömer"
      ]
    }
  },

  streamer: {
    name: "Deutsche Streamer",
    icon: "🎮",
    words: {
      leicht: [
        "MontanaBlack|Monte|Montana Black", "Knossi", "Trymacs", "Papaplatte", "HandOfBlood|Hand of Blood",
        "Gronkh", "Rewinside", "Paluten", "EliasN97|Elias", "Reved", "Unge|Ungespielt",
        "Sidneyeweka|Sidney", "Rumathra", "Tanzverbot", "Gamerbrother"
      ],
      mittel: [
        "Staiy", "Mahluna", "NoWay4u|NoWay", "Zarbex", "Dner", "Stegi", "BastiGHG|Basti", "Maxim",
        "PietSmiet", "Zombey", "GermanLetsPlay", "AbuGoku9999|AbuGoku", "Wichtiger", "Ron Bielecki",
        "LetsHugo|Hugo", "Krokoboss", "Bonjwa", "Kayzahr", "Amar", "MckyTV|Mcky"
      ],
      schwer: [
        "Pandorya", "Shurjoka", "Dhalucard", "Lara Loft", "Gnu", "Eligella", "Hänno", "Filow",
        "Erné|Erne", "Tolkin", "Nooreax", "Wakez", "Schradin", "XRanger"
      ]
    }
  },

  essen: {
    name: "Obst & Gemüse",
    icon: "🥕",
    words: {
      leicht: [
        "Apfel", "Banane", "Erdbeere", "Kirsche", "Birne", "Orange|Apfelsine", "Zitrone", "Tomate",
        "Gurke", "Karotte|Möhre|Mohrrübe", "Kartoffel", "Paprika", "Zwiebel", "Weintraube|Traube",
        "Wassermelone|Melone", "Ananas", "Brokkoli|Broccoli", "Salat|Kopfsalat", "Mais", "Pfirsich"
      ],
      mittel: [
        "Mango", "Kiwi", "Zucchini", "Aubergine", "Blumenkohl", "Spinat", "Himbeere",
        "Heidelbeere|Blaubeere", "Granatapfel", "Avocado", "Kokosnuss", "Feige", "Pflaume|Zwetschge",
        "Aprikose|Marille", "Rosenkohl", "Spargel", "Lauch|Porree", "Kürbis", "Radieschen",
        "Sellerie", "Rote Bete|Rote Beete", "Grapefruit", "Kohlrabi"
      ],
      schwer: [
        "Pastinake", "Topinambur", "Mangold", "Romanesco", "Schwarzwurzel", "Physalis", "Litschi",
        "Kaki|Sharonfrucht", "Drachenfrucht|Pitaya", "Kumquat", "Maracuja|Passionsfrucht", "Okra",
        "Artischocke", "Fenchel", "Stachelbeere", "Quitte", "Johannisbeere", "Rhabarber",
        "Steckrübe", "Pak Choi", "Mirabelle", "Sternfrucht|Karambole", "Papaya", "Chicorée|Chicoree"
      ]
    }
  }
};
