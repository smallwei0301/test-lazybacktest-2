# Project Structure & Agent Guidelines

This document outlines the file structure for the `test-lazybacktest` project and provides guidelines for AI agents and developers when creating new files.

## Directory Structure

The project is organized as follows:

*   **`v0 design code/`**: Contains the main Next.js application source code.
*   **`scripts/`**: Contains utility scripts (`.js`, `.ts`) for testing, verification, maintenance, and automation. **Do not place application logic here.**
*   **`docs/`**: The central location for all documentation.
    *   **`docs/reports/`**: Generated reports, analysis results, and JSON dumps (`*_REPORT.md`, `*_RESULTS.json`, etc.).
    *   **`docs/guides/`**: Guides, checklists, quick start instructions, and reference documents (`*_GUIDE.md`, `QUICK_*.md`).
    *   **`docs/logs/`**: Changelogs, work logs, and historical records.
*   **`archived/`**: Old or deprecated files.
*   **Root Directory**: Should ONLY contain:
    *   Configuration files (`package.json`, `tsconfig.json`, `netlify.toml`, etc.)
    *   Essential project documentation (`README.md`, `PROJECT_STRUCTURE.md`)
    *   Workspace configuration (`*.code-workspace`)

## Guidelines for AI Agents

When creating new files, please adhere to the following rules:

1.  **Scripts**: If you create a script for testing, verification, or a one-off task, place it in `scripts/`.
2.  **Documentation**:
    *   If it's a guide or instruction, place it in `docs/guides/`.
    *   If it's a report or analysis of the codebase, place it in `docs/reports/`.
    *   If it's a log or status update, place it in `docs/logs/`.
3.  **Application Code**: New components, hooks, or pages should go into the appropriate subdirectories within `v0 design code/` (e.g., `v0 design code/components/`, `v0 design code/app/`).
4.  **Do NOT clutter the root directory**: Avoid creating new `.md`, `.json`, or `.js` files in the root unless they are critical project-level configurations.

## File Naming Conventions

*   **Reports**: `TOPIC-REPORT.md` or `TOPIC_REPORT.md`
*   **Guides**: `TOPIC-GUIDE.md` or `TOPIC_GUIDE.md`
*   **Scripts**: `kebab-case.js` (e.g., `verify-deployment.js`)

By following these guidelines, we keep the project clean and organized.
