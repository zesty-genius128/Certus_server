# Testing Guide

Basic testing commands for Certus MCP Server.

## Quick Health Check

Check if your server is working:

```bash
# Local server
curl http://localhost:3000/health

# Your deployed server
curl https://your-server.com/health
```

Expected response: `{"status":"healthy"}`

## MCP Protocol Testing

Test MCP protocol compliance with the official inspector:

```bash
# Test local server
npx @modelcontextprotocol/inspector http://localhost:3000/mcp

# Test deployed server
npx @modelcontextprotocol/inspector https://your-server.com/mcp
```

The inspector will:

- Connect to your MCP server
- List available tools (should show 8 FDA tools)
- Test JSON-RPC protocol compliance
- Validate tool schemas

## Built-in Test Suite

Run the comprehensive test suite:

```bash
# Run unit tests (utility functions only)
npm run test:unit

# Run main test suite (unit tests)
npm test
```

## Basic Tool Testing

Test individual tools with curl:

**Drug shortage search:**

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "search_drug_shortages",
      "arguments": {"drug_name": "insulin"}
    }
  }'
```

**Drug label information:**

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "get_drug_label_info",
      "arguments": {"drug_name": "metformin"}
    }
  }'
```

## Server Endpoints

Test additional server endpoints:

```bash
# List all available tools
curl http://localhost:3000/tools

# Check server info
curl http://localhost:3000/

# Monitor usage stats
curl http://localhost:3000/usage-stats

# Check cache performance
curl http://localhost:3000/cache-stats
```

## Docker Testing

Test your Docker deployment:

```bash
# Check container status
docker ps

# View container logs
docker logs certus-server

# Test health endpoint
curl http://localhost:3000/health

# Stop container
docker stop certus-server
```

## Common Test Issues

**Port conflicts:**

```bash
# Check what's using port 3000
lsof -i :3000

# Use different port
PORT=3001 npm start
```

**Rate limiting errors:**

```bash
# Check if you hit rate limits
curl http://localhost:3000/usage-stats

# Wait 30 minutes or restart server to reset limits
```

**FDA API errors:**

```bash
# Check API health
curl http://localhost:3000/health | jq .api_health

# Verify API key is configured
curl http://localhost:3000/health | jq .api_health.api_key_configured
```

## Test Results

**Successful test indicators:**

- Health endpoint returns `{"status":"healthy"}`
- MCP inspector connects without errors
- Tool tests return JSON responses (not 404/500 errors)
- Unit tests pass without failures

**Common failure patterns:**

- HTTP 429: Rate limiting (wait or restart server)
- HTTP 404: Wrong URL or server not running
- Connection refused: Server not started or wrong port
- JSON parse errors: Invalid request format
