# **Technical Architecture and Pedagogical Design for a Gamified, Hybrid-AI English Learning Web Application**

## **Frontend Architecture and Progressive Web Application Integration**

The realization of a modern, highly responsive, and pedagogically sound English language learning platform requires a robust frontend structure that minimizes latency, maximizes search engine visibility, and ensures a seamless mobile experience. Next.js 16, combined with React 19 and utilizing Turbopack as the default incremental bundler, provides a fast, stable development environment and optimized production builds1. By partitioning the application into Server Components and Client Components, intensive server-side data fetching and rendering can occur near the database, while high-fidelity interactive elements run natively on user devices1. Server-Side Rendering (SSR) is used for public-facing resource pages, marketing portals, and initial dashboard states, ensuring near-instantaneous load times and superior Search Engine Optimization (SEO) metrics1.  
To bridge the gap between desktop browsers and mobile environments, the application must be designed as a Progressive Web App (PWA)3. The service worker orchestrates the offline-first experience4. Historically, developers relied on libraries such as next-pwa for service worker configuration; however, these older libraries force compilation pipelines to fall back to Webpack, creating severe compatibility bottlenecks with Next.js 16's stable Turbopack bundler5. Consequently, Serwist (specifically the @serwist/next implementation) is the modern successor5. Serwist integrates with Turbopack, compiling the service worker code seamlessly into the public directory at build time5.  
To enable dynamic runtime adjustments—such as serving different app icons based on environmental configurations—the PWA manifest is served via a Next.js dynamic API route handler rather than a static JSON file5.  
For dynamic routes where pre-caching every potential user path is impractical, the application employs a dynamic fallback system4.  
The static assets and the core shell layout are cached permanently, and any unvisited dynamic lesson page intercepts network failures by rendering a pre-cached offline index page4. This shell boots the client-side router, reads cached lesson structures from the client database, and reconstructs the educational interface dynamically4.

| Asset Classification | Caching Strategy | Target Content | Offline Recovery Mechanism |
| :---- | :---- | :---- | :---- |
| **Static Shell & Core Assets** | Cache-First4 | Webpack/Turbopack JS bundles, CSS modules, global design fonts, and common SVGs4 | Immediate delivery from the browser's Cache Storage API4. |
| **Dynamic API Routes & Profiles** | Network-First4 | Real-time student progress records, current streak statistics, and immediate diagnostic data4 | Fall back to the most recent cached GET response stored in the local cache or database4. |
| **Vocabulary & Reference Logs** | Stale-While-Revalidate4 | Standard grammar modules, verified dictionary definitions, and level-appropriate vocabulary lists4 | Instant rendering of local database content, followed by background synchronization with the cloud backend4. |

## **Backend Strategy: Dual-Mode Routing and Database Scaling**

To serve both a single-user companion and a scalable, multi-user EdTech application, the backend infrastructure must support a dual-mode routing paradigm9. Under a single-user companion model, the web application runs completely client-side, storing progress locally on the user's device10. When multiple-user authorization is required, the application integrates with a cloud-based Backend-as-a-Service (BaaS)9.  
A comparative evaluation identifies Supabase as the optimal cloud provider for this architecture, outperforming proprietary NoSQL frameworks due to its integration of PostgreSQL9. Supabase provides built-in user authentication and Row-Level Security (RLS) policies9. This allows developers to securely partition user data and synchronize client-side caches directly with PostgreSQL tables9.

| Architectural Attribute | Client-Only Local Companion Mode | Multi-User Cloud-Synchronized Mode |
| :---- | :---- | :---- |
| **Authentication Layer** | None required; immediate system access. | Supabase Auth with RLS and OAuth integrations9. |
| **Primary Database Engine** | IndexedDB with a local CRDT sync engine4. | PostgreSQL 15+ managed instance on Supabase9. |
| **Access Control Mechanism** | Single-device boundary; full local access. | PostgreSQL Row-Level Security based on active session tokens9. |
| **Inference Routing** | WebLLM via local WebGPU API calls15. | Unified API endpoints routing to cloud LLM clusters17. |
| **Latency Profile** | Instant on-device execution10. | Subject to network conditions and server response times16. |

Database scaling for active educational platforms requires careful optimization for write-heavy diagnostic logging19. In PostgreSQL, every write or update operation generates a new version of the modified row to maintain transactional isolation20. This is managed by the Multi-Version Concurrency Control (MVCC) engine20.  
Because UUID keys introduce an index-to-data bloat of 60 to 100 bytes per record, high-frequency actions—such as a student completing dozens of micro-questions per minute—can cause write-ahead log (WAL) throughput spikes20. This forces the system designer to implement localized transaction aggregation20. Instead of writing every user interaction directly to the cloud database, client actions are batched inside local IndexedDB frames4. These are pushed to the Supabase database in a single network request at the end of a lesson, minimizing write amplification and keeping index sizes within the PostgreSQL buffer pool limits4.

## **Pedagogical Engine: Sourcing, Authentication, and Curated Reference Integration**

