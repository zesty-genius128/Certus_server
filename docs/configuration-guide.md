# Configuration Guide

Complete configuration reference for Certus MCP Server.

## Environment Variables

### Basic Configuration

```bash
# FDA API Configuration
OPENFDA_API_KEY=your_fda_api_key_here

# Server Configuration
PORT=3000
NODE_ENV=production

# Logging Configuration
LOG_LEVEL=info
LOG_FILE=/var/log/certus-server.log
```

### FDA API Key Setup

**Why you need an API key:**

- Without key: 1,000 requests/day
- With key: 120,000 requests/day
- Reduces rate limiting issues
- Better performance for heavy usage

**Getting an API key:**

1. Visit: <https://open.fda.gov/apis/authentication/>
2. Click "Get API Key"
3. Fill out the registration form
4. Verify your email address
5. API key will be sent via email

**Using the API key:**

```bash
# In .env file
OPENFDA_API_KEY=your_actual_api_key_here

# As environment variable
export OPENFDA_API_KEY=your_actual_api_key_here

# In Docker
docker run -e OPENFDA_API_KEY=your_key ghcr.io/zesty-genius128/certus_server:latest

# In Docker Compose
environment:
  - OPENFDA_API_KEY=your_key
```

### Port Configuration

**Default ports:**

- Development: 3000
- Production: 443 (HTTPS) or 80 (HTTP)

**Port configuration options:**

```bash
# Standard HTTP
PORT=3000

# HTTPS (requires SSL certificates)  
PORT=443

# Custom port
PORT=8080
```

**Port considerations:**

- **Port 443/80**: Requires root privileges or special configuration
- **Port 3000+**: Safe for non-root users
- **Docker**: Map container port to host port (`-p host:container`)

### Logging Configuration

```bash
# Log levels: error, warn, info, debug
LOG_LEVEL=info

# Log file location (optional)
LOG_FILE=/var/log/certus-server.log

# Disable console logging (optional)
DISABLE_CONSOLE_LOGGING=false

# Log format: json, simple
LOG_FORMAT=simple
```

## Rate Limiting Configuration

### FDA API Rate Limits

**Without API key:**

- 1,000 requests per day
- 40 requests per minute (burst)
- Resets at midnight EST

**With API key:**

- 120,000 requests per day  
- 240 requests per minute (sustained)
- Better burst capacity

### Client-Side Rate Limiting

The server implements intelligent rate limiting:

```javascript
// Built-in rate limiting (not configurable via environment)
const rateLimits = {
  requestsPerMinute: 60,
  burstCapacity: 10,
  windowSizeMs: 60000
};
```

## Caching Configuration

### Medical Safety-First Caching

Caching behavior is designed around medical data safety and cannot be modified via configuration to ensure patient safety.

### Current Caching Implementation

**Cached Data Types:**

- **Drug Labels**: 24-hour TTL (static prescribing information)
- **Drug Shortages**: 30-minute TTL (rapidly changing supply data)
- **Adverse Events**: 1-hour TTL (balancing safety with performance)

**Never Cached (Always Fresh):**

- **Drug Recalls**: Urgent safety alerts must always be current
- **Serious Adverse Events**: Life-threatening data requires immediate freshness

**Medical Safety Rationale:**

We cache data based on how quickly it changes and its safety impact:

- **Drug recalls** can happen at any time and serious adverse events involve life-threatening situations
- Caching this data could mean a doctor sees outdated information during an emergency
- **Drug labels** rarely change, so 24-hour caching is safe
- **Drug shortages** change frequently but aren't usually life-threatening emergencies (30-minute cache)
- **Regular adverse events** are cached for 1 hour to balance safety with performance

### Cache Management

**Automatic cleanup:**

- Runs every hour
- Removes expired entries
- Prevents memory leaks

**Manual cache management:**

```bash
# Check cache statistics
curl https://your-server.com/cache-stats

# Manual cache cleanup
curl -X POST https://your-server.com/cache-cleanup
```

**Cache statistics format:**

```json
{
  "timestamp": "2025-08-06T12:00:00.000Z",
  "status": "active",
  "cache": {
    "totalEntries": 4,
    "memoryUsageApprox": 4096,
    "entriesByType": {
      "drug_labels": 2,
      "drug_shortages": 1, 
      "adverse_events": 1,
      "drug_recalls": 0,
      "serious_adverse_events": 0
    }
  },
  "cleanup": {
    "interval": "1 hour",
    "next_cleanup": "automatic"
  }
}
```

