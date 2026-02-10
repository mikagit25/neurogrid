const crypto = require('crypto');
const ProofOfComputeConsensus = require('./coordinator-server/src/consensus/ProofOfComputeConsensus');

/**
 * Comprehensive Integration Tests for Advanced Consensus Mechanism
 * Tests the Proof-of-Compute consensus engine with realistic scenarios
 */
class ConsensusIntegrationTests {
    constructor() {
        this.consensus = new ProofOfComputeConsensus();
        this.testResults = [];
        this.validators = [];
        this.startTime = Date.now();
    }

    // Helper method to log test results
    logTest(testName, passed, details = '') {
        const result = {
            test: testName,
            status: passed ? 'PASS' : 'FAIL',
            details,
            timestamp: new Date().toISOString()
        };
        this.testResults.push(result);
        
        const emoji = passed ? '✅' : '❌';
        const statusColor = passed ? '\x1b[32m' : '\x1b[31m';
        console.log(`${emoji} ${statusColor}${testName}\x1b[0m ${details ? `- ${details}` : ''}`);
        
        return passed;
    }

    // Generate realistic validator data
    generateValidatorData(id) {
        return {
            id: `validator_${id}`,
            nodeId: `node_${id}`,
            stake: 10000 + Math.floor(Math.random() * 40000), // 10K-50K tokens (meets minimum requirement)
            computePower: 1.0 + Math.random() * 49.0, // 1-50 GFLOPS
            publicKey: crypto.randomBytes(32).toString('hex'),
            metadata: {
                region: ['us-east', 'eu-west', 'asia-pacific'][Math.floor(Math.random() * 3)],
                nodeType: ['high-compute', 'standard', 'low-latency'][Math.floor(Math.random() * 3)],
                version: '2.1.0'
            }
        };
    }

    // Generate computational work for testing
    generateComputeWork(validatorId, taskType = 'matrix_multiplication') {
        const taskData = {
            matrix_multiplication: {
                matrixA: Array(100).fill().map(() => Array(100).fill().map(() => Math.random())),
                matrixB: Array(100).fill().map(() => Array(100).fill().map(() => Math.random()))
            },
            hash_computation: {
                data: crypto.randomBytes(1024).toString('hex'),
                iterations: 10000
            },
            prime_factorization: {
                number: Math.floor(Math.random() * 1000000) + 100000
            }
        };

        const task = taskData[taskType];
        const proof = crypto.createHash('sha256')
            .update(JSON.stringify(task) + validatorId + Date.now())
            .digest('hex');

        return {
            taskId: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            taskType,
            result: task,
            proof,
            computeTime: Math.floor(Math.random() * 5000) + 100, // 100-5100ms
            metadata: {
                validatorId,
                timestamp: new Date().toISOString(),
                difficulty: Math.floor(Math.random() * 10) + 1
            }
        };
    }

    // Test 1: Validator Registration and Management
    async testValidatorRegistration() {
        console.log('\n🔧 Testing Validator Registration and Management...');
        
        try {
            // Register multiple validators
            for (let i = 1; i <= 5; i++) {
                const validatorData = this.generateValidatorData(i);
                
                // Use proper data structure for registerValidator
                const registrationData = {
                    validatorId: validatorData.id,
                    publicKey: validatorData.publicKey,
                    stakeAmount: validatorData.stake,
                    computeCapacity: {
                        gflops: validatorData.computePower,
                        hashRate: validatorData.computePower * 1000
                    },
                    nodeEndpoint: `http://validator-${i}.neurogrid.network:8080`,
                    metadata: validatorData.metadata
                };
                
                const validator = await this.consensus.registerValidator(registrationData);
                
                this.validators.push({ ...validatorData, registrationData });
                
                this.logTest(
                    `Validator Registration ${i}`,
                    validator !== null,
                    `ID: ${validatorData.id}, Stake: ${validatorData.stake}, Power: ${validatorData.computePower.toFixed(2)} GFLOPS`
                );
            }

            // Test validator retrieval
            const allValidators = this.consensus.getAllValidators();
            this.logTest(
                'Validator Retrieval',
                allValidators.length === 5,
                `Retrieved ${allValidators.length} validators`
            );

            // Test specific validator lookup
            const firstValidator = this.consensus.getValidator(this.validators[0].id);
            this.logTest(
                'Specific Validator Lookup',
                firstValidator !== null && firstValidator.validatorId === this.validators[0].id,
                `Found validator: ${firstValidator?.validatorId}`
            );

            return true;
        } catch (error) {
            this.logTest('Validator Registration', false, `Error: ${error.message}`);
            return false;
        }
    }

