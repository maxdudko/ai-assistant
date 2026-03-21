# ============================================================
# Vercel
# ============================================================

variable "vercel_api_token" {
  description = "Vercel API token (Settings → Tokens in the Vercel dashboard)"
  type        = string
  sensitive   = true
}

variable "vercel_team_id" {
  description = "Vercel team ID/slug. Leave empty for personal accounts."
  type        = string
  default     = ""
}

# ============================================================
# GitHub / Git
# ============================================================

variable "github_repo" {
  description = "GitHub repo in 'owner/repo' format (e.g. 'acme/ai-assistant')"
  type        = string
}

variable "github_production_branch" {
  description = "Git branch that maps to Vercel's Production environment"
  type        = string
  default     = "main"
}

# ============================================================
# Neon (Postgres + pgvector)
# ============================================================

variable "neon_api_key" {
  description = "Neon API key (console.neon.tech → Account → API keys)"
  type        = string
  sensitive   = true
}

variable "neon_region" {
  description = "Neon region ID (e.g. aws-us-east-1, aws-eu-central-1)"
  type        = string
  default     = "aws-us-east-1"
}

# ============================================================
# Application secrets
# ============================================================

variable "jwt_secret" {
  description = "Secret key used to sign JWT tokens. Use a long random string."
  type        = string
  sensitive   = true
}

variable "openai_api_key" {
  description = "OpenAI API key for AI features and text-embedding-3-large"
  type        = string
  sensitive   = true
}

variable "gemini_api_key" {
  description = "Google Gemini API key (optional, leave empty to disable)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "ollama_url" {
  description = "Ollama server URL. Leave empty when not using a local model in prod."
  type        = string
  default     = ""
}

variable "ollama_model" {
  description = "Ollama model name"
  type        = string
  default     = "llama3.2:latest"
}

variable "ollama_embed_model" {
  description = "Ollama embedding model name"
  type        = string
  default     = "nomic-embed-text:latest"
}

variable "embedding_dim" {
  description = "Embedding dimension — must match the model (3072 for text-embedding-3-large)"
  type        = number
  default     = 3072
}

variable "news_api_key" {
  description = "NewsAPI.org API key for info-digest features"
  type        = string
  sensitive   = true
  default     = ""
}

variable "app_name" {
  description = "Application name exposed to the API"
  type        = string
  default     = "PMA_API"
}
