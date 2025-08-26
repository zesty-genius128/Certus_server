# Deployment Guide

How to deploy the server.

## Prerequisites

- Node.js 18+
- Docker or cloud account

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

- Multi-platform support (AMD64 and ARM64)
- Built-in health monitoring
- Alpine Linux base for small size

### Testing Docker Deployment

```bash
# Check container status
docker ps

# Check health
curl http://localhost:3000/health

# View logs
docker logs certus-server
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
```

## Railway Cloud Deployment

### Prerequisites

- Railway account (free tier available with $5 credit upon verification)
- Railway CLI installed

### Deployment Steps

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

**Note:** Railway offers $5 free credit when you verify your account. The current backup deployment has been manually stopped to preserve these credits. Use `railway up` to restart when needed.

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

### Health Check

```bash
curl https://your-server.com/health
```

### Updates

```bash
# Docker update  
docker pull ghcr.io/zesty-genius128/certus_server:latest
docker restart certus-server
```

## Security

- Use environment variables for API keys
- Enable HTTPS in production
- Keep Docker image updated

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