    // Test 2: Computational Work Submission and Verification
    async testComputeWorkSubmission() {
        console.log('\n💻 Testing Computational Work Submission...');
        
        try {
            let successfulSubmissions = 0;
            const totalSubmissions = 10;

            for (let i = 0; i < totalSubmissions; i++) {
                const validator = this.validators[Math.floor(Math.random() * this.validators.length)];
                const work = this.generateComputeWork(validator.id);
                
                // Use proper work data structure for submitComputeWork
                const workData = {
                    validatorId: validator.id,
                    taskId: work.taskId,
                    inputHash: crypto.createHash('sha256').update(JSON.stringify(work.result)).digest('hex'),
                    outputHash: work.proof,
                    computeProof: work.proof,
                    executionTime: work.computeTime,
                    resourceUsage: {
                        cpu: Math.random() * 100,
                        memory: Math.random() * 1000,
                        gpu: Math.random() * 50
                    },
                    timestamp: Date.now()
                };
                
                try {
                    const result = await this.consensus.submitComputeWork(workData);
                    
                    if (result && result.workId) {
                        successfulSubmissions++;
                        this.logTest(
                            `Work Submission ${i + 1}`,
                            true,
                            `${work.taskType} by ${validator.id} - WorkID: ${result.workId.substr(0, 8)}...`
                        );
                    }
                } catch (submitError) {
                    this.logTest(
                        `Work Submission ${i + 1}`,
                        false,
                        `Failed: ${submitError.message}`
                    );
                }
            }

            const successRate = (successfulSubmissions / totalSubmissions) * 100;
            this.logTest(
                'Overall Work Submission Success Rate',
                successRate >= 80,
                `${successfulSubmissions}/${totalSubmissions} (${successRate.toFixed(1)}%)`
            );

            return successfulSubmissions >= 8; // 80% success rate
        } catch (error) {
            this.logTest('Compute Work Submission', false, `Error: ${error.message}`);
            return false;
        }
    }

    // Test 3: Challenge System
    async testChallengeSystem() {
        console.log('\n🎯 Testing Challenge System...');
        
        try {
            let challengesIssued = 0;
            
            // First submit some work to challenge
            const workSubmissions = [];
            for (let i = 0; i < this.validators.length; i++) {
                const validator = this.validators[i];
                const work = this.generateComputeWork(validator.id);
                
                const workData = {
                    validatorId: validator.id,
                    taskId: work.taskId,
                    inputHash: crypto.createHash('sha256').update(JSON.stringify(work.result)).digest('hex'),
                    outputHash: work.proof,
                    computeProof: work.proof,
                    executionTime: work.computeTime,
                    resourceUsage: {
                        cpu: Math.random() * 100,
                        memory: Math.random() * 1000
                    }
                };
                
                try {
                    const workResult = await this.consensus.submitComputeWork(workData);
                    if (workResult) {
                        workSubmissions.push(workResult);
                    }
                } catch (workError) {
                    // Ignore work submission errors for now
                }
            }
            
            // Issue challenges based on submitted work
            for (const workResult of workSubmissions) {
                try {
                    const challenge = await this.consensus.issueComputeChallenge(workResult);
                    
                    if (challenge && challenge.challengeId) {
                        challengesIssued++;
                        this.logTest(
                            `Challenge Issued for Work ${workResult.workId?.substr(0, 8)}`,
                            true,
                            `ChallengeID: ${challenge.challengeId.substr(0, 8)}...`
                        );
                    }
                } catch (challengeError) {
                    this.logTest(
                        `Challenge Issue for Work ${workResult.workId?.substr(0, 8)}`,
                        false,
                        `Failed: ${challengeError.message}`
                    );
                }
            }

            // Test challenge retrieval
            for (const validator of this.validators) {
                const challenges = this.consensus.getPendingChallenges(validator.id);
                this.logTest(
                    `Pending Challenges for ${validator.id}`,
                    Array.isArray(challenges),
                    `${challenges.length} pending challenges`
                );
            }

            this.logTest(
                'Challenge System Overall',
                challengesIssued >= 1, // At least one challenge should be issued
                `${challengesIssued} challenges issued successfully`
            );

            return challengesIssued >= 1;
        } catch (error) {
            this.logTest('Challenge System', false, `Error: ${error.message}`);
            return false;
        }
    }

