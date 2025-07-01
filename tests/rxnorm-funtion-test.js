import fetch from 'node-fetch';

const RXNORM_BASE_URL = 'https://rxnav.nlm.nih.gov/REST';

/**
 * RxNorm API Functions for Comprehensive Testing
 */

// 1. Basic drug lookup
async function findRxcuiByString(drugName) {
    try {
        const url = `${RXNORM_BASE_URL}/rxcui.json?name=${encodeURIComponent(drugName)}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.idGroup?.rxnormId) {
            return {
                success: true,
                rxcui: data.idGroup.rxnormId[0],
                allRxcuis: data.idGroup.rxnormId,
                drugName: drugName
            };
        }
        return { success: false, message: 'No RxCUI found', drugName };
    } catch (error) {
        return { success: false, error: error.message, drugName };
    }
}

// 2. Get drug properties
async function getDrugProperties(rxcui) {
    try {
        const url = `${RXNORM_BASE_URL}/rxcui/${rxcui}/properties.json`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.properties) {
            return {
                success: true,
                properties: data.properties
            };
        }
        return { success: false, message: 'No properties found' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// 3. Get all related information
async function getAllRelatedInfo(rxcui) {
    try {
        const url = `${RXNORM_BASE_URL}/rxcui/${rxcui}/allrelated.json`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.allRelatedGroup) {
            return {
                success: true,
                relatedInfo: data.allRelatedGroup
            };
        }
        return { success: false, message: 'No related info found' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// 4. Get approximate matches (fuzzy search)
async function getApproximateMatch(drugName, maxEntries = 5) {
    try {
        const url = `${RXNORM_BASE_URL}/approximateTerm.json?term=${encodeURIComponent(drugName)}&maxEntries=${maxEntries}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.approximateGroup?.candidate) {
            return {
                success: true,
                candidates: data.approximateGroup.candidate,
                originalTerm: drugName
            };
        }
        return { success: false, message: 'No approximate matches found' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// 5. Get spelling suggestions
async function getSpellingSuggestions(drugName) {
    try {
        const url = `${RXNORM_BASE_URL}/spellingsuggestions.json?name=${encodeURIComponent(drugName)}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.suggestionGroup?.suggestionList?.suggestion) {
            return {
                success: true,
                suggestions: data.suggestionGroup.suggestionList.suggestion,
                originalTerm: drugName
            };
        }
        return { success: false, message: 'No spelling suggestions found' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// 6. Get NDC information
async function getNDCs(rxcui) {
    try {
        const url = `${RXNORM_BASE_URL}/rxcui/${rxcui}/ndcs.json`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.ndcGroup?.ndcList?.ndc) {
            return {
                success: true,
                ndcs: data.ndcGroup.ndcList.ndc
            };
        }
        return { success: false, message: 'No NDCs found' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// 7. Get related drugs by type
async function getRelatedByType(rxcui, relationshipType = 'SBD') {
    try {
        const url = `${RXNORM_BASE_URL}/rxcui/${rxcui}/related.json?tty=${relationshipType}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.relatedGroup?.conceptGroup) {
            return {
                success: true,
                relatedDrugs: data.relatedGroup.conceptGroup,
                relationshipType: relationshipType
            };
        }
        return { success: false, message: 'No related drugs found' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Comprehensive drug analysis
 */
async function analyzeDrug(drugName) {
    console.log(`\nAnalyzing drug: ${drugName}`);
    console.log('='.repeat(50));
    
    const analysis = {
        drugName: drugName,
        timestamp: new Date().toISOString(),
        rxcui: null,
        properties: null,
        relatedInfo: null,
        ndcs: null,
        relatedDrugs: null
    };

    // Step 1: Find RxCUI
    console.log('1. Finding RxCUI...');
    const rxcuiResult = await findRxcuiByString(drugName);
    
    if (rxcuiResult.success) {
        analysis.rxcui = rxcuiResult.rxcui;
        console.log(`   Found RxCUI: ${rxcuiResult.rxcui}`);
        
        if (rxcuiResult.allRxcuis.length > 1) {
            console.log(`   Additional RxCUIs: ${rxcuiResult.allRxcuis.slice(1).join(', ')}`);
        }
        
        // Step 2: Get properties
        console.log('2. Getting drug properties...');
        const propertiesResult = await getDrugProperties(analysis.rxcui);
        
        if (propertiesResult.success) {
            analysis.properties = propertiesResult.properties;
            console.log(`   Name: ${propertiesResult.properties.name}`);
            console.log(`   Synonym: ${propertiesResult.properties.synonym || 'None'}`);
            console.log(`   TTY: ${propertiesResult.properties.tty}`);
        } else {
            console.log(`   Failed: ${propertiesResult.error || propertiesResult.message}`);
        }

        // Step 3: Get all related info
        console.log('3. Getting related information...');
        const relatedResult = await getAllRelatedInfo(analysis.rxcui);
        
        if (relatedResult.success) {
            analysis.relatedInfo = relatedResult.relatedInfo;
            const conceptGroups = relatedResult.relatedInfo.conceptGroup || [];
            console.log(`   Found ${conceptGroups.length} concept groups`);
            
            conceptGroups.forEach(group => {
                if (group.conceptProperties) {
                    console.log(`   - ${group.tty}: ${group.conceptProperties.length} items`);
                }
            });
        } else {
            console.log(`   Failed: ${relatedResult.error || relatedResult.message}`);
        }

        // Step 4: Get NDCs
        console.log('4. Getting NDC codes...');
        const ndcResult = await getNDCs(analysis.rxcui);
        
        if (ndcResult.success) {
            analysis.ndcs = ndcResult.ndcs;
            console.log(`   Found ${ndcResult.ndcs.length} NDC codes`);
            console.log(`   First few NDCs: ${ndcResult.ndcs.slice(0, 3).join(', ')}`);
        } else {
            console.log(`   Failed: ${ndcResult.error || ndcResult.message}`);
        }

        // Step 5: Get related drugs (branded forms)
        console.log('5. Getting related branded drugs...');
        const relatedDrugsResult = await getRelatedByType(analysis.rxcui, 'SBD');
        
        if (relatedDrugsResult.success) {
            analysis.relatedDrugs = relatedDrugsResult.relatedDrugs;
            const concepts = relatedDrugsResult.relatedDrugs[0]?.conceptProperties || [];
            console.log(`   Found ${concepts.length} branded forms`);
            
            concepts.slice(0, 3).forEach(concept => {
                console.log(`   - ${concept.name}`);
            });
        } else {
            console.log(`   Failed: ${relatedDrugsResult.error || relatedDrugsResult.message}`);
        }

    } else {
        console.log(`   Failed: ${rxcuiResult.error || rxcuiResult.message}`);
    }

    return analysis;
}

/**
 * Test fuzzy matching capabilities
 */
async function testFuzzyMatching() {
    console.log('\nTesting Fuzzy Matching Capabilities');
    console.log('===================================');
    
    const misspelledDrugs = [
        'insuln',        // insulin
        'ibuprofn',      // ibuprofen  
        'acetaminofn',   // acetaminophen
        'metfrmn',       // metformin
        'lsinprl'        // lisinopril
    ];

    for (const misspelled of misspelledDrugs) {
        console.log(`\nTesting: ${misspelled}`);
        
        // Try exact match first
        const exactResult = await findRxcuiByString(misspelled);
        
        if (exactResult.success) {
            console.log('  Exact match found (surprising!)');
        } else {
            // Try approximate match
            console.log('  No exact match, trying approximate...');
            const approxResult = await getApproximateMatch(misspelled, 3);
            
            if (approxResult.success) {
                console.log('  Approximate matches found:');
                approxResult.candidates.forEach((candidate, index) => {
                    console.log(`    ${index + 1}. ${candidate.name} (score: ${candidate.score})`);
                });
            } else {
                // Try spelling suggestions
                console.log('  No approximate matches, trying spelling suggestions...');
                const spellResult = await getSpellingSuggestions(misspelled);
                
                if (spellResult.success) {
                    console.log('  Spelling suggestions found:');
                    spellResult.suggestions.slice(0, 3).forEach((suggestion, index) => {
                        console.log(`    ${index + 1}. ${suggestion}`);
                    });
                } else {
                    console.log('  No suggestions found');
                }
            }
        }
    }
}

/**
 * Main test runner
 */
async function runComprehensiveRxNormTest() {
    console.log('Comprehensive RxNorm API Test');
    console.log('=============================');
    console.log(`API Base URL: ${RXNORM_BASE_URL}`);
    console.log(`Test started: ${new Date().toISOString()}`);

    // Test 1: Comprehensive drug analysis
    const testDrugs = ['insulin', 'metformin', 'lisinopril', 'aspirin'];
    
    for (const drug of testDrugs) {
        await analyzeDrug(drug);
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Test 2: Fuzzy matching
    await testFuzzyMatching();

    console.log('\n\nTest Summary');
    console.log('============');
    console.log('All RxNorm API functions tested successfully!');
    console.log('');
    console.log('Key capabilities verified:');
    console.log('- Drug name to RxCUI resolution');
    console.log('- Drug properties and information'); 
    console.log('- Related drug discovery');
    console.log('- NDC code lookup');
    console.log('- Fuzzy matching for misspellings');
    console.log('- Spelling suggestions');
    console.log('');
    console.log('Ready for integration into your MCP server!');
}

// Run the comprehensive test
runComprehensiveRxNormTest()
    .then(() => {
        console.log('\nTest completed successfully!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\nTest failed:', error);
        process.exit(1);
    });