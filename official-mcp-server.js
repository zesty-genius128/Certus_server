/**
 * Certus - OpenFDA Drug Information MCP Server
 * 
 * Architecture Overview:
 * This server implements a hybrid approach for maximum MCP client compatibility:
 * - HTTP-based server with JSON-RPC endpoint at /mcp
 * - Works with stdio transport via bridges (npx mcp-remote, custom stdio wrappers)
 * - Universal compatibility: Claude Desktop, VS Code, Cursor, Visual Studio, Windsurf, LibreChat
 * 
 * Key Design Decisions:
 * - HTTP server implementing MCP Streamable HTTP transport for production reliability
 * - Stdio bridges handle transport protocol differences between clients
 * - Raw FDA API responses preserved for accurate medical data
 * - No complex authentication - focuses on core FDA data access
 * 
 * @author Aditya Damerla
 * @version 2.0.0
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { 
    searchDrugShortages,
    fetchDrugLabelInfo,
    searchDrugRecalls,
    analyzeDrugShortageTrends,
    batchDrugAnalysis,
    getMedicationProfile,
    searchAdverseEvents,
    searchSeriousAdverseEvents,
    healthCheck
} from './openfda-client.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 443;

/**
 * Standardized logging utility for consistent monitoring and debugging
 */
const log = {
    server: (msg) => console.log(`[SERVER] INFO: ${msg}`),
    mcp: (msg) => console.log(`[MCP] INFO: ${msg}`),
    tool: (tool, drug, msg) => console.log(`[TOOL] INFO: ${tool} - drug: "${drug}", ${msg}`),
    error: (component, msg) => console.error(`[${component.toUpperCase()}] ERROR: ${msg}`),
    warn: (component, msg) => console.warn(`[${component.toUpperCase()}] WARN: ${msg}`)
};

/**
 * Tool definitions - single source of truth for all 8 FDA drug information tools
 * Used by /tools endpoint, MCP tools/list, and documentation
 */
const TOOL_DEFINITIONS = [
    {
        name: "search_drug_shortages",
        description: "Search current FDA drug shortages. Use when asked about drug availability, shortages, supply issues, or 'is [drug] in shortage'.",
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
    },
    {
        name: "search_adverse_events",
        description: "Search FDA adverse events and side effects. Use when asked about 'side effects', 'adverse events', 'reactions', 'safety concerns', or 'what are the side effects of [drug]'.",
        inputSchema: {
            type: "object",
            properties: {
                drug_name: {
                    type: "string",
                    description: "Name of the drug to search for adverse events (generic or brand name)"
                },
                limit: {
                    type: "integer",
                    description: "Maximum number of adverse event reports to return",
                    default: 5,
                    minimum: 1,
                    maximum: 50
                },
                detailed: {
                    type: "boolean",
                    description: "Return full raw FDA data (true) or summarized data (false). Default false for better performance.",
                    default: false
                }
            },
            required: ["drug_name"]
        }
    },
    {
        name: "search_serious_adverse_events",
        description: "Search serious adverse events only (death, hospitalization, disability). Use when asked about 'serious side effects', 'dangerous reactions', 'fatal events', or 'hospitalizations from [drug]'.",
        inputSchema: {
            type: "object",
            properties: {
                drug_name: {
                    type: "string",
                    description: "Name of the drug to search for serious adverse events"
                },
                limit: {
                    type: "integer",
                    description: "Maximum number of serious adverse event reports to return",
                    default: 5,
                    minimum: 1,
                    maximum: 50
                },
                detailed: {
                    type: "boolean",
                    description: "Return full raw FDA data (true) or summarized data (false). Default false for better performance.",
                    default: false
                }
            },
            required: ["drug_name"]
        }
    },
    {
        name: "search_drug_recalls",
        description: "Search FDA drug recalls and safety alerts. Use when asked about 'recalls', 'safety alerts', 'withdrawn drugs', or 'has [drug] been recalled'.",
        inputSchema: {
            type: "object",
            properties: {
                drug_name: {
                    type: "string",
                    description: "Drug name to search for recalls"
                },
                limit: {
                    type: "integer",
                    description: "Maximum number of results",
                    default: 10,
                    minimum: 1,
                    maximum: 50
                }
            },
            required: ["drug_name"]
        }
    },
    {
        name: "get_drug_label_info",
        description: "Get FDA prescribing information and drug labeling. Use when asked about 'prescribing info', 'FDA label', 'dosage forms', 'indications', or 'how is [drug] prescribed'.",
        inputSchema: {
            type: "object",
            properties: {
                drug_identifier: {
                    type: "string",
                    description: "The drug identifier to search for"
                },
                identifier_type: {
                    type: "string",
                    description: "The type of identifier",
                    default: "openfda.generic_name",
                    enum: ["openfda.generic_name", "openfda.brand_name", "generic_name", "brand_name"]
                }
            },
            required: ["drug_identifier"]
        }
    },
    {
        name: "get_medication_profile",
        description: "Get combined medication overview (label + shortage status only). Use when asked for 'complete information', 'full profile', or 'everything about [drug]' but NOT for side effects or adverse events.",
        inputSchema: {
            type: "object",
            properties: {
                drug_identifier: {
                    type: "string",
                    description: "The drug identifier to search for"
                },
                identifier_type: {
                    type: "string",
                    description: "The type of identifier",
                    default: "openfda.generic_name",
                    enum: ["openfda.generic_name", "openfda.brand_name", "generic_name", "brand_name"]
                }
            },
            required: ["drug_identifier"]
        }
    },
    {
        name: "analyze_drug_shortage_trends",
        description: "Analyze FDA drug shortage patterns over time. Use when asked about 'shortage trends', 'historical patterns', 'shortage analysis over time', or 'trends for [drug]'.",
        inputSchema: {
            type: "object",
            properties: {
                drug_name: {
                    type: "string",
                    description: "Drug name to analyze"
                },
                months_back: {
                    type: "integer",
                    description: "Number of months to look back",
                    default: 12,
                    minimum: 1,
                    maximum: 60
                }
            },
            required: ["drug_name"]
        }
    },
    {
        name: "batch_drug_analysis",
        description: "Analyze multiple drugs simultaneously. Use when asked to 'compare multiple drugs', 'analyze this list of drugs', or given a list of 2+ medications to analyze.",
        inputSchema: {
            type: "object",
            properties: {
                drug_list: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of drug names to analyze",
                    maxItems: 25
                },
                include_trends: {
                    type: "boolean",
                    description: "Whether to include trend analysis",
                    default: false
                }
            },
            required: ["drug_list"]
        }
    }
];

