#!/usr/bin/env node

/**
 * Performance Benchmark Script for Certus MCP Server
 * 
 * Tests response times with and without caching to measure improvements.
 * Compares cached vs non-cached responses for different FDA tools.
 */

import fetch from 'node-fetch';

const SERVER_URL = 'https://certus.opensource.mieweb.org/mcp';
const TIMEOUT = 30000;

// Test drugs known to have data
const TEST_DRUGS = ['metformin', 'insulin', 'aspirin', 'acetaminophen'];

// Helper function to call MCP tools and measure time
async function callToolWithTiming(toolName, args) {
    const startTime = Date.now();
    
    const requestBody = {
        jsonrpc: '2.0',
        id: Math.random(),
        method: 'tools/call',
        params: { name: toolName, arguments: args }
    };

    try {
        const response = await fetch(SERVER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            timeout: TIMEOUT,
            body: JSON.stringify(requestBody)
        });

        const endTime = Date.now();
        const responseTime = endTime - startTime;

        if (!response.ok) {
            return { error: `HTTP ${response.status}`, responseTime };
        }

        const result = await response.json();
        if (result.error) {
            return { error: result.error.message, responseTime };
        }

        return { success: true, responseTime, dataSize: JSON.stringify(result).length };
    } catch (error) {
        const endTime = Date.now();
        return { error: error.message, responseTime: endTime - startTime };
    }
}

// Clear cache to test non-cached performance
async function clearCache() {
    try {
        const response = await fetch('https://certus.opensource.mieweb.org/cache-cleanup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log(`✓ Cache cleared: ${result.entries_removed} entries removed`);
            return true;
        }
    } catch (error) {
        console.log(`⚠ Cache clear failed: ${error.message}`);
        return false;
    }
}

// Get cache statistics
async function getCacheStats() {
    try {
        const response = await fetch('https://certus.opensource.mieweb.org/cache-stats');
        if (response.ok) {
            return await response.json();
        }
    } catch (error) {
        console.log(`⚠ Cache stats failed: ${error.message}`);
    }
    return null;
}

// Run performance test for a specific tool
async function testToolPerformance(toolName, args, testName) {
    console.log(`\n[TEST] ${testName}`);
    console.log('='.repeat(50));
    
    // Test 1: Non-cached (clear cache first)
    console.log('Clearing cache...');
    await clearCache();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for cache clear
    
    console.log('Testing non-cached performance...');
    const nonCachedResults = [];
    for (let i = 0; i < 3; i++) {
        const result = await callToolWithTiming(toolName, args);
        nonCachedResults.push(result);
        console.log(`  Run ${i + 1}: ${result.responseTime}ms ${result.error ? `(Error: ${result.error})` : '✓'}`);
        await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between tests
    }
    
    // Test 2: Cached (same requests should hit cache)
    console.log('\nTesting cached performance...');
    const cachedResults = [];
    for (let i = 0; i < 3; i++) {
        const result = await callToolWithTiming(toolName, args);
        cachedResults.push(result);
        console.log(`  Run ${i + 1}: ${result.responseTime}ms ${result.error ? `(Error: ${result.error})` : '✓'}`);
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Calculate averages (only successful requests)
    const successfulNonCached = nonCachedResults.filter(r => r.success);
    const successfulCached = cachedResults.filter(r => r.success);
    
    if (successfulNonCached.length > 0 && successfulCached.length > 0) {
        const avgNonCached = successfulNonCached.reduce((sum, r) => sum + r.responseTime, 0) / successfulNonCached.length;
        const avgCached = successfulCached.reduce((sum, r) => sum + r.responseTime, 0) / successfulCached.length;
        
        const improvement = ((avgNonCached - avgCached) / avgNonCached * 100);
        
        console.log('\n[RESULTS]');
        console.log(`Non-cached average: ${Math.round(avgNonCached)}ms`);
        console.log(`Cached average: ${Math.round(avgCached)}ms`);
        console.log(`Performance improvement: ${improvement > 0 ? '+' : ''}${Math.round(improvement)}%`);
        
        return {
            tool: testName,
            nonCachedAvg: Math.round(avgNonCached),
            cachedAvg: Math.round(avgCached),
            improvement: Math.round(improvement)
        };
    } else {
        console.log('\n[RESULTS] Insufficient successful requests for comparison');
        return {
            tool: testName,
            error: 'Insufficient successful requests'
        };
    }
}

// Main benchmark runner
async function runBenchmarks() {
    console.log('Certus FDA Drug Information MCP Server - Performance Benchmark');
    console.log('='.repeat(70));
    
    // Show initial cache stats
    const initialStats = await getCacheStats();
    if (initialStats) {
        console.log(`Initial cache: ${initialStats.totalEntries} entries, ~${Math.round(initialStats.memoryUsageApprox/1024)}KB`);
    }
    
    const benchmarkResults = [];
    
    // Test different tools that should benefit from caching
    const tests = [
        {
            tool: 'get_drug_label_info',
            args: { drug_identifier: 'metformin' },
            name: 'Drug Label Info (24hr cache)'
        },
        {
            tool: 'search_drug_shortages',
            args: { drug_name: 'insulin', limit: 5 },
            name: 'Drug Shortages (30min cache)'
        },
        {
            tool: 'search_adverse_events',
            args: { drug_name: 'aspirin', limit: 3 },
            name: 'Adverse Events (1hr cache)'
        }
    ];
    
    for (const test of tests) {
        const result = await testToolPerformance(test.tool, test.args, test.name);
        benchmarkResults.push(result);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Pause between tests
    }
    
    // Show final summary
    console.log('\n' + '='.repeat(70));
    console.log('[PERFORMANCE SUMMARY]');
    console.log('='.repeat(70));
    
    benchmarkResults.forEach(result => {
        if (result.error) {
            console.log(`${result.tool}: ${result.error}`);
        } else {
            const sign = result.improvement > 0 ? '+' : '';
            console.log(`${result.tool}:`);
            console.log(`  Non-cached: ${result.nonCachedAvg}ms | Cached: ${result.cachedAvg}ms | Improvement: ${sign}${result.improvement}%`);
        }
    });
    
    // Show final cache stats
    const finalStats = await getCacheStats();
    if (finalStats) {
        console.log(`\nFinal cache: ${finalStats.totalEntries} entries, ~${Math.round(finalStats.memoryUsageApprox/1024)}KB`);
    }
    
    console.log('\n[DONE] Performance benchmark completed');
}

// Start benchmarks
runBenchmarks().catch(error => {
    console.error('[ERROR] Benchmark crashed:', error);
    process.exit(1);
});