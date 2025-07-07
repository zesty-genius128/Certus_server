/**
 * FAERS (FDA Adverse Event Reporting System) API Test Script
 * 
 * Tests the FDA adverse events endpoint before integrating into main server
 * Endpoint: https://api.fda.gov/drug/event.json
 * Documentation: https://open.fda.gov/apis/drug/event/
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const OPENFDA_API_KEY = process.env.OPENFDA_API_KEY;
const FAERS_ENDPOINT = "https://api.fda.gov/drug/event.json";

/**
 * Build query parameters for FAERS API
 */
function buildFAERSParams(search, limit = 10) {
    const params = new URLSearchParams({
        search,
        limit: limit.toString()
    });
    
    if (OPENFDA_API_KEY) {
        params.append('api_key', OPENFDA_API_KEY);
    }
    
    return params;
}

/**
 * Make request to FAERS API
 */
async function makeFAERSRequest(search, limit = 10) {
    try {
        const params = buildFAERSParams(search, limit);
        const url = `${FAERS_ENDPOINT}?${params}`;
        
        console.log(`🔍 Searching: ${search}`);
        console.log(`📡 URL: ${url.replace(/api_key=[^&]*/, 'api_key=***')}`);
        
        const response = await fetch(url, {
            timeout: 15000,
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'FAERS-Test-Client/1.0'
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                return { 
                    results: [], 
                    meta: { results: { total: 0 } },
                    error: 'No adverse events found',
                    status: 404 
                };
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        console.log(`✅ Found ${data.meta.results.total} total results, showing ${data.results?.length || 0}`);
        return data;

    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        return {
            error: error.message,
            timestamp: new Date().toISOString(),
            endpoint: FAERS_ENDPOINT
        };
    }
}

/**
 * Test different search strategies for adverse events
 */
async function testAdverseEventSearch(drugName, limit = 5) {
    console.log(`\n🧪 Testing Adverse Events for: "${drugName}"`);
    console.log('=' * 50);
    
    // Different search strategies based on FAERS fields
    const searchStrategies = [
        // Search in medicinal product name (most common)
        `patient.drug.medicinalproduct:"${drugName}"`,
        
        // Search in OpenFDA generic name
        `patient.drug.openfda.generic_name:"${drugName}"`,
        
        // Search in OpenFDA brand name  
        `patient.drug.openfda.brand_name:"${drugName}"`,
        
        // Broader search in medicinal product (without quotes)
        `patient.drug.medicinalproduct:${drugName}`,
        
        // Search active substance name
        `patient.drug.activesubstance.activesubstancename:"${drugName}"`
    ];

    for (const [index, search] of searchStrategies.entries()) {
        console.log(`\n📋 Strategy ${index + 1}: ${search}`);
        
        const data = await makeFAERSRequest(search, limit);
        
        if (data.error) {
            console.log(`   ❌ ${data.error}`);
            continue;
        }
        
        if (data.results && data.results.length > 0) {
            console.log(`   ✅ SUCCESS! Found ${data.results.length} adverse event reports`);
            
            // Show sample adverse event info
            const firstEvent = data.results[0];
            console.log(`   📊 Sample Event:`);
            console.log(`      • Report ID: ${firstEvent.safetyreportid || 'N/A'}`);
            console.log(`      • Serious: ${firstEvent.serious === '1' ? 'Yes' : firstEvent.serious === '2' ? 'No' : 'Unknown'}`);
            console.log(`      • Patient: ${getPatientInfo(firstEvent.patient)}`);
            console.log(`      • Reactions: ${getReactionInfo(firstEvent.patient?.reaction)}`);
            console.log(`      • Receipt Date: ${firstEvent.receiptdate || 'N/A'}`);
            
            // Return successful strategy for further testing
            return { search, data };
        } else {
            console.log(`   ❌ No results found`);
        }
    }
    
    console.log(`\n❌ No adverse events found for "${drugName}" with any search strategy`);
    return null;
}

/**
 * Extract patient information for display
 */
function getPatientInfo(patient) {
    if (!patient) return 'N/A';
    
    const age = patient.patientonsetage ? `${patient.patientonsetage} ${getAgeUnit(patient.patientonsetageunit)}` : 'Unknown age';
    const sex = patient.patientsex === '1' ? 'Male' : patient.patientsex === '2' ? 'Female' : 'Unknown sex';
    const weight = patient.patientweight ? `${patient.patientweight}kg` : '';
    
    return `${age}, ${sex}${weight ? `, ${weight}` : ''}`;
}

/**
 * Convert age unit codes to readable text
 */
function getAgeUnit(unit) {
    const units = {
        '800': 'decades',
        '801': 'years', 
        '802': 'months',
        '803': 'weeks',
        '804': 'days',
        '805': 'hours'
    };
    return units[unit] || 'unknown unit';
}

/**
 * Extract reaction information for display
 */
function getReactionInfo(reactions) {
    if (!reactions || !Array.isArray(reactions)) return 'N/A';
    
    const reactionTerms = reactions
        .map(r => r.reactionmeddrapt)
        .filter(Boolean)
        .slice(0, 3); // Show first 3 reactions
    
    return reactionTerms.length > 0 ? reactionTerms.join(', ') : 'N/A';
}

/**
 * Test serious adverse events specifically
 */
async function testSeriousAdverseEvents(drugName, limit = 5) {
    console.log(`\n⚠️  Testing SERIOUS Adverse Events for: "${drugName}"`);
    console.log('=' * 60);
    
    // Search for serious adverse events only
    const search = `patient.drug.medicinalproduct:"${drugName}" AND serious:1`;
    
    const data = await makeFAERSRequest(search, limit);
    
    if (data.error) {
        console.log(`❌ ${data.error}`);
        return;
    }
    
    if (data.results && data.results.length > 0) {
        console.log(`🚨 Found ${data.results.length} serious adverse event reports`);
        
        // Analyze types of serious events
        const seriousTypes = {};
        data.results.forEach(event => {
            if (event.seriousnessdeath === '1') seriousTypes.death = (seriousTypes.death || 0) + 1;
            if (event.seriousnesshospitalization === '1') seriousTypes.hospitalization = (seriousTypes.hospitalization || 0) + 1;
            if (event.seriousnesslifethreatening === '1') seriousTypes.lifeThreatening = (seriousTypes.lifeThreatening || 0) + 1;
            if (event.seriousnessdisabling === '1') seriousTypes.disability = (seriousTypes.disability || 0) + 1;
            if (event.seriousnessother === '1') seriousTypes.other = (seriousTypes.other || 0) + 1;
        });
        
        console.log(`📊 Serious Event Types:`);
        Object.entries(seriousTypes).forEach(([type, count]) => {
            console.log(`   • ${type}: ${count} reports`);
        });
        
    } else {
        console.log(`✅ No serious adverse events found for "${drugName}"`);
    }
}

/**
 * Test recent adverse events (last 2 years)
 */
async function testRecentAdverseEvents(drugName, limit = 5) {
    console.log(`\n📅 Testing RECENT Adverse Events for: "${drugName}"`);
    console.log('=' * 60);
    
    // Get date 2 years ago in YYYYMMDD format
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const dateString = twoYearsAgo.toISOString().slice(0, 10).replace(/-/g, '');
    
    const search = `patient.drug.medicinalproduct:"${drugName}" AND receiptdate:[${dateString} TO 20251231]`;
    
    const data = await makeFAERSRequest(search, limit);
    
    if (data.error) {
        console.log(`❌ ${data.error}`);
        return;
    }
    
    if (data.results && data.results.length > 0) {
        console.log(`📈 Found ${data.results.length} recent adverse event reports (last 2 years)`);
        
        // Show timeline of recent events
        const eventsByYear = {};
        data.results.forEach(event => {
            if (event.receiptdate) {
                const year = event.receiptdate.substring(0, 4);
                eventsByYear[year] = (eventsByYear[year] || 0) + 1;
            }
        });
        
        console.log(`📊 Events by Year:`);
        Object.entries(eventsByYear).sort().forEach(([year, count]) => {
            console.log(`   • ${year}: ${count} reports`);
        });
        
    } else {
        console.log(`✅ No recent adverse events found for "${drugName}"`);
    }
}

/**
 * Main test function
 */
async function runFAERSTests() {
    console.log('🧪 FAERS API Test Suite');
    console.log('========================');
    console.log(`API Key: ${OPENFDA_API_KEY ? '✅ Configured' : '❌ Not configured (using public limits)'}`);
    console.log(`Endpoint: ${FAERS_ENDPOINT}`);
    
    // Test drugs with known adverse events
    const testDrugs = [
        'aspirin',        // Should have many adverse events
        'metformin',      // Common diabetes drug
        'atorvastatin',   // Common statin
        'nonexistentdrug123' // Should have no results
    ];
    
    for (const drug of testDrugs) {
        // Test basic adverse event search
        const result = await testAdverseEventSearch(drug, 3);
        
        if (result) {
            // If we found results, test specific queries
            await testSeriousAdverseEvents(drug, 3);
            await testRecentAdverseEvents(drug, 3);
        }
        
        console.log('\n' + '🔹'.repeat(80));
    }
    
    console.log('\n✅ FAERS API testing completed!');
}

// Run the tests
if (import.meta.url === `file://${process.argv[1]}`) {
    runFAERSTests().catch(console.error);
}

export { testAdverseEventSearch, testSeriousAdverseEvents, testRecentAdverseEvents };