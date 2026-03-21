# ============================================================
# Vercel — Next.js frontend  (apps/web)
# ============================================================

resource "vercel_project" "web" {
  name      = "ai-assistant-web"
  team_id   = var.vercel_team_id != "" ? var.vercel_team_id : null
  framework = "nextjs"

  # Point Vercel at the Next.js app inside the monorepo
  root_directory = "apps/web"

  # Vercel detects pnpm-workspace.yaml at the repo root and installs from there,
  # so workspace packages (@ai/shared-types) are available during build.
  # turbo build --filter respects "dependsOn: ['^build']" and builds deps first.
  build_command   = "cd ../.. && pnpm turbo build --filter=@ai/web"
  install_command = "cd ../.. && pnpm install --frozen-lockfile"

  git_repository = {
    type              = "github"
    repo              = local.github_repo
    production_branch = var.github_production_branch
  }
}

# NEXT_PUBLIC_API_URL — consumed by the browser-side API client
resource "vercel_project_environment_variable" "web_api_url" {
  project_id = vercel_project.web.id
  team_id    = var.vercel_team_id != "" ? var.vercel_team_id : null

  key    = "NEXT_PUBLIC_API_URL"
  value  = "https://${vercel_project.api.id}.vercel.app"
  target = ["production", "preview"]
}

# Development override — points at the local API
resource "vercel_project_environment_variable" "web_api_url_dev" {
  project_id = vercel_project.web.id
  team_id    = var.vercel_team_id != "" ? var.vercel_team_id : null

  key    = "NEXT_PUBLIC_API_URL"
  value  = "http://localhost:4000"
  target = ["development"]
}
