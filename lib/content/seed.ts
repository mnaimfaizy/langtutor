/**
 * Tiny starter seed (PLAN §1.8 + Phase 4.1 prompts).
 *
 * Hand-authored passages, writing prompts, and vocab cards that cover A1–C2
 * (passages/prompts) and A1–B2 (cards). Available offline from day one — no
 * Mac, no network required. Loaded on first run via {@link loadSeedIfEmpty}.
 * Never call this on the server (IndexedDB is browser-only); invoke it from
 * a client component.
 */
import type { ContentRepository, NewCard, NewContent } from "@/lib/db";

// ── helpers ───────────────────────────────────────────────────────────────────

/** Returns a fresh FSRS state for a brand-new card: unreviewed, due immediately. */
function newFsrs() {
  return {
    due: new Date(0), // epoch → due right away; new instance per card, not shared
    stability: 0,
    difficulty: 0,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    state: 0, // 0 = New
  };
}

const SEED_DATE = new Date("2024-01-01");

// ── passages ──────────────────────────────────────────────────────────────────

const SEED_PASSAGES: NewContent[] = [
  // A1 ──────────────────────────────────────────────────────────────────────
  {
    type: "passage",
    level: "A1",
    topic: "daily routine",
    payload: {
      title: "My Day",
      body: "I wake up at seven o'clock every morning. First, I go to the kitchen and make breakfast. I have eggs and toast. Then I drink a cup of tea. After breakfast, I take my bag and go to school. School starts at nine o'clock. In the afternoon, I come home and do my homework. In the evening, my family has dinner together. We talk about our day. After dinner, I watch television or read a book. I go to bed at ten o'clock. I like my daily routine.",
    },
    source: "seed",
    validatedAt: SEED_DATE,
  },
  {
    type: "passage",
    level: "A1",
    topic: "animals",
    payload: {
      title: "My Pet",
      body: "My favourite animal is the dog. Dogs are very friendly and kind. My dog is big and brown. His name is Max. Max lives in our house. Every morning, I give Max food and water. Max likes to play in the garden. He runs and jumps a lot. Every afternoon, I take Max for a walk in the park. We walk for thirty minutes. Max is very happy when we go to the park. He has many friends there. I love Max very much. He is my best friend.",
    },
    source: "seed",
    validatedAt: SEED_DATE,
  },

  // A2 ──────────────────────────────────────────────────────────────────────
  {
    type: "passage",
    level: "A2",
    topic: "travel",
    payload: {
      title: "A Weekend Trip",
      body: "Last weekend, my family went to the countryside for a day trip. We left home early in the morning and arrived at a small village after one hour. The weather was warm and sunny. First, we visited a market where local people were selling fresh fruit and vegetables. My mother bought some apples and cheese. Then we had lunch at a small café near the river. The food was delicious. After lunch, we walked along a beautiful path beside the river. My children loved the trip and want to go again soon. It was a perfect day for everyone.",
    },
    source: "seed",
    validatedAt: SEED_DATE,
  },
  {
    type: "passage",
    level: "A2",
    topic: "cooking",
    payload: {
      title: "Learning to Cook",
      body: "I have always enjoyed eating good food, but I have never learned to cook properly. Last month, I decided to change that. I joined a cooking class at the local community centre. Every Tuesday evening, we learn to make different dishes. So far, I have made pasta, soup, and a fruit cake. The teacher is very helpful and explains everything clearly. She always says that cooking is not difficult if you follow the instructions. I am going to make dinner for my family next Saturday. I have already bought all the ingredients. My family is looking forward to the meal.",
    },
    source: "seed",
    validatedAt: SEED_DATE,
  },

  // B1 ──────────────────────────────────────────────────────────────────────
  {
    type: "passage",
    level: "B1",
    topic: "technology",
    payload: {
      title: "Technology in Daily Life",
      body: "Technology has changed the way people communicate with each other. In the past, people wrote letters or made phone calls to stay in touch. Today, many people use digital platforms every day to share information and connect with friends. While this technology offers many benefits, such as helping people maintain friendships across long distances, it also presents challenges. Studies suggest that spending too much time online can affect mental health and reduce face-to-face interaction. However, when used carefully, technology can be a powerful tool for education and staying informed. The key is finding a healthy balance between online and offline activities.",
    },
    source: "seed",
    validatedAt: SEED_DATE,
  },
  {
    type: "passage",
    level: "B1",
    topic: "health",
    payload: {
      title: "Staying Healthy",
      body: "Regular physical activity is essential for maintaining good health. Research shows that people who exercise regularly are less likely to develop serious health problems such as heart disease. Exercise also improves mental health by reducing stress and improving mood. Many doctors recommend that adults should do at least thirty minutes of moderate exercise most days of the week. This can include activities such as walking, cycling, or swimming. Despite knowing the benefits, many people find it difficult to exercise regularly because of busy lifestyles. Setting realistic goals and choosing activities you enjoy can help you maintain a regular routine over time.",
    },
    source: "seed",
    validatedAt: SEED_DATE,
  },

  // B2 ──────────────────────────────────────────────────────────────────────
  {
    type: "passage",
    level: "B2",
    topic: "environment",
    payload: {
      title: "Climate Change and Individual Action",
      body: "Climate change has become one of the most pressing environmental challenges of our time. Scientists have confirmed that global temperatures are rising due to increased greenhouse gas emissions, primarily from burning fossil fuels. If current trends continue, the consequences could be severe, including more frequent extreme weather events and significant loss of biodiversity. Governments and international organisations have been working to address this issue, but individual action is also considered vital. Simple changes in daily behaviour, such as reducing energy consumption and choosing sustainable products, can collectively have a substantial impact. Experts believe that with coordinated effort, it is still possible to limit the worst effects of climate change.",
    },
    source: "seed",
    validatedAt: SEED_DATE,
  },
  {
    type: "passage",
    level: "B2",
    topic: "work",
    payload: {
      title: "The Gig Economy",
      body: "The rise of digital platforms has fundamentally transformed the labour market, giving birth to what economists call the gig economy. In this model, workers are engaged on a short-term basis rather than through traditional employment contracts. Proponents argue that gig work offers considerable flexibility and independence, allowing individuals to manage multiple income streams simultaneously. However, critics point out that gig workers are frequently denied basic employment rights such as sick pay and pension contributions. Furthermore, income instability can make financial planning considerably more difficult. Legal challenges in several countries have consequently led to a reexamination of how workers in this sector should be classified and protected.",
    },
    source: "seed",
    validatedAt: SEED_DATE,
  },
];

