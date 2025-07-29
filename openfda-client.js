const OPENFDA_API_KEY = process.env.OPENFDA_API_KEY;
const BASE_URL = "https://api.fda.gov";

// In-memory cache for FDA API responses
const cache = new Map();

// Cache TTL settings (in minutes)
const CACHE_TTL = {
    DRUG_LABELS: 24 * 60,      // 24 hours - static data
    DRUG_SHORTAGES: 2 * 60,    // 2 hours - frequently changing
    DRUG_RECALLS: 12 * 60,     // 12 hours - semi-static
    ADVERSE_EVENTS: 6 * 60     // 6 hours - balance freshness/performance
};

// Core API endpoints
const ENDPOINTS = {
    DRUG_LABEL: `${BASE_URL}/drug/label.json`,
    DRUG_SHORTAGES: `${BASE_URL}/drug/shortages.json`,
    DRUG_ENFORCEMENT: `${BASE_URL}/drug/enforcement.json`,
    DRUG_EVENT: `${BASE_URL}/drug/event.json`
};

/**
 * Validate drug name input with helpful error messages
 * @param {string} drugName - The drug name to validate
 * @param {string} context - Context for error message (e.g., "shortages", "recalls")
 * @returns {Object|null} - Returns error object if invalid, null if valid
 */
function validateDrugName(drugName, context = "drug information") {
    if (!drugName || typeof drugName !== 'string' || !drugName.trim()) {
        const examples = {
            "shortages": ["Try: insulin, metformin, lisinopril, acetaminophen, or Tylenol"],
            "recalls": ["Try: insulin, acetaminophen, blood pressure medications"],
            "trends": ["Try: insulin, metformin, lisinopril"],
            "adverse events": ["Try: aspirin, metformin, atorvastatin, ibuprofen, or Lipitor"],
            "serious adverse events": ["Try: warfarin, methotrexate, digoxin, lithium"],
            "drug information": ["Try: metformin, atorvastatin, lisinopril, or Lipitor"]
        };
        
        return {
            error: `Please provide a medication name to search for ${context}`
        };
    }
    return null;
}

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
 * Check if cached data is still valid
 * @param {Object} cacheItem - Cache entry with data and timestamp
 * @param {number} ttlMinutes - Time to live in minutes
 * @returns {boolean} - True if cache is valid
 */
function isCacheValid(cacheItem, ttlMinutes) {
    if (!cacheItem) return false;
    const now = Date.now();
    const age = (now - cacheItem.timestamp) / (1000 * 60); // age in minutes
    return age < ttlMinutes;
}

/**
 * Clean expired entries from cache
 * Removes entries that have exceeded their TTL for any cache type
 */
function cleanExpiredCache() {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, item] of cache.entries()) {
        // Determine TTL based on cache key prefix
        let ttlMinutes;
        if (key.startsWith('drug_label_')) {
            ttlMinutes = CACHE_TTL.DRUG_LABELS;
        } else if (key.startsWith('drug_shortage_')) {
            ttlMinutes = CACHE_TTL.DRUG_SHORTAGES;
        } else if (key.startsWith('drug_recall_')) {
            ttlMinutes = CACHE_TTL.DRUG_RECALLS;
        } else if (key.startsWith('adverse_event_')) {
            ttlMinutes = CACHE_TTL.ADVERSE_EVENTS;
        } else {
            // Default to shortest TTL for unknown keys
            ttlMinutes = CACHE_TTL.DRUG_SHORTAGES;
        }
        
        // Check if expired and remove
        if (!isCacheValid(item, ttlMinutes)) {
            cache.delete(key);
            cleanedCount++;
            console.log(`Cleaned expired cache key: ${key}`);
        }
    }
    
    if (cleanedCount > 0) {
        console.log(`Cache cleanup completed: ${cleanedCount} expired entries removed, ${cache.size} entries remaining`);
    }
}

