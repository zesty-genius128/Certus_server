#!/usr/bin/env node

/**
 * Simple stdio wrapper for Certus MCP server
 * This allows LibreChat/any client to use stdio transport to connect to the HTTP MCP server
 * if the npx mcp-remote format of the config file is not working then use this stdio wrapper
 * to then connect using the following config file format:
 * {
    "mcpServers": {
            "Certus": {
            "command": "node",
            "args": ["path/to/your/stdio-wrapper.js"]
            }
        }
    }
 */

process.stdin.setEncoding('utf8');
process.stdout.setEncoding('utf8');

const CERTUS_URL = 'https://certus.opensource.mieweb.org/mcp';

async function callCertusAPI(method, params = {}) {
  try {
    const response = await fetch(CERTUS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Math.random().toString(36),
        method,
        params
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(`Certus API error: ${error.message}`);
  }
}

// Handle stdin messages
process.stdin.on('data', async (data) => {
  try {
    const lines = data.trim().split('\n');
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      const request = JSON.parse(line);
      let response = {
        jsonrpc: "2.0",
        id: request.id
      };

      try {
        // Forward request to Certus server
        const certusResponse = await callCertusAPI(request.method, request.params);
        
        if (certusResponse.error) {
          response.error = certusResponse.error;
        } else {
          response.result = certusResponse.result;
        }
      } catch (error) {
        response.error = {
          code: -32603,
          message: error.message
        };
      }

      // Send response back via stdout
      process.stdout.write(JSON.stringify(response) + '\n');
    }
  } catch (error) {
    console.error('Parse error:', error);
    const errorResponse = {
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32700,
        message: "Parse error"
      }
    };
    process.stdout.write(JSON.stringify(errorResponse) + '\n');
  }
});

// Keep the process alive
process.stdin.resume();