/**
 * Express middleware configuration for security, compression, and logging
 */
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(morgan('combined'));

/**
 * CORS configuration for universal client access
 * Allows all origins for maximum MCP client compatibility
 */
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control'],
    credentials: false
}));

app.use(express.json({ limit: '10mb' }));

/**
 * Health check endpoint for monitoring and uptime verification
 * @route GET /health
 * @returns {Object} Server health status and API connectivity
 */
app.get('/health', async (req, res) => {
    try {
        log.server('Health check requested');
        const healthData = await healthCheck();
        
        const response = { 
            status: 'healthy', 
            timestamp: new Date().toISOString(),
            service: 'OpenFDA MCP Server',
            protocol: req.secure ? 'HTTPS' : 'HTTP',
            host: req.get('host'),
            tools_available: TOOL_DEFINITIONS.length,
            api_health: healthData
        };
        
        res.json(response);
        log.server(`Health check completed - status: healthy, tools: ${TOOL_DEFINITIONS.length}`);
    } catch (error) {
        log.error('health', `Health check failed: ${error.message}`);
        res.status(500).json({ status: 'unhealthy', error: error.message });
    }
});

/**
 * OAuth server metadata endpoint for MCP 2025-03-26 compliance
 * @route GET /.well-known/oauth-authorization-server
 * @returns {Object} OAuth server metadata indicating no auth required
 */
app.get('/.well-known/oauth-authorization-server', (req, res) => {
    log.server('OAuth metadata requested - indicating no auth required');
    res.json({
        issuer: `${req.protocol}://${req.get('host')}`,
        authorization_endpoint: `${req.protocol}://${req.get('host')}/authorize`,
        token_endpoint: `${req.protocol}://${req.get('host')}/token`,
        registration_endpoint: `${req.protocol}://${req.get('host')}/register`,
        scopes_supported: [],
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code"],
        token_endpoint_auth_methods_supported: ["none"],
        require_authentication: false
    });
});

/**
 * Robots.txt endpoint - controls web crawler access
 * @route GET /robots.txt
 * @returns {String} Robots.txt content with crawler directives
 */
app.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.send('User-agent: *\nDisallow: /');
});

/**
 * Server information endpoint - provides API documentation and tool overview
 * @route GET /
 * @returns {Object} Server metadata, available tools, and architectural notes
 */
app.get('/', (req, res) => {
    log.server('Info endpoint accessed');
    
    const toolSummary = TOOL_DEFINITIONS.map(tool => ({
        name: tool.name,
        description: tool.description.split('.')[0] // First sentence only
    }));

    res.json({
        name: "OpenFDA Drug Information MCP Server",
        version: "2.0.0",
        description: "Optimized MCP server for FDA drug information with minimal post-processing",
        architecture: "HTTP server with stdio transport bridge compatibility",
        endpoints: {
            health: "/health",
            mcp: "/mcp",
            tools: "/tools"
        },
        tools: toolSummary,
        optimization_notes: [
            "Minimal post-processing of API data",
            "Raw OpenFDA JSON responses preserved",
            "Reduced data transformation overhead",
            "Enhanced for Claude analysis"
        ]
    });
});

