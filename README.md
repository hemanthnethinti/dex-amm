# DEX AMM Project

## Overview

This project implements a simplified Decentralized Exchange (DEX) using the Automated Market Maker (AMM) model, similar to Uniswap V2. The DEX enables permissionless, non-custodial trading of ERC-20 tokens without relying on traditional order books or centralized intermediaries.

Key features include:
- **Liquidity provision**: Users can add liquidity to trading pairs and receive LP tokens representing their share
- **Token swaps**: Execute trades using the constant product formula (x * y = k)
- **Fee distribution**: Liquidity providers earn 0.3% of every trade
- **Fair pricing**: Automated price discovery based on supply and demand

## Features

- ✅ Initial and subsequent liquidity provision with proper LP token minting
- ✅ Liquidity removal with proportional share calculation
- ✅ Token swaps using constant product formula (x * y = k)
- ✅ 0.3% trading fee automatically distributed to liquidity providers
- ✅ LP token minting and burning based on pool share
- ✅ Reentrancy protection for secure transactions
- ✅ Comprehensive event emission for transparency
- ✅ Edge case handling and input validation

## Architecture

### Contract Structure

**DEX.sol** - Main contract implementing the AMM logic:
- Manages two-token liquidity pools
- Implements constant product market maker formula
- Handles LP token accounting internally
- Enforces 0.3% trading fees
- Uses OpenZeppelin's ReentrancyGuard for security

**MockERC20.sol** - Test token contract:
- Standard ERC-20 implementation
- Includes mint function for testing purposes
- Based on OpenZeppelin's battle-tested ERC20

### Key Design Decisions

1. **Integrated LP Tokens**: LP tokens are tracked using a mapping rather than a separate ERC-20 contract, simplifying the implementation while maintaining full functionality.

2. **Price Ratio Enforcement**: Subsequent liquidity additions must maintain the existing price ratio to prevent arbitrage opportunities.

3. **Fee Application**: The 0.3% fee is deducted from the input amount before applying the constant product formula, ensuring fees accumulate in the pool reserves.

4. **Reentrancy Protection**: All state-changing functions use OpenZeppelin's `nonReentrant` modifier to prevent reentrancy attacks.

## Mathematical Implementation

### Constant Product Formula

The core of the AMM is the constant product formula:

```
x * y = k
```

Where:
- `x` = reserve of Token A
- `y` = reserve of Token B
- `k` = constant product (remains constant per trade, ignoring fees)

**Example**:
- Initial state: 100 ETH × 200,000 USDC = 20,000,000 (k)
- After swap of 10 ETH: 110 ETH × 181,818 USDC ≈ 20,000,000 (k)
- Price automatically adjusts based on the ratio

### Fee Calculation

The 0.3% fee is applied to the input amount:

```solidity
amountInWithFee = amountIn * 997  // 99.7% of input
numerator = amountInWithFee * reserveOut
denominator = (reserveIn * 1000) + amountInWithFee
amountOut = numerator / denominator
```

This ensures:
- Only 99.7% of the input is used for the swap calculation
- The remaining 0.3% stays in the pool as fees
- The constant product `k` slightly increases after each trade
- Liquidity providers benefit from accumulated fees

### LP Token Minting

**First Liquidity Provider**:
```solidity
liquidityMinted = sqrt(amountA * amountB)
```

This geometric mean ensures the initial LP token supply is independent of the initial price ratio.

**Subsequent Providers**:
```solidity
liquidityMinted = min(
    (amountA * totalLiquidity) / reserveA,
    (amountB * totalLiquidity) / reserveB
)
```

LP tokens are minted proportionally to the existing pool to maintain fair share distribution.

### Liquidity Removal

Users receive tokens proportional to their LP token share:

```solidity
amountA = (liquidityBurned * reserveA) / totalLiquidity
amountB = (liquidityBurned * reserveB) / totalLiquidity
```

## Setup Instructions

### Prerequisites

- Docker and Docker Compose installed
- Git
- (Optional) Node.js 18+ for local development without Docker

### Installation

1. **Clone the repository:**
```bash
git clone <your-repo-url>
cd dex-amm
```

2. **Start Docker environment:**
```bash
docker-compose up -d
```

3. **Compile contracts:**
```bash
docker-compose exec app npm run compile
```

4. **Run tests:**
```bash
docker-compose exec app npm test
```

5. **Check coverage:**
```bash
docker-compose exec app npm run coverage
```

6. **Stop Docker:**
```bash
docker-compose down
```

### Running Tests Locally (without Docker)

If you prefer to run without Docker:

```bash
# Install dependencies
npm install

# Compile contracts
npm run compile

# Run tests
npm test

# Check coverage
npm run coverage
```

## Running Tests

The test suite includes 29 comprehensive test cases covering:

- **Liquidity Management** (8 tests)
  - Initial and subsequent liquidity provision
  - LP token minting calculations
  - Liquidity removal
  - Edge cases and error conditions

- **Token Swaps** (8 tests)
  - Bidirectional swaps (A→B and B→A)
  - Fee calculations
  - Reserve updates
  - Multiple consecutive swaps

