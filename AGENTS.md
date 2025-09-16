# Repository Guidelines

## Project Structure & Module Organization
The repo splits into `scepter-client` (Vite + React/TypeScript frontend) and `scepter-server` (Flask backend). Frontend source sits under `scepter-client/src` with shared contexts in `src/contexts` and static assets in `public`. Production bundles land in `scepter-client/dist`, which the server serves via `config.py`. Backend routes live in `scepter-server/routes`, shared helpers in `components`, and persisted SQLite game files under `games/`. Use `build_and_run.mjs` to build the client and boot the server with a single Node script. Use the main `README.md` as context for what the application does and a source of truth when in doubt of the style of things that need to happen. There is also the backend `README.md` stored in `scepter-server/README.md` that can be used as a source of truth for the backend that goes into more detail. Finally, there is a source of truth `README.md` stored in `scepter-client/README.md` detailing any CSS colors, and other definite design choices that should be applied when in doubt.

## Build, Test, and Development Commands
- `cd scepter-client && npm install` to sync frontend dependencies.
- `npm run dev` for a hot-reload Vite server on port 5173.
- `npm run build` compiles TypeScript and generates the `dist` bundle consumed by Flask.
- `npm run lint` checks TypeScript/JS style via ESLint.
- `cd scepter-server && python -m venv .venv && source .venv/bin/activate` to isolate Python deps, then `pip install -r requirements.txt`.
- `python main.py` starts the Flask+Socket.IO backend at `http://localhost:5000`.
- `node build_and_run.mjs` builds the client and launches the backend in one step for production smoke tests.

## Coding Style & Naming Conventions
TypeScript follows 2-space indentation, named exports, and camelCase variables; React components stay in PascalCase files (`App.tsx`). Run `npm run lint` before pushing; fix warnings rather than suppressing them. Python modules follow PEP 8 with snake_case functions (`session_manager.py`) and descriptive logging. Keep configuration in `config.py` instead of inline constants, and prefer dependency injection so sessions remain testable. When adding new API endpoints, database tables, folders etc. Add it into the appropriate backend documentation section in the `README.md` and document any additional info that may be necessary in less than 50 words.

## Testing Guidelines
Test after every addition by attempting a build of the application and a build of the backend as well. Then build both at the same time with `node build_and_run.mjs`. Then, run a lint and fix any linting errors.

## Commit & Pull Request Guidelines
Recent history uses short, imperative subjects ("Fix issues with websocket sessions"). Keep messages under ~72 characters and explain context in the body when needed. Reference issue IDs in brackets when applicable. Pull requests should summarize scope, list testing (`npm run lint`, manual endpoints hit), attach UI screenshots for visible changes, and flag any schema or config updates (e.g., new environment variables).
