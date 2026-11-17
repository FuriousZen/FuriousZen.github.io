/*
  Everything the routes section shows lives in this file.

  Adding a screenshot or clip:
    1. Drop the file into media/
    2. Set the matching slot's `src` below, e.g. src: "media/evenue-dashboard.png"
  Images (.png .jpg .webp .gif) and videos (.mp4 .webm) both work. Videos loop
  muted. A slot with no `src` renders as a chalk-outlined box with its label.

  Slot shapes: "wide" (16:10), "tall" (4:5), "phone" (iPhone portrait).

  The wall is built from these two lists in order, bottom hold to top hold.
  ROUTES are the holds up to the zone; MORE_ROUTES carry on to the top. Adding
  an entry adds a hold. `short` is an optional shorter name for the wall tag.
*/

window.ROUTES = [
  {
    id: "predexec",
    name: "predexec",
    color: "#F5C63C",
    set: "set Jun 2026",
    status: "still climbing",
    blurb:
      "A predictive execution engine that collapses multi-step LLM agent tool calls into a single round-trip.",
    body:
      "The model compiles its branch decisions up front into a tree of deterministic predicates. An engine then walks that tree with no model request between levels, and stops hard before anything that writes, installs or deletes. It trades abundant tokens for scarce requests on request-limited providers. The core is zero-dependency TypeScript with 200+ Vitest tests at 95% coverage, and it ships adapters for Pi, OpenCode, Claude Code, Codex CLI and Antigravity.",
    facts: [
      { n: "41%", label: "lower median task latency across a 120-task benchmark" },
      { n: "87%", label: "prediction hit rate on recorded agent traces" },
      { n: "27%", label: "fewer model round-trips per task" },
    ],
    stack: ["TypeScript", "Node", "Vitest", "MCP"],
    link: "https://github.com/FuriousZen/predexec",
    slots: [
      { shape: "wide", label: "Terminal clip of a plan tree resolving in one round-trip", src: "" },
      { shape: "tall", label: "Benchmark chart or trace view", src: "" },
    ],
  },
  {
    id: "evenue",
    name: "Evenue",
    color: "#3D8BF2",
    set: "set Nov 2025",
    status: "sent Mar 2026",
    blurb:
      "A cloud-native platform that scrapes university job fairs and club events into one searchable feed.",
    body:
      "Source adapters normalize very different campus calendar formats into one event schema. A three-stage MongoDB ingestion pipeline (exact hash, date blocking, fuzzy scoring) merges listings that were cross-posted under slightly different names. The React dashboard and API run as load-balanced services on Kubernetes, with autoscalers and readiness probes tuned on Kind clusters in CI for zero-downtime deploys.",
    facts: [
      { n: "150+", label: "events ingested per week from 20+ campus sources" },
      { n: "92%", label: "of duplicate listings eliminated by fuzzy matching" },
      { n: "<120 ms", label: "p95 search latency across 1,200+ indexed events" },
    ],
    stack: ["Docker", "Kubernetes", "Node", "React", "MongoDB"],
    link: "https://github.com/FuriousZen/Evenue",
    slots: [
      { shape: "wide", label: "Dashboard with search and category filters", src: "" },
      { shape: "tall", label: "Clip of pods scaling under load", src: "" },
    ],
  },
  {
    id: "fitr",
    name: "fitr",
    color: "#F0568C",
    set: "set Apr 2025",
    status: "sent",
    blurb:
      "An iOS app that picks an outfit from your own wardrobe, the local weather and your mood.",
    body:
      "The SwiftUI app handles accounts, profiles and wardrobe photos through Firebase Authentication, Firestore and Storage. A Flask backend embeds every garment with CLIP, shortlists candidates with a vector search in Postgres, and hands only that shortlist to Gemini to rank into outfits. Embeddings are cached in Postgres so repeat requests stay fast. It started as a HooHacks build.",
    facts: [
      { n: "88%", label: "top-3 recommendation acceptance in a three-week, 25-user beta" },
      { n: "<900 ms", label: "median end-to-end recommendation latency" },
      { n: "<300 ms", label: "for repeat requests with cached embeddings" },
    ],
    stack: ["Swift", "Firebase", "Gemini", "Postgres", "Flask", "CLIP"],
    link: "https://github.com/FuriousZen/fitr",
    slots: [
      { shape: "phone", label: "Login", src: "media/fitr-login.png" },
      { shape: "phone", label: "Wardrobe gallery", src: "media/fitr-gallery.png" },
      { shape: "phone", label: "Mood selection", src: "media/fitr-vibe.png" },
      { shape: "phone", label: "Outfit details", src: "media/fitr-outfit_details.png" },
      { shape: "phone", label: "Wardrobe management", src: "media/fitr-wardrobe.png" },
      { shape: "phone", label: "Screen recording of a full recommendation", src: "" },
    ],
  },
  {
    id: "solar",
    name: "Midwest Solar Analytics",
    short: "Midwest Solar",
    color: "#F2793B",
    set: "set Feb 2025",
    status: "sent Sep 2025",
    blurb:
      "An end-to-end ML pipeline that predicts how long a solar installation will take.",
    body:
      "Trained on historical installations aggregated from public permit and utility records. XGBoost regression is tuned with an Optuna search under 5-fold cross-validation, every run is tracked in MLflow, a SHAP dashboard shows stakeholders which features drove each prediction, and a FastAPI service handles inference.",
    facts: [
      { n: "0.86", label: "R² on installation timelines" },
      { n: "4.2 days", label: "mean absolute error" },
      { n: "<50 ms", label: "p95 inference latency from the FastAPI service" },
    ],
    stack: ["Python", "XGBoost", "FastAPI", "MLflow", "Optuna", "SHAP"],
    link: "https://github.com/FuriousZen/midwest-solar-analytics",
    slots: [
      { shape: "wide", label: "SHAP attribution dashboard", src: "" },
      { shape: "tall", label: "MLflow runs or a live prediction", src: "" },
    ],
  },
];

