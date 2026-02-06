// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title NeuroGrid Token (NGRID)
 * @dev ERC-20 token for NeuroGrid decentralized AI computing network
 */
contract NeuroGridToken is ERC20, ERC20Burnable, Pausable, Ownable {
    uint256 public constant MAX_SUPPLY = 1000000000 * 10**18; // 1 billion tokens
    uint256 public constant INITIAL_SUPPLY = 100000000 * 10**18; // 100 million tokens
    
    // Tokenomics allocations
    uint256 public constant TEAM_ALLOCATION = 150000000 * 10**18; // 15%
    uint256 public constant ADVISORS_ALLOCATION = 50000000 * 10**18; // 5%
    uint256 public constant ECOSYSTEM_ALLOCATION = 300000000 * 10**18; // 30%
    uint256 public constant STAKING_REWARDS = 250000000 * 10**18; // 25%
    uint256 public constant LIQUIDITY_MINING = 150000000 * 10**18; // 15%
    uint256 public constant PUBLIC_SALE = 100000000 * 10**18; // 10%
    
    // Vesting schedules
    mapping(address => VestingSchedule) public vestingSchedules;
    mapping(address => bool) public isAuthorizedMinter;
    
    struct VestingSchedule {
        uint256 totalAmount;
        uint256 releasedAmount;
        uint256 startTime;
        uint256 duration;
        uint256 cliff;
    }
    
    // Events
    event TokensMinted(address indexed to, uint256 amount, string reason);
    event TokensBurned(address indexed from, uint256 amount);
    event VestingScheduleCreated(address indexed beneficiary, uint256 amount, uint256 duration);
    event TokensVested(address indexed beneficiary, uint256 amount);
    
    constructor() ERC20("NeuroGrid", "NGRID") {
        // Mint initial supply to contract deployer
        _mint(_msgSender(), INITIAL_SUPPLY);
        
        emit TokensMinted(_msgSender(), INITIAL_SUPPLY, "Initial supply");
    }
    
    /**
     * @dev Pause token transfers (emergency function)
     */
    function pause() public onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause token transfers
     */
    function unpause() public onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Mint new tokens (only authorized minters)
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     * @param reason Reason for minting (for transparency)
     */
    function mint(address to, uint256 amount, string memory reason) public {
        require(isAuthorizedMinter[_msgSender()] || _msgSender() == owner(), "Not authorized to mint");
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        
        _mint(to, amount);
        emit TokensMinted(to, amount, reason);
    }
    
    /**
     * @dev Add authorized minter (escrow contracts, reward distributors, etc.)
     */
    function addAuthorizedMinter(address minter) public onlyOwner {
        isAuthorizedMinter[minter] = true;
    }
    
    /**
     * @dev Remove authorized minter
     */
    function removeAuthorizedMinter(address minter) public onlyOwner {
        isAuthorizedMinter[minter] = false;
    }
    
    /**
     * @dev Create vesting schedule for team/advisor tokens
     * @param beneficiary Address of the beneficiary
     * @param amount Total amount to vest
     * @param duration Vesting duration in seconds
     * @param cliff Cliff period in seconds
     */
    function createVestingSchedule(
        address beneficiary,
        uint256 amount,
        uint256 duration,
        uint256 cliff
    ) public onlyOwner {
        require(beneficiary != address(0), "Invalid beneficiary");
        require(amount > 0, "Amount must be > 0");
        require(vestingSchedules[beneficiary].totalAmount == 0, "Vesting already exists");
        
        vestingSchedules[beneficiary] = VestingSchedule({
            totalAmount: amount,
            releasedAmount: 0,
            startTime: block.timestamp,
            duration: duration,
            cliff: cliff
        });
        
        // Transfer tokens to this contract for vesting
        _transfer(_msgSender(), address(this), amount);
        
        emit VestingScheduleCreated(beneficiary, amount, duration);
    }
    
    /**
     * @dev Release vested tokens to beneficiary
     */
    function releaseVestedTokens() public {
        address beneficiary = _msgSender();
        VestingSchedule storage schedule = vestingSchedules[beneficiary];
        
        require(schedule.totalAmount > 0, "No vesting schedule");
        require(block.timestamp >= schedule.startTime + schedule.cliff, "Cliff not reached");
        
        uint256 releasableAmount = _calculateReleasableAmount(schedule);
        require(releasableAmount > 0, "No tokens to release");
        
        schedule.releasedAmount += releasableAmount;
        _transfer(address(this), beneficiary, releasableAmount);
        
        emit TokensVested(beneficiary, releasableAmount);
    }
    
    /**
     * @dev Calculate releasable amount for vesting schedule
     */
    function _calculateReleasableAmount(VestingSchedule memory schedule) internal view returns (uint256) {
        if (block.timestamp < schedule.startTime + schedule.cliff) {
            return 0;
        }
        
        uint256 timeElapsed = block.timestamp - schedule.startTime;
        if (timeElapsed >= schedule.duration) {
            return schedule.totalAmount - schedule.releasedAmount;
        }
        
        uint256 vestedAmount = (schedule.totalAmount * timeElapsed) / schedule.duration;
        return vestedAmount - schedule.releasedAmount;
    }
    
    /**
     * @dev Get releasable tokens for an address
     */
    function getReleasableTokens(address beneficiary) public view returns (uint256) {
        VestingSchedule memory schedule = vestingSchedules[beneficiary];
        return _calculateReleasableAmount(schedule);
    }
    
    /**
     * @dev Override transfer functions to include pause functionality
     */
    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal
        whenNotPaused
        override
    {
        super._beforeTokenTransfer(from, to, amount);
    }
    
    /**
     * @dev Burn tokens and emit event
     */
    function burn(uint256 amount) public override {
        super.burn(amount);
        emit TokensBurned(_msgSender(), amount);
    }
    
    /**
     * @dev Burn tokens from another account (with allowance)
     */
    function burnFrom(address account, uint256 amount) public override {
        super.burnFrom(account, amount);
        emit TokensBurned(account, amount);
    }
}