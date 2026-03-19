output "web_project_id" {
  description = "Vercel project ID for the Next.js frontend"
  value       = vercel_project.web.id
}

output "web_url" {
  description = "Production URL of the Next.js frontend"
  value       = "https://${vercel_project.web.id}.vercel.app"
}

output "api_project_id" {
  description = "Vercel project ID for the NestJS API"
  value       = vercel_project.api.id
}

output "api_url" {
  description = "Production URL of the NestJS API"
  value       = "https://${vercel_project.api.id}.vercel.app"
}

output "neon_project_id" {
  description = "Neon project ID — use this in the Neon console"
  value       = neon_project.main.id
}

output "neon_database_name" {
  description = "Name of the Postgres database"
  value       = neon_project.main.database_name
}

output "database_url_pooled" {
  description = "Pooled DATABASE_URL for the application (PgBouncer)"
  value       = local.database_url_pooled
  sensitive   = true
}

output "database_url_direct" {
  description = "Direct DATABASE_URL for migrations (no PgBouncer)"
  value       = local.database_url_direct
  sensitive   = true
}
