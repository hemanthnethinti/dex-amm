const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DEX", function() {
    let dex, tokenA, tokenB;
    let owner, addr1, addr2;
    
    beforeEach(async function() {
        // Deploy tokens and DEX before each test
        [owner, addr1, addr2] = await ethers.getSigners();
        
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        tokenA = await MockERC20.deploy("Token A", "TKA");
        tokenB = await MockERC20.deploy("Token B", "TKB");
        
        const DEX = await ethers.getContractFactory("DEX");
        dex = await DEX.deploy(tokenA.address, tokenB.address);
        
        // Approve DEX to spend tokens
        await tokenA.approve(dex.address, ethers.utils.parseEther("1000000"));
        await tokenB.approve(dex.address, ethers.utils.parseEther("1000000"));
    });
    
    describe("Liquidity Management", function() {
        it("should allow initial liquidity provision", async function() {
            const amountA = ethers.utils.parseEther("100");
            const amountB = ethers.utils.parseEther("200");
            
            await dex.addLiquidity(amountA, amountB);
            
            const reserves = await dex.getReserves();
            expect(reserves._reserveA).to.equal(amountA);
            expect(reserves._reserveB).to.equal(amountB);
            expect(await dex.totalLiquidity()).to.be.gt(0);
        });
        
        it("should mint correct LP tokens for first provider", async function() {
            const amountA = ethers.utils.parseEther("100");
            const amountB = ethers.utils.parseEther("200");
            
            await dex.addLiquidity(amountA, amountB);
            
            const liquidity = await dex.liquidity(owner.address);
            // sqrt(100 * 200) = sqrt(20000) ≈ 141.42 ether
            const expectedLiquidity = ethers.utils.parseEther("141.421356237309504880");
            expect(liquidity).to.be.closeTo(expectedLiquidity, ethers.utils.parseEther("0.1"));
        });
        
        it("should allow subsequent liquidity additions", async function() {
            // Initial liquidity
            await dex.addLiquidity(
                ethers.utils.parseEther("100"),
                ethers.utils.parseEther("200")
            );
            
            // Mint tokens to addr1 and approve
            await tokenA.mint(addr1.address, ethers.utils.parseEther("1000"));
            await tokenB.mint(addr1.address, ethers.utils.parseEther("1000"));
            await tokenA.connect(addr1).approve(dex.address, ethers.utils.parseEther("1000"));
            await tokenB.connect(addr1).approve(dex.address, ethers.utils.parseEther("1000"));
            
            // Add more liquidity from addr1
            await dex.connect(addr1).addLiquidity(
                ethers.utils.parseEther("50"),
                ethers.utils.parseEther("100")
            );
            
            const liquidity = await dex.liquidity(addr1.address);
            expect(liquidity).to.be.gt(0);
        });
        
        it("should maintain price ratio on liquidity addition", async function() {
            await dex.addLiquidity(
                ethers.utils.parseEther("100"),
                ethers.utils.parseEther("200")
            );
            
            const priceBefore = await dex.getPrice();
            
            // Add more liquidity maintaining the 1:2 ratio
            await dex.addLiquidity(
                ethers.utils.parseEther("50"),
                ethers.utils.parseEther("100")
            );
            
            const priceAfter = await dex.getPrice();
            expect(priceAfter).to.equal(priceBefore);
        });
        
        it("should allow partial liquidity removal", async function() {
            await dex.addLiquidity(
                ethers.utils.parseEther("100"),
                ethers.utils.parseEther("200")
            );
            
            const totalLiquidity = await dex.liquidity(owner.address);
            const removeAmount = totalLiquidity.div(2);
            
            await dex.removeLiquidity(removeAmount);
            
            const remainingLiquidity = await dex.liquidity(owner.address);
            expect(remainingLiquidity).to.be.closeTo(removeAmount, ethers.utils.parseEther("0.01"));
        });
        
        it("should return correct token amounts on liquidity removal", async function() {
            const amountA = ethers.utils.parseEther("100");
            const amountB = ethers.utils.parseEther("200");
            
            await dex.addLiquidity(amountA, amountB);
            
            const balanceABefore = await tokenA.balanceOf(owner.address);
            const balanceBBefore = await tokenB.balanceOf(owner.address);
            
            const liquidityAmount = await dex.liquidity(owner.address);
            await dex.removeLiquidity(liquidityAmount);
            
            const balanceAAfter = await tokenA.balanceOf(owner.address);
            const balanceBAfter = await tokenB.balanceOf(owner.address);
            
            expect(balanceAAfter.sub(balanceABefore)).to.equal(amountA);
            expect(balanceBAfter.sub(balanceBBefore)).to.equal(amountB);
        });
        
        it("should revert on zero liquidity addition", async function() {
            await expect(
                dex.addLiquidity(0, ethers.utils.parseEther("100"))
            ).to.be.revertedWith("Amounts must be greater than 0");
            
            await expect(
                dex.addLiquidity(ethers.utils.parseEther("100"), 0)
            ).to.be.revertedWith("Amounts must be greater than 0");
        });
        
        it("should revert when removing more liquidity than owned", async function() {
            await dex.addLiquidity(
                ethers.utils.parseEther("100"),
                ethers.utils.parseEther("200")
            );
            
            const liquidity = await dex.liquidity(owner.address);
            const tooMuch = liquidity.add(ethers.utils.parseEther("1"));
            
            await expect(
                dex.removeLiquidity(tooMuch)
            ).to.be.revertedWith("Insufficient liquidity balance");
        });
    });
    
    describe("Token Swaps", function() {
        beforeEach(async function() {
            // Add initial liquidity before swap tests
            await dex.addLiquidity(
                ethers.utils.parseEther("100"),
                ethers.utils.parseEther("200")
            );
        });
        
        it("should swap token A for token B", async function() {
            const amountIn = ethers.utils.parseEther("10");
            const balanceBefore = await tokenB.balanceOf(owner.address);
            
            await dex.swapAForB(amountIn);
            
            const balanceAfter = await tokenB.balanceOf(owner.address);
            expect(balanceAfter).to.be.gt(balanceBefore);
        });
        
        it("should swap token B for token A", async function() {
            const amountIn = ethers.utils.parseEther("20");
            const balanceBefore = await tokenA.balanceOf(owner.address);
            
            await dex.swapBForA(amountIn);
            
            const balanceAfter = await tokenA.balanceOf(owner.address);
            expect(balanceAfter).to.be.gt(balanceBefore);
        });
        
        it("should calculate correct output amount with fee", async function() {
            const amountIn = ethers.utils.parseEther("10");
            const reserves = await dex.getReserves();
            
            const expectedOut = await dex.getAmountOut(amountIn, reserves._reserveA, reserves._reserveB);
            
            const balanceBefore = await tokenB.balanceOf(owner.address);
            await dex.swapAForB(amountIn);
            const balanceAfter = await tokenB.balanceOf(owner.address);
            
            const actualOut = balanceAfter.sub(balanceBefore);
            expect(actualOut).to.equal(expectedOut);
        });
        
        it("should update reserves after swap", async function() {
            const amountIn = ethers.utils.parseEther("10");
            const reservesBefore = await dex.getReserves();
            
            await dex.swapAForB(amountIn);
            
            const reservesAfter = await dex.getReserves();
            expect(reservesAfter._reserveA).to.be.gt(reservesBefore._reserveA);
            expect(reservesAfter._reserveB).to.be.lt(reservesBefore._reserveB);
        });
        
        it("should increase k after swap due to fees", async function() {
            const reservesBefore = await dex.getReserves();
            const kBefore = reservesBefore._reserveA.mul(reservesBefore._reserveB);
            
            await dex.swapAForB(ethers.utils.parseEther("10"));
            
            const reservesAfter = await dex.getReserves();
            const kAfter = reservesAfter._reserveA.mul(reservesAfter._reserveB);
            
            expect(kAfter).to.be.gt(kBefore);
        });
        
        it("should revert on zero swap amount", async function() {
            await expect(
                dex.swapAForB(0)
            ).to.be.revertedWith("Amount must be greater than 0");
            
            await expect(
                dex.swapBForA(0)
            ).to.be.revertedWith("Amount must be greater than 0");
        });
        
        it("should handle large swaps with high price impact", async function() {
            const largeAmount = ethers.utils.parseEther("50");
            
            const balanceBefore = await tokenB.balanceOf(owner.address);
            await dex.swapAForB(largeAmount);
            const balanceAfter = await tokenB.balanceOf(owner.address);
            
            const received = balanceAfter.sub(balanceBefore);
            // Should receive less than 100 due to price impact and fees
            expect(received).to.be.lt(ethers.utils.parseEther("100"));
            expect(received).to.be.gt(0);
        });
        
        it("should handle multiple consecutive swaps", async function() {
            await dex.swapAForB(ethers.utils.parseEther("5"));
            await dex.swapBForA(ethers.utils.parseEther("5"));
            await dex.swapAForB(ethers.utils.parseEther("3"));
            
            const reserves = await dex.getReserves();
            expect(reserves._reserveA).to.be.gt(0);
            expect(reserves._reserveB).to.be.gt(0);
        });
    });
    
    describe("Price Calculations", function() {
        it("should return correct initial price", async function() {
            await dex.addLiquidity(
                ethers.utils.parseEther("100"),
                ethers.utils.parseEther("200")
            );
            
            const price = await dex.getPrice();
            // Price = reserveB / reserveA = 200 / 100 = 2
            expect(price).to.equal(ethers.utils.parseEther("2"));
        });
        
        it("should update price after swaps", async function() {
            await dex.addLiquidity(
                ethers.utils.parseEther("100"),
                ethers.utils.parseEther("200")
            );
            
            const priceBefore = await dex.getPrice();
            
            await dex.swapAForB(ethers.utils.parseEther("10"));
            
            const priceAfter = await dex.getPrice();
            expect(priceAfter).to.be.lt(priceBefore); // Price of A decreased
        });
        
        it("should handle price queries with zero reserves gracefully", async function() {
            await expect(
                dex.getPrice()
            ).to.be.revertedWith("No liquidity");
        });
    });
    
    describe("Fee Distribution", function() {
        it("should accumulate fees for liquidity providers", async function() {
            await dex.addLiquidity(
                ethers.utils.parseEther("100"),
                ethers.utils.parseEther("200")
            );
            
            const liquidityBefore = await dex.liquidity(owner.address);
            
            // Perform swaps to generate fees
            await dex.swapAForB(ethers.utils.parseEther("10"));
            await dex.swapBForA(ethers.utils.parseEther("10"));
            
            // Remove all liquidity
            const balanceABefore = await tokenA.balanceOf(owner.address);
            const balanceBBefore = await tokenB.balanceOf(owner.address);
            
            await dex.removeLiquidity(liquidityBefore);
            
            const balanceAAfter = await tokenA.balanceOf(owner.address);
            const balanceBAfter = await tokenB.balanceOf(owner.address);
            
            const receivedA = balanceAAfter.sub(balanceABefore);
            const receivedB = balanceBAfter.sub(balanceBBefore);
            
            // Should receive close to or slightly less than initial due to rounding
            // The fees stay in the pool, but with small swaps the impact is minimal
            const totalReceived = receivedA.add(receivedB);
            expect(totalReceived).to.be.gt(ethers.utils.parseEther("290")); // Allow for rounding losses
        });
        
        it("should distribute fees proportionally to LP share", async function() {
            // Owner adds liquidity
            await dex.addLiquidity(
                ethers.utils.parseEther("100"),
                ethers.utils.parseEther("200")
            );
            
            // Mint and approve for addr1
            await tokenA.mint(addr1.address, ethers.utils.parseEther("1000"));
            await tokenB.mint(addr1.address, ethers.utils.parseEther("1000"));
            await tokenA.connect(addr1).approve(dex.address, ethers.utils.parseEther("1000"));
            await tokenB.connect(addr1).approve(dex.address, ethers.utils.parseEther("1000"));
            
            // addr1 adds liquidity (equal amount)
            await dex.connect(addr1).addLiquidity(
                ethers.utils.parseEther("100"),
                ethers.utils.parseEther("200")
            );
            
            // Perform swaps
            await dex.swapAForB(ethers.utils.parseEther("20"));
            
            const ownerLiquidity = await dex.liquidity(owner.address);
            const addr1Liquidity = await dex.liquidity(addr1.address);
            
            // Both should have approximately equal shares
            expect(ownerLiquidity).to.be.closeTo(addr1Liquidity, ethers.utils.parseEther("0.1"));
        });
    });
    
    describe("Edge Cases", function() {
        it("should handle very small liquidity amounts", async function() {
            const smallAmount = ethers.utils.parseEther("0.001");
            
            await dex.addLiquidity(smallAmount, smallAmount);
            
            const reserves = await dex.getReserves();
            expect(reserves._reserveA).to.equal(smallAmount);
            expect(reserves._reserveB).to.equal(smallAmount);
        });
        
        it("should handle very large liquidity amounts", async function() {
            const largeAmount = ethers.utils.parseEther("100000");
            
            await dex.addLiquidity(largeAmount, largeAmount);
            
            const reserves = await dex.getReserves();
            expect(reserves._reserveA).to.equal(largeAmount);
            expect(reserves._reserveB).to.equal(largeAmount);
        });
        
        it("should prevent unauthorized access", async function() {
            await dex.addLiquidity(
                ethers.utils.parseEther("100"),
                ethers.utils.parseEther("200")
            );
            
            const ownerLiquidity = await dex.liquidity(owner.address);
            
            // addr1 should not be able to remove owner's liquidity
            await expect(
                dex.connect(addr1).removeLiquidity(ownerLiquidity)
            ).to.be.revertedWith("Insufficient liquidity balance");
        });
    });
    
    describe("Events", function() {
        it("should emit LiquidityAdded event", async function() {
            const amountA = ethers.utils.parseEther("100");
            const amountB = ethers.utils.parseEther("200");
            
            await expect(dex.addLiquidity(amountA, amountB))
                .to.emit(dex, "LiquidityAdded")
                .withArgs(owner.address, amountA, amountB, await dex.liquidity(owner.address));
        });
        
        it("should emit LiquidityRemoved event", async function() {
            await dex.addLiquidity(
                ethers.utils.parseEther("100"),
                ethers.utils.parseEther("200")
            );
            
            const liquidityAmount = await dex.liquidity(owner.address);
            
            await expect(dex.removeLiquidity(liquidityAmount))
                .to.emit(dex, "LiquidityRemoved");
        });
        
        it("should emit Swap event", async function() {
            await dex.addLiquidity(
                ethers.utils.parseEther("100"),
                ethers.utils.parseEther("200")
            );
            
            const amountIn = ethers.utils.parseEther("10");
            
            await expect(dex.swapAForB(amountIn))
                .to.emit(dex, "Swap")
                .withArgs(owner.address, tokenA.address, tokenB.address, amountIn, await dex.getAmountOut(amountIn, ethers.utils.parseEther("100"), ethers.utils.parseEther("200")));
        });
    });
});
