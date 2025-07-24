/**
 * Simple Fastify MCP Server Test
 * 
 * Using fastify-mcp plugin: https://github.com/haroldadmin/fastify-mcp
 * Documentation: https://www.npmjs.com/package/fastify-mcp
 */

console.log('🚀 Starting Simple Fastify MCP Server...');

import Fastify from 'fastify';
import { streamableHttp } from 'fastify-mcp';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

console.log('📦 Imports successful, creating Fastify app...');

const app = Fastify({ 
    logger: {
        level: 'info'
    }
});

console.log('🔧 Creating MCP Server...');

// Create MCP Server function
function createServer() {
    const mcpServer = new Server({
        name: 'Simple FDA MCP Server',
        version: '1.0.0'
    }, {
        capabilities: {
            tools: {}
        }
    });

    // Add a simple test tool
    mcpServer.setRequestHandler('tools/list', async () => {
        return {
            tools: [{
                name: 'test_drug_search',
                description: 'Test drug search tool',
                inputSchema: {
                    type: 'object',
                    properties: {
                        drug_name: { type: 'string', description: 'Drug name to search' }
                    },
                    required: ['drug_name']
                }
            }]
        };
    });

    mcpServer.setRequestHandler('tools/call', async (request) => {
        const { name, arguments: args } = request.params;
        
        if (name === 'test_drug_search') {
            console.log(`🔍 Test tool called with: ${args.drug_name}`);
            return {
                content: [
                    {
                        type: 'text',
                        text: `Test result for drug: ${args.drug_name}`
                    }
                ]
            };
        }
        
        throw new Error(`Unknown tool: ${name}`);
    });

    console.log('✅ MCP Server created with test tool');
    return mcpServer;
}

console.log('🔌 Registering streamableHttp plugin...');

// Register the streamableHttp plugin
await app.register(streamableHttp, {
    stateful: false,
    mcpEndpoint: '/mcp',
    createServer
});

console.log('✅ Plugin registered successfully');

// Health check endpoint
app.get('/health', async (request, reply) => {
    return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        server: 'Simple Fastify MCP',
        mcp_endpoint: '/mcp'
    };
});

// Root endpoint
app.get('/', async (request, reply) => {
    return {
        name: 'Simple Fastify MCP Server',
        version: '1.0.0',
        endpoints: {
            health: '/health',
            mcp: '/mcp'
        },
        tools: ['test_drug_search']
    };
});

const PORT = process.env.PORT || 3002;

console.log('🚀 Starting server...');

try {
    await app.listen({ 
        host: '0.0.0.0', 
        port: PORT 
    });
    
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`🏥 Health: http://localhost:${PORT}/health`);
    console.log(`🔗 MCP: http://localhost:${PORT}/mcp`);
    
} catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
}