/**
 * MCP-compatible tools endpoint for schema discovery
 * @route GET /tools
 * @returns {Object} Complete tool definitions with input schemas
 */
app.get('/tools', (req, res) => {
    log.mcp('Tools schema requested');
    res.json({ tools: TOOL_DEFINITIONS });
});

/**
 * MCP GET endpoint - provides server information for client discovery or SSE connection
 * @route GET /mcp
 * @returns {Object} Server capabilities and protocol information or SSE stream
 */
app.get('/mcp', (req, res) => {
    // Check if client wants SSE
    const acceptHeader = req.get('Accept');
    if (acceptHeader && acceptHeader.includes('text/event-stream')) {
        log.mcp('SSE connection requested - starting event stream');
        
        // Set SSE headers
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Cache-Control'
        });

        // Send connection established event
        res.write('event: connected\n');
        res.write('data: {"type": "connection_established"}\n\n');

        // Proactively send server capabilities as a JSON-RPC notification
        const serverCapabilities = {
            jsonrpc: "2.0",
            method: "server/capabilities",
            params: {
                protocolVersion: "2024-11-05",
                capabilities: { 
                    tools: { listChanged: true },
                    resources: { listChanged: true },
                    prompts: { listChanged: true }
                },
                serverInfo: {
                    name: "OpenFDA Drug Information MCP Server",
                    version: "2.0.0",
                    description: "FDA drug information with shortages, recalls, and labels"
                },
                tools_available: TOOL_DEFINITIONS.length
            }
        };
        
        res.write(`data: ${JSON.stringify(serverCapabilities)}\n\n`);
        log.mcp('Sent server capabilities notification over SSE');

        // Keep connection alive
        const keepAlive = setInterval(() => {
            res.write(': ping\n\n');
        }, 30000);

        req.on('close', () => {
            clearInterval(keepAlive);
            log.mcp('SSE connection closed');
        });

        return;
    }

    // Standard HTTP response
    log.mcp('MCP GET request - providing server information');
    res.json({
        protocolVersion: "2024-11-05",
        serverInfo: {
            name: "OpenFDA Drug Information MCP Server",
            version: "2.0.0",
            description: "FDA drug information with shortages, recalls, and labels"
        },
        capabilities: { 
            tools: { listChanged: true },
            resources: { listChanged: true },
            prompts: { listChanged: true }
        },
        transport: "http",
        endpoint: "/mcp",
        tools_count: TOOL_DEFINITIONS.length
    });
});

/**
 * Handle JSON-RPC 2.0 requests (shared between POST and SSE)
 * @param {Object} request - JSON-RPC 2.0 request
 * @returns {Object} JSON-RPC 2.0 response
 */
async function handleJsonRpcRequest(request) {
    const { method, params, id } = request;
    log.mcp(`Request received: ${method || 'unknown'}`);
    
    let response = {
        jsonrpc: "2.0",
        id: id
    };

    switch (method) {
        case "initialize":
            log.mcp('Initialize request - sending server capabilities');
            response.result = {
                protocolVersion: "2024-11-05",
                capabilities: { 
                    tools: { listChanged: true },
                    resources: { listChanged: true },
                    prompts: { listChanged: true }
                },
                serverInfo: {
                    name: "OpenFDA Drug Information MCP Server",
                    version: "2.0.0",
                    description: "FDA drug information with shortages, recalls, and labels"
                }
            };
            break;

        case "ping":
            log.mcp('Ping received - responding with empty object');
            response.result = {};
            break;

        case "tools/list":
            log.mcp(`Tools list requested - sending ${TOOL_DEFINITIONS.length} tool definitions`);
            response.result = { tools: TOOL_DEFINITIONS };
            break;

        case "resources/list":
            log.mcp('Resources list requested - no resources available');
            response.result = { resources: [] };
            break;

        case "prompts/list":
            log.mcp('Prompts list requested - no prompts available');
            response.result = { prompts: [] };
            break;

        case "notifications/initialized":
            log.mcp('Initialized notification received - acknowledging');
            response.result = {};
            break;

        case "tools/call":
            const { name, arguments: args } = params;
            log.mcp(`Tool call: ${name}`);
            
            response.result = await handleToolCall(name, args);
            break;

        default:
            log.warn('mcp', `Unknown method: ${method}`);
            response.error = {
                code: -32601,
                message: `Unknown method: ${method}`
            };
    }

    return response;
}