## Security Configuration

### HTTPS Configuration

**For production deployments, always use HTTPS.**

**With reverse proxy (recommended):**

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_private_key /path/to/private.key;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Direct HTTPS (advanced):**

```bash
# Requires SSL certificate files
SSL_CERT_PATH=/path/to/certificate.crt
SSL_KEY_PATH=/path/to/private.key
PORT=443
```

### CORS Configuration

CORS is enabled by default for broad compatibility. The current configuration allows:

- All origins (`*`)
- Common HTTP methods (GET, POST, OPTIONS)
- Standard headers (Content-Type, Authorization)

**Built-in CORS settings:**

```javascript
// CORS configuration (not modifiable via environment)
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
```

### API Security

**API key security:**

- Store API keys in environment variables (never in code)
- Use different keys for development/production
- Rotate keys periodically
- Monitor key usage

**Server security:**

- Run as non-root user
- Use HTTPS in production
- Keep dependencies updated
- Monitor for security advisories

## MCP Protocol Configuration

### Protocol Version

The server implements MCP 2024-11-05 specification:

```javascript
// Fixed protocol configuration
const mcpConfig = {
  protocol: "mcp/2024-11-05",
  capabilities: {
    tools: { listChanged: true },
    resources: { listChanged: false },
    prompts: { listChanged: false }
  }
};
```

### Transport Configuration

**HTTP Transport (default):**

- JSON-RPC 2.0 over HTTP POST
- Endpoint: `/mcp`
- Content-Type: `application/json`

**Stdio Bridge Compatibility:**

- Works with `npx mcp-remote`
- Compatible with all MCP clients
- Automatic protocol translation

## Tool Configuration

### Available Tools

The server provides 8 FDA drug information tools:

1. `search_drug_shortages`
2. `get_medication_profile`
3. `search_drug_recalls`
4. `get_drug_label_info`
5. `analyze_drug_shortage_trends`
6. `search_adverse_events`
7. `search_serious_adverse_events`
8. `batch_drug_analysis`

### Tool Limits and Defaults

**Search result limits:**

- Default: 5-10 results per tool
- Maximum: 50 results per tool
- Batch analysis: Up to 25 drugs

**Timeout configuration:**

- FDA API requests: 15 seconds
- Tool execution: 30 seconds
- Total request: 60 seconds

### Error Handling Configuration

**Built-in error handling:**

- Automatic retry for transient failures
- Graceful fallback for API errors
- User-friendly error messages
- Medical safety warnings

## Docker Configuration

### Docker Environment Variables

```yaml
version: '3.8'
services:
  certus-server:
    image: ghcr.io/zesty-genius128/certus_server:latest
    ports:
      - "443:443"
    environment:
      # FDA API Configuration
      - OPENFDA_API_KEY=your_api_key_here
      
      # Server Configuration
      - PORT=443
      - NODE_ENV=production
      
      # Logging Configuration
      - LOG_LEVEL=info
      - LOG_FILE=/app/logs/certus.log
      
    volumes:
      # Persistent logs
      - ./logs:/app/logs
      
    restart: unless-stopped
    
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:443/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
```

### Docker Resource Limits

```yaml
services:
  certus-server:
    image: ghcr.io/zesty-genius128/certus_server:latest
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
        reservations:
          memory: 256M
          cpus: '0.25'
```

### Docker Security Configuration

```yaml
services:
  certus-server:
    image: ghcr.io/zesty-genius128/certus_server:latest
    
    # Security options
    user: "1001:1001"  # Non-root user
    read_only: true    # Read-only filesystem
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE  # Only if binding to port 80/443
    
    tmpfs:
      - /tmp
      - /app/tmp
```

## Production Configuration

### Recommended Production Settings

```bash
# Production environment file (.env)
NODE_ENV=production
PORT=443
OPENFDA_API_KEY=your_production_api_key

# Logging
LOG_LEVEL=warn
LOG_FILE=/var/log/certus-server.log
DISABLE_CONSOLE_LOGGING=true

# Security
SSL_CERT_PATH=/etc/ssl/certs/certus.crt
SSL_KEY_PATH=/etc/ssl/private/certus.key
```

