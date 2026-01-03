// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract DEX is ReentrancyGuard {
    // State variables
    address public tokenA;
    address public tokenB;
    uint256 public reserveA;
    uint256 public reserveB;
    uint256 public totalLiquidity;
    mapping(address => uint256) public liquidity;
    
    // Events
    event LiquidityAdded(address indexed provider, uint256 amountA, uint256 amountB, uint256 liquidityMinted);
    event LiquidityRemoved(address indexed provider, uint256 amountA, uint256 amountB, uint256 liquidityBurned);
    event Swap(address indexed trader, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut);
    
    /// @notice Initialize the DEX with two token addresses
    /// @param _tokenA Address of first token
    /// @param _tokenB Address of second token
    constructor(address _tokenA, address _tokenB) {
        require(_tokenA != address(0), "Token A address cannot be zero");
        require(_tokenB != address(0), "Token B address cannot be zero");
        require(_tokenA != _tokenB, "Tokens must be different");
        
        tokenA = _tokenA;
        tokenB = _tokenB;
    }
    
    /// @notice Add liquidity to the pool
    /// @param amountA Amount of token A to add
    /// @param amountB Amount of token B to add
    /// @return liquidityMinted Amount of LP tokens minted
    function addLiquidity(uint256 amountA, uint256 amountB) 
        external 
        nonReentrant
        returns (uint256 liquidityMinted) 
    {
        require(amountA > 0 && amountB > 0, "Amounts must be greater than 0");
        
        if (totalLiquidity == 0) {
            // First liquidity provider
            liquidityMinted = sqrt(amountA * amountB);
            require(liquidityMinted > 0, "Insufficient liquidity minted");
        } else {
            // Subsequent liquidity additions must maintain the price ratio
            uint256 liquidityA = (amountA * totalLiquidity) / reserveA;
            uint256 liquidityB = (amountB * totalLiquidity) / reserveB;
            
            // Take the smaller of the two to maintain ratio
            liquidityMinted = liquidityA < liquidityB ? liquidityA : liquidityB;
            require(liquidityMinted > 0, "Insufficient liquidity minted");
        }
        
        // Transfer tokens from user to contract
        require(
            IERC20(tokenA).transferFrom(msg.sender, address(this), amountA),
            "Transfer of token A failed"
        );
        require(
            IERC20(tokenB).transferFrom(msg.sender, address(this), amountB),
            "Transfer of token B failed"
        );
        
        // Update state
        liquidity[msg.sender] += liquidityMinted;
        totalLiquidity += liquidityMinted;
        reserveA += amountA;
        reserveB += amountB;
        
        emit LiquidityAdded(msg.sender, amountA, amountB, liquidityMinted);
    }
    
    /// @notice Remove liquidity from the pool
    /// @param liquidityAmount Amount of LP tokens to burn
    /// @return amountA Amount of token A returned
    /// @return amountB Amount of token B returned
    function removeLiquidity(uint256 liquidityAmount) 
        external 
        nonReentrant
        returns (uint256 amountA, uint256 amountB) 
    {
        require(liquidityAmount > 0, "Liquidity amount must be greater than 0");
        require(liquidity[msg.sender] >= liquidityAmount, "Insufficient liquidity balance");
        
        // Calculate proportional amounts to return
        amountA = (liquidityAmount * reserveA) / totalLiquidity;
        amountB = (liquidityAmount * reserveB) / totalLiquidity;
        
        require(amountA > 0 && amountB > 0, "Insufficient liquidity burned");
        
        // Update state before transfers
        liquidity[msg.sender] -= liquidityAmount;
        totalLiquidity -= liquidityAmount;
        reserveA -= amountA;
        reserveB -= amountB;
        
        // Transfer tokens back to user
        require(
            IERC20(tokenA).transfer(msg.sender, amountA),
            "Transfer of token A failed"
        );
        require(
            IERC20(tokenB).transfer(msg.sender, amountB),
            "Transfer of token B failed"
        );
        
        emit LiquidityRemoved(msg.sender, amountA, amountB, liquidityAmount);
    }
    
    /// @notice Swap token A for token B
    /// @param amountAIn Amount of token A to swap
    /// @return amountBOut Amount of token B received
    function swapAForB(uint256 amountAIn) 
        external 
        nonReentrant
        returns (uint256 amountBOut) 
    {
        require(amountAIn > 0, "Amount must be greater than 0");
        require(reserveA > 0 && reserveB > 0, "Insufficient liquidity");
        
        // Calculate output amount with 0.3% fee
        amountBOut = getAmountOut(amountAIn, reserveA, reserveB);
        require(amountBOut > 0, "Insufficient output amount");
        require(amountBOut < reserveB, "Insufficient liquidity for swap");
        
        // Transfer token A from user to contract
        require(
            IERC20(tokenA).transferFrom(msg.sender, address(this), amountAIn),
            "Transfer of token A failed"
        );
        
        // Update reserves before transfer out
        reserveA += amountAIn;
        reserveB -= amountBOut;
        
        // Transfer token B to user
        require(
            IERC20(tokenB).transfer(msg.sender, amountBOut),
            "Transfer of token B failed"
        );
        
        emit Swap(msg.sender, tokenA, tokenB, amountAIn, amountBOut);
    }
    
    /// @notice Swap token B for token A
    /// @param amountBIn Amount of token B to swap
    /// @return amountAOut Amount of token A received
    function swapBForA(uint256 amountBIn) 
        external 
        nonReentrant
        returns (uint256 amountAOut) 
    {
        require(amountBIn > 0, "Amount must be greater than 0");
        require(reserveA > 0 && reserveB > 0, "Insufficient liquidity");
        
        // Calculate output amount with 0.3% fee
        amountAOut = getAmountOut(amountBIn, reserveB, reserveA);
        require(amountAOut > 0, "Insufficient output amount");
        require(amountAOut < reserveA, "Insufficient liquidity for swap");
        
        // Transfer token B from user to contract
        require(
            IERC20(tokenB).transferFrom(msg.sender, address(this), amountBIn),
            "Transfer of token B failed"
        );
        
        // Update reserves before transfer out
        reserveB += amountBIn;
        reserveA -= amountAOut;
        
        // Transfer token A to user
        require(
            IERC20(tokenA).transfer(msg.sender, amountAOut),
            "Transfer of token A failed"
        );
        
        emit Swap(msg.sender, tokenB, tokenA, amountBIn, amountAOut);
    }
    
    /// @notice Get current price of token A in terms of token B
    /// @return price Current price (reserveB / reserveA)
    function getPrice() external view returns (uint256 price) {
        require(reserveA > 0, "No liquidity");
        price = (reserveB * 1e18) / reserveA;
    }
    
    /// @notice Get current reserves
    /// @return _reserveA Current reserve of token A
    /// @return _reserveB Current reserve of token B
    function getReserves() external view returns (uint256 _reserveA, uint256 _reserveB) {
        _reserveA = reserveA;
        _reserveB = reserveB;
    }
    
    /// @notice Calculate amount of token B received for given amount of token A
    /// @param amountIn Amount of input token
    /// @param reserveIn Reserve of input token
    /// @param reserveOut Reserve of output token
    /// @return amountOut Amount of output token (after 0.3% fee)
    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) 
        public 
        pure 
        returns (uint256 amountOut) 
    {
        require(amountIn > 0, "Insufficient input amount");
        require(reserveIn > 0 && reserveOut > 0, "Insufficient liquidity");
        
        // Apply 0.3% fee: 997/1000 = 99.7%
        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1000) + amountInWithFee;
        amountOut = numerator / denominator;
    }
    
    /// @notice Calculate square root using Babylonian method
    /// @param x Input value
    /// @return y Square root of x
    function sqrt(uint256 x) private pure returns (uint256 y) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }
}
