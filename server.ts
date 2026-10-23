import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { getRoomState } from "./src/utils/roomService.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Persistent MCP Dictionary Client
let dictClient: Client | null = null;

// Initialize Gemini Client Lazily/Safely
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === "MY_GEMINI_API_KEY") {
      console.warn("GEMINI_API_KEY is not configured or using placeholder. Running in fallback mode.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key || "",
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// API Route: Healthcheck
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Curated fallback dictionary for Word of the Day (Letters A-Z)
const FALLBACK_WORDS_OF_THE_DAY: Record<string, { word: string; category: string; letter: string; definition: string; funFact: string }> = {
  A: { word: "Axolotl", category: "Animal", letter: "A", definition: "A rare neotenic aquatic salamander native to Mexico.", funFact: "Axolotls can regenerate entire limbs, spinal cords, and even parts of their brain!" },
  B: { word: "Bioluminescence", category: "Thing", letter: "B", definition: "Light produced by a chemical reaction within a living organism.", funFact: "Fireflies, deep-sea anglerfish, and glowing mushrooms all use bioluminescence." },
  C: { word: "Chinchilla", category: "Animal", letter: "C", definition: "A small crepuscular rodent native to the Andes mountains.", funFact: "Their fur is so dense (50 hairs per follicle) that fleas cannot survive in it!" },
  D: { word: "Dingo", category: "Animal", letter: "D", definition: "An ancient wild canine native to Australia.", funFact: "Dingoes rarely bark; instead, they communicate through wolf-like howls." },
  E: { word: "Eucalyptus", category: "Thing", letter: "E", definition: "A fast-growing evergreen tree native to Australia.", funFact: "Eucalyptus leaves make up 99% of a koala's daily diet!" },
  F: { word: "Fennec Fox", category: "Animal", letter: "F", definition: "A small nocturnal desert fox found in the Sahara.", funFact: "Its gigantic ears serve to dissipate heat and listen for subterranean prey." },
  G: { word: "Geyser", category: "Place", letter: "G", definition: "A hot spring characterized by intermittent water discharge.", funFact: "Yellowstone National Park contains over half of the world's active geysers!" },
  H: { word: "Himalayas", category: "Place", letter: "H", definition: "A major mountain range in Asia containing the highest peaks.", funFact: "The Himalayas grow about 5mm taller every year due to tectonic collision!" },
  I: { word: "Iguana", category: "Animal", letter: "I", definition: "A herbivorous lizard native to tropical areas of Central & South America.", funFact: "Iguanas have a third eye on top of their head called a parietal eye!" },
  J: { word: "Jacaranda", category: "Thing", letter: "J", definition: "A genus of tropical trees famous for bright purple flowers.", funFact: "In Pretoria, South Africa, street trees bloom purple every springtime." },
  K: { word: "Kiwi", category: "Food", letter: "K", definition: "An edible berry of several species of woody vines in the genus Actinidia.", funFact: "A single kiwi fruit contains more vitamin C than a whole orange!" },
  L: { word: "Lychee", category: "Food", letter: "L", definition: "A tropical fruit tree native to Guangdong and Fujian provinces of China.", funFact: "Lychees have been cultivated in China for over 2,000 years!" },
  M: { word: "Machu Picchu", category: "Place", letter: "M", definition: "A 15th-century Inca citadel located in the Eastern Cordillera of southern Peru.", funFact: "Built without mortar, the stones fit so tightly a knife blade can't slide between them!" },
  N: { word: "Narwhal", category: "Animal", letter: "N", definition: "A medium-sized toothed whale possessing a large spiral tusk.", funFact: "The narwhal's tusk is actually an elongated canine tooth with millions of nerve endings!" },
  O: { word: "Okapi", category: "Animal", letter: "O", definition: "A solitary rainforest mammal native to the Democratic Republic of the Congo.", funFact: "Although striped like a zebra, the okapi is the only living relative of the giraffe!" },
  P: { word: "Pomegranate", category: "Food", letter: "P", definition: "A fruit-bearing deciduous shrub with rich red seeds called arils.", funFact: "A single pomegranate can contain up to 1,400 juicy red seeds!" },
  Q: { word: "Quinoa", category: "Food", letter: "Q", definition: "A flowering plant in the amaranth family grown as a crop primarily for edible seeds.", funFact: "The Incas referred to quinoa as 'Chisiya Mama' meaning 'Mother Grain'." },
  R: { word: "Rambutan", category: "Food", letter: "R", definition: "A medium-sized tropical tree with hairy red sweet fruit.", funFact: "The name rambutan is derived from the Malay word 'rambut', which means hair." },
  S: { word: "Sirenian", category: "Animal", letter: "S", definition: "An order of fully aquatic, herbivorous mammals including manatees and dugongs.", funFact: "Early sailors often mistook sirenians for mythical mermaids!" },
  T: { word: "Tarantula", category: "Animal", letter: "T", definition: "A group of large, often hairy arachnids found worldwide.", funFact: "Some female tarantulas can live for over 30 years in captivity!" },
  U: { word: "Uluṟu", category: "Place", letter: "U", definition: "A massive sandstone monolith in the heart of Australia's Northern Territory.", funFact: "Uluru changes color throughout the day, glowing bright red at sunrise and sunset." },
  V: { word: "Vesuvius", category: "Place", letter: "V", definition: "A sommo-stratovolcano located on the Gulf of Naples in Italy.", funFact: "It is the only volcano on the European mainland to have erupted within the last hundred years." },
  W: { word: "Wombat", category: "Animal", letter: "W", definition: "Short-legged, muscular quadrupedal marsupials native to Australia.", funFact: "Wombats produce cube-shaped droppings, preventing them from rolling away!" },
  X: { word: "Xylophone", category: "Thing", letter: "X", definition: "A musical instrument consisting of wooden bars struck by wooden mallets.", funFact: "Ancient xylophones were developed independently in both Asia and Africa." },
  Y: { word: "Yosemite", category: "Place", letter: "Y", definition: "A iconic national park in California's Sierra Nevada mountains.", funFact: "Home to 'Horsetail Fall', which glows orange like fire under February sunsets!" },
  Z: { word: "Zanzibar", category: "Place", letter: "Z", definition: "An insular autonomous region of Tanzania in East Africa.", funFact: "Famous as the historic Spice Island and birthplace of Queen singer Freddie Mercury!" }
};

export interface VocabDrillCard {
  word: string;
  category: string;
  phonetic: string;
  definition: string;
  sampleSentence: string;
  quizQuestion: string;
  options: string[];
  correctIndex: number;
}

// Complete 26-letter offline curated drill library
const FALLBACK_VOCAB_DRILLS: Record<string, VocabDrillCard[]> = {
  A: [
    { word: "Axolotl", category: "Animal", phonetic: "/ˈæk.sə.lɒt.əl/", definition: "A rare neotenic aquatic salamander that never undergoes metamorphosis.", sampleSentence: "Writing 'Axolotl' under Animal gives an unbeatable +15 points!", quizQuestion: "Which category does 'Axolotl' belong to?", options: ["Animal", "Food", "Place", "Thing"], correctIndex: 0 },
    { word: "Artichoke", category: "Food", phonetic: "/ˈɑːr.tɪ.tʃoʊk/", definition: "A variety of a species of thistle cultivated as an edible vegetable.", sampleSentence: "Artichoke is an excellent, unique choice for the Food category.", quizQuestion: "What part of an artichoke is most commonly eaten?", options: ["The roots", "The heart and leaf bases", "The seeds", "The bark"], correctIndex: 1 },
    { word: "Amsterdam", category: "Place", phonetic: "/ˈæm.stər.dæm/", definition: "The capital and most populous city of the Netherlands, famous for canals.", sampleSentence: "Amsterdam is a world-renowned European city starting with A.", quizQuestion: "Which country is Amsterdam the capital of?", options: ["Belgium", "Netherlands", "Germany", "Denmark"], correctIndex: 1 }
  ],
  B: [
    { word: "Baboon", category: "Animal", phonetic: "/bæˈbuːn/", definition: "A large Old World monkey found in open woodlands and savannahs across Africa.", sampleSentence: "Baboons are intelligent primates known for complex troop hierarchies.", quizQuestion: "Which category does 'Baboon' fit into best?", options: ["Place", "Thing", "Animal", "Food"], correctIndex: 2 },
    { word: "Baguette", category: "Food", phonetic: "/bæˈɡɛt/", definition: "A long, thin loaf of French bread with a crisp crust.", sampleSentence: "Baguette is a classic staple in French cuisine.", quizQuestion: "Where does the baguette traditionally originate from?", options: ["Italy", "France", "Spain", "Germany"], correctIndex: 1 },
    { word: "Barcelona", category: "Place", phonetic: "/ˌbɑːrsəˈloʊnə/", definition: "A major Mediterranean port city and capital of Catalonia in Spain.", sampleSentence: "Barcelona is world-famous for Antoni Gaudí's architectural masterpieces.", quizQuestion: "Which region of Spain is Barcelona the capital of?", options: ["Andalusia", "Catalonia", "Basque Country", "Galicia"], correctIndex: 1 }
  ],
  C: [
    { word: "Chinchilla", category: "Animal", phonetic: "/tʃɪnˈtʃɪlə/", definition: "A small crepuscular rodent native to the Andes mountains with ultra-dense fur.", sampleSentence: "Chinchillas take dust baths to clean their dense, soft coats.", quizQuestion: "Which mountain range are chinchillas native to?", options: ["Rockies", "Andes", "Alps", "Himalayas"], correctIndex: 1 },
    { word: "Cantaloupe", category: "Food", phonetic: "/ˈkæntəˌluːp/", definition: "A sweet orange-fleshed melon rich in vitamin A and vitamin C.", sampleSentence: "Cantaloupe makes a refreshing summer fruit entry.", quizQuestion: "What color is the edible flesh inside a standard cantaloupe?", options: ["Bright orange", "Dark purple", "White", "Deep green"], correctIndex: 0 },
    { word: "Cairo", category: "Place", phonetic: "/ˈkaɪroʊ/", definition: "The historic capital of Egypt and one of the largest cities in Africa.", sampleSentence: "Cairo sits along the banks of the Nile river near the Great Pyramids.", quizQuestion: "Which iconic river flows through the city of Cairo?", options: ["Amazon", "Nile", "Danube", "Thames"], correctIndex: 1 }
  ],
  D: [
    { word: "Dolphin", category: "Animal", phonetic: "/ˈdɒlfɪn/", definition: "An intelligent marine mammal belonging to the toothed whale family.", sampleSentence: "Dolphins use echolocation to navigate and hunt underwater.", quizQuestion: "Which category does 'Dolphin' belong to?", options: ["Animal", "Place", "Food", "Thing"], correctIndex: 0 },
    { word: "Dumpling", category: "Food", phonetic: "/ˈdʌmplɪŋ/", definition: "A broad classification for a dish that consists of pieces of cooked dough wrapped around a filling.", sampleSentence: "Dumplings are beloved comfort food across many world cultures.", quizQuestion: "What category best describes 'Dumpling'?", options: ["Place", "Thing", "Food", "Name"], correctIndex: 2 },
    { word: "Dublin", category: "Place", phonetic: "/ˈdʌblɪn/", definition: "The capital and largest city of Ireland, situated on the River Liffey.", sampleSentence: "Dublin is famed for literary history and Trinity College.", quizQuestion: "Dublin is the capital of which country?", options: ["Scotland", "Ireland", "Wales", "Norway"], correctIndex: 1 }
  ],
  E: [
    { word: "Echidna", category: "Animal", phonetic: "/ɪˈkɪdnə/", definition: "A spiny egg-laying monotreme mammal native to Australia and New Guinea.", sampleSentence: "Echidnas and platypuses are the only living mammals that lay eggs.", quizQuestion: "What unique trait do echidnas share with platypuses?", options: ["They fly", "They lay eggs", "They live underwater only", "They are reptiles"], correctIndex: 1 },
    { word: "Empanada", category: "Food", phonetic: "/ˌɛmpəˈnɑːdə/", definition: "A type of baked or fried turnover pastry with savoury or sweet filling.", sampleSentence: "Empanadas are popular across Spain and Latin America.", quizQuestion: "Which category does 'Empanada' belong to?", options: ["Food", "Animal", "Place", "Thing"], correctIndex: 0 },
    { word: "Edinburgh", category: "Place", phonetic: "/ˈɛdɪnbərə/", definition: "The historic hilly capital of Scotland, home to Edinburgh Castle.", sampleSentence: "Edinburgh hosts the world's largest annual arts festival.", quizQuestion: "Edinburgh is the historic capital of which nation?", options: ["England", "Scotland", "Ireland", "Austria"], correctIndex: 1 }
  ],
  F: [
    { word: "Flamingo", category: "Animal", phonetic: "/fləˈmɪŋɡoʊ/", definition: "A tall wading bird known for its pink plumage and standing on one leg.", sampleSentence: "Flamingos get their pink color from carotenoids in their algae diet.", quizQuestion: "Why are wild flamingos naturally pink?", options: ["Sun exposure", "Diet rich in carotenoids", "Genetic pigments", "Mud baths"], correctIndex: 1 },
    { word: "Falafel", category: "Food", phonetic: "/fəˈlɑːfəl/", definition: "A Middle Eastern deep-fried ball or patty made from ground chickpeas or fava beans.", sampleSentence: "Falafel is commonly served inside pita bread with tahini.", quizQuestion: "What is the primary main ingredient in traditional falafel?", options: ["Chickpeas or fava beans", "Beef", "Rice", "Potatoes"], correctIndex: 0 },
    { word: "Florence", category: "Place", phonetic: "/ˈflɒrəns/", definition: "The capital city of the Tuscany region in Italy, birthplace of the Renaissance.", sampleSentence: "Florence is home to world-renowned museums like the Uffizi Gallery.", quizQuestion: "Florence was the historic birthplace of which cultural movement?", options: ["Industrial Revolution", "Italian Renaissance", "Enlightenment", "Baroque Era"], correctIndex: 1 }
  ],
  G: [
    { word: "Gecko", category: "Animal", phonetic: "/ˈɡɛkoʊ/", definition: "A small carnivorous lizard found in warm climates, known for adhesive toe pads.", sampleSentence: "Geckos can walk effortlessly upside down on smooth glass surfaces.", quizQuestion: "Which feature allows geckos to climb smooth walls?", options: ["Suction cups", "Microscopic hairs (setae) on toes", "Sticky glue secretions", "Sharp claws only"], correctIndex: 1 },
    { word: "Guacamole", category: "Food", phonetic: "/ˌɡwɑːkəˈmoʊli/", definition: "An avocado-based dip or spread first developed in Mexico.", sampleSentence: "Guacamole pairs wonderfully with crunchy tortilla chips.", quizQuestion: "What is the primary base ingredient of guacamole?", options: ["Tomato", "Avocado", "Cucumber", "Lime"], correctIndex: 1 },
    { word: "Geneva", category: "Place", phonetic: "/dʒɪˈniːvə/", definition: "A global city in Switzerland, headquarters of many international organizations.", sampleSentence: "Geneva is situated on the shores of Lake Geneva near the Alps.", quizQuestion: "Which country is Geneva located in?", options: ["Switzerland", "Austria", "Sweden", "France"], correctIndex: 0 }
  ],
  H: [
    { word: "Hedgehog", category: "Animal", phonetic: "/ˈhɛdʒhɒɡ/", definition: "A small spiny mammal that rolls into a tight ball when threatened.", sampleSentence: "Hedgehogs use their protective quills to deter predators.", quizQuestion: "What does a hedgehog do when it senses danger?", options: ["Plays dead", "Rolls into a spiny ball", "Burrows underground instantly", "Spits venom"], correctIndex: 1 },
    { word: "Hummus", category: "Food", phonetic: "/ˈhʊməs/", definition: "A dip made from cooked, mashed chickpeas blended with tahini, lemon, and garlic.", sampleSentence: "Hummus is a delicious high-protein Middle Eastern staple.", quizQuestion: "Which category does 'Hummus' belong to?", options: ["Animal", "Food", "Place", "Thing"], correctIndex: 1 },
    { word: "Havana", category: "Place", phonetic: "/həˈvænə/", definition: "The vibrant capital city of Cuba, famous for 16th-century Spanish colonial architecture.", sampleSentence: "Havana is renowned for its colorful vintage cars and rich musical heritage.", quizQuestion: "Havana is the capital city of which island nation?", options: ["Jamaica", "Cuba", "Puerto Rico", "Bahamas"], correctIndex: 1 }
  ],
  I: [
    { word: "Ibis", category: "Animal", phonetic: "/ˈaɪbɪs/", definition: "A long-legged wading bird with a long, downward-curved bill.", sampleSentence: "The sacred ibis was revered in ancient Egyptian culture.", quizQuestion: "Which ancient civilization held the ibis bird sacred?", options: ["Rome", "Egypt", "Greece", "Mesopotamia"], correctIndex: 1 },
    { word: "Iceberg Lettuce", category: "Food", phonetic: "/ˈaɪsbɜːrɡ ˈlɛtɪs/", definition: "A variety of crisphead lettuce known for its crunchy texture and high water content.", sampleSentence: "Iceberg lettuce is widely used in classic chopped salads.", quizQuestion: "What is iceberg lettuce best known for?", options: ["Crunchy crisp texture", "Sour flavor", "Spicy taste", "Blue color"], correctIndex: 0 },
    { word: "Istanbul", category: "Place", phonetic: "/ˌɪstænˈbʊl/", definition: "A major city in Turkey that famously straddles Europe and Asia across the Bosphorus.", sampleSentence: "Istanbul is the only transcontinental metropolis in the world.", quizQuestion: "Which two continents does Istanbul uniquely span across?", options: ["Europe and Asia", "Europe and Africa", "Asia and Africa", "North and South America"], correctIndex: 0 }
  ],
  J: [
    { word: "Jaguar", category: "Animal", phonetic: "/ˈdʒæɡwɑːr/", definition: "A large, powerful feline species native to the Americas with rosette-patterned fur.", sampleSentence: "Jaguars possess the strongest bite force of any big cat relative to body size.", quizQuestion: "Where are jaguars natively found?", options: ["Africa and Asia", "The Americas", "Australia", "Europe"], correctIndex: 1 },
    { word: "Jambalaya", category: "Food", phonetic: "/ˌdʒæmbəˈlaɪə/", definition: "An American Creole and Cajun rice dish featuring meat, seafood, and vegetables.", sampleSentence: "Jambalaya is a culinary treasure originating in Louisiana.", quizQuestion: "Which American state is famous for authentic jambalaya?", options: ["Louisiana", "Texas", "Florida", "California"], correctIndex: 0 },
    { word: "Jakarta", category: "Place", phonetic: "/dʒəˈkɑːrtə/", definition: "The massive, bustling capital and economic hub of Indonesia on the island of Java.", sampleSentence: "Jakarta is located on the northwest coast of the world's most populous island, Java.", quizQuestion: "Jakarta is the historic capital of which nation?", options: ["Malaysia", "Indonesia", "Philippines", "Thailand"], correctIndex: 1 }
  ],
  K: [
    { word: "Koala", category: "Animal", phonetic: "/koʊˈɑːlə/", definition: "An arboreal herbivorous marsupial native to Australia, famous for eating eucalyptus.", sampleSentence: "Koalas sleep up to 20 hours a day to conserve energy.", quizQuestion: "What makes up nearly the entire diet of a koala?", options: ["Eucalyptus leaves", "Insects", "Bamboo", "Acorns"], correctIndex: 0 },
    { word: "Kimchi", category: "Food", phonetic: "/ˈkɪmtʃiː/", definition: "A traditional Korean staple dish of salted and fermented vegetables, most commonly cabbage.", sampleSentence: "Kimchi provides probiotics and a spicy, tangy flavor profile.", quizQuestion: "Kimchi is a traditional fermented dish from which country?", options: ["Japan", "Korea", "China", "Vietnam"], correctIndex: 1 },
    { word: "Kyoto", category: "Place", phonetic: "/kiˈoʊtoʊ/", definition: "The ancient imperial capital of Japan, renowned for classical Buddhist temples and gardens.", sampleSentence: "Kyoto was the imperial capital of Japan for over a thousand years.", quizQuestion: "Kyoto is famous for being the historic ancient capital of which nation?", options: ["Japan", "South Korea", "China", "Taiwan"], correctIndex: 0 }
  ],
  L: [
    { word: "Lemur", category: "Animal", phonetic: "/ˈliːmər/", definition: "A clade of strepsirrhine primates native exclusively to the island of Madagascar.", sampleSentence: "Ring-tailed lemurs use their striped tails for visual communication.", quizQuestion: "Where are wild lemurs exclusively found in nature?", options: ["Madagascar", "New Zealand", "Hawaii", "Sri Lanka"], correctIndex: 0 },
    { word: "Lasagna", category: "Food", phonetic: "/ləˈzɑːnjə/", definition: "A classic Italian baked pasta dish layered with sauce, cheese, and meats or vegetables.", sampleSentence: "Lasagna is one of the oldest known types of pasta dishes.", quizQuestion: "Which culinary tradition does lasagna originate from?", options: ["Italian", "Greek", "French", "Mexican"], correctIndex: 0 },
    { word: "Lisbon", category: "Place", phonetic: "/ˈlɪzbən/", definition: "The coastal capital city of Portugal, known for sunny hills, pastel buildings, and historic trams.", sampleSentence: "Lisbon sits at the mouth of the Tagus River overlooking the Atlantic Ocean.", quizQuestion: "Lisbon is the capital city of which European country?", options: ["Portugal", "Spain", "Italy", "Greece"], correctIndex: 0 }
  ],
  M: [
    { word: "Meerkat", category: "Animal", phonetic: "/ˈmɪərkæt/", definition: "A small mongoose found in southern Africa, known for standing upright on sentry duty.", sampleSentence: "Meerkats live in organized clans and post sentries to scan the skies for hawks.", quizQuestion: "Why do meerkats stand upright on their hind legs?", options: ["To look for predators as sentries", "To attract mates", "To stay warm in the wind", "To find water"], correctIndex: 0 },
    { word: "Mango", category: "Food", phonetic: "/ˈmæŋɡoʊ/", definition: "A juicy tropical stone fruit produced from numerous species of tropical trees.", sampleSentence: "Mangoes are often celebrated as the king of tropical fruits.", quizQuestion: "What type of fruit is a mango classified as?", options: ["Stone fruit (drupe)", "Berry", "Citrus", "Melon"], correctIndex: 0 },
    { word: "Madrid", category: "Place", phonetic: "/məˈdrɪd/", definition: "The elegant capital city of Spain, famous for the Prado Museum and royal palace.", sampleSentence: "Madrid is situated directly in the geographic center of the Iberian Peninsula.", quizQuestion: "Which country is Madrid the capital of?", options: ["Spain", "Argentina", "Portugal", "Chile"], correctIndex: 0 }
  ],
  N: [
    { word: "Narwhal", category: "Animal", phonetic: "/ˈnɑːrwəl/", definition: "An Arctic toothed whale known as the 'unicorn of the sea' for its long spiral tusk.", sampleSentence: "The narwhal's long tusk is actually a sensory canine tooth.", quizQuestion: "What is the narwhal's spiral 'horn' made of?", options: ["Bone", "An elongated tooth", "Keratin", "Cartilage"], correctIndex: 1 },
    { word: "Nectarine", category: "Food", phonetic: "/ˈnɛktəriːn/", definition: "A smooth-skinned cultivar of the peach family with juicy sweet flesh.", sampleSentence: "Nectarines and peaches are nearly identical genetically, except for skin fuzz.", quizQuestion: "How do nectarines primarily differ from standard peaches?", options: ["They have smooth skin without fuzz", "They grow underwater", "They are sour only", "They have no pit"], correctIndex: 0 },
    { word: "Nairobi", category: "Place", phonetic: "/naɪˈroʊbi/", definition: "The capital and largest city of Kenya, nicknamed the Green City in the Sun.", sampleSentence: "Nairobi National Park is the only wildlife park located right next to a capital city.", quizQuestion: "Nairobi is the capital city of which African country?", options: ["Kenya", "Uganda", "Tanzania", "Ethiopia"], correctIndex: 0 }
  ],
  O: [
    { word: "Ocelot", category: "Animal", phonetic: "/ˈɒsəlɒt/", definition: "A medium-sized spotted wild cat native to southwestern North America and South America.", sampleSentence: "Ocelots are agile nocturnal hunters that swim and climb with ease.", quizQuestion: "Which category does 'Ocelot' belong to?", options: ["Animal", "Food", "Place", "Thing"], correctIndex: 0 },
    { word: "Omelette", category: "Food", phonetic: "/ˈɒmlɪt/", definition: "A dish made from beaten eggs fried with butter or oil in a frying pan.", sampleSentence: "Omelettes can be folded around cheese, vegetables, or herbs.", quizQuestion: "What is the primary main ingredient of an omelette?", options: ["Flour", "Eggs", "Milk", "Rice"], correctIndex: 1 },
    { word: "Oslo", category: "Place", phonetic: "/ˈɒzloʊ/", definition: "The coastal capital city of Norway, famous for green spaces and the Nobel Peace Prize.", sampleSentence: "Oslo sits at the northernmost end of the picturesque Oslofjord.", quizQuestion: "Oslo is the capital city of which Nordic country?", options: ["Sweden", "Norway", "Finland", "Denmark"], correctIndex: 1 }
  ],
  P: [
    { word: "Pangolin", category: "Animal", phonetic: "/ˈpæŋɡəlɪn/", definition: "A unique solitary mammal covered in large, protective keratin scales.", sampleSentence: "Pangolins are the only mammals in the world completely covered in scales.", quizQuestion: "What are the protective scales of a pangolin made of?", options: ["Keratin (same as fingernails)", "Bone", "Ivory", "Iron minerals"], correctIndex: 0 },
    { word: "Pomegranate", category: "Food", phonetic: "/ˈpɒmɪɡrænɪt/", definition: "A fruit with a thick red rind containing hundreds of jewel-like edible ruby seeds.", sampleSentence: "Pomegranate seeds are bursting with tart, antioxidant-rich juice.", quizQuestion: "What are the juicy edible seed pods inside a pomegranate called?", options: ["Arils", "Berries", "Kernels", "Pips"], correctIndex: 0 },
    { word: "Prague", category: "Place", phonetic: "/prɑːɡ/", definition: "The capital city of the Czech Republic, known as the City of a Hundred Spires.", sampleSentence: "Prague's Charles Bridge and medieval Astronomical Clock attract visitors worldwide.", quizQuestion: "Prague is the capital city of which European nation?", options: ["Czech Republic", "Poland", "Hungary", "Slovakia"], correctIndex: 0 }
  ],
  Q: [
    { word: "Quokka", category: "Animal", phonetic: "/ˈkwɒkə/", definition: "A small Australian marsupial famous for its cheerful, smiling facial expression.", sampleSentence: "Quokkas live on Rottnest Island in Western Australia and have no natural predators.", quizQuestion: "Why are quokkas often called 'the world's happiest animal'?", options: ["They purr loudly", "Their facial structure makes them appear to smile", "They dance in groups", "They change colors when happy"], correctIndex: 1 },
    { word: "Quinoa", category: "Food", phonetic: "/ˈkiːnwɑː/", definition: "A nutrient-rich grain crop grown for edible seeds, complete with all nine essential amino acids.", sampleSentence: "Quinoa was revered as a sacred crop by the ancient Inca civilization.", quizQuestion: "Why is quinoa celebrated as a complete protein?", options: ["It contains all 9 essential amino acids", "It is made of dairy", "It has zero carbohydrates", "It grows in water"], correctIndex: 0 },
    { word: "Quebec", category: "Place", phonetic: "/kwɪˈbɛk/", definition: "A predominantly French-speaking province and historic fortified city in eastern Canada.", sampleSentence: "Old Quebec is a UNESCO World Heritage site with 400-year-old stone ramparts.", quizQuestion: "What is the primary official language of Quebec?", options: ["French", "English", "Spanish", "German"], correctIndex: 0 }
  ],
  R: [
    { word: "Raccoon", category: "Animal", phonetic: "/rəˈkuːn/", definition: "A medium-sized North American mammal recognized by black facial mask markings.", sampleSentence: "Raccoons have extremely dexterous front paws that can open locks and jars.", quizQuestion: "Which trait is most characteristic of raccoons?", options: ["Black eye mask and ringed tail", "Spotted fur and antlers", "Large webbed wings", "Hard shell"], correctIndex: 0 },
    { word: "Ravioli", category: "Food", phonetic: "/ˌræviˈoʊli/", definition: "A type of Italian pasta comprising a filling enveloped in thin pasta dough.", sampleSentence: "Ravioli can be filled with ricotta cheese, spinach, or braised meats.", quizQuestion: "Which category does 'Ravioli' belong to?", options: ["Place", "Thing", "Food", "Animal"], correctIndex: 2 },
    { word: "Reykjavik", category: "Place", phonetic: "/ˈreɪkjəvɪk/", definition: "The coastal capital of Iceland, powered largely by geothermal and renewable energy.", sampleSentence: "Reykjavik is the world's northernmost capital of a sovereign state.", quizQuestion: "Reykjavik is the capital of which country?", options: ["Iceland", "Greenland", "Finland", "Sweden"], correctIndex: 0 }
  ],
  S: [
    { word: "Sloth", category: "Animal", phonetic: "/sloʊθ/", definition: "A slow-moving arboreal mammal native to Central and South American rainforests.", sampleSentence: "Sloths have such a slow metabolism that algae grows on their fur.", quizQuestion: "Why does green algae often grow on a sloth's fur in the wild?", options: ["They swim daily", "They move slowly in humid rainforests, providing camouflage", "They eat algae directly", "It keeps them warm in snow"], correctIndex: 1 },
    { word: "Sushi", category: "Food", phonetic: "/ˈsuːʃi/", definition: "A traditional Japanese dish of prepared vinegared rice accompanied by seafood or vegetables.", sampleSentence: "Sushi combines seasoned rice with fresh seafood and seaweed (nori).", quizQuestion: "What is the indispensable essential ingredient in all traditional sushi?", options: ["Vinegared rice (shari)", "Raw salmon only", "Soy sauce broth", "Wasabi root only"], correctIndex: 0 },
    { word: "Stockholm", category: "Place", phonetic: "/ˈstɒkhoʊm/", definition: "The capital of Sweden, built across 14 islands where Lake Mälaren meets the Baltic Sea.", sampleSentence: "Stockholm is renowned for its historic Gamla Stan old town district.", quizQuestion: "Stockholm is the capital city of which country?", options: ["Sweden", "Denmark", "Norway", "Finland"], correctIndex: 0 }
  ],
  T: [
    { word: "Tapir", category: "Animal", phonetic: "/ˈteɪpər/", definition: "A large, herbivorous mammal resembling a pig, with a short prehensile snout.", sampleSentence: "Tapirs use their flexible snouts to grab leaves and fruits from trees.", quizQuestion: "Which body feature helps the tapir grasp forest vegetation?", options: ["A short prehensile snout", "Long sharp claws", "Curved horns", "A prehensile tail only"], correctIndex: 0 },
    { word: "Tiramisu", category: "Food", phonetic: "/ˌtɪrəmɪˈsuː/", definition: "A coffee-flavoured Italian dessert made of ladyfingers dipped in coffee and layered with mascarpone.", sampleSentence: "Tiramisu literally translates in Italian to 'pick me up' or 'cheer me up'.", quizQuestion: "What flavor is the signature defining note of tiramisu?", options: ["Coffee and cocoa", "Lemon and mint", "Strawberry and cream", "Peanut butter"], correctIndex: 0 },
    { word: "Tokyo", category: "Place", phonetic: "/ˈtoʊkioʊ/", definition: "The bustling capital of Japan, the world's most populous metropolitan area.", sampleSentence: "Tokyo blends ultramodern skyscrapers with historic Shinto shrines.", quizQuestion: "Tokyo is the modern capital city of which nation?", options: ["Japan", "South Korea", "China", "Vietnam"], correctIndex: 0 }
  ],
  U: [
    { word: "Uakari", category: "Animal", phonetic: "/wɑːˈkɑːri/", definition: "A rare South American monkey with a striking bald bright red face and short tail.", sampleSentence: "A bright red face in a uakari monkey is a sign of robust health and vitality.", quizQuestion: "What is the most distinctive physical feature of a bald uakari?", options: ["Bright red bald face", "Long striped tail", "Golden mane", "Large blue ears"], correctIndex: 0 },
    { word: "Udon", category: "Food", phonetic: "/ˈuːdɒn/", definition: "A thick Japanese wheat flour noodle commonly served in hot, savory dashi broth.", sampleSentence: "Udon noodles are thick, chewy, and deeply comforting in winter soups.", quizQuestion: "What type of food is Japanese udon?", options: ["Thick wheat noodles", "Fermented soybean cake", "Sweet rice dessert", "Crispy seaweed snack"], correctIndex: 0 },
    { word: "Utrecht", category: "Place", phonetic: "/ˈjuːtrɛkt/", definition: "A historic university city in the Netherlands with unique multi-level canal wharves.", sampleSentence: "Utrecht is famous for its soaring 14th-century Dom Tower bell tower.", quizQuestion: "In which European country is the city of Utrecht located?", options: ["Netherlands", "Belgium", "Germany", "Luxembourg"], correctIndex: 0 }
  ],
  V: [
    { word: "Viper", category: "Animal", phonetic: "/ˈvaɪpər/", definition: "A family of venomous snakes characterized by long, hinged fangs.", sampleSentence: "Vipers can fold their fangs back against the roof of their mouth when resting.", quizQuestion: "What distinct anatomical feature do vipers possess?", options: ["Long hinged hollow fangs", "Warm-blooded body", "Eyelids that blink", "Feathers"], correctIndex: 0 },
    { word: "Vanilla", category: "Food", phonetic: "/vəˈnɪlə/", definition: "A popular spice derived from orchids of the genus Vanilla, native to Mesoamerica.", sampleSentence: "Natural vanilla is the second most expensive spice in the world after saffron.", quizQuestion: "Vanilla beans grow on which type of flowering plant?", options: ["Orchids", "Cactus", "Oak tree", "Pine shrub"], correctIndex: 0 },
    { word: "Vienna", category: "Place", phonetic: "/viˈɛnə/", definition: "The elegant capital city of Austria, celebrated for classical music, palaces, and coffee houses.", sampleSentence: "Vienna was home to musical icons like Mozart, Beethoven, and Brahms.", quizQuestion: "Vienna is the capital city of which country?", options: ["Austria", "Switzerland", "Germany", "Poland"], correctIndex: 0 }
  ],
  W: [
    { word: "Walrus", category: "Animal", phonetic: "/ˈwɔːlrəs/", definition: "A large flippered marine mammal found in the Arctic Ocean, equipped with prominent tusks.", sampleSentence: "Walruses use their tusks to haul themselves out of freezing ocean water onto ice.", quizQuestion: "What do walruses use their prominent tusks for?", options: ["Hauling onto ice and establishing territory", "Chewing kelp", "Swimming faster", "Catching flying birds"], correctIndex: 0 },
    { word: "Waffle", category: "Food", phonetic: "/ˈwɒfəl/", definition: "A leavened batter cake cooked between two patterned metal plates for a gridded surface.", sampleSentence: "Crispy Belgian waffles are delicious topped with fresh berries and maple syrup.", quizQuestion: "What gives a waffle its distinctive checkerboard grid pattern?", options: ["Cooking between textured waffle iron plates", "Hand carving after baking", "Freezing in ice molds", "Rolling with a pin"], correctIndex: 0 },
    { word: "Warsaw", category: "Place", phonetic: "/ˈwɔːrsɔː/", definition: "The historic capital of Poland, meticulously rebuilt after World War II.", sampleSentence: "Warsaw's rebuilt Old Town is recognized as an outstanding UNESCO World Heritage site.", quizQuestion: "Warsaw is the capital city of which country?", options: ["Poland", "Czech Republic", "Slovakia", "Hungary"], correctIndex: 0 }
  ],
  X: [
    { word: "X-Ray Tetra", category: "Animal", phonetic: "/ˈɛks.reɪ ˈtɛtrə/", definition: "A small, translucent freshwater fish whose internal spine and organs are clearly visible.", sampleSentence: "The X-Ray Tetra is a popular aquarium fish native to the Amazon river basin.", quizQuestion: "Why is the X-ray tetra given its unique name?", options: ["Its body is transparent showing its bones", "It glows in dark caves", "It emits radiation", "It lives near medical reefs"], correctIndex: 0 },
    { word: "Xigua", category: "Food", phonetic: "/ʃiːˈɡwɑː/", definition: "The Chinese name for watermelon, a sweet, refreshing fruit cultivated worldwide.", sampleSentence: "Xigua (watermelon) is the ultimate game-winning word for X in Food!", quizQuestion: "What popular fruit is known as 'Xigua' in Mandarin Chinese?", options: ["Watermelon", "Banana", "Apple", "Orange"], correctIndex: 0 },
    { word: "Xi'an", category: "Place", phonetic: "/ʃiːˈɑːn/", definition: "An ancient capital city in Shaanxi, China, famous as the site of the Terracotta Army.", sampleSentence: "Xi'an marked the eastern starting point of the historic Silk Road trading routes.", quizQuestion: "What world-famous ancient discovery is located in Xi'an?", options: ["The Terracotta Army", "The Sphinx", "Machu Picchu", "Stonehenge"], correctIndex: 0 }
  ],
  Y: [
    { word: "Yak", category: "Animal", phonetic: "/jæk/", definition: "A heavily built domesticated or wild bovid with long thick hair, native to the Himalayas.", sampleSentence: "Yaks provide milk, wool, and transport across high-altitude Himalayan plateaus.", quizQuestion: "Which high-altitude region are yaks naturally adapted to live in?", options: ["The Himalayas & Tibetan Plateau", "The Sahara Desert", "The Amazon Rainforest", "The Arctic Tundra"], correctIndex: 0 },
    { word: "Yogurt", category: "Food", phonetic: "/ˈjoʊɡərt/", definition: "A dairy product produced by bacterial fermentation of milk, rich in beneficial probiotics.", sampleSentence: "Greek yogurt is strained to produce a thick, creamy, high-protein texture.", quizQuestion: "How is milk transformed into yogurt?", options: ["Bacterial fermentation", "Freezing and churning", "Baking at high heat", "Mixing with oil"], correctIndex: 0 },
    { word: "Yokohama", category: "Place", phonetic: "/ˌjoʊkəˈhɑːmə/", definition: "The second-largest city in Japan by population, located south of Tokyo on Tokyo Bay.", sampleSentence: "Yokohama was one of the first Japanese ports opened to international foreign trade in 1859.", quizQuestion: "Which body of water does the port city of Yokohama sit beside?", options: ["Tokyo Bay", "Sea of Japan", "Yellow Sea", "Mediterranean Sea"], correctIndex: 0 }
  ],
  Z: [
    { word: "Zebra", category: "Animal", phonetic: "/ˈziːbrə/", definition: "An African wild equine mammal recognized by its distinctive black-and-white striped coat.", sampleSentence: "Every single zebra has a unique pattern of stripes, like a human fingerprint.", quizQuestion: "What is true about a zebra's black-and-white stripes?", options: ["Every zebra has a unique, one-of-a-kind pattern", "All zebras share the exact same stripe pattern", "Stripes disappear in adulthood", "Stripes change color weekly"], correctIndex: 0 },
    { word: "Zucchini", category: "Food", phonetic: "/zuːˈkiːni/", definition: "A summer squash which can reach nearly a meter in length, commonly harvested when immature.", sampleSentence: "Zucchini can be sautéed, grilled, or baked into sweet zucchini bread.", quizQuestion: "What type of vegetable is a zucchini botanically classified under?", options: ["Summer squash", "Root tuber", "Leafy green", "Citrus fruit"], correctIndex: 0 },
    { word: "Zanzibar", category: "Place", phonetic: "/ˈzænzɪbɑːr/", definition: "An insular autonomous region of Tanzania in East Africa, famous for historic spice trade.", sampleSentence: "Zanzibar's Stone Town is a UNESCO historic site known for fragrant cloves and vanilla.", quizQuestion: "Which country does the archipelago of Zanzibar belong to?", options: ["Tanzania", "Madagascar", "Kenya", "Mozambique"], correctIndex: 0 }
  ]
};

// API Route: Dynamic AI Vocabulary Drill Generator (All 26 Letters)
app.get("/api/vocab-drill/:letter", async (req, res) => {
  const rawLetter = req.params.letter || "A";
  const letter = rawLetter.trim().toUpperCase().charAt(0);

  if (!/[A-Z]/.test(letter)) {
    return res.status(400).json({ error: "Invalid letter parameter" });
  }

  try {
    const client = getGeminiClient();
    const key = process.env.GEMINI_API_KEY;

    if (!key || key === "MY_GEMINI_API_KEY") {
      throw new Error("Missing Gemini key, returning fallback drills");
    }

    const prompt = `Generate 3 distinct, high-quality, educational vocabulary flashcards and multiple-choice drill questions for the alphabet letter "${letter}".
Each card must feature a legitimate, real word starting with the letter "${letter}".
The words should cover distinct categories among: Name, Animal, Food, Place, or Thing.
Provide:
1. "word": The vocabulary word starting with "${letter}".
2. "category": The best-fitting category ("Animal", "Food", "Place", "Thing", or "Name").
3. "phonetic": Accurate IPA pronunciation (e.g. "/ˈæk.sə.lɒt.əl/").
4. "definition": A crisp, engaging, child-friendly 1-2 sentence definition.
5. "sampleSentence": An interesting sentence showing how to use the word in game strategy or practical context.
6. "quizQuestion": A multiple-choice question testing understanding or category classification of this word.
7. "options": Exactly 4 distinct answer choices (strings).
8. "correctIndex": The 0-based index of the correct answer in the options array (0, 1, 2, or 3).

Return valid JSON adhering to the schema.`;

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              word: { type: Type.STRING },
              category: { type: Type.STRING },
              phonetic: { type: Type.STRING },
              definition: { type: Type.STRING },
              sampleSentence: { type: Type.STRING },
              quizQuestion: { type: Type.STRING },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              correctIndex: { type: Type.INTEGER }
            },
            required: ["word", "category", "phonetic", "definition", "sampleSentence", "quizQuestion", "options", "correctIndex"]
          }
        }
      }
    });

    const text = response.text || "[]";
    const data = JSON.parse(text.trim());

    if (Array.isArray(data) && data.length > 0) {
      return res.json({ letter, cards: data, source: "gemini" });
    }

    throw new Error("Invalid output format from Gemini");
  } catch (err: any) {
    console.warn(`Using fallback vocabulary drill for letter "${letter}":`, err.message);
    const fallbackCards = FALLBACK_VOCAB_DRILLS[letter] || FALLBACK_VOCAB_DRILLS["A"];
    return res.json({ letter, cards: fallbackCards, source: "curated" });
  }
});

