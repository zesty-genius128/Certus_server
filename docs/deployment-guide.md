# Deployment Guide

Complete guide for deploying your own Certus MCP Server.

## Prerequisites

- Node.js 18+ (tested on 18.x, 20.x, 22.x)
- Docker (recommended) or cloud platform account
- Git

## Docker Deployment (Recommended)

### Quick Start

For healthcare environments (recommended - no root privileges required):
```bash
docker run -d -p 3000:443 \
  --name certus-server \
  --restart unless-stopped \
  ghcr.io/zesty-genius128/certus_server:latest
```

For production with port 443 (requires root/sudo):
```bash
sudo docker run -d -p 443:443 \
  --name certus-server \
  --restart unless-stopped \
  ghcr.io/zesty-genius128/certus_server:latest
```

### Docker Compose Deployment

```bash
curl -O https://raw.githubusercontent.com/zesty-genius128/Certus_server/main/docker-compose.yml
docker-compose up -d
```

### Custom Docker Configuration

```yaml
version: '3.8'
services:
  certus-server:
    image: ghcr.io/zesty-genius128/certus_server:latest
    ports:
      - "443:443"
    environment:
      - OPENFDA_API_KEY=your_api_key_here
      - PORT=443
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:443/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Docker Features

- **Multi-platform support**: AMD64 and ARM64 architectures
- **Automatic security scanning**: Trivy vulnerability scanning during build
- **Production-optimized**: Alpine Linux base for minimal footprint
- **Health checks**: Built-in health monitoring with auto-restart
- **Non-root user**: Enhanced security with user ID 1001
- **Automatic updates**: Pull latest image and restart for updates

### Testing Docker Deployment

```bash
# Check container status
docker ps

# Check health (adjust port based on your deployment)
curl http://localhost:3000/health    # For healthcare environment deployment
curl http://localhost:443/health     # For production deployment

# View logs
docker logs certus-server

# Test drug search (adjust port as needed)
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "search_drug_shortages",
      "arguments": {"drug_name": "insulin", "limit": 3}
    }
  }'
```

## Manual Installation from Source

### Clone and Setup

```bash
git clone https://github.com/zesty-genius128/Certus_server.git
cd Certus_server
npm install
```

### Development Mode

```bash
# Start in development mode with auto-reload
npm run dev

# Start in production mode
npm start
```

### Testing Local Installation

```bash
# Test health endpoint
curl http://localhost:3000/health

# Test MCP protocol
npx @modelcontextprotocol/inspector http://localhost:3000/mcp

# Run unit tests
npm run test:unit:local
```

## Railway Cloud Deployment

### Prerequisites

- Railway account (free tier available)
- Railway CLI installed

### Deployment Steps

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize project in existing directory
railway init

# Deploy to Railway
railway up

# Get your deployment URL
railway domain

# Check deployment status
railway status
```

### Railway Configuration

Create `railway.json` for custom configuration:

```json
{
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/health"
  }
}
```

### Railway Environment Variables

Set these in the Railway dashboard:

```bash
OPENFDA_API_KEY=your_fda_api_key_here
PORT=443
NODE_ENV=production
```

## Self-Hosted Server Deployment

### VPS/Dedicated Server Setup

```bash
# Copy files to server
scp -r . user@your-server:/opt/certus-server/

# Connect to server and setup
ssh user@your-server
cd /opt/certus-server

# Install dependencies
npm install --production

# Start server
npm start
```

### Production Setup with PM2

```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start official-mcp-server.js --name certus-server

# Configure auto-restart on boot
pm2 save
pm2 startup

# Monitor the application
pm2 monit

# View logs
pm2 logs certus-server
```

### Nginx Reverse Proxy Setup

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### SSL Certificate with Let's Encrypt

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal setup
sudo crontab -e
# Add line: 0 12 * * * /usr/bin/certbot renew --quiet
```

## Proxmox Container Deployment

### LXC Container Setup

```bash
# Create Ubuntu 22.04 LXC container
pct create 200 ubuntu-22.04-standard_22.04-1_amd64.tar.zst \
  --memory 2048 \
  --cores 2 \
  --hostname certus-server \
  --net0 name=eth0,bridge=vmbr0,ip=dhcp