An educational platform requires verified, pedagogically sound content21. Sourcing learning materials from unverified datasets or unchecked LLM generations risks exposing users to grammatically incorrect or contextually inappropriate phrasing22.  
To guarantee educational integrity, the platform integrates authoritative language frameworks and curated reference datasets.

                              \+--------------------------+  
                              |      Pedagogical API     |  
                              |   Integration Manager    |  
                              \+------------+-------------+  
                                           |  
                  \+------------------------+------------------------+  
                  | (Lexical Queries)                               | (Semantic Context)  
                  v                                                 v  
    \+----------------------------+                    \+----------------------------+  
    |   Oxford Dictionaries API  |                    |         Words API          |  
    | \- Monolingual Definitions  |                    | \- Lexical Taxonomy         |  
    | \- Word Inflections & Roots |                    | \- Hypernyms & Hyponyms     |  
    | \- Audio Pronunciations     |                    | \- Usage Frequencies        |  
    \+-------------+--------------+                    \+-------------+--------------+  
                  |                                                 |  
                  \+------------------------+------------------------+  
                                           |  
                                           v  
                              \+--------------------------+  
                              |     CEFR Validation      |  
                              |      & Control Node      |  
                              \+------------+-------------+  
                                           |  
                  \+------------------------+------------------------+  
                  | (Cloud Validation Flow)                         | (Offline / Local Path)  
                  v                                                 v  
    \+----------------------------+                    \+----------------------------+  
    |   Cambridge EVP Database   |                    |    Words-CEFR-Dataset      |  
    | \- Precise Level Grading    |                    | \- Optimized Local SQLite3  |  
    | \- Context-Aware Sense Maps |                    | \- 20MB Fast POS Scoring    |  
    \+----------------------------+                    \+----------------------------+

### **Oxford Dictionaries API**

The primary service for lexical data queries21. It returns curated definitions, valid grammatical inflections, historical etymologies, and high-fidelity audio pronunciations across regional dialects21. This ensures that vocabulary lessons are accurate and reliable21.

### **Words API**

An essential service for resolving semantic connections23. It provides structural language context by mapping lexical hierarchies, such as identifying that a "hatchback" is a hyponym of the broader hypernym "car"23. This enables the application to dynamically generate vocabulary associations, synonym challenges, and structural semantic puzzles23.

### **Cambridge English Vocabulary Profile (EVP)**

An educational dataset that classifies English words and phrasal verbs into their exact Common European Framework of Reference (CEFR) levels24. Rather than simply checking if a word is common, the EVP maps specific meanings of a word to its appropriate learner level24. For example, the use of "fine" as an adjective for weather is categorized as A1, whereas "fine" used as a legal noun for a penalty is mapped to B224. This allows the platform to adjust definitions based on the user's current proficiency level24.

### **English Grammar Profile (EGP)**

The structural framework used to sequence grammar lessons25. It defines the standard progression of morphosyntactic acquisition across the CEFR spectrum, mapping exactly when learners typically master constructions such as past continuous, relative clauses, or conditional structures25.

### **Words-CEFR-Dataset**

To support offline PWA execution, the system can fallback to this optimized SQLite database26. This 20MB file maps lemmas, stems, parts of speech (POS), and Google Books N-gram frequency metrics to assign estimated CEFR labels locally26.  
Even when using generative AI to produce learning content, these datasets act as strict programmatic boundaries22. Before a generated sentence is displayed to the student, it runs through a validation pipeline that parses individual words and grammatical patterns22.  
If any element exceeds the targeted CEFR difficulty threshold, the system triggers corrective prompts to simplify the output, ensuring the content remains accessible and level-appropriate27.

## **Hybrid LLM Orchestration: Cloud Core and Local WebGPU/Ollama Services**

The platform utilizes a hybrid language model architecture to manage inference costs and enable offline functionality17. Simple tasks like vocabulary drills, conversation practice, and quick grammar checks are processed directly on the client's device using local models16.  
More complex operations, such as generating structured exams, analyzing writing portfolios, and administering adaptive diagnostic assessments, are routed to powerful cloud-based LLM clusters14.

| Architecture Metric | WebLLM (In-Browser GPU) | Local API (Ollama / Jan) | Cloud Core (Gemini / OpenAI) |
| :---- | :---- | :---- | :---- |
| **Inference Location** | Client WebGPU compiler layer16 | Client local daemon over HTTP17 | Enterprise server infrastructure11 |
| **Computational Cost** | $0 (Leverages user hardware)16 | $0 (Leverages user hardware)16 | Token-based usage costs11 |
| **Model Footprint** | 135M to 1.6GB quantized models10 | 1B to 8B parameter local files32 | Large, unquantized proprietary models |
| **First-Run Setup** | High initial model weights download10 | Requires separate client installation32 | Instant API access; no setup |
| **Offline Capability** | Fully functional offline15 | Fully functional offline33 | Offline access is unavailable |

### **In-Browser Inference via WebLLM**

To run on-device models efficiently, the application uses WebLLM, an engine powered by WebGPU acceleration that executes quantized models like Llama 3.2 1B or SmolLM2 135M directly inside the browser's context10. To prevent resource allocation freezes, the model runs within a dedicated Web Worker thread15.

TypeScript  
// lib/llm/web-worker-engine.ts  
import { WebWorkerMLCEngine } from "@mlc-ai/web-llm";

