# API Reference

Complete reference for all FDA drug information tools available through the Certus MCP Server.

## Overview

The Certus MCP Server provides 8 specialized tools for accessing FDA drug information databases. All tools follow the Model Context Protocol (MCP) specification and return raw FDA data with minimal processing to preserve medical accuracy.

**Base URL:** `https://certus.opensource.mieweb.org/mcp`  
**Protocol:** JSON-RPC 2.0 over HTTP POST  
**Authentication:** None required  

## Tool Categories

### Drug Safety & Shortage Information
- [`search_drug_shortages`](#search_drug_shortages) - Current FDA drug shortage database
- [`analyze_drug_shortage_trends`](#analyze_drug_shortage_trends) - Historical shortage pattern analysis

### Adverse Events & Safety Alerts
- [`search_adverse_events`](#search_adverse_events) - FDA adverse event reports (FAERS)
- [`search_serious_adverse_events`](#search_serious_adverse_events) - Serious adverse events only
- [`search_drug_recalls`](#search_drug_recalls) - FDA enforcement and recall database

### Drug Information & Labels
- [`get_drug_label_info`](#get_drug_label_info) - FDA structured product labeling
- [`get_medication_profile`](#get_medication_profile) - Combined label and shortage data

### Batch Analysis
- [`batch_drug_analysis`](#batch_drug_analysis) - Multi-drug analysis (up to 25 drugs)

---

## Tool Definitions

### `search_drug_shortages`

Search the FDA drug shortage database for current and resolved shortages.

**Use Cases:**
- "Check if insulin is in shortage"
- "Search for metformin shortages"
- "What drugs are currently in shortage?"

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `drug_name` | string | ✅ | - | Name of the drug to search (generic or brand name) |
| `limit` | integer | ❌ | 10 | Maximum results to return (1-50) |

**Example Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "search_drug_shortages",
    "arguments": {
      "drug_name": "insulin",
      "limit": 5
    }
  }
}
```

**Example Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\n  \"results\": [\n    {\n      \"generic_name\": \"insulin\",\n      \"brand_name\": \"Humulin\",\n      \"shortage_reason\": \"Increased demand\",\n      \"estimated_resolution_date\": \"2025-09-01\"\n    }\n  ]\n}"
      }
    ]
  }
}
```

---

### `search_adverse_events`

Search FDA Adverse Event Reporting System (FAERS) for reported side effects and reactions.

**Use Cases:**
- "What are the side effects of aspirin?"
- "Show adverse events for warfarin"
- "FDA safety reports for metformin"

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `drug_name` | string | ✅ | - | Name of the drug to search for adverse events |
| `limit` | integer | ❌ | 5 | Maximum adverse event reports to return (1-50) |
| `detailed` | boolean | ❌ | false | Return full raw FDA data (true) or summarized (false) |

**Example Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "search_adverse_events",
    "arguments": {
      "drug_name": "aspirin",
      "limit": 3,
      "detailed": false
    }
  }
}
```

---

### `search_serious_adverse_events`

Search serious adverse events only (death, hospitalization, disability).

**Use Cases:**
- "Show serious side effects of warfarin"
- "Fatal events reported for acetaminophen"
- "Hospitalizations from ibuprofen"

**Medical Safety Note:** This tool searches for serious outcomes only. Data is never cached to ensure current information for life-threatening situations.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `drug_name` | string | ✅ | - | Name of the drug to search for serious adverse events |
| `limit` | integer | ❌ | 5 | Maximum serious adverse event reports (1-50) |
| `detailed` | boolean | ❌ | false | Return full raw FDA data (true) or summarized (false) |

---

### `search_drug_recalls`

Search the FDA enforcement database for drug recalls and safety alerts.

**Use Cases:**
- "Has metformin been recalled?"
- "Search for insulin recalls"
- "Show recent drug safety alerts"

**Medical Safety Note:** Recall data is never cached to ensure immediate access to urgent safety information.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `drug_name` | string | ✅ | - | Drug name to search for recalls |
| `limit` | integer | ❌ | 10 | Maximum number of results (1-50) |

---

### `get_drug_label_info`

Retrieve FDA-approved prescribing information and structured product labeling.

**Use Cases:**
- "Get FDA label for metformin"
- "Show prescribing information for lisinopril"
- "What are the approved indications for aspirin?"

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `drug_identifier` | string | ✅ | - | The drug identifier to search for |
| `identifier_type` | string | ❌ | "openfda.generic_name" | Type of identifier to use |

**Identifier Types:**
- `openfda.generic_name` - OpenFDA generic name field
- `openfda.brand_name` - OpenFDA brand name field  
- `generic_name` - Direct generic name search
- `brand_name` - Direct brand name search

---

### `get_medication_profile`

Get combined medication overview with both FDA label data and current shortage status.

**Use Cases:**
- "Complete information about metformin"
- "Full profile for insulin including shortages"
- "Everything about lisinopril"

**Note:** This tool combines label and shortage data only. For adverse events, use the specific adverse event tools.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `drug_identifier` | string | ✅ | - | The drug identifier to search for |
| `identifier_type` | string | ❌ | "openfda.generic_name" | Type of identifier to use |

---

### `analyze_drug_shortage_trends`

Analyze historical FDA drug shortage patterns over specified time periods.

**Use Cases:**
- "Shortage trends for insulin over 12 months"
- "Historical shortage patterns for metformin"
- "Analyze shortage frequency for aspirin"

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `drug_name` | string | ✅ | - | Drug name to analyze |
| `months_back` | integer | ❌ | 12 | Number of months to analyze (1-60) |

**Analysis Output:**
- Total shortage events found
- Total duration in days
- Average shortage length
- Shortage frequency patterns
- Timeline of historical shortages

---

### `batch_drug_analysis`

Analyze multiple drugs simultaneously for shortages, recalls, and optional trend analysis.

**Use Cases:**
- "Analyze these drugs: insulin, metformin, lisinopril"
- "Check multiple diabetes medications for problems"
- "Batch analysis of cardiovascular drugs with trends"

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `drug_list` | array | ✅ | - | List of drug names to analyze (max 25) |
| `include_trends` | boolean | ❌ | false | Include trend analysis for each drug |

**Example Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "batch_drug_analysis",
    "arguments": {
      "drug_list": ["insulin", "metformin", "lisinopril"],
      "include_trends": true
    }
  }
}
```

---

## Response Format

All tools return responses in the standard MCP format:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Raw FDA API response data as JSON string"
      }
    ]
  }
}
```

### Error Responses

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32601,
    "message": "Error description"
  }
}
```

