// Simple Remote MCP Server Example (Node.js)
// -------------------------------------------
// This script creates a basic web server using Node.js and the Express
// framework to demonstrate the Model Context Protocol (MCP). It exposes
// a single tool called "get_weather".
//
// Prerequisites:
// 1. Node.js and npm installed (https://nodejs.org/).
//
// How to Run:
// 1. Create a new folder for your project.
// 2. Save this code as `mcp_server.js` inside that folder.
// 3. Open your terminal in that folder and run `npm init -y` to create a package.json file.
// 4. Install Express by running: `npm install express`
// 5. Start the server by running: `node mcp_server.js`
// 6. The server will start on `http://127.0.0.1:5003`.

const express = require('express');
const app = express();
const PORT = 5003;

// Middleware to parse JSON bodies from incoming requests
app.use(express.json());

// --- MCP Spec Endpoint ---
// The LLM (e.g., Claude) calls this endpoint first to learn what tools
// this server provides. The response is a JSON object that describes
// the "tool rack" available.
app.get('/mcp/spec', (req, res) => {
  console.log("Received request for /mcp/spec");

  // This is the definition of our tool rack.
  // We are defining one tool: "get_weather".
  const spec = {
    mcp_version: "0.1",
    // Tool racks group related tools. You can have multiple racks.
    tool_racks: [{
      name: "weather_tools",
      description: "A set of tools to get weather information.",
      // The 'tools' array lists all tools in this rack.
      tools: [{
        name: "get_weather",
        description: "Get the current weather for a specific location.",
        // 'input_schema' defines the parameters the tool accepts.
        // We use a format compatible with JSON Schema.
        input_schema: {
          type: "object",
          properties: {
            location: {
              type: "string",
              description: "The city and state, e.g., 'San Francisco, CA'"
            }
          },
          required: ["location"]
        }
      }]
    }]
  };
  
  // NOTE on Authentication:
  // A real-world spec would also include an 'auth' section to define
  // how the LLM should authenticate with your service (e.g., OAuth 2.1).
  // We are omitting it here for simplicity.
  // Example auth block:
  // "auth": {
  //   "type": "oauth",
  //   "client_url": "https://your-service.com/oauth/authorize",
  //   "token_url": "https://your-service.com/oauth/token",
  //   "scope": "weather:read"
  // }

  res.json(spec);
});

// --- MCP Tool Use Endpoint ---
// After reviewing the spec, the LLM will call this endpoint to execute a
// specific tool. The request body will contain the tool name and parameters.
app.post('/mcp/tool/use', (req, res) => {
  console.log("Received request for /mcp/tool/use");

  // The request body contains the tool name and parameters
  const { tool_name, parameters } = req.body;
  
  if (!tool_name) {
    return res.status(400).json({ error: "Missing tool_name in request" });
  }

  console.log(`Tool requested: ${tool_name}`);
  console.log(`Parameters: ${JSON.stringify(parameters)}`);

  // NOTE on Authentication:
  // In a real application, you would verify an authentication token here
  // to ensure the caller is authorized to use this tool.

  // Logic to handle the specific tool requested
  if (tool_name === "get_weather") {
    const { location } = parameters;
    if (!location) {
      return res.status(400).json({ error: "Missing 'location' parameter for get_weather" });
    }

    // In a real application, you would call a weather API here.
    // For this example, we'll just return a hardcoded, structured response.
    const tool_output = {
      location: location,
      temperature: 24,
      units: "celsius",
      forecast: "partly cloudy with a chance of rain"
    };

    // The response must be a JSON object containing the tool's output.
    // The key 'output' is what the LLM will see as the result.
    return res.json({ output: tool_output });
  } else {
    // If the requested tool doesn't exist, return an error.
    return res.status(404).json({ error: `Tool '${tool_name}' not found.` });
  }
});

// Start the server and listen for incoming connections
app.listen(PORT, () => {
  console.log(`MCP server is running on http://127.0.0.1:${PORT}`);
});
