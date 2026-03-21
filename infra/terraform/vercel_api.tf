# ============================================================
# Vercel — NestJS API  (apps/api)
# ============================================================

resource "vercel_project" "api" {
  name    = "ai-assistant-api"
  team_id = var.vercel_team_id != "" ? var.vercel_team_id : null

  # No framework preset — Vercel will use vercel.json in apps/api
  framework = null

  root_directory = "apps/api"

  # Build order:
  #   1. Build @ai/ai-core  (tsc → dist/)  — NestJS imports it as CJS
  #   2. prisma generate    — generates the typed Prisma client
  #   3. nest build         — compiles NestJS app to dist/
  #   4. prisma migrate deploy — runs pending migrations against the Neon DB
  build_command   = "cd ../.. && pnpm turbo build --filter=@ai/ai-core && cd apps/api && pnpm run vercel-build"
  install_command = "cd ../.. && pnpm install --frozen-lockfile"

  git_repository = {
    type              = "github"
    repo              = local.github_repo
    production_branch = var.github_production_branch
  }
}

# ── Database ─────────────────────────────────────────────────

# Pooled URL for the running app (avoids serverless connection exhaustion)
resource "vercel_project_environment_variable" "api_database_url" {
  project_id = vercel_project.api.id
  team_id    = var.vercel_team_id != "" ? var.vercel_team_id : null
  key        = "DATABASE_URL"
  value      = local.database_url_pooled
  target     = ["production", "preview"]
  sensitive  = true
}

# Direct URL for prisma migrate deploy (no PgBouncer, required for DDL)
resource "vercel_project_environment_variable" "api_database_url_unpooled" {
  project_id = vercel_project.api.id
  team_id    = var.vercel_team_id != "" ? var.vercel_team_id : null
  key        = "DATABASE_URL_UNPOOLED"
  value      = local.database_url_direct
  target     = ["production", "preview"]
  sensitive  = true
}

# ── Auth ─────────────────────────────────────────────────────

resource "vercel_project_environment_variable" "api_jwt_secret" {
  project_id = vercel_project.api.id
  team_id    = var.vercel_team_id != "" ? var.vercel_team_id : null
  key        = "JWT_SECRET"
  value      = var.jwt_secret
  target     = ["production", "preview"]
  sensitive  = true
}

# ── AI providers ─────────────────────────────────────────────

resource "vercel_project_environment_variable" "api_openai_key" {
  project_id = vercel_project.api.id
  team_id    = var.vercel_team_id != "" ? var.vercel_team_id : null
  key        = "OPENAI_API_KEY"
  value      = var.openai_api_key
  target     = ["production", "preview"]
  sensitive  = true
}

resource "vercel_project_environment_variable" "api_gemini_key" {
  count      = var.gemini_api_key != "" ? 1 : 0
  project_id = vercel_project.api.id
  team_id    = var.vercel_team_id != "" ? var.vercel_team_id : null
  key        = "GEMINI_API_KEY"
  value      = var.gemini_api_key
  target     = ["production", "preview"]
  sensitive  = true
}

resource "vercel_project_environment_variable" "api_ollama_url" {
  count      = var.ollama_url != "" ? 1 : 0
  project_id = vercel_project.api.id
  team_id    = var.vercel_team_id != "" ? var.vercel_team_id : null
  key        = "OLLAMA_URL"
  value      = var.ollama_url
  target     = ["production", "preview"]
}

resource "vercel_project_environment_variable" "api_ollama_model" {
  project_id = vercel_project.api.id
  team_id    = var.vercel_team_id != "" ? var.vercel_team_id : null
  key        = "OLLAMA_MODEL"
  value      = var.ollama_model
  target     = ["production", "preview"]
}

resource "vercel_project_environment_variable" "api_ollama_embed_model" {
  project_id = vercel_project.api.id
  team_id    = var.vercel_team_id != "" ? var.vercel_team_id : null
  key        = "OLLAMA_EMBED_MODEL"
  value      = var.ollama_embed_model
  target     = ["production", "preview"]
}

resource "vercel_project_environment_variable" "api_embedding_dim" {
  project_id = vercel_project.api.id
  team_id    = var.vercel_team_id != "" ? var.vercel_team_id : null
  key        = "EMBEDDING_DIM"
  value      = tostring(var.embedding_dim)
  target     = ["production", "preview"]
}

# ── App config ────────────────────────────────────────────────

resource "vercel_project_environment_variable" "api_node_env" {
  project_id = vercel_project.api.id
  team_id    = var.vercel_team_id != "" ? var.vercel_team_id : null
  key        = "NODE_ENV"
  value      = "production"
  target     = ["production", "preview"]
}

resource "vercel_project_environment_variable" "api_cors_origin" {
  project_id = vercel_project.api.id
  team_id    = var.vercel_team_id != "" ? var.vercel_team_id : null
  key        = "CORS_ORIGIN"
  value      = "https://${vercel_project.web.id}.vercel.app"
  target     = ["production", "preview"]
}

resource "vercel_project_environment_variable" "api_app_name" {
  project_id = vercel_project.api.id
  team_id    = var.vercel_team_id != "" ? var.vercel_team_id : null
  key        = "APP_NAME"
  value      = var.app_name
  target     = ["production", "preview"]
}

resource "vercel_project_environment_variable" "api_news_key" {
  count      = var.news_api_key != "" ? 1 : 0
  project_id = vercel_project.api.id
  team_id    = var.vercel_team_id != "" ? var.vercel_team_id : null
  key        = "NEWS_API_KEY"
  value      = var.news_api_key
  target     = ["production", "preview"]
  sensitive  = true
}
