# Drug Shortage MCP Server

Remote MCP server for FDA drug shortage information.

---

## 🚀 After Cleanup

Your project will be much cleaner with just the essential files. You'll have:

✅ One working server (mentioned in the `package.json`)

✅ Core functionality (`openfda-client.js`)

✅ Local testing capability (`stdio-wrapper.js`)

✅ Clean documentation (updated `README`)

This makes your project much more maintainable and easier to understand! 🎉

---

## Features

- Provides FDA drug shortage data via Model Context Protocol (MCP)
- Multiple server modes: official, manual, simple, HTTPS, stdio
- SSE (Server-Sent Events) support
- Secure (HTTPS) and HTTP endpoints
- Docker support

## Requirements

- Node.js >= 18.0.0

## Installation

1. Clone the repository:

   ```sh
   git clone <repo-url>
   cd Certus_server
   ```

2. Install dependencies:

   ```sh
   npm install
   ```

## Usage

### Start the Official MCP Server

```sh
npm start
# or
npm run start:official
```

### Start the Simple Server

```sh
npm run start:simple
```

### Start the Manual SSE Server

```sh
npm run start:manual
```

### Start the HTTPS Server

```sh
npm run start:https
```

### Start the Stdio Wrapper Server

```sh
npm run start:stdio
```

### Development Mode (with auto-reload)

```sh
npm run dev
```

### Run Tests

```sh
npm test
```

## Docker

Build and run with Docker:

```sh
docker build -t drug-shortage-mcp .
docker run -p 3000:3000 --env-file .env drug-shortage-mcp
```

## Scripts

- `npm run create-certs` – Generate HTTPS certificates
- `npm run inspect` – Inspect stdio server with MCP Inspector
- `npm run inspect:remote` – Inspect remote server with MCP Inspector

## Environment Variables

Create a `.env` file to set environment variables as needed.

## License

MIT
