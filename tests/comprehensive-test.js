#!/usr/bin/env node

/**
 * Comprehensive Test Suite for Certus FDA Drug Information MCP Server
 * 
 * Tests all 8 FDA tools with real data and validates:
 * - Trend analysis functionality (new implementation)
 * - Error handling and validation
 * - Response structure and data quality
 * - Performance and reliability
 * 
 * Usage: node tests/comprehensive-test.js
 */

import { strict as assert } from 'assert';
import fetch from 'node-fetch';

// Test configuration
// TODO: Replace with your own deployment URL when forking this repo
// Example: 'https://your-server.herokuapp.com/mcp' or 'http://localhost:3000/mcp'
const SERVER_URL = 'https://certus.opensource.mieweb.org/mcp';
const TIMEOUT = 30000;

// Test data - drugs we know have different shortage statuses
const drugsWithShortages = ['Lisdexamfetamine', 'carboplatin'];
const drugsWithoutShortages = ['metformin', 'aspirin', 'acetaminophen'];


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

// Test trend analysis with drugs that have shortages
async function testTrendsWithShortages() {
    console.log('\n[TEST] Testing Shortage Trend Analysis - Drugs With Shortages');
    
    for (const drug of drugsWithShortages) {
        try {
            const result = await callTool('analyze_drug_shortage_trends', {
                drug_name: drug,
                months_back: 12
            });

            // Check basic response structure
            test(`${drug} - Has drug name`, result.drug_name === drug);
            test(`${drug} - Has analysis period`, result.analysis_period_months === 12);
            test(`${drug} - Has current status`, typeof result.current_status === 'string');
            test(`${drug} - Has data source`, result.data_source === 'FDA Drug Shortages Database');
            test(`${drug} - Has timestamp`, result.timestamp && new Date(result.timestamp).getTime() > 0);
            
            // Check shortage details if present
            if (result.current_shortage) {
                test(`${drug} - Has duration days`, typeof result.current_shortage.duration_days === 'number');
                test(`${drug} - Duration is positive`, result.current_shortage.duration_days > 0);
                test(`${drug} - Has reason`, typeof result.current_shortage.reason === 'string');
                test(`${drug} - Has availability`, typeof result.current_shortage.availability === 'string');
            }
            
            // Check historical data if available
            if (result.historical_summary) {
                test(`${drug} - Has total events`, typeof result.historical_summary.total_shortage_events === 'number');
                test(`${drug} - Has first recorded`, typeof result.historical_summary.first_recorded === 'string');
                
                const validFrequencies = ['High', 'Moderate', 'Low'];
                test(`${drug} - Has frequency`, validFrequencies.includes(result.historical_summary.shortage_frequency));
            }
            
        } catch (error) {
            test(`${drug} - API call failed`, false, error.message, 'successful response');
        }
    }
}

// Test trend analysis with drugs without shortages
async function testTrendsWithoutShortages() {
    console.log('\n[TEST] Testing Shortage Trend Analysis - Drugs Without Shortages');
    
    for (const drug of drugsWithoutShortages) {
        try {
            const result = await callTool('analyze_drug_shortage_trends', {
                drug_name: drug,
                months_back: 6
            });

            test(`${drug} - Has drug name`, result.drug_name === drug);
            test(`${drug} - Shows no shortages`, result.current_status === 'No current shortages');
            test(`${drug} - No current shortage object`, !result.current_shortage);
            test(`${drug} - Has data source`, result.data_source === 'FDA Drug Shortages Database');
            
        } catch (error) {
            test(`${drug} - API call failed`, false, error.message, 'successful response');
        }
    }
}

// Test validation and error handling
async function testValidation() {
    console.log('\n[TEST] Testing Validation and Error Handling');
    
    // Test empty drug name
    try {
        const result = await callTool('analyze_drug_shortage_trends', {
            drug_name: '',
            months_back: 12
        });
        test('Empty drug name - Returns error', result.error && result.error.includes('provide a medication name'));
        test('Empty drug name - No examples field', result.examples === undefined);
        test('Empty drug name - No tip field', result.tip === undefined);
    } catch (error) {
        test('Empty drug name - API call failed', false, error.message, 'error response');
    }
    
    // Test invalid months_back
    try {
        const result = await callTool('analyze_drug_shortage_trends', {
            drug_name: 'metformin',
            months_back: 100
        });
        test('Invalid months - Returns error', result.error && result.error.includes('between 1 and 60 months'));
        test('Invalid months - Shows provided value', result.provided_months === 100);
    } catch (error) {
        test('Invalid months - API call failed', false, error.message, 'error response');
    }
}

