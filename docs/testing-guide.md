# Testing and Validation Guide

Comprehensive guide for testing your Certus MCP Server deployment.

## Quick Health Check

```bash
# Check if server is running
curl https://certus.opensource.mieweb.org/health

# Test with MCP inspector
npx @modelcontextprotocol/inspector https://certus.opensource.mieweb.org/mcp
```

## MCP Inspector Testing

The MCP Inspector is the official tool for testing MCP protocol compliance.

### Installation and Usage

```bash
# Test production server
npx @modelcontextprotocol/inspector https://certus.opensource.mieweb.org/mcp

# Test backup server
npx @modelcontextprotocol/inspector https://certus-server-production.up.railway.app/mcp

# Test local development
npx @modelcontextprotocol/inspector http://localhost:3000/mcp

# Test your own deployment
npx @modelcontextprotocol/inspector https://your-server.com/mcp
```

### What MCP Inspector Validates

- JSON-RPC 2.0 protocol compliance
- MCP specification adherence
- Tool schema validation
- Connection handling
- Error response formatting
- Transport layer functionality

### Expected Inspector Results

```json
{
  "protocol": "mcp/2024-11-05",
  "capabilities": {
    "tools": { "listChanged": true }
  },
  "tools": [
    {
      "name": "search_drug_shortages",
      "description": "Search FDA drug shortages database"
    },
    {
      "name": "get_medication_profile", 
      "description": "Get comprehensive drug information"
    }
    // ... 6 more tools
  ]
}
```

## Unit Testing

### Built-in Test Suite

The project includes comprehensive unit tests covering all functionality:

```bash
# Run all unit tests (default: localhost)
npm run test:unit

# Test against your own deployment  
TEST_SERVER_URL=https://your-server.com npm run test:unit

# Test against local development server
npm run test:unit:local

# Test against production server (maintainer use)
npm run test:unit:production
```

### Test Coverage

The unit tests validate:

**Core Utility Functions:**

- Drug name validation with context-specific error messages
- Cache management (TTL validation, expired item handling)
- API parameter building (URL encoding, API key inclusion)
- Function imports and exports

**Live Server Integration:**

- Server health and availability
- Tool listing and schema validation
- MCP protocol compliance (JSON-RPC 2.0)
- All 8 FDA drug information tools
- Cache statistics and performance monitoring

**Medical Safety Compliance:**

- Caching behavior for safety-critical vs non-critical data
- TTL validation for different data types
- Cache cleanup functionality

### Test Results Interpretation

```bash
Unit tests loaded successfully. Run with: node --test tests/unit-tests.js
Testing against server: https://your-server.com
To test against a different server, set TEST_SERVER_URL environment variable

▶ Drug Name Validation
  ✔ should accept valid drug names (0.289375ms)
  ✔ should reject empty or invalid drug names (0.138833ms)
  ✔ should provide context-specific error messages (0.063625ms)
✔ Drug Name Validation (1.015333ms)

▶ Live Server Integration Tests
  ✔ should connect to server health endpoint (1280ms)
  ✔ should list all 8 FDA tools via MCP endpoint (226ms)
  ✔ should execute drug shortage search via live server (83ms)
  ✔ should get cache statistics from live server (189ms)
✔ Live Server Integration Tests (1778ms)
```

### Custom Test Configuration

For testing your own deployment:

1. Deploy the server to your infrastructure
2. Set `TEST_SERVER_URL` environment variable
3. Run `npm run test:unit` to validate

Example:

```bash
export TEST_SERVER_URL=https://my-server.example.com
npm run test:unit
```

## Direct API Testing

### Tool Testing with cURL

Test individual FDA tools directly using the MCP JSON-RPC protocol:

#### Drug Shortage Search

```bash
curl -X POST https://certus.opensource.mieweb.org/mcp \
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

#### Medication Profile

```bash
curl -X POST https://certus.opensource.mieweb.org/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "get_medication_profile", 
      "arguments": {"drug_identifier": "metformin"}
    }
  }'
```

#### Drug Recalls Search

```bash
curl -X POST https://certus.opensource.mieweb.org/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "search_drug_recalls",
      "arguments": {"drug_name": "acetaminophen", "limit": 5}
    }
  }'