// ── vocab cards ───────────────────────────────────────────────────────────────

const SEED_CARDS: NewCard[] = [
  // A1 ──────────────────────────────────────────────────────────────────────
  {
    word: "house",
    definition: "a building where people live",
    examples: ["I live in a small house.", "Our house has three rooms."],
    cefr: "A1",
    fsrs: newFsrs(),
    createdAt: SEED_DATE,
  },
  {
    word: "school",
    definition: "a place where children go to learn",
    examples: ["She goes to school every day.", "My school is near the park."],
    cefr: "A1",
    fsrs: newFsrs(),
    createdAt: SEED_DATE,
  },
  {
    word: "happy",
    definition: "feeling or showing pleasure and satisfaction",
    examples: ["I am very happy today.", "She looks happy."],
    cefr: "A1",
    fsrs: newFsrs(),
    createdAt: SEED_DATE,
  },
  {
    word: "big",
    definition: "large in size",
    examples: ["He has a big dog.", "That is a very big house."],
    cefr: "A1",
    fsrs: newFsrs(),
    createdAt: SEED_DATE,
  },
  {
    word: "eat",
    definition: "to put food in your mouth and swallow it",
    examples: ["We eat breakfast every morning.", "What do you want to eat?"],
    cefr: "A1",
    fsrs: newFsrs(),
    createdAt: SEED_DATE,
  },

  // A2 ──────────────────────────────────────────────────────────────────────
  {
    word: "arrive",
    definition: "to reach a place, especially at the end of a journey",
    examples: ["We arrived at the hotel at noon.", "What time does the train arrive?"],
    cefr: "A2",
    fsrs: newFsrs(),
    createdAt: SEED_DATE,
  },
  {
    word: "usually",
    definition: "in the way that most often happens; on most occasions",
    examples: ["I usually walk to work.", "She usually wakes up early."],
    cefr: "A2",
    fsrs: newFsrs(),
    createdAt: SEED_DATE,
  },
  {
    word: "decide",
    definition: "to make a choice about what to do",
    examples: ["She decided to join the class.", "Have you decided yet?"],
    cefr: "A2",
    fsrs: newFsrs(),
    createdAt: SEED_DATE,
  },
  {
    word: "friendly",
    definition: "behaving in a pleasant and kind way towards others",
    examples: ["The staff were very friendly.", "He has a friendly smile."],
    cefr: "A2",
    fsrs: newFsrs(),
    createdAt: SEED_DATE,
  },
  {
    word: "journey",
    definition: "an act of travelling from one place to another",
    examples: ["The journey took two hours.", "We enjoyed the journey through the mountains."],
    cefr: "A2",
    fsrs: newFsrs(),
    createdAt: SEED_DATE,
  },

  // B1 ──────────────────────────────────────────────────────────────────────
  {
    word: "achieve",
    definition: "to succeed in reaching a particular goal or result",
    examples: [
      "She worked hard to achieve her goals.",
      "It is possible to achieve a lot with practice.",
    ],
    cefr: "B1",
    fsrs: newFsrs(),
    createdAt: SEED_DATE,
  },
  {
    word: "suggest",
    definition: "to mention an idea or plan for someone to consider",
    examples: ["He suggested going for a walk.", "Can you suggest a good restaurant?"],
    cefr: "B1",
    fsrs: newFsrs(),
    createdAt: SEED_DATE,
  },
  {
    word: "significant",
    definition: "important or large enough to have a notable effect",
    examples: [
      "There has been a significant improvement.",
      "Exercise has significant health benefits.",
    ],
    cefr: "B1",
    fsrs: newFsrs(),
    createdAt: SEED_DATE,
  },
  {
    word: "provide",
    definition: "to make something available for someone to use",
    examples: ["The school provides free meals.", "Can you provide more information?"],
    cefr: "B1",
    fsrs: newFsrs(),
    createdAt: SEED_DATE,
  },
  {
    word: "require",
    definition: "to need something, or to make something necessary",
    examples: ["This job requires a university degree.", "The task requires careful planning."],
    cefr: "B1",
    fsrs: newFsrs(),
    createdAt: SEED_DATE,
  },

  // B2 ──────────────────────────────────────────────────────────────────────
  {
    word: "subsequently",
    definition: "happening after something else; afterwards",
    examples: [
      "He was arrested and subsequently released.",
      "The company grew rapidly and subsequently expanded abroad.",
    ],
    cefr: "B2",
    fsrs: newFsrs(),
    createdAt: SEED_DATE,
  },
  {
    word: "fundamental",
    definition: "forming an essential base; of central importance",
    examples: [
      "Trust is fundamental to any relationship.",
      "There are fundamental differences between the two systems.",
    ],
    cefr: "B2",
    fsrs: newFsrs(),
    createdAt: SEED_DATE,
  },
  {
    word: "substantial",
    definition: "large in size, value, or importance",
    examples: [
      "There has been a substantial increase in costs.",
      "She earned a substantial income from her business.",
    ],
    cefr: "B2",
    fsrs: newFsrs(),
    createdAt: SEED_DATE,
  },
  {
    word: "demonstrate",
    definition: "to show clearly by giving proof or evidence",
    examples: [
      "The results demonstrate that the method works.",
      "She demonstrated how to use the software.",
    ],
    cefr: "B2",
    fsrs: newFsrs(),
    createdAt: SEED_DATE,
  },
  {
    word: "consequently",
    definition: "as a result of something; therefore",
    examples: [
      "He missed the train and consequently arrived late.",
      "Prices rose and consequently demand fell.",
    ],
    cefr: "B2",
    fsrs: newFsrs(),
    createdAt: SEED_DATE,
  },
];