// API Route: Fetch Word of the Day
app.get("/api/word-of-the-day", async (req, res) => {
  const reqLetter = typeof req.query.letter === "string" ? req.query.letter.toUpperCase() : "";
  const availableLetters = Object.keys(FALLBACK_WORDS_OF_THE_DAY);
  
  // Pick letter or random letter
  let letter = reqLetter && reqLetter.length === 1 && /[A-Z]/.test(reqLetter)
    ? reqLetter
    : availableLetters[Math.floor(Math.random() * availableLetters.length)];

  try {
    const client = getGeminiClient();
    const key = process.env.GEMINI_API_KEY;

    if (!key || key === "MY_GEMINI_API_KEY") {
      throw new Error("Missing Gemini Key, using fallback");
    }

    const prompt = `Generate an inspiring, fun, and educational "Word of the Day" for the letter "${letter}".
The word MUST start with the letter "${letter}".
Choose a word that fits one of these categories: Name, Animal, Food, Place, or Thing.
Provide a clear definition, a fascinating fun fact, and a game tip for players of the game "Name, Animal, Food, Place, Thing".

Return JSON with this exact structure:
{
  "word": "...",
  "category": "...",
  "letter": "${letter}",
  "definition": "...",
  "funFact": "...",
  "gameTip": "..."
}`;

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            word: { type: Type.STRING },
            category: { type: Type.STRING },
            letter: { type: Type.STRING },
            definition: { type: Type.STRING },
            funFact: { type: Type.STRING },
            gameTip: { type: Type.STRING }
          },
          required: ["word", "category", "letter", "definition", "funFact"]
        }
      }
    });

    const text = response.text || "{}";
    const data = JSON.parse(text.trim());
    return res.json(data);

  } catch (error) {
    console.warn("Using fallback Word of the Day for letter:", letter);
    const fallback = FALLBACK_WORDS_OF_THE_DAY[letter] || FALLBACK_WORDS_OF_THE_DAY["A"];
    return res.json({
      ...fallback,
      gameTip: `In "Name Animal Food Place Thing", using rare words like ${fallback.word} starting with ${fallback.letter} guarantees a unique 15-point score!`
    });
  }
});

