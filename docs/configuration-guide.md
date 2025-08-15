# Configuration Guide

Basic configuration options for Certus MCP Server.

## Environment Variables

Create a `.env` file in your project root:

```bash
# FDA API Configuration (optional but recommended)
OPENFDA_API_KEY=your_fda_api_key_here

# Server Configuration
PORT=3000
NODE_ENV=development
```

## FDA API Key Setup

**Why get an API key:**
- Without key: 1,000 requests/day limit
- With key: 120,000 requests/day limit
- Avoids rate limiting issues

**Getting an API key:**
1. Visit: https://open.fda.gov/apis/authentication/
2. Click "Get API Key"
3. Fill out the registration form
4. Check your email for the API key

**Using the API key:**

```bash
# In .env file
OPENFDA_API_KEY=your_actual_api_key_here

# With Docker
docker run -e OPENFDA_API_KEY=your_key ghcr.io/zesty-genius128/certus_server:latest
```

## Port Configuration

**Common ports:**
- Development: 3000, 8080
- Production: 443 (requires root), 80

```bash
# Safe for any user
PORT=3000

# Requires root privileges
PORT=443
```

**Docker port mapping:**
```bash
# Maps container port 443 to host port 3000
docker run -p 3000:443 ghcr.io/zesty-genius128/certus_server:latest
```

## Basic Docker Setup

**Environment variables in Docker:**
```bash
docker run -d \
  -p 3000:443 \
  -e OPENFDA_API_KEY=your_key \
  -e NODE_ENV=production \
  --name certus-server \
  ghcr.io/zesty-genius128/certus_server:latest
```

**Docker Compose:**
```yaml
version: '3.8'
services:
  certus:
    image: ghcr.io/zesty-genius128/certus_server:latest
    ports:
      - "3000:443"
    environment:
      - OPENFDA_API_KEY=your_key
      - NODE_ENV=production
    restart: unless-stopped
```

## Available Tools

The server provides 8 FDA drug information tools:

1. `search_drug_shortages` - Current drug shortages
2. `search_adverse_events` - Drug side effects and reactions
3. `search_serious_adverse_events` - Serious adverse events only
4. `search_drug_recalls` - FDA drug recalls and safety alerts
5. `get_drug_label_info` - FDA prescribing information
6. `get_medication_profile` - Combined drug information
7. `analyze_drug_shortage_trends` - Historical shortage patterns
8. `batch_drug_analysis` - Multiple drug analysis

## Common Issues

**Server won't start:**
```bash
# Check if port is in use
lsof -i :3000

# Use different port
PORT=3001 npm start
```

**API key not working:**
```bash
# Test if API key is loaded
curl http://localhost:3000/health
# Look for "api_key_configured": true
```

**Docker permission issues:**
```bash
# Use non-privileged port
docker run -p 3000:443 ghcr.io/zesty-genius128/certus_server:latest

# Instead of port 443 which requires root
```