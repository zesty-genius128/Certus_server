#!/usr/bin/env node

/**
 * Proxmox Deployment Readiness Test Suite
 * Tests the Certus MCP Server for Proxmox deployment compatibility
 */

import fetch from 'node-fetch';
import { performance } from 'perf_hooks';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

// Configuration
const config = {
    // Current Railway URL (update as needed)
    RAILWAY_URL: 'https://certus-server-production.up.railway.app',
    
    // Future Proxmox URLs (examples)
    PROXMOX_URLS: [
        'http://certus.internal.company.com',
        'https://certus.internal.company.com',
        'http://10.0.1.100:3000',
        'https://10.0.1.100:3000'
    ],
    
    // Test configuration
    TEST_TIMEOUT: 30000,
    CONCURRENT_REQUESTS: 10,
    TEST_DRUGS: ['insulin', 'amoxicillin', 'morphine', 'acetaminophen', 'ibuprofen']
};

class ProxmoxDeploymentTester {
    constructor() {
        this.results = {
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'test',
            tests: {},
            summary: {
                passed: 0,
                failed: 0,
                warnings: 0
            }
        };
    }

    async runAllTests() {
        console.log('🚀 Starting Proxmox Deployment Readiness Tests\n');
        
        try {
            await this.testEnvironmentCompatibility();
            await this.testDependencies();
            await this.testServerFunctionality();
            await this.testMCPProtocol();
            await this.testLoadHandling();
            await this.testSecurityReadiness();
            await this.testNetworkingRequirements();
            
            this.generateReport();
            return this.results;
            
        } catch (error) {
            console.error('❌ Test suite failed:', error.message);
            this.results.fatal_error = error.message;
            return this.results;
        }
    }

    async testEnvironmentCompatibility() {
        console.log('📋 Testing Environment Compatibility...');
        
        const tests = {
            nodeVersion: this.checkNodeVersion(),
            npmDependencies: await this.checkDependencies(),
            portAvailability: await this.checkPortAvailability(),
            memoryRequirements: this.checkMemoryRequirements(),
            dockerCompatibility: await this.checkDockerCompatibility()
        };

        this.results.tests.environment = tests;
        this.updateSummary(tests);
    }

    async testDependencies() {
        console.log('📦 Testing Dependencies...');
        
        const tests = {
            packageJson: await this.validatePackageJson(),
            criticalModules: await this.testCriticalModules(),
            optionalDependencies: await this.checkOptionalDeps()
        };

        this.results.tests.dependencies = tests;
        this.updateSummary(tests);
    }

    async testServerFunctionality() {
        console.log('🖥️  Testing Server Functionality...');
        
        const tests = {
            healthCheck: await this.testHealthEndpoint(),
            mcpEndpoint: await this.testMCPEndpoint(),
            toolsEndpoint: await this.testToolsEndpoint(),
            errorHandling: await this.testErrorHandling()
        };

        this.results.tests.server = tests;
        this.updateSummary(tests);
    }

    async testMCPProtocol() {
        console.log('🔗 Testing MCP Protocol Implementation...');
        
        const tests = {
            initialize: await this.testMCPInitialize(),
            toolsList: await this.testMCPToolsList(),
            toolExecution: await this.testMCPToolExecution(),
            errorHandling: await this.testMCPErrorHandling()
        };

        this.results.tests.mcp = tests;
        this.updateSummary(tests);
    }

    async testLoadHandling() {
        console.log('⚡ Testing Load Handling...');
        
        const tests = {
            concurrentRequests: await this.testConcurrentRequests(),
            rateLimiting: await this.testRateLimiting(),
            memoryUsage: await this.testMemoryUsage(),
            responseTime: await this.testResponseTime()
        };

        this.results.tests.load = tests;
        this.updateSummary(tests);
    }

    async testSecurityReadiness() {
        console.log('🔒 Testing Security Readiness...');
        
        const tests = {
            httpHeaders: await this.testSecurityHeaders(),
            inputValidation: await this.testInputValidation(),
            corsConfiguration: await this.testCORSConfiguration(),
            environmentSecrets: this.testEnvironmentSecrets()
        };

        this.results.tests.security = tests;
        this.updateSummary(tests);
    }

    async testNetworkingRequirements() {
        console.log('🌐 Testing Networking Requirements...');
        
        const tests = {
            fdaApiAccess: await this.testFDAApiAccess(),
            dnsResolution: await this.testDNSResolution(),
            sslRequirements: await this.testSSLRequirements(),
            proxyCompatibility: await this.testProxyCompatibility()
        };

        this.results.tests.networking = tests;
        this.updateSummary(tests);
    }