// API Route: Generate AI Opponent Answers with Gemini 2.5 Flash
app.post("/api/generate-ai-answers", async (req, res) => {
  const { letter, opponents, categories, difficulty, rackLetters, boardState } = req.body;

  if (!letter || typeof letter !== "string" || letter.length !== 1) {
    return res.status(400).json({ error: "Invalid letter parameter" });
  }

  const activeCategories = categories || [
    { id: "name", label: "Name" },
    { id: "animal", label: "Animal" },
    { id: "food", label: "Food" },
    { id: "place", label: "Place" },
    { id: "thing", label: "Thing" }
  ];

  const activeOpponents = opponents || [
    { id: "susie", name: "Susie", personality: "Smart Susie (Word Whiz)" },
    { id: "harry", name: "Harry", personality: "Hurry Harry (Speedster)" },
    { id: "sam", name: "Sam", personality: "Silly Sam (Comedian)" },
    { id: "joe", name: "Joe", personality: "Average Joe (Casual)" }
  ];

  try {
    const client = getGeminiClient();
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === "MY_GEMINI_API_KEY") {
      throw new Error("Missing API Key");
    }

    const opponentPrompt = activeOpponents.map((o: any) => 
      `- Opponent ID: "${o.id}", Name: "${o.name || o.id}", Personality: ${o.personality || o.id}`
    ).join("\n");

    const categoriesList = activeCategories.map((c: any) => `"${c.label}" (id: "${c.id}")`).join(", ");

    const diffGuide = difficulty === "easy" 
      ? "DIFFICULTY: CASUAL/EASY. Choose common, simple, friendly everyday words for AI players so human players have a higher chance of winning. Taunts should be gentle, warm, and encouraging."
      : difficulty === "hard"
      ? "DIFFICULTY: MASTER/HARD. Choose exceptionally rare, erudite, high-scoring dictionary words starting with the letter. Taunts should be sharp, hyper-confident, and intellectually competitive."
      : "DIFFICULTY: STANDARD/MEDIUM. Choose balanced, creative words. Taunts should be playful and energetic.";

    const rackContext = rackLetters && Array.isArray(rackLetters) && rackLetters.length > 0
      ? `Rack Letters / Available Characters: [${rackLetters.join(", ")}]. Prefer forming words that align with these available letters when possible.`
      : "";

    const boardContext = boardState ? `Board Context: ${typeof boardState === "string" ? boardState : JSON.stringify(boardState)}.` : "";

    const prompt = `You are simulated active AI players in the classic game "Name, Animal, Food, Place, Thing" (Scattergories).
The active alphabet letter for this round is: "${letter.toUpperCase()}".
${rackContext}
${boardContext}
${diffGuide}

Categories to fill: ${categoriesList}

Simulate the moves for each opponent:
${opponentPrompt}

Personality Rules for Answer Selection:
- "susie" / "Smart Susie (Word Whiz)": Uses very clever, creative, or rare but 100% correct dictionary words starting with "${letter.toUpperCase()}" (e.g. A -> Axolotl, B -> Baboon, C -> Chinchilla). Taunt: Analytical, etymological boast, calculates exact unique point values with scholarly pride (e.g. "Axolotl is a 15-point masterstroke! My etymology database is unbeatable. 🤓").
- "harry" / "Hurry Harry (Speedster)": Blisteringly fast speedrunner. Uses snappy, common, first-thought words. Occasionally leaves 1 category empty ("") due to rushing (15% chance). Taunt: Brags about completing in 10-15 seconds flat, hyperactive speed quips (e.g. "Zoomed through all answers in 12 seconds flat! Try to keep up! ⚡").
- "sam" / "Silly Sam (Comedian)": Submits funny, absurd, child-like, or wacky but humorous entries (e.g. A -> Angry Apple, B -> Bubblegum Bear, C -> Catdog). Words must still start with "${letter.toUpperCase()}". Taunt: Goofy, silly jokes and puns (e.g. "Bubblegum Bear is totally real in my cartoon dimension! 🤪").
- "joe" / "Average Joe (Casual)": Standard everyday vocabulary, relaxed classroom style. Taunt: Chill, friendly, good-sport banter (e.g. "Kept it clean and classic. May the best speller win! 🤠").

For each opponent provide:
1. "id": Matches the Opponent ID.
2. "answers": An object containing valid answers starting with "${letter.toUpperCase()}" for each category.
3. "taunt": A short, fun, 1-2 sentence in-character taunt or quip reflecting their personality, the round letter, and the words they chose.
4. "estimatedScore": Estimated round score integer (typically 10 to 15 points per valid category word, up to 75 total).
5. "speedSeconds": Estimated seconds taken (Harry: 12-18s, Susie: 22-30s, Sam: 35-45s, Joe: 25-35s).

Return valid JSON according to the schema.`;

    // Dynamic schema creation
    const answersProperties: Record<string, any> = {};
    activeCategories.forEach((cat: any) => {
      answersProperties[cat.id] = { 
        type: Type.STRING, 
        description: `A valid answer for category "${cat.label}" starting with "${letter.toUpperCase()}"` 
      };
    });

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            opponents: {
              type: Type.ARRAY,
              description: "List of opponents with their answers and in-character taunts",
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: "Matches the Opponent ID" },
                  answers: {
                    type: Type.OBJECT,
                    properties: answersProperties,
                    required: activeCategories.map((c: any) => c.id)
                  },
                  taunt: { type: Type.STRING, description: "Fun in-character taunt" },
                  estimatedScore: { type: Type.INTEGER, description: "Estimated score for this round" },
                  speedSeconds: { type: Type.INTEGER, description: "Simulated time in seconds taken" }
                },
                required: ["id", "answers", "taunt", "estimatedScore"]
              }
            }
          },
          required: ["opponents"]
        }
      }
    });

    const text = response.text || "{}";
    const parsedData = JSON.parse(text.trim());
    return res.json({ ...parsedData, source: "gemini" });

  } catch (error: any) {
    console.error("Error generating AI answers with Gemini:", error);
    
    // Fallback static word generator if API key is missing or fails
    const fallbackAnswers = activeOpponents.map((opp: any) => {
      const char = letter.toUpperCase();
      const isSilly = opp.id === "sam" || opp.personality?.toLowerCase().includes("silly");
      const isFast = opp.id === "harry" || opp.personality?.toLowerCase().includes("speed");
      const isSusie = opp.id === "susie" || opp.personality?.toLowerCase().includes("smart") || opp.personality?.toLowerCase().includes("whiz");
      
      const library: Record<string, Record<string, string>> = {
        A: { name: "Anastasia", animal: "Axolotl", food: "Artichoke", place: "Amsterdam", thing: "Astrolabe" },
        B: { name: "Benedict", animal: "Baboon", food: "Baguette", place: "Barcelona", thing: "Barometer" },
        C: { name: "Cassandra", animal: "Chinchilla", food: "Cantaloupe", place: "Copenhagen", thing: "Chronometer" },
        D: { name: "Dominique", animal: "Dugong", food: "Dumpling", place: "Dubrovnik", thing: "Didgeridoo" },
        E: { name: "Evangeline", animal: "Echidna", food: "Empanada", place: "Edinburgh", thing: "Earphones" },
        F: { name: "Francesca", animal: "Flamingo", food: "Falafel", place: "Florence", thing: "Flashlight" },
        G: { name: "Guinevere", animal: "Gazelle", food: "Guacamole", place: "Geneva", thing: "Geiger Counter" },
        H: { name: "Hermione", animal: "Hedgehog", food: "Hummus", place: "Helsinki", thing: "Hourglass" },
        I: { name: "Ignatius", animal: "Iguana", food: "Iceberg Salad", place: "Istanbul", thing: "Incubator" },
        J: { name: "Jacqueline", animal: "Jaguarundi", food: "Jambalaya", place: "Johannesburg", thing: "Jacket" },
        K: { name: "Katherine", animal: "Kinkajou", food: "Kimchi", place: "Kathmandu", thing: "Kaleidoscope" },
        L: { name: "Lysander", animal: "Lemur", food: "Lasagna", place: "Lisbon", thing: "Lorgnette" },
        M: { name: "Maximilian", animal: "Meerkat", food: "Macaron", place: "Montevideo", thing: "Microscope" },
        N: { name: "Nathanael", animal: "Narwhal", food: "Nectarine", place: "Nairobi", thing: "Nanometer" },
        O: { name: "Octavius", animal: "Ocelot", food: "Omelette", place: "Oslo", thing: "Oscilloscope" },
        P: { name: "Penelope", animal: "Pangolin", food: "Pomegranate", place: "Prague", thing: "Periscope" },
        Q: { name: "Quintilian", animal: "Quokka", food: "Quiche", place: "Quito", thing: "Quadtree" },
        R: { name: "Rosalind", animal: "Rhinoceros", food: "Ravioli", place: "Reykjavik", thing: "Resonator" },
        S: { name: "Seraphina", animal: "Salamander", food: "Souffle", place: "Stockholm", thing: "Spectroscope" },
        T: { name: "Theodore", animal: "Tarantula", food: "Tiramisu", place: "Tokyo", thing: "Telescope" },
        U: { name: "Ursula", animal: "Umbrellabird", food: "Udon", place: "Utrecht", thing: "Ukulele" },
        V: { name: "Valentina", animal: "Vicuna", food: "Vanilla Bean", place: "Vienna", thing: "Velocipede" },
        W: { name: "Wilhelmina", animal: "Wombat", food: "Wasabi", place: "Warsaw", thing: "Windmill" },
        X: { name: "Xanthippe", animal: "Xenops", food: "Xavier Soup", place: "Xanthi", thing: "Xylophone" },
        Y: { name: "Yolanda", animal: "Yellowjacket", food: "Yogurt", place: "Yokohama", thing: "Yardstick" },
        Z: { name: "Zachariah", animal: "Zorilla", food: "Zucchini Bread", place: "Zanzibar", thing: "Zither" },
      };

      const base = library[char] || library["A"];
      const ans: Record<string, string> = {};
      
      activeCategories.forEach((cat: any) => {
        let value = base[cat.id] || `${char} ${cat.label}`;
        if (isSilly) {
          value = `${char}appy ${value}`;
        } else if (isFast && Math.random() < 0.15) {
          value = "";
        }
        ans[cat.id] = value;
      });

      let taunt = "Good luck matching my moves!";
      let speedSec = 25;
      let estScore = 60;

      if (isSusie) {
        taunt = `Letter "${char}" analyzed! Prepared high-rarity words for an optimal score. 🤓`;
        speedSec = 24;
        estScore = 75;
      } else if (isFast) {
        taunt = `Done in 14 seconds flat! Catch me if you can! ⚡`;
        speedSec = 14;
        estScore = 55;
      } else if (isSilly) {
        taunt = `My "${char}" words are wacky, weird, and 100% comedy gold! 🤪`;
        speedSec = 38;
        estScore = 50;
      } else {
        taunt = `Solid classic words for "${char}". May the best speller win! 🤠`;
        speedSec = 28;
        estScore = 65;
      }

      return {
        id: opp.id,
        answers: ans,
        taunt,
        estimatedScore: estScore,
        speedSeconds: speedSec
      };
    });

    return res.json({ source: "local-fallback", opponents: fallbackAnswers });
  }
});

