import { spawn } from 'child_process';

async function testStdioWrapper() {
    console.log('🧪 Testing STDIO Wrapper for MCP Inspector');
    console.log('==========================================\n');

    const child = spawn('node', ['stdio-wrapper.js'], {
        stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let errorOutput = '';

    child.stdout.on('data', (data) => {
        output += data.toString();
    });

    child.stderr.on('data', (data) => {
        errorOutput += data.toString();
    });

    // Test tools/list
    console.log('📋 Testing tools/list...');
    const toolsListRequest = JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {}
    });

    child.stdin.write(toolsListRequest + '\n');

    // Wait for response
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test tools/call
    console.log('🔧 Testing tools/call...');
    const toolsCallRequest = JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
            name: "search_drug_shortages",
            arguments: {
                drug_name: "insulin",
                limit: 2
            }
        }
    });

    child.stdin.write(toolsCallRequest + '\n');

    // Wait for response
    await new Promise(resolve => setTimeout(resolve, 3000));

    child.kill();

    console.log('📤 STDOUT Output:');
    console.log(output || '(no output)');
    
    console.log('\n📤 STDERR Output:');
    console.log(errorOutput || '(no errors)');

    if (output.includes('"jsonrpc"') && output.includes('"tools"')) {
        console.log('\n✅ STDIO wrapper appears to be working!');
        console.log('💡 Ready for MCP Inspector testing');
    } else {
        console.log('\n❌ STDIO wrapper may have issues');
        console.log('💡 Check the output above for errors');
    }
}

testStdioWrapper().catch(console.error);