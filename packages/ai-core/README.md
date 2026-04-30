# @ai/ai-core

Framework-agnostic AI orchestration package used by MIRA services.

## What this package provides

- `AiService` orchestration for:
  - prompt assembly
  - LLM generation (sync + streaming)
  - structured response parsing (text/actions/memory/summary)
- Provider abstraction (`LlmProvider`)
- Built-in providers:
  - `OllamaProvider`
  - `OpenAIProvider`
- Prompt utilities:
  - mode prompts
  - system prompt builder
  - message formatter
  - INFO digest prompt helpers
- Memory extraction fallback utilities
- Shared core types (`ConversationContext`, `AiResponse`, `LlmRequest`, etc.)

## Package structure

```
src/
├── ai.service.ts
├── index.ts
├── types/
├── providers/
│   ├── llm.provider.interface.ts
│   ├── ollama.provider.ts
│   └── openai.provider.ts
├── prompts/
│   ├── mode.prompts.ts
│   ├── system.prompt.ts
│   ├── message.formatter.ts
│   └── info-digest.prompts.ts
└── memory/
    └── extractor.ts
```

## Install and build

This package is consumed as a workspace dependency in this monorepo.

From repository root:

```bash
pnpm --filter @ai/ai-core build
pnpm --filter @ai/ai-core dev
```

## Quick usage

### 1) Create provider and service

```typescript
import { AiService, OllamaProvider } from '@ai/ai-core';

const provider = new OllamaProvider({
  url: 'http://localhost:11434',
  model: 'gemma3:1b',
});

const ai = new AiService({
  provider,
  enableStubFallback: true,
});
```

### 2) Build a conversation context

```typescript
import { ConversationMode, MessageRole, type ConversationContext } from '@ai/ai-core';

const context: ConversationContext = {
  mode: ConversationMode.MANAGER,
  userProfile: {
    displayName: 'Alex',
    tone: 'friendly',
    verbosity: 'medium',
    useEmoji: false,
  },
  messages: [{ role: MessageRole.USER, content: 'Help me plan today' }],
  memories: [
    {
      content: 'User prefers morning meetings',
      importance: 8,
      tags: ['preference', 'schedule'],
      layer: 'SEMANTIC',
      contextBucket: 'SEMANTIC',
    },
  ],
};
```

### 3) Generate a response

```typescript
const result = await ai.generateResponse('What should I do first?', context);
console.log(result.content);
```

### 4) Stream a response

```typescript
const streamed = await ai.generateResponseStream('Give me a concise plan', context, token => {
  process.stdout.write(token);
});
```

### 5) Request structured JSON

```typescript
import { buildInfoSearchQueryPrompt, type LlmRequest } from '@ai/ai-core';

const request: LlmRequest = {
  systemPrompt: buildInfoSearchQueryPrompt(),
  messages: [{ role: 'USER', content: 'Latest updates on AI regulation in EU' }],
  temperature: 0.1,
  maxTokens: 200,
};

const payload = await ai.generateJson<{ searchQuery: string; topic?: string }>(request);
```

## Provider contract

```typescript
interface LlmProvider {
  generate(request: LlmRequest): Promise<LlmResponse>;
  generateStream?(request: LlmRequest): AsyncGenerator<string>;
  isAvailable(): Promise<boolean>;
  getName(): string;
}
```

`generateStream` is optional. If a provider does not implement it, higher layers can still fall back to non-streaming generation.

## Conversation modes

- `MANAGER` - productivity and action planning
- `REFLECTION` - end-of-day reflection and insights
- `COMPANION` - supportive conversation
- `INFO` - concise factual summaries
