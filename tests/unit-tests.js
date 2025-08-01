/**
 * Unit Tests for Certus MCP Server Utility Functions
 * 
 * Tests core utility functions from openfda-client.js
 * Uses Node.js built-in test runner (Node 18+)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';

// Test against the live Proxmox server
const SERVER_URL = 'https://certus.opensource.mieweb.org';

// Import the utility functions we want to test
import {
    validateDrugName,
    normalizeIdentifierType,
    buildParams,
    isCacheValid,
    getCacheStats,
    cleanExpiredCache
} from '../openfda-client.js';

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
    
    test('should handle whitespace-only strings', () => {
        const result = validateDrugName('   \t\n   ');
        assert.strictEqual(typeof result, 'object');
        assert(result.error, 'Should return error for whitespace-only string');
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
    
    test('should pass through unknown identifier types', () => {
        const unknownType = 'unknown.identifier.type';
        const result = normalizeIdentifierType(unknownType);
        assert.strictEqual(result, unknownType, 'Should pass through unknown types unchanged');
    });
});

describe('API Parameter Building', () => {
    test('should build basic search parameters', () => {
        const search = 'openfda.generic_name:"metformin"';
        const result = buildParams(search, 10);
        
        assert(result.includes('search='), 'Should include search parameter');
        assert(result.includes('limit=10'), 'Should include limit parameter');
        assert(result.includes('metformin'), 'Should include search term');
    });
    
    test('should handle URL encoding', () => {
        const search = 'openfda.generic_name:"drug with spaces"';
        const result = buildParams(search, 5);
        
        assert(result.includes('drug%20with%20spaces'), 'Should URL encode spaces');
    });
    
    test('should include API key when available', () => {
        const originalKey = process.env.OPENFDA_API_KEY;
        process.env.OPENFDA_API_KEY = 'test-api-key';
        
        const result = buildParams('test', 10);
        assert(result.includes('api_key=test-api-key'), 'Should include API key');
        
        // Restore original key
        if (originalKey) {
            process.env.OPENFDA_API_KEY = originalKey;
        } else {
            delete process.env.OPENFDA_API_KEY;
        }
    });
    
    test('should handle additional parameters', () => {
        const additionalParams = { count: 'patient.reaction.reactionmeddrapt.exact' };
        const result = buildParams('test', 10, additionalParams);
        
        assert(result.includes('count='), 'Should include additional parameters');
    });
    
    test('should handle different limit values', () => {
        const limits = [1, 5, 25, 50];
        
        limits.forEach(limit => {
            const result = buildParams('test', limit);
            assert(result.includes(`limit=${limit}`), `Should include limit=${limit}`);
        });
    });
});

describe('Cache Validation', () => {
    test('should validate fresh cache items', () => {
        const freshItem = {
            data: { test: 'data' },
            timestamp: Date.now() // Fresh timestamp
        };
        
        const result = isCacheValid(freshItem, 30); // 30 minute TTL
        assert.strictEqual(result, true, 'Fresh cache item should be valid');
    });
    
    test('should invalidate expired cache items', () => {
        const expiredItem = {
            data: { test: 'data' },
            timestamp: Date.now() - (60 * 60 * 1000) // 1 hour ago
        };
        
        const result = isCacheValid(expiredItem, 30); // 30 minute TTL
        assert.strictEqual(result, false, 'Expired cache item should be invalid');
    });
    
    test('should handle missing cache items', () => {
        const result = isCacheValid(null, 30);
        assert.strictEqual(result, false, 'Null cache item should be invalid');
        
        const result2 = isCacheValid(undefined, 30);
        assert.strictEqual(result2, false, 'Undefined cache item should be invalid');
    });
    
    test('should handle cache items without timestamp', () => {
        const itemWithoutTimestamp = { data: { test: 'data' } };
        
        const result = isCacheValid(itemWithoutTimestamp, 30);
        assert.strictEqual(result, false, 'Cache item without timestamp should be invalid');
    });
    
    test('should handle different TTL values', () => {
        const item = {
            data: { test: 'data' },
            timestamp: Date.now() - (45 * 60 * 1000) // 45 minutes ago
        };
        
        // Should be invalid with 30 minute TTL
        assert.strictEqual(isCacheValid(item, 30), false, 'Should be invalid with 30min TTL');
        
        // Should be valid with 60 minute TTL
        assert.strictEqual(isCacheValid(item, 60), true, 'Should be valid with 60min TTL');
    });
});

describe('Cache Statistics', () => {
    test('should return valid cache statistics structure', () => {
        const stats = getCacheStats();
        
        assert(typeof stats === 'object', 'Should return an object');
        assert(typeof stats.totalEntries === 'number', 'Should have totalEntries number');
        assert(typeof stats.memoryUsageApprox === 'number', 'Should have memory usage estimate');
        assert(typeof stats.entriesByType === 'object', 'Should have entriesByType object');
        
        // Check entriesByType structure
        const expectedTypes = ['drug_labels', 'drug_shortages', 'drug_recalls', 'adverse_events', 'other'];
        expectedTypes.forEach(type => {
            assert(typeof stats.entriesByType[type] === 'number', `Should have ${type} count`);
        });
    });
    
    test('should calculate memory usage estimate', () => {
        const stats = getCacheStats();
        
        // Memory usage should be a reasonable estimate
        assert(stats.memoryUsageApprox >= 0, 'Memory usage should be non-negative');
        assert(stats.memoryUsageApprox === stats.totalEntries * 1024, 'Should use 1KB per entry estimate');
    });
});

// Test runner execution
describe('Utility Functions Test Suite', () => {
    test('all utility functions should be importable', () => {
        // This test will fail if functions aren't properly exported
        assert(typeof validateDrugName === 'function', 'validateDrugName should be a function');
        assert(typeof normalizeIdentifierType === 'function', 'normalizeIdentifierType should be a function');
        assert(typeof buildParams === 'function', 'buildParams should be a function');
        assert(typeof isCacheValid === 'function', 'isCacheValid should be a function');
        assert(typeof getCacheStats === 'function', 'getCacheStats should be a function');
    });
});

// Integration tests against live Proxmox server
describe('Live Server Integration Tests', () => {
    test('should connect to Proxmox server health endpoint', async () => {
        const response = await fetch(`${SERVER_URL}/health`);
        assert.strictEqual(response.ok, true, 'Health endpoint should be accessible');
        
        const data = await response.json();
        assert.strictEqual(data.status, 'healthy', 'Server should report healthy status');
        assert.strictEqual(data.tools_available, 8, 'Should have 8 tools available');
    });
    
    test('should list all 8 FDA tools via MCP endpoint', async () => {
        const response = await fetch(`${SERVER_URL}/mcp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "tools/list",
                params: {}
            })
        });
        
        assert.strictEqual(response.ok, true, 'MCP endpoint should be accessible');
        
        const data = await response.json();
        assert(data.result, 'Should have result');
        assert(data.result.tools, 'Should have tools array');
        assert.strictEqual(data.result.tools.length, 8, 'Should have exactly 8 tools');
        
        // Check that key tools are present
        const toolNames = data.result.tools.map(tool => tool.name);
        const expectedTools = ['search_drug_shortages', 'search_adverse_events', 'search_drug_recalls'];
        expectedTools.forEach(expectedTool => {
            assert(toolNames.includes(expectedTool), `Should include ${expectedTool} tool`);
        });
    });
    
    test('should execute drug shortage search via live server', async () => {
        const response = await fetch(`${SERVER_URL}/mcp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: 2,
                method: "tools/call",
                params: {
                    name: "search_drug_shortages",
                    arguments: { drug_name: "insulin", limit: 3 }
                }
            })
        });
        
        assert.strictEqual(response.ok, true, 'Tool call should succeed');
        
        const data = await response.json();
        assert(data.result, 'Should have result');
        assert(data.result.content, 'Should have content');
        assert(data.result.content[0].text, 'Should have text response');
        
        const toolResult = JSON.parse(data.result.content[0].text);
        assert(toolResult.search_term, 'Should have search_term in response');
        assert.strictEqual(toolResult.search_term, 'insulin', 'Should match searched drug');
    });
    
    test('should get cache statistics from live server', async () => {
        const response = await fetch(`${SERVER_URL}/cache-stats`);
        assert.strictEqual(response.ok, true, 'Cache stats endpoint should be accessible');
        
        const data = await response.json();
        assert(data.cache, 'Should have cache object');
        assert(typeof data.cache.totalEntries === 'number', 'Should have totalEntries');
        assert(typeof data.cache.memoryUsageApprox === 'number', 'Should have memory usage');
        assert(data.cache.entriesByType, 'Should have entriesByType breakdown');
        assert.strictEqual(data.status, 'active', 'Cache should be active');
    });
});

console.log('Unit tests loaded successfully. Run with: node --test tests/unit-tests.js');
console.log(`Testing against live Proxmox server: ${SERVER_URL}`);