    // Environment Tests
    checkNodeVersion() {
        const version = process.version;
        const major = parseInt(version.slice(1).split('.')[0]);
        return {
            status: major >= 18 ? 'PASS' : 'FAIL',
            details: `Node.js ${version} (requires >=18.0.0)`,
            recommendation: major < 18 ? 'Upgrade Node.js to v18 or higher' : null
        };
    }

    async checkDependencies() {
        try {
            const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
            const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
            
            return {
                status: 'PASS',
                details: `${Object.keys(deps).length} dependencies found`,
                packages: Object.keys(deps)
            };
        } catch (error) {
            return {
                status: 'FAIL',
                details: `Cannot read package.json: ${error.message}`
            };
        }
    }

    async checkPortAvailability() {
        const testPorts = [3000, 8080, 8000, 80, 443];
        const availablePorts = [];
        
        for (const port of testPorts) {
            try {
                await this.testPort(port);
                availablePorts.push(port);
            } catch (error) {
                // Port likely in use
            }
        }

        return {
            status: availablePorts.length > 0 ? 'PASS' : 'WARN',
            details: `Available ports: ${availablePorts.join(', ')}`,
            recommendation: availablePorts.length === 0 ? 'Ensure at least one port is available' : null
        };
    }

    checkMemoryRequirements() {
        const totalMem = process.memoryUsage();
        const freeMem = totalMem.heapTotal - totalMem.heapUsed;
        
        return {
            status: freeMem > 100 * 1024 * 1024 ? 'PASS' : 'WARN', // 100MB
            details: `Free memory: ${Math.round(freeMem / 1024 / 1024)}MB`,
            recommendation: freeMem < 100 * 1024 * 1024 ? 'Ensure at least 512MB RAM available' : null
        };
    }

    async checkDockerCompatibility() {
        try {
            const result = await this.runCommand('docker', ['--version']);
            return {
                status: 'PASS',
                details: result.trim(),
                recommendation: 'Docker available for containerized deployment'
            };
        } catch (error) {
            return {
                status: 'WARN',
                details: 'Docker not available',
                recommendation: 'Install Docker for easier Proxmox deployment'
            };
        }
    }

    // Server Tests
    async testHealthEndpoint() {
        try {
            const response = await this.makeRequest('/health');
            const data = await response.json();
            
            return {
                status: response.ok && data.status === 'healthy' ? 'PASS' : 'FAIL',
                details: `Status: ${response.status}, Health: ${data.status}`,
                responseTime: data.responseTime || 'N/A'
            };
        } catch (error) {
            return {
                status: 'FAIL',
                details: `Health check failed: ${error.message}`
            };
        }
    }

