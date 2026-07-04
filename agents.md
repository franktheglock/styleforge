# StyleForge AI Agent System

StyleForge uses a backend AI agent pipeline powered by local and cloud LLM providers via the OpenAI-compatible chat completions API. The agent is invoked through a Tauri command and operates on the document model directly in Rust.

---

## Architecture Overview

```
User prompt (frontend)
       │
       ▼
 FloatingAIBar.tsx
       │  invoke("run_ai_operations")
       ▼
 src-tauri/src/commands/ai.rs
       │
       ├─── prompt_builder.rs   ──► Builds system + user messages
       │
       ├─── Provider Router
       │      ├── Ollama         (http://127.0.0.1:11434/api/chat)
       │      ├── LMStudio       (http://127.0.0.1:1234/v1/chat/completions)
       │      ├── LlamaCpp       (http://<host>/v1/chat/completions)
       │      ├── OpenRouter     (https://openrouter.ai/api/v1/chat/completions)
       │      └── Custom         (any OpenAI-compat endpoint)
       │
       ├─── Tool Call Handler   ──► Processes edit_document_structure calls
       │
       └─── AIResponsePayload   ──► Returns mutated doc + assistant message
```

---

## Components

### `commands/ai.rs`
The main Tauri command entrypoint. Orchestrates:
1. Loading the active AI provider config from SQLite
2. Building the chat message history via `prompt_builder`
3. Dispatching the request to the correct provider
4. Parsing the response for tool calls
5. Applying mutations to the document model
6. Returning `AIResponsePayload { document, assistant_message }`

### `ai/prompt_builder.rs`
Builds the system prompt and user message list sent to the LLM.

- **System prompt**: Instructs the model to behave conversationally, explain changes in plain English, and use the `edit_document_structure` tool to apply structural edits rather than generating raw JSON.
- **User message**: The raw user input from the floating command bar.
- **Context**: The current document's sections and style token keys are injected so the model knows the document structure.

### `ai/provider.rs`
Defines the `AIProvider` trait:
```rust
pub trait AIProvider {
    async fn chat(&self, config: &DbAIProvider, request: ChatRequest) -> Result<ChatResponse, String>;
}
```

### Provider Implementations

| File | Provider | Endpoint Pattern |
|------|----------|-----------------|
| `ai/ollama.rs` | Ollama | `{base}/api/chat` |
| `ai/lmstudio.rs` | LM Studio | `{base}/v1/chat/completions` |
| `ai/llamacpp.rs` | Llama.cpp | `{base}/v1/chat/completions` (auto-appended) |
| `ai/openrouter.rs` | OpenRouter | `https://openrouter.ai/api/v1/chat/completions` |

All providers use the OpenAI tool/function calling JSON schema format.

---

## Tool: `edit_document_structure`

The model is given exactly one tool. When it wants to edit the document, it calls this tool with a JSON array of operations.

### Schema
```json
{
  "name": "edit_document_structure",
  "description": "Apply structural edits to the document. Use this to add, remove, reorder, or rename sections.",
  "parameters": {
    "type": "object",
    "properties": {
      "operations": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "op": {
              "type": "string",
              "enum": ["add_section", "delete_section", "reorder_sections", "update_section_content", "update_style_token"]
            },
            "section_type": { "type": "string" },
            "after_id":     { "type": "string" },
            "section_id":   { "type": "string" },
            "content":      { "type": "object" },
            "style_token":  { "type": "string" },
            "order":        { "type": "array", "items": { "type": "string" } }
          }
        }
      }
    }
  }
}
```

### Supported Operations

| `op` | Description | Required Fields |
|------|-------------|-----------------|
| `add_section` | Inserts a new section block | `section_type`, optionally `after_id` |
| `delete_section` | Removes a section by ID | `section_id` |
| `reorder_sections` | Reorders all sections by ID array | `order` (array of section IDs) |
| `update_section_content` | Replaces Tiptap JSON content of a section | `section_id`, `content` |
| `update_style_token` | Assigns a different style token to a section | `section_id`, `style_token` |

---

## Data Flow: A Complete Edit

```
1. User types: "Move the Skills section above Education"

2. prompt_builder builds:
   System: "You are StyleForge AI. Use edit_document_structure tool to apply structural changes. Respond conversationally."
   User: "Move the Skills section above Education"
   Context: [{ id: "sec_1", type: "heading", styleToken: "heading", text: "Education" }, ...]

3. LLM responds with a tool call:
   {
     "name": "edit_document_structure",
     "arguments": {
       "operations": [{
         "op": "reorder_sections",
         "order": ["sec_skills", "sec_education", ...]
       }]
     }
   }

4. ai.rs processes the tool call:
   - Extracts the "order" array
   - Reorders doc.sections accordingly
   - Builds a second LLM turn with the tool result

5. LLM produces final assistant text:
   "Done! I've moved Skills above Education in your document."

6. AIResponsePayload returned to frontend:
   { document: <mutated_doc>, assistant_message: "Done! I've moved..." }

7. Frontend:
   - Updates Zustand store with new document
   - Displays assistant message in FloatingAIBar speech bubble
```

---

## Adding a New Provider

1. Create `src-tauri/src/ai/<name>.rs` implementing the `AIProvider` trait
2. Add it to the match arm in `commands/ai.rs`:
   ```rust
   "NewProvider" => Box::new(NewProvider) as Box<dyn AIProvider>,
   ```
3. Add it to the seeded defaults in `database/sqlite.rs`
4. Add its option to the `<select>` in `ProviderSettings.tsx`

---

## Configuration

AI providers are stored in the SQLite database (`styleforge.db`) under the `ai_providers` table:

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | Unique ID |
| `name` | TEXT | Display label |
| `provider_type` | TEXT | `Ollama`, `LMStudio`, `LlamaCpp`, `OpenRouter`, `Custom` |
| `endpoint` | TEXT | Base URL (e.g. `http://127.0.0.1:11434`) |
| `api_key` | TEXT | Bearer token (empty for local providers) |
| `model_name` | TEXT | Model identifier passed to the API |
| `temperature` | REAL | Sampling temperature (default `0.2`) |
| `max_tokens` | INTEGER | Max output tokens (default `2048`) |
| `is_default` | INTEGER | `1` = selected on startup |

The active provider is selected in the UI via the **Settings** modal in the floating AI bar.
