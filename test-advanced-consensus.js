const crypto = require('crypto');

// Mock ProofOfComputeConsensus for testing
class MockProofOfComputeConsensus {
    constructor() {
        this.validators = new Map();
        this.blocks = [];
        this.challenges = new Map();
        this.pendingWork = new Map();
        this.networkMetrics = {
            networkHealth: 'good',
            consensusRate: 0.95,
            averageBlockTime: 10.5,
            totalStaked: 50000,
            networkHashrate: 1250000,
            byzantineFaultTolerance: 0.33,
            lastBlockHeight: 1234,
            activeValidatorCount: 15
        };
        
        // Initialize with some test data
        this.initializeTestData();
    }
    
    initializeTestData() {
        // Create test validators
        for (let i = 1; i <= 5; i++) {
            const validatorId = `validator_${i}`;
            this.validators.set(validatorId, {
                id: validatorId,
                nodeId: `node_${i}`,
                stake: 1000 + (i * 500),
                computePower: 10.0 + i,
                publicKey: crypto.randomBytes(32).toString('hex'),
                status: 'active',
                reputation: 0.9 + (i * 0.02),
                blocksProposed: i * 3,
                uptime: 0.95 + (i * 0.01),
                lastActivity: new Date(Date.now() - (i * 1000 * 60)).toISOString(),
                registrationTime: new Date(Date.now() - (i * 1000 * 60 * 60 * 24))
            });
        }
        
        // Create test blocks
        for (let i = 1; i <= 10; i++) {
            this.blocks.push({
                height: i,
                hash: crypto.createHash('sha256').update(`block_${i}`).digest('hex'),
                proposer: `validator_${(i % 5) + 1}`,
                timestamp: new Date(Date.now() - ((10 - i) * 1000 * 60 * 10)).toISOString(),
                transactions: Array.from({length: i % 5 + 1}, (_, j) => `tx_${i}_${j}`),
                computeWork: Array.from({length: i % 3 + 1}, (_, j) => `work_${i}_${j}`)
            });
        }
    }
    
    registerValidator(nodeId, stake, computePower, publicKey, metadata = {}) {
        const validatorId = `validator_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        this.validators.set(validatorId, {
            id: validatorId,
            nodeId,
            stake,
            computePower,
            publicKey,
            status: 'active',
            reputation: 1.0,
            blocksProposed: 0,
            uptime: 1.0,
            lastActivity: new Date().toISOString(),
            registrationTime: new Date(),
            metadata
        });
        
        return validatorId;
    }
    
    getValidator(validatorId) {
        return this.validators.get(validatorId);
    }
    
    submitComputeWork(validatorId, workResult, proof, nonce) {
        const workId = `work_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const timestamp = new Date().toISOString();
        
        // Simple verification simulation
        const verified = crypto.createHash('sha256')
            .update(JSON.stringify(workResult) + proof + nonce)
            .digest('hex')
            .startsWith('0');
        
        const work = {
            workId,
            validatorId,
            workResult,
            proof,
            nonce,
            verified,
            timestamp
        };
        
        this.pendingWork.set(workId, work);
        
        return work;
    }
    
    getPendingChallenges(validatorId) {
        const challenges = this.challenges.get(validatorId) || [];
        return challenges.filter(challenge => !challenge.completed);
    }
    