# Start container
pct start 200

# Enter container
pct enter 200

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Clone and setup Certus
git clone https://github.com/zesty-genius128/Certus_server.git /opt/certus-server
cd /opt/certus-server
npm install --production
```

### Systemd Service Setup

Create `/etc/systemd/system/certus-server.service`:

```ini
[Unit]
Description=Certus OpenFDA MCP Server
After=network.target

[Service]
Type=simple
User=node
WorkingDirectory=/opt/certus-server
ExecStart=/usr/bin/node official-mcp-server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=443

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
# Create node user
useradd -r -s /bin/false node
chown -R node:node /opt/certus-server

# Enable and start service
systemctl enable certus-server
systemctl start certus-server
systemctl status certus-server
```

## Configuration After Deployment

### Connect Claude Desktop (Tested Working Method)

**Claude Desktop Configuration File Method:**

1. Edit your Claude Desktop config file:
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Linux**: `~/.config/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

2. Add your server configuration:

For HTTPS deployment:

```json
{
  "mcpServers": {
    "Certus": {
      "command": "npx",
      "args": ["mcp-remote", "https://your-server.com/mcp"]
    }
  }
}
```

For local development (HTTP):

```json
{
  "mcpServers": {
    "Certus": {
      "command": "npx",
      "args": ["mcp-remote", "http://localhost:3000/mcp"]
    }
  }
}
```

1. Restart Claude Desktop completely
2. Look for the hammer icon in the chat input to confirm connection

**Note**: This method has been tested and confirmed working with our server implementation.

### Verify Deployment

```bash
# Check health
curl https://your-server.com/health

# List available tools
curl https://your-server.com/tools

# Test MCP protocol
npx @modelcontextprotocol/inspector https://your-server.com/mcp

# Run comprehensive tests
TEST_SERVER_URL=https://your-server.com npm run test:unit
```

## Monitoring and Maintenance

### Health Monitoring

```bash
# Continuous health check
watch -n 30 'curl -s https://your-server.com/health | jq'

# Cache statistics
curl https://your-server.com/cache-stats

# Manual cache cleanup
curl -X POST https://your-server.com/cache-cleanup
```

### Log Monitoring

```bash
# PM2 logs
pm2 logs certus-server --lines 100

# Docker logs
docker logs certus-server --tail 100 -f

# System logs
journalctl -u certus-server -f
```

### Updates

```bash
# Docker update
docker pull ghcr.io/zesty-genius128/certus_server:latest
docker stop certus-server
docker rm certus-server
# Run docker run command again

# Manual update
git pull origin main
npm install --production
pm2 restart certus-server
```

## Security Considerations

### Firewall Configuration

```bash
# Allow HTTPS only
ufw allow 443/tcp
ufw allow 22/tcp  # SSH access
ufw enable
```

### Regular Security Updates

```bash
# Ubuntu/Debian
apt update && apt upgrade -y

# Container updates
docker pull ghcr.io/zesty-genius128/certus_server:latest
```

### Environment Security

- Use environment variables for API keys (never commit to repository)
- Enable HTTPS in production
- Use non-root user for running the application  
- Keep dependencies updated
- Monitor security advisories for Node.js and dependencies

## Troubleshooting Deployment

### Common Issues

**Port already in use:**

```bash
# Find process using port
sudo lsof -i :443
# Kill process or change port
```

**Permission denied on port 443:**

```bash
# Use port 3000 instead, or setup reverse proxy
# Docker: -p 3000:443
```

**Out of memory:**

```bash
# Increase container memory
# Docker: --memory 1g
# PM2: pm2 start --max-memory-restart 1G
```

**DNS resolution issues:**

```bash
# Check DNS
nslookup your-domain.com
# Update DNS records if needed
```

For more troubleshooting help, see the [Troubleshooting Guide](troubleshooting-guide.md).