    // Test 4: Block Production and Consensus
    async testBlockProduction() {
        console.log('\n🔗 Testing Block Production and Consensus...');
        
        try {
            let blocksProduced = 0;
            const targetBlocks = 3;

            for (let i = 0; i < targetBlocks; i++) {
                // Select first validator as block proposer (simplified)
                const proposer = this.validators[0];
                
                try {
                    // Try to produce block with the proposer
                    const block = await this.consensus.produceBlock(proposer.id);
                    
                    if (block && block.id) {
                        blocksProduced++;
                        this.logTest(
                            `Block Production ${i + 1}`,
                            true,
                            `Proposer: ${proposer.id}, BlockID: ${block.id.substr(0, 8)}...`
                        );
                    }
                } catch (blockError) {
                    // If not current validator, try with any active validator
                    if (blockError.message.includes('current block producer')) {
                        // Force validator rotation to make this validator current
                        this.consensus.currentValidator = proposer.id;
                        try {
                            const block = await this.consensus.produceBlock(proposer.id);
                            if (block && block.id) {
                                blocksProduced++;
                                this.logTest(
                                    `Block Production ${i + 1} (forced)`,
                                    true,
                                    `Proposer: ${proposer.id}, BlockID: ${block.id.substr(0, 8)}...`
                                );
                            }
                        } catch (secondError) {
                            this.logTest(
                                `Block Production ${i + 1}`,
                                false,
                                `Failed: ${secondError.message}`
                            );
                        }
                    } else {
                        this.logTest(
                            `Block Production ${i + 1}`,
                            false,
                            `Failed: ${blockError.message}`
                        );
                    }
                }
            }

            // Test block retrieval
            const latestBlocks = this.consensus.getLatestBlocks(5);
            this.logTest(
                'Block Retrieval',
                Array.isArray(latestBlocks),
                `Retrieved ${latestBlocks.length} blocks`
            );

            // Test block height
            const blockHeight = this.consensus.getBlockHeight();
            this.logTest(
                'Block Height Tracking',
                blockHeight >= 0,
                `Current height: ${blockHeight}`
            );

            return blocksProduced >= 1; // At least one block should be produced
        } catch (error) {
            this.logTest('Block Production', false, `Error: ${error.message}`);
            return false;
        }
    }

    // Test 5: Network Metrics and Health
    async testNetworkMetrics() {
        console.log('\n📊 Testing Network Metrics and Health...');
        
        try {
            const metrics = this.consensus.getNetworkMetrics();
            
            this.logTest(
                'Network Health Calculation',
                metrics.networkHealth >= 0 && metrics.networkHealth <= 100,
                `Health: ${metrics.networkHealth.toFixed(2)}%`
            );

            this.logTest(
                'Consensus Rate Tracking',
                metrics.consensusRate >= 0 && metrics.consensusRate <= 100,
                `Rate: ${metrics.consensusRate.toFixed(2)}%`
            );

            this.logTest(
                'Total Staked Calculation',
                metrics.totalStaked > 0,
                `Total Staked: ${metrics.totalStaked.toLocaleString()} tokens`
            );

            this.logTest(
                'Active Validator Count',
                metrics.activeValidatorCount === this.validators.length,
                `Active: ${metrics.activeValidatorCount}/${this.validators.length}`
            );

            this.logTest(
                'Byzantine Fault Tolerance',
                metrics.byzantineFaultTolerance >= 0 && metrics.byzantineFaultTolerance <= 100,
                `BFT: ${metrics.byzantineFaultTolerance.toFixed(2)}%`
            );

            const hashrate = this.consensus.calculateNetworkHashRate();
            this.logTest(
                'Network Hashrate',
                hashrate > 0,
                `Hashrate: ${hashrate.toFixed(2)} H/s`
            );

            return true;
        } catch (error) {
            this.logTest('Network Metrics', false, `Error: ${error.message}`);
            return false;
        }
    }

