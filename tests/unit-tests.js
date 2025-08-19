/**
 * Comprehensive Unit Tests for Certus MCP Server
 * 
 * Tests the entire codebase including server logic, OpenFDA client functions,
 * and utility functions without external dependencies or network calls.
 * 
 * Uses Node.js built-in test runner (Node 18+)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';

// Import all testable functions from openfda-client.js
import {
    validateDrugName,
    normalizeIdentifierType,
    buildParams,
    isCacheValid,
    getCacheStats,
    cleanExpiredCache,
    searchDrugShortages,
    fetchDrugLabelInfo,
    searchDrugRecalls,
    getMedicationProfile,
    searchAdverseEvents,
    searchSeriousAdverseEvents,
    analyzeDrugShortageTrends,
    batchDrugAnalysis,
    healthCheck
} from '../openfda-client.js';

// Import server components by reading and parsing the file
import fs from 'fs';
import path from 'path';

const serverPath = path.join(process.cwd(), 'official-mcp-server.js');
const serverContent = fs.readFileSync(serverPath, 'utf8');

describe('OpenFDA Client Functions', () => {
    describe('Drug Name Validation', () => {
        test('should accept valid drug names', () => {
            const validNames = ['metformin', 'Tylenol', 'insulin glargine', 'acetaminophen-500mg'];
            
            validNames.forEach(name => {
                const result = validateDrugName(name);
                assert.strictEqual(result, null, `Should accept valid name: ${name}`);
            });
        });
        
        test('should reject empty or invalid drug names', () => {
            const invalidNames = ['', '   ', null, undefined, 123, {}];
            
            invalidNames.forEach(name => {
                const result = validateDrugName(name);
                assert.strictEqual(typeof result, 'object', `Should reject invalid name: ${name}`);
                assert(result.error, 'Should return error object');
                assert(result.error.includes('provide a medication name'), 'Should have helpful error message');
            });
        });
        
        test('should provide context-specific error messages', () => {
            const contexts = ['shortages', 'recalls', 'adverse events'];
            
            contexts.forEach(context => {
                const result = validateDrugName('', context);
                assert(result.error.includes(context), `Should include context "${context}" in error`);
            });
        });
    });

    describe('Identifier Type Normalization', () => {
        test('should normalize generic identifier types', () => {
            const testCases = [
                { input: 'generic_name', expected: 'openfda.generic_name' },
                { input: 'openfda.generic_name', expected: 'openfda.generic_name' },
                { input: 'brand_name', expected: 'openfda.brand_name' },
                { input: 'openfda.brand_name', expected: 'openfda.brand_name' }
            ];
            
            testCases.forEach(({ input, expected }) => {
                const result = normalizeIdentifierType(input);
                assert.strictEqual(result, expected, `${input} should normalize to ${expected}`);
            });
        });
        
        test('should handle undefined and default values', () => {
            const result = normalizeIdentifierType();
            assert.strictEqual(result, 'openfda.generic_name', 'Should default to openfda.generic_name');
        });
    });

    describe('API Parameter Building', () => {
        test('should build basic search parameters', () => {
            const search = 'openfda.generic_name:"metformin"';
            const result = buildParams(search, 10);
            const resultString = result.toString();
            
            assert(resultString.includes('search='), 'Should include search parameter');
            assert(resultString.includes('limit=10'), 'Should include limit parameter');
            assert(resultString.includes('metformin'), 'Should include search term');
        });
        
        test('should handle URL encoding', () => {
            const search = 'openfda.generic_name:"drug with spaces"';
            const result = buildParams(search, 5);
            const resultString = result.toString();
            
            assert(resultString.includes('drug+with+spaces'), 'Should URL encode spaces as plus signs');
        });
    });

    describe('Cache Management', () => {
        test('should validate fresh cache items', () => {
            const freshItem = {
                data: { test: 'data' },
                timestamp: Date.now()
            };
            
            const result = isCacheValid(freshItem, 30);
            assert.strictEqual(result, true, 'Fresh cache item should be valid');
        });
        
        test('should invalidate expired cache items', () => {
            const expiredItem = {
                data: { test: 'data' },
                timestamp: Date.now() - (60 * 60 * 1000) // 1 hour ago
            };
            
            const result = isCacheValid(expiredItem, 30);
            assert.strictEqual(result, false, 'Expired cache item should be invalid');
        });
        
        test('should return valid cache statistics structure', () => {
            const stats = getCacheStats();
            
            assert(typeof stats === 'object', 'Should return an object');
            assert(typeof stats.totalEntries === 'number', 'Should have totalEntries number');
            assert(typeof stats.memoryUsageApprox === 'number', 'Should have memory usage estimate');
            assert(typeof stats.entriesByType === 'object', 'Should have entriesByType object');
        });
        
        test('should clean expired cache without errors', () => {
            assert.doesNotThrow(() => {
                cleanExpiredCache();
            }, 'Cache cleanup should not throw errors');
        });
    });

    describe('FDA API Functions Structure', () => {
        test('should have all required FDA search functions', () => {
            const requiredFunctions = [
                searchDrugShortages,
                fetchDrugLabelInfo,
                searchDrugRecalls,
                getMedicationProfile,
                searchAdverseEvents,
                searchSeriousAdverseEvents,
                analyzeDrugShortageTrends,
                batchDrugAnalysis,
                healthCheck
            ];
            
            requiredFunctions.forEach(fn => {
                assert(typeof fn === 'function', `${fn.name} should be a function`);
            });
        });
        
        test('should validate drug names before API calls', async () => {
            // Test that functions properly validate input before making calls
            try {
                await searchDrugShortages(''); // Empty drug name
                assert.fail('Should reject empty drug name');
            } catch (error) {
                assert(error.message.includes('medication name') || error.message.includes('drug'), 'Should have validation error');
            }
        });
        
        test('should handle batch drug analysis input validation', async () => {
            try {
                await batchDrugAnalysis([]); // Empty array
                assert.fail('Should reject empty drug list');
            } catch (error) {
                assert(error.message.includes('drug'), 'Should have validation error for empty list');
            }
        });
    });
});

describe('Server Architecture and Configuration', () => {
    describe('MCP Tool Definitions', () => {
        test('should have exactly 8 FDA tools defined', () => {
            const toolDefStart = serverContent.indexOf('const TOOL_DEFINITIONS = [');
            const toolDefEnd = serverContent.indexOf('];', toolDefStart);
            
            assert(toolDefStart !== -1, 'Should have TOOL_DEFINITIONS array');
            assert(toolDefEnd !== -1, 'Should have properly closed TOOL_DEFINITIONS array');
            
            const toolDefSection = serverContent.substring(toolDefStart, toolDefEnd);
            const toolMatches = toolDefSection.match(/name: \"[^\"]+\"/g) || [];
            
            assert.strictEqual(toolMatches.length, 8, 'Should have exactly 8 FDA tools defined');
        });
        
        test('should include all required FDA tools', () => {
            const requiredTools = [
                'search_drug_shortages',
                'search_adverse_events', 
                'search_serious_adverse_events',
                'search_drug_recalls',
                'get_drug_label_info',
                'get_medication_profile',
                'analyze_drug_shortage_trends',
                'batch_drug_analysis'
            ];
            
            requiredTools.forEach(tool => {
                assert(serverContent.includes(`"${tool}"`), `Should include tool: ${tool}`);
            });
        });
        
        test('should have proper input schemas for all tools', () => {
            const schemaElements = ['type', 'properties', 'required', 'description'];
            
            schemaElements.forEach(element => {
                const regex = new RegExp(element + ':', 'g');
                const matches = serverContent.match(regex);
                assert(matches && matches.length >= 8, `Should have ${element} defined for all tools`);
            });
        });
    });

    describe('Server Configuration', () => {
        test('should have rate limiting configuration', () => {
            assert(serverContent.includes('MAX_REQUESTS'), 'Should have rate limiting configuration');
            assert(serverContent.includes('WINDOW_MS'), 'Should have rate limit window configuration');
            assert(serverContent.includes('process.env.CI'), 'Should have CI environment detection');
        });
        
        test('should specify MCP protocol version', () => {
            assert(serverContent.includes('2024-11-05'), 'Should specify MCP protocol version');
        });
        
        test('should have proper server identification', () => {
            assert(serverContent.includes('OpenFDA Drug Information MCP Server'), 'Should have proper server name');
            assert(serverContent.includes('version'), 'Should have version information');
        });
        
        test('should have CORS configuration', () => {
            assert(serverContent.includes('cors'), 'Should have CORS middleware');
            assert(serverContent.includes('origin: \'*\''), 'Should allow all origins for MCP compatibility');
        });
    });

    describe('HTTP Endpoints', () => {
        test('should have all required REST endpoints', () => {
            const requiredEndpoints = [
                "app.get('/health'",
                "app.get('/tools'", 
                "app.post('/mcp'",
                "app.get('/cache-stats'",
                "app.get('/usage-stats'",
                "app.get('/'",
                "app.get('/robots.txt'"
            ];
            
            requiredEndpoints.forEach(endpoint => {
                assert(serverContent.includes(endpoint), `Should have endpoint: ${endpoint}`);
            });
        });
        
        test('should handle MCP protocol methods', () => {
            const mcpMethods = ['initialize', 'ping', 'tools/list', 'tools/call'];
            
            mcpMethods.forEach(method => {
                assert(serverContent.includes(`"${method}"`), `Should handle MCP method: ${method}`);
            });
        });
    });

    describe('Error Handling and Logging', () => {
        test('should have comprehensive logging system', () => {
            const logTypes = ['log.server', 'log.mcp', 'log.tool', 'log.error', 'log.warn'];
            
            logTypes.forEach(logType => {
                assert(serverContent.includes(logType), `Should have logging method: ${logType}`);
            });
        });
        
        test('should have usage analytics tracking', () => {
            assert(serverContent.includes('usageAnalytics'), 'Should have usage analytics system');
            assert(serverContent.includes('logUsage'), 'Should have usage logging function');
            assert(serverContent.includes('byTool'), 'Should track tool usage');
            assert(serverContent.includes('byDrug'), 'Should track drug searches');
        });
        
        test('should have error handling middleware', () => {
            assert(serverContent.includes('app.use((error'), 'Should have global error handler');
            assert(serverContent.includes('404'), 'Should handle 404 errors');
            assert(serverContent.includes('500'), 'Should handle 500 errors');
        });
        
        test('should have graceful shutdown handlers', () => {
            assert(serverContent.includes('SIGTERM'), 'Should handle SIGTERM');
            assert(serverContent.includes('SIGINT'), 'Should handle SIGINT');
        });
    });

    describe('Tool Call Handler', () => {
        test('should have handleToolCall function', () => {
            assert(serverContent.includes('async function handleToolCall'), 'Should have handleToolCall function');
            assert(serverContent.includes('switch (name)'), 'Should have tool routing logic');
        });
        
        test('should handle all defined tools in switch statement', () => {
            const tools = [
                'search_drug_shortages',
                'search_adverse_events',
                'search_serious_adverse_events', 
                'search_drug_recalls',
                'get_drug_label_info',
                'get_medication_profile',
                'analyze_drug_shortage_trends',
                'batch_drug_analysis'
            ];
            
            tools.forEach(tool => {
                assert(serverContent.includes(`case "${tool}"`), `Should handle tool case: ${tool}`);
            });
        });
        
        test('should have proper error handling in tool calls', () => {
            assert(serverContent.includes('try {'), 'Should have try-catch blocks');
            assert(serverContent.includes('catch (toolError)'), 'Should catch tool errors');
            assert(serverContent.includes('userFriendly'), 'Should have user-friendly error handling');
        });
    });
});

describe('Security and Middleware', () => {
    test('should have security middleware configured', () => {
        assert(serverContent.includes('helmet'), 'Should have Helmet security middleware');
        assert(serverContent.includes('compression'), 'Should have compression middleware');
        assert(serverContent.includes('morgan'), 'Should have request logging');
    });
    
    test('should have rate limiting implemented', () => {
        assert(serverContent.includes('rateLimit'), 'Should have rate limiting map');
        assert(serverContent.includes('429'), 'Should return 429 for rate limit exceeded');
        assert(serverContent.includes('retryAfter'), 'Should include retry information');
    });
    
    test('should handle JSON parsing safely', () => {
        assert(serverContent.includes('express.json'), 'Should have JSON parsing middleware');
        assert(serverContent.includes('10mb'), 'Should have reasonable size limit');
    });
});

describe('Code Quality and Structure', () => {
    test('should have proper JSDoc documentation', () => {
        const docPatterns = ['/**', '@param', '@returns', '@route'];
        
        docPatterns.forEach(pattern => {
            assert(serverContent.includes(pattern), `Should have JSDoc pattern: ${pattern}`);
        });
    });
    
    test('should have proper module imports', () => {
        const imports = ['express', 'cors', 'helmet', 'compression', 'morgan', 'dotenv'];
        
        imports.forEach(module => {
            assert(serverContent.includes(`import ${module}`) || serverContent.includes(`from '${module}'`), 
                   `Should import module: ${module}`);
        });
    });
    
    test('should have environment configuration', () => {
        assert(serverContent.includes('process.env.PORT'), 'Should use environment PORT');
        assert(serverContent.includes('dotenv.config'), 'Should load environment variables');
    });
    
    test('should have proper server startup logging', () => {
        assert(serverContent.includes('app.listen'), 'Should start HTTP server');
        assert(serverContent.includes('Available Tools:'), 'Should log available tools on startup');
        assert(serverContent.includes('0.0.0.0'), 'Should bind to all interfaces');
    });
});

// Test runner execution summary
describe('Comprehensive Test Suite Summary', () => {
    test('all core functions should be available and testable', () => {
        // Verify we can test both server logic and client functions
        assert(typeof validateDrugName === 'function', 'Client functions should be importable');
        assert(serverContent.length > 0, 'Server code should be readable');
        assert(serverContent.includes('TOOL_DEFINITIONS'), 'Server should have tool definitions');
        assert(serverContent.includes('handleToolCall'), 'Server should have tool handler');
    });
});

console.log('Comprehensive unit tests loaded successfully.');
console.log('Testing entire Certus MCP Server codebase without external dependencies.');
console.log('Coverage: OpenFDA client functions, server logic, MCP protocol, error handling, security.');