# Certus OpenFDA MCP Server - Final Project Report

**Duration:** May 31, 2025 - August 26, 2025 (3 months)  
**Type:** Summer Internship Project  
**Tech:** Node.js, Express, Docker, FDA APIs, MCP Protocol

## Project Summary

I built a drug information server that lets Claude and other AI tools look up current FDA data instead of using old information from training. You can try it at https://certus-chat.opensource.mieweb.org or add it to Claude Desktop using https://certus.opensource.mieweb.org/mcp.

Started with Python, switched to JavaScript, figured out how to connect different AI clients, dealt with government APIs, and got everything running in production. The server handles real users and has 8 different FDA tools working. Code is available at https://github.com/zesty-genius128/Certus_server.

## Quick Start (3 Ways to Test)

**Option 1 - Try the Chatbot Interface:**  
Visit https://certus-chat.opensource.mieweb.org and ask questions like "Is insulin in shortage?" or "What are metformin side effects?"

**Option 2 - Add to Claude Desktop:**  
Add this to your Claude Desktop MCP settings:
```json
{
  "mcpServers": {
    "certus": {
      "command": "npx",
      "args": ["mcp-remote", "https://certus.opensource.mieweb.org/mcp"]
    }
  }
}
```

**Option 3 - Deploy Your Own:**
```bash
git clone https://github.com/zesty-genius128/Certus_server.git
cd Certus_server
npm install
npm start
curl http://localhost:3000/health
```

**Docker option:**
```bash
docker run -d -p 3000:443 ghcr.io/zesty-genius128/certus_server:latest
```

## What I Built

I built an FDA drug information server that connects AI assistants to real FDA databases. The server uses the Model Context Protocol (MCP) so Claude and other AI tools can query current drug data instead of using old training information.

The project started as a Python server in the original repository (https://github.com/zesty-genius128/Certus) but I converted it to JavaScript for better performance and moved it to this repository for hosting deployment.

## Key Achievements

### Server Development
- **MCP Server**: Built JSON-RPC 2.0 server following MCP spec
- **8 FDA Tools**: Drug shortages, adverse events, recalls, labeling
- **HTTP Architecture**: Works with Claude Desktop, LibreChat, VS Code
- **Production Server**: Live and serving 1,000+ requests

### FDA Integration
- **Four APIs**: Connected to FDA drug databases
- **Smart Search**: Handles drug name variations and typos  
- **Error Messages**: Returns helpful responses when things break
- **Rate Limits**: 100 requests per 30 minutes

### Performance Work
- **Caching**: 24hr labels, 30min shortages, 1hr adverse events
- **Speed**: 13-41% faster responses with caching enabled
- **Memory**: Auto cleanup prevents crashes
- **Batch Processing**: Handle 25 drugs at once

## What Happened During Development

Here's what actually happened during development:

**May-June:** Started with a Python MCP server in the original Certus repository (https://github.com/zesty-genius128/Certus). Built initial FDA tools but Python was slow.

**June 17:** Converted entire system from Python to JavaScript. Built enhanced-mcp-server.js and drug-server.js with proper MCP SDK integration. JavaScript was noticeably faster.

**June 18-20:** Started testing Railway deployment but had connection issues with Claude Desktop. Spent days troubleshooting transport layers, SDK imports, and JSON-RPC errors. Finally got working solution with Express.js and manual HTTP handling.

**June 20:** Deployed to Proxmox server at Mieweb (opensource.mieweb.org) with Maxwell's help. Had initial connection issues but got it working with MCP Inspector.

**June 26:** Built LibreChat integration after solving transport compatibility issues. Created stdio wrapper to bridge LibreChat's stdio transport with the HTTP server. Deployed chatbot interface.

**July-August:** Added caching, rate limiting, and performance improvements. Fixed documentation and cleaned up code. Railway deployment stopped to preserve credits.

I spent significant time on protocol compatibility - different clients (Claude Desktop, LibreChat, VS Code) all handle MCP transport differently.

## What I Learned About MCP

MCP is more complicated than it looks. Different AI tools expect different connection types - Claude Desktop wants one thing, LibreChat wants another. I ended up building bridges to make everything work together.

The documentation assumes you already know a lot about server protocols. I had to figure out most of the practical stuff by trial and error and reading other people's code.

## What I Figured Out

I learned how to connect to government APIs that all work differently. I learned about caching - when to save data temporarily and when not to. I learned about deployment and keeping servers running for real users.

Most importantly, I learned that building something people can actually use is harder than just making it work on your laptop.

## Challenges I Hit

**Getting Claude Desktop to Connect:** Spent days figuring out why my server wouldn't talk to Claude. The examples online were different from what I built. Eventually found a workaround.

**FDA APIs Are Weird:** When there's no data, FDA APIs return error messages instead of empty results. Each API has different formats. Very inconsistent.

**Railway Ran Out of Money:** My hosting platform kept crashing and then ran out of free credits halfway through. Had to move everything to a different server and learn Docker.

**LibreChat Compatibility:** LibreChat wanted a completely different connection type than what I built. Had to write extra code to make it work.

**Medical Data Safety:** Had to be careful about caching. Drug information changes at different speeds - some things can wait, others need to be fresh.

## Files You Need

**Main server:** `official-mcp-server.js` - The HTTP server  
**FDA client:** `openfda-client.js` - Handles all FDA API calls  
**Stdio wrapper:** `stdio-wrapper.js` - For LibreChat compatibility  

**Test it:** `npm test` runs all the tools  
**Health check:** `/health` endpoint shows API status  
**Usage stats:** `/usage-stats` shows request counts

## Current Status

The server runs in production at Mieweb. It's handled 1,000+ requests without failing. All 8 FDA tools work. The caching saves 13-41% response time.

Railway deployment is stopped to save the $5 free credit. You can restart it with `railway up` if needed.

## Repository

**GitHub:** https://github.com/zesty-genius128/Certus_server  
**Live Demo:** https://certus-chat.opensource.mieweb.org  
**Production API:** https://certus.opensource.mieweb.org/mcp

The code is public. You can fork it and run your own server.