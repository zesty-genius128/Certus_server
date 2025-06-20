#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { searchDrugShortages } from './openfda-client.js';

// Create the MCP server for stdio (MCP Inspector compatible)
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

                console.error(`[STDIO] Searching for drug shortages: "${drug_name}"`);
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
        console.error(`[STDIO] Tool execution error:`, error);
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

// Start the stdio server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("[STDIO] Drug Shortage MCP Server running on stdio");
}

main().catch((error) => {
    console.error("[STDIO] Fatal error:", error);
    process.exit(1);
});