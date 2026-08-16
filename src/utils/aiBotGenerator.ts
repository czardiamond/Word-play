import { Answers, CategoryInfo, Player } from "../types";

export interface BotPersonalityConfig {
  name: string;
  avatar: string;
  style: string;
}

// Rich 26-letter curated vocabulary dictionary for all standard categories
export const BOT_VOCAB_DICTIONARY: Record<string, Record<string, {
  susie: string;
  harry: string;
  sam: string;
  joe: string;
}>> = {
  A: {
    name: { susie: "Anastasia", harry: "Alex", sam: "Atomic Arthur", joe: "Anna" },
    animal: { susie: "Axolotl", harry: "Ant", sam: "Astronaut Ape", joe: "Alligator" },
    food: { susie: "Artichoke", harry: "Apple", sam: "Awesome Avocado", joe: "Apricot" },
    place: { susie: "Amsterdam", harry: "Asia", sam: "Alien Asteroid", joe: "Austin" },
    thing: { susie: "Astrolabe", harry: "Axe", sam: "Accordion Alarm", joe: "Arrow" }
  },
  B: {
    name: { susie: "Benedict", harry: "Ben", sam: "Bigfoot Billy", joe: "Bob" },
    animal: { susie: "Baboon", harry: "Bat", sam: "Bubblegum Bear", joe: "Beaver" },
    food: { susie: "Baguette", harry: "Bread", sam: "Bacon Banana", joe: "Butter" },
    place: { susie: "Barcelona", harry: "Boston", sam: "Boogieland Beach", joe: "Berlin" },
    thing: { susie: "Barometer", harry: "Ball", sam: "Bouncing Broom", joe: "Book" }
  },
  C: {
    name: { susie: "Cassandra", harry: "Cole", sam: "Captain Cookie", joe: "Charlie" },
    animal: { susie: "Chinchilla", harry: "Cat", sam: "Crazy Camel", joe: "Cheetah" },
    food: { susie: "Cantaloupe", harry: "Cake", sam: "Cheesy Cotton", joe: "Carrot" },
    place: { susie: "Copenhagen", harry: "Cuba", sam: "Carnival Castle", joe: "Canada" },
    thing: { susie: "Chronometer", harry: "Cup", sam: "Confetti Cannon", joe: "Camera" }
  },
  D: {
    name: { susie: "Dominique", harry: "Dan", sam: "Disco Dave", joe: "David" },
    animal: { susie: "Dugong", harry: "Dog", sam: "Dancing Dolphin", joe: "Duck" },
    food: { susie: "Dumpling", harry: "Donut", sam: "Dynamite Dip", joe: "Date" },
    place: { susie: "Dubrovnik", harry: "Dallas", sam: "Dinosaur Den", joe: "Denmark" },
    thing: { susie: "Didgeridoo", harry: "Drum", sam: "Disco Dice", joe: "Desk" }
  },
  E: {
    name: { susie: "Evangeline", harry: "Eli", sam: "Electric Eddie", joe: "Emma" },
    animal: { susie: "Echidna", harry: "Eel", sam: "Eggplant Elephant", joe: "Eagle" },
    food: { susie: "Empanada", harry: "Egg", sam: "Exploding Eclair", joe: "Enchilada" },
    place: { susie: "Edinburgh", harry: "Egypt", sam: "Enchanted Empire", joe: "Ethiopia" },
    thing: { susie: "Earphones", harry: "Eraser", sam: "Energy Eyeglasses", joe: "Engine" }
  },
  F: {
    name: { susie: "Francesca", harry: "Finn", sam: "Funky Frank", joe: "Fiona" },
    animal: { susie: "Flamingo", harry: "Fox", sam: "Flying Frog", joe: "Falcon" },
    food: { susie: "Falafel", harry: "Fig", sam: "Frosted Fries", joe: "Fudge" },
    place: { susie: "Florence", harry: "France", sam: "Flamingo Forest", joe: "Fiji" },
    thing: { susie: "Flashlight", harry: "Fork", sam: "Feather Fan", joe: "Flute" }
  },
  G: {
    name: { susie: "Guinevere", harry: "Gus", sam: "Gigantic Gary", joe: "George" },
    animal: { susie: "Gazelle", harry: "Goat", sam: "Giggling Gorilla", joe: "Giraffe" },
    food: { susie: "Guacamole", harry: "Grape", sam: "Glitter Gumbo", joe: "Garlic" },
    place: { susie: "Geneva", harry: "Ghana", sam: "Giggle Galaxy", joe: "Germany" },
    thing: { susie: "Geiger Counter", harry: "Glass", sam: "Golden Goggles", joe: "Guitar" }
  },
  H: {
    name: { susie: "Hermione", harry: "Hank", sam: "Hypnotic Harry", joe: "Hannah" },
    animal: { susie: "Hedgehog", harry: "Hawk", sam: "Hovering Hippo", joe: "Hamster" },
    food: { susie: "Hummus", harry: "Ham", sam: "Hotdog Honey", joe: "Hazelnut" },
    place: { susie: "Helsinki", harry: "Hawaii", sam: "Hamster Hotel", joe: "Hungary" },
    thing: { susie: "Hourglass", harry: "Hat", sam: "Helicopter Helmet", joe: "Hammer" }
  },
  I: {
    name: { susie: "Ignatius", harry: "Ian", sam: "Intergalactic Izzy", joe: "Isabella" },
    animal: { susie: "Iguana", harry: "Ibex", sam: "Invisible Insect", joe: "Impala" },
    food: { susie: "Iceberg Salad", harry: "Ice Cream", sam: "Icy Icing", joe: "Italian Bread" },
    place: { susie: "Istanbul", harry: "India", sam: "Igloo Island", joe: "Iceland" },
    thing: { susie: "Incubator", harry: "Iron", sam: "Inflatable Instrument", joe: "Ink" }
  },
  J: {
    name: { susie: "Jacqueline", harry: "Jack", sam: "Jumping Jimmy", joe: "James" },
    animal: { susie: "Jaguarundi", harry: "Jay", sam: "Juggling Jellyfish", joe: "Jaguar" },
    food: { susie: "Jambalaya", harry: "Jam", sam: "Jellybean Juice", joe: "Jalapeno" },
    place: { susie: "Johannesburg", harry: "Japan", sam: "Jungle Junction", joe: "Jamaica" },
    thing: { susie: "Kaleidoscope", harry: "Jar", sam: "Jumbo Jetpack", joe: "Jacket" }
  },
  K: {
    name: { susie: "Katherine", harry: "Kyle", sam: "King Kong Kevin", joe: "Kate" },
    animal: { susie: "Kinkajou", harry: "Koala", sam: "Karate Kangaroo", joe: "Kingfisher" },
    food: { susie: "Kimchi", harry: "Kiwi", sam: "Ketchup Krispies", joe: "Kale" },
    place: { susie: "Kathmandu", harry: "Kenya", sam: "Koala Kingdom", joe: "Kyoto" },
    thing: { susie: "Kaleidoscope", harry: "Key", sam: "Kazoo Keyboard", joe: "Kettle" }
  },
  L: {
    name: { susie: "Lysander", harry: "Leo", sam: "Laser Luke", joe: "Lucy" },
    animal: { susie: "Lemur", harry: "Lion", sam: "Laughing Llama", joe: "Leopard" },
    food: { susie: "Lasagna", harry: "Lime", sam: "Lollipop Lasagna", joe: "Lemon" },
    place: { susie: "Lisbon", harry: "London", sam: "Llama Lagoon", joe: "Lima" },
    thing: { susie: "Lorgnette", harry: "Lamp", sam: "Laser Lantern", joe: "Lock" }
  },
  M: {
    name: { susie: "Maximilian", harry: "Max", sam: "Magic Mike", joe: "Mia" },
    animal: { susie: "Meerkat", harry: "Mole", sam: "Marshmallow Monkey", joe: "Moose" },
    food: { susie: "Macaron", harry: "Mango", sam: "Mashed Melon", joe: "Mushroom" },
    place: { susie: "Montevideo", harry: "Miami", sam: "Moon Metropolis", joe: "Madrid" },
    thing: { susie: "Microscope", harry: "Mug", sam: "Monster Magnet", joe: "Mirror" }
  },
  N: {
    name: { susie: "Nathanael", harry: "Nick", sam: "Ninja Nate", joe: "Nora" },
    animal: { susie: "Narwhal", harry: "Newt", sam: "Nutty Nightingale", joe: "Numbat" },
    food: { susie: "Nectarine", harry: "Nuts", sam: "Noodle Nugget", joe: "Nachos" },
    place: { susie: "Nairobi", harry: "Norway", sam: "Neon Nebula", joe: "Naples" },
    thing: { susie: "Nanometer", harry: "Nail", sam: "Ninja Net", joe: "Needle" }
  },
  O: {
    name: { susie: "Octavius", harry: "Otis", sam: "Outrageous Oscar", joe: "Olivia" },
    animal: { susie: "Ocelot", harry: "Owl", sam: "Opera Ostrich", joe: "Otter" },
    food: { susie: "Omelette", harry: "Oat", sam: "Oatmeal Onion", joe: "Orange" },
    place: { susie: "Oslo", harry: "Oman", sam: "Octopus Ocean", joe: "Orlando" },
    thing: { susie: "Oscilloscope", harry: "Oar", sam: "Orbital Origami", joe: "Oven" }
  },
  P: {
    name: { susie: "Penelope", harry: "Pete", sam: "Pirate Paul", joe: "Penny" },
    animal: { susie: "Pangolin", harry: "Pug", sam: "Popcorn Penguin", joe: "Panda" },
    food: { susie: "Pomegranate", harry: "Pear", sam: "Pickled Pancake", joe: "Pasta" },
    place: { susie: "Prague", harry: "Paris", sam: "Penguin Palace", joe: "Peru" },
    thing: { susie: "Periscope", harry: "Pen", sam: "Parachute Pillow", joe: "Pencil" }
  },
  Q: {
    name: { susie: "Quintilian", harry: "Quinn", sam: "Quantum Quincy", joe: "Queen" },
    animal: { susie: "Quokka", harry: "Quail", sam: "Quick Quokka", joe: "Quoll" },
    food: { susie: "Quiche", harry: "Quince", sam: "Quacking Quesadilla", joe: "Quinoa" },
    place: { susie: "Quito", harry: "Qatar", sam: "Quirky Quarters", joe: "Quebec" },
    thing: { susie: "Quadtree", harry: "Quilt", sam: "Quantum Quill", joe: "Quarter" }
  },
  R: {
    name: { susie: "Rosalind", harry: "Rob", sam: "Rocket Rick", joe: "Ruby" },
    animal: { susie: "Rhinoceros", harry: "Rat", sam: "Rollerblade Raccoon", joe: "Rabbit" },
    food: { susie: "Ravioli", harry: "Rice", sam: "Rainbow Radish", joe: "Raspberry" },
    place: { susie: "Reykjavik", harry: "Rome", sam: "Rocket Runway", joe: "Rotterdam" },
    thing: { susie: "Resonator", harry: "Rope", sam: "Rubber Robot", joe: "Ruler" }
  },
  S: {
    name: { susie: "Seraphina", harry: "Sam", sam: "Super Sonic Stan", joe: "Sophia" },
    animal: { susie: "Salamander", harry: "Seal", sam: "Skateboarding Shark", joe: "Squirrel" },
    food: { susie: "Souffle", harry: "Soup", sam: "Spaghetti Sundae", joe: "Strawberry" },
    place: { susie: "Stockholm", harry: "Spain", sam: "Spaceship Station", joe: "Sydney" },
    thing: { susie: "Spectroscope", harry: "Spoon", sam: "Sparkle Spring", joe: "Scissors" }
  },
  T: {
    name: { susie: "Theodore", harry: "Tim", sam: "Tornado Tom", joe: "Thomas" },
    animal: { susie: "Tarantula", harry: "Toad", sam: "Tapdancing Tiger", joe: "Turtle" },
    food: { susie: "Tiramisu", harry: "Taco", sam: "Toffee Tortilla", joe: "Tomato" },
    place: { susie: "Tokyo", harry: "Texas", sam: "Treasure Treehouse", joe: "Thailand" },
    thing: { susie: "Telescope", harry: "Tape", sam: "Time Traveling Trumpet", joe: "Telephone" }
  },
  U: {
    name: { susie: "Ursula", harry: "Uri", sam: "Ultra Uggie", joe: "Uma" },
    animal: { susie: "Umbrellabird", harry: "Urchin", sam: "Unicycle Unicorn", joe: "Urial" },
    food: { susie: "Udon", harry: "Ugli", sam: "Upside Down Udon", joe: "Ugli Fruit" },
    place: { susie: "Utrecht", harry: "Utah", sam: "Underground Universe", joe: "Uganda" },
    thing: { susie: "Ukulele", harry: "Urn", sam: "Unbreakable Umbrella", joe: "Uniform" }
  },
  V: {
    name: { susie: "Valentina", harry: "Vic", sam: "Vampire Vince", joe: "Victor" },
    animal: { susie: "Vicuna", harry: "Vole", sam: "Volcano Viper", joe: "Vulture" },
    food: { susie: "Vanilla Bean", harry: "Vinegar", sam: "Velvet Veggie", joe: "Vegetable" },
    place: { susie: "Vienna", harry: "Vegas", sam: "Vortex Valley", joe: "Venice" },
    thing: { susie: "Velocipede", harry: "Vase", sam: "Vibrating Violin", joe: "Video" }
  },
  W: {
    name: { susie: "Wilhelmina", harry: "Will", sam: "Wizard Walter", joe: "William" },
    animal: { susie: "Wombat", harry: "Wolf", sam: "Watermelon Walrus", joe: "Weasel" },
    food: { susie: "Wasabi", harry: "Waffle", sam: "Whipped Wonton", joe: "Watermelon" },
    place: { susie: "Warsaw", harry: "Wales", sam: "Wizard Wonderland", joe: "Washington" },
    thing: { susie: "Windmill", harry: "Watch", sam: "Windup Wand", joe: "Wheel" }
  },
  X: {
    name: { susie: "Xanthippe", harry: "Xan", sam: "X-Factor Xander", joe: "Xavier" },
    animal: { susie: "Xenops", harry: "Xerus", sam: "Xylophone X-ray", joe: "X-ray Tetra" },
    food: { susie: "Xavier Soup", harry: "Xigua", sam: "Xigua Xylocarp", joe: "Xigua Watermelon" },
    place: { susie: "Xanthi", harry: "Xian", sam: "X-ray Xanadu", joe: "Xiamen" },
    thing: { susie: "Xylophone", harry: "X-ray", sam: "Xylophone Xyloid", joe: "Xerox" }
  },
  Y: {
    name: { susie: "Yolanda", harry: "Yann", sam: "Yo-Yo Yoshi", joe: "Yara" },
    animal: { susie: "Yellowjacket", harry: "Yak", sam: "Yodeling Yak", joe: "Yorkie" },
    food: { susie: "Yogurt", harry: "Yam", sam: "Yummy Yam", joe: "Yellow Apple" },
    place: { susie: "Yokohama", harry: "Yemen", sam: "Yarn Yard", joe: "Yosemite" },
    thing: { susie: "Yardstick", harry: "Yarn", sam: "Yellow Yo-Yo", joe: "Yacht" }
  },
  Z: {
    name: { susie: "Zachariah", harry: "Zack", sam: "Zombie Ziggy", joe: "Zoe" },
    animal: { susie: "Zorilla", harry: "Zebra", sam: "Zigzag Zebra", joe: "Zebu" },
    food: { susie: "Zucchini Bread", harry: "Zest", sam: "Zesty Zeppole", joe: "Zucchini" },
    place: { susie: "Zanzibar", harry: "Zambia", sam: "Zigzag Zoo", joe: "Zurich" },
    thing: { susie: "Zither", harry: "Zip", sam: "Zooming Zeppelin", joe: "Zipper" }
  }
};

