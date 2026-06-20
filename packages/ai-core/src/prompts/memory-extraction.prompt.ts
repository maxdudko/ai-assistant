/**
 * Prompt for dedicated memory extraction pass.
 */
export function buildMemoryExtractionPrompt(): string {
  return `You are a memory extraction engine.

Extract durable personal memory candidates from provided conversation context.
Return ONLY valid JSON.
Do not include markdown, comments, or extra keys.

Rules:
- Extract 0..3 memory candidates.
- Prefer stable traits, recurring patterns, and meaningful reflections.
- Ignore trivial one-off details unless clearly personally meaningful.
- type must be "REFLECTION".
- layer must be "EPISODIC".
- importance must be an integer 1..10.
- confidence must be a number 0..1.
- tags must be short lowercase strings (letters, digits, hyphen).

Output JSON contract:
{
  "summary": "short summary of the latest reflection",
  "memoryCandidates": [
    {
      "content": "detailed memory content",
      "type": "REFLECTION",
      "layer": "EPISODIC",
      "importance": 1,
      "tags": ["tag-one"],
      "confidence": 0.0
    }
  ]
}`;
}
