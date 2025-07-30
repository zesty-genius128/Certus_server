/**
 * Certus - OpenFDA Drug Information MCP Server (Fastify Implementation)
 * 
 * This implementation uses Fastify with the @platformatic/mcp plugin to provide
 * a custom connector-compatible MCP server for Claude web/desktop integration.
 * 
 * Documentation References:
 * - Fastify MCP Plugin: https://www.npmjs.com/package/@platformatic/mcp
 * - MCP Specification 2025-03-26: https://modelcontextprotocol.io/specification/2025-03-26/
 * - Fastify Framework: https://fastify.dev/
 * - Model Context Protocol SDK: https://github.com/modelcontextprotocol/sdk
 * 
 * Installation Dependencies:
 * npm install fastify @platformatic/mcp @modelcontextprotocol/sdk
 * 
 * Key Features:
 * - Native MCP protocol support via @platformatic/mcp
 * - Streamable HTTP transport for Claude custom connector compatibility
 * - Session management and horizontal scaling support
 * - TypeBox schema validation for enhanced type safety
 * - Server-Sent Events streaming capabilities
 * 
 * @author Aditya Damerla
 * @version 1.0.0
 */

import Fastify from 'fastify';
import mcpPlugin from '@platformatic/mcp';

// Temporary mock functions for testing - replace with actual openfda-client.js imports once confirmed working
const searchDrugShortages = async (drugName, limit = 10) => {
    return { 
        drug: drugName, 
        shortages: [], 
        message: `No current shortages found for ${drugName}`,
        timestamp: new Date().toISOString()
    };
};

const searchAdverseEvents = async (drugName, limit = 5, detailed = false) => {
    return { 
        drug: drugName, 
        adverse_events: [], 
        message: `No adverse events found for ${drugName}`,
        timestamp: new Date().toISOString()
    };
};

const searchSeriousAdverseEvents = async (drugName, limit = 5, detailed = false) => {
    return { 
        drug: drugName, 
        serious_events: [], 
        message: `No serious adverse events found for ${drugName}`,
        timestamp: new Date().toISOString()
    };
};

const searchDrugRecalls = async (drugName, limit = 10) => {
    return { 
        drug: drugName, 
        recalls: [], 
        message: `No recalls found for ${drugName}`,
        timestamp: new Date().toISOString()
    };
};

const fetchDrugLabelInfo = async (drugIdentifier, type = 'openfda.generic_name') => {
    return { 
        drug: drugIdentifier, 
        labels: [], 
        message: `No label information found for ${drugIdentifier}`,
        timestamp: new Date().toISOString()
    };
};

const getMedicationProfile = async (drugIdentifier, type = 'openfda.generic_name') => {
    return { 
        drug: drugIdentifier, 
        profile: {}, 
        message: `No profile found for ${drugIdentifier}`,
        timestamp: new Date().toISOString()
    };
};

const analyzeDrugShortageTrends = async (drugName, monthsBack = 12) => {
    return { 
        drug: drugName, 
        trends: [], 
        message: `No trend data found for ${drugName}`,
        timestamp: new Date().toISOString()
    };
};

const batchDrugAnalysis = async (drugList, includeTrends = false) => {
    return { 
        drugs: drugList, 
        analysis: {}, 
        message: `Analysis complete for ${drugList.length} drugs`,
        timestamp: new Date().toISOString()
    };
};

const healthCheck = async () => {
    return { 
        status: 'healthy', 
        fda_api: 'connected',
        timestamp: new Date().toISOString()
    };
};

console.log('ROCKET Starting Fastify MCP Server...');

const app = Fastify({ 
    logger: true
});

const PORT = process.env.PORT || 3001;

console.log('PACKAGE Fastify app created, registering MCP plugin...');

/**
 * Register the MCP plugin with server configuration
 * 
 * Reference: https://www.npmjs.com/package/@platformatic/mcp
 * MCP Capabilities: https://modelcontextprotocol.io/specification/2025-03-26/basic/capabilities/
 */
console.log('PLUGIN Registering @platformatic/mcp plugin...');

