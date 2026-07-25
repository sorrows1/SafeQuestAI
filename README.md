# Safe Quest

Safe Quest is a digital-safety learning platform that normalizes calm, safe help-seeking. It has a public landing page, an authenticated family scenario library, an admin-only authoring and simulation workbench, and a transparent companion guide.

## Architecture

- Scenarios use canonical actor bindings: `initiator`, `respondent`, or `authoring`, each selecting a persona and a metadata-scoped dialogue prompt.
- Prompt records declare `kind` (`system`, `dialogue`, or `single_pass`) and `role_scope`; the unified runtime snapshots compatible records when an admin starts a run.
- `/api/admin/simulations` is the only simulation runtime API. Runs are durable, support pause/resume, admin responses, immutable edits, review, and reconnectable SSE events.
- Approval creates a curated transcript. Publication is a separate explicit gate; only published curated snapshots are available in the family library.
- Family playback, guides, and discovery never import the simulation or generation runtime. Guides are discussion aids, never scorecards.

## Database and content workflow

Startup never creates or changes tables. Before starting the API, run:

```bash
cd backend
alembic upgrade head
python scripts/migrate_json_to_db.py --dry-run
python scripts/migrate_json_to_db.py
```

Use `python scripts/migrate_json_to_db.py --publish-demo-fixtures` only in development. To inspect whether retired raw tables remain without exposing their rows, run `python scripts/audit_legacy_conversations.py`.

## Development commands

```bash
cd backend && pytest
cd frontend && npm test
cd frontend && npm run build
```

Run development servers directly in the dev container; Docker Compose is for infrastructure only.