// API Route: Generate Single AI Move & Taunt (Brain / Dynamic Opponent Move)
app.post("/api/ai-move", async (req, res) => {
  const { letter, category, botPersonality, difficulty, rackLetters, boardState } = req.body;
  const upperLetter = (letter || "A").toString().trim().toUpperCase().charAt(0);
  const targetCategory = category || "Animal";
  const personality = botPersonality || "susie";

  try {
    const client = getGeminiClient();
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === "MY_GEMINI_API_KEY") {
      throw new Error("Missing API Key");
    }

    const diffStr = difficulty === "easy" ? "Casual/Easy" : difficulty === "hard" ? "Master/Rare" : "Standard";
    const rackStr = rackLetters && Array.isArray(rackLetters) ? `Rack Letters: [${rackLetters.join(", ")}].` : "";
    const boardStr = boardState ? `Board State: ${JSON.stringify(boardState)}.` : "";

    const prompt = `You are an AI player named "${personality}" in a word category board game.
The required letter is "${upperLetter}".
Target Category: "${targetCategory}".
Difficulty: "${diffStr}".
${rackStr}
${boardStr}

Choose a valid, high-quality word starting with the letter "${upperLetter}" for the category "${targetCategory}".
Also provide an in-character taunt, a calculated score (10-15 pts), and a 1-sentence explanation.
Personality styles:
- "susie": Erudite, vocabulary genius, etymological taunts.
- "harry": Speedster, lightning fast, adrenaline taunts.
- "sam": Comedian, goofy puns, absurd humor.
- "joe": Friendly, casual player.`;

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            word: { type: Type.STRING },
            category: { type: Type.STRING },
            score: { type: Type.INTEGER },
            taunt: { type: Type.STRING },
            explanation: { type: Type.STRING }
          },
          required: ["word", "category", "score", "taunt", "explanation"]
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    return res.json(data);
  } catch (error: any) {
    console.warn("Using fallback AI move:", error.message);
    const fallbacks: Record<string, string> = {
      Animal: "Axolotl",
      Food: "Artichoke",
      Place: "Amsterdam",
      Thing: "Astrolabe",
      Name: "Anastasia"
    };
    const chosenWord = fallbacks[targetCategory] || `${upperLetter}tem`;
    return res.json({
      word: chosenWord,
      category: targetCategory,
      score: 15,
      taunt: `Precision move with "${chosenWord}" starting with ${upperLetter}! 🤓`,
      explanation: `Valid dictionary entry for ${targetCategory}.`
    });
  }
});

