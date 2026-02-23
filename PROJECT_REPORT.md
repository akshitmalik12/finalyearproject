# DataGem – AI Conversational Data Analyst

## 1. Introduction and Motivation

Modern datasets are large, complex, and difficult to explore with traditional BI dashboards or notebooks, especially for non-technical users. DataGem is designed to act as an **AI-powered conversational data analyst**: instead of writing SQL or Python manually, a user uploads a CSV file and asks natural-language questions such as:

- “What does this dataset tell us overall?”
- “Give me all column names and describe them.”
- “Show the distribution of Team 1 scores and compare it with Team 2.”
- “Build a classification model to predict the winner and save it as a `.joblib` file.”

DataGem translates these requests into Python code, executes the code in a sandbox, and returns:

- Structured tables (as markdown) with statistics and summaries.
- Visualizations (as base64-encoded PNGs rendered in the UI).
- Higher-level natural-language insights grounded in those tables.

The system is built as a full-stack web application with a **FastAPI backend**, a **React/Vite frontend**, and **Google Gemini 2.5** (accessed via the modern `google-genai` SDK) as the core LLM.

This document serves as a **project report** and basis for a LaTeX/final-year thesis, covering design, implementation, Dockerization, and deployment options.

---

## 2. High-Level Architecture

### 2.1 Components

- **Frontend (React + Vite + Tailwind)**  
  - Rich single-page application (SPA).  
  - Handles CSV upload, dataset profiling, chat UI, streaming responses, and visualization of model outputs.

- **Backend (FastAPI)**  
  - Exposes `/chat` for streaming AI responses and `/health` for status checks.  
  - Maintains user and chat history in SQLite via SQLAlchemy.  
  - Integrates with Google Gemini 2.5 via the `google-genai` Python SDK (`from google import genai`).  
  - Executes model-generated Python code in a **separate sandbox process** to protect the main server.

- **AI Engine (Gemini 2.5 Flash‑Lite)**  
  - Primary model: `gemini-2.5-flash-lite`.  
  - Handles:
    - Understanding natural-language questions.
    - Generating Python analysis/visualization code and calling tools.
    - Producing human-readable summaries and explanations.

- **Database (SQLite)**  
  - Stores users (even if anonymous) and per-user chat history.  
  - Enables the LLM to see prior conversation context across turns.

- **Containerization (Docker + docker-compose)**  
  - `Dockerfile.backend`: containerizes the FastAPI backend.  
  - `Dockerfile.frontend`: builds the React app and serves it via Nginx.  
  - `docker-compose.yml`: orchestrates both services for local and server deployment.

### 2.2 Data Flow (End-to-End)

1. **User loads the app**  
   - Browser opens the frontend (either via `npm run dev`, Docker, or a deployed static host like GitHub Pages).  
   - Frontend periodically calls `/health` to display a **Backend Status** pill (online/offline + key index).

2. **Dataset upload and profiling**  
   - User uploads a CSV.  
   - Frontend parses the CSV using PapaParse in the browser:
     - Identifies columns and numeric columns.
     - Computes basic statistics (min, max, mean, median, count) per numeric column.
     - Stores a profile object (`shape`, `columns`, `numericColumns`, `stats`, `head`, `sample`).  
   - A **sampling notice** is shown for very large datasets (e.g. >50,000 rows) explaining that heavy analyses may operate on a representative sample for performance and stability.

3. **User asks a question**  
   - The question, plus (optionally) an encoded dataset, is POSTed to `POST /chat/`.  
   - Backend:
     - Ensures an “anonymous” or authenticated user exists in the DB.
     - Constructs a `DataAnalystAgent` instance, passing the DB session, user, and dataset.
     - Streams the response back as plain text (chunked), which the frontend parses into code blocks, tables, images, and narrative text.

4. **Agent logic (DataAnalystAgent)**  
   - Builds a comprehensive **system instruction** describing how to behave:
     - Distinguish between conversational vs. analytical prompts.
     - For analytical prompts, always use the `run_python_code` tool.
     - Use `df` as the pandas DataFrame and respect data types (numeric vs. categorical).
     - Always produce **well‑formed markdown tables**, especially for:
       - Missing values (`| Column | Missing Count | Percentage |`).
       - Column overview (`| Column | Type | Description |`).
       - Descriptive statistics (`describe()` on numeric columns).
   - Calls the Gemini model via `genai.Client`:
     - Conversational mode: text-only streaming with system instructions, no tools.  
     - Analytical mode: streaming with tools enabled (function calling).