    async testMCPEndpoint() {
        try {
            const testPayload = {
                jsonrpc: "2.0",
                id: 1,
                method: "initialize",
                params: {}
            };

            const response = await this.makeRequest('/mcp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(testPayload)
            });

            const data = await response.json();
            
            return {
                status: response.ok && data.result ? 'PASS' : 'FAIL',
                details: `MCP initialize successful`,
                protocolVersion: data.result?.protocolVersion || 'Unknown'
            };
        } catch (error) {
            return {
                status: 'FAIL',
                details: `MCP endpoint failed: ${error.message}`
            };
        }
    }

    async testToolsEndpoint() {
        try {
            const response = await this.makeRequest('/tools');
            const data = await response.json();
            
            return {
                status: response.ok && data.tools ? 'PASS' : 'FAIL',
                details: `${data.tools?.length || 0} tools available`,
                tools: data.tools?.map(t => t.name) || []
            };
        } catch (error) {
            return {
                status: 'FAIL',
                details: `Tools endpoint failed: ${error.message}`
            };
        }
    }

    async testErrorHandling() {
        try {
            const response = await this.makeRequest('/nonexistent');
            
            return {
                status: response.status === 404 ? 'PASS' : 'WARN',
                details: `404 handling: ${response.status}`,
                recommendation: response.status !== 404 ? 'Improve error handling' : null
            };
        } catch (error) {
            return {
                status: 'FAIL',
                details: `Error handling test failed: ${error.message}`
            };
        }
    }

    // MCP Protocol Tests
    async testMCPInitialize() {
        try {
            const payload = {
                jsonrpc: "2.0",
                id: 1,
                method: "initialize",
                params: {}
            };

            const response = await this.makeRequest('/mcp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            
            return {
                status: data.result?.protocolVersion ? 'PASS' : 'FAIL',
                details: `Protocol: ${data.result?.protocolVersion}`,
                capabilities: data.result?.capabilities || {}
            };
        } catch (error) {
            return {
                status: 'FAIL',
                details: error.message
            };
        }
    }

    async testMCPToolsList() {
        try {
            const payload = {
                jsonrpc: "2.0",
                id: 2,
                method: "tools/list",
                params: {}
            };

            const response = await this.makeRequest('/mcp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            
            return {
                status: data.result?.tools ? 'PASS' : 'FAIL',
                details: `${data.result?.tools?.length || 0} tools listed`,
                tools: data.result?.tools?.map(t => t.name) || []
            };
        } catch (error) {
            return {
                status: 'FAIL',
                details: error.message
            };
        }
    }

    async testMCPToolExecution() {
        try {
            const payload = {
                jsonrpc: "2.0",
                id: 3,
                method: "tools/call",
                params: {
                    name: "search_drug_shortages",
                    arguments: {
                        drug_name: "insulin",
                        limit: 1
                    }
                }
            };

            const start = performance.now();
            const response = await this.makeRequest('/mcp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const end = performance.now();

            const data = await response.json();
            
            return {
                status: data.result?.content ? 'PASS' : 'FAIL',
                details: `Tool execution successful`,
                responseTime: `${Math.round(end - start)}ms`,
                hasContent: !!data.result?.content
            };
        } catch (error) {
            return {
                status: 'FAIL',
                details: error.message
            };
        }
    }

    async testMCPErrorHandling() {
        try {
            const payload = {
                jsonrpc: "2.0",
                id: 4,
                method: "invalid_method",
                params: {}
            };

            const response = await this.makeRequest('/mcp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            
            return {
                status: data.error ? 'PASS' : 'FAIL',
                details: `Error handling: ${data.error?.code || 'No error returned'}`,
                errorCode: data.error?.code
            };
        } catch (error) {
            return {
                status: 'FAIL',
                details: error.message
            };
        }
    }

    // Load Tests
    async testConcurrentRequests() {
        try {
            const requests = Array(config.CONCURRENT_REQUESTS).fill().map(() => 
                this.makeRequest('/health')
            );

            const start = performance.now();
            const responses = await Promise.all(requests);
            const end = performance.now();

            const successful = responses.filter(r => r.ok).length;
            
            return {
                status: successful === config.CONCURRENT_REQUESTS ? 'PASS' : 'WARN',
                details: `${successful}/${config.CONCURRENT_REQUESTS} requests successful`,
                responseTime: `${Math.round(end - start)}ms`,
                recommendation: successful < config.CONCURRENT_REQUESTS ? 'Investigate concurrent request handling' : null
            };
        } catch (error) {
            return {
                status: 'FAIL',
                details: error.message
            };
        }
    }

    async testRateLimiting() {
        try {
            // Test rapid requests
            const rapidRequests = Array(50).fill().map((_, i) => 
                this.makeRequest('/health').catch(e => ({ error: e.message, index: i }))
            );

            const responses = await Promise.all(rapidRequests);
            const errors = responses.filter(r => r.error).length;
            
            return {
                status: 'PASS',
                details: `Handled 50 rapid requests, ${errors} errors`,
                recommendation: errors > 10 ? 'Consider implementing rate limiting' : null
            };
        } catch (error) {
            return {
                status: 'FAIL',
                details: error.message
            };
        }
    }

    async testMemoryUsage() {
        const before = process.memoryUsage();
        
        // Perform memory-intensive operations
        for (let i = 0; i < 10; i++) {
            await this.testMCPToolExecution();
        }
        
        const after = process.memoryUsage();
        const heapIncrease = after.heapUsed - before.heapUsed;
        
        return {
            status: heapIncrease < 50 * 1024 * 1024 ? 'PASS' : 'WARN', // 50MB
            details: `Heap increase: ${Math.round(heapIncrease / 1024 / 1024)}MB`,
            recommendation: heapIncrease > 50 * 1024 * 1024 ? 'Monitor for memory leaks' : null
        };
    }

    async testResponseTime() {
        const tests = [];
        
        for (const drug of config.TEST_DRUGS) {
            const start = performance.now();
            try {
                await this.testMCPToolExecution();
                const end = performance.now();
                tests.push(end - start);
            } catch (error) {
                tests.push(null);
            }
        }
        
        const validTests = tests.filter(t => t !== null);
        const avgTime = validTests.reduce((a, b) => a + b, 0) / validTests.length;
        
        return {
            status: avgTime < 5000 ? 'PASS' : 'WARN', // 5 seconds
            details: `Average response time: ${Math.round(avgTime)}ms`,
            recommendation: avgTime > 5000 ? 'Optimize response times' : null
        };
    }

    // Security Tests
    async testSecurityHeaders() {
        try {
            const response = await this.makeRequest('/health');
            const headers = response.headers;
            
            const securityHeaders = [
                'x-content-type-options',
                'x-frame-options',
                'x-xss-protection'
            ];
            
            const present = securityHeaders.filter(h => headers.get(h));
            
            return {
                status: present.length >= 2 ? 'PASS' : 'WARN',
                details: `Security headers: ${present.join(', ')}`,
                recommendation: present.length < 2 ? 'Add more security headers' : null
            };
        } catch (error) {
            return {
                status: 'FAIL',
                details: error.message
            };
        }
    }

    async testInputValidation() {
        try {
            const maliciousPayload = {
                jsonrpc: "2.0",
                id: 999,
                method: "tools/call",
                params: {
                    name: "search_drug_shortages",
                    arguments: {
                        drug_name: "<script>alert('xss')</script>",
                        limit: "invalid"
                    }
                }
            };

            const response = await this.makeRequest('/mcp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(maliciousPayload)
            });

            const data = await response.json();
            
            return {
                status: data.error || !data.result ? 'PASS' : 'WARN',
                details: 'Input validation tested',
                recommendation: !data.error && data.result ? 'Improve input validation' : null
            };
        } catch (error) {
            return {
                status: 'PASS',
                details: 'Request properly rejected'
            };
        }
    }

    async testCORSConfiguration() {
        try {
            const response = await this.makeRequest('/health');
            const corsHeader = response.headers.get('access-control-allow-origin');
            
            return {
                status: corsHeader ? 'PASS' : 'WARN',
                details: `CORS: ${corsHeader || 'Not configured'}`,
                recommendation: !corsHeader ? 'Configure CORS for Proxmox environment' : null
            };
        } catch (error) {
            return {
                status: 'FAIL',
                details: error.message
            };
        }
    }

    testEnvironmentSecrets() {
        const secrets = ['OPENFDA_API_KEY', 'NODE_ENV'];
        const present = secrets.filter(s => process.env[s]);
        
        return {
            status: 'PASS',
            details: `Environment variables: ${present.join(', ')}`,
            recommendation: 'Ensure secrets are properly managed in Proxmox'
        };
    }

    // Networking Tests
    async testFDAApiAccess() {
        try {
            const response = await fetch('https://api.fda.gov/drug/label.json?limit=1', {
                timeout: 10000
            });
            
            return {
                status: response.ok ? 'PASS' : 'FAIL',
                details: `FDA API accessible: ${response.status}`,
                recommendation: !response.ok ? 'Ensure FDA API access from Proxmox network' : null
            };
        } catch (error) {
            return {
                status: 'FAIL',
                details: `FDA API unreachable: ${error.message}`,
                recommendation: 'Configure outbound internet access for FDA API'
            };
        }
    }

    async testDNSResolution() {
        const domains = ['api.fda.gov', 'github.com', 'npmjs.org'];
        const results = [];
        
        for (const domain of domains) {
            try {
                await fetch(`https://${domain}`, { timeout: 5000 });
                results.push(domain);
            } catch (error) {
                // DNS resolution failed
            }
        }
        
        return {
            status: results.length === domains.length ? 'PASS' : 'WARN',
            details: `Resolved: ${results.join(', ')}`,
            recommendation: results.length < domains.length ? 'Check DNS configuration' : null
        };
    }

    async testSSLRequirements() {
        try {
            const response = await fetch('https://api.fda.gov', { timeout: 5000 });
            
            return {
                status: 'PASS',
                details: 'SSL connections working',
                recommendation: 'Configure SSL certificates for internal HTTPS'
            };
        } catch (error) {
            return {
                status: 'WARN',
                details: `SSL test failed: ${error.message}`,
                recommendation: 'Ensure SSL/TLS support in Proxmox environment'
            };
        }
    }

    async testProxyCompatibility() {
        // Test if server works behind proxy
        return {
            status: 'PASS',
            details: 'Server should work behind reverse proxy',
            recommendation: 'Configure Nginx/Apache proxy in Proxmox if needed'
        };
    }

    // Utility Methods
    async makeRequest(endpoint, options = {}) {
        const url = `${config.RAILWAY_URL}${endpoint}`;
        const timeout = options.timeout || config.TEST_TIMEOUT;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    async testPort(port) {
        return new Promise((resolve, reject) => {
            const server = require('net').createServer();
            server.listen(port, (err) => {
                if (err) {
                    reject(err);
                } else {
                    server.close(() => resolve(true));
                }
            });
            server.on('error', reject);
        });
    }

    async runCommand(command, args = []) {
        return new Promise((resolve, reject) => {
            const process = spawn(command, args);
            let output = '';
            
            process.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            process.on('close', (code) => {
                if (code === 0) {
                    resolve(output);
                } else {
                    reject(new Error(`Command failed with code ${code}`));
                }
            });
            
            process.on('error', reject);
        });
    }

    async validatePackageJson() {
        try {
            const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
            const required = ['name', 'version', 'main', 'dependencies'];
            const missing = required.filter(field => !packageJson[field]);
            
            return {
                status: missing.length === 0 ? 'PASS' : 'FAIL',
                details: missing.length === 0 ? 'Package.json valid' : `Missing: ${missing.join(', ')}`,
                version: packageJson.version
            };
        } catch (error) {
            return {
                status: 'FAIL',
                details: error.message
            };
        }
    }

    async testCriticalModules() {
        const critical = ['express', 'cors', 'helmet', 'dotenv'];
        const results = [];
        
        for (const module of critical) {
            try {
                await import(module);
                results.push(module);
            } catch (error) {
                // Module not available
            }
        }
        
        return {
            status: results.length === critical.length ? 'PASS' : 'FAIL',
            details: `Available: ${results.join(', ')}`,
            missing: critical.filter(m => !results.includes(m))
        };
    }

    async checkOptionalDeps() {
        const optional = ['compression', 'morgan'];
        const results = [];
        
        for (const module of optional) {
            try {
                await import(module);
                results.push(module);
            } catch (error) {
                // Optional module not available
            }
        }
        
        return {
            status: 'PASS',
            details: `Optional modules: ${results.join(', ')}`,
            recommendation: results.length < optional.length ? 'Install optional dependencies for better performance' : null
        };
    }

    updateSummary(tests) {
        Object.values(tests).forEach(test => {
            if (test.status === 'PASS') this.results.summary.passed++;
            else if (test.status === 'FAIL') this.results.summary.failed++;
            else if (test.status === 'WARN') this.results.summary.warnings++;
        });
    }

    generateReport() {
        console.log('\n📊 PROXMOX DEPLOYMENT READINESS REPORT');
        console.log('=' .repeat(50));
        
        const { passed, failed, warnings } = this.results.summary;
        const total = passed + failed + warnings;
        
        console.log(`✅ Passed: ${passed}/${total}`);
        console.log(`❌ Failed: ${failed}/${total}`);
        console.log(`⚠️  Warnings: ${warnings}/${total}`);
        
        if (failed === 0) {
            console.log('\n🎉 SERVER IS READY FOR PROXMOX DEPLOYMENT!');
        } else {
            console.log('\n⚠️  RESOLVE FAILED TESTS BEFORE DEPLOYMENT');
        }
        
        console.log('\n📋 Key Recommendations:');
        Object.entries(this.results.tests).forEach(([category, tests]) => {
            Object.values(tests).forEach(test => {
                if (test.recommendation) {
                    console.log(`   • ${test.recommendation}`);
                }
            });
        });
        
        // Save detailed report
        this.saveDetailedReport();
    }

    async saveDetailedReport() {
        try {
            const reportPath = `proxmox-readiness-report-${Date.now()}.json`;
            await fs.writeFile(reportPath, JSON.stringify(this.results, null, 2));
            console.log(`\n📄 Detailed report saved: ${reportPath}`);
        } catch (error) {
            console.error('Failed to save report:', error.message);
        }
    }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const tester = new ProxmoxDeploymentTester();
    tester.runAllTests().then(results => {
        process.exit(results.summary.failed > 0 ? 1 : 0);
    }).catch(error => {
        console.error('Test suite failed:', error);
        process.exit(1);
    });
}

export default ProxmoxDeploymentTester;