// ── writing prompts ───────────────────────────────────────────────────────────

const SEED_PROMPTS: NewContent[] = [
  // A1 ──────────────────────────────────────────────────────────────────────
  {
    type: "prompt",
    level: "A1",
    topic: "family and friends",
    payload: {
      title: "My Family",
      instruction:
        "Write about your family. Who is in your family? How old are they? What do they like to do? Write 3 to 5 sentences.",
      context: "Example: My name is Sara. I have a mother, a father, and one sister.",
    },
    source: "seed",
    validatedAt: SEED_DATE,
  },
  {
    type: "prompt",
    level: "A1",
    topic: "personal experience",
    payload: {
      title: "My Favourite Food",
      instruction:
        "Write about your favourite food. What is it? Where do you eat it? Why do you like it? Write 3 to 5 sentences.",
      context: "Example: My favourite food is pizza. I eat pizza with my family on Fridays.",
    },
    source: "seed",
    validatedAt: SEED_DATE,
  },

  // A2 ──────────────────────────────────────────────────────────────────────
  {
    type: "prompt",
    level: "A2",
    topic: "travel and places",
    payload: {
      title: "A Place I Visited",
      instruction:
        "Write about a place you visited recently. Where did you go? What did you do there? How did you feel? Write 5 to 8 sentences.",
      context: "Example: Last weekend, I went to the park with my friends.",
    },
    source: "seed",
    validatedAt: SEED_DATE,
  },
  {
    type: "prompt",
    level: "A2",
    topic: "personal experience",
    payload: {
      title: "My Typical Morning",
      instruction:
        "Write about what you usually do on a typical morning. Use time phrases like 'first', 'then', and 'after that'. Write 5 to 8 sentences.",
    },
    source: "seed",
    validatedAt: SEED_DATE,
  },

  // B1 ──────────────────────────────────────────────────────────────────────
  {
    type: "prompt",
    level: "B1",
    topic: "personal experience",
    payload: {
      title: "A New Skill",
      instruction:
        "Write about a skill you would like to learn in the future. Why do you want to learn it? How do you plan to practise? What challenges might you face? Write 80 to 120 words.",
    },
    source: "seed",
    validatedAt: SEED_DATE,
  },
  {
    type: "prompt",
    level: "B1",
    topic: "technology",
    payload: {
      title: "Technology and Communication",
      instruction:
        "How has technology changed the way you stay in touch with friends and family? What are the advantages and disadvantages? Write 80 to 120 words.",
    },
    source: "seed",
    validatedAt: SEED_DATE,
  },

  // B2 ──────────────────────────────────────────────────────────────────────
  {
    type: "prompt",
    level: "B2",
    topic: "work and career",
    payload: {
      title: "Work-Life Balance",
      instruction:
        "Do you think it is possible to maintain a healthy work-life balance in today's world? Discuss both sides of the argument and give your own view. Write 120 to 180 words.",
    },
    source: "seed",
    validatedAt: SEED_DATE,
  },
  {
    type: "prompt",
    level: "B2",
    topic: "education",
    payload: {
      title: "Online vs In-Person Learning",
      instruction:
        "Compare the advantages and disadvantages of studying online versus attending classes in person. Which approach do you prefer and why? Support your answer with specific reasons. Write 120 to 180 words.",
    },
    source: "seed",
    validatedAt: SEED_DATE,
  },

  // C1 ──────────────────────────────────────────────────────────────────────
  {
    type: "prompt",
    level: "C1",
    topic: "technology",
    payload: {
      title: "AI in Education",
      instruction:
        "To what extent will artificial intelligence transform the way people learn over the next decade? Develop a well-structured argument that considers both the opportunities and the potential risks. Write 180 to 250 words.",
    },
    source: "seed",
    validatedAt: SEED_DATE,
  },
  {
    type: "prompt",
    level: "C1",
    topic: "nature and environment",
    payload: {
      title: "Urban Growth and Sustainability",
      instruction:
        "Discuss the tension between rapid urban growth and the goal of environmental sustainability. What policies or approaches might help reconcile these competing demands? Write 180 to 250 words.",
    },
    source: "seed",
    validatedAt: SEED_DATE,
  },

  // C2 ──────────────────────────────────────────────────────────────────────
  {
    type: "prompt",
    level: "C2",
    topic: "culture and society",
    payload: {
      title: "The Paradox of Choice",
      instruction:
        "The psychologist Barry Schwartz argued that having more choices does not make people happier — it paralyses them. Critically evaluate this proposition, drawing on examples from everyday life or relevant research. Develop a coherent, well-argued response of 250 to 350 words.",
    },
    source: "seed",
    validatedAt: SEED_DATE,
  },
  {
    type: "prompt",
    level: "C2",
    topic: "culture and society",
    payload: {
      title: "Language and Thought",
      instruction:
        "To what extent does the language we speak shape the way we perceive and understand the world? Engage critically with this question, considering the theory of linguistic relativity and its counterarguments. Write 250 to 350 words.",
    },
    source: "seed",
    validatedAt: SEED_DATE,
  },
];

