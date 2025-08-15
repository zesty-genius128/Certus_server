# Troubleshooting Guide

Common issues and solutions for Certus MCP Server.

## Claude Desktop Connection Issues

**Problem:** Tools don't appear in Claude Desktop

**Solutions:**

1. **Restart Claude Desktop completely:**
   ```bash
   # Kill all Claude processes
   pkill -f "Claude"
   # Restart Claude Desktop
   ```

2. **Check configuration file:**
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

3. **Verify server is running:**
   ```bash
   curl http://localhost:3000/health
   ```

4. **Test MCP connection:**
   ```bash
   npx @modelcontextprotocol/inspector http://localhost:3000/mcp
   ```

## Server Startup Issues

**Problem:** Server won't start

**Solutions:**

1. **Port already in use:**
   ```bash
   # Check what's using the port
   lsof -i :3000
   
   # Use different port
   PORT=3001 npm start
   ```

2. **Missing dependencies:**
   ```bash
   npm install
   ```

3. **Permission errors:**
   ```bash
   # Don't use port 443 without root
   PORT=3000 npm start
   ```

## API Issues

**Problem:** Getting HTTP 429 (Too Many Requests)

**Solutions:**

1. **Rate limiting - wait or restart:**
   ```bash
   # Check current usage
   curl http://localhost:3000/usage-stats
   
   # Restart server to reset limits
   npm start
   ```

2. **Get FDA API key:**
   - Visit: https://open.fda.gov/apis/authentication/
   - Add to .env file: `OPENFDA_API_KEY=your_key`

**Problem:** No results for drug searches

**Solutions:**

1. **Try different drug names:**
   ```bash
   # Try generic name instead of brand name
   # Try common spellings
   ```

2. **Check API health:**
   ```bash
   curl http://localhost:3000/health | jq .api_health
   ```

## Docker Issues

**Problem:** Docker container won't start

**Solutions:**

1. **Port conflicts:**
   ```bash
   # Use different host port
   docker run -p 3001:443 ghcr.io/zesty-genius128/certus_server:latest
   ```

2. **Check container logs:**
   ```bash
   docker logs certus-server
   ```

3. **Container not found:**
   ```bash
   # Pull latest image
   docker pull ghcr.io/zesty-genius128/certus_server:latest
   ```

## Configuration Issues

**Problem:** Environment variables not working

**Solutions:**

1. **Check .env file location:**
   ```bash
   # Should be in project root
   ls -la .env
   ```

2. **Verify .env format:**
   ```bash
   # No spaces around =
   OPENFDA_API_KEY=your_key
   PORT=3000
   ```

3. **Test environment loading:**
   ```bash
   node -e "console.log(process.env.OPENFDA_API_KEY)"
   ```

## Testing Issues

**Problem:** Tests failing

**Solutions:**

1. **Server not running:**
   ```bash
   npm start
   # Then in another terminal:
   npm test
   ```

2. **Wrong server URL:**
   ```bash
   TEST_SERVER_URL=http://localhost:3000 npm test
   ```

3. **Rate limiting:**
   ```bash
   # Wait 30 minutes or restart server
   ```

## Getting Help

If you're still having issues:

1. **Check server health:**
   ```bash
   curl http://localhost:3000/health
   ```

2. **Test with MCP inspector:**
   ```bash
   npx @modelcontextprotocol/inspector http://localhost:3000/mcp
   ```

3. **Check logs for errors:**
   ```bash
   # For npm start
   # Look for error messages in console output
   
   # For Docker
   docker logs certus-server
   ```