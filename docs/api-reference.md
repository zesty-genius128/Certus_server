# API Reference

Information about the FDA APIs used by Certus.

## OpenFDA APIs

Certus connects to official FDA (Food and Drug Administration) databases through the OpenFDA API platform.

### API Endpoints Used

**Drug Shortages:**

- URL: `https://api.fda.gov/drug/shortage.json`
- Documentation: <https://open.fda.gov/apis/drug/shortage/>
- Purpose: Current drug shortage information

**Drug Labels:**

- URL: `https://api.fda.gov/drug/label.json`
- Documentation: <https://open.fda.gov/apis/drug/label/>
- Purpose: FDA-approved prescribing information

**Drug Enforcement (Recalls):**

- URL: `https://api.fda.gov/drug/enforcement.json`
- Documentation: <https://open.fda.gov/apis/drug/enforcement/>
- Purpose: Drug recalls and safety alerts

**Adverse Events (FAERS):**

- URL: `https://api.fda.gov/drug/event.json`
- Documentation: <https://open.fda.gov/apis/drug/event/>
- Purpose: Reported side effects and adverse reactions

### Rate Limits

- **Without API key:** 1,000 requests per day
- **With API key:** 120,000 requests per day
- **Get API key:** <https://open.fda.gov/apis/authentication/>

### Data Format

All APIs return JSON data in OpenFDA format. Certus preserves the original FDA data structure without modification to maintain medical accuracy.

### API Documentation

For detailed parameter documentation, search examples, and response formats, see:

**OpenFDA Official Documentation:** <https://open.fda.gov/apis/>

**Specific API Guides:**

- Drug Shortage API: <https://open.fda.gov/apis/drug/shortage/>
- Drug Label API: <https://open.fda.gov/apis/drug/label/>
- Drug Enforcement API: <https://open.fda.gov/apis/drug/enforcement/>
- Adverse Events API: <https://open.fda.gov/apis/drug/event/>

### Usage Notes

- All data comes directly from FDA databases
- No medical advice or interpretation is provided
- Data accuracy depends on FDA reporting
- Some drugs may not have data in all databases
- Historical data availability varies by API

## Server Endpoints

Certus provides these endpoints for testing and monitoring:

- `/health` - Server health and API status
- `/tools` - List available MCP tools
- `/mcp` - MCP protocol endpoint
- `/usage-stats` - Server usage statistics
- `/cache-stats` - Cache performance data
