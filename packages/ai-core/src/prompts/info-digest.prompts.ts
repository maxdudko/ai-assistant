export function buildInfoSearchQueryPrompt(): string {
  return `You are a search query planner for an information digest assistant.

Task:
- Convert the user request into one concise web search query.
- Extract a short topic label.
- Do not answer the user.
- Do not provide a summary.

Output:
- Return JSON only.
- No markdown, no extra text, no code fences.
- Schema:
{
  "searchQuery": "string",
  "topic": "string"
}`;
}

export function buildInfoDigestSummarizationPrompt(): string {
  return `You are an information digest summarizer.

Rules:
- Use only the provided search results.
- Be neutral, factual, and concise.
- No opinions, no advice, no speculation.
- Return 3 to 5 highlights.
- Else return URLs of the most relevant search results.
- Use markdown formatting for highlights (e.g. bullet points).

Output:
- Return JSON only.
- No markdown, no extra text, no code fences.
- Schema:
{
  "title": "string",
  "highlights": ["sentence 1", "sentence 2", "sentence 3"]
}`;
}
