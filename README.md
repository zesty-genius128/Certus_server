# Certus Drug Information MCP Server

A comprehensive Model Context Protocol (MCP) server providing real-time FDA drug information including shortages, recalls, labels, and market analysis. This server enables AI assistants and other MCP clients to access comprehensive pharmaceutical data using official FDA sources.

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
      "args": ["mcp-remote", "http://certus.opensource.mieweb.com:80/mcp", "--allow-http"]
    }
  }
}
```

> **Note:** The `--allow-http` flag is only required if you are using an `http` URL. If your server URL starts with `https`, you do not need to include this flag.

#### Alternative Configuration (Backup Server)
If the main server is unavailable, use the Railway backup:

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
Close and reopen Claude Desktop completely. The drug information tools should now be available.

### Step 3: Test the Integration
In Claude Desktop, try asking:

- "Check for insulin shortages"
- "Get complete medication profile for metformin"
- "Search for drug recalls involving acetaminophen"
- "Analyze market trends for lisinopril"
- "Find alternatives for drugs in shortage"

## Available Tools

### Core Drug Information Tools

#### `search_drug_shortages`
Search for current drug shortages using FDA data with intelligent matching.

**Parameters:**
- `drug_name` (string, required): Name of the drug (generic or brand name)
- `limit` (integer, optional): Maximum results to return (1-50, default: 10)

#### `get_medication_profile`
Get complete drug information including FDA label data and shortage status.

**Parameters:**
- `drug_identifier` (string, required): Drug name or identifier
- `identifier_type` (string, optional): Type of identifier (default: "openfda.generic_name")

#### `search_drug_recalls`
Search for drug recalls using FDA enforcement database.

**Parameters:**
- `drug_name` (string, required): Drug name to search for recalls
- `limit` (integer, optional): Maximum results (1-50, default: 10)

#### `get_drug_label_info`
Get FDA label information for a specific drug.

**Parameters:**
- `drug_identifier` (string, required): Drug identifier
- `identifier_type` (string, optional): Type of identifier (default: "openfda.generic_name")

### Advanced Analysis Tools

#### `analyze_drug_market_trends`
Analyze drug shortage patterns and market trends over time.

**Parameters:**
- `drug_name` (string, required): Drug name to analyze
- `months_back` (integer, optional): Analysis period in months (1-60, default: 12)

#### `batch_drug_analysis`
Analyze multiple drugs simultaneously for shortages, recalls, and risk assessment.

**Parameters:**
- `drug_list` (array, required): List of drug names (max 25 drugs)
- `include_trends` (boolean, optional): Include trend analysis (default: false)

## Example Usage in Claude

```
Get a complete medication profile for insulin including any current shortages

Analyze market trends for metformin over the past 6 months

Search for any recalls involving blood pressure medications

Perform batch analysis on these drugs: insulin, metformin, lisinopril, aspirin

Check shortage status and find alternatives for morphine
```

## Server Infrastructure

### Primary Deployment (Proxmox)
- **Main Server:** http://certus.opensource.mieweb.com:80/mcp
- **Status Check:** http://certus.opensource.mieweb.com:80/health
- **Host:** Self-hosted Proxmox infrastructure

### Backup Deployment (Railway)
- **Backup Server:** https://certus-server-production.up.railway.app/mcp
- **Status Check:** https://certus-server-production.up.railway.app/health
- **Host:** Railway cloud platform

## Deploy Your Own Server

### Prerequisites
- Node.js 18+
- Railway account (free) or your own hosting
- Git

### Step 1: Clone and Setup

```bash
git clone https://github.com/zesty-genius128/Certus_server.git
cd Certus_server
npm install
```

### Step 2: Test Locally

```bash
# Start the server
npm start

# Test in another terminal
curl http://localhost:3000/health

# Test drug search
curl -X POST http://localhost:3000/mcp \
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

### Step 3: Deploy to Railway (Backup Option)

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

### Step 4: Deploy to Your Own Infrastructure
For Proxmox or other self-hosted environments:

```bash
# Copy files to your server
scp -r . user@your-server:/path/to/certus-server/

# On your server
cd /path/to/certus-server
npm install
npm start

# For production with PM2
npm install -g pm2
pm2 start official-mcp-server.js --name certus-server
pm2 save
pm2 startup
```

### Step 5: Update Claude Config
Replace the URL in your Claude config with your deployed URL:

```json
{
  "mcpServers": {
    "Certus": {
      "command": "npx",
      "args": ["mcp-remote", "http://your-server.com:3000/mcp", "--allow-http"]
    }
  }
}
```

> **Note:** The `--allow-http` flag is only required if you are using an `http` URL. If your server URL starts with `https`, you do not need to include this flag.

## Configuration

### Environment Variables (Optional)
Create a `.env` file for enhanced API performance:

```bash
OPENFDA_API_KEY=your_fda_api_key_here
PORT=3000
```

