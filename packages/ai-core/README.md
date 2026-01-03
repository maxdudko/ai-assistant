# @ai/ai-core

AI Core package for PMA (Personal Manager Assistant)

This package provides a framework-agnostic AI service layer with:

- LLM provider abstraction (Ollama, OpenAI, etc.)
- Prompt builders for different conversation modes
- Memory extraction utilities
- Type-safe interfaces

## Structure

```
src/
├── types/           # Core types and interfaces
├── providers/       # LLM provider implementations
│   ├── llm.provider.interface.ts
│   ├── ollama.provider.ts
│   └── openai.provider.ts
├── prompts/         # Prompt building utilities
│   ├── mode.prompts.ts
│   ├── system.prompt.ts
│   └── message.formatter.ts
├── memory/          # Memory extraction
│   └── extractor.ts
├── ai.service.ts    # Main orchestrator
└── index.ts         # Public exports
```

## Usage

### Basic Setup

```typescript
import { AiService, OllamaProvider } from '@ai/ai-core';

// Create a provider
const ollamaProvider = new OllamaProvider({
  url: 'http://localhost:11434',
  model: 'gemma3:1b',
});

// Create AI service
const aiService = new AiService({
  provider: ollamaProvider,
  enableStubFallback: true,
});

// Generate response
const response = await aiService.generateResponse(message, context);
```

### Using Different Providers

```typescript
// Ollama (local)
const ollamaProvider = new OllamaProvider({
  url: process.env.OLLAMA_URL,
  model: process.env.OLLAMA_MODEL,
});

// OpenAI (cloud)
const openaiProvider = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o-mini',
});

// Use any provider
const aiService = new AiService({
  provider: openaiProvider, // or ollamaProvider
});
```

### Conversation Context

```typescript
import { ConversationContext, ConversationMode, MessageRole } from '@ai/ai-core';

const context: ConversationContext = {
  mode: ConversationMode.MANAGER,
  userProfile: {
    displayName: 'John',
    tone: 'friendly',
    verbosity: 'medium',
    useEmoji: false,
  },
  messages: [
    {
      role: MessageRole.USER,
      content: 'Hello!',
    },
  ],
  memories: [
    {
      content: 'User prefers morning meetings',
      importance: 8,
      tags: ['preference', 'schedule'],
    },
  ],
};
```

## Provider Interface

All providers must implement the `LlmProvider` interface:

```typescript
interface LlmProvider {
  generate(request: LlmRequest): Promise<LlmResponse>;
  isAvailable(): Promise<boolean>;
  getName(): string;
}
```

## Conversation Modes

- **MANAGER**: Productivity and task management
- **REFLECTION**: End-of-day summaries and insights
- **COMPANION**: Supportive dialogue
- **INFO**: Factual information summaries

## Building

```bash
pnpm build
```

This will compile TypeScript to the `dist/` directory.

## Development

```bash
pnpm dev  # Watch mode
```