5. **Tool calling and sandboxed code execution**

   - The model can call:
     - `run_python_code(code: str)` – executes code against the current dataset in a sandboxed Python subprocess.  
     - `google_search(query: str)` – placeholder tool for educational purposes.

   - `run_python_code`:
     - Builds a **complete Python script** with:
       - Imports: `pandas`, `numpy`, `matplotlib`, `seaborn`, some `sklearn` utilities, `io`, `base64`.  
       - A block that converts the in-memory dataset (rows of dicts) to a pandas DataFrame (`df`), with cautious type inference:
         - Only converts columns to numeric if a large fraction of sampled values are numeric-like.  
         - Text/categorical columns (e.g. “Ground Name”, “Species Name”) remain strings to support “unique value” questions.
       - Emits DataFrame diagnostics (shape, columns, numeric columns).
       - Appends the model‑generated code string.
     - Runs this code in a **separate process** via `subprocess.run` with:
       - `timeout` (60s) to avoid infinite loops.
       - Capturing both stdout and stderr, combining them into a single output string.
     - Recognizes:
       - `PLOT_IMG_BASE64:` prefixes (for images).  
       - `MODEL_FILE:` prefixes (for saved models via `joblib.dump`).
     - Returns the combined output, which is then:
       - Streamed to the frontend as “Code Output” blocks.  
       - Passed back into Gemini for a **natural-language summary** aligned with the user’s question.

6. **Summarization**

   - Once tool execution is done, DataGem uses a **text-only generation call** to Gemini with:
     - The original user question.  
     - The raw tool output (including markdown tables of statistics).  
   - The summarization prompt instructs Gemini to:
     - Directly answer the question in 1–2 sentences.  
     - Then provide 3–5 bullet insights, each grounded in real numbers from the tables.  
     - Ensure that, for questions about “all columns” or “unique values”, one or more clearly formatted tables are produced, not just prose.

7. **Frontend rendering**

   - The streaming text from the backend is parsed client‑side into:
     - Code blocks (Python).
     - Outputs (plain text or markdown).
     - Images (`PLOT_IMG_BASE64` decoded and rendered).
     - Markdown tables (parsed and shown via a custom table viewer).
   - The UI displays:
     - Chat bubbles (user and assistant).  
     - Tabs for **Analysis**, **Visualization**, **Modeling**, etc.  
     - A sidebar with dataset stats, preview, and column list.

---

## 3. Gemini Integration and Key Management

### 3.1 `google-genai` Client

DataGem uses the official `google-genai` SDK instead of the deprecated `google-generativeai` package. The core pattern is:

- Initialize a `genai.Client` with an API key:
  - Keys are read from environment variables:  
    `GEMINI_API_KEY` / `GEMINI_API_KEY_1`, `GEMINI_API_KEY_2`, `GEMINI_API_KEY_3`.
  - The agent maintains:
    - `GEMINI_API_KEYS`: ordered list of configured keys.  
    - `CURRENT_KEY_INDEX`: which key is active.  
    - `GENAI_CLIENT`: shared `genai.Client` instance.  
    - `LAST_QUOTA_ERROR`: last quota/429 error string (exposed through `/health`).

- For each request:
  - Build a `GenerateContentConfig` with:
    - `system_instruction` – either conversation or analysis mode.  
    - `tools` and `tool_config` when tools are enabled.  
  - Call `client.models.generate_content_stream(...)` to get a streaming response.

### 3.2 Quota Handling and Key Rotation

Because the free tier for `gemini-2.5-flash-lite` is extremely limited (e.g. 20 requests/day per project), DataGem:

- Detects quota/rate-limit errors by checking error text for:
  - “quota”, “rate limit”, “RESOURCE_EXHAUSTED”, “exceeded”, “429”.
