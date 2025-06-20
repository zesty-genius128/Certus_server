const OPENFDA_API_KEY = process.env.OPENFDA_API_KEY;
const DRUG_LABEL_ENDPOINT = "https://api.fda.gov/drug/label.json";
const DRUG_SHORTAGES_ENDPOINT = "https://api.fda.gov/drug/shortages.json";
const DRUG_ENFORCEMENT_ENDPOINT = "https://api.fda.gov/drug/enforcement.json";

/**
 * Retrieve drug label information from openFDA
 * @param {string} drugIdentifier - The drug identifier to search for
 * @param {string} identifierType - The type of identifier (default: "openfda.generic_name")
 * @returns {Promise<Object>} Drug label information
 */
export async function fetchDrugLabelInfo(drugIdentifier, identifierType = "openfda.generic_name") {
    const params = new URLSearchParams({
        search: `${identifierType}:"${drugIdentifier}"`,
        limit: '1'
    });
    
    if (OPENFDA_API_KEY) {
        params.append('api_key', OPENFDA_API_KEY);
    }

    try {
        const response = await fetch(`${DRUG_LABEL_ENDPOINT}?${params}`, {
            timeout: 15000
        });

        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            return data.results[0];
        } else {
            return { error: `No label information found for '${drugIdentifier}'` };
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            return { error: "Request timed out" };
        } else if (error.message.includes('HTTP error')) {
            return { error: error.message };
        } else {
            return { error: `Request failed: ${error.message}` };
        }
    }
}

/**
 * Search for drug shortage information
 * @param {string} drugIdentifier - The drug identifier to search for
 * @param {number} limit - Maximum number of results to return
 * @returns {Promise<Object>} Drug shortage information
 */