// Test other core tools for baseline functionality
async function testCoreTools() {
    console.log('\n[TEST] Testing Core Tools');
    
    const toolsToTest = [
        { tool: 'search_drug_shortages', args: { drug_name: 'insulin', limit: 5 } },
        { tool: 'search_adverse_events', args: { drug_name: 'aspirin', limit: 3 } },
        { tool: 'get_drug_label_info', args: { drug_identifier: 'metformin' } },
        { tool: 'search_drug_recalls', args: { drug_name: 'acetaminophen', limit: 3 } }
    ];
    
    const toolsWithTimestamp = ['search_adverse_events', 'get_drug_label_info'];
    
    for (const toolTest of toolsToTest) {
        try {
            const result = await callTool(toolTest.tool, toolTest.args);
            test(`${toolTest.tool} - Returns valid response`, typeof result === 'object');
            
            // Only check timestamp for tools that have it
            if (toolsWithTimestamp.includes(toolTest.tool)) {
                test(`${toolTest.tool} - Has timestamp`, result.timestamp && new Date(result.timestamp).getTime() > 0);
            } else {
                test(`${toolTest.tool} - No timestamp field (optimized)`, result.timestamp === undefined);
            }
            
            test(`${toolTest.tool} - Has data source info`, result.data_source || result.api_endpoint);
        } catch (error) {
            test(`${toolTest.tool} - API call failed`, false, error.message, 'successful response');
        }
    }
}

// Test batch analysis
async function testBatchAnalysis() {
    console.log('\n[TEST] Testing Batch Analysis');
    
    try {
        const result = await callTool('batch_drug_analysis', {
            drug_list: ['metformin', 'insulin', 'aspirin'],
            include_trends: false
        });
        
        test('Batch analysis - Returns object', typeof result === 'object');
        test('Batch analysis - Has batch_info', result.batch_info && typeof result.batch_info === 'object');
        test('Batch analysis - Has drug_analyses array', Array.isArray(result.drug_analyses));
        test('Batch analysis - Has 3 drug analyses', result.drug_analyses.length === 3);
        test('Batch analysis - First analysis has drug name', result.drug_analyses[0] && result.drug_analyses[0].drug_name);
        test('Batch analysis - Total drugs matches', result.batch_info.total_drugs === 3);
        
    } catch (error) {
        test('Batch analysis - API call failed', false, error.message, 'successful response');
    }
}

// Test performance and response times
async function testPerformance() {
    console.log('\n[TEST] Testing Performance');
    
    const startTime = Date.now();
    
    try {
        await callTool('analyze_drug_shortage_trends', {
            drug_name: 'Lisdexamfetamine',
            months_back: 12
        });
        
        const responseTime = Date.now() - startTime;
        test('Trend analysis - Response time < 10s', responseTime < 10000, `${responseTime}ms`, '< 10000ms');
        test('Trend analysis - Response time < 5s', responseTime < 5000, `${responseTime}ms`, '< 5000ms');
        
    } catch (error) {
        test('Performance test - API call failed', false, error.message, 'successful response');
    }
}

// Main test runner
async function runAllTests() {
    console.log('Certus FDA Drug Information MCP Server - Comprehensive Test Suite');
    console.log('=' .repeat(70));
    
    // Test server health first
    console.log('\n[TEST] Testing Server Health');
    try {
        // TODO: Replace with your health endpoint when forking
        // Example: 'https://your-server.herokuapp.com/health'
        const healthResponse = await fetch('https://certus.opensource.mieweb.org/health');
        const healthData = await healthResponse.json();
        test('Server health - Returns healthy status', healthData.status === 'healthy');
        test('Server health - Has 8 tools', healthData.tools_available === 8);
    } catch (error) {
        test('Server health - Health check failed', false, error.message, 'healthy response');
    }
    
    // Run all the test suites
    await testTrendsWithShortages();
    await testTrendsWithoutShortages();
    await testValidation();
    await testCoreTools();
    await testBatchAnalysis();
    await testPerformance();
    
    // Show final results
    console.log('\n' + '=' .repeat(70));
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