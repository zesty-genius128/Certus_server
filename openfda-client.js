const OPENFDA_API_KEY = process.env.OPENFDA_API_KEY;
const BASE_URL = "https://api.fda.gov";

// Core API endpoints
const ENDPOINTS = {
    DRUG_LABEL: `${BASE_URL}/drug/label.json`,
    DRUG_SHORTAGES: `${BASE_URL}/drug/shortages.json`,
    DRUG_ENFORCEMENT: `${BASE_URL}/drug/enforcement.json`
};

/**
 * Normalize identifier type to ensure openFDA compatibility
 * This fixes the LibreChat identifier mismatch issue
 */
function normalizeIdentifierType(identifierType) {
    const typeMapping = {
        'generic_name': 'openfda.generic_name',
        'brand_name': 'openfda.brand_name',
        'proprietary_name': 'openfda.brand_name',
        'openfda.generic_name': 'openfda.generic_name',
        'openfda.brand_name': 'openfda.brand_name'
    };
    
    return typeMapping[identifierType] || 'openfda.generic_name';
}

/**
 * Build query parameters for openFDA API
 */
function buildParams(search, limit = 10, additionalParams = {}) {
    const params = new URLSearchParams({
        search,
        limit: limit.toString(),
        ...additionalParams
    });
    
    if (OPENFDA_API_KEY) {
        params.append('api_key', OPENFDA_API_KEY);
    }
    
    return params;
}

/**
 * Generic API request handler
 */