export class WebLLMService {  
  private engine: WebWorkerMLCEngine | null \= null;  
  private readonly modelId \= "Llama-3.2-1B-Instruct-q4f16\_1-MLC"; // Quantized 4-bit model

  async initialize(onProgress: (progress: number) \=\> void): Promise\<void\> {  
    if (this.engine) return;

    if (\!navigator.gpu) {  
      throw new Error("WebGPU is not supported by this browser.");  
    }

    // Initialize Web Worker thread  
    const worker \= new Worker(  
      new URL("./webllm.worker.ts", import.meta.url),  
      { type: "module" }  
    );

    this.engine \= new WebWorkerMLCEngine(worker);  
      
    await this.engine.reload(this.modelId, {  
      initProgressCallback: (report) \=\> {  
        onProgress(Math.round(report.progress \* 100)); // Track download progress  
      },  
      useIndexedDBCache: true, // Persist model weights locally in the browser  
    });  
  }

  async runInference(prompt: string, systemPrompt: string, onChunk: (text: string) \=\> void): Promise\<string\> {  
    if (\!this.engine) throw new Error("WebLLM service has not been initialized.");

    const completion \= await this.engine.chat.completions.create({  
      messages: \[  
        { role: "system", content: systemPrompt },  
        { role: "user", content: prompt }  
      \],  
      stream: true,  
      temperature: 0.2 // Low temperature to minimize hallucinations  
    });

    let result \= "";  
    for await (const chunk of completion) {  
      const content \= chunk.choices\[0\]?.delta?.content || "";  
      result \+= content;  
      onChunk(result);  
    }  
    return result;  
  }  
}

### **Dedicated Prompt Engineering and Output Validation**

Small, on-device language models (such as 1B parameter files) are highly sensitive to prompt structure and prone to formatting errors under open-ended tasks10. To ensure consistent behavior, the platform uses structured system prompts that enforce rigid JSON schemas10.  
When generating tests or checking answers, output payloads are parsed through schema validation engines (such as the Vercel AI SDK paired with a Zod validator)14. This enforces structural reliability and prevents execution errors10.

## **Skill-Specific Modules: Reading, Writing, Listening, and Speaking**

An effective digital English instructor must provide systematic, interactive instruction across all four primary language modalities35. The platform implements dedicated modules optimized for reading comprehension, structured writing, active listening, and speaking pronunciation.

                              \+--------------------------+  
                              |      Four Modalities     |  
                              |      Learning Core       |  
                              \+------------+-------------+  
                                           |  
         \+------------------+--------------+--------------+------------------+  
         |                  |                             |                  |  
         v                  v                             v                  v  
  \+--------------+   \+--------------+              \+--------------+   \+--------------+  
  |   Reading    |   |   Writing    |              |  Listening   |   |   Speaking   |  
  \+--------------+   \+--------------+              \+--------------+   \+--------------+  
  | \- Graded text|   | \- SFT Prompt |              | \- Web Speech |   | \- Azure SDK  |  
  |   adaptation |   |   checks     |              |   Synthesizer|   |   PronScore  |  
  | \- Interactive|   | \- Grammatical|              | \- Whisper-   |   | \- Offline    |  
  |   vocabulary |   |   error logs |              |   tiny Mono  |   |   Phonetic   |  
  |   mapping    |   |   and metrics|              |   Transcribe |   |   Levenshtein|  
  \+--------------+   \+--------------+              \+--------------+   \+--------------+

### **Reading Comprehension Module**

The reading module adapts texts to match the user's specific CEFR level27. This is achieved using an iterative text simplification model27.  
When a user selects a topic, the LLM generates a level-appropriate passage, and the client-side rendering engine displays interactive tooltips for key terms35.  
Users can tap any unfamiliar word to fetch its definition, phonetic notation, and usage examples directly from local storage or the Oxford Dictionaries API21.

### **Writing Diagnostic and Feedback Module**

The writing engine provides structural assessments for composition prompts35. Using the Vercel AI SDK on the backend, student essays are processed using supervised instruction tuning14.  
The model analyzes grammar, syntax, and spelling, and generates a structured evaluation report35:

JSON  
{  
  "submission\_evaluation": {  
    "overall\_score": 82,  
    "structural\_grade": "B2",  
    "corrections": \[  
      {  
        "original\_phrase": "He write English very good.",  
        "corrected\_phrase": "He writes English very well.",  
        "grammatical\_category": "subject-verb agreement / adverbial usage",  
        "pedagogical\_explanation": "Singular subjects require singular verb conjugations. Adverbs modify verbs, so 'well' should be used instead of the adjective 'good'."  
      }  
    \]  
  }  
}

These errors are parsed programmatically and appended to the user's local error logs, ensuring that future lessons and quizzes address these specific weaknesses14.

### **Listening Comprehension and Transcription Module**

The listening module uses a combination of client-side text-to-speech synthesis and transcription training35. The platform generates target sentences using the browser's built-in SpeechSynthesis API, allowing users to configure pronunciation speeds and select regional accents41.  
For comprehensive exams, the system plays audio files containing natural background noise and prompts users to transcribe what they hear40.  
The resulting transcription is processed locally using a fast Whisper instance, scoring accuracy and identifying listening comprehension blind spots40.

