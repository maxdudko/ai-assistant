# ============================================================
# Neon Postgres (with pgvector)
# Provider: kislerdm/neon  ~> 0.6
# Docs: https://registry.terraform.io/providers/kislerdm/neon/latest
# ============================================================

resource "neon_project" "main" {
  name                      = "ai-assistant"
  region_id                 = var.neon_region
  pg_version                = 16
  history_retention_seconds = 21600 # free plan max (6 h)

  branch {
    database_name = "pma"
    role_name     = "pma_admin"
  }

  # Neon scales to zero when idle — 0.25 CU minimum keeps costs low
  default_endpoint_settings {
    autoscaling_limit_min_cu = 0.25
    autoscaling_limit_max_cu = 1
  }
}

locals {
  # Direct connection URL — used by Prisma Migrate and prisma db push
  # Format: postgresql://role:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require
  database_url_direct = neon_project.main.connection_uri

  # Pooled (PgBouncer) URL — used by the running app to avoid connection exhaustion
  # Neon exposes this directly via connection_uri_pooler
  database_url_pooled = neon_project.main.connection_uri_pooler

  # Normalise github_repo: accept both "owner/repo" and the full GitHub URL
  github_repo = replace(var.github_repo, "https://github.com/", "")
}

# Enable the pgvector extension on the default branch via a post-deploy migration.
# Prisma does NOT run this automatically; the first `prisma migrate deploy`
# will apply migrations that already contain `CREATE EXTENSION IF NOT EXISTS vector`.
# No extra Terraform resource is needed — Neon supports pgvector on all plans.
