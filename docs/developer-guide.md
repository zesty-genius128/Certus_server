# Developer Contributing Guide

A comprehensive guide for developers who want to contribute to, extend, or understand the Certus OpenFDA MCP Server codebase.

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture Overview](#architecture-overview)
- [Core Components](#core-components)
- [Development Environment](#development-environment)
- [Code Standards](#code-standards)
- [Testing Guide](#testing-guide)
- [Adding New Tools](#adding-new-tools)
- [Deployment Strategies](#deployment-strategies)
- [API Design Patterns](#api-design-patterns)
- [Performance Optimization](#performance-optimization)
- [Security Considerations](#security-considerations)
- [Contributing Workflow](#contributing-workflow)

---

## Quick Start

### Prerequisites

```bash
# Node.js 18+ required
node --version  # Should be >= 18.0.0

# Clone the repository
git clone https://github.com/zesty-genius128/Certus_server.git
cd Certus_server

# Install dependencies
npm install

# Set up environment (optional)
cp .env.example .env
# Add your FDA API key to .env for higher rate limits
```

### Development Commands

```bash
# Start development server with hot reload
npm run dev

# Run comprehensive tests
npm test

# Test specific environments
npm run test:unit:local     # Test against local server
npm run test:unit:production # Test against production

# Test MCP protocol compliance
npm run inspect

# Manual health checks
npm run test:health
npm run test:tools
```

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   MCP Clients   │    │  Transport Layer │    │  Certus Server  │
│                 │    │                  │    │                 │
│ • Claude Desktop│◄──►│ • mcp-remote     │◄──►│ • Express.js    │
│ • LibreChat     │    │ • stdio-wrapper  │    │ • MCP Protocol  │
│ • VS Code       │    │ • HTTP Bridge    │    │ • 8 FDA Tools   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    OpenFDA Client Layer                         │
│                                                                 │
│ • Intelligent Search Strategies                                 │
│ • Medical Safety-First Caching                                 │
│ • Multiple Fallback Methods                                    │
│ • Raw Data Preservation                                        │
└─────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FDA APIs                                   │
│                                                                 │
│ • /drug/shortages.json    • /drug/enforcement.json            │
│ • /drug/label.json        • /drug/event.json (FAERS)          │
└─────────────────────────────────────────────────────────────────┘
```

### Design Philosophy

1. **Hybrid Transport Architecture**: HTTP server with stdio bridge compatibility for universal MCP client support
2. **Medical Safety First**: Never cache safety-critical data (recalls, serious adverse events)
3. **Raw Data Preservation**: Minimal post-processing to maintain FDA data accuracy
4. **Intelligent Fallback**: Multiple search strategies for drug name variations
5. **Production-Ready**: Built-in monitoring, health checks, and graceful error handling

---

## Core Components

### 1. Main Server (`official-mcp-server.js`)

The central Express.js server implementing the MCP 2024-11-05 specification.

**Key Features:**
- JSON-RPC 2.0 endpoint at `/mcp`
- Tool schema discovery at `/tools`
- Health monitoring at `/health`
- Cache management endpoints
- Comprehensive logging system

**Architecture Patterns:**
```javascript
// Single source of truth for tool definitions
const TOOL_DEFINITIONS = [
    {
        name: "search_drug_shortages",
        description: "Search current FDA drug shortages...",
        inputSchema: { /* JSON Schema */ }
    }
    // ... 7 more tools
];

// Centralized tool call handler
async function handleToolCall(name, args) {
    switch (name) {
        case "search_drug_shortages":
            return await searchDrugShortages(args.drug_name, args.limit);
        // ... other tools
    }
}
```

### 2. OpenFDA Client (`openfda-client.js`)

The intelligent API client that handles all FDA database interactions.

**Key Features:**
- Smart caching with medical safety logic
- Multiple search strategies for drug name variations
- Comprehensive error handling with helpful messages
- Raw FDA data preservation
- Performance monitoring and cleanup

**Caching Strategy:**
```javascript
const CACHE_TTL = {
    DRUG_LABELS: 24 * 60,      // 24 hours - static data
    DRUG_SHORTAGES: 30,        // 30 minutes - supply changes rapidly
    DRUG_RECALLS: 12 * 60,     // NOT USED - no caching for safety
    ADVERSE_EVENTS: 60         // 1 hour - balance safety with performance
};
```

**Search Strategy Pattern:**
```javascript
// Multiple search approaches for drug name variations
const searchStrategies = [
    { field: 'openfda.generic_name', value: drugName },
    { field: 'openfda.brand_name', value: drugName },
    { field: 'generic_name', value: drugName },
    { field: 'brand_name', value: drugName }
];
```

### 3. Stdio Wrapper (`stdio-wrapper.js`)

Provides stdio transport compatibility for MCP clients that require local process communication.

**Usage Pattern:**
- Receives JSON-RPC requests via stdin
- Forwards to HTTP server
- Returns responses via stdout
- Essential for LibreChat integration

### 4. Test Suite (`tests/`)

Comprehensive testing infrastructure with multiple test types:

- **Unit Tests** (`unit-tests.js`): Individual tool validation
- **Comprehensive Tests** (`comprehensive-test.js`): End-to-end scenarios
- **Environment Testing**: Local, production, and staging validation
- **MCP Protocol Compliance**: JSON-RPC 2.0 validation

---

## Development Environment

### Local Development Setup

1. **Start the Development Server:**
   ```bash
   npm run dev
   # Server starts on port 443 with hot reload
   # Health check: http://localhost:443/health
   ```

2. **Test MCP Integration:**
   ```bash
   # Test with MCP inspector
   npm run inspect
   
   # Test remote server connectivity
   npm run inspect:remote
   ```

3. **Manual API Testing:**
   ```bash
   # Test health endpoint
   curl http://localhost:443/health
   
   # Test tool availability
   curl http://localhost:443/tools
   
   # Test specific tool
   curl -X POST http://localhost:443/mcp \
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

### Environment Variables

```bash
# .env file configuration
OPENFDA_API_KEY=your_fda_api_key_here  # Optional, for higher rate limits
PORT=443                               # Server port
NODE_ENV=development                   # Environment mode
```

### Docker Development

```bash
# Build development image
docker build -t certus-dev .

# Run with development settings
docker run -p 443:443 -v $(pwd):/app certus-dev npm run dev

# Production-like testing
docker run -p 443:443 certus-dev
```

---

## Code Standards

### Code Organization

```
Certus_server/
├── official-mcp-server.js    # Main server implementation
├── openfda-client.js         # FDA API client and caching
├── stdio-wrapper.js          # Stdio transport bridge
├── package.json              # Dependencies and scripts
├── tests/                    # Test infrastructure
│   ├── unit-tests.js         # Individual tool tests
│   └── comprehensive-test.js # End-to-end scenarios
├── docs/                     # Documentation
└── .github/workflows/        # CI/CD automation
```

### Coding Conventions

**JavaScript Style:**
```javascript
// Use ES6 modules
import express from 'express';
import { searchDrugShortages } from './openfda-client.js';

// Async/await pattern
async function handleToolCall(name, args) {
    try {
        const result = await searchDrugShortages(args.drug_name);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
        throw new Error(`Tool execution failed: ${error.message}`);
    }
}

// Comprehensive logging
const log = {
    server: (msg) => console.log(`[SERVER] INFO: ${msg}`),
    tool: (tool, drug, msg) => console.log(`[TOOL] INFO: ${tool} - drug: "${drug}", ${msg}`),
    error: (component, msg) => console.error(`[${component.toUpperCase()}] ERROR: ${msg}`)
};
```

**Error Handling Pattern:**
```javascript
// Validate inputs first
function validateDrugName(drugName, context = "drug information") {
    if (!drugName || typeof drugName !== 'string' || !drugName.trim()) {
        return {
            error: `Please provide a medication name to search for ${context}`
        };
    }
    return null;
}

// Use validation in tools
async function searchDrugShortages(drugName, limit = 10) {
    const validation = validateDrugName(drugName, "shortages");
    if (validation) return validation;
    
    try {
        // API call logic
    } catch (error) {
        log.error('shortages', `Search failed: ${error.message}`);
        throw error;
    }
}
```

### Documentation Standards

**JSDoc Comments:**
```javascript
/**
 * Search FDA drug shortage database with intelligent fallback strategies
 * @param {string} drugName - Generic or brand name of medication
 * @param {number} limit - Maximum results to return (1-50)
 * @returns {Promise<Object>} Raw FDA API response with shortage data
 * @throws {Error} When API is unavailable or drug name is invalid
 */
async function searchDrugShortages(drugName, limit = 10) {
    // Implementation
}
```

---

## Testing Guide

### Test Architecture

The testing system uses multiple approaches to ensure reliability:

1. **Unit Tests**: Individual tool validation
2. **Integration Tests**: MCP protocol compliance
3. **End-to-End Tests**: Real FDA API interactions
4. **Performance Tests**: Response time monitoring

### Running Tests

```bash
# Run all tests
npm test

# Unit tests only
npm run test:unit

# Test against local development server
npm run test:unit:local

# Test against production server
npm run test:unit:production

# MCP protocol compliance testing
npm run inspect
```

### Test Examples

**Unit Test Pattern:**
```javascript
// tests/unit-tests.js
import { test, describe } from 'node:test';
import assert from 'node:assert';

describe('Drug Shortage Search', () => {
    test('should find insulin shortage data', async () => {
        const response = await callTool('search_drug_shortages', {
            drug_name: 'insulin',
            limit: 5
        });
        
        assert.ok(response.content);
        assert.ok(response.content[0].text);
        
        const data = JSON.parse(response.content[0].text);
        assert.ok(data.results || data.error);
    });
});
```

**Integration Test Pattern:**
```javascript
// Test MCP protocol compliance
describe('MCP Protocol Compliance', () => {
    test('initialize handshake', async () => {
        const response = await mcpRequest('initialize', {
            protocolVersion: "2024-11-05",
            capabilities: {}
        });
        
        assert.equal(response.result.protocolVersion, "2024-11-05");
        assert.ok(response.result.serverInfo);
    });
});
```

### Adding New Tests

1. **Create test function** in appropriate test file
2. **Use descriptive test names** that explain what is being tested
3. **Test both success and failure cases**
4. **Include performance assertions** for response times
5. **Validate FDA data structure** in responses

---

## Adding New Tools

### Tool Development Process

1. **Define the tool** in `TOOL_DEFINITIONS` array
2. **Implement the function** in `openfda-client.js`
3. **Add route handler** in `official-mcp-server.js`
4. **Create tests** for the new tool
5. **Update documentation**

### Example: Adding a New Tool

**Step 1: Tool Definition**
```javascript
// In official-mcp-server.js TOOL_DEFINITIONS array
{
    name: "search_drug_interactions",
    description: "Search for drug interaction data from FDA databases.",
    inputSchema: {
        type: "object",
        properties: {
            drug_name: {
                type: "string",
                description: "Primary drug name"
            },
            interaction_drug: {
                type: "string", 
                description: "Drug to check interactions with"
            },
            limit: {
                type: "integer",
                default: 10,
                minimum: 1,
                maximum: 50
            }
        },
        required: ["drug_name", "interaction_drug"]
    }
}
```

**Step 2: Implementation Function**
```javascript
// In openfda-client.js
/**
 * Search drug interaction data
 * @param {string} drugName - Primary drug name
 * @param {string} interactionDrug - Drug to check interactions with
 * @param {number} limit - Maximum results
 * @returns {Promise<Object>} FDA interaction data
 */
async function searchDrugInteractions(drugName, interactionDrug, limit = 10) {
    // Validation
    const drugValidation = validateDrugName(drugName, "interactions");
    if (drugValidation) return drugValidation;
    
    const interactionValidation = validateDrugName(interactionDrug, "interactions");
    if (interactionValidation) return interactionValidation;
    
    try {
        // Build search query
        const searchQuery = `(drug.generic_name:"${drugName}" OR drug.brand_name:"${drugName}") AND (interaction.generic_name:"${interactionDrug}" OR interaction.brand_name:"${interactionDrug}")`;
        
        const params = buildParams(searchQuery, limit);
        const url = `${ENDPOINTS.DRUG_INTERACTIONS}?${params}`;
        
        const response = await fetch(url, { 
            method: 'GET',
            timeout: 15000 
        });
        
        if (!response.ok) {
            if (response.status === 404) {
                return {
                    results: [],
                    message: "No interaction data found for these drugs"
                };
            }
            throw new Error(`FDA API error: ${response.status}`);
        }
        
        return await response.json();
        
    } catch (error) {
        console.error('Drug interactions search failed:', error);
        return {
            error: 'Failed to search drug interactions',
            message: error.message
        };
    }
}

// Export the function
export { searchDrugInteractions };
```

**Step 3: Route Handler**
```javascript
// In official-mcp-server.js handleToolCall function
case "search_drug_interactions":
    log.tool(name, `${drugName} + ${args.interaction_drug}`, `limit: ${args.limit || 10}`);
    result = await searchDrugInteractions(args.drug_name, args.interaction_drug, args.limit || 10);
    break;
```

**Step 4: Add Tests**
```javascript
// In tests/unit-tests.js
describe('Drug Interactions', () => {
    test('should find interaction data', async () => {
        const response = await callTool('search_drug_interactions', {
            drug_name: 'warfarin',
            interaction_drug: 'aspirin',
            limit: 5
        });
        
        assert.ok(response.content);
        const data = JSON.parse(response.content[0].text);
        assert.ok(data.results || data.error);
    });
});
```

### Tool Development Guidelines

1. **Follow naming convention**: `verb_object_modifier` (e.g., `search_drug_shortages`)
2. **Use consistent parameter names**: `drug_name`, `limit`, `detailed`
3. **Implement input validation** with helpful error messages
4. **Consider caching strategy** based on data criticality
5. **Preserve raw FDA data** structure in responses
6. **Add comprehensive logging** for debugging
7. **Handle 404 responses** gracefully (normal for FDA APIs)

---

## API Design Patterns

### Search Strategy Pattern

The codebase uses a sophisticated search strategy pattern to handle drug name variations:

```javascript
/**
 * Perform search with multiple fallback strategies
 * @param {Array} strategies - Array of search strategy objects
 * @param {string} endpoint - FDA API endpoint
 * @param {number} limit - Results limit
 * @returns {Promise<Object>} First successful result or aggregated errors
 */
async function performSearchStrategies(strategies, endpoint, limit) {
    const errors = [];
    
    for (const strategy of strategies) {
        try {
            const searchQuery = `${strategy.field}:"${strategy.value}"`;
            const params = buildParams(searchQuery, limit);
            const url = `${endpoint}?${params}`;
            
            const response = await fetch(url, { timeout: 15000 });
            
            if (response.ok) {
                const data = await response.json();
                if (data.results && data.results.length > 0) {
                    return { 
                        ...data, 
                        search_strategy_used: strategy.field 
                    };
                }
            } else if (response.status !== 404) {
                errors.push(`${strategy.field}: HTTP ${response.status}`);
            }
        } catch (error) {
            errors.push(`${strategy.field}: ${error.message}`);
        }
    }
    
    // No successful results found
    return {
        results: [],
        message: "No data found with any search strategy",
        errors_encountered: errors
    };
}
```

### Caching Pattern

Medical safety-first caching with automatic cleanup:

```javascript
/**
 * Cache management with medical safety priorities
 * - Safety-critical data: Never cached
 * - Semi-static data: Short TTL
 * - Static data: Long TTL
 */
const cacheKey = `${cachePrefix}:${drugName}:${limit}`;

// Check cache first (if allowed for this data type)
if (CACHE_TTL[dataType] && isCacheValid(cache.get(cacheKey), CACHE_TTL[dataType])) {
    console.log(`Cache hit for ${cacheKey}`);
    return cache.get(cacheKey).data;
}

// Fetch fresh data
const freshData = await fetchFromFDA(endpoint, params);

// Cache if appropriate (never cache safety-critical data)
if (CACHE_TTL[dataType]) {
    cache.set(cacheKey, {
        data: freshData,
        timestamp: Date.now()
    });
}

return freshData;
```

### Error Handling Pattern

Comprehensive error handling with helpful user feedback:

```javascript
/**
 * Standardized error handling with user-friendly messages
 */
try {
    const result = await fdaApiCall();
    return result;
} catch (error) {
    // Log technical details for developers
    log.error('tool', `FDA API call failed: ${error.message}`);
    
    // Return user-friendly error
    if (error.name === 'TimeoutError') {
        return {
            error: 'FDA database timeout',
            message: 'Please try again in a moment'
        };
    }
    
    if (error.status === 429) {
        return {
            error: 'Rate limit exceeded',
            message: 'Please wait before making another request'
        };
    }
    
    return {
        error: 'Database temporarily unavailable',
        message: 'Please try again later or contact support'
    };
}
```

---

## Performance Optimization

### Current Optimizations

1. **Intelligent Caching**: Medical safety-first TTL strategy
2. **Connection Reuse**: HTTP keep-alive for FDA API calls
3. **Compression**: gzip compression for all responses
4. **Memory Management**: Automatic cache cleanup every hour
5. **Efficient Search**: Multiple strategy fallback with early termination

### Performance Monitoring

```javascript
// Response time logging
const startTime = Date.now();
const result = await fdaApiCall();
const duration = Date.now() - startTime;

log.tool(toolName, drugName, `completed in ${duration}ms`);

// Cache hit/miss tracking
const cacheStats = {
    hits: 0,
    misses: 0,
    hitRate: () => this.hits / (this.hits + this.misses)
};
```

### Optimization Opportunities

**Future Performance Improvements:**
1. **Database Connection Pooling**: For high-traffic scenarios
2. **Request Batching**: Group multiple drug queries
3. **CDN Integration**: Cache static responses at edge locations  
4. **Query Optimization**: Analyze and optimize frequent search patterns
5. **Memory Profiling**: Monitor and optimize memory usage patterns

### Benchmarking

```bash
# Performance testing
curl -w "%{time_total}" -X POST http://localhost:443/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_drug_shortages","arguments":{"drug_name":"insulin"}}}'

# Load testing with multiple concurrent requests
# (Add custom load testing scripts as needed)
```

---

## Security Considerations

### Current Security Measures

1. **Helmet.js**: Security headers and XSS protection
2. **CORS Configuration**: Controlled cross-origin access
3. **Input Validation**: Comprehensive parameter sanitization  
4. **Rate Limiting**: FDA API rate limit compliance
5. **No Sensitive Data**: No patient or proprietary information stored
6. **Container Security**: Non-root user execution in Docker

### Security Implementation

```javascript
// Security middleware
app.use(helmet({
    contentSecurityPolicy: false,  // Allow embedding
    crossOriginEmbedderPolicy: false
}));

// CORS with explicit configuration
app.use(cors({
    origin: '*',  // Allow all origins for public API
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control'],
    credentials: false  // No cookies or credentials
}));

// Input sanitization
function sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    return input.trim().slice(0, 100); // Limit length
}
```

### Security Guidelines

1. **No Secrets in Code**: Use environment variables for API keys
2. **Validate All Inputs**: Never trust user input
3. **Log Security Events**: Monitor for unusual patterns
4. **Regular Updates**: Keep dependencies current
5. **Container Best Practices**: Use minimal base images
6. **Network Security**: Use HTTPS in production

### Vulnerability Management

```bash
# Dependency vulnerability scanning
npm audit

# Fix vulnerabilities
npm audit fix

# Security testing
npm run test:security  # If implemented
```

---

## Deployment Strategies

### Production Deployment Architecture

**Current Deployments:**
1. **Primary (Proxmox)**: `certus.opensource.mieweb.org`
2. **Backup (Railway)**: `certus-server-production.up.railway.app`
3. **Development**: Local development servers

### Docker Deployment

**Production Dockerfile:**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 443
USER node
CMD ["node", "official-mcp-server.js"]
```

**Docker Commands:**
```bash
# Build production image
docker build -t certus-server .

# Run with environment variables
docker run -d \
  --name certus-server \
  -p 443:443 \
  -e OPENFDA_API_KEY=your_key_here \
  --restart unless-stopped \
  certus-server

# Check logs
docker logs certus-server

# Update deployment
docker pull ghcr.io/zesty-genius128/certus_server:latest
docker stop certus-server
docker rm certus-server
docker run -d --name certus-server -p 443:443 ghcr.io/zesty-genius128/certus_server:latest
```

### Environment-Specific Configuration

**Development:**
```bash
NODE_ENV=development
PORT=443
OPENFDA_API_KEY=optional_dev_key
```

**Production:**
```bash
NODE_ENV=production  
PORT=443
OPENFDA_API_KEY=required_production_key
```

### Health Monitoring

```bash
# Production health checks
curl https://certus.opensource.mieweb.org/health
curl https://certus.opensource.mieweb.org/tools

# Automated monitoring script
#!/bin/bash
HEALTH_URL="https://certus.opensource.mieweb.org/health"
if ! curl -f $HEALTH_URL > /dev/null 2>&1; then
    echo "Server health check failed" | mail -s "Certus Server Alert" admin@example.com
fi
```

---

## Contributing Workflow

### Git Workflow

1. **Fork the repository** on GitHub
2. **Clone your fork** locally
3. **Create feature branch** from `main`
4. **Make changes** following code standards
5. **Add tests** for new functionality
6. **Run test suite** to ensure no regressions
7. **Commit with descriptive messages**
8. **Push to your fork**
9. **Create pull request** to `main` branch

### Commit Message Format

```
feat: Add new drug interaction search tool

- Implement search_drug_interactions tool with FDA API integration
- Add comprehensive input validation and error handling
- Include unit tests with 95% coverage
- Update API documentation and tool schemas
- Add caching strategy for interaction data

Fixes #123
```

### Pull Request Guidelines

**PR Title Format:**
- `feat:` - New features
- `fix:` - Bug fixes  
- `docs:` - Documentation updates
- `refactor:` - Code improvements
- `test:` - Test additions/improvements
- `chore:` - Maintenance tasks

**PR Description Template:**
```markdown
## Summary
Brief description of changes and motivation.

## Changes Made
- Specific change 1
- Specific change 2

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests pass
- [ ] Manual testing completed

## Documentation
- [ ] Code comments added
- [ ] API documentation updated
- [ ] README updated if needed

## Breaking Changes
List any breaking changes or migration notes.
```

### Code Review Process

**Review Checklist:**
1. Code follows established patterns
2. Tests provide adequate coverage
3. Documentation is updated
4. No security vulnerabilities
5. Performance impact assessed
6. Error handling is comprehensive

### Release Process

1. **Version Bump**: Update version in `package.json`
2. **Changelog Update**: Document changes in CHANGELOG.md
3. **Tag Release**: Create Git tag with version number
4. **GitHub Release**: Create release with notes
5. **Docker Build**: Automated build via GitHub Actions
6. **Deployment**: Update production servers

---

## Advanced Topics

### Custom MCP Client Integration

**Building a Custom Client:**
```javascript
// Example custom MCP client
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

const client = new Client({
    name: "custom-certus-client",
    version: "1.0.0"
});

// Connect to Certus server
await client.connect({
    command: "npx",
    args: ["mcp-remote", "https://certus.opensource.mieweb.org/mcp"]
});

// Call tools
const result = await client.callTool("search_drug_shortages", {
    drug_name: "insulin",
    limit: 5
});

console.log(result);
```

### Extending FDA Database Coverage

**Adding New FDA Endpoints:**
1. Research FDA openFDA API documentation
2. Add endpoint to `ENDPOINTS` constant
3. Implement search strategies for new data structure
4. Consider caching implications
5. Add comprehensive tests
6. Update documentation

### Performance Profiling

```javascript
// Memory usage monitoring
const used = process.memoryUsage();
console.log(`Memory usage: ${Math.round(used.heapUsed / 1024 / 1024)} MB`);

// CPU profiling
console.time('tool-execution');
const result = await toolFunction();
console.timeEnd('tool-execution');

// Custom metrics collection
const metrics = {
    requestCount: 0,
    averageResponseTime: 0,
    errorRate: 0
};
```

### Integration with Other Systems

**EHR Integration Example:**
```javascript
// Example webhook for EHR integration
app.post('/webhook/drug-shortage-alert', async (req, res) => {
    const { drugName } = req.body;
    
    // Check shortage status
    const shortageData = await searchDrugShortages(drugName);
    
    if (shortageData.results && shortageData.results.length > 0) {
        // Send alert to EHR system
        await sendEHRAlert({
            type: 'drug_shortage',
            drug: drugName,
            data: shortageData
        });
    }
    
    res.json({ status: 'processed' });
});
```

---

## Troubleshooting

### Common Development Issues

**Port Already in Use:**
```bash
# Find process using port 443
sudo lsof -i :443

# Kill process
sudo kill -9 <PID>

# Or use different port
PORT=3000 npm run dev
```

**FDA API Rate Limits:**
```bash
# Check current usage
curl -I "https://api.fda.gov/drug/label.json?search=generic_name:aspirin&limit=1"
# Look for X-RateLimit-* headers

# Get API key for higher limits
# Visit: https://open.fda.gov/apis/authentication/
```

**MCP Client Connection Issues:**
```bash
# Test server directly
curl http://localhost:443/health

# Test MCP endpoint
curl -X POST http://localhost:443/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"ping"}'

# Check stdio wrapper
echo '{"jsonrpc":"2.0","id":1,"method":"ping"}' | node stdio-wrapper.js
```

### Debugging Techniques

**Enable Verbose Logging:**
```bash
DEBUG=* npm run dev
NODE_ENV=development npm start
```

**Memory Leak Detection:**
```bash
node --inspect official-mcp-server.js
# Open Chrome DevTools for memory profiling
```

**Network Debugging:**
```bash
# Monitor HTTP requests
tcpdump -i any -s 0 -A port 443
```

---

## Resources and References

### Official Documentation

- [Model Context Protocol Specification](https://github.com/modelcontextprotocol/specification)
- [OpenFDA API Documentation](https://open.fda.gov/apis/)
- [Express.js Documentation](https://expressjs.com/)
- [Node.js Documentation](https://nodejs.org/en/docs/)

### Development Tools

- [MCP Inspector](https://github.com/modelcontextprotocol/inspector)
- [Postman Collection](docs/postman-collection.json) (if available)
- [VS Code Extensions](docs/vscode-extensions.md) (if available)

### Community Resources

- [GitHub Repository](https://github.com/zesty-genius128/Certus_server)
- [Issue Tracker](https://github.com/zesty-genius128/Certus_server/issues)
- [Discussions](https://github.com/zesty-genius128/Certus_server/discussions)

### FDA Resources

- [FDA Drug Shortages Database](https://www.accessdata.fda.gov/scripts/drugshortages/)
- [FDA Enforcement Database](https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts)
- [FAERS Database Info](https://www.fda.gov/drugs/surveillance/fda-adverse-event-reporting-system-faers)

---

## Support and Maintenance

### Getting Help

1. **Check Documentation**: Review guides in `docs/` directory
2. **Search Issues**: Look for existing GitHub issues
3. **Create Issue**: Detailed bug reports or feature requests
4. **Community Discussion**: Use GitHub Discussions for questions

### Maintenance Schedule

- **Daily**: Automated testing via GitHub Actions
- **Weekly**: Dependency security scans
- **Monthly**: Performance monitoring review
- **Quarterly**: Architecture review and optimization

### Long-term Roadmap

**Planned Improvements:**
1. GraphQL API support
2. WebSocket real-time updates
3. Advanced analytics dashboard
4. Multi-language support
5. Enhanced caching strategies

---

**Last Updated:** December 2024  
**Version:** 2.0.0  
**Maintainer:** Aditya Damerla

For questions or contributions, please visit the [GitHub repository](https://github.com/zesty-genius128/Certus_server).