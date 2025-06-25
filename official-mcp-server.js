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
    healthCheck
} from './openfda-client.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 80;

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
app.get('/health', async (req, res) => {
    const healthData = await healthCheck();
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        service: 'OpenFDA MCP Server',
        protocol: req.secure ? 'HTTPS' : 'HTTP',
        host: req.get('host'),
        tools_available: 6,
        api_health: healthData
    });
});

// Basic info endpoint
app.get('/', (req, res) => {
    res.json({
        name: "OpenFDA Drug Information MCP Server",
        version: "2.0.0",
        description: "Optimized MCP server for FDA drug information with minimal post-processing",
        endpoints: {
            health: "/health",
            mcp: "/mcp",
            tools: "/tools"
        },
        tools: [
            {
                name: "search_drug_shortages",
                description: "Search current drug shortages using FDA data"
            },
            {
                name: "get_medication_profile", 
                description: "Get complete drug information including label and shortage status"
            },
            {
                name: "search_drug_recalls",
                description: "Search drug recalls using FDA enforcement database"
            },
            {
                name: "get_drug_label_info",
                description: "Get FDA label information for a drug"
            },
            {
                name: "analyze_drug_market_trends",
                description: "Analyze drug shortage patterns and market trends"
            },
            {
                name: "batch_drug_analysis",
                description: "Analyze multiple drugs for shortages, recalls, and risk assessment"
            }
        ],
        optimization_notes: [
            "Minimal post-processing of API data",
            "Raw OpenFDA JSON responses preserved",
            "Reduced data transformation overhead",
            "Enhanced for Claude analysis"
        ]
    });
});

// MCP-compatible tools endpoint
app.get('/tools', (req, res) => {
    res.json({
        tools: [
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
            }
        ]
    });
});

// MCP Protocol endpoint
app.post('/mcp', async (req, res) => {
    try {
        console.log(`[MCP] Request: ${req.body?.method || 'unknown'}`);
        const { method, params, id } = req.body;
        
        let response = {
            jsonrpc: "2.0",
            id: id
        };

        switch (method) {
            case "initialize":
                response.result = {
                    protocolVersion: "2024-11-05",
                    capabilities: { tools: {} },
                    serverInfo: {
                        name: "openfda-drug-information-mcp-server",
                        version: "2.0.0"
                    }
                };
                break;

            case "tools/list":
                response.result = {
                    tools: [
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
                        }
                    ]
                };
                break; // ← THIS WAS MISSING!

            case "tools/call":
                const { name, arguments: args } = params;
                console.log(`[MCP] Tool: ${name}`);
                
                try {
                    let result;
                    
                    switch (name) {
                        case "search_drug_shortages":
                            result = await searchDrugShortages(args.drug_name, args.limit || 10);
                            break;
                            
                        case "get_medication_profile":
                            result = await getMedicationProfile(args.drug_identifier, args.identifier_type || "openfda.generic_name");
                            break;
                            
                        case "search_drug_recalls":
                            result = await searchDrugRecalls(args.drug_name, args.limit || 10);
                            break;
                            
                        case "get_drug_label_info":
                            result = await fetchDrugLabelInfo(args.drug_identifier, args.identifier_type || "openfda.generic_name");
                            break;
                            
                        case "analyze_drug_market_trends":
                            result = await analyzeDrugMarketTrends(args.drug_name, args.months_back || 12);
                            break;
                            
                        case "batch_drug_analysis":
                            if (args.drug_list.length > 25) {
                                throw new Error("Maximum 25 drugs per batch");
                            }
                            result = await batchDrugAnalysis(args.drug_list, args.include_trends || false);
                            break;
                            
                        default:
                            throw new Error(`Unknown tool: ${name}`);
                    }
                    
                    response.result = {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify(result, null, 2)
                            }
                        ]
                    };
                    
                } catch (toolError) {
                    console.error(`[MCP] Tool ${name} error:`, toolError);
                    response.error = {
                        code: -32603,
                        message: toolError.message
                    };
                }
                break;

            default:
                response.error = {
                    code: -32601,
                    message: `Unknown method: ${method}`
                };
        }

        res.json(response);
        
    } catch (error) {
        console.error('[MCP] Error:', error);
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

// MCP SSE endpoint for inspector compatibility
app.get('/mcp', (req, res) => {
    console.log('[MCP] SSE connection established');
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
    
    const serverInfo = {
        jsonrpc: "2.0",
        method: "notifications/initialized",
        params: {
            protocolVersion: "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: {
                name: "openfda-drug-information-mcp-server", 
                version: "2.0.0"
            }
        }
    };
    
    res.write('event: initialized\n');
    res.write('data: ' + JSON.stringify(serverInfo) + '\n\n');
    
    const keepAlive = setInterval(() => {
        try {
            res.write('event: ping\n');
            res.write('data: {"type":"ping","timestamp":"' + new Date().toISOString() + '"}\n\n');
        } catch (err) {
            clearInterval(keepAlive);
        }
    }, 30000);
    
    req.on('close', () => {
        console.log('[MCP] SSE client disconnected');
        clearInterval(keepAlive);
    });

    req.on('error', (error) => {
        console.error('[MCP] SSE error:', error);
        clearInterval(keepAlive);
    });
});

