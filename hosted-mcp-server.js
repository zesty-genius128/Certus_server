import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';

// --- Import ALL tool functions from BOTH client files ---
import {
    checkDrugInteractions,
    convertDrugNames,
    getAdverseEvents
} from './drug-features.js';
import {
    fetchDrugLabelInfo,
    fetchDrugShortageInfo,
    searchDrugRecalls,
    analyzeDrugMarketTrends,
    batchDrugAnalysis
} from './openfda-client.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(compression());
app.use(cors());
app.use(morgan('dev'));

const allTools = [
    { name: "check_drug_interactions", description: "Check for potential drug interactions between medications using RxNav API." },
    { name: "convert_drug_names", description: "Convert between generic and brand names using OpenFDA label data." },
    { name: "get_adverse_events", description: "Get FDA adverse event reports for a medication from FAERS database." },
    { name: "get_medication_profile", description: "Get complete drug information including label and shortage status." },
    { name: "search_drug_shortages", description: "Search for drug shortages using openFDA database." },
    { name: "search_drug_recalls", description: "Search for drug recalls using openFDA enforcement database." },
    { name: "analyze_drug_market_trends", description: "Analyze drug shortage patterns and market trends." },
    { name: "batch_drug_analysis", description: "Analyze multiple drugs for shortages, recalls, and risk assessment." }
];

// --- New Streaming MCP Endpoint ---
app.post('/mcp', (req, res) => {
    // 1. Set headers for a Server-Sent Events (SSE) stream
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // Send headers immediately to establish the connection

    // 2. Listen for incoming data chunks from the client
    req.on('data', async (chunk) => {
        const request = JSON.parse(chunk.toString());
        let response;

        try {
            if (request.method === 'tools/list') {
                response = {
                    jsonrpc: "2.0", id: request.id, result: { tools: allTools }
                };
            } else if (request.method === 'tools/call') {
                const { name, arguments: args } = request.params;
                let resultPayload;

                // The same switch statement as before
                switch (name) {
                    case "check_drug_interactions":
                        resultPayload = await checkDrugInteractions(args.drug1, args.drug2, args.additional_drugs);
                        break;
                    // ... include all other 'case' statements for your tools here ...
                     case "convert_drug_names":
                        resultPayload = await convertDrugNames(args.drug_name, args.conversion_type);
                        break;
                    case "get_adverse_events":
                        resultPayload = await getAdverseEvents(args.drug_name, args.time_period, args.severity_filter);
                        break;
                    case "get_medication_profile":
                        const labelInfo = await fetchDrugLabelInfo(args.drug_identifier, args.identifier_type);
                        const shortageInfo = await fetchDrugShortageInfo(args.drug_identifier);
                        resultPayload = { label_information: labelInfo, shortage_information: shortageInfo };
                        break;
                    case "search_drug_shortages":
                        resultPayload = await fetchDrugShortageInfo(args.search_term);
                        break;
                    case "search_drug_recalls":
                        resultPayload = await searchDrugRecalls(args.search_term);
                        break;
                    case "analyze_drug_market_trends":
                        resultPayload = await analyzeDrugMarketTrends(args.drug_name, args.months_back);
                        break;
                    case "batch_drug_analysis":
                        resultPayload = await batchDrugAnalysis(args.drug_list, args.include_trends);
                        break;
                    default:
                        throw new Error(`Unknown tool: ${name}`);
                }
                
                response = {
                    jsonrpc: "2.0", id: request.id, result: { content: [{ type: "application/json", text: JSON.stringify(resultPayload, null, 2) }] }
                };

            } else {
                throw new Error(`Unsupported MCP method: ${request.method}`);
            }

            // 3. Write the response back to the client in SSE format
            res.write(`data: ${JSON.stringify(response)}\n\n`);

        } catch (error) {
            console.error("Error processing MCP request:", error);
            const errorResponse = {
                jsonrpc: "2.0", id: request.id || null, error: { code: -32603, message: `Internal error: ${error.message}` }
            };
            res.write(`data: ${JSON.stringify(errorResponse)}\n\n`);
        }
    });

    // 4. Handle client disconnection gracefully
    req.on('close', () => {
        console.log('Client disconnected, closing stream.');
        res.end();
    });
});

app.listen(PORT, () => {
    console.log(` Unified Streaming MCP server is ready at: http://localhost:${PORT}/mcp`);
});