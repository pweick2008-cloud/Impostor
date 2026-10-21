// Begriffe je Überkategorie und Schwierigkeit.
// Alternative Schreibweisen werden mit "|" getrennt – der erste Eintrag wird angezeigt,
// alle weiteren werden beim Raten des Imposters ebenfalls als richtig akzeptiert.
// "person: true" bedeutet: beim Raten reicht auch der Nachname (z. B. "Einstein").
// WORD_SOURCES sind die Einzellisten (Wer bin ich? und die Hinweise nutzen sie direkt),
// CATEGORIES die Auswahl beim Verräter, in der einige Listen zusammengefasst sind.

const WORD_SOURCES = {
  laender: {
    name: "Länder",
    icon: "",
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

  staedte: {
    name: "Städte",
    icon: "",
    words: {
      leicht: [
        "Berlin", "Hamburg", "München|Muenchen", "Köln|Koeln", "Frankfurt|Frankfurt am Main", "Stuttgart",
        "Düsseldorf|Duesseldorf", "Dresden", "Leipzig", "Paris", "London", "Rom", "New York|New York City|NYC",
        "Wien", "Madrid", "Barcelona", "Amsterdam", "Tokio|Tokyo", "Moskau", "Istanbul", "Prag", "Venedig",
        "Los Angeles|LA", "Dubai"
      ],
      mittel: [
        "Bremen", "Hannover", "Nürnberg|Nuernberg", "Dortmund", "Heidelberg", "Freiburg", "Rostock", "Kiel",
        "Lissabon", "Athen", "Kopenhagen", "Stockholm", "Oslo", "Budapest", "Warschau", "Zürich|Zuerich",
        "Brüssel|Bruessel", "Dublin", "Edinburgh", "Sydney", "Rio de Janeiro|Rio", "Kairo", "Peking|Beijing",
        "Singapur", "Las Vegas", "San Francisco"
      ],
      schwer: [
        "Görlitz", "Bamberg", "Lübeck", "Erfurt", "Regensburg", "Trier", "Passau", "Flensburg", "Ljubljana",
        "Tallinn", "Riga", "Vilnius", "Krakau", "Danzig", "Porto", "Sevilla", "Marrakesch", "Reykjavík|Reykjavik",
        "Kapstadt", "Buenos Aires", "Havanna", "Hanoi", "Kyoto", "Montreal", "Valletta"
      ]
    }
  },

  automarken: {
    name: "Automarken",
    icon: "",
    words: {
      leicht: [
        "Volkswagen|VW", "BMW", "Mercedes-Benz|Mercedes", "Audi", "Porsche", "Opel", "Ford", "Toyota", "Ferrari",
        "Lamborghini", "Tesla", "Fiat", "Renault", "Peugeot", "Škoda|Skoda", "Seat", "Honda", "Hyundai", "Kia",
        "Volvo", "Mini", "Smart", "Nissan", "Citroën|Citroen"
      ],
      mittel: [
        "Mazda", "Jeep", "Land Rover", "Jaguar", "Bentley", "Rolls-Royce|Rolls Royce", "Aston Martin", "Maserati",
        "Alfa Romeo", "Bugatti", "Dacia", "Cupra", "Subaru", "Mitsubishi", "Suzuki", "Lexus", "Chevrolet", "Dodge",
        "Cadillac", "McLaren", "Lancia", "Polestar", "Lotus", "BYD"
      ],
      schwer: [
        "Koenigsegg", "Pagani", "Rimac", "Lada", "Trabant|Trabi", "Wartburg", "DS Automobiles|DS", "Genesis",
        "Infiniti", "Acura", "Lincoln", "Buick", "Chrysler", "Saab", "Rover", "Abarth", "Alpine", "Morgan",
        "Lynk & Co|Lynk and Co", "NIO", "Xpeng", "MG", "Hummer", "Daihatsu", "Tata"
      ]
    }
  },
  geschichte: {
    name: "Historische Persönlichkeiten",
    icon: "",
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

  politiker: {
    name: "Politiker",
    icon: "",
    person: true,
    words: {
      leicht: [
        "Olaf Scholz", "Friedrich Merz", "Angela Merkel", "Donald Trump", "Joe Biden", "Barack Obama",
        "Emmanuel Macron", "Wladimir Putin|Vladimir Putin|Putin", "Wolodymyr Selenskyj|Selenskyj|Selensky|Zelensky",
        "Robert Habeck", "Annalena Baerbock", "Christian Lindner", "Markus Söder|Markus Soeder", "Alice Weidel",
        "Sahra Wagenknecht", "Boris Pistorius", "Karl Lauterbach", "Frank-Walter Steinmeier|Steinmeier",
        "Ursula von der Leyen|von der Leyen", "Kamala Harris", "Xi Jinping", "Recep Tayyip Erdoğan|Erdoğan|Erdogan",
        "Giorgia Meloni", "Keir Starmer"
      ],
      mittel: [
        "Lars Klingbeil", "Saskia Esken", "Hubertus Heil", "Nancy Faeser", "Cem Özdemir|Cem Oezdemir",
        "Hendrik Wüst|Hendrik Wuest", "Bodo Ramelow", "Winfried Kretschmann", "Gregor Gysi", "Wolfgang Kubicki",
        "Jens Spahn", "Carsten Linnemann", "Tino Chrupalla", "Ricarda Lang", "Kevin Kühnert|Kevin Kuehnert",
        "Manuela Schwesig", "Bärbel Bas|Baerbel Bas", "Julia Klöckner|Julia Kloeckner",
        "Benjamin Netanjahu|Netanjahu|Netanyahu", "Viktor Orbán|Viktor Orban|Orbán|Orban", "Narendra Modi",
        "Justin Trudeau", "Javier Milei", "Annegret Kramp-Karrenbauer|Kramp-Karrenbauer|AKK"
      ],
      schwer: [
        "Marco Buschmann", "Michael Kretschmer", "Daniel Günther|Daniel Guenther", "Dietmar Woidke", "Kai Wegner",
        "Peter Tschentscher", "Omid Nouripour", "Franziska Giffey", "Sigmar Gabriel", "Peer Steinbrück",
        "Joschka Fischer", "Gerhard Schröder|Gerhard Schroeder", "Christian Wulff", "Joachim Gauck", "Horst Seehofer",
        "Armin Laschet", "Pedro Sánchez|Pedro Sanchez", "Lula da Silva|Lula", "Claudia Sheinbaum", "Mark Rutte",
        "Donald Tusk", "Alexander Van der Bellen|Van der Bellen", "Kim Jong-un|Kim Jong Un", "Mario Voigt",
        "Volker Wissing"
      ]
    }
  },

  schauspieler: {
    name: "Schauspieler",
    icon: "",
    person: true,
    words: {
      leicht: [
        "Leonardo DiCaprio", "Brad Pitt", "Tom Cruise", "Johnny Depp", "Angelina Jolie", "Will Smith",
        "Scarlett Johansson", "Tom Hanks", "Jennifer Aniston", "Til Schweiger", "Matthias Schweighöfer|Matthias Schweighoefer",
        "Elyas M'Barek|Elyas MBarek", "Arnold Schwarzenegger", "Keanu Reeves", "Dwayne Johnson|The Rock",
        "Jackie Chan", "Emma Watson", "Daniel Radcliffe", "Robert Downey Jr.|Robert Downey Jr|Robert Downey",
        "Julia Roberts", "Morgan Freeman", "Margot Robbie", "Ryan Reynolds", "Zendaya"
      ],
      mittel: [
        "Timothée Chalamet|Timothee Chalamet", "Florence Pugh", "Pedro Pascal", "Cillian Murphy", "Ryan Gosling",
        "Natalie Portman", "Meryl Streep", "Denzel Washington", "Christian Bale", "Anne Hathaway", "Chris Hemsworth",
        "Jennifer Lawrence", "Hugh Jackman", "Sandra Bullock", "Diane Kruger", "Daniel Brühl|Daniel Bruehl",
        "Christoph Waltz", "Moritz Bleibtreu", "Nora Tschirner", "Karoline Herfurth", "Florian David Fitz|Fitz",
        "Heike Makatsch", "Iris Berben", "Uwe Ochsenknecht"
      ],
      schwer: [
        "Sandra Hüller|Sandra Hueller", "Benno Fürmann|Benno Fuermann", "Jella Haase", "Tom Schilling", "August Diehl",
        "Lars Eidinger", "Nina Hoss", "Alexander Fehling", "Jessica Schwarz", "Wotan Wilke Möhring|Möhring|Moehring",
        "Ulrich Tukur", "Martina Gedeck", "Anya Taylor-Joy", "Austin Butler", "Jenna Ortega", "Paul Mescal",
        "Saoirse Ronan", "Tilda Swinton", "Willem Dafoe", "Joaquin Phoenix", "Mads Mikkelsen", "Javier Bardem",
        "Penélope Cruz|Penelope Cruz", "Frances McDormand", "Adam Driver"
      ]
    }
  },

  musiker: {
    name: "Musiker & Bands",
    icon: "",
    person: true,
    words: {
      leicht: [
        "Taylor Swift", "Ed Sheeran", "Beyoncé|Beyonce", "Rihanna", "Lady Gaga", "Michael Jackson", "Madonna",
        "Elvis Presley|Elvis", "The Beatles|Beatles", "Queen", "ABBA", "Rammstein", "Die Toten Hosen|Toten Hosen",
        "Die Ärzte|Ärzte|Die Aerzte", "Herbert Grönemeyer|Grönemeyer|Groenemeyer", "Helene Fischer", "Mark Forster",
        "Coldplay", "Eminem", "Justin Bieber", "Billie Eilish", "Adele", "Nena", "Udo Lindenberg", "AC/DC|ACDC"
      ],
      mittel: [
        "Kraftklub", "Peter Fox", "Seeed", "Cro", "Apache 207", "Capital Bra", "Sido", "Bushido", "Wincent Weiss",
        "Max Giesinger", "AnnenMayKantereit", "Silbermond", "Juli", "Tokio Hotel", "Scooter", "Dua Lipa",
        "Harry Styles", "The Weeknd|Weeknd", "Bruno Mars", "Imagine Dragons", "Linkin Park", "Metallica", "Nirvana",
        "Pink Floyd", "The Rolling Stones|Rolling Stones"
      ],
      schwer: [
        "Kraftwerk", "Die Fantastischen Vier|Fantastischen Vier|Fanta 4|Fanta Vier", "Element of Crime", "Tocotronic",
        "Wir sind Helden", "Die Prinzen|Prinzen", "Annett Louisan", "Clueso", "Faber", "Provinz", "Giant Rooks",
        "Trettmann", "K.I.Z|KIZ", "Deichkind", "Fettes Brot", "Arctic Monkeys", "Radiohead", "Fleetwood Mac",
        "Depeche Mode", "Daft Punk", "Florence and the Machine|Florence + the Machine", "Hozier", "Lana Del Rey",
        "Tame Impala", "Gorillaz"
      ]
    }
  },
  streamer: {
    name: "Deutsche Streamer",
    icon: "",
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
    icon: "",
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
  },

  tiere: {
    name: "Tiere",
    icon: "",
    words: {
      leicht: [
        "Hund", "Katze", "Pferd", "Kuh", "Schwein", "Schaf", "Ziege", "Huhn", "Elefant", "Löwe|Loewe", "Tiger",
        "Giraffe", "Affe", "Bär|Baer", "Hase", "Maus", "Delfin|Delphin", "Hai", "Pinguin", "Krokodil", "Schlange",
        "Frosch", "Eule", "Fuchs", "Igel"
      ],
      mittel: [
        "Känguru|Kaenguru", "Koala", "Zebra", "Nashorn", "Nilpferd|Flusspferd", "Gorilla", "Panda", "Wolf", "Luchs",
        "Biber", "Otter", "Faultier", "Flamingo", "Papagei", "Adler", "Schildkröte|Schildkroete", "Chamäleon|Chamaeleon",
        "Qualle", "Tintenfisch|Krake|Oktopus", "Robbe|Seehund", "Wal", "Kamel", "Lama", "Waschbär|Waschbaer",
        "Erdmännchen|Erdmaennchen"
      ],
      schwer: [
        "Axolotl", "Okapi", "Schnabeltier", "Gürteltier|Guerteltier", "Ameisenbär|Ameisenbaer", "Tapir",
        "Capybara|Wasserschwein", "Gnu", "Yak", "Komodowaran", "Narwal", "Pfeilgiftfrosch", "Seepferdchen", "Pelikan",
        "Kolibri", "Tukan", "Fennek|Wüstenfuchs", "Vielfraß|Vielfrass", "Dachs", "Hermelin", "Stachelschwein", "Mungo",
        "Gepard", "Leguan", "Mantarochen|Manta"
      ]
    }
  },

  fussballer: {
    name: "Fußballer",
    icon: "",
    person: true,
    words: {
      leicht: [
        "Lionel Messi", "Cristiano Ronaldo|CR7", "Thomas Müller|Thomas Mueller", "Manuel Neuer", "Toni Kroos", "Neymar",
        "Kylian Mbappé|Kylian Mbappe", "Erling Haaland", "Robert Lewandowski", "Harry Kane", "Jamal Musiala",
        "Florian Wirtz", "Joshua Kimmich", "Mesut Özil|Mesut Oezil", "Bastian Schweinsteiger", "Philipp Lahm",
        "Miroslav Klose", "Oliver Kahn", "Franz Beckenbauer", "Zinedine Zidane", "David Beckham", "Diego Maradona",
        "Pelé|Pele", "Mohamed Salah", "Kevin De Bruyne|De Bruyne"
      ],
      mittel: [
        "İlkay Gündoğan|Ilkay Gündogan|Ilkay Guendogan|Gündogan", "Antonio Rüdiger|Antonio Ruediger",
        "Leroy Sané|Leroy Sane", "Kai Havertz", "Marc-André ter Stegen|ter Stegen", "Leon Goretzka",
        "Niclas Füllkrug|Niclas Fuellkrug", "Mats Hummels", "Marco Reus", "Jérôme Boateng|Jerome Boateng",
        "Lukas Podolski", "Michael Ballack", "Jürgen Klinsmann|Juergen Klinsmann", "Lothar Matthäus|Lothar Matthaeus",
        "Gerd Müller|Gerd Mueller", "Vinícius Júnior|Vinicius Junior|Vinicius", "Jude Bellingham",
        "Luka Modrić|Luka Modric", "Virgil van Dijk|van Dijk", "Zlatan Ibrahimović|Zlatan Ibrahimovic|Zlatan",
        "Ronaldinho", "Andrés Iniesta|Andres Iniesta", "Thierry Henry", "Wayne Rooney", "Lamine Yamal"
      ],
      schwer: [
        "Rudi Völler|Rudi Voeller", "Uwe Seeler", "Sepp Maier", "Paul Breitner", "Günter Netzer|Guenter Netzer",
        "Andreas Brehme", "Mario Götze|Mario Goetze", "André Schürrle|Andre Schuerrle", "Per Mertesacker",
        "Benedikt Höwedes|Benedikt Hoewedes", "Granit Xhaka", "Alphonso Davies", "Xabi Alonso", "Kaká|Kaka",
        "Johan Cruyff", "Ferenc Puskás|Ferenc Puskas", "Eusébio|Eusebio", "Paolo Maldini", "Andrea Pirlo",
        "Gianluigi Buffon", "Iker Casillas", "Rivaldo", "Arjen Robben", "Franck Ribéry|Franck Ribery",
        "Arturo Vidal"
      ]
    }
  },

  sportler: {
    name: "Sportler (ohne Fußball)",
    icon: "",
    person: true,
    words: {
      leicht: [
        "Michael Schumacher", "Sebastian Vettel", "Lewis Hamilton", "Max Verstappen", "Roger Federer",
        "Serena Williams", "Rafael Nadal", "Novak Đoković|Novak Djokovic", "Boris Becker", "Steffi Graf",
        "Alexander Zverev", "Usain Bolt", "Michael Phelps", "Muhammad Ali", "Mike Tyson", "Michael Jordan",
        "LeBron James", "Dirk Nowitzki", "Tiger Woods", "Wladimir Klitschko", "Vitali Klitschko", "Conor McGregor",
        "Simone Biles", "Kobe Bryant", "Mick Schumacher"
      ],
      mittel: [
        "Dennis Schröder|Dennis Schroeder", "Franz Wagner", "Angelique Kerber", "Nico Rosberg", "Henry Maske",
        "Regina Halmich", "Timo Boll", "Laura Dahlmeier", "Magdalena Neuner", "Felix Neureuther",
        "Katarina Witt|Kati Witt", "Malaika Mihambo", "Carl Lewis", "Shaquille O'Neal|Shaquille ONeal|Shaq",
        "Stephen Curry", "Tom Brady", "Wayne Gretzky", "Carlos Alcaraz", "Jannik Sinner", "Charles Leclerc",
        "Fernando Alonso", "Ayrton Senna", "Tadej Pogačar|Tadej Pogacar", "Lindsey Vonn", "Niki Lauda"
      ],
      schwer: [
        "Jan Ullrich", "Erik Zabel", "Britta Steffen", "Fabian Hambüchen|Fabian Hambuechen", "Heike Drechsler",
        "Robert Harting", "Gina Lückenkemper|Gina Lueckenkemper", "Leon Draisaitl", "Patrick Mahomes",
        "Mikaela Shiffrin", "Marcel Hirscher", "Eliud Kipchoge", "Armand Duplantis|Mondo Duplantis",
        "Nadia Comăneci|Nadia Comaneci", "Martina Navrátilová|Martina Navratilova", "Björn Borg|Bjoern Borg",
        "Andre Agassi", "Pete Sampras", "Valentino Rossi", "Kimi Räikkönen|Kimi Raikkonen", "Ronnie O'Sullivan|Ronnie OSullivan",
        "Phil Taylor", "Luke Littler", "Johannes Vetter", "Wilt Chamberlain"
      ]
    }
  },

  sehenswuerdigkeiten: {
    name: "Sehenswürdigkeiten",
    icon: "",
    words: {
      leicht: [
        "Eiffelturm", "Brandenburger Tor", "Kölner Dom|Koelner Dom", "Schloss Neuschwanstein|Neuschwanstein",
        "Freiheitsstatue", "Big Ben", "Kolosseum", "Schiefer Turm von Pisa|Turm von Pisa",
        "Pyramiden von Gizeh|Pyramiden", "Chinesische Mauer", "Taj Mahal", "Golden Gate Bridge",
        "Sagrada Família|Sagrada Familia", "Akropolis", "Stonehenge", "Machu Picchu", "Niagarafälle|Niagarafaelle",
        "Grand Canyon", "Mount Everest", "Reichstagsgebäude|Reichstag", "Burj Khalifa",
        "Opernhaus Sydney|Sydney Opera House", "Tower Bridge", "Hollywood-Schriftzug|Hollywood Sign",
        "Christusstatue|Cristo Redentor"
      ],
      mittel: [
        "Zugspitze", "Elbphilharmonie", "Berliner Fernsehturm|Fernsehturm", "Hofbräuhaus|Hofbraeuhaus", "Holstentor",
        "Frauenkirche", "Zwinger", "Hermannsdenkmal", "Loreley", "Matterhorn", "Mont-Saint-Michel|Mont Saint Michel",
        "Louvre", "Triumphbogen|Arc de Triomphe", "Petersdom", "Trevi-Brunnen|Trevibrunnen", "Alhambra",
        "Buckingham Palace|Buckingham-Palast", "Empire State Building", "Times Square", "Angkor Wat", "Petra",
        "Chichén Itzá|Chichen Itza", "Uluru|Ayers Rock", "Victoriafälle|Victoriafaelle", "Kreml"
      ],
      schwer: [
        "Externsteine", "Wartburg", "Bastei", "Kreidefelsen auf Rügen|Kreidefelsen", "Völkerschlachtdenkmal",
        "Porta Nigra", "Walhalla", "Schloss Sanssouci|Sanssouci", "Atomium", "Manneken Pis", "Hagia Sophia",
        "Meteora", "Plitvicer Seen", "Kappadokien", "Moai|Osterinsel-Statuen", "Halong-Bucht|Ha-Long-Bucht",
        "Borobudur", "Verbotene Stadt", "Fushimi Inari", "Salar de Uyuni", "Iguazú-Wasserfälle|Iguazu-Wasserfälle",
        "Antelope Canyon", "Burg Eltz", "Dolomiten", "Pamukkale"
      ]
    }
  },

  berufe: {
    name: "Berufe",
    icon: "",
    words: {
      leicht: [
        "Arzt|Ärztin|Aerztin|Doktor|Doktorin", "Lehrer|Lehrerin", "Polizist|Polizistin", "Feuerwehrmann|Feuerwehrfrau|Feuerwehrleute",
        "Bäcker|Bäckerin|Baecker|Baeckerin", "Koch|Köchin|Koechin", "Friseur|Friseurin|Frisör|Frisörin|Friseuse",
        "Pilot|Pilotin", "Landwirt|Landwirtin|Bauer|Bäuerin", "Tierarzt|Tierärztin|Tieraerztin",
        "Zahnarzt|Zahnärztin|Zahnaerztin", "Verkäufer|Verkäuferin|Kassierer|Kassiererin", "Busfahrer|Busfahrerin",
        "Pflegekraft|Krankenpfleger|Krankenpflegerin|Krankenschwester|Pflegefachkraft|Pflegefachfrau|Pflegefachmann",
        "Maler|Malerin|Anstreicher|Lackierer", "Elektriker|Elektrikerin|Elektroniker|Elektronikerin",
        "Kfz-Mechatroniker|Kfz-Mechatronikerin|Mechaniker|Mechanikerin|Automechaniker", "Briefträger|Briefträgerin|Postbote|Postbotin",
        "Gärtner|Gärtnerin|Gaertner", "Metzger|Metzgerin|Fleischer|Fleischerin|Schlachter", "Kellner|Kellnerin|Servicekraft|Bedienung",
        "Sänger|Sängerin|Saenger", "Schauspieler|Schauspielerin", "Astronaut|Astronautin", "Bauarbeiter|Bauarbeiterin"
      ],
      mittel: [
        "Architekt|Architektin", "Rechtsanwalt|Rechtsanwältin|Anwalt|Anwältin", "Richter|Richterin",
        "Journalist|Journalistin|Reporter|Reporterin", "Bankkaufmann|Bankkauffrau|Bankfachangestellter|Bankfachangestellte|Bankangestellter|Bankangestellte|Banker|Bankerin",
        "Apotheker|Apothekerin", "Tischler|Tischlerin|Schreiner|Schreinerin", "Dachdecker|Dachdeckerin",
        "Klempner|Klempnerin|Installateur|Installateurin|Sanitärinstallateur|Anlagenmechaniker", "Fotograf|Fotografin",
        "Hebamme|Entbindungspfleger", "Physiotherapeut|Physiotherapeutin|Krankengymnast",
        "Softwareentwickler|Softwareentwicklerin|Programmierer|Programmiererin|Informatiker|Informatikerin|Entwickler",
        "Ingenieur|Ingenieurin", "Steuerberater|Steuerberaterin", "Erzieher|Erzieherin|Kindergärtner|Kindergärtnerin",
        "Psychologe|Psychologin|Psychotherapeut|Psychotherapeutin", "Bibliothekar|Bibliothekarin", "Optiker|Optikerin|Augenoptiker",
        "Maurer|Maurerin", "Schornsteinfeger|Schornsteinfegerin|Kaminkehrer|Kaminfeger", "Taxifahrer|Taxifahrerin",
        "Lokführer|Lokführerin|Lokfuehrer|Triebfahrzeugführer", "Flugbegleiter|Flugbegleiterin|Stewardess|Steward",
        "Pfarrer|Pfarrerin|Pastor|Pastorin|Priester"
      ],
      schwer: [
        "Notar|Notarin", "Hufschmied|Hufschmiedin|Schmied", "Goldschmied|Goldschmiedin|Juwelier", "Uhrmacher|Uhrmacherin",
        "Steinmetz|Steinmetzin", "Imker|Imkerin", "Winzer|Winzerin", "Förster|Försterin|Foerster", "Schäfer|Schäferin|Schaefer",
        "Bestatter|Bestatterin", "Kammerjäger|Kammerjägerin|Schädlingsbekämpfer", "Dolmetscher|Dolmetscherin|Übersetzer|Übersetzerin",
        "Archäologe|Archäologin|Archaeologe", "Meteorologe|Meteorologin", "Sommelier|Sommelière|Sommeliere",
        "Konditor|Konditorin", "Restaurator|Restauratorin", "Orthopädietechniker|Orthopädietechnikerin",
        "Hörakustiker|Hörakustikerin|Hörgeräteakustiker", "Glaser|Glaserin", "Raumausstatter|Raumausstatterin",
        "Zahntechniker|Zahntechnikerin", "Fluglotse|Fluglotsin", "Gerichtsvollzieher|Gerichtsvollzieherin",
        "Böttcher|Küfer|Boettcher"
      ]
    }
  },

  modemarken: {
    name: "Modemarken",
    icon: "",
    words: {
      leicht: [
        "Nike", "Adidas", "Puma", "H&M|H und M|HM", "Zara", "Gucci", "Prada", "Louis Vuitton", "Chanel", "Levi's|Levis",
        "Tommy Hilfiger", "Calvin Klein", "Hugo Boss|Boss", "Lacoste", "Ralph Lauren", "Primark", "Converse", "Vans",
        "Supreme", "The North Face|North Face", "Jack Wolfskin", "Esprit", "s.Oliver|s Oliver|sOliver", "Versace", "Dior"
      ],
      mittel: [
        "Balenciaga", "Burberry", "Armani|Giorgio Armani", "Dolce & Gabbana|Dolce und Gabbana|D&G", "Hermès|Hermes",
        "Fendi", "Moncler", "Stone Island", "Carhartt", "Champion", "Fila", "Reebok", "New Balance", "Asics",
        "Under Armour", "Abercrombie & Fitch|Abercrombie", "Hollister", "Superdry", "Mango", "Bershka",
        "Pull&Bear|Pull and Bear", "Uniqlo", "Shein", "Birkenstock", "Dr. Martens|Dr Martens|Docs"
      ],
      schwer: [
        "Saint Laurent|Yves Saint Laurent|YSL", "Givenchy", "Valentino", "Bottega Veneta", "Off-White|Off White",
        "Palm Angels", "Jil Sander", "Marc O'Polo|Marc OPolo", "Bogner", "Strellson", "Drykorn", "Patagonia",
        "Arc'teryx|Arcteryx", "Salomon", "Mammut", "Ellesse", "Kappa", "Napapijri", "Woolrich", "Barbour",
        "Acne Studios", "Kenzo", "Miu Miu", "Loewe", "Closed"
      ]
    }
  },

  lebensmittelmarken: {
    name: "Lebensmittelmarken",
    icon: "",
    words: {
      leicht: [
        "Coca-Cola|Coca Cola|Cola", "Pepsi", "Fanta", "Haribo", "Milka", "Nutella", "Ritter Sport",
        "Kinder|Kinder Schokolade", "Red Bull", "McDonald's|McDonalds", "Burger King", "Dr. Oetker|Dr Oetker", "Knorr",
        "Maggi", "Lindt", "Nestlé|Nestle", "Ferrero Rocher|Ferrero", "Kellogg's|Kelloggs", "Oreo", "Pringles",
        "Lay's|Lays", "Toblerone", "Capri-Sun|Capri Sonne|CapriSun", "Mars", "Snickers"
      ],
      mittel: [
        "funny-frisch|funny frisch", "Bahlsen", "Leibniz", "Lorenz", "Kinder Bueno", "Duplo", "Hanuta", "Mentos",
        "Tic Tac", "Twix", "KitKat|Kit Kat", "Balisto", "Ehrmann", "Müllermilch|Muellermilch|Müller", "Danone",
        "Alpro", "Barilla", "Heinz", "Iglo", "Wagner", "Ben & Jerry's|Ben and Jerrys", "Langnese", "Gerolsteiner",
        "Volvic", "Monster Energy|Monster"
      ],
      schwer: [
        "Bonne Maman", "Seitenbacher", "Zentis", "Kühne|Kuehne", "Develey", "Hengstenberg",
        "Rügenwalder Mühle|Rügenwalder|Ruegenwalder", "Herta", "Meßmer|Messmer", "Teekanne", "Tchibo", "Jacobs",
        "Dallmayr", "Lavazza", "Club-Mate|Club Mate", "fritz-kola|fritz kola", "Bionade", "Almdudler", "Bauer",
        "Landliebe", "Zott", "Brandt", "Hitschler", "Katjes", "Storck"
      ]
    }
  },

  techmarken: {
    name: "Techmarken",
    icon: "",
    words: {
      leicht: [
        "Apple", "Samsung", "Microsoft", "Google", "Sony", "Nintendo", "PlayStation", "Xbox", "Huawei", "Xiaomi", "LG",
        "Philips", "Bosch", "Canon", "Nikon", "HP|Hewlett-Packard", "Dell", "Lenovo", "Intel", "Nvidia", "AMD",
        "Amazon", "Netflix", "Spotify", "Instagram"
      ],
      mittel: [
        "Asus", "Acer", "Logitech", "Razer", "JBL", "Bose", "Beats", "Sennheiser", "Garmin", "GoPro", "DJI", "Dyson",
        "Miele", "Braun", "AEG", "Grundig", "Telefunken", "Medion", "Motorola", "Nokia", "OnePlus", "Oppo",
        "Fairphone", "Panasonic", "Toshiba"
      ],
      schwer: [
        "Raspberry Pi", "Arduino", "Corsair", "SteelSeries", "HyperX", "MSI", "Gigabyte", "Western Digital", "Seagate",
        "Kingston", "Sonos", "Teufel", "Bang & Olufsen|Bang und Olufsen|B&O", "Nothing", "Realme", "Honor",
        "BlackBerry", "Wacom", "Elgato", "Anker", "Ring", "Fitbit", "tado", "AVM|FRITZ!Box|Fritzbox", "Brother"
      ]
    }
  },

  firmen: {
    name: "Firmen",
    icon: "",
    words: {
      leicht: [
        "BASF", "SAP", "Deutsche Bahn|Bahn|DB", "Deutsche Telekom|Telekom", "Deutsche Post|DHL", "Lufthansa", "Allianz",
        "Deutsche Bank", "Bayer", "thyssenkrupp|Thyssenkrupp|ThyssenKrupp", "Aldi", "Lidl", "Edeka", "Rewe",
        "dm|dm-drogerie markt", "Rossmann", "IKEA", "MediaMarkt|Media Markt", "Douglas", "Zalando", "Otto",
        "Sparkasse", "Commerzbank", "TUI", "Henkel"
      ],
      mittel: [
        "Merck", "Continental", "Infineon", "Airbus", "Boeing", "Daimler Truck", "RWE", "E.ON|EON|Eon", "EnBW",
        "Vattenfall", "Uniper", "Munich Re|Münchener Rück", "Hapag-Lloyd", "Fraport", "Deutsche Börse|Deutsche Boerse",
        "Vonovia", "Heidelberg Materials|HeidelbergCement", "Beiersdorf", "Fresenius", "Rheinmetall", "Hensoldt",
        "ZF Friedrichshafen|ZF", "Schaeffler", "Kaufland", "Würth|Wuerth"
      ],
      schwer: [
        "Trumpf", "Zeiss|Carl Zeiss", "Festo", "Kärcher|Kaercher", "Stihl", "Liebherr", "Claas", "Krones", "Sartorius",
        "Covestro", "Evonik", "Wacker Chemie|Wacker", "Lanxess", "Brenntag", "Symrise", "Bertelsmann", "Axel Springer",
        "ProSiebenSat.1|ProSieben", "Freenet", "United Internet", "Qiagen", "BioNTech", "CureVac", "Delivery Hero",
        "HelloFresh"
      ]
    }
  },

  filme: {
    name: "Filme & Serien",
    icon: "",
    words: {
      leicht: [
        "Titanic", "Avatar", "Harry Potter", "Star Wars", "Der Herr der Ringe|Herr der Ringe",
        "Der König der Löwen|König der Löwen|Koenig der Loewen", "Die Eiskönigin|Eiskönigin|Frozen", "Shrek",
        "Findet Nemo", "Toy Story", "Jurassic Park", "Spider-Man|Spiderman", "Batman", "The Avengers|Avengers",
        "Fluch der Karibik", "James Bond", "Barbie", "Stranger Things", "Friends", "Die Simpsons|Simpsons",
        "SpongeBob Schwammkopf|SpongeBob", "Game of Thrones", "Breaking Bad", "Squid Game", "Tatort"
      ],
      mittel: [
        "Inception", "Interstellar", "Oppenheimer", "Matrix|The Matrix", "Forrest Gump", "Der Pate|The Godfather",
        "Pulp Fiction", "Joker", "Dune", "Top Gun", "Fast & Furious|Fast and Furious", "Zurück in die Zukunft",
        "E.T.|ET|E.T. – Der Außerirdische", "Ghostbusters", "Kevin – Allein zu Haus|Kevin allein zu Haus|Home Alone",
        "Wednesday", "The Office", "How I Met Your Mother", "The Big Bang Theory|Big Bang Theory",
        "Haus des Geldes|La Casa de Papel", "Dark", "Babylon Berlin", "Stromberg", "Pastewka",
        "Die Sendung mit der Maus|Sendung mit der Maus"
      ],
      schwer: [
        "Das Boot", "Lola rennt", "Good Bye, Lenin!|Good Bye Lenin|Goodbye Lenin", "Das Leben der Anderen",
        "Der Untergang", "Im Westen nichts Neues", "Toni Erdmann", "Fack ju Göhte|Fack ju Goehte",
        "Der Schuh des Manitu|Schuh des Manitu", "Parasite", "Fight Club", "Shining|The Shining", "Blade Runner",
        "Alien", "Arrival", "Whiplash", "La La Land", "Everything Everywhere All at Once", "Die Sopranos|The Sopranos",
        "The Wire", "Mad Men", "Succession", "Severance", "The Last of Us", "Peaky Blinders"
      ]
    }
  },

  animes: {
    name: "Animes",
    icon: "",
    words: {
      leicht: [
        "Pokémon|Pokemon", "Dragon Ball|Dragonball|Dragon Ball Z", "Naruto", "One Piece", "Sailor Moon",
        "Detektiv Conan|Detective Conan", "Attack on Titan|Shingeki no Kyojin", "Death Note",
        "Mein Nachbar Totoro|Totoro", "Chihiros Reise ins Zauberland|Chihiro|Spirited Away", "Digimon",
        "Yu-Gi-Oh!|Yu-Gi-Oh|Yugioh", "Demon Slayer|Kimetsu no Yaiba", "My Hero Academia|Boku no Hero Academia",
        "Jujutsu Kaisen", "One Punch Man|One-Punch Man", "Tokyo Ghoul", "Fullmetal Alchemist", "Bleach", "Beyblade",
        "Captain Tsubasa", "Doraemon", "Hunter x Hunter", "Spy x Family", "Chainsaw Man"
      ],
      mittel: [
        "Heidi", "Die Biene Maja|Biene Maja", "Wickie und die starken Männer|Wickie", "Hamtaro",
        "Prinzessin Mononoke|Mononoke", "Das wandelnde Schloss|Howl's Moving Castle",
        "Kikis kleiner Lieferservice|Kiki", "Your Name|Kimi no Na wa", "Neon Genesis Evangelion|Evangelion",
        "Cowboy Bebop", "Akira", "Ghost in the Shell", "Sword Art Online", "Black Clover", "Haikyu!!|Haikyu",
        "Blue Lock", "Fairy Tail", "Inuyasha", "Code Geass", "Steins;Gate|Steins Gate", "Mob Psycho 100",
        "Dr. Stone|Dr Stone", "Vinland Saga", "Frieren", "Oshi no Ko"
      ],
      schwer: [
        "Mushishi", "Monster", "Erased|Boku dake ga Inai Machi", "Made in Abyss", "Violet Evergarden",
        "Toradora!|Toradora", "Clannad", "Nana", "Paprika", "Perfect Blue", "Ergo Proxy", "Serial Experiments Lain|Lain",
        "Samurai Champloo", "Trigun", "Berserk", "JoJo's Bizarre Adventure|JoJo", "Gintama",
        "Kaguya-sama: Love is War|Kaguya-sama", "The Promised Neverland|Promised Neverland", "Dorohedoro",
        "Banana Fish", "Odd Taxi", "Ranma ½|Ranma 1/2|Ranma", "Slam Dunk", "Great Teacher Onizuka|GTO"
      ]
    }
  }
};

// Zusammengefasste Kategorien beim Verräter. Listen unter "onlyHard" kommen
// komplett in "schwer" und nie bei leicht oder mittel vor.
const MERGED_CATEGORIES = {
  marken: {
    name: "Marken",
    from: ["automarken", "modemarken", "lebensmittelmarken", "techmarken", "firmen"]
  },
  promis: {
    name: "Promis",
    person: true,
    from: ["geschichte", "politiker", "schauspieler", "musiker", "sportler", "fussballer"],
    onlyHard: ["streamer"]
  }
};

const CATEGORIES = (() => {
  const result = {};
  const mergedOf = {};
  for (const [id, m] of Object.entries(MERGED_CATEGORIES)) {
    for (const src of [...m.from, ...(m.onlyHard || [])]) mergedOf[src] = id;
  }
  for (const src of Object.keys(WORD_SOURCES)) {
    const id = mergedOf[src];
    if (!id) { result[src] = WORD_SOURCES[src]; continue; }
    if (result[id]) continue;
    const m = MERGED_CATEGORIES[id];
    const cat = { name: m.name, icon: "", words: { leicht: [], mittel: [], schwer: [] }, sourceOf: {}, onlyHard: [] };
    if (m.person) cat.person = true;
    for (const s of m.from) {
      for (const level of ["leicht", "mittel", "schwer"]) {
        for (const w of WORD_SOURCES[s].words[level]) { cat.words[level].push(w); cat.sourceOf[w] = s; }
      }
    }
    for (const s of m.onlyHard || []) {
      for (const w of Object.values(WORD_SOURCES[s].words).flat()) {
        cat.words.schwer.push(w); cat.onlyHard.push(w); cat.sourceOf[w] = s;
      }
    }
    result[id] = cat;
  }
  return result;
})();

// Ursprüngliche Einzelliste eines Begriffs (für die Hinweise)
function wordSource(catId, entry) {
  const c = CATEGORIES[catId];
  return (c && c.sourceOf && c.sourceOf[entry]) || catId;
}

const DIFFICULTY_IDS = ["leicht", "mittel", "schwer"];

// Gespeicherte Einstellungen weiter nutzen: alte Kategorie-IDs werden umgeleitet,
// "zufall" bzw. "gemischt" (früher eine eigene Auswahl) heißt jetzt: alles ausgewählt.
function resolveCategory(id) {
  if (CATEGORIES[id]) return id;
  return Object.keys(MERGED_CATEGORIES).find((m) => MERGED_CATEGORIES[m].from.concat(MERGED_CATEGORIES[m].onlyHard || []).includes(id)) || null;
}

function resolveCategories(input) {
  if (input === "zufall") return Object.keys(CATEGORIES);
  const list = (Array.isArray(input) ? input : [input]).map(resolveCategory).filter(Boolean);
  const ids = Object.keys(CATEGORIES).filter((id) => list.includes(id));
  return ids.length ? ids : ["laender"];
}

function resolveDifficulties(input) {
  if (input === "gemischt") return DIFFICULTY_IDS.slice();
  const list = Array.isArray(input) ? input : [input];
  const ids = DIFFICULTY_IDS.filter((d) => list.includes(d));
  return ids.length ? ids : ["leicht"];
}

if (typeof module !== "undefined") {
  module.exports = { CATEGORIES, WORD_SOURCES, DIFFICULTY_IDS, wordSource, resolveCategories, resolveDifficulties };
}