**Common Error Codes:**
- `-32601`: Method not found
- `-32602`: Invalid parameters
- `-32603`: Internal error (FDA API issues, network problems)

---

## Rate Limits

**Without FDA API Key:**
- 1,000 requests per day
- 40 requests per minute (burst)

**With FDA API Key:**
- 120,000 requests per day
- 240 requests per minute (sustained)

Get a free FDA API key at: https://open.fda.gov/apis/authentication/

---

## Data Sources

All tools connect to official FDA openFDA APIs:

| Tool Category | FDA Database | API Endpoint |
|---------------|--------------|--------------|
| Drug Shortages | FDA Drug Shortage Database | `/drug/shortages.json` |
| Drug Labels | FDA National Drug Code Directory | `/drug/label.json` |
| Drug Recalls | FDA Enforcement Reports | `/drug/enforcement.json` |
| Adverse Events | FDA Adverse Event Reporting System (FAERS) | `/drug/event.json` |

**Data Freshness:**
- **Always Fresh** (never cached): Drug recalls, serious adverse events
- **Cached** (with TTL): Drug labels (24h), drug shortages (30min), adverse events (1h)

---

## Medical Safety Disclaimers

⚠️ **Important Medical Safety Information:**

1. **Raw FDA Data**: All responses contain unprocessed FDA data to preserve medical accuracy
2. **No Medical Advice**: This server provides information only, not medical advice
3. **Emergency Information**: Recall and serious adverse event data is always current (never cached)
4. **Healthcare Professional Review**: All medication information should be reviewed by qualified healthcare professionals
5. **FDA Disclaimers**: Original FDA disclaimers and warnings are preserved in all responses

---

## Testing the API

### Direct HTTP Testing

```bash
# Test server health
curl https://certus.opensource.mieweb.org/health

# Test tool availability  
curl https://certus.opensource.mieweb.org/tools

# Test a specific tool
curl -X POST https://certus.opensource.mieweb.org/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "search_drug_shortages",
      "arguments": {"drug_name": "insulin", "limit": 3}
    }
  }'
```

### MCP Inspector Testing

```bash
# Test full MCP protocol compliance
npx @modelcontextprotocol/inspector https://certus.opensource.mieweb.org/mcp
```

For comprehensive testing procedures, see the [Testing Guide](testing-guide.md).

---

## Integration Examples

### MCP Client Integration

**Claude Desktop Configuration:**
```json
{
  "mcpServers": {
    "Certus": {
      "command": "npx",
      "args": ["mcp-remote", "https://certus.opensource.mieweb.org/mcp"]
    }
  }
}
```

**LibreChat Configuration:**
```yaml
mcpServers:
  Certus:
    command: node
    args: ["/path/to/stdio-wrapper.js"]
```

For detailed integration guides, see the [Deployment Guide](deployment-guide.md).