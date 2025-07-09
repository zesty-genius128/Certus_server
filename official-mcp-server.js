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
    analyzeDrugMarketTrends,
    batchDrugAnalysis,
    getMedicationProfile,
    searchAdverseEvents,        // ADD THIS
    searchSeriousAdverseEvents, // ADD THIS
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
 * Tool definitions - single source of truth for all 6 FDA drug information tools
 * Used by /tools endpoint, MCP tools/list, and documentation
 */
const TOOL_DEFINITIONS = [
    {
        name: "search_drug_shortages",
        description: "Search for current drug shortages using FDA data. Returns raw OpenFDA data with minimal processing.",
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
        name: "get_medication_profile",
        description: "Get complete drug information combining label and shortage data. Returns raw API responses.",
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
        name: "search_drug_recalls",
        description: "Search for drug recalls using FDA enforcement database. Returns raw enforcement data.",
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
        description: "Get FDA label information for a drug. Returns raw structured product labeling data.",
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
        name: "analyze_drug_market_trends",
        description: "Analyze drug shortage patterns. Returns raw shortage data for trend analysis.",
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
        description: "Analyze multiple drugs simultaneously. Returns array of raw API responses.",
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
    },
     {
        name: "search_adverse_events",
        description: "Search FDA adverse event reports (FAERS database) for a medication. Returns summarized data by default, full raw data when detailed=true.",
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
        description: "Search for serious adverse events only (hospitalization, death, disability). Returns summarized data by default, full raw data when detailed=true.",
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
 * Main MCP Protocol endpoint - handles JSON-RPC 2.0 requests
 * Supports: initialize, ping, tools/list, tools/call
 * @route POST /mcp
 * @param {Object} req.body - JSON-RPC 2.0 request
 * @returns {Object} JSON-RPC 2.0 response
 */
app.post('/mcp', async (req, res) => {
    try {
        const { method, params, id } = req.body;
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
                    capabilities: { tools: {} },
                    serverInfo: {
                        name: "openfda-drug-information-mcp-server",
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
                
            case "analyze_drug_market_trends":
                log.tool(name, drugName, `months: ${args.months_back || 12}`);
                result = await analyzeDrugMarketTrends(args.drug_name, args.months_back || 12);
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
 * Direct tool testing endpoints for debugging and development
 * These endpoints bypass MCP protocol for direct API testing
 */

/**
 * Search drug shortages directly via HTTP
 * @route POST /tools/search_drug_shortages
 */
app.post('/tools/search_drug_shortages', async (req, res) => {
    try {
        const { drug_name, limit = 10 } = req.body;
        if (!drug_name) {
            return res.status(400).json({ error: "drug_name is required" });
        }
        
        log.tool('search_drug_shortages', drug_name, `direct HTTP call, limit: ${limit}`);
        const result = await searchDrugShortages(drug_name, limit);
        res.json(result);
    } catch (error) {
        log.error('tool', `search_drug_shortages HTTP call failed: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get medication profile directly via HTTP
 * @route POST /tools/get_medication_profile
 */
app.post('/tools/get_medication_profile', async (req, res) => {
    try {
        const { drug_identifier, identifier_type = "openfda.generic_name" } = req.body;
        if (!drug_identifier) {
            return res.status(400).json({ error: "drug_identifier is required" });
        }
        
        log.tool('get_medication_profile', drug_identifier, `direct HTTP call, type: ${identifier_type}`);
        const result = await getMedicationProfile(drug_identifier, identifier_type);
        res.json(result);
    } catch (error) {
        log.error('tool', `get_medication_profile HTTP call failed: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Search drug recalls directly via HTTP
 * @route POST /tools/search_drug_recalls
 */
app.post('/tools/search_drug_recalls', async (req, res) => {
    try {
        const { drug_name, limit = 10 } = req.body;
        if (!drug_name) {
            return res.status(400).json({ error: "drug_name is required" });
        }
        
        log.tool('search_drug_recalls', drug_name, `direct HTTP call, limit: ${limit}`);
        const result = await searchDrugRecalls(drug_name, limit);
        res.json(result);
    } catch (error) {
        log.error('tool', `search_drug_recalls HTTP call failed: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Analyze drug market trends directly via HTTP
 * @route POST /tools/analyze_drug_market_trends
 */
app.post('/tools/analyze_drug_market_trends', async (req, res) => {
    try {
        const { drug_name, months_back = 12 } = req.body;
        if (!drug_name) {
            return res.status(400).json({ error: "drug_name is required" });
        }
        
        log.tool('analyze_drug_market_trends', drug_name, `direct HTTP call, months: ${months_back}`);
        const result = await analyzeDrugMarketTrends(drug_name, months_back);
        res.json(result);
    } catch (error) {
        log.error('tool', `analyze_drug_market_trends HTTP call failed: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Batch drug analysis directly via HTTP
 * @route POST /tools/batch_drug_analysis
 */
app.post('/tools/batch_drug_analysis', async (req, res) => {
    try {
        const { drug_list, include_trends = false } = req.body;
        if (!drug_list || !Array.isArray(drug_list)) {
            return res.status(400).json({ error: "drug_list is required and must be an array" });
        }
        if (drug_list.length > 25) {
            return res.status(400).json({ error: "Maximum 25 drugs per batch" });
        }
        
        log.tool('batch_drug_analysis', `${drug_list.length} drugs`, `direct HTTP call, trends: ${include_trends}`);
        const result = await batchDrugAnalysis(drug_list, include_trends);
        res.json(result);
    } catch (error) {
        log.error('tool', `batch_drug_analysis HTTP call failed: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

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