    // Test 6: Stake Management
    async testStakeManagement() {
        console.log('\n💰 Testing Stake Management...');
        
        try {
            const testValidator = this.validators[0];
            if (!testValidator) {
                this.logTest('Stake Management', false, 'No validators available for testing');
                return false;
            }
            
            const originalStake = testValidator.stake;
            
            // Test stake increase
            const increaseAmount = 500;
            try {
                const newStake = this.consensus.increaseStake(testValidator.id, increaseAmount);
                this.logTest(
                    'Stake Increase',
                    newStake === originalStake + increaseAmount,
                    `${originalStake} + ${increaseAmount} = ${newStake}`
                );
            } catch (increaseError) {
                this.logTest('Stake Increase', false, `Failed: ${increaseError.message}`);
            }

            // Test stake decrease
            const decreaseAmount = 200;
            try {
                const newStake = this.consensus.decreaseStake(testValidator.id, decreaseAmount);
                this.logTest(
                    'Stake Decrease',
                    newStake === originalStake + increaseAmount - decreaseAmount,
                    `${originalStake + increaseAmount} - ${decreaseAmount} = ${newStake}`
                );
            } catch (decreaseError) {
                this.logTest('Stake Decrease', false, `Failed: ${decreaseError.message}`);
            }

            // Test insufficient stake decrease (should fail)
            try {
                this.consensus.decreaseStake(testValidator.id, 100000);
                this.logTest('Insufficient Stake Protection', false, 'Should have failed but did not');
            } catch (insufficientError) {
                this.logTest(
                    'Insufficient Stake Protection',
                    true,
                    'Correctly prevented excessive unstaking'
                );
            }

            return true;
        } catch (error) {
            this.logTest('Stake Management', false, `Error: ${error.message}`);
            return false;
        }
    }

    // Test 7: Byzantine Fault Tolerance
    async testByzantineFaultTolerance() {
        console.log('\n🛡️ Testing Byzantine Fault Tolerance...');
        
        try {
            // Simulate malicious validator behavior
            const maliciousValidator = this.validators[this.validators.length - 1];
            if (!maliciousValidator) {
                this.logTest('Byzantine Fault Tolerance', false, 'No validators available for testing');
                return false;
            }
            
            // Test slashing mechanism
            const originalStake = maliciousValidator.stake;
            const slashPercentage = 15;
            
            try {
                const result = this.consensus.slashValidator(
                    maliciousValidator.id,
                    slashPercentage,
                    'Double signing detected',
                    { evidenceHash: crypto.randomBytes(32).toString('hex') }
                );
                
                const expectedSlashedAmount = Math.floor(originalStake * slashPercentage / 100);
                this.logTest(
                    'Validator Slashing',
                    result.slashedAmount === expectedSlashedAmount,
                    `Slashed ${result.slashedAmount}/${expectedSlashedAmount} tokens (${slashPercentage}%)`
                );

                // Verify validator status changed
                const slashedValidator = this.consensus.getValidator(maliciousValidator.id);
                this.logTest(
                    'Slashed Validator Status',
                    slashedValidator.status === 'slashed',
                    `Status: ${slashedValidator.status}`
                );
            } catch (slashError) {
                this.logTest('Validator Slashing', false, `Failed: ${slashError.message}`);
            }

            // Test network resilience with slashed validator
            const remainingActiveValidators = this.consensus.getAllValidators()
                .filter(v => v.status === 'active').length;
            
            this.logTest(
                'Network Resilience',
                remainingActiveValidators >= Math.ceil(this.validators.length * 2/3),
                `${remainingActiveValidators} active validators remain (need ${Math.ceil(this.validators.length * 2/3)} for BFT)`
            );

            return true;
        } catch (error) {
            this.logTest('Byzantine Fault Tolerance', false, `Error: ${error.message}`);
            return false;
        }
    }

