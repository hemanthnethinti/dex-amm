const hre = require("hardhat");

async function main() {
  console.log("Deploying DEX AMM contracts...");

  // Deploy Mock Tokens
  const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
  
  console.log("Deploying Token A...");
  const tokenA = await MockERC20.deploy("Token A", "TKA");
  await tokenA.deployed();
  console.log("Token A deployed to:", tokenA.address);

  console.log("Deploying Token B...");
  const tokenB = await MockERC20.deploy("Token B", "TKB");
  await tokenB.deployed();
  console.log("Token B deployed to:", tokenB.address);

  // Deploy DEX
  console.log("Deploying DEX...");
  const DEX = await hre.ethers.getContractFactory("DEX");
  const dex = await DEX.deploy(tokenA.address, tokenB.address);
  await dex.deployed();
  console.log("DEX deployed to:", dex.address);

  console.log("\n=== Deployment Summary ===");
  console.log("Token A:", tokenA.address);
  console.log("Token B:", tokenB.address);
  console.log("DEX:", dex.address);
  console.log("========================\n");

  // Optional: Add initial liquidity if desired
  console.log("To add initial liquidity, run the following commands:");
  console.log(`await tokenA.approve(dex.address, ethers.utils.parseEther("1000"))`);
  console.log(`await tokenB.approve(dex.address, ethers.utils.parseEther("1000"))`);
  console.log(`await dex.addLiquidity(ethers.utils.parseEther("100"), ethers.utils.parseEther("200"))`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
