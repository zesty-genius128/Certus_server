# Troubleshooting Guide

Comprehensive troubleshooting guide for Certus MCP Server issues.

## Common Issues and Solutions

### Tool Not Appearing in Claude

**Symptoms:**

- Certus tools don't show up in Claude Desktop
- Claude doesn't recognize the MCP server

**Solutions:**

1. **Complete Claude Desktop restart:**

   ```bash
   # Kill all Claude processes
   pkill -f "Claude"
   # Restart Claude Desktop
   open -a "Claude Desktop"  # macOS
   # Or launch from Start menu on Windows
   ```

2. **Check configuration file syntax:**

   ```json
   {
     "mcpServers": {
       "Certus": {
         "command": "npx",
         "args": ["mcp-remote", "https://certus.opensource.mieweb.org/mcp"]
       }
     }
   }
   ```

3. **Verify server URL works:**

   ```bash
   curl https://certus.opensource.mieweb.org/health
   npx @modelcontextprotocol/inspector https://certus.opensource.mieweb.org/mcp
   ```

4. **Check Claude Desktop logs:**
   - **macOS**: `~/Library/Logs/Claude Desktop/`
   - **Windows**: `%APPDATA%\Claude\logs\`

5. **Configuration file locations:**
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

### Connection Errors

**Symptoms:**

- "Failed to connect to server" errors
- Timeout errors when calling tools
- Intermittent connection issues

**Solutions:**

1. **Test server health:**

   ```bash
   # Test main server
   curl https://certus.opensource.mieweb.org/health
   
   # Test backup server if main is down
   curl https://certus-server-production.up.railway.app/health
   ```

2. **Check network connectivity:**

   ```bash
   # Test DNS resolution
   nslookup certus.opensource.mieweb.org
   
   # Test port access
   telnet certus.opensource.mieweb.org 443
   
   # Check firewall rules
   # On Windows: Windows Defender Firewall
   # On macOS: System Preferences > Security & Privacy > Firewall
   ```

3. **Switch to backup server:**

   ```json
   {
     "mcpServers": {
       "Certus": {
         "command": "npx",
         "args": ["mcp-remote", "https://certus-server-production.up.railway.app/mcp"]
       }
     }
   }
   ```

4. **Corporate firewall issues:**
   - Check with IT about HTTPS access to external servers
   - Request whitelisting for `*.opensource.mieweb.org` and `*.railway.app`
   - Consider using internal deployment

### No Results Found

**Symptoms:**

- Tools execute but return "No results found"
- FDA database queries return empty responses
- Specific drugs not found

**Solutions:**

1. **Try different drug name variations:**

   ```bash
   # Generic vs brand names
   "metformin" instead of "Glucophage"
   "acetaminophen" instead of "Tylenol"
   "ibuprofen" instead of "Advil"
   ```

2. **Check spelling and formatting:**
   - Remove extra spaces: "insulin " → "insulin"
   - Use standard drug names from FDA databases
   - Avoid abbreviations: "ASA" → "aspirin"

3. **Verify drug exists in FDA database:**

   ```bash
   # Test directly against FDA API
   curl "https://api.fda.gov/drug/label.json?search=openfda.generic_name:insulin&limit=1"
   ```

4. **Use batch search to find variations:**
   - Try: "Search for metformin, Glucophage, and metformin hydrochloride"
   - Use the batch analysis tool with multiple name variations

### Rate Limit Issues

**Symptoms:**

- "Rate limit exceeded" errors
- Slow or failed requests during heavy usage
- HTTP 429 responses

**Solutions:**

1. **Add FDA API key:**

   ```bash
   # For your own deployment
   export OPENFDA_API_KEY=your_fda_api_key_here
   # Restart server
   ```

   Get free API key: <https://open.fda.gov/apis/authentication/>

2. **Reduce request frequency:**
   - Wait between requests
   - Use batch operations for multiple drugs
   - Avoid rapid successive queries

3. **Use batch operations:**

   ```bash
   # Instead of 5 separate requests, use batch analysis
   "Analyze these drugs: insulin, metformin, lisinopril, aspirin, atorvastatin"
   ```

4. **Monitor rate limits:**

   ```bash
   # Check current usage (if you have API key)
   curl -H "X-API-Key: your_key" "https://api.fda.gov/drug/label.json?limit=1"
   # Check response headers for rate limit info
   ```

### MCP Protocol Errors

**Symptoms:**

- JSON-RPC errors
- Protocol version mismatches
- Invalid request/response format

**Solutions:**

1. **Test with MCP Inspector:**

   ```bash
   npx @modelcontextprotocol/inspector https://certus.opensource.mieweb.org/mcp
   ```

2. **Verify MCP client compatibility:**
   - Update to latest Claude Desktop version
   - Check MCP client supports HTTP transport
   - Ensure JSON-RPC 2.0 compliance

3. **Test raw JSON-RPC:**

   ```bash
   curl -X POST https://certus.opensource.mieweb.org/mcp \
     -H "Content-Type: application/json" \
     -d '{
       "jsonrpc": "2.0",
       "id": 1,
       "method": "tools/list",
       "params": {}
     }'
   ```

## Advanced Troubleshooting

### Debug Commands

#### Server Status and Capabilities

```bash
# Check server health and uptime
curl -s https://certus.opensource.mieweb.org/health | jq

