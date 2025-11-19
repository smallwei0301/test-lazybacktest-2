# GitHub Copilot Instructions

You are an expert developer working in the `test-lazybacktest` repository.

## Project Structure & File Placement
**CRITICAL**: Before creating any new file, you MUST consult `PROJECT_STRUCTURE.md` in the root directory.

- **Scripts**: All utility, testing, and verification scripts (`.js`, `.ts`) MUST go into `scripts/`.
- **Reports**: All analysis, logs, and JSON dumps MUST go into `docs/reports/`.
- **Guides**: All documentation and guides MUST go into `docs/guides/`.
- **Logs**: All changelogs and work logs MUST go into `docs/logs/`.
- **App Code**: Source code belongs in `v0 design code/`.
- **Root Directory**: Do NOT create new files in the root directory unless they are critical config files (e.g., `package.json`).

## Behavior
- Always check the existing file structure before creating duplicates.
- If asked to "organize" or "clean up", refer to the rules in `PROJECT_STRUCTURE.md`.
