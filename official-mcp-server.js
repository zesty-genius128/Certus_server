import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { searchDrugShortages } from './openfda-client.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security and middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(morgan('combined'));

// CORS configuration
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control'],
    credentials: false
}));

app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        service: 'Drug Shortage MCP Server (Simple)',
        protocol: req.secure ? 'HTTPS' : 'HTTP',
        host: req.get('host')
    });
});

// Basic info endpoint
app.get('/', (req, res) => {
    res.json({
        name: "Drug Shortage MCP Server",
        version: "1.0.0",
        description: "Simple MCP server for FDA drug shortage data",
        endpoints: {
            health: "/health",
            mcp: "/mcp",
            tools: "/tools",
            search_drug_shortages: "/tools/search_drug_shortages"
        },
        tools: [
            {
                name: "search_drug_shortages",
                description: "Search for current drug shortages using FDA data"
            }
        ],
        mcp_info: {
            protocol_version: "2024-11-05",
            capabilities: ["tools"],
            transport: "Simple HTTP",
            inspector_compatible: true
        }
    });
});

// List tools endpoint (MCP-compatible)
app.get('/tools', (req, res) => {
    res.json({
        tools: [
            {
                name: "search_drug_shortages",
                description: "Search for current drug shortages using FDA data",
                inputSchema: {
                    type: "object",
                    properties: {
                        drug_name: {
                            type: "string",
                            description: "Name of the drug to search for shortages (generic or brand name)"
                        },
                        limit: {
                            type: "integer",
                            description: "Maximum number of results to return",
                            default: 10,
                            minimum: 1,
                            maximum: 50
                        }
                    },
                    required: ["drug_name"]
                }
            }
        ]
    });
});

// Direct tool execution endpoint
app.post('/tools/search_drug_shortages', async (req, res) => {
    try {
        const { drug_name, limit = 10 } = req.body;
        
        if (!drug_name || typeof drug_name !== 'string') {
            return res.status(400).json({
                error: "drug_name is required and must be a string",
                timestamp: new Date().toISOString()
            });
        }

        console.log(`[SIMPLE] Executing search_drug_shortages for: "${drug_name}"`);
        const result = await searchDrugShortages(drug_name, limit);
        
        res.json({
            tool: "search_drug_shortages",
            arguments: { drug_name, limit },
            result: result,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[SIMPLE] Tool execution error:', error);
        res.status(500).json({
            error: error.message,
            tool: "search_drug_shortages",
            timestamp: new Date().toISOString()
        });
    }
});

// MCP Protocol endpoint - handles JSON-RPC requests
app.post('/mcp', async (req, res) => {
    try {
        console.log(`[MCP] Request received:`, req.body?.method || 'unknown');
        const { method, params, id } = req.body;
        
        let response = {
            jsonrpc: "2.0",
            id: id
        };

        switch (method) {
            case "initialize":
                response.result = {
                    protocolVersion: "2024-11-05",
                    capabilities: {
                        tools: {}
                    },
                    serverInfo: {
                        name: "drug-shortage-mcp-server",
                        version: "1.0.0"
                    }
                };
                break;

            case "tools/list":
                response.result = {
                    tools: [
                        {
                            name: "search_drug_shortages",
                            description: "Search for current drug shortages using FDA data",
                            inputSchema: {
                                type: "object",
                                properties: {
                                    drug_name: {
                                        type: "string",
                                        description: "Name of the drug to search for shortages"
                                    },
                                    limit: {
                                        type: "integer", 
                                        description: "Maximum number of results",
                                        default: 10
                                    }
                                },
                                required: ["drug_name"]
                            }
                        }
                    ]
                };
                break;

            case "tools/call":
                const { name, arguments: args } = params;
                if (name === "search_drug_shortages") {
                    console.log(`[MCP] Calling tool: ${name} with args:`, args);
                    const result = await searchDrugShortages(args.drug_name, args.limit || 10);
                    response.result = {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify(result, null, 2)
                            }
                        ]
                    };
                } else {
                    response.error = {
                        code: -32601,
                        message: `Unknown tool: ${name}`
                    };
                }
                break;

            default:
                response.error = {
                    code: -32601,
                    message: `Unknown method: ${method}`
                };
        }

        console.log(`[MCP] Sending response for method: ${method}`);
        res.json(response);
        
    } catch (error) {
        console.error('[MCP] POST error:', error);
        res.status(500).json({
            jsonrpc: "2.0",
            id: req.body?.id || null,
            error: {
                code: -32603,
                message: error.message
            }
        });
    }
});

// MCP SSE endpoint (for MCP Inspector compatibility)
app.get('/mcp', (req, res) => {
    console.log('[MCP] SSE connection established');
    
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
    
    // Send server initialization
    const serverInfo = {
        jsonrpc: "2.0",
        method: "notifications/initialized",
        params: {
            protocolVersion: "2024-11-05",
            capabilities: {
                tools: {}
            },
            serverInfo: {
                name: "drug-shortage-mcp-server", 
                version: "1.0.0"
            }
        }
    };
    
    res.write('event: initialized\n');
    res.write('data: ' + JSON.stringify(serverInfo) + '\n\n');
    
    // Keep-alive ping every 30 seconds
    const keepAlive = setInterval(() => {
        try {
            res.write('event: ping\n');
            res.write('data: {"type":"ping","timestamp":"' + new Date().toISOString() + '"}\n\n');
        } catch (err) {
            clearInterval(keepAlive);
        }
    }, 30000);
    
    // Handle client disconnect
    req.on('close', () => {
        console.log('[MCP] SSE client disconnected');
        clearInterval(keepAlive);
    });

    req.on('error', (error) => {
        console.error('[MCP] SSE error:', error);
        clearInterval(keepAlive);
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('[Express] Error:', error);
    if (!res.headersSent) {
        res.status(500).json({
            error: 'Internal server error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// 404 handler
app.use((req, res) => {
    if (!res.headersSent) {
        res.status(404).json({
            error: 'Not found',
            path: req.path,
            available_endpoints: ['/health', '/mcp', '/tools', '/tools/search_drug_shortages'],
            timestamp: new Date().toISOString()
        });
    }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Simple MCP Drug Shortage Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔗 MCP endpoint: http://localhost:${PORT}/mcp`);
    console.log(`🛠  Tools endpoint: http://localhost:${PORT}/tools`);  
    console.log(`📖 Info: http://localhost:${PORT}/`);
    console.log(`\n💡 Based on your working trial-server.js but MCP Inspector compatible`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    process.exit(0);
});