```

#### Trend Analysis

```bash
curl -X POST https://certus.opensource.mieweb.org/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 4,
    "method": "tools/call",
    "params": {
      "name": "analyze_drug_shortage_trends",
      "arguments": {"drug_name": "insulin", "months_back": 12}
    }
  }'
```

#### Batch Analysis

```bash
curl -X POST https://certus.opensource.mieweb.org/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 5,
    "method": "tools/call",
    "params": {
      "name": "batch_drug_analysis",
      "arguments": {
        "drug_list": ["insulin", "metformin", "lisinopril"],
        "include_trends": true
      }
    }
  }'
```

#### Adverse Events

```bash
curl -X POST https://certus.opensource.mieweb.org/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 6,
    "method": "tools/call",
    "params": {
      "name": "search_adverse_events",
      "arguments": {"drug_name": "aspirin", "limit": 5, "detailed": false}
    }
  }'
```

### Expected Response Format

All tool responses follow JSON-RPC 2.0 format:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Raw FDA API response data here..."
      }
    ]
  }
}
```

## Health Check Commands

### Server Health Monitoring

```bash
# Basic health check
curl https://certus.opensource.mieweb.org/health

# Detailed health with JSON formatting
curl -s https://certus.opensource.mieweb.org/health | jq

# Check backup server
curl https://certus-server-production.up.railway.app/health
```

Expected health response:

```json
{
  "status": "healthy",
  "timestamp": "2025-08-06T12:00:00.000Z",
  "uptime": 3600,
  "memory": {
    "used": "45.2 MB",
    "total": "512 MB"
  },
  "fdaApiStatus": "operational"
}
```

### Tool Availability Check

```bash
# List all available tools
curl https://certus.opensource.mieweb.org/tools

# Pretty print tools list
curl -s https://certus.opensource.mieweb.org/tools | jq '.tools[].name'
```

Expected tools list:

```
"search_drug_shortages"
"get_medication_profile"
"search_drug_recalls"
"get_drug_label_info"
"analyze_drug_shortage_trends"
"search_adverse_events"
"search_serious_adverse_events"
"batch_drug_analysis"
```

### Cache Statistics

```bash
# Check cache performance
curl https://certus.opensource.mieweb.org/cache-stats

# Monitor cache in real-time
watch -n 30 'curl -s https://certus.opensource.mieweb.org/cache-stats | jq'
```

Expected cache stats:

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
  }
}
```

## Performance Testing

### Response Time Validation

```bash
# Time individual requests
time curl -s https://certus.opensource.mieweb.org/health

# Measure tool execution time
time curl -X POST https://certus.opensource.mieweb.org/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "search_drug_shortages",
      "arguments": {"drug_name": "insulin", "limit": 5}
    }
  }'
```

### Load Testing

```bash
# Simple concurrent request test
for i in {1..10}; do
  curl -s https://certus.opensource.mieweb.org/health &
done
wait

# Tool load test
for i in {1..5}; do
  curl -X POST https://certus.opensource.mieweb.org/mcp \
    -H "Content-Type: application/json" \
    -d '{
      "jsonrpc": "2.0",
      "id": '$i',
      "method": "tools/call", 
      "params": {
        "name": "search_drug_shortages",
        "arguments": {"drug_name": "metformin", "limit": 3}
      }
    }' &
done
wait
```

## Comprehensive Test Suite

### Full FDA Tools Validation

The project includes a comprehensive test suite covering all FDA tools:

```bash
# Run comprehensive test suite
node tests/comprehensive-test.js

# Run with custom server
TEST_SERVER_URL=https://your-server.com node tests/comprehensive-test.js
```

### Test Categories

**Drug Trend Analysis Tests:**

- Drugs with shortage history
- Drugs without shortage history
- Input validation and error handling
- Edge cases and boundary conditions

**Core FDA Tools Tests:**

- All 8 FDA drug information tools
- Parameter validation
- Response format verification
- Error handling validation

**Batch Analysis Tests:**

- Multi-drug processing
- Trend inclusion options
- Large batch handling (up to 25 drugs)

**Performance Tests:**

- Response time validation (under 5 seconds)
- Cache behavior verification
- Memory usage monitoring

**Error Handling Tests:**

- Invalid drug names
- Malformed requests
- Rate limit handling
- Network error recovery

### Test Results Analysis

The comprehensive test suite provides detailed results:

```
Testing Drug Trend Analysis...
✓ Insulin shortage trends (732 days duration, 107 events) - 2.1s
✓ Metformin (no current shortages) - 1.8s
✓ Invalid drug name validation - 0.3s