- **Price Calculations** (3 tests)
  - Initial price calculation
  - Price updates after swaps
  - Zero liquidity handling

- **Fee Distribution** (2 tests)
  - Fee accumulation for LPs
  - Proportional fee distribution

- **Edge Cases** (3 tests)
  - Very small/large amounts
  - Access control

- **Events** (3 tests)
  - Event emission verification

Expected output:
```
  DEX
    Liquidity Management
      ✓ should allow initial liquidity provision
      ✓ should mint correct LP tokens for first provider
      ✓ should allow subsequent liquidity additions
      ... (29 tests total)
    
  29 passing (3s)
```

## Contract Addresses

*Contracts are ready for deployment. After deploying to a testnet, update this section with:*
- Network name
- Contract addresses
- Block explorer links

## Known Limitations

1. **Price Impact**: Large swaps relative to pool size will experience significant price impact due to the constant product formula.

2. **First Provider Advantage**: The first liquidity provider sets the initial price ratio. They should ensure it matches the market price to avoid arbitrage.

3. **No Slippage Protection**: This basic implementation doesn't include slippage protection (minimum output amount). Users should be aware of potential front-running.

4. **Integer Division**: Solidity's integer division can cause minor rounding losses (typically negligible).

5. **Two-Token Pools Only**: Each DEX instance manages exactly one token pair. Multiple pairs require multiple DEX deployments.

## Security Considerations

### Implemented Security Measures

1. **Reentrancy Protection**: Uses OpenZeppelin's `ReentrancyGuard` on all state-changing functions.

2. **Checks-Effects-Interactions Pattern**: State updates occur before external calls to prevent reentrancy.

3. **Input Validation**: All functions validate inputs (non-zero amounts, sufficient balances).

4. **Overflow Protection**: Uses Solidity 0.8+ built-in overflow/underflow protection.

5. **Access Control**: Users can only withdraw their own liquidity.

6. **Safe Token Transfers**: Properly handles ERC-20 transfers with require statements.

### Recommendations for Production

- Complete security audit by professional auditors
- Consider adding slippage protection parameters
- Implement deadline parameters for time-bound transactions
- Add pausable functionality for emergency stops
- Consider using OpenZeppelin's SafeERC20 for additional safety
- Implement price oracles to prevent manipulation
- Add comprehensive monitoring and alerting

## Technical Details

### Smart Contract Functions

**Core Functions:**
- `addLiquidity(uint256 amountA, uint256 amountB)`: Add liquidity and receive LP tokens
- `removeLiquidity(uint256 liquidityAmount)`: Burn LP tokens and withdraw assets
- `swapAForB(uint256 amountAIn)`: Swap token A for token B
- `swapBForA(uint256 amountBIn)`: Swap token B for token A

**View Functions:**
- `getPrice()`: Returns current price of token A in terms of token B
- `getReserves()`: Returns current reserves of both tokens
- `getAmountOut()`: Calculate expected output for a given input

### Gas Optimization

- Uses `uint256` for all calculations
- Minimizes storage operations
- Efficient square root calculation using Babylonian method
- Optimized with Hardhat compiler settings (200 runs)

## Development

### Project Structure
```
dex-amm/
├── contracts/
│   ├── DEX.sol              # Main DEX contract
│   └── MockERC20.sol        # Test token contract
├── test/
│   └── DEX.test.js          # Comprehensive test suite
├── scripts/
│   └── deploy.js            # Deployment script
├── Dockerfile               # Docker configuration
├── docker-compose.yml       # Docker Compose setup
├── hardhat.config.js        # Hardhat configuration
├── package.json             # Node.js dependencies
└── README.md               # This file
```

### Adding New Features

To extend the DEX with additional features:

1. **Slippage Protection**: Add `minAmountOut` parameter to swap functions
2. **Deadline**: Add timestamp validation to prevent stale transactions
3. **Multiple Pairs**: Deploy separate DEX instances or implement a factory pattern
4. **Flash Swaps**: Allow borrowing with same-transaction repayment
5. **LP Token Transfers**: Implement full ERC-20 interface for LP tokens

## Troubleshooting

### Common Issues

**Docker build fails:**
```bash
docker-compose down
docker system prune -a
docker-compose build --no-cache
docker-compose up -d
```

**Tests fail with "Insufficient liquidity":**
- Ensure tokens are properly minted and approved before adding liquidity
- Check that the DEX contract has approval to transfer tokens

**Price calculations seem wrong:**
- Remember that price is scaled by 1e18 for precision
- Verify integer division order (multiply before divide)

**LP token calculations don't match:**
- For first provider: `sqrt(100 * 200) ≈ 141.42`
- For subsequent providers: proportional to pool share

## License

MIT

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## Acknowledgments

- Inspired by Uniswap V2
- Built with Hardhat and OpenZeppelin contracts
- Thanks to the Ethereum and DeFi communities

## Contact

For questions or issues, please open a GitHub issue or contact the maintainers.

---

**⚠️ Disclaimer**: This is an educational project. DO NOT use in production without a comprehensive security audit. The developers assume no responsibility for any losses incurred through the use of this code.