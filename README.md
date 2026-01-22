# AI Flashcards for Obsidian

Generate flashcards from your notes using AI. Compatible with the [Spaced Repetition](https://github.com/st3v3nmw/obsidian-spaced-repetition) plugin.

## Features

### Multiple AI Providers

Choose your preferred LLM provider:

- **OpenAI** - GPT models
- **Anthropic** - Claude Sonnet, Claude Opus, Claude Haiku
- **Google Gemini** - Gemini Flash, Gemini Pro
- **Custom Endpoints** - Any OpenAI-compatible API (Ollama, LM Studio, vLLM, etc.)

The plugin can fetch available models directly from each provider's API.

### Built-in Templates

5 ready-to-use templates for different learning styles:

| Template | Best For |
|----------|----------|
| **Basic Recall** | Definitions, facts, straightforward concepts |
| **Concept Explanation** | Deep understanding, "explain in your own words" |
| **Cloze Deletions** | Fill-in-the-blank for terminology and key phrases |
| **Compare & Contrast** | Similarities and differences between related topics |
| **Application-Based** | Practical skills, problem-solving scenarios |

You can also create your own custom templates or duplicate built-in ones to customize them.

### Smart Output Options

- **Create new file** - Saves flashcards to a dedicated folder (default: `Flashcards/`)
- **Append to note** - Adds flashcards directly to your current note

Output uses the `Q: / A:` format compatible with the Spaced Repetition plugin.

### Long Document Support

Automatically chunks long notes to stay within model context limits. Configure the chunk size based on your model's capabilities:
- Cloud APIs (OpenAI, Anthropic, Gemini): 4000-8000 tokens
- Local models (Ollama, LM Studio): 2000-3000 tokens

### Non-blocking Generation

Flashcard generation runs in the background, so you can continue working while cards are being created. Progress is shown in the status bar.

## Installation

### From Community Plugins (Recommended)

1. Open Obsidian Settings
2. Go to Community Plugins and disable Safe Mode
3. Click Browse and search for "AI Flashcards"
4. Install and enable the plugin

### Manual Installation

1. Download the latest release from GitHub
2. Extract `main.js`, `styles.css`, and `manifest.json` to your vault's `.obsidian/plugins/ai-flashcards/` folder
3. Enable the plugin in Settings > Community Plugins

## Setup

1. Go to Settings > AI Flashcards
2. Select your LLM provider
3. Enter your API key (or configure your local endpoint URL)
4. Choose a template and output mode
5. Open a note and click the flashcard icon in the ribbon (or use the command palette)

## Usage

1. Open any note you want to create flashcards from
2. Click the **flashcard icon** in the left ribbon, or
3. Use the command palette: `AI Flashcards: Generate flashcards from current note`

The plugin will generate 5-10 flashcards based on the note content and save them according to your output settings.

## Configuration Options

| Setting | Description |
|---------|-------------|
| **Active Provider** | Select OpenAI, Anthropic, Gemini, or Custom Endpoint |
| **API Key** | Your provider's API key |
| **Model** | Choose from available models (refresh to fetch latest) |
| **Output Mode** | Create new file or append to current note |
| **Output Folder** | Destination folder for flashcard files |
| **Template** | Select or customize the flashcard generation style |
| **Temperature** | Creativity level (0.0 = deterministic, 1.0 = creative) |
| **Max Output Tokens** | Maximum response length |
| **Max Input Tokens** | Chunk size for long documents |

## Using with Local Models

For local models via Ollama, LM Studio, or similar:

1. Set provider to "Custom Endpoint (OpenAI-compatible)"
2. Enter your endpoint URL (e.g., `http://localhost:11434` for Ollama)
3. API key is optional for most local setups
4. Click refresh to fetch available models, or enter the model name manually

## Support

- Report issues on [GitHub](https://github.com/louisulmer/obsidian-ai-flashcards/issues)
- Contributions welcome via pull requests
