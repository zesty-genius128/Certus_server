// remote-mcp-server.js
// Minimal MCP server implementation using Express

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Example MCP endpoint
app.post('/mcp', (req, res) => {
    // Echo back the request body as a simple test
    res.json({
        message: 'MCP endpoint reached',
        received: req.body
    });
});

// MCP-compliant tool list at root endpoint
app.get('/', (req, res) => {
    res.json({
        tools: [
            {
                name: "echo",
                description: "Echoes back the input provided.",
                endpoint: "/mcp",
                input_schema: {
                    type: "object",
                    properties: {
                        message: { type: "string" }
                    },
                    required: ["message"]
                },
                output_schema: {
                    type: "object",
                    properties: {
                        message: { type: "string" },
                        received: { type: "object" }
                    },
                    required: ["message", "received"]
                }
            },
            {
                name: "weather",
                description: "Returns the current weather for a given city.",
                endpoint: "/weather",
                input_schema: {
                    type: "object",
                    properties: {
                        city: { type: "string" }
                    },
                    required: ["city"]
                },
                output_schema: {
                    type: "object",
                    properties: {
                        city: { type: "string" },
                        weather: { type: "string" },
                        temperature_c: { type: "number" }
                    },
                    required: ["city", "weather", "temperature_c"]
                }
            }
        ]
    });
});

// MCP-compliant tool list at /v1/tools endpoint
app.get('/v1/tools', (req, res) => {
    res.json({
        tools: [
            {
                name: "echo",
                description: "Echoes back the input provided.",
                endpoint: "/mcp",
                input_schema: {
                    type: "object",
                    properties: {
                        message: { type: "string" }
                    },
                    required: ["message"]
                },
                output_schema: {
                    type: "object",
                    properties: {
                        message: { type: "string" },
                        received: { type: "object" }
                    },
                    required: ["message", "received"]
                }
            },
            {
                name: "weather",
                description: "Returns the current weather for a given city.",
                endpoint: "/weather",
                input_schema: {
                    type: "object",
                    properties: {
                        city: { type: "string" }
                    },
                    required: ["city"]
                },
                output_schema: {
                    type: "object",
                    properties: {
                        city: { type: "string" },
                        weather: { type: "string" },
                        temperature_c: { type: "number" }
                    },
                    required: ["city", "weather", "temperature_c"]
                }
            }
        ]
    });
});

// Weather tool endpoint
app.post('/weather', (req, res) => {
    const { city } = req.body;
    // Mock weather data
    res.json({
        city,
        weather: "Sunny",
        temperature_c: 25
    });
});

app.listen(PORT, () => {
    console.log(`Remote MCP server listening on port ${PORT}`);
});
