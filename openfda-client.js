const OPENFDA_API_KEY = process.env.OPENFDA_API_KEY;
const BASE_URL = "https://api.fda.gov";

// Core API endpoints
const ENDPOINTS = {
    DRUG_LABEL: `${BASE_URL}/drug/label.json`,
    DRUG_SHORTAGES: `${BASE_URL}/drug/shortages.json`,
    DRUG_ENFORCEMENT: `${BASE_URL}/drug/enforcement.json`,
    DRUG_EVENT: `${BASE_URL}/drug/event.json`
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
    // Enhanced input validation with helpful messages
    if (!drugName || typeof drugName !== 'string') {
        return {
            error: "Please provide a medication name to search for shortages",
            examples: ["Try: insulin, metformin, lisinopril, acetaminophen, or Tylenol"],
            tip: "Both generic names (acetaminophen) and brand names (Tylenol) work",
            timestamp: new Date().toISOString()
        };
    }

    if (!drugName.trim()) {
        return {
            error: "Medication name cannot be empty",
            examples: ["Try: insulin, metformin, lisinopril, acetaminophen, or Tylenol"],
            tip: "Both generic names and brand names are supported",
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

    // Enhanced no results message
    return {
        search_term: drugName,
        results: [],
        meta: { results: { total: 0 } },
        message: `No current shortages found for "${drugName}" - this is good news!`,
        note: "Try checking the generic name if you searched for a brand name, or vice versa",
        examples: ["If you searched 'Tylenol', try 'acetaminophen' or if you searched 'metformin', try 'Glucophage'"],
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
    // Enhanced input validation
    if (!drugIdentifier || typeof drugIdentifier !== 'string' || !drugIdentifier.trim()) {
        return {
            error: "Please provide a medication name to get FDA label information",
            examples: ["Try: metformin, atorvastatin, lisinopril, or Lipitor"],
            tip: "You can search by generic name (metformin) or brand name (Glucophage)",
            timestamp: new Date().toISOString()
        };
    }

    // Normalize the identifier type to fix LibreChat compatibility
    const normalizedType = normalizeIdentifierType(identifierType);
    
    const search = `${normalizedType}:"${drugIdentifier.trim()}"`;
    const params = buildParams(search, 1);
    
    const data = await makeRequest(ENDPOINTS.DRUG_LABEL, params);
    
    if (data.error) {
        return {
            search_term: drugIdentifier,
            identifier_type: normalizedType,
            original_identifier_type: identifierType, // Keep original for debugging
            error: data.error,
            suggestion: "Try searching with the alternative name (generic vs brand name)",
            examples: ["If you searched 'Tylenol', try 'acetaminophen' or if you searched 'metformin', try 'Glucophage'"],
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
    // Enhanced input validation
    if (!drugName || typeof drugName !== 'string' || !drugName.trim()) {
        return {
            error: "Please provide a medication name to search for recalls",
            examples: ["Try: insulin, acetaminophen, blood pressure medications"],
            tip: "Search works with both specific drug names and general medication categories",
            timestamp: new Date().toISOString()
        };
    }

    const cleanName = drugName.trim();

    // Try multiple search strategies for recalls
    const searchStrategies = [
        `product_description:"${cleanName}"`,
        `product_description:${cleanName}`,
        `openfda.generic_name:"${cleanName}"`,
        `openfda.brand_name:"${cleanName}"`
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

    // Enhanced no results message
    return {
        search_term: drugName,
        results: [],
        meta: { results: { total: 0 } },
        message: `No recalls found for "${drugName}" - this is good news!`,
        note: "Try searching with alternative names or check the spelling",
        examples: ["If you searched 'Tylenol', try 'acetaminophen' or try broader terms like 'pain medication'"],
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
    // Enhanced input validation
    if (!drugName || typeof drugName !== 'string' || !drugName.trim()) {
        return {
            error: "Please provide a medication name to analyze shortage trends",
            examples: ["Try: insulin, metformin, lisinopril"],
            tip: "Trend analysis works best with commonly prescribed medications",
            timestamp: new Date().toISOString()
        };
    }

    if (monthsBack < 1 || monthsBack > 60) {
        return {
            error: "Analysis period must be between 1 and 60 months",
            provided_months: monthsBack,
            tip: "Try 6 months for recent trends or 24 months for longer patterns",
            timestamp: new Date().toISOString()
        };
    }

    const params = buildParams(`"${drugName.trim()}"`, 100);
    const data = await makeRequest(ENDPOINTS.DRUG_SHORTAGES, params);
    
    if (data.error) {
        return {
            drug_name: drugName,
            analysis_period_months: monthsBack,
            error: data.error,
            suggestion: "Try using the generic name or check the spelling",
            examples: ["If you searched 'Tylenol', try 'acetaminophen'"],
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
    // Enhanced input validation
    if (!Array.isArray(drugList) || drugList.length === 0) {
        return {
            error: "Please provide a list of medication names for batch analysis",
            examples: [["insulin", "metformin", "lisinopril"], ["Tylenol", "Advil", "aspirin"]],
            tip: "You can mix generic and brand names in the same batch",
            timestamp: new Date().toISOString()
        };
    }

    if (drugList.length > 25) {
        return {
            error: "Maximum 25 medications allowed per batch analysis",
            provided_count: drugList.length,
            tip: "Try splitting your list into smaller batches for better performance",
            timestamp: new Date().toISOString()
        };
    }

    // Check for empty drug names
    const emptyDrugs = drugList.filter((drug, index) => 
        !drug || typeof drug !== 'string' || !drug.trim()
    );

    if (emptyDrugs.length > 0) {
        return {
            error: "All medication names must be valid non-empty strings",
            invalid_entries: emptyDrugs.length,
            tip: "Check your list for empty entries or invalid values",
            examples: ["Valid: ['insulin', 'metformin'] Invalid: ['insulin', '', null]"],
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
            analysis.error = `Failed to analyze ${drug}: ${error.message}`;
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
    // Enhanced input validation
    if (!drugIdentifier || typeof drugIdentifier !== 'string' || !drugIdentifier.trim()) {
        return {
            error: "Please provide a medication name to get the complete profile",
            examples: ["Try: metformin, atorvastatin, lisinopril, or Lipitor"],
            tip: "This combines FDA label data with current shortage information",
            timestamp: new Date().toISOString()
        };
    }

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
        profile.error = `Failed to get complete profile: ${error.message}`;
        profile.suggestion = "Try using the generic name or check the spelling";
    }

    return profile;
}

/**
 * Search for FDA adverse event reports (FAERS database)
 * Returns raw openFDA adverse event data with minimal processing
 */
export async function searchAdverseEvents(drugName, limit = 10) {
    // Enhanced input validation with helpful messages
    if (!drugName || typeof drugName !== 'string') {
        return {
            error: "Please provide a medication name to search for adverse events",
            examples: ["Try: aspirin, metformin, atorvastatin, ibuprofen, or Lipitor"],
            tip: "Both generic names (atorvastatin) and brand names (Lipitor) work",
            timestamp: new Date().toISOString()
        };
    }

    if (!drugName.trim()) {
        return {
            error: "Medication name cannot be empty for adverse event search",
            examples: ["Try: aspirin, metformin, atorvastatin, ibuprofen, or Lipitor"],
            tip: "This searches the FDA FAERS database for reported side effects",
            timestamp: new Date().toISOString()
        };
    }

    const cleanName = drugName.trim();
    
    // Define search strategies in order of preference for adverse events
    const searchStrategies = [
        // Most common - drug name in medicinal product field
        `patient.drug.medicinalproduct:"${cleanName}"`,
        
        // OpenFDA standardized fields
        `patient.drug.openfda.generic_name:"${cleanName}"`,
        `patient.drug.openfda.brand_name:"${cleanName}"`,
        
        // Broader search without quotes
        `patient.drug.medicinalproduct:${cleanName}`,
        
        // Active substance search
        `patient.drug.activesubstance.activesubstancename:"${cleanName}"`
    ];

    // Try each strategy until we get results
    for (const search of searchStrategies) {
        const params = buildParams(search, limit);
        const data = await makeRequest(ENDPOINTS.DRUG_EVENT, params);
        
        if (data.error && data.status !== 404) {
            continue; // Try next strategy on error
        }
        
        if (data.results && data.results.length > 0) {
            return {
                search_term: drugName,
                search_strategy: search,
                data_source: "FDA Adverse Event Reporting System (FAERS)",
                timestamp: new Date().toISOString(),
                api_endpoint: ENDPOINTS.DRUG_EVENT,
                note: "These are adverse events reported to FDA. Not all events are caused by the drug.",
                total_reports_available: data.meta?.results?.total || 0,
                ...data // Spread the raw openFDA response
            };
        }
    }

    // Enhanced no results message
    return {
        search_term: drugName,
        results: [],
        meta: { results: { total: 0 } },
        message: `No adverse events found in FDA database for "${drugName}"`,
        note: "This could mean the drug is very safe, very new, or try a different name",
        examples: ["If you searched 'Tylenol', try 'acetaminophen' or if you searched 'Advil', try 'ibuprofen'"],
        search_strategies_tried: searchStrategies,
        data_source: "FDA Adverse Event Reporting System (FAERS)",
        timestamp: new Date().toISOString(),
        api_endpoint: ENDPOINTS.DRUG_EVENT
    };
}

/**
 * Search for serious adverse events only
 * Returns only adverse events that resulted in hospitalization, death, disability, etc.
 */
export async function searchSeriousAdverseEvents(drugName, limit = 10) {
    // Enhanced input validation
    if (!drugName || typeof drugName !== 'string' || !drugName.trim()) {
        return {
            error: "Please provide a medication name to search for serious adverse events",
            examples: ["Try: warfarin, methotrexate, digoxin, lithium"],
            tip: "Serious events include death, hospitalization, life-threatening conditions, or disability",
            timestamp: new Date().toISOString()
        };
    }

    const cleanName = drugName.trim();
    
    // Search for serious adverse events only (serious:1)
    const search = `patient.drug.medicinalproduct:"${cleanName}" AND serious:1`;
    
    const params = buildParams(search, limit);
    const data = await makeRequest(ENDPOINTS.DRUG_EVENT, params);
    
    if (data.error) {
        return {
            search_term: drugName,
            error: data.error,
            suggestion: "Try using the generic name or check the spelling",
            examples: ["If you searched 'Coumadin', try 'warfarin'"],
            timestamp: new Date().toISOString(),
            api_endpoint: ENDPOINTS.DRUG_EVENT
        };
    }

    if (data.results && data.results.length > 0) {
        return {
            search_term: drugName,
            search_strategy: search,
            data_source: "FDA Adverse Event Reporting System (FAERS) - Serious Events Only",
            timestamp: new Date().toISOString(),
            api_endpoint: ENDPOINTS.DRUG_EVENT,
            warning: "These are serious adverse events that resulted in hospitalization, death, or disability",
            total_serious_reports: data.meta?.results?.total || 0,
            ...data
        };
    } else {
        return {
            search_term: drugName,
            results: [],
            meta: { results: { total: 0 } },
            message: `No serious adverse events found for "${drugName}" - this is encouraging!`,
            note: "The absence of serious adverse events suggests good safety profile",
            data_source: "FDA Adverse Event Reporting System (FAERS) - Serious Events Only",
            timestamp: new Date().toISOString(),
            api_endpoint: ENDPOINTS.DRUG_EVENT
        };
    }
}

/**
 * Health check function to verify API connectivity
 */
export async function healthCheck() {
    const testSearches = [
        { endpoint: ENDPOINTS.DRUG_LABEL, params: buildParams('openfda.generic_name:"aspirin"', 1) },
        { endpoint: ENDPOINTS.DRUG_SHORTAGES, params: buildParams('"test"', 1) },
        { endpoint: ENDPOINTS.DRUG_ENFORCEMENT, params: buildParams('product_description:"test"', 1) },
        { endpoint: ENDPOINTS.DRUG_EVENT, params: buildParams('patient.drug.medicinalproduct:"aspirin"', 1) }
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