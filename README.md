# Local RAG chatbot for an ophthalmology practice

A chat widget embedded in a clinic website, backed by a RAG pipeline that runs
entirely on premises. No cloud dependency, no patient data leaves the building.
Semantic search uses DrBERT, a model trained on French medical text.

All clinic details in the knowledge base, the system prompt and the widget are
fictional placeholders. Replace them before any deployment.

## Why run the pipeline locally

A clinic chatbot receives messages describing symptoms. Those messages are
health data. Sending them through a third party API raises a regulatory problem
and a trust problem, so the whole pipeline runs on the clinic server, on CPU
inference, with no GPU required.

The system prompt is a four level triage tree. Level 1 detects ophthalmic
emergencies (trauma, dark veil, photopsia, transient vision loss) and overrides
everything else in the message. Level 2 covers post operative symptoms. Level 3
answers administrative questions from the knowledge base. Level 4 refuses the
narrow set of cases that would amount to a diagnosis, an opinion on another
doctor's prescription, or a pricing commitment. See
[prompts/system_prompt.md](prompts/system_prompt.md).

## Architecture

```text
┌──────────────────────────────────────────────────────────┐
│                    FRONTEND (static)                      │
│                                                          │
│  index.html (demo page)                                  │
│  chatbox/css/chatbox.css  +  chatbox/js/script.js        │
└────────────────────────┬─────────────────────────────────┘
                         │ POST /api/v1/workspace/:slug/chat
                         ▼
┌──────────────────────────────────────────────────────────┐
│              LOCAL AI BACKEND (Docker + Python)           │
│                                                          │
│  AnythingLLM   ──►  RAG engine and orchestration         │
│  Ollama        ──►  Gemma 3 12B (generation model)       │
│  DrBERT API    ──►  FastAPI embedding microservice       │
│  LanceDB       ──►  local vector database                │
└──────────────────────────────────────────────────────────┘
```

`biomistral_api/` is an alternative track. It exposes BioMistral-Clinical-7B
behind an OpenAI compatible API and can replace Ollama as the LLM provider. It
ships as is, experimental. The setup documented below uses Ollama.

## Project structure

```text
.
├── index.html                  # demo page hosting the widget
│
├── chatbox/
│   ├── css/
│   │   └── chatbox.css         # widget styles
│   └── js/
│       ├── config.example.js   # configuration template
│       ├── config.js           # real configuration (git ignored)
│       └── script.js           # AnythingLLM API client and widget logic
│
├── drbert_api/                 # LOCAL EMBEDDING MICROSERVICE
│   ├── main.py                 # FastAPI server wrapping DrBERT
│   └── requirements.txt
│
├── biomistral_api/             # alternative LLM microservice (experimental)
│   ├── mainbio.py
│   └── requirements.txt
│
├── knowledge_base/
│   └── knowledge_base.md       # RAG source document, loaded into AnythingLLM
│
└── prompts/
    └── system_prompt.md        # four level triage system prompt
```

## Requirements

| Tool | Role | Install |
|------|------|---------|
| Docker Desktop | Runs the AnythingLLM and Ollama containers | [docker.com](https://www.docker.com/products/docker-desktop/) |
| Python 3.11 or 3.12 | Runs the DrBERT embedding API | [python.org](https://www.python.org/) |
| A local HTTP server | Serves the demo page and avoids CORS errors on `file://` | for example the VS Code extension `ritwickdey.LiveServer` |

## Setup

### 1. Start the DrBERT embedding API

This microservice turns French medical text into vectors.

```bash
cd drbert_api
python3.11 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

Wait for `Uvicorn running on http://0.0.0.0:8000`.

### 2. Start Ollama and pull the model

```bash
docker run -d -v ollama:/root/.ollama -p 11434:11434 --name ollama ollama/ollama
docker exec -it ollama ollama pull gemma3:12b
```

### 3. Start AnythingLLM

```bash
docker run -d \
  -p 3001:3001 \
  -v ${PWD}/anythingllm_storage:/app/server/storage \
  --name anythingllm \
  mintplexlabs/anythingllm
```

Open `http://localhost:3001` and run the setup wizard.

* LLM Provider, Ollama, `http://host.docker.internal:11434`, model `gemma3:12b`
* Embedding model, Generic OpenAI, base URL `http://host.docker.internal:8000/v1`, model `drbert`, max chunk `512`
* Vector database, LanceDB

### 4. Configure the RAG workspace

1. Create a workspace and note its slug, needed in step 6.
2. Set Chat Mode to Query. The model then answers only from indexed documents,
   which limits invented answers.
3. Upload `knowledge_base/knowledge_base.md` to the workspace documents and run
   the embedding.
4. Paste the contents of `prompts/system_prompt.md` into Workspace Settings,
   System Prompt.

### 5. Generate an API key

In AnythingLLM, Settings, API Keys, Generate New API Key.

### 6. Configure the widget

```bash
cp chatbox/js/config.example.js chatbox/js/config.js
```

Then fill in your values.

```javascript
const CONFIG = {
    ANYTHINGLLM_BASE : 'http://localhost:3001',
    WORKSPACE_SLUG   : 'your-slug',
    API_KEY          : 'your-api-key',
    CONTACT_PHONE    : '01 23 45 67 89'
};
```

`config.js` is git ignored. The API key must never be committed.

## Running the demo

Do not open `index.html` by double clicking it. Browsers block `fetch()` calls
to `localhost` from a `file://` origin.

Serve the folder over a local HTTP server, then open `index.html`. With Live
Server the address is `http://127.0.0.1:5500`.

## Embedding the widget in an existing site

1. Copy the `chatbox/` folder to the site root.
2. Add `<link rel="stylesheet" href="chatbox/css/chatbox.css" />` to the `<head>`.
3. Copy the widget markup from `index.html`, from `<button id="rag-chat-bubble">`
   to the closing tag of `<div id="rag-chat-window">`, just before `</body>`.
4. Load the scripts in this order, after the markup.

```html
<script src="chatbox/js/config.js"></script>
<script src="chatbox/js/script.js"></script>
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Embedding fails in AnythingLLM | The DrBERT API is not running | Check that `python main.py` is running in `drbert_api` |
| `ModuleNotFoundError: No module named 'fastapi'` | Wrong Python environment | Activate the venv with `source venv/bin/activate` before starting the API |
| Rust or Cargo build errors during `pip install` | Python 3.14+ is not supported | Go back to Python 3.11 or 3.12 and recreate the venv |
| The status dot stays red | AnythingLLM is unreachable | Check the container with `docker ps` |
| `CONFIG is not defined` in the console | `config.js` is missing | Copy `config.example.js` to `config.js` |

## Disclaimer

This project is an information and triage tool, not a medical device. It makes
no diagnosis and does not replace a consultation. Any real world reuse requires
a review of the system prompt and the knowledge base by a healthcare
professional.

## License

MIT, see [LICENSE](LICENSE).
