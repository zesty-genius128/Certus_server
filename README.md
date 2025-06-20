# Certus Remote Server

A production-ready Model Context Protocol (MCP) server that provides real-time FDA drug shortage information. This server enables AI assistants and other MCP clients to search for current drug shortages using official FDA data.

## Quick Start - Add to Claude Desktop

### Step 1: Add to Claude Desktop Config

Add this configuration to your Claude Desktop config file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

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

### Step 2: Restart Claude Desktop

Close and reopen Claude Desktop completely. The drug shortage tool should now be available.

### Step 3: Test the Integration

In Claude Desktop, try asking:

- "Check for insulin shortages"
- "Are there any current shortages for amoxicillin?"
- "Search for morphine drug shortages"

## Deploy Your Own Server

### Prerequisites

- Node.js 18+
- Railway account (free)
- Git

### Step 1: Clone and Setup

```bash
git clone https://github.com/yourusername/certus-server.git
cd certus-server
npm install
```

### Step 2: Test Locally (Optional)

```bash
# Start the server
npm start

# Test in another terminal
curl http://localhost:3000/health
```

### Step 3: Deploy to Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize project
railway init

# Deploy
railway up

# Get your URL
railway domain
```

### Step 4: Update Claude Config

Replace the URL in your Claude config with your new Railway URL:

```json
{
  "mcpServers": {
    "Certus": {
      "command": "npx",
      "args": ["mcp-remote", "https://your-app-name.up.railway.app/mcp"]
    }
  }
}
```

## Available Tool

### `search_drug_shortages`

Search for current drug shortages using FDA data.

**Parameters:**

- `drug_name` (string, required): Name of the drug (generic or brand name)
- `limit` (integer, optional): Maximum results to return (1-50, default: 10)

**Example Usage in Claude:**

```text
"Check for current shortages of insulin with a limit of 5 results"
```

## Configuration

### Environment Variables (Optional ***Read Note***)

Create a `.env` file for better API rate limits:

```bash
OPENFDA_API_KEY=your_fda_api_key_here
```

Get a free API key at: <https://open.fda.gov/apis/authentication/>

- ***Note: This is not necessary unless you run into significant rate limits.***

### Rate Limits

- Without API Key: 1,000 requests/day
- With API Key: 120,000 requests/day

## Testing

### Test with MCP Inspector

```bash
npx @modelcontextprotocol/inspector https://certus-server-production.up.railway.app/mcp
```

### Test with Direct API Call

```bash
curl -X POST https://certus-server-production.up.railway.app/mcp \
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

## Project Structure

```text
certus-server/
├── official-mcp-server.js    # Main MCP server
├── openfda-client.js         # FDA API integration
├── stdio-wrapper.js          # Local testing support
├── package.json              # Dependencies
└── README.md                 # Documentation
```

## API Endpoints

| Endpoint   | Method | Description               |
|------------|--------|---------------------------|
| `/health`  | GET    | Server health check       |
| `/mcp`     | POST   | MCP JSON-RPC endpoint     |
| `/mcp`     | GET    | MCP SSE endpoint          |

## Troubleshooting

### Common Issues

1. **Tool not appearing in Claude**: Restart Claude Desktop completely
2. **Connection errors**: Check server status at `/health` endpoint
3. **No results found**: Try different drug name variations
4. **Rate limits**: Add an OpenFDA API key to your environment

### Debug Commands

```bash
# Check server status
curl https://your-app-name.up.railway.app/health

# View Railway logs
railway logs

# Test MCP connection
npx @modelcontextprotocol/inspector https://your-app-name.up.railway.app/mcp
```

## Use Cases

- Healthcare applications checking drug availability
- Pharmacy management systems monitoring supply chains
- Clinical decision support alerting to shortages
- AI assistants providing drug shortage information

## Resources

- [Model Context Protocol Documentation](https://github.com/modelcontextprotocol/specification)
- [OpenFDA API Documentation](https://open.fda.gov/apis/)
- [Railway Deployment Guide](https://docs.railway.app/)

## License

MIT License

---

**Live Server**: <https://certus-server-production.up.railway.app/mcp>  
**Status**: Production Ready  
**Protocol**: MCP 2024-11-05  
**Data Source**: FDA Drug Shortages Database