### **Speaking and Pronunciation Assessment Module**

The speaking module evaluates pronunciation accuracy in real time43.  
For cloud-connected users, the application streams voice input to the Microsoft Azure Cognitive Services Pronunciation Assessment API43.  
The API evaluates the user's recording against a reference string and returns detailed metrics44:

JSON  
{  
  "pronunciation\_metrics": {  
    "AccuracyScore": 92.0,  
    "FluencyScore": 87.0,  
    "CompletenessScore": 100.0,  
    "ProsodyScore": 89.0,  
    "PronScore": 91.5,  
    "Words": \[  
      {  
        "Word": "hello",  
        "AccuracyScore": 95.0,  
        "ErrorType": "None",  
        "Phonemes": \[  
          { "Phoneme": "h", "AccuracyScore": 98.0 },  
          { "Phoneme": "ə", "AccuracyScore": 92.0 }  
        \]  
      }  
    \]  
  }  
}

For offline or single-user companion mode, pronunciation is processed on-device using a local Whisper-tiny model to transcribe the audio40.  
The system compares the generated transcription with the expected reference text using a phonetic Levenshtein alignment algorithm, calculating the Word Error Rate to provide immediate pronunciation feedback48.

## **Active Recall, Diagnostics, and Event-Driven Gamification Engine**

An effective educational application must maintain student motivation and prevent user churn51. The platform combines active recall techniques with real-time diagnostic insight dashboards and gamified progression mechanics14.

### **Optimized SM2 Spaced Repetition Implementation**

The vocabulary system implements the SuperMemo-2 (SM2) algorithm to calculate optimal study intervals for each learner53. Based on user feedback ratings (0–5), the system adjusts the interval (![][image1]) and Easiness Factor (![][image2]) to schedule reviews before memory decay occurs53.

                                  \[Review Active Card\]  
                                           |  
                                           v  
                                \[Rate Recall Quality 0-5\]  
                                           |  
                  \+------------------------+------------------------+  
                  | (Recall Quality \< 3\)                            | (Recall Quality \>= 3\)  
                  v                                                 v  
    \+----------------------------+                    \+----------------------------+  
    |   Reset Study State        |                    |   Advance Interval State   |  
    | \- Set Repetitions to 0     |                    | \- Increment Repetitions \+1 |  
    | \- Set Next Interval to 1 d |                    | \- Multiply Current Interval|  
    | \- Maintain current EF      |                    |   by new computed EF       |  
    \+-------------+--------------+                    \+-------------+--------------+  
                  |                                                 |  
                  \+------------------------+------------------------+  
                                           |  
                                           v  
                              \+--------------------------+  
                              |   Save to User Database  |  
                              |  (Trigger Next Review)   |  
                              \+--------------------------+

To optimize on-device performance, the system uses DolphinSR, an optimized JS/TS spaced repetition package56. It organizes card states in a functional structure, accounting for early or late completions and minimizing database update operations56.

### **Event-Driven Gamification Architecture**

To avoid blocking the interface during user interactions, gamification features such as experience points (XP), daily streaks, and achievement badges are calculated asynchronously19.  
When a user completes an activity, the front-end fires an event and immediately returns a success state19.  
In the background, a serverless worker or database function processes the event, updates the user's score, and pushes notifications to the client via WebSockets19.

SQL  
\-- PostgreSQL trigger to process streaks and award badges  
create or replace function public.evaluate\_user\_streaks()  
returns trigger as $$  
declare  
  prev\_activity\_date date;  
begin  
  select last\_activity\_date into prev\_activity\_date  
  from public.profiles  
  where id \= new.user\_id;

  \-- Maintain and increment active daily study streaks  
  if prev\_activity\_date \= current\_date \- 1 then  
    update public.profiles  
    set streak\_count \= streak\_count \+ 1,  
        last\_activity\_date \= current\_date  
    where id \= new.user\_id;  
  elsif prev\_activity\_date \< current\_date \- 1 or prev\_activity\_date is null then  
    update public.profiles  
    set streak\_count \= 1,  
        last\_activity\_date \= current\_date  
    where id \= new.user\_id;  
  end if;

  return new;  
end;  
$$ language plpgsql security definer;

To create an intuitive onboarding experience, the client-side interface includes guided step-by-step product walkthroughs powered by lightweight React onboarding libraries like NextStepjs and Stepperize57. These libraries guide the user through the interface without disrupting the learning flow57.

### **Comprehensive Diagnostic Testing and Weakness Heatmaps**

The evaluation engine includes diagnostic testing modules and exam modes designed to pinpoint specific linguistic weaknesses13.

                     \+---------------------------------------+  
                     |        Active Exam Completion         |  
                     \+-------------------+-------------------+  
                                         |  
                     \+-------------------v-------------------+  
                     |      Error Analysis & Extraction      |  
                     |     \- Typographical Orthography       |  
                     |     \- Syntactic Structural Errors     |  
                     |     \- Phonetic Misalignments          |  
                     \+-------------------+-------------------+  
                                         |  
                     \+-------------------v-------------------+  
                     |       Supabase Schema Updates         |  
                     |    \- Increment Specific Categories    |  
                     |    \- Log Context & Sentence Strings   |  
                     \+-------------------+-------------------+  
                                         |  
                     \+-------------------v-------------------+  
                     |      Client Heatmap Visualization     |  
                     |   \- Target high-frequency anomalies   |  
                     |   \- Highlight concept mastery levels  |  
                     \+---------------------------------------+