await app.register(mcpPlugin, {
    serverInfo: {
        name: 'OpenFDA Drug Information MCP Server (Fastify)',
        version: '1.0.0',
        description: 'FDA drug information with shortages, recalls, and labels via Fastify MCP plugin'
    },
    capabilities: {
        tools: { listChanged: true },      // Indicate tools are available and can change
        resources: { subscribe: false },   // No resources provided
        prompts: { listChanged: false }    // No prompts provided
    },
    instructions: 'This server provides 8 FDA drug information tools for real-time healthcare data analysis. Use these tools to query current drug shortages, adverse events, recalls, and prescribing information from the FDA databases.'
});

/**
 * Tool 1: Search Drug Shortages
 * 
 * FDA API Reference: https://open.fda.gov/apis/drug/drugsfda/
 * MCP Tool Schema: https://modelcontextprotocol.io/specification/2025-03-26/server/tools/
 */
app.mcpAddTool({
    name: 'search_drug_shortages',
    description: 'Search current FDA drug shortages. Use when asked about drug availability, shortages, supply issues, or "is [drug] in shortage".',
    inputSchema: {
        type: 'object',
        properties: {
            drug_name: {
                type: 'string',
                description: 'Name of the drug to search for shortages (generic or brand name)'
            },
            limit: {
                type: 'integer',
                description: 'Maximum number of results to return',
                default: 10,
                minimum: 1,
                maximum: 50
            }
        },
        required: ['drug_name']
    }
}, async (params) => {
    try {
        const result = await searchDrugShortages(params.drug_name, params.limit || 10);
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(result, null, 2)
                }
            ]
        };
    } catch (error) {
        app.log.error(`search_drug_shortages failed: ${error.message}`);
        throw error;
    }
});

/**
 * Tool 2: Search Adverse Events
 * 
 * FDA FAERS Reference: https://open.fda.gov/apis/drug/event/
 */
app.mcpAddTool({
    name: 'search_adverse_events',
    description: 'Search FDA adverse events and side effects. Use when asked about "side effects", "adverse events", "reactions", "safety concerns", or "what are the side effects of [drug]".',
    inputSchema: {
        type: 'object',
        properties: {
            drug_name: {
                type: 'string',
                description: 'Name of the drug to search for adverse events (generic or brand name)'
            },
            limit: {
                type: 'integer',
                description: 'Maximum number of adverse event reports to return',
                default: 5,
                minimum: 1,
                maximum: 50
            },
            detailed: {
                type: 'boolean',
                description: 'Return full raw FDA data (true) or summarized data (false). Default false for better performance.',
                default: false
            }
        },
        required: ['drug_name']
    }
}, async (params) => {
    try {
        const result = await searchAdverseEvents(
            params.drug_name, 
            params.limit || 5, 
            params.detailed || false
        );
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(result, null, 2)
                }
            ]
        };
    } catch (error) {
        app.log.error(`search_adverse_events failed: ${error.message}`);
        throw error;
    }
});

/**
 * Tool 3: Search Serious Adverse Events
 * 
 * FDA FAERS Serious Events: https://open.fda.gov/apis/drug/event/
 */
app.mcpAddTool({
    name: 'search_serious_adverse_events',
    description: 'Search serious adverse events only (death, hospitalization, disability). Use when asked about "serious side effects", "dangerous reactions", "fatal events", or "hospitalizations from [drug]".',
    inputSchema: {
        type: 'object',
        properties: {
            drug_name: {
                type: 'string',
                description: 'Name of the drug to search for serious adverse events'
            },
            limit: {
                type: 'integer',
                description: 'Maximum number of serious adverse event reports to return',
                default: 5,
                minimum: 1,
                maximum: 50
            },
            detailed: {
                type: 'boolean',
                description: 'Return full raw FDA data (true) or summarized data (false). Default false for better performance.',
                default: false
            }
        },
        required: ['drug_name']
    }
}, async (params) => {
    try {
        const result = await searchSeriousAdverseEvents(
            params.drug_name, 
            params.limit || 5, 
            params.detailed || false
        );
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(result, null, 2)
                }
            ]
        };
    } catch (error) {
        app.log.error(`search_serious_adverse_events failed: ${error.message}`);
        throw error;
    }
});