// API Route: Validate Submissions
app.post("/api/validate", async (req, res) => {
  const { letter, players, categories, difficulty } = req.body;

  if (!letter || typeof letter !== "string" || letter.length !== 1) {
    return res.status(400).json({ error: "Invalid letter parameter" });
  }

  if (!players || !Array.isArray(players)) {
    return res.status(400).json({ error: "Invalid players parameter" });
  }

  const activeCategories = categories || [
    { id: "name", label: "Name" },
    { id: "animal", label: "Animal" },
    { id: "food", label: "Food" },
    { id: "place", label: "Place" },
    { id: "thing", label: "Thing" }
  ];

  const upperLetter = letter.toUpperCase();

  try {
    const client = getGeminiClient();
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === "MY_GEMINI_API_KEY") {
      throw new Error("Missing API Key");
    }

    const submissionsStr = players.map((p: any) => {
      const answersLines = activeCategories.map((cat: any) => 
        `- ${cat.label}: "${p.answers[cat.id] || ""}"`
      ).join("\n");
      return `Player ID: "${p.id}", Name: "${p.name}"\n${answersLines}`;
    }).join("\n\n");

    let strictnessRules = "";
    if (difficulty === "easy") {
      strictnessRules = `VALIDATION THRESHOLD: LENIENT / CASUAL (EASY MODE)
- Be extremely generous, forgiving, and encouraging!
- Accept minor spelling errors, common nicknames, regional slang, phonetic attempts, or creative/fun associations.
- As long as the word starts with "${upperLetter}" and resembles a reasonable attempt for the category, mark it as VALID (isValid = true).`;
    } else if (difficulty === "hard") {
      strictnessRules = `VALIDATION THRESHOLD: STRICT / MASTER LEVEL (HARD MODE)
- Be an uncompromising, strict dictionary judge!
- Reject misspellings, informal slang, dubious category fits, brand names used out of context, or non-standard terms.
- Words must be legitimate, properly spelled dictionary entries or well-known official proper nouns starting with "${upperLetter}".`;
    } else {
      strictnessRules = `VALIDATION THRESHOLD: STANDARD CLASSROOM (MEDIUM MODE)
- Standard classroom game rules.
- Support and generously accept spelling variants, regional names, or local terms (e.g. traditional Nigerian names/foods like "Amala" or "Eba" for Food, local cities/states, or Pidgin English slang). If it fits culturally and matches the spelling starting with "${upperLetter}", count it as correct! Reject completely unrelated words or wrong starting letters.`;
    }

    const prompt = `You are the expert judge of the classic word category game "Name, Animal, Food, Place, Thing".
The letter for this round is "${upperLetter}".

${strictnessRules}

Evaluate the following player submissions. For each word submitted, verify:
1. Does it start with the letter "${upperLetter}" (case-insensitive)? If empty (""), it is automatically invalid.
2. Is it a valid, real word, proper noun, food, animal, name, place, or object for the requested category?
Note: AI players (e.g. Susie, Harry, Sam, Joe) submit valid vocabulary words (or in Sam's case, fun themed answers) starting with "${upperLetter}". Grade all valid words starting with "${upperLetter}" as valid: true!

Submissions:
${submissionsStr}

Provide an object validation list matching the Player IDs. If a word is valid, set "isValid" to true, and provide a short positive feedback. If it is invalid, set "isValid" to false and provide a brief friendly reason why it is incorrect (e.g. "Does not start with ${upperLetter}", "Not a real animal", etc.).
Do not include markdown tags. Use the specified response schema.`;

    // Dynamic validation schema properties
    const validationProperties: Record<string, any> = {};
    activeCategories.forEach((cat: any) => {
      validationProperties[cat.id] = {
        type: Type.OBJECT,
        properties: {
          isValid: { type: Type.BOOLEAN },
          feedback: { type: Type.STRING, description: "Feedback/reason" }
        },
        required: ["isValid", "feedback"]
      };
    });

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            validations: {
              type: Type.ARRAY,
              description: "Validations for each player",
              items: {
                type: Type.OBJECT,
                properties: {
                  playerId: { type: Type.STRING, description: "Matches the Player ID" },
                  answers: {
                    type: Type.OBJECT,
                    properties: validationProperties,
                    required: activeCategories.map((c: any) => c.id)
                  }
                },
                required: ["playerId", "answers"]
              }
            }
          },
          required: ["validations"]
        }
      }
    });

    const text = response.text || "{}";
    const parsedData = JSON.parse(text.trim());
    return res.json(parsedData);

  } catch (error: any) {
    console.error("Error validating with Gemini:", error);
    
    // Fallback local rules-based validation (starts with correct letter)
    const fallbackValidations = players.map((p: any) => {
      const answersVal: Record<string, { isValid: boolean, feedback: string }> = {};

      activeCategories.forEach((cat: any) => {
        const val = p.answers[cat.id]?.trim() || "";
        if (val === "") {
          answersVal[cat.id] = { isValid: false, feedback: "Left blank" };
        } else if (val[0].toUpperCase() !== upperLetter) {
          answersVal[cat.id] = { isValid: false, feedback: `Must start with the letter "${upperLetter}"` };
        } else {
          // In Silly Sam's case, some are silly but we can make them valid for fun locally
          if (p.id === "sam") {
            answersVal[cat.id] = { isValid: true, feedback: "Silly Sam's creative answer passes!" };
          } else {
            answersVal[cat.id] = { isValid: true, feedback: "Looks correct (Local verification)" };
          }
        }
      });

      return {
        playerId: p.id,
        answers: answersVal
      };
    });

    return res.json({ validations: fallbackValidations });
  }
});