1. **Active Exam Completion**: Users take periodic, comprehensive tests across reading, writing, listening, and speaking modules14.  
2. **Error Analysis and Extraction**: The system analyzes test submissions to catalog errors into specific linguistic categories, such as orthographical typos, syntactic structure mistakes, or phonetic pronunciation errors14.  
3. **Supabase Schema Updates**: Errors are logged in the user\_error\_logs table, incrementing mistake weights for corresponding categories and capturing contextual sentences for reference14.  
4. **Client Heatmap Visualization**: The frontend translates this diagnostic data into a visual heatmap, displaying concept mastery levels, highlighting areas that need improvement, and adjusting the user's study path to focus on high-frequency error categories14.

## **Strategic Deployment Roadmap and System Implementation Lifecycle**

To build the application systematically, development is divided into four distinct phases.

  Phase 1: Architecture        Phase 2: Hybrid AI           Phase 3: Speaking           Phase 4: Diagnostics  
\+----------------------+    \+----------------------+    \+----------------------+    \+----------------------+  
| \- Next.js 16 setup   |    | \- WebLLM framework   |    | \- Azure SDK & Local  |    | \- Diagnostic exam    |  
| \- Serwist PWA layer  |    | \- EVP validation     |    |   Whisper engines    |    |   dashboards         |  
| \- Supabase setup     | \-\> | \- Structured prompt  | \-\> | \- WER Levenshtein    | \-\> | \- Event-driven XP    |  
| \- Multi-user RLS     |    |   API routing        |    |   pronunciation      |    |   streaks & badges   |  
|   integration        |    | \- Dual-mode routing  |    |   pipeline setup     |    | \- Final UX polish    |  
\+----------------------+    \+----------------------+    \+----------------------+    \+----------------------+

### **Phase 1: Core Systems Setup**

Configure Next.js 16 with React 19 and Turbopack1. Implement Serwist to manage service worker caching, pre-caching, and offline fallbacks4. Initialize the Supabase project, establish the core database schema, and configure Row-Level Security policies to secure multi-user environments9.

### **Phase 2: Hybrid AI & Validated Sourcing**

Build the API infrastructure using the Vercel AI SDK14. Integrate local WebLLM support for on-device inference alongside cloud API connections16. Implement content validation rules using Cambridge EVP datasets to ensure all learning materials align with target CEFR levels24.

### **Phase 3: Speech Processing & Audio Tools**

Set up the browser MediaRecorder pipeline to capture and normalize user speech to 16kHz mono audio40. Connect cloud pronunciation analysis using the Azure Cognitive Services SDK43. Implement offline fallback evaluations using local Whisper transcriber models and phonetic Levenshtein comparison algorithms40.

### **Phase 4: Gamification & Performance Tuning**

Build the diagnostic testing system, weakness database, and visual progress heatmaps14. Set up the database logic to process streaks, badges, and experience points in the background19.  
Apply final performance optimizations, including database vacuum settings, client-side caching, and UX transitions using Tailwind CSS and Framer Motion, ensuring a smooth, engaging user experience4.

#### **Works cited**