Get a free FDA API key at: <https://open.fda.gov/apis/authentication/>

### Rate Limits
- Without API Key: 1,000 requests/day
- With API Key: 120,000 requests/day
- Intelligent Caching: Reduces API calls through smart result caching

## Testing and Debugging

### Test with MCP Inspector

```bash
# Test main server
npx @modelcontextprotocol/inspector http://certus.opensource.mieweb.com:80/mcp

# Test backup server
npx @modelcontextprotocol/inspector https://certus-server-production.up.railway.app/mcp

# Test local development
npx @modelcontextprotocol/inspector http://localhost:3000/mcp
```

### Health Check Commands

```bash
# Check main server status
curl http://certus.opensource.mieweb.com:80/health

# Check backup server status  
curl https://certus-server-production.up.railway.app/health

# Get available tools
curl http://certus.opensource.mieweb.com:80/tools
```

### Direct API Testing

```bash
# Test drug shortage search
curl -X POST http://certus.opensource.mieweb.com:80/mcp \
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

# Test medication profile
curl -X POST http://certus.opensource.mieweb.com:80/mcp \
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

## Project Structure

```
Certus_server/
├── official-mcp-server.js    # Main MCP server implementation
├── openfda-client.js         # FDA API integration and data processing
├── stdio-wrapper.js          # Local development and testing support
├── package.json              # Dependencies and scripts
├── claude_desktop_config.json # Example Claude configuration
└── README.md                 # This documentation
```

## API Endpoints

| Endpoint   | Method | Description                              |
|------------|--------|------------------------------------------|
| `/health`  | GET    | Server health check and status           |
| `/mcp`     | POST   | MCP JSON-RPC endpoint for tool calls     |
| `/mcp`     | GET    | MCP SSE endpoint for real-time connections |
| `/tools`   | GET    | List all available tools and schemas     |
| `/`        | GET    | Server information and documentation     |

## Advanced Features

### Intelligent Drug Matching
- Handles misspellings and variations automatically
- Supports both generic and brand name searches
- Provides relevance scoring for search results

### Comprehensive Data Integration
- FDA Drug Shortages Database: Real-time shortage information
- FDA Drug Labels Database: Complete prescribing information
- FDA Enforcement Database: Drug recall and safety information

### Market Intelligence
- Historical shortage pattern analysis
- Risk assessment and forecasting
- Alternative drug suggestions during shortages

### Batch Processing
- Analyze up to 25 drugs simultaneously
- Formulary-wide risk assessment
- Bulk shortage monitoring

## Troubleshooting

### Common Issues
- **Tool not appearing in Claude:**
  - Restart Claude Desktop completely
  - Verify config file syntax is correct
  - Check that the server URL is accessible
- **Connection errors:**
  - Test server health: `curl http://certus.opensource.mieweb.com:80/health`
  - Try backup server if main is down
  - Check firewall/network connectivity
- **No results found:**
  - Try different drug name variations (generic vs brand)
  - Check spelling of drug names
  - Verify drug exists in FDA database
- **Rate limit issues:**
  - Add OpenFDA API key to environment variables
  - Reduce request frequency
  - Use batch operations for multiple drugs

### Debug Commands

```bash
# Check server status and capabilities
curl http://certus.opensource.mieweb.com:80/health

# View available tools
curl http://certus.opensource.mieweb.com:80/tools

# Test specific tool functionality
npm run test

# MCP protocol testing
npx @modelcontextprotocol/inspector http://certus.opensource.mieweb.com:80/mcp
```

## Use Cases

### Healthcare Applications
- Clinical decision support systems
- Electronic health record integration
- Pharmacy management systems
- Drug safety monitoring

### AI Assistant Integration
- Real-time drug information queries
- Medication counseling support
- Healthcare chatbot enhancement
- Clinical workflow automation

### Research and Analytics
- Pharmaceutical market analysis
- Drug shortage trend research
- Supply chain risk assessment
- Regulatory compliance monitoring

## Technical Specifications
- **Protocol:** Model Context Protocol (MCP) 2024-11-05
- **Data Sources:** FDA openFDA APIs
- **Node.js:** 18+ required
- **Dependencies:** Express, CORS, Helmet, Compression
- **Response Format:** JSON-RPC 2.0
- **Rate Limiting:** Built-in intelligent throttling

## Resources
- [Model Context Protocol Documentation](https://github.com/modelcontextprotocol/specification)
- [OpenFDA API Documentation](https://open.fda.gov/apis/)
- [Certus Server Repository](https://github.com/zesty-genius128/Certus_server)
- [Railway Deployment Guide](https://docs.railway.app/)

## License

MIT License

---

**Primary Server:** <http://certus.opensource.mieweb.com:80/mcp>  
**Backup Server:** <https://certus-server-production.up.railway.app/mcp>  
**Status:** Production Ready  
**Protocol:** MCP 2024-11-05  
**Data Sources:** FDA Drug Shortages, Labels, and Enforcement Databases