/**
 * Get cache statistics for monitoring
 * @returns {Object} Cache statistics including size, hit rates, memory usage
 */
function getCacheStats() {
    const stats = {
        totalEntries: cache.size,
        memoryUsageApprox: cache.size * 1024, // Rough estimate in bytes
        entriesByType: {
            drug_labels: 0,
            drug_shortages: 0,
            drug_recalls: 0,
            adverse_events: 0,
            other: 0
        }
    };
    
    // Count entries by type
    for (const key of cache.keys()) {
        if (key.startsWith('drug_label_')) {
            stats.entriesByType.drug_labels++;
        } else if (key.startsWith('drug_shortage_')) {
            stats.entriesByType.drug_shortages++;
        } else if (key.startsWith('drug_recall_')) {
            stats.entriesByType.drug_recalls++;
        } else if (key.startsWith('adverse_event_')) {
            stats.entriesByType.adverse_events++;
        } else {
            stats.entriesByType.other++;
        }
    }
    
    return stats;
}

/**
 * Get data from cache or fetch from API
 * @param {string} cacheKey - Unique cache key
 * @param {Function} fetchFunction - Function to fetch data if cache miss
 * @param {number} ttlMinutes - Cache TTL in minutes
 * @returns {Promise<Object>} - Cached or fresh data
 */
async function getCachedOrFetch(cacheKey, fetchFunction, ttlMinutes) {
    const cacheItem = cache.get(cacheKey);
    
    if (isCacheValid(cacheItem, ttlMinutes)) {
        console.log(`Cache HIT for key: ${cacheKey}`);
        return cacheItem.data;
    }
    
    console.log(`Cache MISS for key: ${cacheKey}`);
    const freshData = await fetchFunction();
    
    // Store in cache with timestamp
    cache.set(cacheKey, {
        data: freshData,
        timestamp: Date.now()
    });
    
    return freshData;
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
                'User-Agent': 'OpenFDA-MCP-Client/2.0'
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
            endpoint: url
        };
    }
}

/**
 * Generic search strategy executor - consolidates redundant search loop patterns
 * @param {Array<string>} searchStrategies - Array of search query strings to try
 * @param {string} endpoint - FDA API endpoint URL to query
 * @param {number} limit - Maximum number of results to fetch
 * @returns {Promise<Object|null>} - Returns FDA API response data or null if no results
 */
async function performSearchStrategies(searchStrategies, endpoint, limit) {
    for (const search of searchStrategies) {
        const params = buildParams(search, limit);
        const data = await makeRequest(endpoint, params);
        
        if (data.error && data.status !== 404) {
            continue; // Try next strategy on error
        }
        
        if (data.results && data.results.length > 0) {
            return {
                search_strategy: search,
                data: data
            };
        }
    }
    return null; // No results found with any strategy
}

/**
 * Search for drug shortage information
 * Returns raw openFDA data with minimal processing
 */
export async function searchDrugShortages(drugName, limit = 10) {
    // Enhanced input validation with helpful messages
    const validationError = validateDrugName(drugName, "shortages");
    if (validationError) {
        return validationError;
    }

    const cleanName = drugName.trim();
    
    // Create cache key for this specific drug shortage request
    const cacheKey = `drug_shortage_${cleanName.toLowerCase()}_limit${limit}`;
    
    // Define search strategies in order of preference
    const searchStrategies = [
        `"${cleanName}"`,
        `generic_name:"${cleanName}"`,
        `proprietary_name:"${cleanName}"`,
        `openfda.generic_name:"${cleanName}"`,
        `openfda.brand_name:"${cleanName}"`
    ];

    // Define the fetch function for cache miss
    const fetchFunction = async () => {
        // Use generic search strategy executor
        return await performSearchStrategies(searchStrategies, ENDPOINTS.DRUG_SHORTAGES, limit);
    };
    
    // Get cached or fresh data
    const result = await getCachedOrFetch(cacheKey, fetchFunction, CACHE_TTL.DRUG_SHORTAGES);
    
    if (result) {
        return {
            search_term: drugName,
            search_strategy: result.search_strategy,
            data_source: "FDA Drug Shortages Database",
            api_endpoint: ENDPOINTS.DRUG_SHORTAGES,
            ...result.data // Spread the raw openFDA response
        };
    }

    // Enhanced no results message
    return {
        search_term: drugName,
        results: [],
        meta: { results: { total: 0 } },
        message: `No current shortages found for "${drugName}" - this is good news!`,
        note: "Try checking the generic name if you searched for a brand name, or vice versa",
        search_strategies_tried: searchStrategies,
        data_source: "FDA Drug Shortages Database",
        api_endpoint: ENDPOINTS.DRUG_SHORTAGES
    };
}