// ── loader ────────────────────────────────────────────────────────────────────

/**
 * Imports seed passages, prompts, and cards into @repo on first run.
 *
 * Idempotency: passages and prompts are checked separately by (type, source)
 * so that adding a new content type (e.g. prompts) only loads the missing
 * type — existing passages are not duplicated. Cards are bundled with passages
 * on initial install. A partial load (tab closed mid-run) is retried on the
 * next mount because the count check will still fail.
 *
 * Must be called from a browser context — IndexedDB is not available on the
 * server.
 */
export async function loadSeedIfEmpty(repo: ContentRepository): Promise<void> {
  const [seedPassages, seedPrompts] = await Promise.all([
    repo.queryContent({ type: "passage", source: "seed" }),
    repo.queryContent({ type: "prompt", source: "seed" }),
  ]);

  const passagesDone = seedPassages.length >= SEED_PASSAGES.length;
  const promptsDone = seedPrompts.length >= SEED_PROMPTS.length;

  if (passagesDone && promptsDone) return;

  if (!passagesDone) {
    for (const passage of SEED_PASSAGES) {
      await repo.putContent(passage);
    }
    for (const card of SEED_CARDS) {
      await repo.addCard(card);
    }
  }

  if (!promptsDone) {
    for (const prompt of SEED_PROMPTS) {
      await repo.putContent(prompt);
    }
  }
}

/** Expected totals — used by SeedBootstrap to verify the load completed. */
export const SEED_PASSAGE_COUNT = SEED_PASSAGES.length;
export const SEED_PROMPT_COUNT = SEED_PROMPTS.length;
export const SEED_CARD_COUNT = SEED_CARDS.length;
