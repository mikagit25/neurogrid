// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title NeuroGrid Staking Pool
 * @dev Staking contract for NGRID tokens with rewards distribution
 */
contract NeuroGridStaking is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    
    IERC20 public immutable stakingToken;
    IERC20 public immutable rewardToken;
    
    // Staking pool structure
    struct Pool {
        uint256 poolId;
        string name;
        uint256 minimumStake;
        uint256 lockPeriod; // in seconds
        uint256 rewardRate; // reward per second per token
        uint256 totalStaked;
        uint256 lastUpdateTime;
        uint256 rewardPerTokenStored;
        bool active;
        uint256 maxStakers;
        uint256 currentStakers;
    }
    
    // User stake information
    struct UserStake {
        uint256 amount;
        uint256 rewardPerTokenPaid;
        uint256 rewards;
        uint256 stakedAt;
        uint256 unlocksAt;
        uint256 poolId;
        bool withdrawn;
    }
    
    // State variables
    uint256 public nextPoolId = 1;
    mapping(uint256 => Pool) public pools;
    mapping(address => mapping(uint256 => UserStake)) public userStakes;
    mapping(address => uint256[]) public userPoolIds;
    mapping(uint256 => address[]) public poolStakers;
    
    // Node operator boosting
    mapping(address => bool) public isNodeOperator;
    mapping(address => uint256) public nodeOperatorMultiplier; // basis points (10000 = 100%)
    
    // Events
    event PoolCreated(uint256 indexed poolId, string name, uint256 rewardRate, uint256 lockPeriod);
    event Staked(address indexed user, uint256 indexed poolId, uint256 amount);
    event Withdrawn(address indexed user, uint256 indexed poolId, uint256 amount);
    event RewardsClaimed(address indexed user, uint256 indexed poolId, uint256 reward);
    event RewardAdded(uint256 indexed poolId, uint256 reward);
    event PoolUpdated(uint256 indexed poolId, uint256 newRewardRate);
    event NodeOperatorAdded(address indexed node, uint256 multiplier);
    
    constructor(address _stakingToken, address _rewardToken) {
        require(_stakingToken != address(0), "Invalid staking token");
        require(_rewardToken != address(0), "Invalid reward token");
        
        stakingToken = IERC20(_stakingToken);
        rewardToken = IERC20(_rewardToken);
        
        // Create default staking pools
        _createDefaultPools();
    }
    
    /**
     * @dev Create default staking pools
     */
    function _createDefaultPools() internal {
        // Flexible staking (no lock period)
        createPool("Flexible Staking", 1000 * 10**18, 0, 158548959919); // ~5% APY
        
        // 30-day lock staking
        createPool("30-Day Lock", 5000 * 10**18, 30 days, 317097919838); // ~10% APY
        
        // 90-day lock staking
        createPool("90-Day Lock", 10000 * 10**18, 90 days, 633195839675); // ~20% APY
        
        // Node operator staking (highest rewards)
        createPool("Node Operator Pool", 50000 * 10**18, 180 days, 1266391679350); // ~40% APY
    }
    
    /**
     * @dev Create a new staking pool
     */
    function createPool(
        string memory name,
        uint256 minimumStake,
        uint256 lockPeriod,
        uint256 rewardRate
    ) public onlyOwner returns (uint256) {
        uint256 poolId = nextPoolId++;
        
        pools[poolId] = Pool({
            poolId: poolId,
            name: name,
            minimumStake: minimumStake,
            lockPeriod: lockPeriod,
            rewardRate: rewardRate,
            totalStaked: 0,
            lastUpdateTime: block.timestamp,
            rewardPerTokenStored: 0,
            active: true,
            maxStakers: 10000, // Default max stakers
            currentStakers: 0
        });
        
        emit PoolCreated(poolId, name, rewardRate, lockPeriod);
        return poolId;
    }
    
    /**
     * @dev Stake tokens in a pool
     */
    function stake(uint256 poolId, uint256 amount) external nonReentrant {
        require(amount > 0, "Cannot stake 0");
        require(pools[poolId].active, "Pool not active");
        require(amount >= pools[poolId].minimumStake, "Below minimum stake");
        require(pools[poolId].currentStakers < pools[poolId].maxStakers, "Pool full");
        
        Pool storage pool = pools[poolId];
        UserStake storage userStake = userStakes[msg.sender][poolId];
        
        // Update pool rewards
        _updateReward(poolId, msg.sender);
        
        // If new staker, add to pool
        if (userStake.amount == 0 && !userStake.withdrawn) {
            poolStakers[poolId].push(msg.sender);
            userPoolIds[msg.sender].push(poolId);
            pool.currentStakers++;
        }
        
        // Calculate unlock time
        uint256 unlocksAt = block.timestamp + pool.lockPeriod;
        if (userStake.amount > 0 && unlocksAt > userStake.unlocksAt) {
            userStake.unlocksAt = unlocksAt; // Extend lock if longer period
        } else if (userStake.amount == 0) {
            userStake.unlocksAt = unlocksAt;
            userStake.stakedAt = block.timestamp;
            userStake.poolId = poolId;
        }
        
        // Update balances
        userStake.amount += amount;
        pool.totalStaked += amount;
        
        // Transfer tokens
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        
        emit Staked(msg.sender, poolId, amount);
    }
    
    /**
     * @dev Withdraw staked tokens
     */
    function withdraw(uint256 poolId, uint256 amount) external nonReentrant {
        UserStake storage userStake = userStakes[msg.sender][poolId];
        Pool storage pool = pools[poolId];
        
        require(userStake.amount >= amount, "Insufficient stake");
        require(block.timestamp >= userStake.unlocksAt, "Still locked");
        require(!userStake.withdrawn, "Already withdrawn");
        
        // Update rewards before withdrawal
        _updateReward(poolId, msg.sender);
        
        // Update balances
        userStake.amount -= amount;
        pool.totalStaked -= amount;
        
        // If fully withdrawn, mark as withdrawn
        if (userStake.amount == 0) {
            userStake.withdrawn = true;
            pool.currentStakers--;
        }
        
        // Transfer tokens
        stakingToken.safeTransfer(msg.sender, amount);
        
        emit Withdrawn(msg.sender, poolId, amount);
    }
    
    /**
     * @dev Claim accumulated rewards
     */
    function claimRewards(uint256 poolId) external nonReentrant {
        UserStake storage userStake = userStakes[msg.sender][poolId];
        require(userStake.amount > 0, "No stake in pool");
        
        _updateReward(poolId, msg.sender);
        
        uint256 reward = userStake.rewards;
        if (reward > 0) {
            userStake.rewards = 0;
            
            // Apply node operator multiplier if applicable
            if (isNodeOperator[msg.sender]) {
                uint256 bonus = (reward * nodeOperatorMultiplier[msg.sender]) / 10000;
                reward += bonus;
            }
            
            rewardToken.safeTransfer(msg.sender, reward);
            emit RewardsClaimed(msg.sender, poolId, reward);
        }
    }
    
    /**
     * @dev Update reward calculations for a pool and user
     */
    function _updateReward(uint256 poolId, address account) internal {
        Pool storage pool = pools[poolId];
        UserStake storage userStake = userStakes[account][poolId];
        
        pool.rewardPerTokenStored = rewardPerToken(poolId);
        pool.lastUpdateTime = block.timestamp;
        
        if (account != address(0) && userStake.amount > 0) {
            userStake.rewards = earned(poolId, account);
            userStake.rewardPerTokenPaid = pool.rewardPerTokenStored;
        }
    }
    
    /**
     * @dev Calculate reward per token for a pool
     */
    function rewardPerToken(uint256 poolId) public view returns (uint256) {
        Pool storage pool = pools[poolId];
        
        if (pool.totalStaked == 0) {
            return pool.rewardPerTokenStored;
        }
        
        uint256 timeElapsed = block.timestamp - pool.lastUpdateTime;
        uint256 rewardToAdd = timeElapsed * pool.rewardRate;
        
        return pool.rewardPerTokenStored + (rewardToAdd * 1e18) / pool.totalStaked;
    }
    
    /**
     * @dev Calculate earned rewards for a user in a pool
     */
    function earned(uint256 poolId, address account) public view returns (uint256) {
        UserStake storage userStake = userStakes[account][poolId];
        
        uint256 rewardPerTokenDiff = rewardPerToken(poolId) - userStake.rewardPerTokenPaid;
        uint256 earned = (userStake.amount * rewardPerTokenDiff) / 1e18;
        
        return userStake.rewards + earned;
    }
    
    /**
     * @dev Get user's total staked amount across all pools
     */
    function getTotalStaked(address account) external view returns (uint256) {
        uint256[] memory pools_array = userPoolIds[account];
        uint256 total = 0;
        
        for (uint i = 0; i < pools_array.length; i++) {
            total += userStakes[account][pools_array[i]].amount;
        }
        
        return total;
    }
    
    /**
     * @dev Get user's total pending rewards across all pools
     */
    function getTotalRewards(address account) external view returns (uint256) {
        uint256[] memory pools_array = userPoolIds[account];
        uint256 total = 0;
        
        for (uint i = 0; i < pools_array.length; i++) {
            total += earned(pools_array[i], account);
        }
        
        return total;
    }
    
    /**
     * @dev Add node operator with bonus multiplier
     */
    function addNodeOperator(address node, uint256 multiplier) external onlyOwner {
        require(node != address(0), "Invalid address");
        require(multiplier <= 5000, "Multiplier too high (max 50%)"); // Max 50% bonus
        
        isNodeOperator[node] = true;
        nodeOperatorMultiplier[node] = multiplier;
        
        emit NodeOperatorAdded(node, multiplier);
    }
    
    /**
     * @dev Remove node operator status
     */
    function removeNodeOperator(address node) external onlyOwner {
        isNodeOperator[node] = false;
        nodeOperatorMultiplier[node] = 0;
    }
    
    /**
     * @dev Update pool parameters
     */
    function updatePool(
        uint256 poolId,
        uint256 newRewardRate,
        bool active
    ) external onlyOwner {
        require(pools[poolId].poolId != 0, "Pool does not exist");
        
        _updateReward(poolId, address(0)); // Update pool state
        
        pools[poolId].rewardRate = newRewardRate;
        pools[poolId].active = active;
        
        emit PoolUpdated(poolId, newRewardRate);
    }
    
    /**
     * @dev Add rewards to contract (called by owner or reward distributor)
     */
    function addRewards(uint256 poolId, uint256 amount) external {
        require(msg.sender == owner() || msg.sender == address(this), "Not authorized");
        require(pools[poolId].active, "Pool not active");
        
        rewardToken.safeTransferFrom(msg.sender, address(this), amount);
        
        emit RewardAdded(poolId, amount);
    }
    
    /**
     * @dev Emergency withdraw (forfeit rewards)
     */
    function emergencyWithdraw(uint256 poolId) external nonReentrant {
        UserStake storage userStake = userStakes[msg.sender][poolId];
        Pool storage pool = pools[poolId];
        
        require(userStake.amount > 0, "No stake to withdraw");
        
        uint256 amount = userStake.amount;
        
        // Clear user stake
        userStake.amount = 0;
        userStake.rewards = 0;
        userStake.withdrawn = true;
        
        pool.totalStaked -= amount;
        pool.currentStakers--;
        
        stakingToken.safeTransfer(msg.sender, amount);
        
        emit Withdrawn(msg.sender, poolId, amount);
    }
    
    /**
     * @dev Get pool information
     */
    function getPoolInfo(uint256 poolId) external view returns (Pool memory) {
        return pools[poolId];
    }
    
    /**
     * @dev Get user stake information
     */
    function getUserStake(address account, uint256 poolId) external view returns (UserStake memory) {
        return userStakes[account][poolId];
    }
}