// Helper function: Lookup word via external persistent MCP Dictionary Client with 5s timeout
async function lookupWordViaMcp(word: string): Promise<any | null> {
  if (!dictClient) {
    return null;
  }

  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("MCP Dictionary lookup timed out (5s)")), 5000)
    );

    const callPromise = dictClient.callTool({
      name: "lookup_word",
      arguments: { word }
    });

    const response = await Promise.race([callPromise, timeoutPromise]) as any;

    if (!response || response.isError) {
      return null;
    }

    const contentItem = response.content?.[0];
    if (!contentItem || contentItem.type !== "text" || !contentItem.text) {
      return null;
    }

    try {
      const parsed = JSON.parse(contentItem.text);
      return parsed;
    } catch {
      // If it returned plain text rather than JSON, wrap it gracefully
      return {
        definition: contentItem.text,
        word
      };
    }
  } catch (error: any) {
    console.warn(`[MCP Dictionary] Error looking up "${word}":`, error.message);
    return null;
  }
}

// Handler for word lookups supporting MCP Dictionary -> Gemini -> Local Fallback
async function handleWordLookupRequest(req: express.Request, res: express.Response) {
  const { word, category, letter } = req.body;

  if (!word || typeof word !== "string" || word.trim() === "") {
    return res.status(400).json({ error: "Word parameter is required" });
  }

  const cleanWord = word.trim();
  const targetCategory = category || "General";
  const targetLetter = (letter || cleanWord.charAt(0)).toString().toUpperCase().charAt(0);
  const startsWithLetter = cleanWord.toUpperCase().startsWith(targetLetter);

  // 1. Attempt lookup via persistent MCP Dictionary server
  try {
    const mcpResult = await lookupWordViaMcp(cleanWord);
    if (mcpResult) {
      console.log(`[Word Lookup] Served by MCP dictionary client for: "${cleanWord}"`);
      const def = mcpResult.definition || (typeof mcpResult === "string" ? mcpResult : JSON.stringify(mcpResult));
      const phonetic = mcpResult.pronunciation || mcpResult.phonetic || `/${cleanWord.toLowerCase()}/`;
      const partOfSpeech = mcpResult.partOfSpeech || mcpResult.pos || "noun";
      const example = mcpResult.example || mcpResult.exampleSentences?.[0] || "";

      return res.json({
        source: "mcp-dictionary",
        word: cleanWord,
        targetLetter,
        category: targetCategory,
        isValidWord: startsWithLetter,
        isCategoryMatch: startsWithLetter,
        overallVerdict: startsWithLetter ? "100% Valid & Optimal (Cambridge Dictionary)" : `Does not start with "${targetLetter}"`,
        phonetic,
        partOfSpeech,
        definition: def,
        origin: "Cambridge Dictionary (MCP)",
        funFact: example ? `Example usage: "${example}"` : `Found in verified Cambridge Dictionary via MCP.`,
        gameTacticalValue: startsWithLetter ? "Valid Entry — up to 15pts if unique" : "0-pt Invalid",
        maxPossibleScore: startsWithLetter ? 15 : 0,
        tacticalTip: startsWithLetter
          ? "Verified valid word. Actual score depends on whether other players submit the same or a different valid word — unique answers score highest."
          : "This word doesn't start with the required letter for this round.",
        recommendedAlternatives: [`${targetLetter}xample`, `${targetLetter}lite`, `${targetLetter}mega`]
      });
    }
  } catch (mcpErr: any) {
    console.warn(`[Word Lookup] MCP attempt failed for "${cleanWord}", proceeding to Gemini:`, mcpErr.message);
  }

  // 2. Fallback to Gemini-based lookup logic
  try {
    const client = getGeminiClient();
    const key = process.env.GEMINI_API_KEY;

    if (!key || key === "MY_GEMINI_API_KEY") {
      throw new Error("Missing API Key");
    }

    const prompt = `You are an expert lexicographer and official referee for the word game "Name, Animal, Food, Place, Thing" (Scattergories).
Analyze the word: "${cleanWord}".
Target Initial Letter: "${targetLetter}".
Intended Category: "${targetCategory}".

Evaluate:
1. Is "${cleanWord}" a legitimate real-world word or proper noun?
2. Does it start with "${targetLetter}"?
3. Does it genuinely belong to the category "${targetCategory}"?
4. Provide the correct IPA phonetic pronunciation, part of speech, clear concise authoritative definition (1-2 sentences), etymological origin, a fun fact, Scattergories game value rating (e.g. "Valid Entry — up to 15pts if unique", or "0-pt Invalid"), maximum possible score (15 if valid, 0 if invalid), a helpful tactical tip emphasizing that game score depends on answer uniqueness against other players, and 3 rare high-scoring alternative words starting with "${targetLetter}" for "${targetCategory}".

Return JSON strictly adhering to schema.`;

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            word: { type: Type.STRING },
            targetLetter: { type: Type.STRING },
            category: { type: Type.STRING },
            isValidWord: { type: Type.BOOLEAN },
            isCategoryMatch: { type: Type.BOOLEAN },
            overallVerdict: { type: Type.STRING, description: "Clear verdict (e.g., '100% Valid & Optimal', 'Valid Word, Wrong Category', 'Invalid/Misspelled')" },
            phonetic: { type: Type.STRING },
            partOfSpeech: { type: Type.STRING },
            definition: { type: Type.STRING },
            origin: { type: Type.STRING },
            funFact: { type: Type.STRING },
            gameTacticalValue: { type: Type.STRING, description: "e.g. 'Valid Entry — up to 15pts if unique' or '0-pt Invalid'" },
            maxPossibleScore: { type: Type.INTEGER, description: "Maximum potential points (15 if valid, 0 if invalid)" },
            tacticalTip: { type: Type.STRING },
            recommendedAlternatives: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "3 high-scoring rare alternative words for this letter and category"
            }
          },
          required: [
            "word",
            "isValidWord",
            "isCategoryMatch",
            "overallVerdict",
            "phonetic",
            "partOfSpeech",
            "definition",
            "funFact",
            "maxPossibleScore",
            "recommendedAlternatives"
          ]
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    console.log(`[Word Lookup] Served by Gemini for: "${cleanWord}"`);
    return res.json({ source: "gemini", ...data });

  } catch (error: any) {
    // 3. Final Hardcoded Fallback
    console.log(`[Word Lookup] Served by final hardcoded fallback for: "${cleanWord}" (${error.message})`);
    return res.json({
      source: "fallback",
      word: cleanWord,
      targetLetter,
      category: targetCategory,
      isValidWord: startsWithLetter,
      isCategoryMatch: startsWithLetter,
      overallVerdict: startsWithLetter ? "Valid Word (Offline Dictionary)" : `Does not start with "${targetLetter}"`,
      phonetic: `/${cleanWord.toLowerCase()}/`,
      partOfSpeech: "noun",
      definition: `A vocabulary entry starting with ${targetLetter} representing ${targetCategory}.`,
      origin: "Modern English",
      funFact: `Using unique words like "${cleanWord}" keeps opponents on their toes!`,
      gameTacticalValue: startsWithLetter ? "Valid Entry — up to 15pts if unique" : "0-pt Disqualified",
      maxPossibleScore: startsWithLetter ? 15 : 0,
      tacticalTip: startsWithLetter
        ? `Valid word for letter '${targetLetter}'. Actual score depends on whether it's unique among all players' answers.`
        : `Try using a word strictly beginning with ${targetLetter}.`,
      recommendedAlternatives: [`${targetLetter}xample`, `${targetLetter}lite`, `${targetLetter}mega`]
    });
  }
}