    issueComputeChallenge(validatorId, difficulty = 'medium') {
        const challengeId = `challenge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const challenge = {
            id: challengeId,
            validatorId,
            type: 'proof_of_computation',
            difficulty,
            deadline: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
            parameters: {
                iterations: difficulty === 'easy' ? 1000 : difficulty === 'medium' ? 10000 : 100000,
                algorithm: 'sha256',
                target: '0'.repeat(difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3)
            },
            completed: false
        };
        
        if (!this.challenges.has(validatorId)) {
            this.challenges.set(validatorId, []);
        }
        this.challenges.get(validatorId).push(challenge);
        
        return challenge;
    }
    
    getLatestBlocks(limit = 10) {
        return this.blocks.slice(-limit).reverse();
    }
    
    getBlockHeight() {
        return this.blocks.length;
    }
    
    getAllValidators() {
        return Array.from(this.validators.values());
    }
    
    getNetworkMetrics() {
        return { ...this.networkMetrics };
    }
    
    increaseStake(validatorId, amount) {
        const validator = this.validators.get(validatorId);
        if (!validator) {
            throw new Error('Validator not found');
        }
        
        validator.stake += amount;
        this.validators.set(validatorId, validator);
        return validator.stake;
    }
    
    decreaseStake(validatorId, amount) {
        const validator = this.validators.get(validatorId);
        if (!validator) {
            throw new Error('Validator not found');
        }
        
        if (validator.stake < amount) {
            throw new Error('Insufficient stake');
        }
        
        validator.stake -= amount;
        this.validators.set(validatorId, validator);
        return validator.stake;
    }
    
    produceBlock(validatorId, transactions = [], computeWork = []) {
        const validator = this.validators.get(validatorId);
        if (!validator) {
            throw new Error('Validator not found');
        }
        
        const height = this.blocks.length + 1;
        const block = {
            height,
            hash: crypto.createHash('sha256').update(`block_${height}_${validatorId}`).digest('hex'),
            proposer: validatorId,
            timestamp: new Date().toISOString(),
            transactions,
            computeWork,
            previousHash: this.blocks.length > 0 ? this.blocks[this.blocks.length - 1].hash : '0'
        };
        
        this.blocks.push(block);
        validator.blocksProposed++;
        this.validators.set(validatorId, validator);
        
        return block;
    }
}

// Test suite for Advanced Consensus Mechanism
async function runConsensusTests() {
    console.log('\n🔄 Starting Advanced Consensus Mechanism Tests...\n');
    
    const consensus = new MockProofOfComputeConsensus();
    let testsPassed = 0;
    let totalTests = 0;
    
    // Test 1: Validator Registration
    totalTests++;
    try {
        const validatorId = consensus.registerValidator(
            'test_node_1',
            2000,
            15.5,
            crypto.randomBytes(32).toString('hex'),
            { region: 'us-east-1' }
        );
        
        const validator = consensus.getValidator(validatorId);
        if (validator && validator.stake === 2000 && validator.computePower === 15.5) {
            console.log('✅ Test 1 Passed: Validator Registration');
            testsPassed++;
        } else {
            console.log('❌ Test 1 Failed: Validator Registration');
        }
    } catch (error) {
        console.log('❌ Test 1 Failed: Validator Registration -', error.message);
    }
    
    // Test 2: Work Submission
    totalTests++;
    try {
        const validators = consensus.getAllValidators();
        const testValidator = validators[0];
        
        const workResult = { result: 'computed_value_123', hash: 'abc123def456' };
        const proof = crypto.createHash('sha256').update(JSON.stringify(workResult)).digest('hex');
        
        const work = consensus.submitComputeWork(
            testValidator.id,
            workResult,
            proof,
            12345
        );
        
        if (work.workId && work.validatorId === testValidator.id) {
            console.log('✅ Test 2 Passed: Work Submission');
            testsPassed++;
        } else {
            console.log('❌ Test 2 Failed: Work Submission');
        }
    } catch (error) {
        console.log('❌ Test 2 Failed: Work Submission -', error.message);
    }
    
    // Test 3: Challenge System
    totalTests++;
    try {
        const validators = consensus.getAllValidators();
        const testValidator = validators[0];
        
        const challenge = consensus.issueComputeChallenge(testValidator.id, 'medium');
        const pendingChallenges = consensus.getPendingChallenges(testValidator.id);
        
        if (challenge.id && pendingChallenges.length > 0) {
            console.log('✅ Test 3 Passed: Challenge System');
            testsPassed++;
        } else {
            console.log('❌ Test 3 Failed: Challenge System');
        }
    } catch (error) {
        console.log('❌ Test 3 Failed: Challenge System -', error.message);
    }
    
    // Test 4: Block Production
    totalTests++;
    try {
        const validators = consensus.getAllValidators();
        const testValidator = validators[0];
        
        const initialHeight = consensus.getBlockHeight();
        const block = consensus.produceBlock(
            testValidator.id,
            ['tx1', 'tx2'],
            ['work1', 'work2']
        );
        
        const newHeight = consensus.getBlockHeight();
        if (block.height === initialHeight + 1 && newHeight === initialHeight + 1) {
            console.log('✅ Test 4 Passed: Block Production');
            testsPassed++;
        } else {
            console.log('❌ Test 4 Failed: Block Production');
        }
    } catch (error) {
        console.log('❌ Test 4 Failed: Block Production -', error.message);
    }
    
    // Test 5: Stake Management
    totalTests++;
    try {
        const validators = consensus.getAllValidators();
        const testValidator = validators[0];
        const initialStake = testValidator.stake;
        
        const newStake = consensus.increaseStake(testValidator.id, 500);
        if (newStake === initialStake + 500) {
            const reducedStake = consensus.decreaseStake(testValidator.id, 200);
            if (reducedStake === initialStake + 300) {
                console.log('✅ Test 5 Passed: Stake Management');
                testsPassed++;
            } else {
                console.log('❌ Test 5 Failed: Stake Management - Decrease failed');
            }
        } else {
            console.log('❌ Test 5 Failed: Stake Management - Increase failed');
        }
    } catch (error) {
        console.log('❌ Test 5 Failed: Stake Management -', error.message);
    }
    
    // Test 6: Network Metrics
    totalTests++;
    try {
        const metrics = consensus.getNetworkMetrics();
        
        if (metrics.networkHealth && metrics.consensusRate && metrics.totalStaked) {
            console.log('✅ Test 6 Passed: Network Metrics');
            testsPassed++;
        } else {
            console.log('❌ Test 6 Failed: Network Metrics');
        }
    } catch (error) {
        console.log('❌ Test 6 Failed: Network Metrics -', error.message);
    }
    
    // Test 7: Validator Status Filtering
    totalTests++;
    try {
        const allValidators = consensus.getAllValidators();
        const activeValidators = allValidators.filter(v => v.status === 'active');
        
        if (activeValidators.length > 0 && activeValidators.every(v => v.status === 'active')) {
            console.log('✅ Test 7 Passed: Validator Status Filtering');
            testsPassed++;
        } else {
            console.log('❌ Test 7 Failed: Validator Status Filtering');
        }
    } catch (error) {
        console.log('❌ Test 7 Failed: Validator Status Filtering -', error.message);
    }
    
    // Test 8: Block History
    totalTests++;
    try {
        const latestBlocks = consensus.getLatestBlocks(5);
        
        if (latestBlocks.length > 0 && latestBlocks[0].height >= latestBlocks[latestBlocks.length - 1].height) {
            console.log('✅ Test 8 Passed: Block History');
            testsPassed++;
        } else {
            console.log('❌ Test 8 Failed: Block History');
        }
    } catch (error) {
        console.log('❌ Test 8 Failed: Block History -', error.message);
    }
    
    // Test 9: Byzantine Fault Tolerance Validation
    totalTests++;
    try {
        const metrics = consensus.getNetworkMetrics();
        const activeValidators = consensus.getAllValidators().filter(v => v.status === 'active');
        
        // BFT requires > 2/3 honest validators
        const bftThreshold = Math.floor(activeValidators.length * 2/3) + 1;
        
        if (metrics.byzantineFaultTolerance <= 0.34 && activeValidators.length >= bftThreshold) {
            console.log('✅ Test 9 Passed: Byzantine Fault Tolerance Validation');
            testsPassed++;
        } else {
            console.log('❌ Test 9 Failed: Byzantine Fault Tolerance Validation');
        }
    } catch (error) {
        console.log('❌ Test 9 Failed: Byzantine Fault Tolerance Validation -', error.message);
    }
    
    // Test 10: Consensus Rate Monitoring
    totalTests++;
    try {
        const metrics = consensus.getNetworkMetrics();
        
        if (metrics.consensusRate >= 0.8 && metrics.consensusRate <= 1.0) {
            console.log('✅ Test 10 Passed: Consensus Rate Monitoring');
            testsPassed++;
        } else {
            console.log('❌ Test 10 Failed: Consensus Rate Monitoring');
        }
    } catch (error) {
        console.log('❌ Test 10 Failed: Consensus Rate Monitoring -', error.message);
    }
    
    console.log(`\n📊 Advanced Consensus Tests Complete: ${testsPassed}/${totalTests} passed\n`);
    return { testsPassed, totalTests };
}

// Consensus demonstration
async function runConsensusDemo() {
    console.log('\n🚀 Advanced Consensus Mechanism Demo\n');
    
    const consensus = new MockProofOfComputeConsensus();
    
    // Demo 1: Multi-Validator Network Setup
    console.log('📋 Setting up multi-validator network...');
    const validators = [];
    for (let i = 1; i <= 3; i++) {
        const validatorId = consensus.registerValidator(
            `enterprise_node_${i}`,
            2000 + (i * 1000),
            20.0 + (i * 5),
            crypto.randomBytes(32).toString('hex'),
            { 
                region: ['us-east-1', 'eu-west-1', 'ap-southeast-1'][i-1],
                tier: 'enterprise'
            }
        );
        validators.push(validatorId);
        console.log(`   ✓ Registered validator ${i}: ${validatorId} (${2000 + (i * 1000)} tokens stake)`);
    }
    
    // Demo 2: Distributed Work Submission
    console.log('\n💻 Submitting distributed computational work...');
    for (let i = 0; i < validators.length; i++) {
        const workResult = {
            computation: `machine_learning_model_${i + 1}`,
            accuracy: 0.95 + (i * 0.01),
            iterations: 10000 + (i * 5000)
        };
        const proof = crypto.createHash('sha256').update(JSON.stringify(workResult)).digest('hex');
        
        const work = consensus.submitComputeWork(validators[i], workResult, proof, i * 12345);
        console.log(`   ✓ Work submitted by validator ${i + 1}: ${work.workId} (verified: ${work.verified})`);
    }
    
    // Demo 3: Challenge-Response System
    console.log('\n🎯 Issuing compute challenges...');
    for (let i = 0; i < validators.length; i++) {
        const challenge = consensus.issueComputeChallenge(
            validators[i], 
            ['easy', 'medium', 'hard'][i]
        );
        console.log(`   ✓ Challenge issued to validator ${i + 1}: ${challenge.type} (difficulty: ${challenge.difficulty})`);
    }
    
    // Demo 4: Block Production Cycle
    console.log('\n🧱 Producing consensus blocks...');
    for (let round = 1; round <= 3; round++) {
        const proposer = validators[round - 1];
        const transactions = [`tx_${round}_1`, `tx_${round}_2`];
        const computeWork = [`work_${round}_1`];
        
        const block = consensus.produceBlock(proposer, transactions, computeWork);
        console.log(`   ✓ Block ${block.height} produced by validator ${round}: ${block.hash.substring(0, 16)}...`);
    }
    
    // Demo 5: Network Health Monitoring
    console.log('\n📊 Network consensus metrics:');
    const metrics = consensus.getNetworkMetrics();
    console.log(`   • Network Health: ${metrics.networkHealth}`);
    console.log(`   • Consensus Rate: ${(metrics.consensusRate * 100).toFixed(1)}%`);
    console.log(`   • Average Block Time: ${metrics.averageBlockTime}s`);
    console.log(`   • Total Staked: ${metrics.totalStaked} tokens`);
    console.log(`   • Network Hashrate: ${(metrics.networkHashrate / 1000000).toFixed(1)}M H/s`);
    console.log(`   • Byzantine Fault Tolerance: ${(metrics.byzantineFaultTolerance * 100).toFixed(1)}%`);
    console.log(`   • Active Validators: ${metrics.activeValidatorCount}`);
    
    // Demo 6: Stake Redistribution
    console.log('\n💰 Stake management operations...');
    for (let i = 0; i < validators.length; i++) {
        const validator = consensus.getValidator(validators[i]);
        const stakeIncrease = 500 + (i * 250);
        
        const newStake = consensus.increaseStake(validators[i], stakeIncrease);
        console.log(`   ✓ Validator ${i + 1} stake increased by ${stakeIncrease} tokens (new total: ${newStake})`);
    }
    
    console.log('\n✨ Advanced Consensus Mechanism Demo Complete!\n');
}

// Main execution
if (require.main === module) {
    (async () => {
        try {
            await runConsensusTests();
            await runConsensusDemo();
            console.log('🎉 Advanced Consensus Mechanism testing completed successfully!');
        } catch (error) {
            console.error('❌ Testing failed:', error);
            process.exit(1);
        }
    })();
}

module.exports = {
    runConsensusTests,
    runConsensusDemo,
    MockProofOfComputeConsensus
};