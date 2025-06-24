import fetch from 'node-fetch';

// RxNorm API Base URL
const RXNORM_BASE_URL = 'https://rxnav.nlm.nih.gov/REST';

// Your existing MCP server URL
const MCP_SERVER_URL = 'https://certus-server-production.up.railway.app/mcp';

/**
 * Simple RxNorm API Functions
 */

// 1. Find RxCUI by drug name (most basic function)
async function findRxcuiByString(drugName) {
    try {
        const url = `${RXNORM_BASE_URL}/rxcui.json?name=${encodeURIComponent(drugName)}`;
        console.log(`Testing RxNorm API: ${url}`);
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.idGroup?.rxnormId) {
            return {
                success: true,
                rxcui: data.idGroup.rxnormId[0],
                drugName: drugName
            };
        }
        return { 
            success: false, 
            message: 'No RxCUI found', 
            drugName: drugName 
        };
    } catch (error) {
        return { 
            success: false, 
            error: error.message, 
            drugName: drugName 
        };
    }
}

// 2. Get basic drug information
async function getDrugInfo(rxcui) {
    try {
        const url = `${RXNORM_BASE_URL}/rxcui/${rxcui}/properties.json`;
        console.log(`Getting drug info: ${url}`);
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.properties) {
            return {
                success: true,
                rxcui: rxcui,
                drugInfo: data.properties
            };
        }
        return { 
            success: false, 
            message: 'No drug info found', 
            rxcui: rxcui 
        };
    } catch (error) {
        return { 
            success: false, 
            error: error.message, 
            rxcui: rxcui 
        };
    }
}

// 3. Test your existing MCP server
async function testMCPServer(drugName) {
    try {
        console.log(`Testing MCP server: ${MCP_SERVER_URL}`);
        
        const response = await fetch(MCP_SERVER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "tools/call",
                params: {
                    name: "search_drug_shortages",
                    arguments: {
                        drug_name: drugName,
                        limit: 3
                    }
                },
                id: 1
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return {
            success: true,
            data: data
        };
    } catch (error) {
        return { 
            success: false, 
            error: error.message
        };
    }
}

/**
 * Simple test function
 */
async function runSimpleTest() {
    console.log('Simple RxNorm + MCP Server Test');
    console.log('================================');
    console.log('RxNorm API:', RXNORM_BASE_URL);
    console.log('MCP Server:', MCP_SERVER_URL);
    console.log('');

    // Test with one simple drug
    const testDrug = 'insulin';
    console.log(`Testing with drug: ${testDrug}`);
    console.log('');

    // Step 1: Test RxNorm API
    console.log('Step 1: Testing RxNorm API...');
    const rxnormResult = await findRxcuiByString(testDrug);
    
    if (rxnormResult.success) {
        console.log('SUCCESS: Found RxCUI:', rxnormResult.rxcui);
        
        // Get drug info
        console.log('Getting drug information...');
        const drugInfo = await getDrugInfo(rxnormResult.rxcui);
        
        if (drugInfo.success) {
            console.log('SUCCESS: Got drug info');
            console.log('Drug name:', drugInfo.drugInfo.name);
            console.log('Drug synonym:', drugInfo.drugInfo.synonym);
        } else {
            console.log('FAILED: Could not get drug info');
            console.log('Error:', drugInfo.error || drugInfo.message);
        }
    } else {
        console.log('FAILED: Could not find RxCUI');
        console.log('Error:', rxnormResult.error || rxnormResult.message);
    }
    
    console.log('');

    // Step 2: Test your MCP server
    console.log('Step 2: Testing your MCP server...');
    const mcpResult = await testMCPServer(testDrug);
    
    if (mcpResult.success) {
        console.log('SUCCESS: MCP server responded');
        
        if (mcpResult.data.result?.content?.[0]?.text) {
            const shortageData = JSON.parse(mcpResult.data.result.content[0].text);
            console.log('Shortage records found:', shortageData.total_found || 0);
            console.log('Search term used:', shortageData.search_term);
        } else {
            console.log('MCP response structure:', JSON.stringify(mcpResult.data, null, 2));
        }
    } else {
        console.log('FAILED: MCP server error');
        console.log('Error:', mcpResult.error);
    }

    console.log('');
    console.log('Test Results Summary:');
    console.log('--------------------');
    console.log('RxNorm API:', rxnormResult.success ? 'WORKING' : 'FAILED');
    console.log('MCP Server:', mcpResult.success ? 'WORKING' : 'FAILED');
    
    if (rxnormResult.success && mcpResult.success) {
        console.log('');
        console.log('CONCLUSION: Both APIs are working!');
        console.log('Ready to integrate RxNorm into your MCP server.');
        console.log('');
        console.log('Next steps:');
        console.log('1. Add RxNorm functions to openfda-client.js');
        console.log('2. Create new MCP tools that combine both data sources');
        console.log('3. Test with more complex drug names');
    } else {
        console.log('');
        console.log('CONCLUSION: Issues detected.');
        if (!rxnormResult.success) {
            console.log('- Fix RxNorm API connectivity');
        }
        if (!mcpResult.success) {
            console.log('- Fix MCP server connectivity');
        }
    }
}

// Test additional drugs if basic test passes
async function runExtendedTest() {
    console.log('');
    console.log('Extended Test - Multiple Drugs');
    console.log('==============================');
    
    const testDrugs = ['aspirin', 'metformin', 'lisinopril'];
    
    for (const drug of testDrugs) {
        console.log(`Testing ${drug}...`);
        
        const rxnormResult = await findRxcuiByString(drug);
        const mcpResult = await testMCPServer(drug);
        
        console.log(`  RxNorm: ${rxnormResult.success ? 'OK' : 'FAILED'}`);
        console.log(`  MCP: ${mcpResult.success ? 'OK' : 'FAILED'}`);
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
    }
}

// Run the tests
async function main() {
    try {
        await runSimpleTest();
        
        // Ask if user wants extended test
        console.log('');
        console.log('Run extended test with more drugs? (Ctrl+C to skip)');
        
        // Wait 3 seconds, then run extended test
        setTimeout(async () => {
            await runExtendedTest();
            console.log('');
            console.log('All tests completed!');
        }, 3000);
        
    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

main();