/**
 * Generates instant, reliable, personality-aligned answers for AI bots for any letter and categories.
 */
export function generateLocalBotAnswers(
  letter: string,
  bot: Player,
  categories: CategoryInfo[],
  difficulty: "easy" | "medium" | "hard" = "medium"
): Answers {
  const char = letter.trim().toUpperCase().charAt(0) || "A";
  const dictForLetter = BOT_VOCAB_DICTIONARY[char] || BOT_VOCAB_DICTIONARY["A"];
  const personality = (bot.botPersonality || "joe") as "susie" | "harry" | "sam" | "joe";

  const answers: Answers = {};

  categories.forEach((cat) => {
    const catEntry = dictForLetter[cat.id];
    let word = "";

    if (catEntry && catEntry[personality]) {
      word = catEntry[personality];
    } else if (catEntry) {
      word = catEntry.joe || catEntry.susie || `${char} ${cat.label}`;
    } else {
      // Custom category fallback
      word = `${char}${cat.label.slice(0, 4)} Item`;
    }

    // Personality quirks:
    if (personality === "harry") {
      // Speedster leaves ~15% blanks in hard/medium mode
      if (difficulty !== "easy" && Math.random() < 0.15) {
        word = "";
      }
    }

    answers[cat.id] = word;
  });

  return answers;
}