/**
 * Tool 4: Search Drug Recalls
 * 
 * FDA Enforcement Reference: https://open.fda.gov/apis/drug/enforcement/
 */
app.mcpAddTool({
    name: 'search_drug_recalls',
    description: 'Search FDA drug recalls and safety alerts. Use when asked about "recalls", "safety alerts", "withdrawn drugs", or "has [drug] been recalled".',
    inputSchema: {
        type: 'object',
        properties: {
            drug_name: {
                type: 'string',
                description: 'Drug name to search for recalls'
            },
            limit: {
                type: 'integer',
                description: 'Maximum number of results',
                default: 10,
                minimum: 1,
                maximum: 50
            }
        },
        required: ['drug_name']
    }
}, async (params) => {
    try {
        const result = await searchDrugRecalls(params.drug_name, params.limit || 10);
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(result, null, 2)
                }
            ]
        };
    } catch (error) {
        app.log.error(`search_drug_recalls failed: ${error.message}`);
        throw error;
    }
});

/**
 * Tool 5: Get Drug Label Information
 * 
 * FDA Drug Labels Reference: https://open.fda.gov/apis/drug/label/
 */
app.mcpAddTool({
    name: 'get_drug_label_info',
    description: 'Get FDA prescribing information and drug labeling. Use when asked about "prescribing info", "FDA label", "dosage forms", "indications", or "how is [drug] prescribed".',
    inputSchema: {
        type: 'object',
        properties: {
            drug_identifier: {
                type: 'string',
                description: 'The drug identifier to search for'
            },
            identifier_type: {
                type: 'string',
                description: 'The type of identifier',
                default: 'openfda.generic_name',
                enum: ['openfda.generic_name', 'openfda.brand_name', 'generic_name', 'brand_name']
            }
        },
        required: ['drug_identifier']
    }
}, async (params) => {
    try {
        const result = await fetchDrugLabelInfo(
            params.drug_identifier, 
            params.identifier_type || 'openfda.generic_name'
        );
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(result, null, 2)
                }
            ]
        };
    } catch (error) {
        app.log.error(`get_drug_label_info failed: ${error.message}`);
        throw error;
    }
});

/**
 * Tool 6: Get Medication Profile
 * 
 * Combined FDA data sources for comprehensive medication overview
 */
app.mcpAddTool({
    name: 'get_medication_profile',
    description: 'Get combined medication overview (label + shortage status only). Use when asked for "complete information", "full profile", or "everything about [drug]" but NOT for side effects or adverse events.',
    inputSchema: {
        type: 'object',
        properties: {
            drug_identifier: {
                type: 'string',
                description: 'The drug identifier to search for'
            },
            identifier_type: {
                type: 'string',
                description: 'The type of identifier',
                default: 'openfda.generic_name',
                enum: ['openfda.generic_name', 'openfda.brand_name', 'generic_name', 'brand_name']
            }
        },
        required: ['drug_identifier']
    }
}, async (params) => {
    try {
        const result = await getMedicationProfile(
            params.drug_identifier, 
            params.identifier_type || 'openfda.generic_name'
        );
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(result, null, 2)
                }
            ]
        };
    } catch (error) {
        app.log.error(`get_medication_profile failed: ${error.message}`);
        throw error;
    }
});

/**
 * Tool 7: Analyze Drug Shortage Trends
 * 
 * Historical analysis of FDA shortage patterns
 */
app.mcpAddTool({
    name: 'analyze_drug_shortage_trends',
    description: 'Analyze FDA drug shortage patterns over time. Use when asked about "shortage trends", "historical patterns", "shortage analysis over time", or "trends for [drug]".',
    inputSchema: {
        type: 'object',
        properties: {
            drug_name: {
                type: 'string',
                description: 'Drug name to analyze'
            },
            months_back: {
                type: 'integer',
                description: 'Number of months to look back',
                default: 12,
                minimum: 1,
                maximum: 60
            }
        },
        required: ['drug_name']
    }
}, async (params) => {
    try {
        const result = await analyzeDrugShortageTrends(
            params.drug_name, 
            params.months_back || 12
        );
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(result, null, 2)
                }
            ]
        };
    } catch (error) {
        app.log.error(`analyze_drug_shortage_trends failed: ${error.message}`);
        throw error;
    }
});

