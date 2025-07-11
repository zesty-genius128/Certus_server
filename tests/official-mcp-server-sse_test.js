import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { 
    searchDrugShortages,
    fetchDrugLabelInfo,
    searchDrugRecalls,
    analyzeDrugMarketTrends,
    batchDrugAnalysis,
    getMedicationProfile,
    healthCheck
} from '../openfda-client.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 443;

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

// Store active SSE connections
const sseConnections = new Map();

// OAuth client registry for Dynamic Client Registration
const oauthClients = new Map();

// OAuth Discovery endpoint (RFC 8414)
app.get('/.well-known/oauth-authorization-server', (req, res) => {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    res.json({
        issuer: baseUrl,
        authorization_endpoint: `${baseUrl}/oauth/authorize`,
        token_endpoint: `${baseUrl}/oauth/token`,
        registration_endpoint: `${baseUrl}/register`,
        scopes_supported: ['mcp:tools', 'mcp:resources'],
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code'],
        token_endpoint_auth_methods_supported: ['client_secret_post']
    });
});

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
        api_health: healthData,
        mcp_transports: ['stdio', 'sse', 'http'],
        oauth_support: true
    });
});

// OAuth Dynamic Client Registration (RFC 7591) - Claude expects /register
app.post('/register', (req, res) => {
    const { client_name, redirect_uris, scope } = req.body;
    
    const clientId = crypto.randomUUID();
    const clientSecret = crypto.randomBytes(32).toString('hex');
    
    const client = {
        client_id: clientId,
        client_secret: clientSecret,
        client_name: client_name || 'MCP Client',
        redirect_uris: redirect_uris || [],
        scope: scope || 'mcp:tools mcp:resources',
        created_at: new Date().toISOString()
    };
    
    oauthClients.set(clientId, client);
    
    res.json({
        client_id: clientId,
        client_secret: clientSecret,
        client_name: client.client_name,
        redirect_uris: client.redirect_uris,
        scope: client.scope
    });
});

// Keep the old endpoint for backwards compatibility
app.post('/oauth/register', (req, res) => {
    const { client_name, redirect_uris, scope } = req.body;
    
    const clientId = crypto.randomUUID();
    const clientSecret = crypto.randomBytes(32).toString('hex');
    
    const client = {
        client_id: clientId,
        client_secret: clientSecret,
        client_name: client_name || 'MCP Client',
        redirect_uris: redirect_uris || [],
        scope: scope || 'mcp:tools mcp:resources',
        created_at: new Date().toISOString()
    };
    
    oauthClients.set(clientId, client);
    
    res.json({
        client_id: clientId,
        client_secret: clientSecret,
        client_name: client.client_name,
        redirect_uris: client.redirect_uris,
        scope: client.scope
    });
});

// OAuth Authorization endpoint
app.get('/oauth/authorize', (req, res) => {
    const { client_id, redirect_uri, scope, state } = req.query;
    
    if (!oauthClients.has(client_id)) {
        return res.status(400).json({ error: 'invalid_client' });
    }
    
    // For simplicity, auto-approve (in production, show user consent form)
    const authCode = crypto.randomBytes(16).toString('hex');
    
    // Store auth code temporarily (normally in Redis/database)
    const authData = {
        client_id,
        scope: scope || 'mcp:tools mcp:resources',
        created_at: Date.now(),
        expires_at: Date.now() + 600000 // 10 minutes
    };
    
    // In production, store this securely
    global.authCodes = global.authCodes || new Map();
    global.authCodes.set(authCode, authData);
    
    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set('code', authCode);
    if (state) redirectUrl.searchParams.set('state', state);
    
    res.redirect(redirectUrl.toString());
});

// OAuth Token endpoint
app.post('/oauth/token', (req, res) => {
    const { grant_type, code, client_id, client_secret } = req.body;
    
    if (grant_type !== 'authorization_code') {
        return res.status(400).json({ error: 'unsupported_grant_type' });
    }
    
    if (!oauthClients.has(client_id)) {
        return res.status(400).json({ error: 'invalid_client' });
    }
    
    const client = oauthClients.get(client_id);
    if (client.client_secret !== client_secret) {
        return res.status(400).json({ error: 'invalid_client' });
    }
    
    global.authCodes = global.authCodes || new Map();
    const authData = global.authCodes.get(code);
    
    if (!authData || authData.expires_at < Date.now()) {
        return res.status(400).json({ error: 'invalid_grant' });
    }
    
    // Generate access token
    const accessToken = crypto.randomBytes(32).toString('hex');
    
    // Store token (normally in database)
    global.accessTokens = global.accessTokens || new Map();
    global.accessTokens.set(accessToken, {
        client_id,
        scope: authData.scope,
        created_at: Date.now(),
        expires_at: Date.now() + 3600000 // 1 hour
    });
    
    // Clean up auth code
    global.authCodes.delete(code);
    
    res.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 3600,
        scope: authData.scope
    });
});