# List all available tools
curl -s https://certus.opensource.mieweb.org/tools | jq '.tools[].name'

# Get detailed tool schemas
curl -s https://certus.opensource.mieweb.org/tools | jq '.tools[] | {name, description}'
```

#### Cache Performance Analysis

```bash
# Check cache statistics
curl -s https://certus.opensource.mieweb.org/cache-stats | jq

# Monitor cache in real-time
watch -n 10 'curl -s https://certus.opensource.mieweb.org/cache-stats | jq'

# Manual cache cleanup if needed
curl -X POST https://certus.opensource.mieweb.org/cache-cleanup
```

#### FDA API Direct Testing

```bash
# Test FDA drug labels API
curl "https://api.fda.gov/drug/label.json?search=openfda.generic_name:metformin&limit=1"

# Test FDA drug shortages API  
curl "https://api.fda.gov/drug/shortages.json?search=openfda.generic_name:insulin&limit=1"

# Test FDA enforcement API
curl "https://api.fda.gov/drug/enforcement.json?search=openfda.generic_name:acetaminophen&limit=1"

# Check FDA API status
curl "https://api.fda.gov/healthcheck"
```

#### Network and Connectivity Diagnostics

```bash
# DNS resolution test
dig certus.opensource.mieweb.org
nslookup certus.opensource.mieweb.org 8.8.8.8

# SSL certificate check
openssl s_client -connect certus.opensource.mieweb.org:443 -servername certus.opensource.mieweb.org

# Trace route to server
traceroute certus.opensource.mieweb.org

# Check HTTP headers
curl -I https://certus.opensource.mieweb.org/health
```

### Performance Issues

#### Slow Response Times

**Symptoms:**

- Requests take longer than 10 seconds
- Timeouts in Claude Desktop
- Poor user experience

**Diagnosis:**

```bash
# Measure response times
time curl -s https://certus.opensource.mieweb.org/health

# Test specific tool performance
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

**Solutions:**

1. **Check cache hit rates:**

   ```bash
   curl -s https://certus.opensource.mieweb.org/cache-stats | jq '.cache'
   ```

2. **Monitor FDA API latency:**

   ```bash
   time curl "https://api.fda.gov/drug/label.json?search=openfda.generic_name:metformin&limit=1"
   ```

3. **Consider adding API key:**
   - FDA API key provides higher rate limits
   - Reduces chance of throttling

4. **Use smaller result limits:**
   - Default limits are reasonable (5-10 results)
   - Avoid requesting large datasets

#### Memory Usage Issues

