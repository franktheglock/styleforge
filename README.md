# StyleForge

A desktop document editor with AI-assisted structural editing and a hierarchical style token system. Built with [Tauri](https://v2.tauri.app/) (Rust + React + TypeScript).

![Tech Stack](https://img.shields.io/badge/Tauri-2.0-ffc131?logo=tauri&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-1.80+-de4d32?logo=rust)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6?logo=typescript)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-4-06b6d4?logo=tailwindcss)
![TipTap](https://img.shields.io/badge/TipTap-3-ff6b6b?logo=tiptap)

---

## Overview

StyleForge is a powerful document editor that combines rich text editing with a flexible **style token system** and an **AI agent** that can restructure your document through natural language commands.

### Key Features

- **Rich Text Editing** — Powered by [TipTap](https://tiptap.dev/), with sections for headings, paragraphs, lists (bullets & ordered), tables, and dividers
- **Style Tokens** — A CSS-like style system where each section references a token (e.g. `heading`, `body`, `bullet`, `divider`). Tokens define typography, spacing, colors, borders, and more — all editable in real time via a sidebar inspector
- **AI Assistant** — A floating command bar that lets you edit document structure with natural language. "Move the Skills section above Education", "Add a table after the header", "Delete the second paragraph" — the AI agent translates these into structural operations using the `edit_document_structure` tool
- **Multiple LLM Providers** — Bring your own AI backend. Supports:
  - [Ollama](https://ollama.com/) (local)
  - [LM Studio](https://lmstudio.ai/) (local)
  - [Llama.cpp](https://github.com/ggerganov/llama.cpp) (local/remote)
  - [OpenRouter](https://openrouter.ai/) (cloud)
  - [NVIDIA NIM](https://build.nvidia.com/) (cloud)
  - Custom OpenAI-compatible endpoints
- **Import & Export** — JSON, Markdown, HTML, and DOCX
- **Drag-and-Drop** — Reorder sections by dragging them in the sidebar
- **Undo/Redo** — Full history stack (up to 50 states)
- **Token Inheritance** — Section-level overrides with automatic token cloning when you edit a shared token on a single section

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (React)                  │
│  ┌──────────┐ ┌──────────────┐ ┌─────────────────┐  │
│  │  TipTap   │ │ Style Token  │ │  Floating AI    │  │
│  │  Editor   │ │  Sidebar     │ │  Command Bar    │  │
│  └────┬─────┘ └──────┬───────┘ └────────┬────────┘  │
│       │              │                   │           │
│  ┌────▼──────────────▼───────────────────▼────────┐  │
│  │          Zustand Store (documentStore)          │  │
│  └────────────────────┬───────────────────────────┘  │
│                       │ Tauri Invoke                  │
├───────────────────────┼──────────────────────────────┤
│             Rust Backend (Tauri Commands)             │
│  ┌──────────┐ ┌──────────────┐ ┌──────────────────┐  │
│  │ Import / │ │ Style System │ │ AI Operations    │  │
│  │ Export   │ │ (tokens,     │ │ (provider router, │  │
│  │          │ │  profiles,   │ │  prompt builder, │  │
│  │          │ │  inheritance)│ │  tool execution) │  │
│  └──────────┘ └──────────────┘ └──────────────────┘  │
│                       │                               │
│              ┌────────▼────────┐                     │
│              │  SQLite (DB)    │                     │
│              │  (profiles,     │                     │
│              │   AI providers) │                     │
│              └─────────────────┘                     │
└─────────────────────────────────────────────────────┘
```

## Getting Started

### Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) (1.80+)
- [Node.js](https://nodejs.org/) (20+)
- System dependencies for [Tauri v2](https://v2.tauri.app/start/prerequisites/)

### Installation

```bash
# Clone the repository
git clone https://github.com/franktheglock/styleforge.git
cd styleforge

# Install frontend dependencies
npm install

# Run in development mode
npm run tauri dev
```

### Building for Production

```bash
npm run tauri build
```

The bundled installer/executable will be in `src-tauri/target/release/bundle/`.

## AI Configuration

To use the AI assistant, you need at least one provider configured. Open the **Settings** modal (gear icon in the floating AI bar) and add a provider.

**Local (recommended for privacy):**
- **Ollama:** `http://127.0.0.1:11434`, model: `llama3`, `mistral`, etc.
- **LM Studio:** `http://127.0.0.1:1234`, any loaded model
- **Llama.cpp:** your server URL, any loaded model

**Cloud:**
- **OpenRouter:** `https://openrouter.ai/api/v1`, API key required
- **NVIDIA NIM:** `https://api.nvcf.nvidia.com/v1`, API key required

The AI agent uses OpenAI-compatible function/tool calling. It has one tool — `edit_document_structure` — which accepts an array of operations (`add_section`, `delete_section`, `reorder_sections`, `update_section_content`, `update_style_token`).

## Development

### Project Structure

```
├── src/                          # Frontend (React + TypeScript)
│   ├── components/               # UI components
│   ├── editor/                   # TipTap editor & section wrappers
│   ├── store/                    # Zustand state management
│   ├── styles/                   # Global CSS
│   └── types/                    # TypeScript type definitions
├── src-tauri/                    # Rust backend
│   └── src/
│       ├── ai/                   # AI provider implementations
│       │   ├── ollama.rs
│       │   ├── lmstudio.rs
│       │   ├── llamacpp.rs
│       │   ├── openrouter.rs
│       │   ├── nvidia_nim.rs
│       │   ├── provider.rs       # AIProvider trait
│       │   ├── prompt_builder.rs
│       │   └── operations.rs     # Tool call execution
│       ├── commands/             # Tauri command handlers
│       │   ├── ai.rs
│       │   ├── export.rs
│       │   ├── import.rs
│       │   └── styles.rs
│       ├── database/             # SQLite data layer
│       ├── style/                # Style system (tokens, profiles, inheritance)
│       └── lib.rs / main.rs
├── package.json
├── vite.config.ts
└── tauri.conf.json
```

## License

MIT