// Direct tool testing endpoints
app.post('/tools/search_drug_shortages', async (req, res) => {
    try {
        const { drug_name, limit = 10 } = req.body;
        if (!drug_name) {
            return res.status(400).json({ error: "drug_name is required" });
        }
        const result = await searchDrugShortages(drug_name, limit);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/tools/get_medication_profile', async (req, res) => {
    try {
        const { drug_identifier, identifier_type = "openfda.generic_name" } = req.body;
        if (!drug_identifier) {
            return res.status(400).json({ error: "drug_identifier is required" });
        }
        const result = await getMedicationProfile(drug_identifier, identifier_type);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/tools/search_drug_recalls', async (req, res) => {
    try {
        const { drug_name, limit = 10 } = req.body;
        if (!drug_name) {
            return res.status(400).json({ error: "drug_name is required" });
        }
        const result = await searchDrugRecalls(drug_name, limit);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/tools/analyze_drug_market_trends', async (req, res) => {
    try {
        const { drug_name, months_back = 12 } = req.body;
        if (!drug_name) {
            return res.status(400).json({ error: "drug_name is required" });
        }
        const result = await analyzeDrugMarketTrends(drug_name, months_back);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/tools/batch_drug_analysis', async (req, res) => {
    try {
        const { drug_list, include_trends = false } = req.body;
        if (!drug_list || !Array.isArray(drug_list)) {
            return res.status(400).json({ error: "drug_list is required and must be an array" });
        }
        if (drug_list.length > 25) {
            return res.status(400).json({ error: "Maximum 25 drugs per batch" });
        }
        const result = await batchDrugAnalysis(drug_list, include_trends);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Error handling
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

app.use((req, res) => {
    if (!res.headersSent) {
        res.status(404).json({
            error: 'Not found',
            path: req.path,
            available_endpoints: ['/health', '/mcp', '/tools'],
            timestamp: new Date().toISOString()
        });
    }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`OpenFDA MCP Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
    console.log(`Tools endpoint: http://localhost:${PORT}/tools`);  
    console.log(`Info: http://localhost:${PORT}/`);
    console.log(`\nAvailable Tools:`);
    console.log(`   1. search_drug_shortages - Current drug shortages`);
    console.log(`   2. get_medication_profile - Complete drug information`);
    console.log(`   3. search_drug_recalls - Drug recalls`);
    console.log(`   4. get_drug_label_info - FDA label information`);
    console.log(`   5. analyze_drug_market_trends - Shortage patterns`);
    console.log(`   6. batch_drug_analysis - Multiple drug analysis`);
    console.log(`\nOptimized for minimal post-processing and raw API data`);
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