**Symptoms:**

- Server becomes unresponsive
- High memory usage alerts
- Cache growing too large

**Diagnosis:**

```bash
# Check cache statistics
curl -s https://certus.opensource.mieweb.org/cache-stats | jq '.cache.memoryUsageApprox'

# Monitor memory usage over time
while true; do
  echo "$(date): $(curl -s https://certus.opensource.mieweb.org/cache-stats | jq -r '.cache.memoryUsageApprox') bytes"
  sleep 300
done
```

**Solutions:**

1. **Manual cache cleanup:**

   ```bash
   curl -X POST https://certus.opensource.mieweb.org/cache-cleanup
   ```

2. **Monitor cache growth patterns:**
   - Check which data types are cached most
   - Verify automatic cleanup is working

3. **For your own deployment:**
   - Adjust cache TTL values if needed
   - Increase container memory limits
   - Monitor application logs for memory leaks

### SSL/Certificate Issues

**Symptoms:**

- SSL certificate errors
- "Insecure connection" warnings
- HTTPS handshake failures

**Diagnosis:**

```bash
# Check certificate details
openssl s_client -connect certus.opensource.mieweb.org:443 -servername certus.opensource.mieweb.org 2>/dev/null | openssl x509 -noout -dates

# Test certificate chain
curl -v https://certus.opensource.mieweb.org/health 2>&1 | grep -i certificate

# Check certificate with online tools
# https://www.ssllabs.com/ssltest/analyze.html?d=certus.opensource.mieweb.org
```

**Solutions:**

1. **For development/testing (HTTP only):**

   ```json
   {
     "mcpServers": {
       "Certus": {
         "command": "npx",
         "args": ["mcp-remote", "http://localhost:3000/mcp", "--allow-http"]
       }
     }
   }
   ```

2. **Update system certificates:**

   ```bash
   # macOS
   brew install ca-certificates
   
   # Ubuntu/Debian
   sudo apt-get update && sudo apt-get install ca-certificates
   ```

3. **Corporate certificate issues:**
   - Check with IT about corporate proxy certificates
   - May need to import corporate root certificates

### Deployment-Specific Issues

#### Docker Container Issues

**Symptoms:**

- Container won't start
- Container exits immediately
- Port binding errors

**Diagnosis:**

```bash
# Check container status
docker ps -a

# View container logs
docker logs certus-server

# Check port usage
sudo lsof -i :443
```

**Solutions:**

1. **Port already in use:**

   ```bash
   # Use different port
   docker run -d -p 3000:443 --name certus-server ghcr.io/zesty-genius128/certus_server:latest
   ```

2. **Permission denied on port 443:**

   ```bash
   # Use unprivileged port
   docker run -d -p 8443:443 --name certus-server ghcr.io/zesty-genius128/certus_server:latest
   ```

3. **Container resource limits:**

   ```bash
   # Increase memory limit
   docker run -d -p 443:443 --memory 1g --name certus-server ghcr.io/zesty-genius128/certus_server:latest
   ```

#### Self-Hosted Deployment Issues

**Symptoms:**

- Server won't start
- Process exits unexpectedly
- Permission errors

**Diagnosis:**

```bash
# Check server logs
journalctl -u certus-server -f

# Check process status
systemctl status certus-server

# Test manual start
cd /opt/certus-server && node official-mcp-server.js
```

**Solutions:**

1. **Permission issues:**

   ```bash
   # Fix file ownership
   sudo chown -R node:node /opt/certus-server
   
   # Fix service user
   sudo systemctl edit certus-server
   # Add: [Service]
   #      User=node
   ```

2. **Node.js path issues:**

   ```bash
   # Update service file with full path
   ExecStart=/usr/bin/node /opt/certus-server/official-mcp-server.js
   ```

3. **Port binding issues:**

   ```bash
   # Allow non-root user to bind to port 443
   sudo setcap CAP_NET_BIND_SERVICE=+eip /usr/bin/node
   
   # Or use reverse proxy (recommended)
   # See deployment guide for Nginx configuration
   ```