### System Service Configuration

**Systemd service file** (`/etc/systemd/system/certus-server.service`):

```ini
[Unit]
Description=Certus OpenFDA MCP Server
After=network.target

[Service]
Type=simple
User=certus
Group=certus
WorkingDirectory=/opt/certus-server
ExecStart=/usr/bin/node official-mcp-server.js
Restart=always
RestartSec=10

# Environment
Environment=NODE_ENV=production
Environment=PORT=3000
EnvironmentFile=-/opt/certus-server/.env

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/certus-server/logs

# Resource limits
LimitNOFILE=65536
MemoryMax=512M

[Install]
WantedBy=multi-user.target
```

### PM2 Configuration

**PM2 ecosystem file** (`ecosystem.config.js`):

```javascript
module.exports = {
  apps: [{
    name: 'certus-server',
    script: 'official-mcp-server.js',
    instances: 1,
    exec_mode: 'cluster',
    
    // Environment
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    
    // Resource limits
    max_memory_restart: '512M',
    
    // Logging
    log_file: '/var/log/certus-server.log',
    error_file: '/var/log/certus-server-error.log',
    out_file: '/var/log/certus-server-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    
    // Restart policy
    restart_delay: 5000,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
```

## Development Configuration

### Development Environment

```bash
# Development environment file (.env.development)
NODE_ENV=development
PORT=3000

# Logging (more verbose)
LOG_LEVEL=debug
DISABLE_CONSOLE_LOGGING=false

# Development FDA API key (optional)
OPENFDA_API_KEY=your_development_api_key
```

### Development Scripts

```json
{
  "scripts": {
    "dev": "NODE_ENV=development nodemon official-mcp-server.js",
    "start": "NODE_ENV=production node official-mcp-server.js",
    "test": "NODE_ENV=test node tests/unit-tests.js",
    "debug": "NODE_ENV=development node --inspect official-mcp-server.js"
  }
}
```

### Hot Reloading with Nodemon

```bash
# Install nodemon for development
npm install -g nodemon

# Start with auto-reload
nodemon official-mcp-server.js

# With custom config
nodemon --watch "*.js" --ignore node_modules/ official-mcp-server.js
```

## Monitoring Configuration

### Health Check Configuration

**Built-in health endpoint:**

- URL: `/health`
- Method: GET
- Response: JSON with server status

**Health check response format:**

```json
{
  "status": "healthy",
  "timestamp": "2025-08-06T12:00:00.000Z",
  "uptime": 3600,
  "memory": {
    "used": "45.2 MB",
    "total": "512 MB",
    "percentage": 8.8
  },
  "fdaApiStatus": "operational",
  "toolsAvailable": 8,
  "cacheStatus": "active"
}
```

### Monitoring Integration

**Prometheus metrics** (if monitoring enabled):

```bash
# Custom metrics endpoint
curl http://localhost:3000/metrics

# Basic metrics available:
# - http_requests_total
# - http_request_duration_seconds
# - nodejs_memory_usage_bytes
# - fda_api_requests_total
# - cache_operations_total
```

**Log aggregation:**

```bash
# Structured logging for log aggregation
LOG_FORMAT=json
LOG_LEVEL=info
```

## Troubleshooting Configuration Issues

### Configuration Validation

```bash
# Test configuration
node -e "
const config = {
  port: process.env.PORT || 3000,
  apiKey: process.env.OPENFDA_API_KEY || 'not_set',
  nodeEnv: process.env.NODE_ENV || 'development'
};
console.log('Configuration:', JSON.stringify(config, null, 2));
"
```

### Common Configuration Problems

**Environment variables not loaded:**

```bash
# Check if .env file is in correct location
ls -la .env

# Test environment variable loading
node -e "require('dotenv').config(); console.log(process.env.OPENFDA_API_KEY);"
```

**Port binding issues:**

```bash
# Check if port is available
netstat -tulpn | grep :443

# Test port binding permission
sudo setcap CAP_NET_BIND_SERVICE=+eip /usr/bin/node
```

**SSL certificate issues:**

```bash
# Validate certificate files
openssl x509 -in certificate.crt -text -noout
openssl rsa -in private.key -check
```

For detailed troubleshooting, see the [Troubleshooting Guide](troubleshooting-guide.md).