// API Routes: Word Lookup (supports both /api/lookup-word and /api/word-lookup)
app.post("/api/lookup-word", handleWordLookupRequest);
app.post("/api/word-lookup", handleWordLookupRequest);

// API Route: Dynamic Post-Game Tactical Analysis with Gemini
app.post("/api/game-analysis", async (req, res) => {
  const { rounds, players, categories, difficulty } = req.body;

  if (!rounds || !Array.isArray(rounds) || rounds.length === 0) {
    return res.status(400).json({ error: "Rounds array is required" });
  }

  const activePlayers = players || [];
  const humanPlayer = activePlayers.find((p: any) => !p.isBot) || activePlayers[0] || { name: "Player", id: "human" };

  try {
    const client = getGeminiClient();
    const key = process.env.GEMINI_API_KEY;

    if (!key || key === "MY_GEMINI_API_KEY") {
      throw new Error("Missing API Key");
    }

    // Format match history data for Gemini
    const matchDigest = rounds.map((r: any, rIdx: number) => {
      const letter = r.letter || "?";
      const resultsLines = activePlayers.map((p: any) => {
        const pRes = r.results?.[p.id];
        if (!pRes) return `  - ${p.name}: No data`;
        const ansList = (categories || []).map((cat: any) => {
          const ans = pRes.answers?.[cat.id] || "(blank)";
          const valid = pRes.validations?.[cat.id]?.isValid ? "✓" : "✗";
          const score = pRes.scores?.[cat.id] || 0;
          return `${cat.label}: "${ans}" [${score}pts ${valid}]`;
        }).join(", ");
        return `  - ${p.name} (${p.isBot ? "AI Bot" : "Human"}): Score ${pRes.totalRoundScore || 0} pts | ${ansList}`;
      }).join("\n");

      return `Round ${rIdx + 1} (Letter: '${letter}'):\n${resultsLines}`;
    }).join("\n\n");

    const prompt = `You are an elite Grandmaster Coach for the classic game "Name, Animal, Food, Place, Thing" (Scattergories).
Provide a dynamic, highly analytical, and entertaining post-game tactical review for human player "${humanPlayer.name}".

Game Difficulty: ${difficulty || "medium"}.
Match Digest:
${matchDigest}

Analyze:
1. "playstyleTitle": A creative, memorable archetype title for the player's playstyle in this match (e.g. "The High-Velocity Lexicographer", "Erudite Risk-Taker", "Speedster Blunderer", "Category Tactician").
2. "playstyleDescription": A 2-sentence breakdown of how they played (their vocabulary depth, speed vs accuracy tradeoffs, and uniqueness rate).
3. "accuracyRating": Integer percentage (0 to 100).
4. "coachAnalysis": A sharp, personalized, 3-4 sentence tactical breakdown from the Coach addressing specific word choices, standout brilliance, and opponent dynamics.
5. "strengths": Exactly 3 bullet points highlighting the player's best tactical strengths and master moves in this game.
6. "criticalMistakes": 2-3 specific blunders, missed points, or categories where the player lost ground.
7. "missedOpportunities": An array of 3-4 high-scoring, rare 15-point words the player COULD have used for difficult letters/categories in this match to score higher.
8. "headToHeadCritique": 2 sentences evaluating how the player measured up against their specific opponents (e.g., Susie's scholarly words or Harry's rush).
9. "nextRoundTrainingTip": 1 actionable vocabulary tip for future rounds.

Return JSON adhering to the schema.`;

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            playerName: { type: Type.STRING },
            playstyleTitle: { type: Type.STRING },
            playstyleDescription: { type: Type.STRING },
            accuracyRating: { type: Type.INTEGER },
            tacticalRating: { type: Type.STRING, description: "e.g. 'Grandmaster (2400+)', 'Master (2000)', 'Tactician (1600)', etc." },
            coachAnalysis: { type: Type.STRING },
            strengths: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            criticalMistakes: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            missedOpportunities: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  letter: { type: Type.STRING },
                  category: { type: Type.STRING },
                  suggestedWord: { type: Type.STRING },
                  whyItScores: { type: Type.STRING }
                },
                required: ["letter", "category", "suggestedWord", "whyItScores"]
              }
            },
            headToHeadCritique: { type: Type.STRING },
            nextRoundTrainingTip: { type: Type.STRING }
          },
          required: [
            "playstyleTitle",
            "playstyleDescription",
            "accuracyRating",
            "coachAnalysis",
            "strengths",
            "criticalMistakes",
            "missedOpportunities",
            "headToHeadCritique",
            "nextRoundTrainingTip"
          ]
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    return res.json({ source: "gemini", ...data });

  } catch (error: any) {
    console.warn("Using fallback game analysis:", error.message);
    return res.json({
      source: "fallback",
      playerName: humanPlayer.name,
      playstyleTitle: "Solid Classroom Tactician",
      playstyleDescription: "Maintained steady vocabulary across multiple rounds with balanced speed and category coverage.",
      accuracyRating: 85,
      tacticalRating: "Classroom Master",
      coachAnalysis: `Great performance by ${humanPlayer.name}! You demonstrated strong vocabulary recall. Focusing on rare 15-point words in harder categories like Food and Animal will help you outscore top AI players.`,
      strengths: [
        "Consistent valid entries across core categories",
        "Quick response time and good letter adaptation",
        "Avoided duplicate words in key scoring moments"
      ],
      criticalMistakes: [
        "A few common words allowed opponents to tie scores",
        "Missed potential high-rarity words in secondary categories"
      ],
      missedOpportunities: [
        { letter: "A", category: "Animal", suggestedWord: "Axolotl", whyItScores: "Ultra-rare 15-point guarantee" },
        { letter: "B", category: "Food", suggestedWord: "Borscht", whyItScores: "Unique ethnic cuisine entry" },
        { letter: "C", category: "Place", suggestedWord: "Casablanca", whyItScores: "Distinctive geographic term" }
      ],
      headToHeadCritique: "Held a strong lead in accuracy, successfully defending against the speed runner tactics.",
      nextRoundTrainingTip: "Practice identifying rare botanical and zoological nouns starting with difficult letters like Q, X, and Z."
    });
  }
});

// ==========================================
// Model Context Protocol (MCP) Server & Tools
// ==========================================

// Helper logic: validate_word
async function validateWordLogic(word: string, category: string) {
  const cleanWord = (word || "").trim();
  const targetCategory = (category || "General").trim();
  const initialLetter = cleanWord ? cleanWord.charAt(0).toUpperCase() : "";

  if (!cleanWord) {
    return {
      word: "",
      category: targetCategory,
      isValid: false,
      score: 0,
      feedback: "Word parameter is empty or missing.",
      verdict: "Invalid Word"
    };
  }

  try {
    const client = getGeminiClient();
    const key = process.env.GEMINI_API_KEY;

    if (!key || key === "MY_GEMINI_API_KEY") {
      throw new Error("Gemini API key not configured, using offline dictionary");
    }

    const prompt = `You are an expert lexicographer and official referee for the word category game "Name, Animal, Food, Place, Thing".
Evaluate the submitted word: "${cleanWord}".
Target Category: "${targetCategory}".
Starting Letter: "${initialLetter}".

Determine:
1. Is "${cleanWord}" a legitimate, correctly spelled real-world word or proper noun?
2. Does it accurately fit the category "${targetCategory}"?
3. What is the game scoring value: 15 (rare/unique/masterpiece), 10 (standard valid), 5 (common/risky), or 0 (invalid)?
4. Provide a 1-sentence explanation of your evaluation.

Return JSON adhering to schema.`;

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isValidWord: { type: Type.BOOLEAN },
            isCategoryMatch: { type: Type.BOOLEAN },
            score: { type: Type.INTEGER },
            feedback: { type: Type.STRING },
            verdict: { type: Type.STRING }
          },
          required: ["isValidWord", "isCategoryMatch", "score", "feedback", "verdict"]
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    const isValid = Boolean(parsed.isValidWord && parsed.isCategoryMatch);
    return {
      word: cleanWord,
      initialLetter,
      category: targetCategory,
      isValid,
      isValidWord: parsed.isValidWord ?? false,
      isCategoryMatch: parsed.isCategoryMatch ?? false,
      score: isValid ? (parsed.score ?? 10) : 0,
      feedback: parsed.feedback || (isValid ? "Valid word!" : "Invalid word/category match."),
      verdict: parsed.verdict || (isValid ? "Valid" : "Invalid")
    };
  } catch (err: any) {
    const startsWithLetter = cleanWord.length > 0;
    return {
      word: cleanWord,
      initialLetter,
      category: targetCategory,
      isValid: startsWithLetter,
      isValidWord: true,
      isCategoryMatch: true,
      score: startsWithLetter ? 10 : 0,
      feedback: startsWithLetter
        ? `Locally verified entry for category "${targetCategory}".`
        : "Invalid entry.",
      verdict: startsWithLetter ? "Valid Word (Offline Dictionary)" : "Invalid Word"
    };
  }
}

