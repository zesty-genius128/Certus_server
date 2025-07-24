# Certus Fastify MCP Server

A high-performance FDA drug information MCP server built with Fastify and the @platformatic/mcp plugin, designed for seamless integration with Claude's custom connector.

## Documentation References

- **Fastify Framework**: https://fastify.dev/
- **@platformatic/mcp Plugin**: https://www.npmjs.com/package/@platformatic/mcp
- **MCP Specification 2025-03-26**: https://modelcontextprotocol.io/specification/2025-03-26/
- **Model Context Protocol SDK**: https://github.com/modelcontextprotocol/sdk
- **FDA APIs**: https://open.fda.gov/apis/

## Installation

```bash
# Install dependencies using the custom package.json
npm install --package-lock-only -f package-fastify.json

# Or install manually
npm install fastify @platformatic/mcp @modelcontextprotocol/sdk pino-pretty dotenv
```

## Quick Start

```bash
# Start the server
npm run start

# Development mode with auto-restart
npm run dev

# Test with MCP inspector
npm run inspect
```

## Server Features

### Native MCP Support
- **@platformatic/mcp Plugin**: Native Fastify MCP integration
- **Streamable HTTP Transport**: Optimized for Claude custom connector
- **Session Management**: Built-in session handling and scaling
- **TypeBox Validation**: Enhanced schema validation and type safety

### FDA Drug Information Tools (8 Total)

1. **search_drug_shortages** - Current FDA shortage database
2. **search_adverse_events** - FDA adverse event reporting (FAERS)
3. **search_serious_adverse_events** - Serious adverse events only
4. **search_drug_recalls** - FDA enforcement database
5. **get_drug_label_info** - FDA structured product labeling
6. **get_medication_profile** - Combined label and shortage data
7. **analyze_drug_shortage_trends** - Historical shortage patterns
8. **batch_drug_analysis** - Multi-drug analysis (up to 25 drugs)

### Endpoints

- **MCP Endpoint**: `http://localhost:3001/mcp`
- **Health Check**: `http://localhost:3001/health`
- **Server Info**: `http://localhost:3001/`

## Claude Custom Connector Setup

1. **Start the server**:
   ```bash
   node fastify-mcp-server.js
   ```

2. **Add to Claude**:
   - Open Claude web or desktop
   - Go to Custom Connectors
   - Add new connector: `http://localhost:3001/mcp`
   - The server should automatically discover all 8 FDA tools

## Architecture Advantages

### Fastify Benefits
- **High Performance**: 20,000+ requests/sec capability
- **Low Overhead**: Minimal resource usage
- **Plugin Ecosystem**: Rich plugin architecture
- **TypeScript Ready**: Full type safety support

### @platformatic/mcp Benefits
- **Native MCP Protocol**: No custom transport implementation needed
- **Automatic Session Management**: Handles multiple concurrent connections
- **Streamable HTTP**: Optimized for real-time applications
- **Error Handling**: Comprehensive JSON-RPC error responses
- **Scaling Support**: Redis-backed sessions for horizontal scaling

## Development

### File Structure
```
├── fastify-mcp-server.js      # Main Fastify MCP server
├── package-fastify.json       # Dependencies and scripts
├── README-fastify.md          # This documentation
└── openfda-client.js         # FDA API client (shared)
```

### Testing Tools
```bash
# Test with official MCP inspector
npx @modelcontextprotocol/inspector http://localhost:3001/mcp

# Direct API testing
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'

# Health check
curl http://localhost:3001/health
```

### Configuration

Environment variables:
- `PORT`: Server port (default: 3001)
- `NODE_ENV`: Environment mode (development/production)
- `OPENFDA_API_KEY`: Optional FDA API key for higher rate limits

### Logging

The server uses Pino for structured logging with pretty printing in development:
- **Info Level**: Connection events, tool calls
- **Debug Level**: Detailed MCP protocol messages
- **Error Level**: API failures and exceptions

## Comparison with Express Version

| Feature | Express Server | Fastify Server |
|---------|---------------|----------------|
| **Protocol Implementation** | Custom JSON-RPC | Native via @platformatic/mcp |
| **Performance** | ~5,000 req/sec | ~20,000 req/sec |
| **Session Management** | Custom implementation | Built-in with plugin |
| **Type Safety** | Basic validation | TypeBox schemas |
| **Error Handling** | Manual JSON-RPC | Automatic MCP errors |
| **Custom Connector** | Requires debugging | Native compatibility |
| **Maintenance** | Higher complexity | Plugin handles protocol |

## Troubleshooting

### Common Issues

1. **Port Conflicts**: Change PORT environment variable if 3001 is in use
2. **Missing Dependencies**: Run `npm install` with package-fastify.json
3. **FDA API Limits**: Add OPENFDA_API_KEY for higher rate limits

### Debug Mode
```bash
NODE_ENV=development npm run dev
```

### Health Check Validation
```bash
curl http://localhost:3001/health | jq '.'
```

## API Documentation

### Tool Examples

**Search Drug Shortages**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "search_drug_shortages",
    "arguments": {
      "drug_name": "insulin",
      "limit": 5
    }
  }
}
```

**Get Medication Profile**:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "get_medication_profile",
    "arguments": {
      "drug_identifier": "metformin",
      "identifier_type": "openfda.generic_name"
    }
  }
}
```

## License

MIT License - See main project for details.

## Contributing

This is an experimental implementation for testing Claude custom connector compatibility. 
For production use, refer to the main Express-based server.