# Safe Quest

Safe Quest is a digital-safety learning platform that normalizes calm, safe help-seeking. It has a public landing page, an authenticated family scenario library, an admin-only authoring and simulation workbench, and a transparent companion guide.

## Prerequisites

Before getting started, ensure you have the following installed:
- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)
  - **WSL Users**: If you are on Windows using WSL, ensure Docker Desktop has WSL integration enabled for your distribution.
- [Git](https://git-scm.com/)
- Optional (for Dev Container method): [VS Code](https://code.visualstudio.com/), the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers), and the [WSL extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-wsl) (if on Windows).

## Getting Started

There are two ways to launch the project for development. Ensure you have your `.env` file set up in the root of the repository before starting.

### Method 1: Dev Container in VS Code + tasks.json (Recommended)

This method provides a fully configured development environment inside a container, with pre-installed extensions and tools.

1. Open the project folder in VS Code.
2. A prompt will appear in the bottom right asking to **Reopen in Container**. Click it. (Alternatively, press `Ctrl+Shift+P`, type `Dev Containers: Reopen in Container`, and select it).
3. VS Code will build the container and run the setup scripts (`npm install` and `pip install`). Wait for the terminal to indicate the setup is ready.
4. Go to the menu bar: **Terminal > Run Task...** and select **Start all tasks**.
5. This task will automatically:
   - Start the PostgreSQL database using Docker Compose.
   - Start the backend FastAPI server (`uvicorn`).
   - Start the frontend Vite development server.

### Method 2: Normal Docker Method (docker-compose)

If you prefer to run the entire stack using Docker without VS Code's Dev Containers, you can use Docker Compose directly. Both `docker-compose.dev.yml` and `docker-compose.yml` are configured to launch the full stack in the same way.

1. Open a terminal in the root of the project.
2. Run the following command:
   ```bash
   docker compose -f docker-compose.dev.yml up --build
   ```
   *(Note: You can also just run `docker compose up --build` as both compose files have been updated to launch the same stack).*
3. This will spin up three containers:
   - `db` (PostgreSQL on port 5432)
   - `backend` (FastAPI on port 8000)
   - `frontend` (Vite on port 5173)

## Database and Content Workflow

Startup never creates or changes tables automatically. Before starting the API, run the following in your backend terminal (if using Method 1) or inside the backend container (if using Method 2):

```bash
cd backend
alembic upgrade head
python scripts/migrate_json_to_db.py --dry-run
python scripts/migrate_json_to_db.py
```

Use `python scripts/migrate_json_to_db.py --publish-demo-fixtures` only in development. To inspect whether retired raw tables remain without exposing their rows, run `python scripts/audit_legacy_conversations.py`.

## Architecture

- Scenarios use canonical actor bindings: `initiator`, `respondent`, or `authoring`, each selecting a persona and a metadata-scoped dialogue prompt.
- Prompt records declare `kind` (`system`, `dialogue`, or `single_pass`) and `role_scope`; the unified runtime snapshots compatible records when an admin starts a run.
- `/api/admin/simulations` is the only simulation runtime API. Runs are durable, support pause/resume, admin responses, immutable edits, review, and reconnectable SSE events.
- Approval creates a curated transcript. Publication is a separate explicit gate; only published curated snapshots are available in the family library.
- Family playback, guides, and discovery never import the simulation or generation runtime. Guides are discussion aids, never scorecards.