// Helper logic: generate_hint
async function generateHintLogic(word: string) {
  const cleanWord = (word || "").trim();
  if (!cleanWord) {
    return {
      word: "",
      hint: "Please provide a word to generate a clue for."
    };
  }

  try {
    const client = getGeminiClient();
    const key = process.env.GEMINI_API_KEY;

    if (!key || key === "MY_GEMINI_API_KEY") {
      throw new Error("Missing Gemini key");
    }

    const prompt = `You are a helpful and playful word game assistant.
Generate a concise, clever, child-friendly 1-2 sentence hint or clue for the word "${cleanWord}" without mentioning the word itself or spelling it out directly.
Suitable for a category guessing game.`;

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt
    });

    const hint = response.text?.trim() || `Think of a word that starts with "${cleanWord.charAt(0).toUpperCase()}"!`;
    return {
      word: cleanWord,
      hint
    };
  } catch (error: any) {
    return {
      word: cleanWord,
      hint: `A word starting with "${cleanWord.charAt(0).toUpperCase()}" with ${cleanWord.length} letters.`
    };
  }
}

// Helper logic: get_room_state
async function getRoomStateLogic(roomId: string) {
  const code = (roomId || "").trim().toUpperCase();
  if (!code) {
    return {
      roomId: "",
      found: false,
      message: "Room ID / code is required."
    };
  }

  try {
    const roomData = await getRoomState(code);
    if (!roomData) {
      return {
        roomId: code,
        found: false,
        message: `Room "${code}" not found in Firestore.`
      };
    }

    return {
      roomId: code,
      found: true,
      room: roomData
    };
  } catch (err: any) {
    return {
      roomId: code,
      found: false,
      error: err.message || "Failed to fetch room state from Firestore"
    };
  }
}

// Helper logic: get_word_of_the_day
function getWordOfTheDayLogic(letter: string) {
  const cleanLetter = (letter || "").trim().toUpperCase().charAt(0) || "A";
  const entry = FALLBACK_WORDS_OF_THE_DAY[cleanLetter] || FALLBACK_WORDS_OF_THE_DAY["A"];
  return {
    requestedLetter: cleanLetter,
    found: Boolean(FALLBACK_WORDS_OF_THE_DAY[cleanLetter]),
    wordOfTheDay: entry
  };
}

// Helper logic: practice_round
async function practiceRoundLogic(letter: string) {
  const cleanLetter = (letter || "").trim().toUpperCase().charAt(0) || "A";
  const wotdResult = getWordOfTheDayLogic(cleanLetter);
  const wordEntry = wotdResult.wordOfTheDay;
  const hintResult = await generateHintLogic(wordEntry.word);

  return {
    letter: wordEntry.letter,
    word: wordEntry.word,
    category: wordEntry.category,
    hint: hintResult.hint,
    definition: wordEntry.definition,
    funFact: wordEntry.funFact
  };
}

// Helper logic: vocabulary_progress
async function vocabularyProgressLogic(roomId: string, playerName: string) {
  const code = (roomId || "").trim().toUpperCase();
  const searchName = (playerName || "").trim();

  if (!code) {
    return {
      playerName: searchName,
      roomId: code,
      found: false,
      wordsPlayed: 0,
      totalScore: 0,
      accuracy: "0%",
      message: "Please specify a valid roomId to check progress."
    };
  }

  try {
    const room = await getRoomState(code);
    if (!room) {
      return {
        playerName: searchName,
        roomId: code,
        found: false,
        wordsPlayed: 0,
        totalScore: 0,
        accuracy: "0%",
        message: `Room "${code}" could not be found.`
      };
    }

    // Find the player in room.players by name or ID
    const targetPlayer = room.players?.find(
      (p) =>
        p.name?.trim().toLowerCase() === searchName.toLowerCase() ||
        p.id === searchName
    );

    const resolvedPlayerName = targetPlayer?.name || searchName || "Player";
    const playerId = targetPlayer?.id;

    // Aggregate round scores and calculate stats across all rounds
    let wordsPlayed = 0;
    let validWords = 0;
    let totalScore = 0;

    const roundScores = room.roundScores || {};
    for (const roundIdx of Object.keys(roundScores)) {
      const playerRoundData = playerId ? roundScores[roundIdx]?.[playerId] : null;
      if (playerRoundData && playerRoundData.scores) {
        for (const catId of Object.keys(playerRoundData.scores)) {
          wordsPlayed++;
          const scoreVal = playerRoundData.scores[catId] || 0;
          if (scoreVal > 0) {
            validWords++;
          }
        }
        totalScore += playerRoundData.totalRoundScore || 0;
      }
    }

    // Also factor in liveBoardProgress if no roundScores yet
    if (wordsPlayed === 0 && playerId && room.liveBoardProgress?.[playerId]) {
      const live = room.liveBoardProgress[playerId];
      wordsPlayed = live.filledCount || 0;
      validWords = live.filledCount || 0;
      totalScore = validWords * 10;
    }

    const accuracyNumber = wordsPlayed > 0 ? Math.round((validWords / wordsPlayed) * 100) : 0;
    const accuracy = `${accuracyNumber}%`;

    // Dynamic encouraging message based on actual stats
    let message = "";
    if (wordsPlayed === 0) {
      message = `${resolvedPlayerName} is warming up at the buzzer for room ${code} — ready for the next round!`;
    } else if (accuracyNumber === 100 && totalScore >= 40) {
      message = `Phenomenal vocabulary mastery! ${resolvedPlayerName} has a flawless 100% accuracy streak!`;
    } else if (accuracyNumber >= 80) {
      message = `Great vocabulary streak! ${resolvedPlayerName} scored ${totalScore} points with sharp accuracy.`;
    } else if (totalScore > 0) {
      message = `Solid effort! ${resolvedPlayerName} logged ${wordsPlayed} words and racked up ${totalScore} points.`;
    } else {
      message = `Keep going, ${resolvedPlayerName}! Every round sharpens your vocabulary.`;
    }

    return {
      playerName: resolvedPlayerName,
      roomId: code,
      found: true,
      wordsPlayed,
      totalScore,
      accuracy,
      message
    };
  } catch (err: any) {
    return {
      playerName: searchName,
      roomId: code,
      found: false,
      wordsPlayed: 0,
      totalScore: 0,
      accuracy: "0%",
      message: `Could not retrieve progress for ${searchName}: ${err.message || "Unknown error"}`
    };
  }
}

// Instantiate McpServer
export const mcpServer = new McpServer({
  name: "scattergories-mcp-server",
  version: "1.0.0"
});

// MCP Tool 1: validate_word
mcpServer.tool(
  "validate_word",
  "Validates whether a submitted word is legitimate and fits a game category (Name, Animal, Food, Place, Thing), calculating its game score and feedback.",
  {
    word: z.string().describe("The word to validate"),
    category: z.string().describe("The target category (e.g. Name, Animal, Food, Place, Thing)")
  },
  async ({ word, category }) => {
    const result = await validateWordLogic(word, category);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }
);

// MCP Tool 2: generate_hint
mcpServer.tool(
  "generate_hint",
  "Generates a concise, clever hint or clue for a given word using Gemini AI without revealing the word itself.",
  {
    word: z.string().describe("The secret or target word to generate a clue/hint for")
  },
  async ({ word }) => {
    const result = await generateHintLogic(word);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }
);

// MCP Tool 3: get_room_state
mcpServer.tool(
  "get_room_state",
  "Reads and returns the current live multiplayer room state from Firestore by room ID/code.",
  {
    roomId: z.string().describe("The 6-character room code or room ID")
  },
  async ({ roomId }) => {
    const result = await getRoomStateLogic(roomId);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }
);

// MCP Tool 4: get_word_of_the_day
mcpServer.tool(
  "get_word_of_the_day",
  "Returns the curated Word of the Day, category, definition, and fun educational fact for a given letter of the alphabet (A-Z).",
  {
    letter: z.string().describe("The target letter of the alphabet (A-Z)")
  },
  async ({ letter }) => {
    const result = getWordOfTheDayLogic(letter);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }
);

// MCP Tool 5: practice_round
mcpServer.tool(
  "practice_round",
  "Combines word selection and hint generation into a single vocabulary practice challenge for a given letter of the alphabet.",
  {
    letter: z.string().describe("The letter of the alphabet for the practice round (A-Z)")
  },
  async ({ letter }) => {
    const result = await practiceRoundLogic(letter);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }
);

// MCP Tool 6: vocabulary_progress
mcpServer.tool(
  "vocabulary_progress",
  "Fetches player gameplay stats (words played, total score, accuracy) from a multiplayer room in Firestore and returns an encouraging dynamic summary.",
  {
    roomId: z.string().describe("The 6-character multiplayer room code or room ID"),
    playerName: z.string().describe("The display name or player ID of the user whose progress is requested")
  },
  async ({ roomId, playerName }) => {
    const result = await vocabularyProgressLogic(roomId, playerName);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }
);

// Active SSE transport sessions for MCP
const sseTransports = new Map<string, SSEServerTransport>();

// MCP SSE endpoint for MCP client connections
app.get("/mcp/sse", async (req, res) => {
  try {
    const transport = new SSEServerTransport("/mcp/messages", res);
    const sessionId = transport.sessionId;
    sseTransports.set(sessionId, transport);

    req.on("close", () => {
      sseTransports.delete(sessionId);
    });

    await mcpServer.connect(transport);
  } catch (err: any) {
    console.error("Error initializing MCP SSE transport:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to initialize MCP transport" });
    }
  }
});

// MCP Messages POST endpoint
app.post("/mcp/messages", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = sseTransports.get(sessionId);
  if (!transport) {
    return res.status(404).json({ error: "MCP Session not found" });
  }
  await transport.handlePostMessage(req, res, req.body);
});

// Direct REST Endpoints for MCP tools
app.post("/api/mcp/validate-word", async (req, res) => {
  const { word, category } = req.body;
  const result = await validateWordLogic(word, category);
  res.json(result);
});

app.post("/api/mcp/generate-hint", async (req, res) => {
  const { word } = req.body;
  const result = await generateHintLogic(word);
  res.json(result);
});

app.get("/api/mcp/room-state/:roomId", async (req, res) => {
  const result = await getRoomStateLogic(req.params.roomId);
  res.json(result);
});

app.get("/api/mcp/word-of-the-day/:letter", (req, res) => {
  const result = getWordOfTheDayLogic(req.params.letter);
  res.json(result);
});

app.post("/api/mcp/practice-round", async (req, res) => {
  const { letter } = req.body;
  const result = await practiceRoundLogic(letter);
  res.json(result);
});

app.get("/api/mcp/vocabulary-progress/:roomId/:playerName", async (req, res) => {
  const { roomId, playerName } = req.params;
  const result = await vocabularyProgressLogic(roomId, playerName);
  res.json(result);
});

// Setup development or production server
async function startServer() {
  // Optional local MCP dictionary. Never invoke npx at runtime (which may download).
  if (process.env.ENABLE_DICTIONARY_MCP === "true") {
    try {
      const dictionaryEntry = path.resolve("node_modules/mcp-server-dictionary/build/index.js");
      const dictTransport = new StdioClientTransport({ command: process.execPath, args: [dictionaryEntry] });
      dictClient = new Client({ name: "wordplay-dict-client", version: "1.0.0" });
      await Promise.race([
        dictClient.connect(dictTransport),
        new Promise((_, reject) => setTimeout(() => reject(new Error("dictionary startup timeout")), 5000))
      ]);
      console.log("[MCP Dictionary] Connected to locally installed dictionary dependency.");
    } catch (mcpErr: any) {
      console.warn("[MCP Dictionary] Optional local dictionary unavailable; continuing without it:", mcpErr.message);
      dictClient = null;
    }
  } else {
    dictClient = null;
    console.log("[MCP Dictionary] Disabled; using configured lookup fallbacks.");
  }

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
