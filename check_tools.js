const fs = require('fs');
const content = fs.readFileSync('official-mcp-server.js', 'utf8');

// Extract only TOOL_DEFINITIONS array to exclude server metadata
const toolDefStart = content.indexOf('const TOOL_DEFINITIONS = [');
const toolDefEnd = content.indexOf('];', toolDefStart);

if (toolDefStart === -1 || toolDefEnd === -1) {
  console.error('Could not find TOOL_DEFINITIONS array');
  process.exit(1);
}

const toolDefSection = content.substring(toolDefStart, toolDefEnd);
const toolMatches = toolDefSection.match(/name: \"[^\"]+\"/g) || [];
const fdaToolCount = toolMatches.length;

console.log('Found', fdaToolCount, 'FDA tools in TOOL_DEFINITIONS');

if (fdaToolCount \!== 8) {
  console.error('Expected 8 FDA tools, found', fdaToolCount);
  console.log('Tools found:', toolMatches.join(', '));
  process.exit(1);
}
console.log('Correct FDA tool count (8 tools)');
EOF < /dev/null