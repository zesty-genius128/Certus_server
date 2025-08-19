#!/usr/bin/env node

/**
 * Integration Test Suite for Certus FDA Drug Information MCP Server
 * 
 * Tests core FDA tool functionality with live server data.
 * Simplified for internship-appropriate complexity.
 * 
 * Usage: node tests/integration-test.js
 */

import { strict as assert } from 'assert';
import fetch from 'node-fetch';

// Test configuration
const SERVER_URL = 'https://certus.opensource.mieweb.org/mcp';
const TIMEOUT = 30000;

// Keep track of test results
let passed = 0;
let failed = 0;
let errors = [];

// Helper function to call MCP tools
async function callTool(toolName, args) {
    const requestBody = {
        jsonrpc: '2.0',
        id: Math.random(),
        method: 'tools/call',
        params: { name: toolName, arguments: args }
    };

    const response = await fetch(SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        timeout: TIMEOUT,
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    if (result.error) {
        throw new Error(`MCP Error: ${result.error.message}`);
    }

    return JSON.parse(result.result.content[0].text);
}

// Simple test function that tracks results
function test(description, condition, actual = null, expected = null) {
    try {
        assert(condition, `${description} - Expected: ${expected}, Actual: ${actual}`);
        console.log(`[PASS] ${description}`);
        passed++;
    } catch (error) {
        console.log(`[FAIL] ${description}: ${error.message}`);
        failed++;
        errors.push({ description, error: error.message });
    }
}

// Test server health
async function testServerHealth() {
    console.log('\n[TEST] Server Health');
    
    try {
        const healthResponse = await fetch('https://certus.opensource.mieweb.org/health');
        const healthData = await healthResponse.json();
        test('Server returns healthy status', healthData.status === 'healthy');
        test('Server has 8 tools available', healthData.tools_available === 8);
    } catch (error) {
        test('Server health check failed', false, error.message, 'healthy response');
    }
}

// Test core FDA tools
async function testCoreTools() {
    console.log('\n[TEST] Core FDA Tools');
    
    const toolsToTest = [
        { tool: 'search_drug_shortages', args: { drug_name: 'insulin', limit: 3 } },
        { tool: 'search_adverse_events', args: { drug_name: 'aspirin', limit: 3 } },
        { tool: 'get_drug_label_info', args: { drug_identifier: 'metformin' } },
        { tool: 'search_drug_recalls', args: { drug_name: 'acetaminophen', limit: 3 } }
    ];
    
    for (const toolTest of toolsToTest) {
        try {
            const result = await callTool(toolTest.tool, toolTest.args);
            test(`${toolTest.tool} returns valid response`, typeof result === 'object');
            test(`${toolTest.tool} has data source info`, result.data_source || result.api_endpoint);
        } catch (error) {
            test(`${toolTest.tool} API call failed`, false, error.message, 'successful response');
        }
    }
}

// Test error handling
async function testErrorHandling() {
    console.log('\n[TEST] Error Handling');
    
    // Test empty drug name
    try {
        const result = await callTool('search_drug_shortages', {
            drug_name: '',
            limit: 5
        });
        test('Empty drug name returns error', result.error && result.error.includes('provide a medication name'));
    } catch (error) {
        test('Empty drug name handled properly', false, error.message, 'error response');
    }
}

// Test batch analysis
async function testBatchAnalysis() {
    console.log('\n[TEST] Batch Analysis');
    
    try {
        const result = await callTool('batch_drug_analysis', {
            drug_list: ['metformin', 'aspirin'],
            include_trends: false
        });
        
        test('Batch analysis returns object', typeof result === 'object');
        test('Batch analysis has batch_info', result.batch_info && typeof result.batch_info === 'object');
        test('Batch analysis has drug_analyses array', Array.isArray(result.drug_analyses));
        test('Batch analysis has correct count', result.drug_analyses.length === 2);
        
    } catch (error) {
        test('Batch analysis API call failed', false, error.message, 'successful response');
    }
}

// Main test runner
async function runAllTests() {
    console.log('Certus FDA Drug Information MCP Server - Integration Test Suite');
    console.log('='.repeat(70));
    
    await testServerHealth();
    await testCoreTools();
    await testErrorHandling();
    await testBatchAnalysis();
    
    // Show final results
    console.log('\n' + '='.repeat(70));
    console.log(`[RESULTS] Test Results: ${passed} passed, ${failed} failed`);
    
    if (failed > 0) {
        console.log('\n[FAILED] Failed Tests:');
        errors.forEach(error => {
            console.log(`  - ${error.description}: ${error.error}`);
        });
        process.exit(1);
    } else {
        console.log('\n[SUCCESS] All tests passed!');
        process.exit(0);
    }
}

// Start the tests
runAllTests().catch(error => {
    console.error('[ERROR] Test runner crashed:', error);
    process.exit(1);
});