Testing Core FDA Tools...
✓ Drug shortage search - 1.5s
✓ Medication profile retrieval - 2.3s
✓ Drug recalls search - 1.7s
✓ Adverse events search - 2.8s

Testing Batch Analysis...
✓ Multi-drug analysis (5 drugs) - 4.2s
✓ Batch with trend analysis - 6.1s

All tests passed: 63/63
Total execution time: 45.2 seconds
```

## Deployment Validation

### Post-Deployment Checklist

After deploying your own server, validate:

1. **Health endpoint responds:**

   ```bash
   curl https://your-server.com/health
   ```

2. **All 8 tools available:**

   ```bash
   curl https://your-server.com/tools | jq '.tools | length'
   # Should return: 8
   ```

3. **MCP protocol compliance:**

   ```bash
   npx @modelcontextprotocol/inspector https://your-server.com/mcp
   ```

4. **Tool functionality:**

   ```bash
   TEST_SERVER_URL=https://your-server.com npm run test:unit
   ```

5. **SSL/HTTPS working:**

   ```bash
   curl -I https://your-server.com/health
   # Should show HTTP/2 200 or HTTP/1.1 200
   ```

### Integration Testing with MCP Clients

#### Claude Desktop Integration

1. Add server to Claude config
2. Restart Claude Desktop
3. Test with: "Check insulin shortage status using FDA data"
4. Verify tools appear in Claude interface

#### LibreChat Integration

1. Configure stdio-wrapper.js with your server URL
2. Add to LibreChat MCP configuration
3. Test drug information queries
4. Verify responses include FDA data

#### Custom MCP Client Testing

```javascript
// Example Node.js MCP client test
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');

async function testMCPClient() {
  const transport = new HttpTransport('https://your-server.com/mcp');
  const client = new Client(transport);
  
  await client.connect();
  const tools = await client.listTools();
  console.log('Available tools:', tools.length);
  
  const result = await client.callTool('search_drug_shortages', {
    drug_name: 'insulin',
    limit: 3
  });
  console.log('Tool result:', result);
}
```

## Monitoring and Alerting

### Uptime Monitoring

Set up monitoring for your deployment:

```bash
# Simple uptime script
#!/bin/bash
while true; do
  if ! curl -sf https://your-server.com/health > /dev/null; then
    echo "$(date): Server down" | tee -a uptime.log
    # Add alerting here (email, Slack, etc.)
  fi
  sleep 300  # Check every 5 minutes
done
```

### Log Analysis

Monitor server logs for issues:

```bash
# Search for errors in logs
grep -i error /var/log/certus-server.log

# Monitor FDA API errors
grep "FDA API" /var/log/certus-server.log | grep -i error

# Check for rate limiting
grep -i "rate limit" /var/log/certus-server.log
```

### Performance Monitoring

Track performance metrics:

```bash
# Response time monitoring
while true; do
  echo "$(date): $(curl -o /dev/null -s -w '%{time_total}' https://your-server.com/health)s" | tee -a response_times.log
  sleep 60
done

# Memory usage tracking (for containers)
docker stats certus-server --no-stream >> memory_usage.log
```

## Troubleshooting Test Failures

### Common Test Issues

**Connection timeouts:**

- Check server is running: `curl https://your-server.com/health`
- Verify network connectivity
- Check firewall settings

**Tool count mismatch:**

- Verify all 8 tools are properly loaded
- Check server logs for startup errors
- Validate tool definitions in code

**MCP protocol errors:**

- Use MCP inspector for detailed diagnostics
- Check JSON-RPC 2.0 compliance
- Verify request/response format

**FDA API errors:**

- Check FDA API status: <https://open.fda.gov/apis/status/>
- Verify API key configuration
- Monitor rate limiting

For detailed troubleshooting steps, see the [Troubleshooting Guide](troubleshooting-guide.md).
