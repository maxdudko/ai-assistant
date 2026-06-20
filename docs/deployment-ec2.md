# EC2 Deployment (Docker: web + api + db)

This guide deploys all runtime services in containers on one EC2 host:

- `web` (Next.js)
- `api` (NestJS)
- `db` (PostgreSQL + pgvector)

It uses:

- `compose.prod.yaml`
- `infra/nginx/ec2.conf`
- `scripts/deploy-ec2.sh`

## 1) EC2 prerequisites

- Ubuntu 22.04+ instance
- Security group inbound: `22` (your IP), `80`, `443`
- Domain DNS records:
  - `app.your-domain.com` -> EC2 public IP
  - `api.your-domain.com` -> EC2 public IP

Install Docker + Compose:

```bash
sudo apt update
sudo apt install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
docker --version
docker compose version
```

## 2) Clone and configure app

```bash
sudo mkdir -p /opt
cd /opt
sudo chown -R "$USER":"$USER" /opt
git clone https://github.com/maxdudko/ai-assistant.git
cd ai-assistant
```

Create env files:

```bash
cp apps/api/example.env apps/api/.env
cp apps/web/example.env apps/web/.env.local
```

Set required values:

- `apps/api/.env`
  - `NODE_ENV=production`
  - `LLM_PROVIDER=openai`
  - `EMBEDDINGS_PROVIDER=openai`
  - `OPENAI_API_KEY=...`
  - `JWT_SECRET=<strong-random-secret>`
  - `CORS_ORIGIN=https://app.your-domain.com`
  - `FRONTEND_URL=https://app.your-domain.com`
- `apps/web/.env.local`
  - `NEXT_PUBLIC_API_URL=https://api.your-domain.com`

You do not need to set DB host in `apps/api/.env` for this setup.  
`compose.prod.yaml` overrides DB URLs to use the internal Docker service (`db`).

## 3) Run deployment

```bash
chmod +x scripts/deploy-ec2.sh
APP_DIR=/opt/ai-assistant BRANCH=main ./scripts/deploy-ec2.sh
```

What this does:

1. Pulls latest code
2. Starts `db`
3. Runs `prisma migrate deploy` in the `migrate` container
4. Builds and starts `api` and `web`

## 4) Configure Nginx reverse proxy

Copy and edit:

```bash
sudo cp infra/nginx/ec2.conf /etc/nginx/sites-available/ai-assistant
sudo nano /etc/nginx/sites-available/ai-assistant
```

Replace:

- `app.example.com` -> `app.your-domain.com`
- `api.example.com` -> `api.your-domain.com`

Enable site:

```bash
sudo ln -sf /etc/nginx/sites-available/ai-assistant /etc/nginx/sites-enabled/ai-assistant
sudo nginx -t
sudo systemctl reload nginx
```

## 5) Enable HTTPS (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d app.your-domain.com -d api.your-domain.com
```

## 6) Validate

- Frontend: `https://app.your-domain.com`
- API: `https://api.your-domain.com/api`

Check services:

```bash
docker compose -f compose.prod.yaml ps
docker compose -f compose.prod.yaml logs -f --tail=100 api
```
