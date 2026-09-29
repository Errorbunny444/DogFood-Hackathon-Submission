# Single VPS Production Deployment Guide

This guide covers deploying DOGFOOD 2026 on a single Linux VPS (e.g. Hetzner, DigitalOcean, Linode, AWS EC2) using Docker Compose and automated TLS via Caddy.

---

## 1. Prerequisites

- A 64-bit Linux server (Ubuntu 22.04 LTS or 24.04 LTS recommended)
- Minimum: 2 vCPU, 2 GB RAM, 20 GB SSD
- Docker Engine 24.0+ and Docker Compose v2.20+
- A DNS domain or subdomain pointing to your server's public IP (e.g. `hack.myorganization.org`)
- Ports `80` and `443` open in your firewall

---

## 2. Server Setup

```bash
# 1. Update system packages
sudo apt update && sudo apt upgrade -y

# 2. Install Docker and Docker Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 3. Create deployment directory
sudo mkdir -p /opt/dogfood && cd /opt/dogfood
```

---

## 3. Configuration

Clone the repository or transfer the release archive:
```bash
git clone https://github.com/dogfood-hackathon/dogfood.git /opt/dogfood
cd /opt/dogfood

# Copy environment template
cp .env.example .env
```

Edit `.env`:
```env
APP_MODE=selfhosted
NODE_ENV=production
APP_URL=https://hack.myorganization.org
CORS_ORIGIN=https://hack.myorganization.org
DATABASE_URL=postgresql://dogfood:dogfood_secure_pass@db:5432/dogfood
SESSION_SECRET=GENERATE_A_RANDOM_64_CHAR_HEX_STRING_HERE
STORAGE_PROVIDER=local
STORAGE_LOCAL_DIR=/data/uploads
EMAIL_PROVIDER=smtp
EMAIL_FROM="Hackathon Organizer <noreply@hack.myorganization.org>"
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@hack.myorganization.org
SMTP_PASS=your_smtp_pass
SEED_DEMO_DATA=false
```

---

## 4. HTTPS & Caddy Configuration

Update `infrastructure/caddy/Caddyfile` for your public domain:
```caddy
hack.myorganization.org {
    # Automatic HTTPS with Let's Encrypt
    encode gzip zstd

    root * /srv/dist
    file_server

    handle /api/* {
        reverse_proxy api:8080 {
            header_up Host {host}
            header_up X-Real-IP {remote_host}
        }
    }

    handle /uploads/* {
        reverse_proxy api:8080 {
            header_up Host {host}
            header_up X-Real-IP {remote_host}
        }
    }

    handle {
        try_files {path} /index.html
    }
}
```

---

## 5. Startup & Systemd Service

To ensure DOGFOOD automatically restarts upon server reboots:

Create `/etc/systemd/system/dogfood.service`:
```ini
[Unit]
Description=DOGFOOD Hackathon Platform
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/dogfood
ExecStart=/usr/bin/docker compose up -d --remove-orphans
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable dogfood
sudo systemctl start dogfood
```

Verify service status:
```bash
docker compose ps
curl -I https://hack.myorganization.org/api/v1/health
```