// MCP Server-Sent Events endpoint (Remote MCP Protocol)
app.get('/mcp', (req, res) => {
    console.log('[MCP SSE] New connection established');
    
    const connectionId = crypto.randomUUID();
    
    // Set SSE headers properly
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'X-Accel-Buffering': 'no' // Disable nginx buffering
    });
    
    // Send initial connection event (minimal approach)
    res.write('event: connected\n');
    res.write('data: {"type":"connected"}\n\n');
    
    // Store connection
    sseConnections.set(connectionId, {
        response: res,
        lastPing: Date.now(),
        authenticated: false
    });
    
    // Simple keep-alive (reduce frequency to avoid connection issues)
    const keepAlive = setInterval(() => {
        try {
            if (sseConnections.has(connectionId)) {
                res.write('event: ping\n');
                res.write('data: {"type":"ping"}\n\n');
                sseConnections.get(connectionId).lastPing = Date.now();
            } else {
                clearInterval(keepAlive);
            }
        } catch (err) {
            console.log('[MCP SSE] Keep-alive failed, cleaning up connection');
            clearInterval(keepAlive);
            sseConnections.delete(connectionId);
        }
    }, 60000); // Reduced to 60 seconds
    
    // Handle client disconnect
    req.on('close', () => {
        console.log('[MCP SSE] Client disconnected cleanly');
        clearInterval(keepAlive);
        sseConnections.delete(connectionId);
    });

    req.on('error', (error) => {
        console.error('[MCP SSE] Connection error:', error);
        clearInterval(keepAlive);
        sseConnections.delete(connectionId);
    });
    
    req.on('aborted', () => {
        console.log('[MCP SSE] Connection aborted by client');
        clearInterval(keepAlive);
        sseConnections.delete(connectionId);
    });
});

// MCP HTTP endpoint for tool calls (Streamable HTTP)
app.post('/mcp', async (req, res) => {
    try {
        console.log(`[MCP HTTP] Request: ${req.body?.method || 'unknown'}`);
        
        // Check authorization for sensitive operations (but not for discovery)
        const authHeader = req.headers.authorization;
        let isAuthenticated = false;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            global.accessTokens = global.accessTokens || new Map();
            const tokenData = global.accessTokens.get(token);
            
            if (tokenData && tokenData.expires_at > Date.now()) {
                isAuthenticated = true;
                console.log('[MCP] Request authenticated with valid token');
            }
        }
        
        const { method, params, id } = req.body;
        
        let response = {
            jsonrpc: "2.0",
            id: id
        };

        switch (method) {
            case "initialize":
                console.log('[MCP] Initialize request received');
                response.result = {
                    protocolVersion: "2024-11-05",
                    capabilities: { 
                        tools: {}
                        // Temporarily remove OAuth requirement to test tool discovery
                        // auth: {
                        //     oauth2: {
                        //         authorizationUrl: `${req.protocol}://${req.get('host')}/oauth/authorize`,
                        //         tokenUrl: `${req.protocol}://${req.get('host')}/oauth/token`,
                        //         registrationUrl: `${req.protocol}://${req.get('host')}/register`,
                        //         scopes: ['mcp:tools', 'mcp:resources']
                        //     }
                        // }
                    },
                    serverInfo: {
                        name: "openfda-drug-information-mcp-server",
                        version: "2.0.0",
                        description: "FDA drug information with shortages, recalls, and labels"
                    }
                };
                break;
                
            case "ping":
                response.result = {};
                break;
                
            case "notifications/initialized":
                // Client is notifying us it's initialized, we should respond with success
                response.result = {};
                console.log('[MCP] Client notifications/initialized received');
                break;
                
            case "tools/list":
                console.log('[MCP] Tools/list requested - sending tool definitions');
                // For remote protocol, may require authentication for sensitive tools
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
                break;

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

// Basic info endpoint
app.get('/', (req, res) => {
    res.json({
        name: "OpenFDA Drug Information MCP Server",
        version: "2.0.0",
        description: "Optimized MCP server for FDA drug information with minimal post-processing",
        transports: ["stdio", "sse", "http"],
        oauth_support: true,
        endpoints: {
            health: "/health",
            mcp_sse: "/mcp (GET)",
            mcp_http: "/mcp (POST)",
            oauth_discovery: "/.well-known/oauth-authorization-server",
            oauth_register: "/register",
            oauth_authorize: "/oauth/authorize",
            oauth_token: "/oauth/token",
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
            "Enhanced for Claude analysis",
            "OAuth2 authentication support",
            "Multiple transport protocols (stdio, SSE, HTTP)"
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

// Direct tool testing endpoints (keep existing for backwards compatibility)
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
            available_endpoints: ['/health', '/mcp', '/tools', '/.well-known/oauth-authorization-server', '/register', '/oauth/authorize', '/oauth/token'],
            timestamp: new Date().toISOString()
        });
    }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`OpenFDA MCP Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`MCP SSE endpoint: http://localhost:${PORT}/mcp`);
    console.log(`MCP HTTP endpoint: http://localhost:${PORT}/mcp (POST)`);
    console.log(`OAuth registration: http://localhost:${PORT}/register`);
    console.log(`Tools endpoint: http://localhost:${PORT}/tools`);  
    console.log(`Info: http://localhost:${PORT}/`);
    console.log(`\nSupported transports: stdio (via bridge), SSE, HTTP`);
    console.log(`OAuth2 authentication: Dynamic Client Registration (RFC 7591)`);
    console.log(`\nAvailable Tools:`);
    console.log(`   1. search_drug_shortages - Current drug shortages`);
    console.log(`   2. get_medication_profile - Complete drug information`);
    console.log(`   3. search_drug_recalls - Drug recalls`);
    console.log(`   4. get_drug_label_info - FDA label information`);
    console.log(`   5. analyze_drug_market_trends - Shortage patterns`);
    console.log(`   6. batch_drug_analysis - Multiple drug analysis`);
    console.log(`\nOptimized for minimal post-processing and raw API data`);
    console.log(`Now supports Claude Desktop Settings > Integrations!`);
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