export async function searchDrugShortages(drugIdentifier, limit = 10) {
    if (!drugIdentifier || typeof drugIdentifier !== 'string') {
        return {
            error: "Drug name is required and must be a string",
            search_term: drugIdentifier,
            timestamp: new Date().toISOString()
        };
    }

    const cleanName = drugIdentifier.toLowerCase().trim();
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
            limit: Math.min(limit * 2, 50).toString()
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
                    search_term: drugIdentifier,
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
                break;
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
            search_term: drugIdentifier,
            normalized_search: searchTerm,
            total_found: 0,
            returned_count: 0,
            shortages: [],
            message: `No current shortages found for "${drugIdentifier}"`,
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
 * Search for drug recalls
 * @param {string} drugIdentifier - The drug identifier to search for
 * @param {number} limit - Maximum number of results to return
 * @returns {Promise<Object>} Drug recall information
 */
export async function searchDrugRecalls(drugIdentifier, limit = 10) {
    const params = new URLSearchParams({
        search: `product_description:"${drugIdentifier}"`,
        limit: limit.toString()
    });
    
    if (OPENFDA_API_KEY) {
        params.append('api_key', OPENFDA_API_KEY);
    }

    try {
        const response = await fetch(`${DRUG_ENFORCEMENT_ENDPOINT}?${params}`, {
            timeout: 15000
        });

        if (!response.ok) {
            if (response.status === 404) {
                return { 
                    search_term: drugIdentifier,
                    total_found: 0,
                    returned_count: 0,
                    recalls: [],
                    message: `No recalls found for '${drugIdentifier}'`,
                    data_source: "FDA Drug Enforcement Database",
                    timestamp: new Date().toISOString()
                };
            }
            throw new Error(`HTTP error: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            const recalls = data.results.map(item => ({
                product_description: item.product_description || "N/A",
                reason_for_recall: item.reason_for_recall || "N/A",
                classification: item.classification || "N/A",
                status: item.status || "N/A",
                recall_initiation_date: item.recall_initiation_date || "N/A",
                recalling_firm: item.recalling_firm || "N/A",
                distribution_pattern: item.distribution_pattern || "N/A",
                product_quantity: item.product_quantity || "N/A",
                recall_number: item.recall_number || "N/A"
            }));
            
            return {
                search_term: drugIdentifier,
                total_found: data.meta?.results?.total || recalls.length,
                returned_count: recalls.length,
                recalls: recalls,
                data_source: "FDA Drug Enforcement Database",
                timestamp: new Date().toISOString(),
                api_info: {
                    endpoint: DRUG_ENFORCEMENT_ENDPOINT,
                    has_api_key: !!OPENFDA_API_KEY
                }
            };
        } else {
            return {
                search_term: drugIdentifier,
                total_found: 0,
                returned_count: 0,
                recalls: [],
                message: `No recalls found for '${drugIdentifier}'`,
                data_source: "FDA Drug Enforcement Database",
                timestamp: new Date().toISOString()
            };
        }
    } catch (error) {
        if (error.message.includes('HTTP error: 404')) {
            return {
                search_term: drugIdentifier,
                total_found: 0,
                returned_count: 0,
                recalls: [],
                message: `No recalls found for '${drugIdentifier}'`,
                data_source: "FDA Drug Enforcement Database",
                timestamp: new Date().toISOString()
            };
        }
        return { error: `Error searching recalls: ${error.message}` };
    }
}

/**
 * Analyze shortage patterns and market trends for a drug
 * @param {string} drugIdentifier - The drug identifier to analyze
 * @param {number} monthsBack - Number of months to look back (default: 12)
 * @returns {Promise<Object>} Trend analysis results
 */
export async function analyzeDrugMarketTrends(drugIdentifier, monthsBack = 12) {
    const cleanName = drugIdentifier.toLowerCase().trim();
    
    const params = new URLSearchParams({
        search: `"${cleanName}"`,
        limit: '100'
    });
    
    if (OPENFDA_API_KEY) {
        params.append('api_key', OPENFDA_API_KEY);
    }

    try {
        const response = await fetch(`${DRUG_SHORTAGES_ENDPOINT}?${params}`, {
            timeout: 20000
        });

        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.results || data.results.length === 0) {
            return {
                drug_analyzed: drugIdentifier,
                analysis_period_months: monthsBack,
                trend_summary: "No shortage data found",
                market_insights: {
                    shortage_frequency: "None",
                    risk_level: "Low",
                    recommendation: "No historical shortage patterns detected"
                },
                data_source: "FDA Drug Shortages Database",
                timestamp: new Date().toISOString()
            };
        }
        
        // Filter relevant records
        const relevantRecords = data.results.filter(item => {
            const drugName = (item.generic_name || "").toLowerCase();
            const proprietaryName = (item.proprietary_name || "").toLowerCase();
            const openfdaNames = (item.openfda?.generic_name || []).map(name => name.toLowerCase());
            
            return (
                drugName.includes(cleanName) ||
                proprietaryName.includes(cleanName) ||
                openfdaNames.some(name => name.includes(cleanName))
            );
        });
        
        if (relevantRecords.length === 0) {
            return {
                drug_analyzed: drugIdentifier,
                analysis_period_months: monthsBack,
                trend_summary: "No relevant shortage records found",
                market_insights: {
                    shortage_frequency: "None",
                    risk_level: "Low",
                    recommendation: "No shortage history for this drug"
                },
                data_source: "FDA Drug Shortages Database",
                timestamp: new Date().toISOString()
            };
        }
        
        // Analyze patterns
        const statusCounts = {};
        const companiesAffected = new Set();
        const reasons = [];
        let recentActivity = 0;
        
        for (const record of relevantRecords) {
            const status = record.status || "Unknown";
            statusCounts[status] = (statusCounts[status] || 0) + 1;
            
            const company = record.company_name;
            if (company && company !== "Unknown") {
                companiesAffected.add(company);
            }
            
            const reason = record.shortage_reason;
            if (reason && reason !== "N/A") {
                reasons.push(reason);
            }
            
            if (["Current", "To Be Discontinued"].includes(status)) {
                recentActivity += 1;
            }
        }
        
        // Calculate risk
        const totalRecords = relevantRecords.length;
        const currentShortages = statusCounts["Current"] || 0;
        const resolvedShortages = statusCounts["Resolved"] || 0;
        
        let riskLevel;
        if (currentShortages > 0) {
            riskLevel = "High";
        } else if (totalRecords > 5) {
            riskLevel = "Medium";
        } else {
            riskLevel = "Low";
        }
        
        // Build frequency description
        let frequencyDesc = `${totalRecords} shortage events found`;
        if (totalRecords > 10) {
            frequencyDesc += " (high frequency)";
        } else if (totalRecords > 3) {
            frequencyDesc += " (moderate frequency)";
        } else {
            frequencyDesc += " (low frequency)";
        }
        
        // Top reasons
        let reasonSummary = "Not specified";
        if (reasons.length > 0) {
            const reasonCounts = {};
            reasons.forEach(reason => {
                reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
            });
            
            const topReasons = Object.entries(reasonCounts)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 3)
                .map(([reason]) => reason);
            
            reasonSummary = topReasons.join("; ");
        }
        
        let recommendation = `Risk level: ${riskLevel}.`;
        if (currentShortages > 0) {
            recommendation += ` Monitor ${currentShortages} current shortage(s).`;
        } else {
            recommendation += ` ${resolvedShortages} resolved shortage(s) in history.`;
        }
        
        return {
            drug_analyzed: drugIdentifier,
            analysis_period_months: monthsBack,
            total_shortage_events: totalRecords,
            trend_summary: `Found ${totalRecords} shortage records affecting ${companiesAffected.size} companies`,
            status_breakdown: statusCounts,
            market_insights: {
                shortage_frequency: frequencyDesc,
                risk_level: riskLevel,
                companies_affected: companiesAffected.size,
                recent_activity: recentActivity,
                common_reasons: reasonSummary,
                recommendation: recommendation
            },
            detailed_records: relevantRecords.slice(0, 5),
            data_source: "FDA Drug Shortages Database",
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        return {
            drug_analyzed: drugIdentifier,
            error: `Failed to analyze trends: ${error.message}`,
            recommendation: "Unable to perform trend analysis",
            timestamp: new Date().toISOString()
        };
    }
}

/**
 * Analyze multiple drugs for shortages and risk assessment
 * @param {string[]} drugList - Array of drug names to analyze
 * @param {boolean} includeTrends - Whether to include trend analysis
 * @returns {Promise<Object>} Batch analysis results
 */
export async function batchDrugAnalysis(drugList, includeTrends = false) {
    console.log(`Analyzing ${drugList.length} drugs`);
    
    if (drugList.length > 25) {
        return {
            error: "Batch size too large. Limit to 25 drugs per batch.",
            recommendation: "Split list into smaller batches",
            timestamp: new Date().toISOString()
        };
    }
    
    const results = {
        batch_summary: {
            total_drugs_analyzed: drugList.length,
            analysis_timestamp: new Date().toISOString().split('T')[0],
            drugs_with_shortages: 0,
            drugs_with_recalls: 0,
            high_risk_drugs: 0,
            total_shortage_events: 0
        },
        individual_analyses: {},
        risk_assessment: {
            high_risk: [],
            medium_risk: [],
            low_risk: []
        },
        formulary_recommendations: []
    };
    
    for (const drug of drugList) {
        const drugAnalysis = {
            drug_name: drug,
            shortage_status: "Unknown",
            recall_status: "Unknown",
            risk_level: "Unknown",
            details: {}
        };
        
        try {
            // Check shortages
            const shortageInfo = await searchDrugShortages(drug, 10);
            if (shortageInfo.shortages && shortageInfo.shortages.length > 0) {
                drugAnalysis.shortage_status = `Found ${shortageInfo.shortages.length} shortage(s)`;
                results.batch_summary.drugs_with_shortages += 1;
                results.batch_summary.total_shortage_events += shortageInfo.shortages.length;
                
                const currentShortages = shortageInfo.shortages.filter(s => s.shortage_details.status === "Current").length;
                if (currentShortages > 0) {
                    drugAnalysis.risk_level = "High";
                    results.risk_assessment.high_risk.push(drug);
                    results.batch_summary.high_risk_drugs += 1;
                } else {
                    drugAnalysis.risk_level = "Medium";
                    results.risk_assessment.medium_risk.push(drug);
                }
                
                const uniqueCompanies = [...new Set(shortageInfo.shortages.slice(0, 5).map(s => s.company.name || "Unknown"))];
                drugAnalysis.details.shortage_summary = {
                    total_records: shortageInfo.shortages.length,
                    current_shortages: currentShortages,
                    companies_affected: uniqueCompanies
                };
            } else {
                drugAnalysis.shortage_status = "No current shortages";
                drugAnalysis.risk_level = "Low";
                results.risk_assessment.low_risk.push(drug);
            }
            
            // Check recalls
            const recallInfo = await searchDrugRecalls(drug, 5);
            if (recallInfo.recalls && recallInfo.recalls.length > 0) {
                drugAnalysis.recall_status = `Found ${recallInfo.recalls.length} recall(s)`;
                results.batch_summary.drugs_with_recalls += 1;
                drugAnalysis.details.recall_summary = {
                    total_recalls: recallInfo.recalls.length,
                    recent_recalls: recallInfo.recalls.slice(0, 2).map(r => 
                        (r.product_description || "Unknown").substring(0, 50) + "..."
                    )
                };
            } else {
                drugAnalysis.recall_status = "No recent recalls";
            }
            
            // Add trend analysis if requested
            if (includeTrends) {
                const trendInfo = await analyzeDrugMarketTrends(drug, 6);
                drugAnalysis.details.trend_analysis = {
                    total_shortage_events: trendInfo.total_shortage_events || 0,
                    risk_level: trendInfo.market_insights?.risk_level || "Unknown",
                    recommendation: trendInfo.market_insights?.recommendation || "No trend data available"
                };
            }
            
        } catch (error) {
            drugAnalysis.error = `Analysis failed: ${error.message}`;
            drugAnalysis.risk_level = "Unknown";
        }
        
        results.individual_analyses[drug] = drugAnalysis;
    }
    
    // Generate recommendations
    const highRiskCount = results.risk_assessment.high_risk.length;
    const totalDrugs = drugList.length;
    
    if (highRiskCount > totalDrugs * 0.3) {
        results.formulary_recommendations.push("HIGH ALERT: Over 30% of drugs show shortage risks");
        results.formulary_recommendations.push("Recommend immediate alternative sourcing for high-risk medications");
    }
    
    if (results.batch_summary.drugs_with_shortages > 0) {
        results.formulary_recommendations.push(`Monitor ${results.batch_summary.drugs_with_shortages} drugs with active shortage concerns`);
    }
    
    if (results.risk_assessment.low_risk.length === totalDrugs) {
        results.formulary_recommendations.push("No significant shortage risks detected in this drug set");
    }
    
    results.formulary_recommendations.push(`Analyzed ${totalDrugs} drugs with ${results.batch_summary.total_shortage_events} total shortage events`);
    
    return results;
}

/**
 * Get complete drug profile including label and shortage information
 * @param {string} drugIdentifier - The drug identifier to search for
 * @param {string} identifierType - The type of identifier
 * @returns {Promise<Object>} Complete drug profile
 */
export async function getMedicationProfile(drugIdentifier, identifierType = "openfda.generic_name") {
    try {
        // Get label information
        const labelInfo = await fetchDrugLabelInfo(drugIdentifier, identifierType);

        // Determine best search term for shortage lookup
        let shortageSearchTerm = drugIdentifier;
        if (labelInfo && !labelInfo.error && labelInfo.openfda) {
            const genericNames = labelInfo.openfda.generic_name;
            if (genericNames && Array.isArray(genericNames) && genericNames.length > 0) {
                shortageSearchTerm = genericNames[0];
            }
        }

        // Get shortage information
        const shortageInfo = await searchDrugShortages(shortageSearchTerm, 10);

        // Parse label information
        let parsedLabelInfo = {};
        if (labelInfo && !labelInfo.error) {
            parsedLabelInfo = {
                brand_name: labelInfo.openfda?.brand_name || [],
                generic_name: labelInfo.openfda?.generic_name || [],
                manufacturer_name: labelInfo.openfda?.manufacturer_name || [],
                route: labelInfo.openfda?.route || [],
                dosage_form: labelInfo.openfda?.dosage_form || [],
                strength: labelInfo.openfda?.strength || [],
                indications_and_usage: labelInfo.indications_and_usage || ["Not available"],
                adverse_reactions: labelInfo.adverse_reactions || ["Not available"],
                warnings_and_cautions: labelInfo.warnings_and_cautions || ["Not available"],
                dosage_and_administration: labelInfo.dosage_and_administration || ["Not available"],
                contraindications: labelInfo.contraindications || ["Not available"],
                drug_interactions: labelInfo.drug_interactions || ["Not available"]
            };
        } else {
            parsedLabelInfo.error = labelInfo?.error || "Unknown label API error";
        }

        // Build comprehensive profile
        const profile = {
            drug_identifier_requested: drugIdentifier,
            identifier_type_used: identifierType,
            shortage_search_term: shortageSearchTerm,
            label_information: parsedLabelInfo,
            shortage_information: shortageInfo,
            data_sources: {
                label_data: "openFDA Drug Label API",
                shortage_data: "openFDA Drug Shortages API"
            },
            timestamp: new Date().toISOString()
        };

        // Determine overall status
        const hasLabelError = "error" in parsedLabelInfo;
        const hasShortageError = "error" in shortageInfo;
        const hasShortageData = "shortages" in shortageInfo && shortageInfo.shortages.length > 0;

        if (hasLabelError && hasShortageError) {
            profile.overall_status = "Failed to retrieve label and shortage information";
        } else if (hasLabelError) {
            if (hasShortageData) {
                profile.overall_status = "Retrieved shortage data but failed to get label information";
            } else {
                profile.overall_status = "No shortage found and failed to get label information";
            }
        } else if (hasShortageError) {
            profile.overall_status = "Retrieved label information but shortage API error occurred";
        } else if (!labelInfo || !labelInfo.openfda) {
            if (hasShortageData) {
                profile.overall_status = "Found shortage information but label data was minimal";
            } else {
                profile.overall_status = "No shortage found and label data was minimal";
            }
        } else {
            if (hasShortageData) {
                profile.overall_status = "SUCCESS: Retrieved complete drug profile with current shortage information";
            } else {
                profile.overall_status = "SUCCESS: Retrieved complete drug profile - no current shortages found";
            }
        }

        return profile;
    } catch (error) {
        return {
            error: `Error getting medication profile: ${error.message}`,
            drug_identifier_requested: drugIdentifier,
            identifier_type_used: identifierType,
            timestamp: new Date().toISOString()
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
        summary.recommendation = `${summary.current_shortages} current shortage(s) detected. Consider alternative sourcing.`;
    } else if (summary.resolved_shortages > 0) {
        summary.recommendation = `No current shortages, but ${summary.resolved_shortages} historical shortage(s) found. Monitor for recurrence.`;
    } else {
        summary.recommendation = "No shortage concerns detected.";
    }
    
    return summary;
}