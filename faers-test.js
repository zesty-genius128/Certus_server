#!/usr/bin/env node

/**
 * FAERS Drug Interaction Signal Detection Test Script
 * 
 * This script demonstrates how to detect potential drug interactions
 * by analyzing adverse event reports where multiple drugs are mentioned together.
 * 
 * It uses the same openFDA infrastructure as your existing shortage checker
 * but analyzes the FAERS adverse event database instead.
 */

import fetch from 'node-fetch';

// Configuration
const OPENFDA_API_KEY = process.env.OPENFDA_API_KEY;
const FAERS_ENDPOINT = "https://api.fda.gov/drug/event.json";

/**
 * Test drug combinations that we know might have interactions
 */
const TEST_DRUG_COMBINATIONS = [
    ['warfarin', 'aspirin'],           // Known bleeding risk
    ['metformin', 'insulin'],          // Diabetes medications
    ['simvastatin', 'amlodipine'],     // Statin + calcium channel blocker
    ['omeprazole', 'clopidogrel'],     // PPI + antiplatelet
    ['digoxin', 'furosemide'],         // Heart medications
    ['lithium', 'ibuprofen'],          // Mood stabilizer + NSAID
];

/**
 * Search for adverse events involving specific drug combinations
 */
async function searchAdverseEventCombinations(drug1, drug2, limit = 100) {
    console.log(`\n🔍 Searching for adverse events involving ${drug1} + ${drug2}...`);
    
    // Build query to find reports containing both drugs
    const searchQuery = `patient.drug.medicinalproduct:"${drug1}"+AND+patient.drug.medicinalproduct:"${drug2}"`;
    
    const params = new URLSearchParams({
        search: searchQuery,
        limit: limit.toString()
    });
    
    if (OPENFDA_API_KEY) {
        params.append('api_key', OPENFDA_API_KEY);
    }

    try {
        const response = await fetch(`${FAERS_ENDPOINT}?${params}`, {
            timeout: 15000
        });

        if (!response.ok) {
            if (response.status === 404) {
                return {
                    drug_combination: [drug1, drug2],
                    total_reports: 0,
                    message: "No adverse event reports found for this combination",
                    interaction_signals: []
                };
            }
            throw new Error(`HTTP error: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.results || data.results.length === 0) {
            return {
                drug_combination: [drug1, drug2],
                total_reports: 0,
                message: "No adverse event reports found for this combination",
                interaction_signals: []
            };
        }

        // Analyze the reports for interaction signals
        const analysis = analyzeAdverseEventReports(data.results, drug1, drug2);
        
        return {
            drug_combination: [drug1, drug2],
            total_reports: data.results.length,
            total_available: data.meta?.results?.total || data.results.length,
            interaction_signals: analysis.signals,
            risk_assessment: analysis.risk_level,
            common_reactions: analysis.common_reactions,
            demographic_patterns: analysis.demographics,
            data_source: "FDA FAERS Database",
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error(`❌ Error searching ${drug1} + ${drug2}:`, error.message);
        return {
            drug_combination: [drug1, drug2],
            error: `Search failed: ${error.message}`,
            timestamp: new Date().toISOString()
        };
    }
}

/**
 * Analyze adverse event reports for interaction signals
 */
function analyzeAdverseEventReports(reports, drug1, drug2) {
    const analysis = {
        signals: [],
        risk_level: "Unknown",
        common_reactions: [],
        demographics: {
            age_groups: {},
            gender_distribution: {},
            serious_outcomes: 0
        }
    };

    // Track reaction frequencies
    const reactionCounts = {};
    const seriousOutcomes = new Set(['death', 'life threatening', 'hospitalization', 'disability']);
    let seriousReports = 0;

    reports.forEach(report => {
        // Analyze patient reactions
        if (report.patient && report.patient.reaction) {
            report.patient.reaction.forEach(reaction => {
                const reactionTerm = reaction.reactionmeddrapt?.toLowerCase() || 'unknown';
                reactionCounts[reactionTerm] = (reactionCounts[reactionTerm] || 0) + 1;
            });
        }

        // Check for serious outcomes
        if (report.serious) {
            const seriousOutcome = String(report.serious).toLowerCase();
            if (seriousOutcomes.has(seriousOutcome) || seriousOutcome === '1' || seriousOutcome === 'true') {
                seriousReports++;
            }
        }

        // Demographic analysis
        if (report.patient) {
            // Age groups
            if (report.patient.patientonsetage) {
                const age = parseInt(report.patient.patientonsetage);
                let ageGroup = 'unknown';
                if (age < 18) ageGroup = 'pediatric';
                else if (age < 65) ageGroup = 'adult';
                else ageGroup = 'elderly';
                
                analysis.demographics.age_groups[ageGroup] = 
                    (analysis.demographics.age_groups[ageGroup] || 0) + 1;
            }

            // Gender
            if (report.patient.patientsex) {
                const gender = report.patient.patientsex === '1' ? 'male' : 
                              report.patient.patientsex === '2' ? 'female' : 'unknown';
                analysis.demographics.gender_distribution[gender] = 
                    (analysis.demographics.gender_distribution[gender] || 0) + 1;
            }
        }
    });

    // Store serious outcomes count
    analysis.demographics.serious_outcomes = seriousReports;

    // Get most common reactions
    const sortedReactions = Object.entries(reactionCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10);
    
    analysis.common_reactions = sortedReactions.map(([reaction, count]) => ({
        reaction: reaction,
        frequency: count,
        percentage: Math.round((count / reports.length) * 100)
    }));

    // Generate interaction signals
    const totalReports = reports.length;
    const seriousPercentage = Math.round((seriousReports / totalReports) * 100);

    // Risk assessment based on report patterns
    if (seriousReports > 0 && totalReports >= 10) {
        if (seriousPercentage > 30) {
            analysis.risk_level = "High";
            analysis.signals.push({
                type: "High Serious Outcome Rate",
                description: `${seriousPercentage}% of reports involved serious outcomes`,
                recommendation: "Consider close monitoring when prescribing these drugs together"
            });
        } else if (seriousPercentage > 15) {
            analysis.risk_level = "Moderate";
            analysis.signals.push({
                type: "Moderate Risk Pattern",
                description: `${seriousPercentage}% of reports involved serious outcomes`,
                recommendation: "Monitor patient for potential adverse effects"
            });
        } else {
            analysis.risk_level = "Low-Moderate";
        }
    } else if (totalReports >= 5) {
        analysis.risk_level = "Low";
        analysis.signals.push({
            type: "Limited Data",
            description: `Found ${totalReports} reports with minimal serious outcomes`,
            recommendation: "Standard monitoring recommended"
        });
    } else {
        analysis.risk_level = "Insufficient Data";
    }

    // Look for specific concerning reaction patterns
    const concerningReactions = [
        'bleeding', 'hemorrhage', 'rhabdomyolysis', 'serotonin syndrome', 
        'hypoglycemia', 'hyperglycemia', 'cardiac arrest', 'renal failure'
    ];

    concerningReactions.forEach(concern => {
        const matches = sortedReactions.filter(([reaction]) => 
            reaction.includes(concern.toLowerCase())
        );
        
        if (matches.length > 0) {
            const totalConcernReports = matches.reduce((sum, [, count]) => sum + count, 0);
            analysis.signals.push({
                type: "Concerning Reaction Pattern",
                description: `${totalConcernReports} reports mention ${concern}-related reactions`,
                reactions: matches.map(([reaction, count]) => `${reaction} (${count})`),
                recommendation: `Monitor for signs of ${concern}`
            });
        }
    });

    return analysis;
}

/**
 * Run comprehensive drug interaction signal testing
 */
async function runInteractionSignalTests() {
    console.log('🧪 FAERS Drug Interaction Signal Detection Test\n');
    console.log('=' .repeat(60));
    
    const results = [];
    
    for (const [drug1, drug2] of TEST_DRUG_COMBINATIONS) {
        const result = await searchAdverseEventCombinations(drug1, drug2, 50);
        results.push(result);
        
        // Display summary
        if (result.error) {
            console.log(`❌ ${drug1} + ${drug2}: ${result.error}`);
        } else {
            const riskIcon = result.risk_assessment === 'High' ? '🔴' : 
                           result.risk_assessment === 'Moderate' ? '🟡' : 
                           result.risk_assessment === 'Low-Moderate' ? '🟠' : '🟢';
            
            console.log(`${riskIcon} ${drug1} + ${drug2}: ${result.total_reports} reports, Risk: ${result.risk_assessment}`);
            
            if (result.interaction_signals && result.interaction_signals.length > 0) {
                result.interaction_signals.forEach(signal => {
                    console.log(`   💡 ${signal.type}: ${signal.description}`);
                });
            }
            
            if (result.common_reactions && result.common_reactions.length > 0) {
                const topReaction = result.common_reactions[0];
                console.log(`   📊 Most common reaction: ${topReaction.reaction} (${topReaction.percentage}%)`);
            }
        }
        
        // Rate limiting - be nice to the FDA API
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log('📋 SUMMARY REPORT');
    console.log('=' .repeat(60));
    
    const successful = results.filter(r => !r.error);
    const withSignals = successful.filter(r => r.interaction_signals && r.interaction_signals.length > 0);
    const highRisk = successful.filter(r => r.risk_assessment === 'High');
    
    console.log(`✅ Successfully analyzed: ${successful.length}/${results.length} combinations`);
    console.log(`⚠️  Combinations with signals: ${withSignals.length}`);
    console.log(`🔴 High-risk combinations: ${highRisk.length}`);
    
    if (highRisk.length > 0) {
        console.log('\n🚨 HIGH-RISK COMBINATIONS:');
        highRisk.forEach(result => {
            console.log(`   • ${result.drug_combination.join(' + ')}: ${result.total_reports} reports`);
        });
    }
    
    console.log('\n💡 INTEGRATION POTENTIAL:');
    console.log('   • This could be added as a new MCP tool: "analyze_drug_interaction_signals"');
    console.log('   • Integrates with your existing openFDA infrastructure');
    console.log('   • Provides real-world safety data beyond traditional interaction databases');
    console.log('   • Could complement your shortage data with safety insights');
    
    return results;
}

/**
 * Test a specific drug combination (for manual testing)
 */
async function testSpecificCombination(drug1, drug2) {
    console.log(`🔬 Testing specific combination: ${drug1} + ${drug2}\n`);
    
    const result = await searchAdverseEventCombinations(drug1, drug2, 100);
    
    console.log('📄 DETAILED RESULTS:');
    console.log(JSON.stringify(result, null, 2));
    
    return result;
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const args = process.argv.slice(2);
    
    if (args.length === 2) {
        // Test specific combination
        testSpecificCombination(args[0], args[1])
            .then(() => process.exit(0))
            .catch(error => {
                console.error('Test failed:', error);
                process.exit(1);
            });
    } else {
        // Run full test suite
        runInteractionSignalTests()
            .then(() => {
                console.log('\n✅ All tests completed!');
                process.exit(0);
            })
            .catch(error => {
                console.error('Test suite failed:', error);
                process.exit(1);
            });
    }
}

export { searchAdverseEventCombinations, analyzeAdverseEventReports };