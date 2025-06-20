const OPENFDA_API_KEY = process.env.OPENFDA_API_KEY;
const DRUG_SHORTAGES_ENDPOINT = "https://api.fda.gov/drug/shortages.json";

/**
 * Search for drug shortage information using FDA API
 * @param {string} drugName - The drug name to search for
 * @param {number} limit - Maximum number of results to return
 * @returns {Promise<Object>} Drug shortage information
 */
export async function searchDrugShortages(drugName, limit = 10) {
    if (!drugName || typeof drugName !== 'string') {
        return {
            error: "Drug name is required and must be a string",
            search_term: drugName,
            timestamp: new Date().toISOString()
        };
    }

    const cleanName = drugName.toLowerCase().trim();
    console.log(`Searching for drug shortages: "${cleanName}"`);
    
    // Remove common suffixes to improve search
    let searchTerm = cleanName;
    const suffixes = [" tablets", " capsules", " injection", " oral", " solution", " mg", " mcg"];
    for (const suffix of suffixes) {
        if (searchTerm.endsWith(suffix)) {
            searchTerm = searchTerm.replace(suffix, "").trim();
            break;
        }
    }
    
    // Try different search strategies
    const searchStrategies = [
        `"${searchTerm}"`,
        `generic_name:"${searchTerm}"`,
        `proprietary_name:"${searchTerm}"`,
        `openfda.generic_name:"${searchTerm}"`,
        `openfda.brand_name:"${searchTerm}"`
    ];
    
    // If original term was different, add it to search strategies
    if (searchTerm !== cleanName) {
        searchStrategies.push(`"${cleanName}"`);
        searchStrategies.push(`generic_name:"${cleanName}"`);
    }
    
    let bestResult = null;
    let totalAttempts = 0;
    
    for (const strategy of searchStrategies) {
        totalAttempts++;
        console.log(`Attempt ${totalAttempts}: Trying search strategy: ${strategy}`);
        
        const params = new URLSearchParams({
            search: strategy,
            limit: Math.min(limit * 2, 50).toString() // Get more results to filter better
        });
        
        if (OPENFDA_API_KEY) {
            params.append('api_key', OPENFDA_API_KEY);
        }

        try {
            const response = await fetch(`${DRUG_SHORTAGES_ENDPOINT}?${params}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'DrugShortageMCPServer/1.0.0'
                },
                timeout: 15000
            });
            
            if (response.status === 404) {
                console.log(`Strategy "${strategy}" returned 404, trying next...`);
                continue;
            }
            
            if (!response.ok) {
                console.log(`Strategy "${strategy}" failed with status ${response.status}`);
                continue;
            }
                
            const data = await response.json();
            
            if (!data.results || data.results.length === 0) {
                console.log(`Strategy "${strategy}" returned no results`);
                continue;
            }
            
            console.log(`Strategy "${strategy}" found ${data.results.length} raw results`);
            
            // Filter and score results based on relevance
            const scoredResults = [];
            
            for (const item of data.results) {
                const score = calculateRelevanceScore(item, searchTerm, cleanName);
                if (score > 0) {
                    scoredResults.push({
                        ...item,
                        _relevance_score: score
                    });
                }
            }
            
            if (scoredResults.length > 0) {
                // Sort by relevance score (highest first)
                scoredResults.sort((a, b) => b._relevance_score - a._relevance_score);
                
                const processedResults = scoredResults.slice(0, limit).map(item => ({
                    drug_name: {
                        generic: item.generic_name || "N/A",
                        brand: item.proprietary_name || "N/A"
                    },
                    shortage_details: {
                        status: item.status || "Unknown",
                        availability: item.availability || "Unknown",
                        reason: item.shortage_reason || "Not specified"
                    },
                    company: {
                        name: item.company_name || "Unknown",
                        contact: item.contact_info || "Not provided"
                    },
                    product_info: {
                        dosage_form: item.dosage_form || "Not specified",
                        strength: Array.isArray(item.strength) ? item.strength : [item.strength || "Not specified"],
                        presentation: item.presentation || "Not specified"
                    },
                    dates: {
                        initial_posting: item.initial_posting_date || "Unknown",
                        last_updated: item.update_date || "Unknown",
                        update_type: item.update_type || "Unknown"
                    },
                    regulatory_info: {
                        therapeutic_category: Array.isArray(item.therapeutic_category) 
                            ? item.therapeutic_category 
                            : [item.therapeutic_category || "Not categorized"]
                    },
                    fda_identifiers: {
                        generic_names: item.openfda?.generic_name || [],
                        brand_names: item.openfda?.brand_name || [],
                        manufacturers: item.openfda?.manufacturer_name || []
                    },
                    relevance_score: item._relevance_score
                }));
                
                bestResult = {
                    search_term: drugName,
                    normalized_search: searchTerm,
                    strategy_used: strategy,
                    total_found: scoredResults.length,
                    returned_count: processedResults.length,
                    shortages: processedResults,
                    summary: generateSummary(processedResults),
                    data_source: "FDA Drug Shortages Database",
                    timestamp: new Date().toISOString(),
                    api_info: {
                        endpoint: DRUG_SHORTAGES_ENDPOINT,
                        has_api_key: !!OPENFDA_API_KEY,
                        search_attempts: totalAttempts
                    }
                };
                
                console.log(`Found ${processedResults.length} relevant shortages using strategy: ${strategy}`);
                break; // Found good results, stop trying other strategies
            }
            
        } catch (error) {
            console.error(`Error with strategy "${strategy}":`, error.message);
            continue;
        }
    }
    
    // Return best result or "no results found" response
    if (bestResult) {
        return bestResult;
    } else {
        return {
            search_term: drugName,
            normalized_search: searchTerm,
            total_found: 0,
            returned_count: 0,
            shortages: [],
            message: `No current shortages found for "${drugName}"`,
            summary: {
                current_shortages: 0,
                resolved_shortages: 0,
                status_distribution: {},
                recommendation: "No active shortage concerns detected"
            },
            data_source: "FDA Drug Shortages Database",
            timestamp: new Date().toISOString(),
            api_info: {
                endpoint: DRUG_SHORTAGES_ENDPOINT,
                has_api_key: !!OPENFDA_API_KEY,
                search_attempts: totalAttempts,
                strategies_tried: searchStrategies
            }
        };
    }
}

/**
 * Calculate relevance score for a shortage record
 * @param {Object} item - The shortage record from FDA API
 * @param {string} searchTerm - The processed search term
 * @param {string} originalTerm - The original search term
 * @returns {number} Relevance score (0-100)
 */
function calculateRelevanceScore(item, searchTerm, originalTerm) {
    let score = 0;
    
    const genericName = (item.generic_name || "").toLowerCase();
    const proprietaryName = (item.proprietary_name || "").toLowerCase();
    const openfdaGeneric = (item.openfda?.generic_name || []).map(name => name.toLowerCase());
    const openfdaBrand = (item.openfda?.brand_name || []).map(name => name.toLowerCase());
    
    // Exact matches get highest score
    if (genericName === searchTerm || genericName === originalTerm) score += 100;
    if (proprietaryName === searchTerm || proprietaryName === originalTerm) score += 100;
    if (openfdaGeneric.includes(searchTerm) || openfdaGeneric.includes(originalTerm)) score += 100;
    if (openfdaBrand.includes(searchTerm) || openfdaBrand.includes(originalTerm)) score += 100;
    
    // Partial matches get medium score
    if (genericName.includes(searchTerm) || genericName.includes(originalTerm)) score += 60;
    if (proprietaryName.includes(searchTerm) || proprietaryName.includes(originalTerm)) score += 60;
    if (openfdaGeneric.some(name => name.includes(searchTerm) || name.includes(originalTerm))) score += 60;
    if (openfdaBrand.some(name => name.includes(searchTerm) || name.includes(originalTerm))) score += 60;
    
    // Reverse partial matches (search term contains drug name)
    if (searchTerm.includes(genericName) && genericName.length > 3) score += 40;
    if (originalTerm.includes(genericName) && genericName.length > 3) score += 40;
    
    // Bonus for current shortages
    if (item.status === "Current") score += 20;
    
    // Bonus for having detailed information
    if (item.shortage_reason && item.shortage_reason !== "N/A") score += 10;
    if (item.availability && item.availability !== "N/A") score += 5;
    
    return Math.min(score, 100); // Cap at 100
}

/**
 * Generate a summary of shortage results
 * @param {Array} shortages - Array of processed shortage records
 * @returns {Object} Summary statistics
 */
function generateSummary(shortages) {
    if (!shortages || shortages.length === 0) {
        return {
            current_shortages: 0,
            resolved_shortages: 0,
            status_distribution: {},
            recommendation: "No shortage data available"
        };
    }
    
    const summary = {
        current_shortages: 0,
        resolved_shortages: 0,
        status_distribution: {},
        unique_companies: new Set(),
        common_reasons: {},
        recommendation: ""
    };
    
    for (const shortage of shortages) {
        const status = shortage.shortage_details.status;
        summary.status_distribution[status] = (summary.status_distribution[status] || 0) + 1;
        
        if (status === "Current") {
            summary.current_shortages++;
        } else if (status === "Resolved") {
            summary.resolved_shortages++;
        }
        
        if (shortage.company.name !== "Unknown") {
            summary.unique_companies.add(shortage.company.name);
        }
        
        const reason = shortage.shortage_details.reason;
        if (reason && reason !== "Not specified") {
            summary.common_reasons[reason] = (summary.common_reasons[reason] || 0) + 1;
        }
    }
    
    // Convert set to count
    summary.companies_affected = summary.unique_companies.size;
    delete summary.unique_companies;
    
    // Find most common reason
    const reasonEntries = Object.entries(summary.common_reasons);
    if (reasonEntries.length > 0) {
        const [mostCommonReason] = reasonEntries.sort(([,a], [,b]) => b - a)[0];
        summary.primary_shortage_reason = mostCommonReason;
    }
    
    // Generate recommendation
    if (summary.current_shortages > 0) {
        summary.recommendation = `⚠️  ${summary.current_shortages} current shortage(s) detected. Consider alternative sourcing.`;
    } else if (summary.resolved_shortages > 0) {
        summary.recommendation = `✅ No current shortages, but ${summary.resolved_shortages} historical shortage(s) found. Monitor for recurrence.`;
    } else {
        summary.recommendation = "✅ No shortage concerns detected.";
    }
    
    return summary;
}