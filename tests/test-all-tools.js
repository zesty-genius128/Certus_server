/**
 * Test all tools in the Certus MCP server
 */

const SERVER_URL = process.env.SERVER_URL || 'https://certus-server-production.up.railway.app';

async function testTool(toolName, args, description) {
    console.log(`\nTesting: ${toolName}`);
    console.log(`${description}`);
    
    try {
        const response = await fetch(`${SERVER_URL}/mcp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: Date.now(),
                method: "tools/call",
                params: {
                    name: toolName,
                    arguments: args
                }
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            console.log(`Error: ${data.error.message}`);
            return false;
        }
        
        if (data.result && data.result.content) {
            const result = JSON.parse(data.result.content[0].text);
            console.log(`Success!`);
            
            // Display relevant info based on tool
            switch (toolName) {
                case 'search_drug_shortages':
                    console.log(`   Found ${result.returned_count || 0} shortages`);
                    if (result.summary) {
                        console.log(`   Summary: ${result.summary.recommendation}`);
                    }
                    break;
                    
                case 'get_medication_profile':
                    console.log(`   Status: ${result.overall_status || 'Unknown'}`);
                    if (result.label_information && !result.label_information.error) {
                        console.log(`   Generic Names: ${result.label_information.generic_name?.slice(0, 2).join(', ') || 'N/A'}`);
                    }
                    break;
                    
                case 'search_drug_recalls':
                    console.log(`   Found ${result.returned_count || 0} recalls`);
                    if (result.recalls && result.recalls.length > 0) {
                        console.log(`   Latest: ${result.recalls[0].reason_for_recall?.substring(0, 50) || 'N/A'}...`);
                    }
                    break;
                    
                case 'get_drug_label_info':
                    if (result.error) {
                        console.log(`   ${result.error}`);
                    } else {
                        console.log(`   Generic Names: ${result.openfda?.generic_name?.slice(0, 2).join(', ') || 'N/A'}`);
                        console.log(`   Manufacturers: ${result.openfda?.manufacturer_name?.slice(0, 2).join(', ') || 'N/A'}`);
                    }
                    break;
                    
                case 'analyze_drug_market_trends':
                    console.log(`   Events: ${result.total_shortage_events || 0}`);
                    console.log(`   Risk Level: ${result.market_insights?.risk_level || 'Unknown'}`);
                    console.log(`   Trend: ${result.trend_summary || 'N/A'}`);
                    break;
                    
                case 'batch_drug_analysis':
                    console.log(`   Analyzed: ${result.batch_summary?.total_drugs_analyzed || 0} drugs`);
                    console.log(`   High Risk: ${result.batch_summary?.high_risk_drugs || 0}`);
                    console.log(`   With Shortages: ${result.batch_summary?.drugs_with_shortages || 0}`);
                    console.log(`   With Recalls: ${result.batch_summary?.drugs_with_recalls || 0}`);
                    break;
            }
            
            return true;
        }
        
        console.log(`Unexpected response format`);
        return false;
        
    } catch (error) {
        console.log(`Error: ${error.message}`);
        return false;
    }
}

async function testServerHealth() {
    console.log(`Testing server health at ${SERVER_URL}...`);
    
    try {
        const response = await fetch(`${SERVER_URL}/health`);
        if (response.ok) {
            const data = await response.json();
            console.log(`Server healthy: ${data.service}`);
            console.log(`   Tools Available: ${data.tools_available || 'Unknown'}`);
            return true;
        } else {
            console.log(`Health check failed: ${response.status}`);
            return false;
        }
    } catch (error) {
        console.log(`Cannot reach server: ${error.message}`);
        return false;
    }
}

async function testListTools() {
    console.log(`\nTesting tools list...`);
    
    try {
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
        
        if (response.ok) {
            const data = await response.json();
            if (data.result && data.result.tools) {
                console.log(`Found ${data.result.tools.length} tools:`);
                data.result.tools.forEach((tool, index) => {
                    console.log(`   ${index + 1}. ${tool.name} - ${tool.description}`);
                });
                return data.result.tools;
            }
        }
        
        console.log(`Failed to list tools`);
        return [];
    } catch (error) {
        console.log(`Error listing tools: ${error.message}`);
        return [];
    }
}

async function main() {
    console.log('Certus MCP Server - Complete Tool Test');
    console.log('========================================');
    
    // Test server health
    const isHealthy = await testServerHealth();
    if (!isHealthy) {
        console.log('\nMake sure the server is running and accessible');
        process.exit(1);
    }
    
    // Test tools list
    const tools = await testListTools();
    if (tools.length === 0) {
        console.log('\nNo tools found - check server configuration');
        process.exit(1);
    }
    
    console.log('\nTesting All Tools');
    console.log('===================');
    
    const testResults = [];
    
    // Test 1: Drug Shortages
    testResults.push(await testTool(
        'search_drug_shortages',
        { drug_name: 'insulin', limit: 3 },
        'Search for insulin shortages'
    ));
    
    // Test 2: Medication Profile
    testResults.push(await testTool(
        'get_medication_profile',
        { drug_identifier: 'metformin' },
        'Get complete profile for metformin'
    ));
    
    // Test 3: Drug Recalls
    testResults.push(await testTool(
        'search_drug_recalls',
        { drug_name: 'acetaminophen', limit: 3 },
        'Search for acetaminophen recalls'
    ));
    
    // Test 4: Drug Label Info
    testResults.push(await testTool(
        'get_drug_label_info',
        { drug_identifier: 'lisinopril' },
        'Get FDA label info for lisinopril'
    ));
    
    // Test 5: Market Trends
    testResults.push(await testTool(
        'analyze_drug_market_trends',
        { drug_name: 'amoxicillin', months_back: 6 },
        'Analyze amoxicillin market trends (6 months)'
    ));
    
    // Test 6: Batch Analysis
    testResults.push(await testTool(
        'batch_drug_analysis',
        { 
            drug_list: ['insulin', 'metformin', 'lisinopril'], 
            include_trends: false 
        },
        'Batch analysis of 3 common medications'
    ));
    
    // Summary
    const passedTests = testResults.filter(result => result).length;
    const totalTests = testResults.length;
    
    console.log('\nTest Results Summary');
    console.log('======================');
    console.log(`Passed: ${passedTests}/${totalTests} tests`);
    
    if (passedTests === totalTests) {
        console.log('All tools are working perfectly!');
        console.log('\nYour Certus MCP server is ready for Claude Desktop integration');
    } else {
        console.log(`${totalTests - passedTests} test(s) failed`);
        console.log('\nCheck the errors above and verify your OpenFDA API connectivity');
    }
    
    console.log('\nMCP Endpoint for Claude:');
    console.log(`   ${SERVER_URL}/mcp`);
}

// Run tests
main().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
});