window.MORE_ROUTES = [
  {
    id: "treejit",
    name: "treejit",
    color: "#3FBF7F",
    set: "set Sep 2026",
    blurb: "An inference proxy with memory. A tracing JIT for agent trajectories.",
    body:
      "It sits between an agent harness and the model API, learns a persistent execution tree from successful runs, and replays proven tool-call sequences without calling the model. The model is only asked at the frontier: steps the tree has not seen and branches it cannot resolve. Failed branches are recorded and avoided.",
    stack: ["Python", "httpx", "uvicorn"],
    link: "https://github.com/FuriousZen/treejit",
    slots: [{ shape: "wide", label: "Replay trace or execution tree view", src: "" }],
  },
  {
    id: "webify",
    name: "Webify",
    color: "#8E6CF0",
    set: "set Sep 2026",
    blurb: "Turns a developer's real work into a cited, reviewed personal website, then publishes it.",
    body:
      "It ingests GitHub repositories and uploaded documents, extracts profile facts for the owner to approve, and drafts the site with a LangGraph workflow that pauses at six approval gates. A sandboxed browser review checks the compiled site before the approved version deploys to Cloudflare Pages.",
    stack: ["FastAPI", "Next.js", "LangGraph", "LlamaIndex", "pgvector", "Redis"],
    link: "https://github.com/FuriousZen/Webify",
    slots: [{ shape: "wide", label: "Live canvas during a site build", src: "" }],
  },
  {
    id: "atlas",
    name: "Atlas",
    color: "#2CC4C4",
    set: "set Sep 2026",
    blurb: "Research RAG that only keeps papers that have earned their citations.",
    body:
      "It polls Semantic Scholar, arXiv and OpenAlex through FastMCP servers and filters by citation count before spending anything on an LLM. The store is bounded on purpose, so the oldest documents are evicted first when it fills. Answers come back with a citation on every sentence.",
    stack: ["LangGraph", "LlamaIndex", "FastMCP", "Qdrant", "Redis", "Grafana"],
    link: "https://github.com/FuriousZen/atlas",
    slots: [{ shape: "wide", label: "Cited answer or the Grafana capacity board", src: "" }],
  },
  {
    id: "connector",
    name: "Connector",
    color: "#E5484D",
    set: "set Aug 2026",
    blurb: "Finds the strangest true route between any two ideas.",
    body:
      "Give it two anchors, say coffee and the French Revolution. It grows an evidence-backed knowledge graph outward from each one, then assembles the most defensible chain of cause-and-effect hops between them, with a source for every step.",
    stack: ["Next.js", "React", "TypeScript", "SQLite", "d3-force"],
    link: "https://github.com/FuriousZen/connector",
    slots: [{ shape: "wide", label: "Force-directed atlas with a finished journey", src: "" }],
  },
];