/**
 * Get drug label information
 * Returns raw openFDA label data
 */
export async function fetchDrugLabelInfo(drugIdentifier, identifierType = "openfda.generic_name") {
    // Enhanced input validation
    const validationError = validateDrugName(drugIdentifier, "drug information");
    if (validationError) {
        return validationError;
    }

    // Normalize the identifier type to fix LibreChat compatibility
    const normalizedType = normalizeIdentifierType(identifierType);
    
    // Create cache key for this specific drug label request
    const cacheKey = `drug_label_${normalizedType}_${drugIdentifier.trim().toLowerCase()}`;
    
    // Define the fetch function for cache miss
    const fetchFunction = async () => {
        const search = `${normalizedType}:"${drugIdentifier.trim()}"`;
        const params = buildParams(search, 1);
        return await makeRequest(ENDPOINTS.DRUG_LABEL, params);
    };
    
    // Get cached or fresh data
    const data = await getCachedOrFetch(cacheKey, fetchFunction, CACHE_TTL.DRUG_LABELS);
    
    if (data.error) {
        return {
            search_term: drugIdentifier,
            identifier_type: normalizedType,
            original_identifier_type: identifierType, // Keep original for debugging
            error: data.error,
            suggestion: "Try searching with the alternative name (generic vs brand name)",
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
    const validationError = validateDrugName(drugName, "recalls");
    if (validationError) {
        return validationError;
    }

    const cleanName = drugName.trim();
    
    // Create cache key for this specific drug recall request
    const cacheKey = `drug_recall_${cleanName.toLowerCase()}_limit${limit}`;

    // Define search strategies for recalls
    const searchStrategies = [
        `product_description:"${cleanName}"`,
        `product_description:${cleanName}`,
        `openfda.generic_name:"${cleanName}"`,
        `openfda.brand_name:"${cleanName}"`
    ];

    // Define the fetch function for cache miss
    const fetchFunction = async () => {
        // Use generic search strategy executor
        return await performSearchStrategies(searchStrategies, ENDPOINTS.DRUG_ENFORCEMENT, limit);
    };
    
    // Get cached or fresh data
    const result = await getCachedOrFetch(cacheKey, fetchFunction, CACHE_TTL.DRUG_RECALLS);
    
    if (result) {
        return {
            search_term: drugName,
            search_strategy: result.search_strategy,
            data_source: "FDA Drug Enforcement Database",
            api_endpoint: ENDPOINTS.DRUG_ENFORCEMENT,
            ...result.data
        };
    }

    // Enhanced no results message
    return {
        search_term: drugName,
        results: [],
        meta: { results: { total: 0 } },
        message: `No recalls found for "${drugName}" - this is good news!`,
        note: "Try searching with alternative names or check the spelling",
        search_strategies_tried: searchStrategies,
        data_source: "FDA Drug Enforcement Database",
        timestamp: new Date().toISOString(),
        api_endpoint: ENDPOINTS.DRUG_ENFORCEMENT
    };
}

/**
 * Calculate days since a date
 */
function daysSince(dateStr) {
    if (!dateStr) return 0;
    const days = Math.floor((new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
}

/**
 * Analyze drug shortage trends using FDA historical data
 */
export async function analyzeDrugShortageTrends(drugName, monthsBack = 12) {
    const validationError = validateDrugName(drugName, "trends");
    if (validationError) return validationError;

    if (monthsBack < 1 || monthsBack > 60) {
        return {
            error: "Analysis period must be between 1 and 60 months",
            provided_months: monthsBack,
            timestamp: new Date().toISOString()
        };
    }

    try {
        // Get current shortage status
        const currentParams = buildParams(`"${drugName.trim()}"`, 100);
        const currentData = await makeRequest(ENDPOINTS.DRUG_SHORTAGES, currentParams);
        
        // Get historical shortage event counts
        const historyParams = buildParams(`openfda.generic_name:"${drugName.trim()}"`, 1000);
        historyParams.append('count', 'initial_posting_date');
        const historyData = await makeRequest(ENDPOINTS.DRUG_SHORTAGES, historyParams);

        // Build simple analysis
        const analysis = {
            drug_name: drugName,
            analysis_period_months: monthsBack,
            current_status: currentData.results?.length > 0 ? 
                `${currentData.results.filter(r => r.status === "Current").length} active shortage(s)` : 
                "No current shortages",
            data_source: "FDA Drug Shortages Database",
            timestamp: new Date().toISOString()
        };

        // Add current shortage details if any
        if (currentData.results?.length > 0) {
            const current = currentData.results.find(r => r.status === "Current");
            if (current) {
                analysis.current_shortage = {
                    duration_days: daysSince(current.initial_posting_date),
                    reason: current.shortage_reason || "Not specified",
                    availability: current.availability || "Unknown",
                    last_updated: current.update_date
                };
            }
        }

        // Add historical summary if available
        if (historyData.results?.length > 0) {
            const totalEvents = historyData.results.reduce((sum, event) => sum + event.count, 0);
            analysis.historical_summary = {
                total_shortage_events: totalEvents,
                first_recorded: historyData.results[0]?.time.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'),
                shortage_frequency: totalEvents > 5 ? "High" : totalEvents > 1 ? "Moderate" : "Low"
            };
        }

        return analysis;

    } catch (error) {
        return {
            drug_name: drugName,
            error: "Failed to analyze drug trends",
            details: error.message,
            timestamp: new Date().toISOString()
        };
    }
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
            timestamp: new Date().toISOString()
        };
    }

    if (drugList.length > 25) {
        return {
            error: "Maximum 25 medications allowed per batch analysis",
            provided_count: drugList.length,
            timestamp: new Date().toISOString()
        };
    }

    // Check for empty drug names
    const emptyDrugs = drugList.filter(drug => 
        !drug || typeof drug !== 'string' || !drug.trim()
    );

    if (emptyDrugs.length > 0) {
        return {
            error: "All medication names must be valid non-empty strings",
            invalid_entries: emptyDrugs.length,
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
                analysis.trend_data = await analyzeDrugShortageTrends(drug, 6);
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
    const validationError = validateDrugName(drugIdentifier, "drug information");
    if (validationError) {
        return validationError;
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
 * Search for FDA adverse event reports (FAERS database) with hybrid response
 * Returns summarized data by default, full raw data when detailed=true
 * 
 * @param {string} drugName - Name of the drug to search for adverse events
 * @param {number} [limit=5] - Maximum number of reports to return (1-50)
 * @param {boolean} [detailed=false] - Return full raw FDA data or summary
 * @returns {Promise<Object>} FDA FAERS data with adverse event reports
 */
export async function searchAdverseEvents(drugName, limit = 5, detailed = false) {
    // Enhanced input validation with helpful messages
    const validationError = validateDrugName(drugName, "adverse events");
    if (validationError) {
        return validationError;
    }

    const cleanName = drugName.trim();
    
    // Create cache key for this specific adverse events request
    const cacheKey = `adverse_event_${cleanName.toLowerCase()}_limit${limit}_detailed${detailed}`;
    
    // For detailed queries, get more data; for summary, get enough to analyze
    const fetchLimit = detailed ? limit : Math.max(limit * 4, 20);
    
    // Define search strategies in order of preference for adverse events
    const searchStrategies = [
        `patient.drug.medicinalproduct:"${cleanName}"`,
        `patient.drug.openfda.generic_name:"${cleanName}"`,
        `patient.drug.openfda.brand_name:"${cleanName}"`,
        `patient.drug.medicinalproduct:${cleanName}`,
        `patient.drug.activesubstance.activesubstancename:"${cleanName}"`
    ];

    // Define the fetch function for cache miss
    const fetchFunction = async () => {
        // Use generic search strategy executor
        return await performSearchStrategies(searchStrategies, ENDPOINTS.DRUG_EVENT, fetchLimit);
    };
    
    // Get cached or fresh data
    const result = await getCachedOrFetch(cacheKey, fetchFunction, CACHE_TTL.ADVERSE_EVENTS);
    
    if (result) {
        // Return detailed raw data if requested
        if (detailed) {
            return {
                search_term: drugName,
                search_strategy: result.search_strategy,
                data_source: "FDA Adverse Event Reporting System (FAERS)",
                api_endpoint: ENDPOINTS.DRUG_EVENT,
                note: "These are adverse events reported to FDA. Not all events are caused by the drug.",
                total_reports_available: result.data.meta?.results?.total || 0,
                response_mode: "detailed",
                ...result.data // Spread the raw openFDA response
            };
        }
        
        // Return summarized data by default
        const summary = generateAdverseEventSummary(result.data, drugName);
        return summary;
    }

    // Enhanced no results message
    return {
        search_term: drugName,
        results: [],
        meta: { results: { total: 0 } },
        message: `No adverse events found in FDA database for "${drugName}"`,
        note: "This could mean the drug is very safe, very new, or try a different name",
        search_strategies_tried: searchStrategies,
        data_source: "FDA Adverse Event Reporting System (FAERS)",
        timestamp: new Date().toISOString(),
        api_endpoint: ENDPOINTS.DRUG_EVENT
    };
}

/**
 * Search for serious adverse events only (death, hospitalization, disability) with hybrid response
 * Returns summarized data by default, full raw data when detailed=true
 * 
 * @param {string} drugName - Name of the drug to search for serious adverse events
 * @param {number} [limit=5] - Maximum number of serious adverse event reports to return (1-50)
 * @param {boolean} [detailed=false] - Return full raw FDA data or summary
 * @returns {Promise<Object>} FDA FAERS data with serious adverse events only
 */
export async function searchSeriousAdverseEvents(drugName, limit = 5, detailed = false) {
    // Enhanced input validation
    const validationError = validateDrugName(drugName, "serious adverse events");
    if (validationError) {
        return validationError;
    }

    const cleanName = drugName.trim();
    
    // Create cache key for this specific serious adverse events request
    const cacheKey = `serious_adverse_event_${cleanName.toLowerCase()}_limit${limit}_detailed${detailed}`;
    
    // For detailed queries, get more data; for summary, get enough to analyze
    const fetchLimit = detailed ? limit : Math.max(limit * 4, 20);
    
    // Define the fetch function for cache miss
    const fetchFunction = async () => {
        // Search for serious adverse events only (serious:1)
        const search = `patient.drug.medicinalproduct:"${cleanName}" AND serious:1`;
        
        const params = buildParams(search, fetchLimit);
        return await makeRequest(ENDPOINTS.DRUG_EVENT, params);
    };
    
    // Get cached or fresh data
    const data = await getCachedOrFetch(cacheKey, fetchFunction, CACHE_TTL.ADVERSE_EVENTS);
    
    if (data.error) {
        return {
            search_term: drugName,
            error: data.error,
            suggestion: "Try using the generic name or check the spelling",
            api_endpoint: ENDPOINTS.DRUG_EVENT
        };
    }

    if (data.results && data.results.length > 0) {
        // Return detailed raw data if requested
        if (detailed) {
            return {
                search_term: drugName,
                search_strategy: search,
                data_source: "FDA Adverse Event Reporting System (FAERS) - Serious Events Only",
                    api_endpoint: ENDPOINTS.DRUG_EVENT,
                warning: "These are serious adverse events that resulted in hospitalization, death, or disability",
                total_serious_reports: data.meta?.results?.total || 0,
                response_mode: "detailed",
                ...data
            };
        }
        
        // Return summarized data by default
        const summary = generateSeriousEventSummary(data, drugName);
        return summary;
    } else {
        return {
            search_term: drugName,
            results: [],
            meta: { results: { total: 0 } },
            message: `No serious adverse events found for "${drugName}" - this is encouraging!`,
            note: "The absence of serious adverse events suggests good safety profile",
            data_source: "FDA Adverse Event Reporting System (FAERS) - Serious Events Only",
            api_endpoint: ENDPOINTS.DRUG_EVENT
        };
    }
}

/**
 * Generate summary for general adverse events from FDA FAERS data
 * 
 * @param {Object} data - Raw FDA FAERS API response data
 * @param {string} drugName - Name of the drug being analyzed
 * @returns {Object} Summarized adverse event data with top reactions and key insights
 */
function generateAdverseEventSummary(data, drugName) {
    const totalReports = data.meta?.results?.total || 0;
    const sampleSize = data.results.length;
    
    // Count reaction frequencies
    const reactionCounts = {};
    let seriousCount = 0;
    
    data.results.forEach(event => {
        // Count serious events
        if (event.serious === '1') {
            seriousCount++;
        }
        
        // Count reactions
        if (event.patient?.reaction) {
            event.patient.reaction.forEach(reaction => {
                const term = reaction.reactionmeddrapt;
                if (term) {
                    reactionCounts[term] = (reactionCounts[term] || 0) + 1;
                }
            });
        }
    });
    
    // Get top reactions
    const topReactions = Object.entries(reactionCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([reaction, count]) => ({ reaction, count }));
    
    const seriousPercentage = Math.round((seriousCount / sampleSize) * 100);
    
    return {
        search_term: drugName,
        data_source: "FDA Adverse Event Reporting System (FAERS)",
        timestamp: new Date().toISOString(),
        api_endpoint: ENDPOINTS.DRUG_EVENT,
        response_mode: "summary",
        summary: {
            total_reports_in_database: totalReports,
            sample_analyzed: sampleSize,
            serious_events: {
                count: seriousCount,
                percentage: `${seriousPercentage}%`
            },
            top_reported_reactions: topReactions,
            key_insights: generateKeyInsights(topReactions, seriousPercentage)
        },
        note: "This is a summary based on sample data. Use detailed=true for complete FDA reports.",
        disclaimer: "These are adverse events reported to FDA. Not all events are caused by the drug."
    };
}

/**
 * Generate summary for serious adverse events from FDA FAERS data
 * 
 * @param {Object} data - Raw FDA FAERS API response data for serious events only
 * @param {string} drugName - Name of the drug being analyzed
 * @returns {Object} Summarized serious adverse event data with event types and safety alerts
 */
function generateSeriousEventSummary(data, drugName) {
    const totalReports = data.meta?.results?.total || 0;
    const sampleSize = data.results.length;
    
    // Analyze types of serious events
    const seriousTypes = {
        death: 0,
        hospitalization: 0,
        lifeThreatening: 0,
        disability: 0,
        other: 0
    };
    
    const reactionCounts = {};
    
    data.results.forEach(event => {
        // Count serious event types
        if (event.seriousnessdeath === '1') seriousTypes.death++;
        if (event.seriousnesshospitalization === '1') seriousTypes.hospitalization++;
        if (event.seriousnesslifethreatening === '1') seriousTypes.lifeThreatening++;
        if (event.seriousnessdisabling === '1') seriousTypes.disability++;
        if (event.seriousnessother === '1') seriousTypes.other++;
        
        // Count reactions in serious events
        if (event.patient?.reaction) {
            event.patient.reaction.forEach(reaction => {
                const term = reaction.reactionmeddrapt;
                if (term) {
                    reactionCounts[term] = (reactionCounts[term] || 0) + 1;
                }
            });
        }
    });
    
    const topSeriousReactions = Object.entries(reactionCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([reaction, count]) => ({ reaction, count }));
    
    return {
        search_term: drugName,
        data_source: "FDA Adverse Event Reporting System (FAERS) - Serious Events Only",
        timestamp: new Date().toISOString(),
        api_endpoint: ENDPOINTS.DRUG_EVENT,
        response_mode: "summary",
        warning: "These are serious adverse events that resulted in hospitalization, death, or disability",
        summary: {
            total_serious_reports_in_database: totalReports,
            sample_analyzed: sampleSize,
            serious_event_types: {
                death: seriousTypes.death,
                hospitalization: seriousTypes.hospitalization,
                life_threatening: seriousTypes.lifeThreatening,
                disability: seriousTypes.disability,
                other_serious: seriousTypes.other
            },
            top_reactions_in_serious_events: topSeriousReactions,
            safety_alert: generateSafetyAlert(seriousTypes, topSeriousReactions)
        },
        note: "This is a summary of serious events only. Use detailed=true for complete FDA reports.",
        disclaimer: "These are serious adverse events reported to FDA. Consult healthcare provider for medical advice."
    };
}

/**
 * Generate key insights for general adverse events based on reaction patterns
 * 
 * @param {Array} topReactions - Array of top reported reactions with counts
 * @param {number} seriousPercentage - Percentage of serious events in the sample
 * @returns {Array<string>} Array of insight strings for user guidance
 */
function generateKeyInsights(topReactions, seriousPercentage) {
    const insights = [];
    
    if (seriousPercentage > 50) {
        insights.push("High proportion of serious events - use with caution");
    } else if (seriousPercentage > 25) {
        insights.push("Moderate proportion of serious events - monitor closely");
    } else {
        insights.push("Most reported events are non-serious");
    }
    
    if (topReactions.length > 0) {
        insights.push(`Most common reaction: ${topReactions[0].reaction}`);
    }
    
    return insights;
}

/**
 * Generate safety alert for serious events based on event types and reactions
 * 
 * @param {Object} seriousTypes - Object containing counts of different serious event types
 * @param {Array} topReactions - Array of top reported reactions in serious events
 * @returns {Array<string>} Array of safety alert strings for medical awareness
 */
function generateSafetyAlert(seriousTypes, topReactions) {
    const alerts = [];
    
    if (seriousTypes.death > 0) {
        alerts.push(`${seriousTypes.death} death reports - requires careful monitoring`);
    }
    
    if (seriousTypes.hospitalization > 0) {
        alerts.push(`${seriousTypes.hospitalization} hospitalization reports`);
    }
    
    if (topReactions.length > 0) {
        alerts.push(`Primary serious reaction: ${topReactions[0].reaction}`);
    }
    
    return alerts.length > 0 ? alerts : ["Review individual reports for specific safety concerns"];
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

// Initialize periodic cache cleanup (runs every hour)
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds
setInterval(() => {
    console.log('Starting periodic cache cleanup...');
    cleanExpiredCache();
}, CLEANUP_INTERVAL);

// Export cache management functions for potential external use
export { getCacheStats, cleanExpiredCache };