1. TanStack Start vs Next.js 16: Ultimate Comparison 2026 | Build with Matija \- BuildWithMatija, [https://www.buildwithmatija.com/blog/tanstack-start-vs-nextjs-16-comparison](https://www.buildwithmatija.com/blog/tanstack-start-vs-nextjs-16-comparison)  
2. Best Next.js Alternatives (2026): Remix, Astro, SvelteKit & More \- Naturaily, [https://naturaily.com/blog/best-nextjs-alternatives](https://naturaily.com/blog/best-nextjs-alternatives)  
3. Next.js 16 PWA: Convert Your App in 10 Minutes | Build with Matija \- BuildWithMatija, [https://www.buildwithmatija.com/blog/turn-nextjs-16-app-into-pwa](https://www.buildwithmatija.com/blog/turn-nextjs-16-app-into-pwa)  
4. Building an Offline-First Next.js 15 App with App Router and Dynamic Routes \#82498, [https://github.com/vercel/next.js/discussions/82498](https://github.com/vercel/next.js/discussions/82498)  
5. Dynamically Generating PWA App Icons in Next.js 16 with Serwist | Aurora Scharff, [https://aurorascharff.no/posts/dynamically-generating-pwa-app-icons-nextjs-16-serwist/](https://aurorascharff.no/posts/dynamically-generating-pwa-app-icons-nextjs-16-serwist/)  
6. Workbox service-worker with turbopack in production (next 16\) \- Stack Overflow, [https://stackoverflow.com/questions/79859625/workbox-service-worker-with-turbopack-in-production-next-16](https://stackoverflow.com/questions/79859625/workbox-service-worker-with-turbopack-in-production-next-16)  
7. PWA: Build Installable Next.js App that Works Offline \- DEV Community, [https://dev.to/stephengade/pwa-build-installable-nextjs-app-that-works-offline-3fff](https://dev.to/stephengade/pwa-build-installable-nextjs-app-that-works-offline-3fff)  
8. Writing an SPA with Next? (using AppRouter) · vercel next.js · Discussion \#60365 \- GitHub, [https://github.com/vercel/next.js/discussions/60365](https://github.com/vercel/next.js/discussions/60365)  
9. Supabase vs Appwrite (2026): Which Is Better? | ZTABS, [https://ztabs.co/compare/supabase-vs-appwrite](https://ztabs.co/compare/supabase-vs-appwrite)  
10. The Zero-Marginal-Cost Architecture: Why I Built a Wealth Planner to Run Entirely on the Edge | by M Mostagir Bhuiyan | Medium, [https://medium.com/@mmostagirbhuiyan/the-zero-marginal-cost-architecture-why-i-built-a-wealth-planner-to-run-entirely-on-the-edge-e632ba727490](https://medium.com/@mmostagirbhuiyan/the-zero-marginal-cost-architecture-why-i-built-a-wealth-planner-to-run-entirely-on-the-edge-e632ba727490)  
11. Supabase vs Firebase 2026: Full Comparison for Web Apps \- WeWeb, [https://www.weweb.io/blog/supabase-vs-firebase-comparison-for-web-apps](https://www.weweb.io/blog/supabase-vs-firebase-comparison-for-web-apps)  
12. State Management with Zustand: A Practical Example | by Graeme Byrne | Medium, [https://medium.com/@grmbrn89/state-management-with-zustand-a-practical-example-91e9534ba63a](https://medium.com/@grmbrn89/state-management-with-zustand-a-practical-example-91e9534ba63a)  
13. Building Mindryx: From Local AWS Emulation to Production SaaS AI Quiz Generator, [https://dev.to/humza\_inam/building-mindryx-from-local-aws-emulation-to-production-saas-ai-quiz-generator-38eo](https://dev.to/humza_inam/building-mindryx-from-local-aws-emulation-to-production-saas-ai-quiz-generator-38eo)  
14. Vashishta-Mithra-Reddy/sift: Open Source AI Based Learning Platform (Quizzes, Flashcards, Learning Paths, Courses, etc) \- GitHub, [https://github.com/Vashishta-Mithra-Reddy/sift](https://github.com/Vashishta-Mithra-Reddy/sift)  
15. WebLLM Guide: Run AI Models in Your Browser (2026) \- Local AI Master, [https://localaimaster.com/blog/webllm-browser-ai-guide](https://localaimaster.com/blog/webllm-browser-ai-guide)  
16. Private-First AI: Building a Browser-Based Mental Health Classifier with WebLLM and WebGPU \- DEV Community, [https://dev.to/beck\_moulton/private-first-ai-building-a-browser-based-mental-health-classifier-with-webllm-and-webgpu-4ai2](https://dev.to/beck_moulton/private-first-ai-building-a-browser-based-mental-health-classifier-with-webllm-and-webgpu-4ai2)  
17. Community Providers: Ollama \- AI SDK, [https://ai-sdk.dev/providers/community-providers/ollama](https://ai-sdk.dev/providers/community-providers/ollama)  
18. Build a Hybrid AI App With WebLLM & Qwen 3 Next on Koyeb, [https://www.koyeb.com/tutorials/build-a-hybrid-ai-app-with-web-llm-qwen-3-next-js](https://www.koyeb.com/tutorials/build-a-hybrid-ai-app-with-web-llm-qwen-3-next-js)  
19. Gamifying Distributed Systems: Designing a Scalable Mission, XP, and Achievement Engine, [https://dev.to/mountek/gamifying-distributed-systems-designing-a-scalable-mission-xp-and-achievement-engine-472n](https://dev.to/mountek/gamifying-distributed-systems-designing-a-scalable-mission-xp-and-achievement-engine-472n)  
20. Help in predicting our project cost in supabase? \- Reddit, [https://www.reddit.com/r/Supabase/comments/1slax4s/help\_in\_predicting\_our\_project\_cost\_in\_supabase/](https://www.reddit.com/r/Supabase/comments/1slax4s/help_in_predicting_our_project_cost_in_supabase/)  
21. Oxford Dictionaries API, [https://languages.oup.com/products/oxford-dictionaries-api/](https://languages.oup.com/products/oxford-dictionaries-api/)  
22. Controllable Spoken Dialogue Generation: An LLM-Driven Grading System for K-12 Non-Native English Learners \- arXiv, [https://arxiv.org/html/2604.22542v1](https://arxiv.org/html/2604.22542v1)  
23. WordsAPI, [https://www.wordsapi.com/](https://www.wordsapi.com/)  
24. CEFR for English words by level \- Open Data Stack Exchange, [https://opendata.stackexchange.com/questions/17612/cefr-for-english-words-by-level](https://opendata.stackexchange.com/questions/17612/cefr-for-english-words-by-level)  
25. Grammar Control in Dialogue Response Generation for Language Learning Chatbots, [https://arxiv.org/html/2502.07544v1](https://arxiv.org/html/2502.07544v1)  
26. Maximax67/Words-CEFR-Dataset \- GitHub, [https://github.com/Maximax67/Words-CEFR-Dataset](https://github.com/Maximax67/Words-CEFR-Dataset)  
27. Archaeology at TSAR 2025 Shared Task: Teaching Small Models to do CEFR Simplifications \- ACL Anthology, [https://aclanthology.org/2025.tsar-1.22.pdf](https://aclanthology.org/2025.tsar-1.22.pdf)  
28. Vercel AI SDK Provider \- WebLLM \- Browser-Native AI Protocol, [https://www.webllm.org/docs/vercel-ai-sdk](https://www.webllm.org/docs/vercel-ai-sdk)  
29. Use Local Models With Vercel's AI SDK \- AI Hero, [https://www.aihero.dev/use-local-models-with-vercel-ai-sdk](https://www.aihero.dev/use-local-models-with-vercel-ai-sdk)  
30. Build an offline AI chatbot with WebLLM and WebGPU \- Appwrite, [https://appwrite.io/blog/post/chatbot-with-webllm-and-webgpu](https://appwrite.io/blog/post/chatbot-with-webllm-and-webgpu)  
31. Supabase vs Firebase: Which Backend Makes the Most Sense in 2026? \- UpCloud, [https://upcloud.com/global/blog/supabase-vs-firebase-which-backend-makes-the-most-sense-in-2026/](https://upcloud.com/global/blog/supabase-vs-firebase-which-backend-makes-the-most-sense-in-2026/)  
32. Insanely Easy Local First AI ChatBot With Astro, Ollama and Vercel's AI Library, [https://jherr2020.medium.com/insanely-easy-local-first-ai-chatbot-with-astro-ollama-and-vercels-ai-library-7b087ce032dc](https://jherr2020.medium.com/insanely-easy-local-first-ai-chatbot-with-astro-ollama-and-vercels-ai-library-7b087ce032dc)  
33. Build a local and offline-capable chatbot with WebLLM \- web.dev, [https://web.dev/articles/ai-chatbot-webllm](https://web.dev/articles/ai-chatbot-webllm)  
34. 11+ Best Next.js Boilerplates and Starter Kit for 2026, [https://nextjstemplates.com/blog/nextjs-boilerplates](https://nextjstemplates.com/blog/nextjs-boilerplates)  
35. AI Guide for Language Teachers: From Basics to Advanced Prompting \- Edumo, [https://edumo.io/resources/ai-guide](https://edumo.io/resources/ai-guide)  
36. Plain text English dictionary database WITH definitions? : r/opensource \- Reddit, [https://www.reddit.com/r/opensource/comments/1spu49e/plain\_text\_english\_dictionary\_database\_with/](https://www.reddit.com/r/opensource/comments/1spu49e/plain_text_english_dictionary_database_with/)  
37. 19 AI prompts for TEFL teachers, [https://www.tefl.org/blog/19-ai-prompts-for-tefl-teachers/](https://www.tefl.org/blog/19-ai-prompts-for-tefl-teachers/)  
38. CEFR-Aligned Language Model (CELL) \- Emergent Mind, [https://www.emergentmind.com/topics/cefr-aligned-language-model-cell](https://www.emergentmind.com/topics/cefr-aligned-language-model-cell)  
39. Work by Robert Andrei Paduraru \- Contra, [https://contra.com/umbral\_chimera\_nzoz7iub](https://contra.com/umbral_chimera_nzoz7iub)  
40. Building a Browser-Based Speech-to-Text System with Whisper AI \- DEV Community, [https://dev.to/linmingren/building-a-browser-based-speech-to-text-system-with-whisper-ai-23e5](https://dev.to/linmingren/building-a-browser-based-speech-to-text-system-with-whisper-ai-23e5)  
41. Using the Web Speech API \- MDN Web Docs, [https://developer.mozilla.org/en-US/docs/Web/API/Web\_Speech\_API/Using\_the\_Web\_Speech\_API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API)  
42. Offline speech recognition with Whisper: Browser \+ Node.js implementations \- AssemblyAI, [https://www.assemblyai.com/blog/offline-speech-recognition-whisper-browser-node-js](https://www.assemblyai.com/blog/offline-speech-recognition-whisper-browser-node-js)  
43. I Gave My Next.js App Ears—Real-Time STT with Azure | by Yogendra Sisodia | Medium, [https://medium.com/@scholarly360/i-gave-my-next-js-app-ears-real-time-stt-with-azure-a857379d4251](https://medium.com/@scholarly360/i-gave-my-next-js-app-ears-real-time-stt-with-azure-a857379d4251)  
44. Azure Speech Pronunciation Assessment \- Connectors \- Microsoft Learn, [https://learn.microsoft.com/en-us/connectors/azurespeechpronuncia/](https://learn.microsoft.com/en-us/connectors/azurespeechpronuncia/)  
45. Use pronunciation assessment \- Foundry Tools | Microsoft Learn, [https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-pronunciation-assessment](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-pronunciation-assessment)  
46. Analyze your Pronunciation with Twilio Programmable Voice, OpenAI Realtime API, and Azure AI Speech, [https://www.twilio.com/en-us/blog/ai-voice-analyze-pronunciation-twilio-programmable-voice-openai-azure-speech](https://www.twilio.com/en-us/blog/ai-voice-analyze-pronunciation-twilio-programmable-voice-openai-azure-speech)  
47. Thiagohgl/ai-pronunciation-trainer: This tool uses AI to evaluate your pronunciation. \- GitHub, [https://github.com/Thiagohgl/ai-pronunciation-trainer](https://github.com/Thiagohgl/ai-pronunciation-trainer)  
48. What is Word Error Rate (WER): How it's calculated, and why it can mislead \- Gladia, [https://www.gladia.io/blog/what-is-wer](https://www.gladia.io/blog/what-is-wer)  
49. Word error rate \- Wikipedia, [https://en.wikipedia.org/wiki/Word\_error\_rate](https://en.wikipedia.org/wiki/Word_error_rate)  
50. NickRuiz/power-asr: Phonetically-Oriented Word Error Rate \- GitHub, [https://github.com/NickRuiz/power-asr](https://github.com/NickRuiz/power-asr)  
51. How to Develop a Quiz App? \- Abbacus Technologies, [https://www.abbacustechnologies.com/how-to-develop-a-quiz-app/](https://www.abbacustechnologies.com/how-to-develop-a-quiz-app/)  
52. Leveraging Gamification for Design and Implementation of an Online Learning Platform \- IIAI – International Institute of Applied Informatics, [https://www.iaiai.org/journals/index.php/IJLTLE/article/view/739/629](https://www.iaiai.org/journals/index.php/IJLTLE/article/view/739/629)  
53. JoelYYoung/memo-ai: Obsidian plugin for AI powered chuck extraction and review system for notes \- GitHub, [https://github.com/joelyyoung/memo-ai](https://github.com/joelyyoung/memo-ai)  
54. java \- Spaced repetition algorithm from SuperMemo (SM-2) \- Stack Overflow, [https://stackoverflow.com/questions/49047159/spaced-repetition-algorithm-from-supermemo-sm-2](https://stackoverflow.com/questions/49047159/spaced-repetition-algorithm-from-supermemo-sm-2)  
55. A JavaScript and TypeScript implementation of SuperMemo 2, a spaced repetition algorithm for flashcards. \- GitHub, [https://github.com/VienDinhCom/supermemo](https://github.com/VienDinhCom/supermemo)  
56. yodaiken/dolphinsr: Spaced repetition for JavaScript \- GitHub, [https://github.com/yodaiken/dolphinsr](https://github.com/yodaiken/dolphinsr)  
57. officialrajdeepsingh/awesome-nextjs: A curated list of awesome Nextjs-based libraries that help build small and large-scale applications with next.js. \- GitHub, [https://github.com/officialrajdeepsingh/awesome-nextjs](https://github.com/officialrajdeepsingh/awesome-nextjs)  
58. Speech Recognition in the Browser with Transformers.js, [https://blog.rasc.ch/2025/01/transformers-js-speech.html](https://blog.rasc.ch/2025/01/transformers-js-speech.html)  
59. Top 10 Open Source Next JS Boilerplate in 2025 \- ThemeSelection, [https://themeselection.com/blog/next-js-boilerplate/](https://themeselection.com/blog/next-js-boilerplate/)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAAaCAYAAABhJqYYAAAAnUlEQVR4XmNgGPqgHYjnAvEsJDwNiMWQFcGAMxBHAPF5IP4PxBuhYqzIipCBIBCfBuJ/QOyCJocBohkgpu4BYm40OQwwiQGiuBVdAh3wAvFhBohiTzQ5DKAJxG+B+DkQK6HJYQCYE0A0QXCAAaI4CE0cKwBZD3IGyDkEAchUUBiDwhovEGeAKC4GYkY0OTgARS9IETouQlY0CgYpAABmpiDoT8wNjgAAAABJRU5ErkJggg==>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB8AAAAaCAYAAABPY4eKAAABfUlEQVR4Xu2UPS8FQRSGj1CISEQIEY2IhhCFKIhGR6Gi09wfoNf4CRqiIUQofEQQiUavo1D4AxqFREGiUAjv68xJzh07djuFeZIne+fMvrs7Z+6uSOa/Mwu3Kspzjaq5NdinkZ+MwAV4AT9hLYzNTfgU5pY18o3PPUh9bhEeww/4Bsc0kmZd9AYN8QQYgI9wLp4Qze1Kca4m+mA9Ub2OQfgs+pSeoXBshedw1M0Ry8V1gys+gM3xhIdt4qpvXI03PAm/u+BROHos1+5qnbA7/J6Gq26uEGs522fMw2s3LsJynhnYFNWS8Km5Yl7kFu7A+zDmxVP4nP3RVuCLP6kM33JrXwe8Et1Twj3jNniKtmoc3rlxKduiF+HR6IeHojdkC/dE2+mxnN+qKbjvxr/iW8eVFDEML2Gbq6VyvaLvfyX4irwGU68LV7gU1SxX6QOS4lT06fkaNYYaPxbc80nRFm6EmsdyZ7AlmitlAr6LXqBMnmukcv6bn8lkMn/HF0rPaBjDhGm3AAAAAElFTkSuQmCC>