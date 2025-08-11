# Performance and Monitoring Guide

A comprehensive guide for monitoring, optimizing, and troubleshooting the performance of Certus OpenFDA MCP Server in production environments.

## Table of Contents

- [Current Performance Profile](#current-performance-profile)
- [Built-in Monitoring Features](#built-in-monitoring-features)
- [Health Check System](#health-check-system)
- [Cache Performance](#cache-performance)
- [Performance Optimization](#performance-optimization)
- [Load Testing](#load-testing)
- [Production Monitoring](#production-monitoring)
- [Alerting and Notifications](#alerting-and-notifications)
- [Troubleshooting Performance Issues](#troubleshooting-performance-issues)
- [Scaling Strategies](#scaling-strategies)

---

## Current Performance Profile

### **Baseline Performance Characteristics**

**Response Times (Typical):**
- **Cached responses**: 50-150ms (cache hit)
- **FDA API calls**: 500-2000ms (cache miss)
- **Health checks**: 100-500ms (all endpoints)
- **Tool schema requests**: <50ms (static data)

**Throughput Capacity:**
- **Without FDA API key**: 1,000 requests/day (shared rate limit)
- **With FDA API key**: 120,000 requests/day (dedicated limit)
- **Concurrent connections**: Limited by Node.js event loop (~10,000 theoretical)

**Memory Usage:**
- **Base server**: ~50-80MB RAM
- **Cache storage**: ~1KB per cached drug query
- **Peak usage**: ~100-200MB with active cache

### **Performance Characteristics by Tool**

| Tool | Typical Response Time | Cache TTL | Performance Notes |
|------|---------------------|-----------|-------------------|
| `search_drug_shortages` | 800-1500ms | 30 min | Fast-changing data, frequent API calls |
| `get_drug_label_info` | 600-1200ms | 24 hours | Large responses, heavy caching benefit |
| `search_drug_recalls` | 700-1400ms | None | No caching (safety-critical data) |
| `search_adverse_events` | 900-1800ms | 60 min | Balanced caching for safety vs performance |
| `search_serious_adverse_events` | 1000-2000ms | None | No caching (life-threatening data) |
| `analyze_drug_shortage_trends` | 1200-2500ms | 30 min | Complex queries, high API usage |
| `batch_drug_analysis` | 2000-10000ms | Mixed | Multiple API calls, varies by batch size |
| `get_medication_profile` | 1000-2000ms | Mixed | Combines multiple data sources |

---

## Built-in Monitoring Features

### **Real-Time Health Monitoring**

The server includes comprehensive health check capabilities:

```bash
# Check overall server health
curl https://certus.opensource.mieweb.org/health

# Example response
{
  "status": "healthy",
  "timestamp": "2024-08-11T10:30:00.000Z",
  "uptime": 86400,
  "memory_usage": {
    "used": 125829120,
    "total": 134217728
  },
  "api_health": {
    "timestamp": "2024-08-11T10:30:00.000Z",
    "api_key_configured": true,
    "endpoints": {
      "drug/label": { "status": 200, "available": true },
      "drug/shortages": { "status": 404, "available": true },
      "drug/enforcement": { "status": 200, "available": true },
      "drug/event": { "status": 200, "available": true }
    }
  }
}
```

### **Cache Performance Analytics**

Monitor cache effectiveness in real-time:

```bash
# Get cache statistics
curl https://certus.opensource.mieweb.org/cache-stats

# Example response
{
  "timestamp": "2024-08-11T10:30:00.000Z",
  "cache": {
    "totalEntries": 45,
    "memoryUsageApprox": 46080,
    "entriesByType": {
      "drug_labels": 12,
      "drug_shortages": 8,
      "drug_recalls": 0,
      "adverse_events": 25,
      "other": 0
    }
  }
}
```

### **Manual Cache Management**

```bash
# Trigger manual cache cleanup
curl -X POST https://certus.opensource.mieweb.org/cache-cleanup

# Example response
{
  "message": "Cache cleanup completed",
  "entries_removed": 7,
  "cache_before": { "totalEntries": 52 },
  "cache_after": { "totalEntries": 45 }
}
```

---

## Health Check System

### **Automated Health Monitoring**

The health check system validates all FDA API endpoints every request:

**Implementation Details:**
```javascript
// Health check validates 4 core FDA endpoints
const testSearches = [
    { endpoint: '/drug/label.json', test: 'aspirin' },
    { endpoint: '/drug/shortages.json', test: 'test query' },
    { endpoint: '/drug/enforcement.json', test: 'product search' },
    { endpoint: '/drug/event.json', test: 'adverse events' }
];
```

### **Health Check Interpretation**

**Status Codes:**
- **200**: Endpoint healthy and returning data
- **404**: Endpoint healthy but no results (normal for some queries)
- **503/500**: FDA API temporarily unavailable
- **Error**: Network or timeout issues

**Response Analysis:**
```bash
# Parse health check for monitoring
curl -s https://certus.opensource.mieweb.org/health | jq '.api_health.endpoints'
```

### **Production Health Monitoring Script**

```bash
#!/bin/bash
# Production health monitoring script

HEALTH_URL="https://certus.opensource.mieweb.org/health"
LOG_FILE="/var/log/certus-health.log"
ALERT_EMAIL="admin@example.com"

check_health() {
    local response=$(curl -s -w "%{http_code}" "$HEALTH_URL")
    local http_code="${response: -3}"
    local body="${response%???}"
    
    echo "$(date): HTTP $http_code" >> "$LOG_FILE"
    
    if [ "$http_code" != "200" ]; then
        echo "ALERT: Certus server health check failed" | mail -s "Server Alert" "$ALERT_EMAIL"
        return 1
    fi
    
    # Check if any FDA endpoints are down
    local endpoints_down=$(echo "$body" | jq -r '.api_health.endpoints[] | select(.available == false) | keys[]' 2>/dev/null)
    
    if [ -n "$endpoints_down" ]; then
        echo "WARNING: FDA endpoints down: $endpoints_down" >> "$LOG_FILE"
        echo "FDA API issues detected: $endpoints_down" | mail -s "FDA API Warning" "$ALERT_EMAIL"
    fi
    
    return 0
}

# Run every 5 minutes via cron
check_health
```

---

## Cache Performance

### **Cache Strategy Analysis**

The intelligent caching system balances medical safety with performance:

**Cache TTL Strategy:**
```javascript
const CACHE_TTL = {
    DRUG_LABELS: 24 * 60,      // 24 hours - static prescribing data
    DRUG_SHORTAGES: 30,        // 30 minutes - supply changes rapidly  
    DRUG_RECALLS: 12 * 60,     // NOT USED - safety-critical data
    ADVERSE_EVENTS: 60         // 1 hour - balance safety with performance
};
```

### **Cache Performance Metrics**

**Key Performance Indicators:**
- **Cache hit rate**: Target >60% for optimal performance
- **Memory usage**: Monitor growth and cleanup effectiveness
- **Entry distribution**: Balance across tool types
- **Cleanup efficiency**: Expired entries removed per cycle

**Cache Monitoring Dashboard:**
```bash
# Create simple cache monitoring
#!/bin/bash
while true; do
    echo "=== Cache Stats $(date) ==="
    curl -s https://certus.opensource.mieweb.org/cache-stats | jq '
        {
            total_entries: .cache.totalEntries,
            memory_mb: (.cache.memoryUsageApprox / 1024 / 1024 | round),
            by_type: .cache.entriesByType
        }'
    echo
    sleep 300  # Check every 5 minutes
done
```

### **Cache Optimization Recommendations**

**High Cache Hit Rate Strategies:**
1. **Common drug queries**: insulin, metformin, aspirin show high reuse
2. **Batch operations**: Process multiple related queries together
3. **Pre-warming**: Cache popular drugs during low-traffic periods
4. **TTL tuning**: Adjust based on usage patterns and data criticality

**Cache Size Management:**
```bash
# Monitor cache growth
watch -n 30 'curl -s https://certus.opensource.mieweb.org/cache-stats | 
             jq ".cache.totalEntries, .cache.memoryUsageApprox"'
```

---

## Performance Optimization

### **Current Optimizations**

**Built-in Performance Features:**
1. **Medical Safety-First Caching** - Intelligent TTL based on data criticality
2. **Connection Reuse** - HTTP keep-alive for FDA API calls  
3. **Response Compression** - gzip compression for all responses
4. **Memory Management** - Automatic cache cleanup every hour
5. **Request Optimization** - Multiple search strategy fallback with early termination

### **Application-Level Optimizations**

**Server Configuration:**
```javascript
// Production optimizations already implemented
app.use(compression());  // gzip compression
app.use(helmet());       // security headers  
app.use(morgan('combined')); // request logging

// Cache cleanup every hour
setInterval(cleanExpiredCache, 60 * 60 * 1000);
```

**Database Query Optimization:**
```javascript
// Intelligent search strategies reduce API calls
const searchStrategies = [
    { field: 'openfda.generic_name', value: drugName },
    { field: 'openfda.brand_name', value: drugName },
    // Stops at first successful result
];
```

### **Performance Tuning Recommendations**

**Environment Variables for Performance:**
```bash
# Production environment setup
NODE_ENV=production
OPENFDA_API_KEY=your_key_here  # Essential for rate limits
PORT=443

# Node.js performance tuning
NODE_OPTIONS="--max-old-space-size=512 --optimize-for-size"
```

**System-Level Optimizations:**
```bash
# Linux kernel tuning for high-connection scenarios
echo 'net.core.somaxconn = 65535' >> /etc/sysctl.conf
echo 'net.ipv4.tcp_max_syn_backlog = 65535' >> /etc/sysctl.conf
sysctl -p

# File descriptor limits
ulimit -n 65535
```

---

## Load Testing

### **Load Testing Strategy**

**Test Scenarios:**
1. **Baseline Load**: 10 concurrent users, mixed tool usage
2. **Peak Load**: 50 concurrent users, common drug queries  
3. **Stress Test**: 100+ concurrent users, cache-miss scenarios
4. **Endurance Test**: Sustained load over 24 hours

### **Load Testing Tools**

**Simple Load Test with curl:**
```bash
#!/bin/bash
# Simple concurrent load test
CONCURRENT=10
REQUESTS=100
URL="https://certus.opensource.mieweb.org/mcp"

# Test payload for drug shortage search
PAYLOAD='{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
        "name": "search_drug_shortages",
        "arguments": {"drug_name": "insulin", "limit": 5}
    }
}'

echo "Starting load test: $CONCURRENT concurrent, $REQUESTS requests each"
start_time=$(date +%s)

for i in $(seq 1 $CONCURRENT); do
    {
        for j in $(seq 1 $REQUESTS); do
            curl -s -X POST "$URL" \
                -H "Content-Type: application/json" \
                -d "$PAYLOAD" > /dev/null
        done
        echo "Worker $i completed"
    } &
done

wait
end_time=$(date +%s)
duration=$((end_time - start_time))
total_requests=$((CONCURRENT * REQUESTS))

echo "Load test completed:"
echo "Total requests: $total_requests"  
echo "Duration: $duration seconds"
echo "Requests per second: $((total_requests / duration))"
```

**Advanced Load Testing with Apache Bench:**
```bash
# Install apache2-utils for ab command
apt-get install apache2-utils

# Test health endpoint
ab -n 1000 -c 10 https://certus.opensource.mieweb.org/health

# Test with POST requests (requires temp file)
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_drug_shortages","arguments":{"drug_name":"insulin"}}}' > test.json
ab -n 100 -c 5 -p test.json -T "application/json" https://certus.opensource.mieweb.org/mcp
```

### **Load Testing with Artillery.js**

```bash
# Install Artillery.js
npm install -g artillery

# Create artillery test config
cat > load-test.yml << EOF
config:
  target: 'https://certus.opensource.mieweb.org'
  phases:
    - duration: 60
      arrivalRate: 5
    - duration: 300  
      arrivalRate: 10
    - duration: 60
      arrivalRate: 20
  payload:
    path: "test-drugs.csv"
    fields:
      - "drug_name"

scenarios:
  - name: "MCP Tool Calls"
    weight: 100
    flow:
      - post:
          url: "/mcp"
          headers:
            Content-Type: "application/json"
          json:
            jsonrpc: "2.0"
            id: 1
            method: "tools/call"
            params:
              name: "search_drug_shortages"
              arguments:
                drug_name: "{{ drug_name }}"
                limit: 5
EOF

# Create test data
echo "insulin,metformin,aspirin,acetaminophen,lisinopril" | tr ',' '\n' > test-drugs.csv

# Run load test
artillery run load-test.yml
```

### **Performance Benchmarking Results**

**Expected Performance Under Load:**
- **1-10 concurrent users**: <1000ms average response time
- **10-50 concurrent users**: 1000-3000ms average response time  
- **50+ concurrent users**: 2000-5000ms average response time
- **Cache hit scenarios**: 80% faster responses

---

## Production Monitoring

### **Comprehensive Monitoring Stack**

**System Metrics to Monitor:**
1. **Server Health**: CPU, Memory, Disk, Network
2. **Application Metrics**: Response times, error rates, throughput
3. **FDA API Health**: Endpoint availability, rate limit usage
4. **Cache Performance**: Hit rates, memory usage, cleanup cycles

### **Monitoring with Prometheus and Grafana**

**Prometheus Metrics Endpoint:**
```javascript
// Add to official-mcp-server.js for Prometheus integration
let requestCount = 0;
let requestDuration = [];

app.get('/metrics', (req, res) => {
    const cacheStats = getCacheStats();
    
    res.set('Content-Type', 'text/plain');
    res.send(`
# HELP certus_requests_total Total HTTP requests
# TYPE certus_requests_total counter
certus_requests_total ${requestCount}

# HELP certus_cache_entries Current cache entries
# TYPE certus_cache_entries gauge  
certus_cache_entries ${cacheStats.totalEntries}

# HELP certus_cache_memory_bytes Cache memory usage in bytes
# TYPE certus_cache_memory_bytes gauge
certus_cache_memory_bytes ${cacheStats.memoryUsageApprox}

# HELP certus_uptime_seconds Server uptime in seconds
# TYPE certus_uptime_seconds gauge
certus_uptime_seconds ${process.uptime()}
`);
});
```

**Docker Monitoring Setup:**
```bash
# docker-compose.yml for monitoring stack
version: '3.8'
services:
  certus:
    image: certus-server:latest
    ports:
      - "443:443"
    environment:
      - OPENFDA_API_KEY=${OPENFDA_API_KEY}
      
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
```

### **Application Performance Monitoring (APM)**

**Simple Custom APM Implementation:**
```javascript
// Performance monitoring middleware
const performanceMetrics = {
    requests: 0,
    errors: 0,
    responseTimes: [],
    startTime: Date.now()
};

app.use((req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        performanceMetrics.requests++;
        performanceMetrics.responseTimes.push(duration);
        
        if (res.statusCode >= 400) {
            performanceMetrics.errors++;
        }
        
        // Keep only last 1000 response times
        if (performanceMetrics.responseTimes.length > 1000) {
            performanceMetrics.responseTimes.shift();
        }
        
        // Log slow requests
        if (duration > 5000) {
            console.warn(`Slow request: ${req.method} ${req.path} took ${duration}ms`);
        }
    });
    
    next();
});

// Performance metrics endpoint
app.get('/performance', (req, res) => {
    const avgResponseTime = performanceMetrics.responseTimes.length > 0 
        ? performanceMetrics.responseTimes.reduce((a, b) => a + b, 0) / performanceMetrics.responseTimes.length 
        : 0;
        
    res.json({
        uptime: Date.now() - performanceMetrics.startTime,
        requests: performanceMetrics.requests,
        errors: performanceMetrics.errors,
        errorRate: performanceMetrics.requests > 0 ? (performanceMetrics.errors / performanceMetrics.requests) : 0,
        avgResponseTime: Math.round(avgResponseTime),
        currentCacheSize: getCacheStats().totalEntries
    });
});
```

### **Log Monitoring and Analysis**

**Structured Logging Implementation:**
```javascript
// Enhanced logging with structured data
const logger = {
    info: (component, data) => {
        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'INFO',
            component: component,
            ...data
        }));
    },
    
    error: (component, error, data = {}) => {
        console.error(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'ERROR', 
            component: component,
            error: error.message,
            stack: error.stack,
            ...data
        }));
    },
    
    performance: (tool, drug, duration, cached = false) => {
        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'PERFORMANCE',
            tool: tool,
            drug: drug,
            duration: duration,
            cached: cached,
            type: 'tool_execution'
        }));
    }
};
```

**Log Analysis with ELK Stack:**
```bash
# Elasticsearch query for performance analysis
curl -X GET "localhost:9200/certus-logs/_search" -H 'Content-Type: application/json' -d'
{
  "query": {
    "bool": {
      "must": [
        {"match": {"level": "PERFORMANCE"}},
        {"range": {"timestamp": {"gte": "now-1h"}}}
      ]
    }
  },
  "aggs": {
    "avg_duration": {
      "avg": {"field": "duration"}
    },
    "tools_performance": {
      "terms": {"field": "tool"},
      "aggs": {
        "avg_duration": {"avg": {"field": "duration"}}
      }
    }
  }
}'
```

---

## Alerting and Notifications

### **Critical Alerts Configuration**

**Health Check Failures:**
```bash
#!/bin/bash
# Alert script for health check failures
HEALTH_URL="https://certus.opensource.mieweb.org/health"
WEBHOOK_URL="https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"

check_and_alert() {
    local response=$(curl -s -w "%{http_code}" "$HEALTH_URL")
    local http_code="${response: -3}"
    
    if [ "$http_code" != "200" ]; then
        local alert_message="🚨 Certus Server Health Check Failed
        
Status Code: $http_code
Time: $(date)
Server: $HEALTH_URL

Please investigate immediately."

        # Send to Slack
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$alert_message\"}" \
            "$WEBHOOK_URL"
            
        # Send email
        echo "$alert_message" | mail -s "URGENT: Certus Server Down" admin@example.com
    fi
}

check_and_alert
```

**Performance Degradation Alerts:**
```bash
#!/bin/bash
# Monitor average response times
STATS_URL="https://certus.opensource.mieweb.org/performance"
THRESHOLD_MS=3000

check_performance() {
    local avg_response=$(curl -s "$STATS_URL" | jq -r '.avgResponseTime')
    
    if [ "$avg_response" -gt "$THRESHOLD_MS" ]; then
        echo "⚠️ Performance Alert: Average response time ${avg_response}ms exceeds threshold ${THRESHOLD_MS}ms" \
            | mail -s "Performance Degradation Alert" admin@example.com
    fi
}
```

### **Monitoring Dashboards**

**Simple HTML Status Dashboard:**
```html
<!DOCTYPE html>
<html>
<head>
    <title>Certus Server Status</title>
    <meta http-equiv="refresh" content="30">
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .healthy { color: green; }
        .unhealthy { color: red; }
        .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .metric-card { border: 1px solid #ccc; padding: 15px; border-radius: 5px; }
    </style>
</head>
<body>
    <h1>Certus Server Status</h1>
    <div id="status">Loading...</div>
    
    <script>
        async function updateStatus() {
            try {
                const [health, cache, performance] = await Promise.all([
                    fetch('/health').then(r => r.json()),
                    fetch('/cache-stats').then(r => r.json()),
                    fetch('/performance').then(r => r.json())
                ]);
                
                document.getElementById('status').innerHTML = `
                    <div class="metrics">
                        <div class="metric-card">
                            <h3>Server Health</h3>
                            <p class="${health.status === 'healthy' ? 'healthy' : 'unhealthy'}">
                                Status: ${health.status}
                            </p>
                            <p>Uptime: ${Math.round(health.uptime / 3600)}h</p>
                        </div>
                        
                        <div class="metric-card">
                            <h3>Cache Performance</h3>
                            <p>Entries: ${cache.cache.totalEntries}</p>
                            <p>Memory: ${Math.round(cache.cache.memoryUsageApprox / 1024)}KB</p>
                        </div>
                        
                        <div class="metric-card">
                            <h3>Request Performance</h3>
                            <p>Requests: ${performance.requests}</p>
                            <p>Avg Response: ${performance.avgResponseTime}ms</p>
                            <p>Error Rate: ${(performance.errorRate * 100).toFixed(2)}%</p>
                        </div>
                    </div>
                `;
            } catch (error) {
                document.getElementById('status').innerHTML = 
                    '<p class="unhealthy">Failed to load status</p>';
            }
        }
        
        updateStatus();
        setInterval(updateStatus, 30000);
    </script>
</body>
</html>
```

---

## Troubleshooting Performance Issues

### **Common Performance Problems**

**1. Slow Response Times**

**Symptoms:**
- Response times >3000ms consistently
- Client timeouts
- Users reporting sluggish performance

**Diagnostic Steps:**
```bash
# Check server health
curl -w "@curl-format.txt" -s https://certus.opensource.mieweb.org/health

# curl-format.txt:
#     time_namelookup:  %{time_namelookup}s\n
#         time_connect:  %{time_connect}s\n
#      time_appconnect:  %{time_appconnect}s\n
#     time_pretransfer:  %{time_pretransfer}s\n
#        time_redirect:  %{time_redirect}s\n
#   time_starttransfer:  %{time_starttransfer}s\n
#                     ----------\n
#           time_total:  %{time_total}s\n

# Check cache hit rates
curl -s https://certus.opensource.mieweb.org/cache-stats | jq '.cache.totalEntries'

# Monitor FDA API response times
time curl -s "https://api.fda.gov/drug/shortages.json?search=test&limit=1"
```

**Solutions:**
1. **Check FDA API rate limits** - verify API key configuration
2. **Analyze cache effectiveness** - low hit rates indicate suboptimal caching
3. **Review server resources** - CPU/memory constraints
4. **Network connectivity** - latency between server and FDA APIs

**2. Memory Issues**

**Symptoms:**
- Server crashes or restarts
- Growing memory usage over time  
- Cache cleanup not working effectively

**Diagnostic Commands:**
```bash
# Monitor memory usage
curl -s https://certus.opensource.mieweb.org/health | jq '.memory_usage'

# Check cache growth
watch -n 60 'curl -s https://certus.opensource.mieweb.org/cache-stats | jq ".cache.totalEntries"'

# Server-side memory monitoring  
top -p $(pgrep -f "node.*official-mcp-server")
```

**Solutions:**
1. **Trigger manual cache cleanup** - POST to /cache-cleanup
2. **Adjust cache TTL values** - reduce cache duration for high-volume scenarios
3. **Restart server** - temporary fix for memory leaks
4. **Resource allocation** - increase container/server memory limits

**3. High Error Rates**

**Symptoms:**
- Error rate >5% in performance metrics
- 500/503 status codes in health checks
- FDA API connectivity issues

**Investigation Process:**
```bash
# Check FDA API status
curl -I "https://api.fda.gov/drug/shortages.json?search=test&limit=1"

# Review server logs for errors
docker logs certus-server | grep ERROR | tail -20

# Test individual tool endpoints
curl -X POST https://certus.opensource.mieweb.org/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_drug_shortages","arguments":{"drug_name":"test"}}}'
```

### **Performance Optimization Checklist**

**Server Configuration:**
- [ ] FDA API key configured (120k requests vs 1k)
- [ ] Production environment variables set
- [ ] Cache TTL values optimized for usage patterns
- [ ] Compression enabled for responses
- [ ] Connection pooling configured

**System Resources:**
- [ ] Adequate RAM allocation (min 512MB recommended)
- [ ] CPU resources not consistently >80%
- [ ] Network bandwidth sufficient for FDA API calls
- [ ] Disk space available for logs and temporary files

**Monitoring Setup:**
- [ ] Health check endpoint accessible
- [ ] Cache statistics monitored regularly  
- [ ] Performance metrics tracked over time
- [ ] Alerting configured for critical thresholds

---

## Scaling Strategies

### **Horizontal Scaling**

**Load Balancer Configuration:**
```nginx
# Nginx load balancer for multiple Certus instances
upstream certus_backend {
    server certus1.example.com:443;
    server certus2.example.com:443;
    server certus3.example.com:443;
}

server {
    listen 80;
    server_name certus.example.com;
    
    location / {
        proxy_pass http://certus_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_connect_timeout 30s;
        proxy_read_timeout 60s;
    }
    
    location /health {
        proxy_pass http://certus_backend/health;
        proxy_connect_timeout 5s;
        proxy_read_timeout 10s;
    }
}
```

**Docker Swarm Scaling:**
```yaml
# docker-compose-swarm.yml
version: '3.8'
services:
  certus:
    image: certus-server:latest
    deploy:
      replicas: 3
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M
    environment:
      - OPENFDA_API_KEY=${OPENFDA_API_KEY}
    networks:
      - certus-network

networks:
  certus-network:
    external: true
```

### **Vertical Scaling**

**Resource Optimization:**
```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=2048" npm start

# Docker container with increased resources
docker run -d \
  --name certus-server \
  --memory=1g \
  --cpus=2 \
  -p 443:443 \
  certus-server:latest
```

### **Database-Backed Caching**

**Redis Implementation for Large-Scale Deployments:**
```javascript
// Redis cache implementation (future enhancement)
import redis from 'redis';

const redisClient = redis.createClient({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
});

async function getCachedOrFetchRedis(cacheKey, fetchFunction, ttlSeconds) {
    const cached = await redisClient.get(cacheKey);
    
    if (cached) {
        console.log(`Redis cache HIT for key: ${cacheKey}`);
        return JSON.parse(cached);
    }
    
    console.log(`Redis cache MISS for key: ${cacheKey}`);
    const freshData = await fetchFunction();
    
    await redisClient.setex(cacheKey, ttlSeconds, JSON.stringify(freshData));
    return freshData;
}
```

### **CDN Integration**

**CloudFlare Configuration:**
```javascript
// Add appropriate cache headers for CDN
app.use((req, res, next) => {
    if (req.path === '/health' || req.path === '/tools') {
        res.set('Cache-Control', 'public, max-age=300'); // 5 minutes
    }
    next();
});
```

---

## Advanced Performance Topics

### **Custom Metrics and Analytics**

**Business Metrics Tracking:**
```javascript
const businessMetrics = {
    toolUsage: new Map(),
    drugQueries: new Map(),
    userPatterns: new Map()
};

// Track tool usage patterns
function trackToolUsage(toolName, success, responseTime) {
    const key = toolName;
    const current = businessMetrics.toolUsage.get(key) || {
        calls: 0, 
        successes: 0, 
        totalTime: 0
    };
    
    businessMetrics.toolUsage.set(key, {
        calls: current.calls + 1,
        successes: current.successes + (success ? 1 : 0),
        totalTime: current.totalTime + responseTime
    });
}
```

### **A/B Testing for Performance**

**Performance Experiment Framework:**
```javascript
// A/B test different cache TTL values
const experiments = {
    cacheExperiment: {
        control: { ttl: 30 },      // 30 minutes
        variant: { ttl: 60 }       // 60 minutes  
    }
};

function getExperimentGroup(userId) {
    return parseInt(userId.slice(-1)) % 2 === 0 ? 'control' : 'variant';
}
```

### **Performance Budgets**

**Define Performance Targets:**
```javascript
const performanceBudgets = {
    responseTime: {
        p95: 2000,    // 95th percentile under 2 seconds
        p99: 5000     // 99th percentile under 5 seconds
    },
    errorRate: 0.01,  // Less than 1% error rate
    cacheHitRate: 0.6 // At least 60% cache hit rate
};
```

---

## Conclusion

This performance and monitoring guide provides comprehensive coverage of optimizing and monitoring the Certus OpenFDA MCP Server. Key takeaways:

**Performance Characteristics:**
- Response times: 50ms (cached) to 2000ms (FDA API calls)
- Throughput: 120,000 requests/day with API key
- Memory efficient: ~100-200MB with active cache

**Monitoring Strategy:**
- Built-in health checks and cache analytics
- Custom performance metrics and alerting
- Production-ready monitoring stack integration

**Optimization Approach:**
- Medical safety-first caching strategy
- Intelligent API request optimization  
- Resource usage monitoring and alerting

**Scaling Options:**
- Horizontal scaling with load balancers
- Vertical scaling for single-instance deployments
- Advanced caching with Redis for enterprise use

Regular monitoring and optimization ensure reliable, high-performance access to critical FDA drug information for healthcare professionals and applications.

---

**Last Updated:** August 11, 2025  
**Version:** 1.0.0  
**Next Review:** September 2025

For questions about performance optimization or monitoring setup, please visit the [GitHub repository](https://github.com/zesty-genius128/Certus_server) or review the [troubleshooting guide](troubleshooting-guide.md).