/**
 * Main MCP Protocol endpoint - handles JSON-RPC 2.0 requests
 * Supports: initialize, ping, tools/list, tools/call
 * @route POST /mcp
 * @param {Object} req.body - JSON-RPC 2.0 request
 * @returns {Object} JSON-RPC 2.0 response
 */
app.post('/mcp', async (req, res) => {
    try {
        const response = await handleJsonRpcRequest(req.body);
        res.json(response);
        
    } catch (error) {
        log.error('mcp', `Request processing failed: ${error.message}`);
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

/**
 * Handle individual tool calls with comprehensive error handling
 * @param {string} name - Tool name to execute
 * @param {Object} args - Tool arguments
 * @returns {Object} Tool execution result or error
 */
async function handleToolCall(name, args) {
    try {
        let result;
        const drugName = args.drug_name || args.drug_identifier || 'unknown';
        
        switch (name) {
            case "search_drug_shortages":
                log.tool(name, drugName, `limit: ${args.limit || 10}`);
                result = await searchDrugShortages(args.drug_name, args.limit || 10);
                break;
                
            case "get_medication_profile":
                log.tool(name, drugName, `type: ${args.identifier_type || 'openfda.generic_name'}`);
                result = await getMedicationProfile(args.drug_identifier, args.identifier_type || "openfda.generic_name");
                break;
                
            case "search_drug_recalls":
                log.tool(name, drugName, `limit: ${args.limit || 10}`);
                result = await searchDrugRecalls(args.drug_name, args.limit || 10);
                break;
                
            case "get_drug_label_info":
                log.tool(name, drugName, `type: ${args.identifier_type || 'openfda.generic_name'}`);
                result = await fetchDrugLabelInfo(args.drug_identifier, args.identifier_type || "openfda.generic_name");
                break;
                
            case "analyze_drug_shortage_trends":
                log.tool(name, drugName, `months: ${args.months_back || 12}`);
                result = await analyzeDrugShortageTrends(args.drug_name, args.months_back || 12);
                break;
                
            case "batch_drug_analysis":
                if (args.drug_list.length > 25) {
                    throw new Error("Maximum 25 drugs per batch");
                }
                log.tool(name, `${args.drug_list.length} drugs`, `trends: ${args.include_trends || false}`);
                result = await batchDrugAnalysis(args.drug_list, args.include_trends || false);
                break;
            case "search_adverse_events":
                log.tool(name, drugName, `limit: ${args.limit || 5}, detailed: ${args.detailed || false}`);
                result = await searchAdverseEvents(args.drug_name, args.limit || 5, args.detailed || false);
                break;
                
            case "search_serious_adverse_events":
                log.tool(name, drugName, `limit: ${args.limit || 5}, detailed: ${args.detailed || false}`);
                result = await searchSeriousAdverseEvents(args.drug_name, args.limit || 5, args.detailed || false);
                break;
                
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
        
        log.tool(name, drugName, 'completed successfully');
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(result, null, 2)
                }
            ]
        };
        
    } catch (toolError) {
        log.error('tool', `${name} failed: ${toolError.message}`);
        throw toolError;
    }
}


/**
 * Global error handling middleware
 */
app.use((error, req, res, next) => {
    log.error('express', `Unhandled error: ${error.message}`);
    if (!res.headersSent) {
        res.status(500).json({
            error: 'Internal server error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * 404 handler for unknown routes
 */
app.use((req, res) => {
    log.warn('express', `404 - Unknown route: ${req.path}`);
    if (!res.headersSent) {
        res.status(404).json({
            error: 'Not found',
            path: req.path,
            available_endpoints: ['/health', '/mcp', '/tools'],
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Start the server and configure graceful shutdown
 */
app.listen(PORT, '0.0.0.0', () => {
    log.server(`OpenFDA MCP Server running on port ${PORT}`);
    log.server(`Health check: http://localhost:${PORT}/health`);
    log.server(`MCP endpoint: http://localhost:${PORT}/mcp`);
    log.server(`Tools endpoint: http://localhost:${PORT}/tools`);  
    log.server(`Info: http://localhost:${PORT}/`);
    log.server(`Available tools: ${TOOL_DEFINITIONS.length} FDA drug information tools`);
    log.server('Architecture: HTTP server with stdio transport bridge compatibility');
    log.server('Optimized for minimal post-processing and raw API data');
    
    console.log(`\nAvailable Tools:`);
    TOOL_DEFINITIONS.forEach((tool, index) => {
        console.log(`   ${index + 1}. ${tool.name} - ${tool.description.split('.')[0]}`);
    });
});

/**
 * Graceful shutdown handlers
 */
process.on('SIGTERM', () => {
    log.server('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    log.server('SIGINT received, shutting down gracefully');
    process.exit(0);
});