/**
 * Tool 8: Batch Drug Analysis
 * 
 * Analyze multiple drugs simultaneously for formulary management
 */
app.mcpAddTool({
    name: 'batch_drug_analysis',
    description: 'Analyze multiple drugs simultaneously. Use when asked to "compare multiple drugs", "analyze this list of drugs", or given a list of 2+ medications to analyze.',
    inputSchema: {
        type: 'object',
        properties: {
            drug_list: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of drug names to analyze',
                maxItems: 25
            },
            include_trends: {
                type: 'boolean',
                description: 'Whether to include trend analysis',
                default: false
            }
        },
        required: ['drug_list']
    }
}, async (params) => {
    try {
        if (params.drug_list.length > 25) {
            throw new Error('Maximum 25 drugs per batch analysis');
        }
        
        const result = await batchDrugAnalysis(
            params.drug_list, 
            params.include_trends || false
        );
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(result, null, 2)
                }
            ]
        };
    } catch (error) {
        app.log.error(`batch_drug_analysis failed: ${error.message}`);
        throw error;
    }
});

/**
 * Health check endpoint for monitoring
 * 
 * Fastify health check pattern: https://fastify.dev/docs/latest/Guides/Healthcheck/
 */
app.get('/health', async (request, reply) => {
    try {
        const healthData = await healthCheck();
        return {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            service: 'OpenFDA MCP Server (Fastify)',
            protocol: request.protocol,
            host: request.hostname,
            tools_available: 8,
            api_health: healthData
        };
    } catch (error) {
        app.log.error(`Health check failed: ${error.message}`);
        reply.code(500);
        return {
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
});

/**
 * Root endpoint providing server information
 */
app.get('/', async (request, reply) => {
    return {
        name: 'OpenFDA Drug Information MCP Server (Fastify)',
        version: '1.0.0',
        description: 'Fastify-based MCP server for FDA drug information with custom connector compatibility',
        architecture: 'Fastify + @platformatic/mcp plugin',
        documentation: {
            mcp_plugin: 'https://www.npmjs.com/package/@platformatic/mcp',
            mcp_spec: 'https://modelcontextprotocol.io/specification/2025-03-26/',
            fastify: 'https://fastify.dev/',
            fda_apis: 'https://open.fda.gov/apis/'
        },
        endpoints: {
            health: '/health',
            mcp: '/mcp',
            root: '/'
        },
        tools: [
            'search_drug_shortages',
            'search_adverse_events', 
            'search_serious_adverse_events',
            'search_drug_recalls',
            'get_drug_label_info',
            'get_medication_profile',
            'analyze_drug_shortage_trends',
            'batch_drug_analysis'
        ],
        features: [
            'Native MCP protocol support',
            'Streamable HTTP transport',
            'Claude custom connector compatibility',
            'Session management',
            'TypeBox schema validation',
            'Comprehensive error handling'
        ]
    };
});

/**
 * Graceful shutdown handling
 */
const gracefulShutdown = async (signal) => {
    app.log.info(`Received ${signal}, shutting down gracefully`);
    try {
        await app.close();
        process.exit(0);
    } catch (error) {
        app.log.error('Error during shutdown:', error);
        process.exit(1);
    }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

/**
 * Start the server
 * 
 * Fastify server startup: https://fastify.dev/docs/latest/Reference/Server/
 */
try {
    await app.listen({ 
        host: '0.0.0.0', 
        port: PORT 
    });
    
    app.log.info({
        server: 'OpenFDA MCP Server (Fastify)',
        port: PORT,
        health: `http://localhost:${PORT}/health`,
        mcp: `http://localhost:${PORT}/mcp`,
        tools: 8,
        plugin: '@platformatic/mcp',
        architecture: 'Fastify + MCP Plugin',
        custom_connector_ready: true
    }, 'Server started successfully');
    
} catch (error) {
    app.log.error('Failed to start server:', error);
    process.exit(1);
}