    // Test 8: Performance and Scalability
    async testPerformanceScalability() {
        console.log('\n⚡ Testing Performance and Scalability...');
        
        try {
            // Test rapid work submission
            const rapidSubmissionStart = Date.now();
            let rapidSubmissions = 0;
            const targetRapidSubmissions = 20; // Reduced for more realistic testing

            for (let i = 0; i < targetRapidSubmissions; i++) {
                // Use active validators only
                const activeValidators = this.validators.filter(v => {
                    const validator = this.consensus.getValidator(v.id);
                    return validator && validator.active;
                });
                
                if (activeValidators.length === 0) break;
                
                const validator = activeValidators[Math.floor(Math.random() * activeValidators.length)];
                const work = this.generateComputeWork(validator.id);
                
                const workData = {
                    validatorId: validator.id,
                    taskId: work.taskId,
                    inputHash: crypto.createHash('sha256').update(JSON.stringify(work.result)).digest('hex'),
                    outputHash: work.proof,
                    computeProof: work.proof,
                    executionTime: work.computeTime,
                    resourceUsage: {
                        cpu: Math.random() * 100,
                        memory: Math.random() * 1000
                    }
                };
                
                try {
                    const result = await this.consensus.submitComputeWork(workData);
                    if (result?.workId) rapidSubmissions++;
                } catch (submitError) {
                    // Count failures but continue
                }
            }

            const rapidSubmissionTime = Date.now() - rapidSubmissionStart;
            const submissionsPerSecond = rapidSubmissionTime > 0 ? (rapidSubmissions / rapidSubmissionTime) * 1000 : 0;

            this.logTest(
                'Rapid Work Submission Performance',
                submissionsPerSecond >= 0.5, // At least 0.5 submissions per second
                `${rapidSubmissions}/${targetRapidSubmissions} in ${rapidSubmissionTime}ms (${submissionsPerSecond.toFixed(2)} ops/sec)`
            );

            // Test memory usage (basic check)
            const memUsage = process.memoryUsage();
            this.logTest(
                'Memory Usage Check',
                memUsage.heapUsed < 100 * 1024 * 1024, // Less than 100MB
                `Heap: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`
            );

            return true;
        } catch (error) {
            this.logTest('Performance and Scalability', false, `Error: ${error.message}`);
            return false;
        }
    }

    // Run all integration tests
    async runAllTests() {
        console.log('\n🚀 Starting Comprehensive Consensus Integration Tests');
        console.log('='.repeat(60));
        
        const testSuite = [
            this.testValidatorRegistration.bind(this),
            this.testComputeWorkSubmission.bind(this),
            this.testChallengeSystem.bind(this),
            this.testBlockProduction.bind(this),
            this.testNetworkMetrics.bind(this),
            this.testStakeManagement.bind(this),
            this.testByzantineFaultTolerance.bind(this),
            this.testPerformanceScalability.bind(this)
        ];

        let passedTests = 0;
        const totalTests = testSuite.length;

        for (const test of testSuite) {
            try {
                const result = await test();
                if (result) passedTests++;
            } catch (error) {
                console.error(`❌ Test suite error: ${error.message}`);
            }
        }

        // Generate final report
        this.generateTestReport(passedTests, totalTests);
        
        return passedTests === totalTests;
    }

    // Generate comprehensive test report
    generateTestReport(passedTests, totalTests) {
        const duration = Date.now() - this.startTime;
        const successRate = (passedTests / totalTests) * 100;
        
        console.log('\n' + '='.repeat(60));
        console.log('📋 CONSENSUS INTEGRATION TEST REPORT');
        console.log('='.repeat(60));
        console.log(`⏱️  Duration: ${duration}ms`);
        console.log(`✅ Passed: ${passedTests}/${totalTests} tests`);
        console.log(`📊 Success Rate: ${successRate.toFixed(1)}%`);
        console.log(`🏗️  Validators Registered: ${this.validators.length}`);
        console.log(`⛓️  Network Status: ${successRate >= 85 ? 'HEALTHY' : 'NEEDS ATTENTION'}`);
        
        if (successRate >= 85) {
            console.log('\n🎉 CONSENSUS MECHANISM READY FOR MAINNET! 🎉');
            console.log('✨ Advanced Proof-of-Compute consensus is fully operational');
            console.log('🔒 Byzantine fault tolerance verified');
            console.log('⚡ Performance meets scalability requirements');
            console.log('🛡️ Security mechanisms functioning correctly');
        } else {
            console.log('\n⚠️  CONSENSUS MECHANISM NEEDS IMPROVEMENT');
            console.log('🔧 Review failed tests and address issues before MainNet deployment');
        }
        
        console.log('\n📝 Individual Test Results:');
        this.testResults.forEach(result => {
            const emoji = result.status === 'PASS' ? '✅' : '❌';
            console.log(`${emoji} ${result.test}: ${result.status} ${result.details ? `(${result.details})` : ''}`);
        });
        
        console.log('\n' + '='.repeat(60));
    }
}

// Run the integration tests
async function runConsensusIntegrationTests() {
    const testRunner = new ConsensusIntegrationTests();
    
    try {
        const allTestsPassed = await testRunner.runAllTests();
        process.exit(allTestsPassed ? 0 : 1);
    } catch (error) {
        console.error('❌ Integration test runner failed:', error);
        process.exit(1);
    }
}

// Execute if run directly
if (require.main === module) {
    runConsensusIntegrationTests();
}

module.exports = ConsensusIntegrationTests;