export function getBotPersonalityTaunt(
  personality: "susie" | "harry" | "sam" | "joe" | undefined,
  letter: string,
  difficulty: "easy" | "medium" | "hard" = "medium"
): string {
  const char = (letter || "A").toUpperCase().charAt(0);
  switch (personality) {
    case "susie":
      return `Letter "${char}" analyzed with rigorous precision! Etymological database confirms 15-point uniqueness. 🤓`;
    case "harry":
      return `Locked and loaded in 14 seconds flat! Catch my dust! ⚡`;
    case "sam":
      return `My "${char}" answers are 100% certified cartoon genius! 🤪`;
    case "joe":
    default:
      return `Clean and classic moves for letter "${char}". Good luck everyone! 🤠`;
  }
}

export interface DynamicBotResponse {
  id: string;
  answers: Answers;
  taunt: string;
  estimatedScore: number;
  speedSeconds: number;
}

/**
 * Calls Gemini 2.5 Flash on the server in real-time to generate AI opponent word moves, scores, and in-character taunts.
 */
export async function fetchDynamicBotMoves(
  letter: string,
  bots: Player[],
  categories: CategoryInfo[],
  difficulty: "easy" | "medium" | "hard" = "medium",
  rackLetters?: string[],
  boardState?: any
): Promise<Record<string, DynamicBotResponse>> {
  const fallbackResults: Record<string, DynamicBotResponse> = {};
  bots.forEach((b) => {
    const answers = generateLocalBotAnswers(letter, b, categories, difficulty);
    const pers = (b.botPersonality || "joe") as "susie" | "harry" | "sam" | "joe";
    fallbackResults[b.id] = {
      id: b.id,
      answers,
      taunt: getBotPersonalityTaunt(pers, letter, difficulty),
      estimatedScore: pers === "susie" ? 75 : pers === "harry" ? 55 : pers === "sam" ? 50 : 65,
      speedSeconds: pers === "harry" ? 14 : pers === "susie" ? 22 : pers === "sam" ? 38 : 28
    };
  });

  if (bots.length === 0) return fallbackResults;

  try {
    const res = await fetch("/api/generate-ai-answers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        letter,
        opponents: bots.map((b) => ({
          id: b.id,
          name: b.name,
          personality: b.botPersonality === "susie" ? "Smart Susie (Word Whiz)" : b.botPersonality === "harry" ? "Hurry Harry (Speedster)" : b.botPersonality === "sam" ? "Silly Sam (Comedian)" : "Average Joe (Casual)"
        })),
        categories,
        difficulty,
        rackLetters,
        boardState
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.opponents && Array.isArray(data.opponents)) {
        const dynamicMap: Record<string, DynamicBotResponse> = { ...fallbackResults };
        data.opponents.forEach((opp: any) => {
          if (opp && opp.id && opp.answers) {
            dynamicMap[opp.id] = {
              id: opp.id,
              answers: opp.answers,
              taunt: opp.taunt || fallbackResults[opp.id]?.taunt || "Ready for grading!",
              estimatedScore: opp.estimatedScore || fallbackResults[opp.id]?.estimatedScore || 60,
              speedSeconds: opp.speedSeconds || fallbackResults[opp.id]?.speedSeconds || 25
            };
          }
        });
        return dynamicMap;
      }
    }
  } catch (err) {
    console.warn("Using offline dictionary with in-character taunts for AI opponents:", err);
  }

  return fallbackResults;
}

/**
 * Fetches a single AI move from Gemini 2.5 Flash for an active turn or category.
 */
export async function fetchSingleBotMove(
  letter: string,
  category: string,
  personality: "susie" | "harry" | "sam" | "joe" = "susie",
  difficulty: "easy" | "medium" | "hard" = "medium",
  rackLetters?: string[],
  boardState?: any
): Promise<{ word: string; category: string; score: number; taunt: string; explanation: string }> {
  try {
    const res = await fetch("/api/ai-move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        letter,
        category,
        botPersonality: personality,
        difficulty,
        rackLetters,
        boardState
      })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn("Single AI move fallback:", e);
  }

  const char = (letter || "A").toUpperCase().charAt(0);
  const dict = BOT_VOCAB_DICTIONARY[char] || BOT_VOCAB_DICTIONARY["A"];
  const catKey = category.toLowerCase();
  const word = dict[catKey]?.[personality] || `${char} ${category}`;

  return {
    word,
    category,
    score: 15,
    taunt: getBotPersonalityTaunt(personality, letter, difficulty),
    explanation: `Valid entry starting with ${char}.`
  };
}