async function makeRequest(url, params) {
    try {
        const response = await fetch(`${url}?${params}`, {
            timeout: 15000,
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'OpenFDA-MCP-Client/1.0'
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                return { 
                    results: [], 
                    meta: { results: { total: 0 } },
                    error: 'No results found',
                    status: 404 
                };
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        return {
            error: error.message,
            timestamp: new Date().toISOString(),
            endpoint: url
        };
    }
}

/**
 * Search for drug shortage information
 * Returns raw openFDA data with minimal processing
 */
export async function searchDrugShortages(drugName, limit = 10) {
    if (!drugName || typeof drugName !== 'string') {
        return {
            error: "Drug name is required and must be a string",
            timestamp: new Date().toISOString()
        };
    }

    const cleanName = drugName.trim();
    
    // Define search strategies in order of preference
    const searchStrategies = [
        `"${cleanName}"`,
        `generic_name:"${cleanName}"`,
        `proprietary_name:"${cleanName}"`,
        `openfda.generic_name:"${cleanName}"`,
        `openfda.brand_name:"${cleanName}"`
    ];

    // Try each strategy until we get results
    for (const search of searchStrategies) {
        const params = buildParams(search, limit);
        const data = await makeRequest(ENDPOINTS.DRUG_SHORTAGES, params);
        
        if (data.error && data.status !== 404) {
            continue; // Try next strategy on error
        }
        
        if (data.results && data.results.length > 0) {
            return {
                search_term: drugName,
                search_strategy: search,
                data_source: "FDA Drug Shortages Database",
                timestamp: new Date().toISOString(),
                api_endpoint: ENDPOINTS.DRUG_SHORTAGES,
                ...data // Spread the raw openFDA response
            };
        }
    }

    // No results found with any strategy
    return {
        search_term: drugName,
        results: [],
        meta: { results: { total: 0 } },
        message: `No shortages found for "${drugName}"`,
        search_strategies_tried: searchStrategies,
        data_source: "FDA Drug Shortages Database",
        timestamp: new Date().toISOString(),
        api_endpoint: ENDPOINTS.DRUG_SHORTAGES
    };
}

/**
 * Get drug label information
 * Returns raw openFDA label data
 */
export async function fetchDrugLabelInfo(drugIdentifier, identifierType = "openfda.generic_name") {
    // Normalize the identifier type to fix LibreChat compatibility
    const normalizedType = normalizeIdentifierType(identifierType);
    
    const search = `${normalizedType}:"${drugIdentifier}"`;
    const params = buildParams(search, 1);
    
    const data = await makeRequest(ENDPOINTS.DRUG_LABEL, params);
    
    if (data.error) {
        return {
            search_term: drugIdentifier,
            identifier_type: normalizedType,
            original_identifier_type: identifierType, // Keep original for debugging
            error: data.error,
            timestamp: new Date().toISOString(),
            api_endpoint: ENDPOINTS.DRUG_LABEL
        };
    }

    return {
        search_term: drugIdentifier,
        identifier_type: normalizedType,
        original_identifier_type: identifierType, // Keep original for debugging
        data_source: "FDA Drug Label Database",
        timestamp: new Date().toISOString(),
        api_endpoint: ENDPOINTS.DRUG_LABEL,
        ...data // Raw openFDA response
    };
}

/**
 * Search for drug recalls
 * Returns raw openFDA enforcement data
 */
export async function searchDrugRecalls(drugName, limit = 10) {
    // Try multiple search strategies for recalls
    const searchStrategies = [
        `product_description:"${drugName}"`,
        `product_description:${drugName}`,
        `openfda.generic_name:"${drugName}"`,
        `openfda.brand_name:"${drugName}"`
    ];

    for (const search of searchStrategies) {
        const params = buildParams(search, limit);
        const data = await makeRequest(ENDPOINTS.DRUG_ENFORCEMENT, params);
        
        if (data.error && data.status !== 404) {
            continue;
        }
        
        if (data.results && data.results.length > 0) {
            return {
                search_term: drugName,
                search_strategy: search,
                data_source: "FDA Drug Enforcement Database",
                timestamp: new Date().toISOString(),
                api_endpoint: ENDPOINTS.DRUG_ENFORCEMENT,
                ...data
            };
        }
    }

    return {
        search_term: drugName,
        results: [],
        meta: { results: { total: 0 } },
        message: `No recalls found for "${drugName}"`,
        search_strategies_tried: searchStrategies,
        data_source: "FDA Drug Enforcement Database",
        timestamp: new Date().toISOString(),
        api_endpoint: ENDPOINTS.DRUG_ENFORCEMENT
    };
}

/**
 * Analyze drug market trends
 * Simplified version focusing on raw data
 */
export async function analyzeDrugMarketTrends(drugName, monthsBack = 12) {
    const params = buildParams(`"${drugName}"`, 100);
    const data = await makeRequest(ENDPOINTS.DRUG_SHORTAGES, params);
    
    if (data.error) {
        return {
            drug_name: drugName,
            analysis_period_months: monthsBack,
            error: data.error,
            timestamp: new Date().toISOString()
        };
    }

    // Minimal processing - let Claude analyze the raw data
    return {
        drug_name: drugName,
        analysis_period_months: monthsBack,
        data_source: "FDA Drug Shortages Database",
        timestamp: new Date().toISOString(),
        api_endpoint: ENDPOINTS.DRUG_SHORTAGES,
        analysis_note: "Raw shortage records for trend analysis",
        ...data
    };
}

/**
 * Batch analysis of multiple drugs
 * Simplified to return raw results array
 */
export async function batchDrugAnalysis(drugList, includeTrends = false) {
    if (!Array.isArray(drugList) || drugList.length === 0) {
        return {
            error: "Drug list must be a non-empty array",
            timestamp: new Date().toISOString()
        };
    }

    if (drugList.length > 25) {
        return {
            error: "Maximum 25 drugs allowed per batch",
            timestamp: new Date().toISOString()
        };
    }

    const results = {
        batch_info: {
            total_drugs: drugList.length,
            include_trends: includeTrends,
            timestamp: new Date().toISOString()
        },
        drug_analyses: []
    };

    for (const drug of drugList) {
        const analysis = {
            drug_name: drug
        };

        try {
            // Get shortage data
            analysis.shortage_data = await searchDrugShortages(drug, 10);
            
            // Get recall data
            analysis.recall_data = await searchDrugRecalls(drug, 5);
            
            // Get trend data if requested
            if (includeTrends) {
                analysis.trend_data = await analyzeDrugMarketTrends(drug, 6);
            }
            
        } catch (error) {
            analysis.error = error.message;
        }

        results.drug_analyses.push(analysis);
    }

    return results;
}

/**
 * Get comprehensive medication profile
 * Combines label and shortage data with minimal processing
 */
export async function getMedicationProfile(drugIdentifier, identifierType = "openfda.generic_name") {
    // Normalize the identifier type to fix LibreChat compatibility
    const normalizedType = normalizeIdentifierType(identifierType);
    
    const profile = {
        search_info: {
            drug_identifier: drugIdentifier,
            identifier_type: normalizedType,
            original_identifier_type: identifierType, // Keep original for debugging
            timestamp: new Date().toISOString()
        }
    };

    try {
        // Get label information with normalized type
        profile.label_data = await fetchDrugLabelInfo(drugIdentifier, normalizedType);

        // Determine best term for shortage search
        let shortageSearchTerm = drugIdentifier;
        if (profile.label_data.results && profile.label_data.results[0]) {
            const firstResult = profile.label_data.results[0];
            if (firstResult.openfda && firstResult.openfda.generic_name) {
                shortageSearchTerm = firstResult.openfda.generic_name[0];
            }
        }

        // Get shortage information
        profile.shortage_data = await searchDrugShortages(shortageSearchTerm, 10);
        profile.shortage_search_term = shortageSearchTerm;

    } catch (error) {
        profile.error = error.message;
    }

    return profile;
}

/**
 * Health check function to verify API connectivity
 */
export async function healthCheck() {
    const testSearches = [
        { endpoint: ENDPOINTS.DRUG_LABEL, params: buildParams('openfda.generic_name:"aspirin"', 1) },
        { endpoint: ENDPOINTS.DRUG_SHORTAGES, params: buildParams('"test"', 1) },
        { endpoint: ENDPOINTS.DRUG_ENFORCEMENT, params: buildParams('product_description:"test"', 1) }
    ];

    const results = {};
    
    for (const test of testSearches) {
        const endpoint_name = test.endpoint.split('/').pop().replace('.json', '');
        try {
            const response = await fetch(`${test.endpoint}?${test.params}`, { timeout: 5000 });
            results[endpoint_name] = {
                status: response.status,
                available: response.status === 200 || response.status === 404
            };
        } catch (error) {
            results[endpoint_name] = {
                status: 'error',
                available: false,
                error: error.message
            };
        }
    }

    return {
        timestamp: new Date().toISOString(),
        api_key_configured: !!OPENFDA_API_KEY,
        endpoints: results
    };
}