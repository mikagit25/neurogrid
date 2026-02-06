// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title NeuroGrid Task Escrow
 * @dev Secure escrow system for AI task payments and node rewards
 */
contract NeuroGridEscrow is ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;
    
    IERC20 public immutable ngridToken;
    
    // Task statuses
    enum TaskStatus {
        Created,
        Assigned,
        InProgress,
        Completed,
        Disputed,
        Cancelled,
        Resolved
    }
    
    // Task structure
    struct Task {
        uint256 taskId;
        address client;
        address assignedNode;
        uint256 payment;
        uint256 nodeReward;
        uint256 platformFee;
        uint256 deadline;
        TaskStatus status;
        string taskHash; // IPFS hash of task details
        string resultHash; // IPFS hash of task result
        uint256 createdAt;
        uint256 completedAt;
        bool disputeRaised;
    }
    
    // Dispute structure
    struct Dispute {
        uint256 taskId;
        address initiator;
        string reason;
        uint256 createdAt;
        bool resolved;
        address winner;
    }
    
    // State variables
    uint256 public nextTaskId = 1;
    uint256 public platformFeePercentage = 250; // 2.5%
    uint256 public constant MAX_PLATFORM_FEE = 1000; // 10%
    uint256 public constant DISPUTE_TIMEOUT = 7 days;
    uint256 public constant TASK_TIMEOUT = 24 hours;
    
    mapping(uint256 => Task) public tasks;
    mapping(uint256 => Dispute) public disputes;
    mapping(address => uint256[]) public userTasks;
    mapping(address => uint256[]) public nodeTasks;
    mapping(address => bool) public authorizedOracles;
    
    // Events
    event TaskCreated(uint256 indexed taskId, address indexed client, uint256 payment);
    event TaskAssigned(uint256 indexed taskId, address indexed node);
    event TaskStarted(uint256 indexed taskId, address indexed node);
    event TaskCompleted(uint256 indexed taskId, address indexed node, string resultHash);
    event TaskApproved(uint256 indexed taskId, address indexed client);
    event TaskDisputed(uint256 indexed taskId, address indexed initiator, string reason);
    event DisputeResolved(uint256 indexed taskId, address indexed winner);
    event TaskCancelled(uint256 indexed taskId, address indexed client);
    event PaymentReleased(uint256 indexed taskId, address indexed node, uint256 amount);
    event RefundIssued(uint256 indexed taskId, address indexed client, uint256 amount);
    
    constructor(address _ngridToken) {
        require(_ngridToken != address(0), "Invalid token address");
        ngridToken = IERC20(_ngridToken);
    }
    
    /**
     * @dev Create a new AI task
     * @param payment Total payment for the task
     * @param deadline Task completion deadline
     * @param taskHash IPFS hash of task details
     */
    function createTask(
        uint256 payment,
        uint256 deadline,
        string memory taskHash
    ) external nonReentrant whenNotPaused returns (uint256) {
        require(payment > 0, "Payment must be > 0");
        require(deadline > block.timestamp, "Invalid deadline");
        require(bytes(taskHash).length > 0, "Task hash required");
        
        uint256 taskId = nextTaskId++;
        uint256 platformFee = (payment * platformFeePercentage) / 10000;
        uint256 nodeReward = payment - platformFee;
        
        tasks[taskId] = Task({
            taskId: taskId,
            client: msg.sender,
            assignedNode: address(0),
            payment: payment,
            nodeReward: nodeReward,
            platformFee: platformFee,
            deadline: deadline,
            status: TaskStatus.Created,
            taskHash: taskHash,
            resultHash: "",
            createdAt: block.timestamp,
            completedAt: 0,
            disputeRaised: false
        });
        
        userTasks[msg.sender].push(taskId);
        
        // Transfer payment to escrow
        ngridToken.safeTransferFrom(msg.sender, address(this), payment);
        
        emit TaskCreated(taskId, msg.sender, payment);
        return taskId;
    }
    
    /**
     * @dev Assign task to a compute node
     * @param taskId Task ID
     * @param node Node address
     */
    function assignTask(uint256 taskId, address node) external onlyOwner {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Created, "Task not available for assignment");
        require(node != address(0), "Invalid node address");
        require(node != task.client, "Node cannot be task client");
        
        task.assignedNode = node;
        task.status = TaskStatus.Assigned;
        
        nodeTasks[node].push(taskId);
        
        emit TaskAssigned(taskId, node);
    }
    
    /**
     * @dev Start task execution (called by assigned node)
     * @param taskId Task ID
     */
    function startTask(uint256 taskId) external {
        Task storage task = tasks[taskId];
        require(task.assignedNode == msg.sender, "Not assigned to you");
        require(task.status == TaskStatus.Assigned, "Task not ready to start");
        
        task.status = TaskStatus.InProgress;
        
        emit TaskStarted(taskId, msg.sender);
    }
    
    /**
     * @dev Submit task completion (called by node)
     * @param taskId Task ID
     * @param resultHash IPFS hash of task result
     */
    function completeTask(uint256 taskId, string memory resultHash) external {
        Task storage task = tasks[taskId];
        require(task.assignedNode == msg.sender, "Not assigned to you");
        require(task.status == TaskStatus.InProgress, "Task not in progress");
        require(bytes(resultHash).length > 0, "Result hash required");
        require(block.timestamp <= task.deadline, "Task deadline exceeded");
        
        task.status = TaskStatus.Completed;
        task.resultHash = resultHash;
        task.completedAt = block.timestamp;
        
        emit TaskCompleted(taskId, msg.sender, resultHash);
        
        // Auto-approve after completion (client can dispute within timeout)
        _scheduleAutoApproval(taskId);
    }
    
    /**
     * @dev Approve task completion (called by client)
     * @param taskId Task ID
     */
    function approveTask(uint256 taskId) external {
        Task storage task = tasks[taskId];
        require(task.client == msg.sender, "Not your task");
        require(task.status == TaskStatus.Completed, "Task not completed");
        
        _releasePayment(taskId);
        
        emit TaskApproved(taskId, msg.sender);
    }
    
    /**
     * @dev Raise dispute for a task
     * @param taskId Task ID
     * @param reason Dispute reason
     */
    function raiseDispute(uint256 taskId, string memory reason) external {
        Task storage task = tasks[taskId];
        require(
            msg.sender == task.client || msg.sender == task.assignedNode,
            "Not authorized to dispute"
        );
        require(
            task.status == TaskStatus.Completed || task.status == TaskStatus.InProgress,
            "Cannot dispute task in current status"
        );
        require(!task.disputeRaised, "Dispute already raised");
        require(bytes(reason).length > 0, "Dispute reason required");
        
        task.status = TaskStatus.Disputed;
        task.disputeRaised = true;
        
        disputes[taskId] = Dispute({
            taskId: taskId,
            initiator: msg.sender,
            reason: reason,
            createdAt: block.timestamp,
            resolved: false,
            winner: address(0)
        });
        
        emit TaskDisputed(taskId, msg.sender, reason);
    }
    
    /**
     * @dev Resolve dispute (called by authorized oracle or owner)
     * @param taskId Task ID
     * @param winner Address of dispute winner
     */
    function resolveDispute(uint256 taskId, address winner) external {
        require(
            authorizedOracles[msg.sender] || msg.sender == owner(),
            "Not authorized to resolve"
        );
        
        Task storage task = tasks[taskId];
        Dispute storage dispute = disputes[taskId];
        
        require(task.status == TaskStatus.Disputed, "Task not disputed");
        require(!dispute.resolved, "Dispute already resolved");
        require(
            winner == task.client || winner == task.assignedNode,
            "Invalid winner"
        );
        
        dispute.resolved = true;
        dispute.winner = winner;
        task.status = TaskStatus.Resolved;
        
        if (winner == task.assignedNode) {
            _releasePayment(taskId);
        } else {
            _refundClient(taskId);
        }
        
        emit DisputeResolved(taskId, winner);
    }
    
    /**
     * @dev Cancel task (only before assignment or by timeout)
     * @param taskId Task ID
     */
    function cancelTask(uint256 taskId) external {
        Task storage task = tasks[taskId];
        require(task.client == msg.sender, "Not your task");
        require(
            task.status == TaskStatus.Created ||
            (task.status == TaskStatus.Assigned && block.timestamp > task.deadline + TASK_TIMEOUT),
            "Cannot cancel task"
        );
        
        task.status = TaskStatus.Cancelled;
        _refundClient(taskId);
        
        emit TaskCancelled(taskId, msg.sender);
    }
    
    /**
     * @dev Internal function to release payment to node
     */
    function _releasePayment(uint256 taskId) internal {
        Task storage task = tasks[taskId];
        
        // Transfer reward to node
        ngridToken.safeTransfer(task.assignedNode, task.nodeReward);
        
        // Transfer platform fee to owner
        ngridToken.safeTransfer(owner(), task.platformFee);
        
        emit PaymentReleased(taskId, task.assignedNode, task.nodeReward);
    }
    
    /**
     * @dev Internal function to refund client
     */
    function _refundClient(uint256 taskId) internal {
        Task storage task = tasks[taskId];
        
        ngridToken.safeTransfer(task.client, task.payment);
        
        emit RefundIssued(taskId, task.client, task.payment);
    }
    
    /**
     * @dev Schedule auto-approval after timeout
     * Note: In production, this would be handled by a keeper service
     */
    function _scheduleAutoApproval(uint256 taskId) internal {
        // This is a simplified version
        // In production, you'd use Chainlink Keepers or similar service
        // For now, anyone can call autoApproveTask after timeout
    }
    
    /**
     * @dev Auto-approve task after timeout (callable by anyone)
     * @param taskId Task ID
     */
    function autoApproveTask(uint256 taskId) external {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Completed, "Task not completed");
        require(!task.disputeRaised, "Task disputed");
        require(
            block.timestamp >= task.completedAt + DISPUTE_TIMEOUT,
            "Dispute period not ended"
        );
        
        _releasePayment(taskId);
        
        emit TaskApproved(taskId, address(this));
    }
    
    /**
     * @dev Get task details
     */
    function getTask(uint256 taskId) external view returns (Task memory) {
        return tasks[taskId];
    }
    
    /**
     * @dev Get user's tasks
     */
    function getUserTasks(address user) external view returns (uint256[] memory) {
        return userTasks[user];
    }
    
    /**
     * @dev Get node's tasks
     */
    function getNodeTasks(address node) external view returns (uint256[] memory) {
        return nodeTasks[node];
    }
    
    /**
     * @dev Set platform fee (only owner)
     */
    function setPlatformFee(uint256 newFeePercentage) external onlyOwner {
        require(newFeePercentage <= MAX_PLATFORM_FEE, "Fee too high");
        platformFeePercentage = newFeePercentage;
    }
    
    /**
     * @dev Add authorized oracle for dispute resolution
     */
    function addAuthorizedOracle(address oracle) external onlyOwner {
        authorizedOracles[oracle] = true;
    }
    
    /**
     * @dev Remove authorized oracle
     */
    function removeAuthorizedOracle(address oracle) external onlyOwner {
        authorizedOracles[oracle] = false;
    }
    
    /**
     * @dev Pause contract (emergency function)
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}