## Error Message Reference

### Common Error Messages and Solutions

#### "Connection refused"

```
Error: connect ECONNREFUSED 127.0.0.1:443
```

**Solution:** Server is not running. Check deployment status and start server.

#### "Tool not found"

```
Tool 'search_drug_shortages' not found
```

**Solution:** Server may not be fully initialized. Wait 30 seconds and retry, or check server logs.

#### "Rate limit exceeded"

```
HTTP 429: Too Many Requests
```

**Solution:** Add FDA API key or reduce request frequency. Wait before retrying.

#### "Invalid JSON-RPC request"

```
Invalid request format
```

**Solution:** Ensure MCP client is sending proper JSON-RPC 2.0 formatted requests.

#### "SSL handshake failed"

```
SSL routines:ssl3_get_server_certificate:certificate verify failed
```

**Solution:** Check SSL certificate validity or use HTTP for development testing.

## Getting Help

### Log Collection

When reporting issues, collect these logs:

1. **Server health check:**

   ```bash
   curl -s https://certus.opensource.mieweb.org/health | jq > health_check.json
   ```

2. **MCP inspector results:**

   ```bash
   npx @modelcontextprotocol/inspector https://certus.opensource.mieweb.org/mcp > mcp_inspector.txt 2>&1
   ```

3. **Tool availability:**

   ```bash
   curl -s https://certus.opensource.mieweb.org/tools | jq > tools_list.json
   ```

4. **Cache statistics:**

   ```bash
   curl -s https://certus.opensource.mieweb.org/cache-stats | jq > cache_stats.json
   ```

### Issue Reporting

When reporting issues, include:

1. **Environment details:**
   - Operating system and version
   - MCP client (Claude Desktop version, etc.)
   - Network configuration (corporate, home, etc.)

2. **Configuration:**
   - MCP client configuration (sanitized)
   - Any custom deployment details

3. **Reproduction steps:**
   - Exact steps to reproduce the issue
   - Expected vs actual behavior
   - Frequency (always, intermittent, etc.)

4. **Logs and diagnostics:**
   - Attach log files collected above
   - Any error messages or screenshots

### Contact Information

- **GitHub Issues**: <https://github.com/zesty-genius128/Certus_server/issues>
- **Documentation**: Check README.md and other guides in docs/ folder
- **Server Status**: Monitor <https://certus.opensource.mieweb.org/health>

## Preventive Maintenance

### Regular Health Checks

Set up monitoring for proactive issue detection:

```bash
#!/bin/bash
# Health check script - run every 5 minutes via cron

HEALTH_URL="https://certus.opensource.mieweb.org/health"
RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null "$HEALTH_URL")

if [ "$RESPONSE" != "200" ]; then
    echo "$(date): Health check failed - HTTP $RESPONSE" | tee -a /var/log/certus-monitor.log
    # Add alerting here (email, Slack, etc.)
fi
```

### Performance Monitoring

Track key metrics over time:

```bash
#!/bin/bash
# Performance monitoring script

echo "$(date),$(curl -o /dev/null -s -w '%{time_total}' https://certus.opensource.mieweb.org/health)" >> response_times.csv

CACHE_SIZE=$(curl -s https://certus.opensource.mieweb.org/cache-stats | jq '.cache.totalEntries')
echo "$(date),cache_entries,$CACHE_SIZE" >> metrics.csv
```

### Update Procedures

Keep your deployment current:

1. **Monitor for updates:**
   - Watch GitHub repository for releases
   - Subscribe to security advisories

2. **Test updates:**
   - Deploy to staging environment first
   - Run comprehensive test suite
   - Verify health checks pass

3. **Rollback plan:**
   - Keep previous working version
   - Document rollback procedures
   - Test rollback in staging

For deployment-specific update procedures, see the [Deployment Guide](deployment-guide.md).
