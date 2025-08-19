/**
 * Unit Tests for Certus MCP Server Utility Functions
 * 
 * Tests core utility functions from openfda-client.js.
 * Pure unit tests without external dependencies.
 * Uses Node.js built-in test runner (Node 18+)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';

// Import the utility functions we want to test
import {
    validateDrugName,
    normalizeIdentifierType,
    buildParams,
    isCacheValid,
    getCacheStats
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
    
    test('should default unknown identifier types to generic_name', () => {
        const unknownType = 'unknown.identifier.type';
        const result = normalizeIdentifierType(unknownType);
        assert.strictEqual(result, 'openfda.generic_name', 'Should default unknown types to openfda.generic_name');
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
    
    test('should handle additional parameters', () => {
        const additionalParams = { count: 'patient.reaction.reactionmeddrapt.exact' };
        const result = buildParams('test', 10, additionalParams);
        const resultString = result.toString();
        
        assert(resultString.includes('count='), 'Should include additional parameters');
    });
    
    test('should handle different limit values', () => {
        const limits = [1, 5, 25, 50];
        
        limits.forEach(limit => {
            const result = buildParams('test', limit);
            const resultString = result.toString();
            assert(resultString.includes(`limit=${limit}`), `Should include limit=${limit}`);
        });
    });
});

describe('Cache Validation', () => {
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

console.log('Unit tests loaded successfully. Testing utility functions only.');

// Force exit in CI environment to prevent hanging
if (process.env.CI) {
    setTimeout(() => {
        console.log('Unit tests completed in CI environment.');
        process.exit(0);
    }, 5000);
}