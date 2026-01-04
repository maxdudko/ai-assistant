# Ollama Integration Setup

The AI service is now integrated with Ollama for local LLM inference using the `gemma3:1b` model.

## Prerequisites

1. **Install Ollama**:
   - Visit https://ollama.ai and install Ollama for your platform
   - Or use: `curl -fsSL https://ollama.ai/install.sh | sh`

2. **Pull the gemma3:1b model**:

   ```bash
   ollama pull gemma3:1b
   ```

3. **Start Ollama** (if not running as a service):
   ```bash
   ollama serve
   ```

## Configuration

The Ollama integration uses environment variables for configuration:

- `OLLAMA_URL` - Ollama API URL (default: `http://localhost:11434`)
- `OLLAMA_MODEL` - Model name to use (default: `gemma3:1b`)

Add these to your `.env` file:

```env
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=gemma3:1b
```

## How It Works

1. When a user sends a message, the AI service:
   - Builds a context-aware prompt based on:
     - Conversation mode (MANAGER, REFLECTION, COMPANION, INFO)
     - User profile preferences
     - Conversation history
     - Relevant memories
   - Sends the prompt to Ollama API
   - Returns the generated response

2. **Error Handling**:
   - If Ollama is unavailable, the service falls back to stub responses
   - Errors are logged for debugging
   - The application continues to function even if Ollama is down

## Testing

To verify Ollama is working:

1. Make sure Ollama is running:

   ```bash
   curl http://localhost:11434/api/tags
   ```

2. Test the model directly:

   ```bash
   ollama run gemma3:1b "Hello, how are you?"
   ```

3. Send a message through the API and check the logs for any errors

## Troubleshooting

**Issue: "Ollama is not available"**

- Ensure Ollama is running: `ollama serve`
- Check the URL in your `.env` matches your Ollama instance
- Verify the model is installed: `ollama list`

**Issue: Model not found**

- Pull the model: `ollama pull gemma3:1b`
- Check the model name in `.env` matches exactly

**Issue: Slow responses**

- The `gemma3:1b` model is small and fast, but responses may take a few seconds
- Consider using a larger model for better quality (e.g., `gemma2:2b` or `llama3.2:1b`)

## Alternative Models

You can use any Ollama model by changing `OLLAMA_MODEL`:

```env
OLLAMA_MODEL=llama3.2:1b
OLLAMA_MODEL=gemma2:2b
OLLAMA_MODEL=mistral:7b
```

## Performance Notes

- The `gemma3:1b` model is optimized for speed and low resource usage
- First request may be slower as the model loads into memory
- Subsequent requests will be faster
- For production, consider using a larger model for better quality