- On such an error:
  - Records the error message into `LAST_QUOTA_ERROR`.  
  - Attempts to switch from key 1 → 2 → 3 using `_try_switch_gemini_key()`.  
  - Rebuilds the streaming call under the new key (either at stream creation or mid-stream).  
  - If no keys remain, returns a clear error to the user and exposes the issue in `/health`.

Note: For key rotation to increase effective quota, each key should belong to a **different Google project**; keys within the same project share the same daily free limit.

---

## 4. Backend Design Details

### 4.1 API Endpoints

- `GET /` – Root  
  - Returns a simple JSON message indicating that the backend is running.

- `GET /health` – Health Check  
  - Returns:
    - `status`: always `"ok"` if the FastAPI app is responding.  
    - `active_key_index`: 1‑based index of the currently active Gemini key.  
    - `total_keys`: number of configured keys.  
    - `last_quota_error`: the last recorded quota/rate-limit error message, if any.
  - Used exclusively by the frontend to drive the **Backend Status** pill.

- `POST /chat/` – Main Chat Endpoint  
  - Request body:
    - `message: str` – user prompt.  
    - `dataset: list[dict] | null` – optional dataset records (rows).
  - Response:
    - Streaming plain text where content includes:
      - Code blocks (\`\`\`python … \`\`\`).  
      - “Code Output” sections with stdout/stderr from the sandbox.  
      - `PLOT_IMG_BASE64:...` tokens for visualizations.  
      - Natural-language summaries.

### 4.2 Auth and Persistence

Current configuration uses a single anonymous user (`anonymous@datagem.ai`) for simplicity, while keeping the full auth stack ready (JWT, password hashing, user models). This can be extended later to multi-user auth with signup/login if desired.

### 4.3 Sandboxed Execution (`run_python_code`)

Key properties:

- Runs code in a **separate Python process** using the same interpreter as the backend.  
- Enforces a **timeout** (60 seconds).  
- **Type inference**:
  - Only converts columns to numeric if at least ~60% of sampled values are numeric-like.  
  - Leaves text/categorical columns unchanged, which is crucial for correct answers to “unique values” questions.
- **Model saving**:
  - Code can call `joblib.dump(model, MODELS_DIR / "name.joblib")`.  
  - Printing `MODEL_FILE:models/name.joblib` signals the backend to show a “Models saved” list to the user.

---

## 5. Frontend Design Details

### 5.1 Major Components

- `Chat.jsx`
  - Core chat interface and state management.  
  - Handles:
    - Messages, input, loading state.
    - Dataset upload, profiling, and side-bar display.
    - Parsing streamed responses into code, outputs, tables, and images.
    - Showing the **Backend Status** pill based on `/health`.
    - Showing a **sampling notice** when row counts are very large.

- `EnhancedTableViewer.jsx`
  - Renders tables with:
    - Sorting.  
    - Filtering.  
    - Column visibility toggling.  
    - Pagination and CSV export.

- `InteractiveChart.jsx`
  - Renders charts (line, bar, area, scatter, pie) using Recharts.  
  - Supports zooming, highlighting, and basic statistical annotations.

### 5.2 Backend Status Pill

- Located in the top header beside the app title.  
- States:
  - **Online** (green dot): `/health` is reachable and returns `status: ok`.  
  - **Offline** (red dot): `/health` failed, likely due to backend outage or network issues.  
  - **Checking…** (yellow): initial state before the first health check.
- Tooltip includes:
  - Active key index and total keys.  
  - Whether a quota/rate-limit error was recently recorded.

### 5.3 Large Dataset Sampling Notice

When the uploaded dataset has a very high row count (e.g. > 50,000 rows), the frontend automatically adds a note to the first assistant message after upload:

- Explains that for performance reasons, some analyses may run on a **representative sample** of rows.  
- Clarifies that summary statistics and visualizations are intended to remain representative of the overall dataset.

This mirrors the behavior of the sandbox, which already samples rows for large datasets; the notice simply makes this explicit to the user.

---

## 6. Dockerization and Local Deployment

### 6.1 Docker Files

- **Backend**
  - `Dockerfile.backend` uses `python:3.12-slim`, installs backend dependencies, and runs Uvicorn on port 8000.

- **Frontend**
  - `Dockerfile.frontend` uses `node:20-alpine` for building the React app, then copies the `dist` bundle into an `nginx:alpine` image serving on port 80.

### 6.2 docker-compose

`docker-compose.yml` defines two services:

- `backend`
  - Builds from `Dockerfile.backend`.  
  - Uses `.env` for Gemini keys and other environment variables.  
  - Exposes `8000:8000` on the host.

- `frontend`
  - Builds from `Dockerfile.frontend`, with `VITE_API_BASE_URL=http://backend:8000`.  
  - Exposes `5188:80` on the host.

### 6.3 Running Locally with Docker

From the project root:

```bash
docker compose build
docker compose up
```

Then visit:

- Frontend: `http://localhost:5188`  
- Backend: `http://localhost:8000`

The frontend uses `VITE_API_BASE_URL` (set to `http://backend:8000`) internally, while from the browser’s perspective you reach both via the host’s forwarded ports.

---

## 7. Hosting and Deployment Options

### 7.1 Split Deployment: Backend on Render (or similar), Frontend on GitHub Pages

This is a common pattern:

1. **Backend on Render (or Railway/Fly.io/Cloud Run)**  
   - Use `Dockerfile.backend` or a native Python environment.  
   - Configure environment variables:
     - `GEMINI_API_KEY`, `GEMINI_API_KEY_2`, `GEMINI_API_KEY_3`.  
   - Expose the service as `https://your-backend.onrender.com`.

2. **Frontend on GitHub Pages**
   - In the frontend build step, set:
     - `VITE_API_BASE_URL="https://your-backend.onrender.com"`.  
   - Run `npm run build` and publish the `dist/` directory to GitHub Pages (via GitHub Actions or manual deployment).

3. **CORS configuration**
   - Ensure the backend’s CORS middleware allows the frontend origin (GitHub Pages URL).  
   - This is already partly handled in `main.py`, but for production you can whitelist the exact domain.

### 7.2 Single-Host Docker Deployment (VPS)

If you have a VPS (e.g. DigitalOcean, Hetzner):

1. Install Docker and docker-compose.  
2. Clone the repository.  
3. Put your `.env` file on the server with the Gemini keys.  
4. Run:

```bash
docker compose up -d
```

5. Optionally put Nginx or Caddy in front with:
   - HTTPS certificates (Let’s Encrypt).  
   - Reverse proxy:  
     - `/` → frontend (`localhost:5188`).  
     - `/api` → backend (`localhost:8000`) with path rewrites.

### 7.3 Other Options (Summary)

- **Render**: simple for hosting the backend as a web service; static frontend can be hosted as a “Static Site” or on GitHub Pages/Netlify/Vercel.  
- **Fly.io**: good for running both services as containers with global deployment.  
- **Google Cloud Run**: can run the backend container on GCP, with GitHub Pages or Cloud Storage/Cloud CDN for the frontend.

---

## 8. Future Work and Enhancements

1. **Model Migration / Fallback Strategy**
   - Add support for different Gemini models (e.g., Pro vs. Flash‑Lite) and allow selection based on task complexity and quota availability.

2. **Rich Auth and Multi-Tenancy**
   - Enable full JWT-based login/signup with per-user chat histories and quotas.

3. **Advanced Caching**
   - Cache results for repeated questions on the same dataset to reduce API calls and latency.

4. **Deeper Model Evaluation Tools**
   - Provide automated reports for trained models: confusion matrices, ROC curves, feature importance plots.

5. **Extensible Tooling**
   - Add more tools beyond `run_python_code`, such as:
     - SQL query execution against relational databases.  
     - External API data fetchers.

---

## 9. Conclusion

DataGem demonstrates how to combine:

- A modern LLM (Gemini 2.5)  
- A robust Python backend with a secure execution sandbox  
- A rich, interactive React frontend  
- Containerization via Docker

to create a practical, conversational data analysis system. It abstracts away much of the complexity of data science by letting users talk to their data directly, while still surfacing concrete tables, plots, and model artifacts grounded in real computations.

This architecture and codebase are suitable for a final-year project and as a foundation for future research or productization in human-in-the-loop data analysis and AI‑assisted analytics.


---

## 10. Detailed Module-Level Design

This section goes deeper into the individual Python and JavaScript/React modules, summarizing the key functions and their responsibilities. It is intended to support detailed technical documentation or design reviews.

### 10.1 Backend Modules (Python/FastAPI)

#### 10.1.1 `datagem_backend/main.py`

- **Responsibilities**:
  - Load environment variables from `.env`.  
  - Initialize the FastAPI application, CORS middleware, and database.  
  - Register routers and define root and health endpoints.  
  - Provide an entry point when running `python main.py` or under Uvicorn in Docker.

- **Key functions and objects**:
  - `load_dotenv(...)` – loads environment variables before any AI-related imports.  
  - `db_models.Base.metadata.create_all(bind=engine)` – ensures DB tables exist.  
  - `CORSOptionsMiddleware` – custom Starlette middleware that:
    - Handles `OPTIONS` preflight before routing.  
    - Dynamically sets `Access-Control-Allow-Origin` for common local origins (`localhost`, `127.0.0.1`, local IPs).  
    - Ensures streaming responses are not buffered.
  - `app = FastAPI(...)` – core application instance.  
  - `app.include_router(chat.router, prefix="/chat", tags=["Chat"])` – wires chat endpoints.
  - `@app.get("/")` – root endpoint returning a welcome JSON.  
  - `@app.get("/health")` – health endpoint exposing:
    - Active Gemini key index (`CURRENT_KEY_INDEX + 1`).  
    - Total configured keys (`len(GEMINI_API_KEYS)`).  
    - `LAST_QUOTA_ERROR` string, if any.

#### 10.1.2 `datagem_backend/chat/chat.py`

- **Responsibilities**:
  - Define the `/chat` router and its request schema.  
  - Glue between HTTP requests, database CRUD, and the `DataAnalystAgent`.

- **Key classes and functions**:
  - `ChatRequest(BaseModel)`:
    - `message: str` – user query.  
    - `dataset: list[dict] | None` – optional dataset rows.
  - `@router.post("/") async def chat_endpoint(...)`:
    - Looks up or creates an “anonymous” user in the DB.  
    - Instantiates `DataAnalystAgent` with DB session, user, and dataset.  
    - Defines an inner async generator `event_stream()` that:
      - Iterates over `agent.stream_response(request.message)`.  
      - Yields text chunks to the client as they arrive.  
      - Catches and logs any streaming errors.
    - Returns a `StreamingResponse(event_stream(), media_type="text/plain")`.

#### 10.1.3 `datagem_backend/chat/agent.py`

- **Responsibilities**:
  - Implement the main AI agent, including:
    - Gemini client configuration and key rotation.  
    - System prompt design for both conversational and analytical behavior.  
    - Tool definitions (`run_python_code`, `google_search`).  
    - Streaming logic, including tool call handling and summarization.

- **Key data structures**:
  - `GEMINI_API_KEYS: List[str]` – ordered list of configured keys.  
  - `CURRENT_KEY_INDEX: int` – index of currently active key.  
  - `GENAI_CLIENT: Optional[genai.Client]` – shared client instance.  
  - `LAST_QUOTA_ERROR: Optional[str]` – last seen quota error, used by `/health`.  
  - `run_python_tool_schema: Tool` – Google GenAI tool definition for executing Python.  
  - `google_search_tool_schema: Tool` – placeholder search tool.

- **Gemini client helpers**:
  - `_configure_gemini_client(index: int)`:
    - Creates a `genai.Client(api_key=GEMINI_API_KEYS[index])`.  
    - Logs which key index is active.
  - `_try_switch_gemini_key() -> bool`:
    - Increments `CURRENT_KEY_INDEX` if possible and reconfigures the client.  
    - Returns `True` if a new key is activated, `False` if no more keys.
  - `DataAnalystAgent._is_quota_error(err: Exception) -> bool`:
    - Heuristic string matching for quota/rate-limit errors.  
    - If matched, stores the full error message into `LAST_QUOTA_ERROR`.

- **Class `DataAnalystAgent`**:
  - Constructor:
    - Stores DB session, user, dataset.  
    - Builds a long, detailed `system_instruction` specifying:
      - When to treat queries as conversational vs. analytical.  
      - How to operate on `df`, when to call `run_python_code`.  
      - Requirements for markdown tables, visualizations, and summaries.  
    - Ensures a `genai.Client` instance exists for the current key.

  - `convert_db_history_to_gemini(history_db) -> list[dict]`:
    - Converts stored chat history into the content format expected by Gemini:
      - `[{ "role": "user" | "model", "parts": [{ "text": ... }] }, ...]`.

  - `async stream_response(self, prompt: str, image: Image | None = None, max_iterations: int = 10)`:
    - Core generator used by `/chat`.  
    - Steps:
      1. Save the user message to DB as a `ChatHistory` row.  
      2. Classify the prompt (conversational vs. analysis) using simple keyword heuristics.  
      3. Build `enhanced_prompt` (either conversational instructions or dataset-aware analysis prompt).  
      4. Create a Gemini streaming call:
         - Conversational: `client.models.generate_content_stream` with text-only config.  
         - Analytical: includes system instruction, `tools`, and `tool_config` (function calling mode `ANY`).
      5. Iterate over the streaming responses:
         - For each event:
           - Yield `.text` chunks when present.  
           - If a function call (`run_python_code` / `google_search`) is detected:
             - Invoke the corresponding tool in `chat.tools`.  
             - Yield a short “Executing …” message and the code being executed.  
             - Capture and yield the tool output as a formatted “Code Output” block.  
             - Build a summarization prompt incorporating the raw tool output and the original user question.  
             - Call Gemini again (text-only) to stream the final summary and insights.
      6. Handle mid-stream errors:
         - If the error is a quota/429, attempt to rotate to the next key and retry the turn once.  
         - Otherwise, return a user-friendly error and log the exception.

#### 10.1.4 `datagem_backend/chat/tools.py`

- **Responsibilities**:
  - Implement the Python-side functionality of the tools exposed to Gemini:
    - `run_python_code` – execution sandbox.  
    - `google_search` – demonstration tool.

- **Key functions**:
  - `set_dataset(dataset_data: list[dict] | None)`:
    - Sets a module-level `_current_dataset` (not heavily used now but reserved for extensions).

  - `run_python_code(code: str, dataset_data: list[dict] | None = None) -> str`:
    - Core sandbox function described earlier.  
    - Notable design points:
      - Assembles a complete Python script rather than using `exec` inline.  
      - Only converts columns to numeric if a majority of sampled values are numeric-like.  
      - Samples rows for very large datasets (up to a configurable limit, e.g. 5000 rows) to avoid timeouts.  
      - Wraps execution in `try/except` blocks mapping:
        - `TimeoutExpired` → friendly timeout message.  
        - `CalledProcessError` → formatted stderr.  
        - Any other `Exception` → generic error message.

  - `google_search(query: str) -> str`:
    - Currently a stub that simulates a search in about a second, returning a canned response.  
    - Included to demonstrate how additional tools could be plugged into the model.

#### 10.1.5 Database Modules (`database/database.py`, `database/models.py`, `database/crud.py`)

- **`database/database.py`**:
  - Creates SQLAlchemy engine and session factory targeting `datagem.db` (SQLite).  
  - Exposes `Base` for model definitions and `get_db()` as a dependency for FastAPI.

- **`database/models.py`**:
  - Defines ORM models:
    - `User`: id, email, hashed_password, full_name, etc.  
    - `ChatHistory`: id, user_id, role (`"user"` or `"model"`), content, timestamp, etc.

- **`database/crud.py`**:
  - Implements helper functions:
    - `get_user_by_email(db, email)`  
    - `create_user(db, user)`  
    - `save_chat_message(db, user_id, role, content)`  
    - `get_chat_history(db, user_id)`  
  - Keeps the rest of the codebase decoupled from raw SQLAlchemy session details.

### 10.2 Frontend Modules (React)

#### 10.2.1 `src/services/api.js`

- Exports:
  - `getApiBaseUrl()` and `API_BASE_URL`:  
    - Derives the backend base URL from:
      - `VITE_API_BASE_URL` environment variable (for deployed/staging).  
      - Otherwise, from `window.location.hostname` with port 8000.
  - `chatAPI.streamChat(prompt, imageFile, dataset)`:
    - Sends a POST to `${API_BASE_URL}/chat/` with the message and optional dataset.  
    - Handles network errors and HTTP status codes, throwing descriptive exceptions.

#### 10.2.2 `src/components/Chat.jsx`

- **Core state**:
  - `messages`: chat messages (user + assistant + system notices).  
  - `dataset`, `datasetProfile`, `datasetFilename`: current dataset and metadata.  
  - `backendStatus`: `{ status, activeKeyIndex, totalKeys, lastQuotaError }`.  
  - Streaming-related state: `loading`, `currentResponse`, `executionStep`.  
  - UI state: `showSidebar`, `expandedCodeBlocks`, `expandedOutputs`, `showChatHistory`, etc.

- **Key hooks and logic**:
  - `useEffect` for loading persisted sessions from `localStorage`.  
  - `useEffect` for **health checks**:
    - Every 30 seconds, calls `${API_BASE_URL}/health`.  
    - Updates `backendStatus` to `online` or `offline`.  
    - Drives the header status pill.
  - `handleDatasetUpload`:
    - Parses CSV with PapaParse.  
    - Filters out completely empty rows.  
    - Computes numeric stats and creates `datasetProfile`.  
    - If row count is very high, injects a **sampling notice** into the initial assistant message.  
    - Generates a unique dataset ID for session persistence.
  - `handleSubmit` (not shown above but present in the file):
    - Sends the current input and dataset to `chatAPI.streamChat`.  
    - Reads the streaming `ReadableStream` from `response.body`.  
    - Parses the text into code blocks,.tables, and images.  
    - Updates `messages` and `currentResponse` accordingly.

#### 10.2.3 Visualization and Table Components

- `InteractiveChart.jsx`:
  - Accepts data and configuration from parsed `PLOT_IMG_BASE64` events or explicit code outputs.  
  - Uses Recharts to display interactive charts (zoom, tooltips, legends).

- `EnhancedTableViewer.jsx`:
  - Accepts parsed markdown tables and renders them with:
    - Sorting, filtering, column toggles, pagination.  
    - CSV export functionality so users can download derived tables.

### 10.3 Error Handling Workflow (End-to-End)

1. **Network or backend down**:
   - `chatAPI.streamChat` throws an error.  
   - `Chat.jsx` catches it and displays a friendly in-chat error message.  
   - `/health` checks mark `backendStatus` as offline, turning the pill red.

2. **Sandbox code failure (syntax, runtime)**:
   - `run_python_code` returns an error string with details.  
   - The tool output is streamed back to the user verbatim under “Code Output”.  
   - The summarization step switches to an “error summary” mode, explaining:
     - What went wrong.  
     - Suggested next steps (e.g., fix indentation, adjust column selection).

3. **Quota / rate-limit issues**:
   - Errors containing “quota”, “RESOURCE_EXHAUSTED” or `429` are detected by `_is_quota_error`.  
   - `LAST_QUOTA_ERROR` is set and exposed via `/health`.  
   - The system attempts to rotate keys and retry once, then informs the user if rotation fails.

---

## 11. Example User Workflows

### 11.1 Exploratory Data Analysis Workflow

1. User uploads a CSV with ~500 rows and 5 columns (e.g., cricket match data).  
2. DataGem summarizes:
   - Shape, columns, numeric columns.  
   - Basic statistics for scores.  
   - Sampling notice if necessary.  
3. User asks:
   - “What does this dataset tell us overall?”  
   - “Give me all column names, and all ground names and unique team names.”  
4. Gemini:
   - Calls `run_python_code`, which:
     - Builds a `df` from the dataset.  
     - Computes:
       - Column overview table.  
       - Unique values tables for `Ground Name` and `Team` columns.  
     - Prints them via `to_markdown(index=False)`.  
   - Gemini then:
     - Reads the tables.  
     - Constructs a high-level paragraph describing:
       - The nature of the dataset (e.g., cricket matches, scores, winners).  
       - Key statistics (average scores, min/max).  
     - Adds bullet insights referencing concrete numbers.

### 11.2 Visualization Workflow

1. User asks: “Plot a histogram of Team 1 scores and compare to Team 2.”  
2. Gemini:
   - Calls `run_python_code`.  
   - Generates code that:
     - Selects numeric columns for both teams.  
     - Uses Matplotlib/Seaborn to create histograms.  
     - Encodes the figure as base64 with prefix `PLOT_IMG_BASE64:`.  
   - The sandbox returns the encoded image, which:
     - Is parsed by the frontend, decoded, and displayed inline.  
3. Gemini summary describes:
   - Distribution shape.  
   - Differences in central tendency and spread.

### 11.3 Modeling Workflow (Saving `.joblib` Models)

1. User asks: “Train a RandomForest classifier to predict Winner and save the model.”  
2. Gemini:
   - Calls `run_python_code` with code that:
     - Splits data into train/test.  
     - Trains a `RandomForestClassifier`.  
     - Evaluates metrics (accuracy, confusion matrix).  
     - Saves the model:
       - `joblib.dump(model, MODELS_DIR / "winner_rf.joblib")`.  
       - Prints: `MODEL_FILE:models/winner_rf.joblib`.
   - Backend detects `MODEL_FILE:` lines and:
     - Streams a “💾 Models saved” block listing saved paths.  
   - Summary step reports:
     - Target variable, main features, and key metrics (e.g., accuracy).

---

## 12. Deployment Walkthrough – Backend on Render, Frontend on GitHub Pages

This section outlines a concrete, step-by-step deployment plan using:

- **Render** for the backend (container-based).  
- **GitHub Pages** for the static frontend.

### 12.1 Backend on Render (Docker Deploy)

1. **Create a GitHub repository** (if not already done) and push the project.  
2. **Create a Render account** and connect it to GitHub.  
3. In Render:
   - Click “New +” → “Web Service”.  
   - Choose the repository.  
   - Configure:
     - **Environment**: Docker.  
     - **Root Directory**: the project root.  
     - Render will detect `Dockerfile.backend` if you set the Dockerfile path accordingly, or you can explicitly set:
       - Dockerfile: `Dockerfile.backend`.  
     - **Port**: `8000`.  
   - Set environment variables:
     - `GEMINI_API_KEY`, `GEMINI_API_KEY_2`, `GEMINI_API_KEY_3` (from different Google projects if you want real rotation).  
   - Deploy the service; you’ll get a URL like:  
     `https://datagem-backend.onrender.com`.

4. **CORS considerations**:
   - In production, set an allowed frontend origin (e.g., your GitHub Pages URL).  
   - This can be done either by extending the CORS middleware or by ensuring the wildcard local rules are sufficient for your deployment.

### 12.2 Frontend on GitHub Pages

1. In your GitHub repo, under `datagem_frontend/`, configure the build script as already defined (`npm run build`).  
2. When building for production, set:

```bash
cd datagem_frontend
VITE_API_BASE_URL="https://datagem-backend.onrender.com" npm run build
```

3. The compiled assets will be in `datagem_frontend/dist`.  
4. Set up GitHub Pages:
   - Option A (manual): Create a branch `gh-pages` and push the contents of `dist` to it, then configure Pages to serve from that branch.  
   - Option B (GitHub Actions):
     - Add a workflow (e.g., `.github/workflows/deploy-frontend.yml`) that:
       - On push to `main`, runs:
         - `npm install`  
         - `VITE_API_BASE_URL=... npm run build`  
       - Deploys `dist/` to GitHub Pages via `actions/deploy-pages`.
5. After deployment, your frontend will have a URL like:  
   `https://<username>.github.io/<repo-name>/`.

6. Verify:
   - The frontend loads and the Backend Status pill is green (`/health` reachable).  
   - Chat requests go to the Render backend (check the browser dev tools → Network).

---

## 13. Summary

The extended documentation above should be sufficient to form the backbone of a ~20-page technical report when rendered in LaTeX, with sections covering:

- Motivation and problem statement.  
- System architecture (high-level and detailed).  
- Backend and frontend module design.  
- AI integration via Google GenAI SDK and tools.  
- Execution sandbox and safety considerations.  
- Error handling and quota management.  
- Containerization and deployment strategies.  
- Example workflows and future work.

It is intentionally written in a structured markdown format so it can be:

- Directly included in a project repository as documentation.  
- Converted to LaTeX using tools like Pandoc.  
- Adapted into slides, posters, or a final-year project thesis.

