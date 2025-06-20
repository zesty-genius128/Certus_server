import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { 
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { searchDrugShortages } from './openfda-client.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security and middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disable for SSE
    crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(morgan('combined'));

// CORS configuration for MCP
app.use(cors({
    origin: [
        'https://claude.ai',
        'https://console.anthropic.com',
        'http://localhost:3000',
        'http://127.0.0.1:3000'
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control'],
    credentials: false
}));

app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        service: 'Drug Shortage MCP Server'
    });
});

// MCP Server setup
const server = new Server(
    {
        name: "drug-shortage-mcp-server",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
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
    };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
        switch (name) {
            case "search_drug_shortages": {
                const { drug_name, limit = 10 } = args;
                
                if (!drug_name || typeof drug_name !== 'string') {
                    throw new Error("drug_name is required and must be a string");
                }

                const result = await searchDrugShortages(drug_name, limit);
                
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2)
                        }
                    ]
                };
            }

            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    } catch (error) {
        console.error(`Tool execution error:`, error);
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        error: error.message,
                        tool: name,
                        timestamp: new Date().toISOString()
                    }, null, 2)
                }
            ],
            isError: true
        };
    }
});

// MCP endpoint with SSE transport - GET for stream, POST for messages
app.get('/mcp', async (req, res) => {
    console.log('New MCP SSE stream connection established');
    
    // Set SSE headers using Express methods
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
    
    // Important: Set status before creating transport
    res.status(200);

    try {
        const transport = new SSEServerTransport('/mcp', res);
        
        await server.connect(transport);
        console.log('MCP server connected via SSE');
        
        // Handle client disconnect
        req.on('close', () => {
            console.log('MCP SSE stream client disconnected');
            try {
                transport.close();
            } catch (err) {
                console.error('Error closing transport:', err.message);
            }
        });

        req.on('error', (error) => {
            console.error('MCP SSE stream error:', error);
            try {
                transport.close();
            } catch (err) {
                console.error('Error closing transport:', err.message);
            }
        });
        
    } catch (error) {
        console.error('Failed to connect MCP server:', error);
        
        // Only send error if response hasn't been sent yet
        if (!res.headersSent) {
            res.status(500).json({
                error: 'Failed to establish MCP connection',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }
});

// MCP POST endpoint for sending messages
app.post('/mcp', async (req, res) => {
    console.log('MCP POST message received');
    
    try {
        // The SSE transport should handle this automatically
        // This endpoint exists to satisfy the MCP client's expectations
        res.status(200).json({
            status: 'received',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('MCP POST error:', error);
        res.status(500).json({
            error: 'Failed to process MCP message',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Basic info endpoint
app.get('/', (req, res) => {
    res.json({
        name: "Drug Shortage MCP Server",
        version: "1.0.0",
        description: "Remote MCP server for FDA drug shortage data",
        endpoints: {
            health: "/health",
            mcp: "/mcp"
        },
        tools: [
            {
                name: "search_drug_shortages",
                description: "Search for current drug shortages using FDA data"
            }
        ]
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Express error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: error.message,
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        path: req.path,
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Drug Shortage MCP Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔗 MCP endpoint: http://localhost:${PORT}/mcp`);
    console.log(`📖 Info: http://localhost:${PORT}/`);
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