const { expect } = require("chai");
const { ethers } = require("hardhat");

const DECIMALS = 8;
const WETH_PRICE = 2000n * 10n ** 8n; // $2000
const AMOUNT_COLLATERAL = ethers.parseEther("10"); // 10 WETH = $20,000
const AMOUNT_TO_MINT = ethers.parseEther("100"); // 100 DSC = $100

describe("DSCEngine", function () {
  async function deployFixture() {
    const [deployer, user, liquidator] = await ethers.getSigners();

    const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
    const wethUsdPriceFeed = await MockV3Aggregator.deploy(DECIMALS, WETH_PRICE);

    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
    const weth = await ERC20Mock.deploy("WETH", "WETH", deployer.address, ethers.parseEther("1000"));

    const DecentralizedStableCoin = await ethers.getContractFactory("DecentralizedStableCoin");
    const dsc = await DecentralizedStableCoin.deploy();

    const DSCEngine = await ethers.getContractFactory("DSCEngine");
    const dscEngine = await DSCEngine.deploy(
      [await weth.getAddress()],
      [await wethUsdPriceFeed.getAddress()],
      await dsc.getAddress()
    );
    await dsc.transferOwnership(await dscEngine.getAddress());

    // Fund the test user with WETH
    await weth.mint(user.address, ethers.parseEther("100"));
    await weth.connect(user).approve(await dscEngine.getAddress(), ethers.MaxUint256);

    await weth.mint(liquidator.address, ethers.parseEther("100"));
    await weth.connect(liquidator).approve(await dscEngine.getAddress(), ethers.MaxUint256);

    return { dsc, dscEngine, weth, wethUsdPriceFeed, deployer, user, liquidator };
  }

  it("computes USD value of collateral correctly", async function () {
    const { dscEngine, weth } = await deployFixture();
    // 15 ETH * $2000 = $30,000
    const usdValue = await dscEngine.getUsdValue(await weth.getAddress(), ethers.parseEther("15"));
    expect(usdValue).to.equal(ethers.parseEther("30000"));
  });

  it("lets a user deposit collateral and mint DSC", async function () {
    const { dscEngine, dsc, weth, user } = await deployFixture();

    await dscEngine.connect(user).depositCollateralAndMintDsc(
      await weth.getAddress(),
      AMOUNT_COLLATERAL,
      AMOUNT_TO_MINT
    );

    expect(await dsc.balanceOf(user.address)).to.equal(AMOUNT_TO_MINT);
    const [totalDscMinted, collateralValueInUsd] = await dscEngine.getAccountInformation(user.address);
    expect(totalDscMinted).to.equal(AMOUNT_TO_MINT);
    expect(collateralValueInUsd).to.equal(ethers.parseEther("20000"));
  });

  it("reverts if minting would break the health factor", async function () {
    const { dscEngine, weth, user } = await deployFixture();
    // $20,000 collateral, 200% threshold -> max safe mint is $10,000.
    const tooMuch = ethers.parseEther("10001");
    await expect(
      dscEngine.connect(user).depositCollateralAndMintDsc(await weth.getAddress(), AMOUNT_COLLATERAL, tooMuch)
    ).to.be.revertedWithCustomError(dscEngine, "DSCEngine__BreaksHealthFactor");
  });

  it("allows redeeming collateral for DSC", async function () {
    const { dscEngine, dsc, weth, user } = await deployFixture();
    await dscEngine.connect(user).depositCollateralAndMintDsc(await weth.getAddress(), AMOUNT_COLLATERAL, AMOUNT_TO_MINT);

    await dsc.connect(user).approve(await dscEngine.getAddress(), AMOUNT_TO_MINT);
    await dscEngine.connect(user).redeemCollateralForDsc(await weth.getAddress(), AMOUNT_COLLATERAL, AMOUNT_TO_MINT);

    expect(await dsc.balanceOf(user.address)).to.equal(0);
    expect(await weth.balanceOf(user.address)).to.equal(ethers.parseEther("100"));
  });

  it("allows liquidation when a user becomes undercollateralized", async function () {
    const { dscEngine, dsc, weth, wethUsdPriceFeed, user, liquidator } = await deployFixture();

    await dscEngine.connect(user).depositCollateralAndMintDsc(await weth.getAddress(), AMOUNT_COLLATERAL, AMOUNT_TO_MINT);

    // Crash ETH price so the user's health factor drops below 1.
    await wethUsdPriceFeed.updateAnswer(18n * 10n ** 8n); // $18 per ETH

    const healthFactor = await dscEngine.getHealthFactor(user.address);
    expect(healthFactor).to.be.lessThan(ethers.parseEther("1"));

    // Liquidator mints DSC to have funds to cover the debt.
    await dscEngine.connect(liquidator).depositCollateralAndMintDsc(
      await weth.getAddress(),
      ethers.parseEther("100"),
      AMOUNT_TO_MINT
    );
    await dsc.connect(liquidator).approve(await dscEngine.getAddress(), AMOUNT_TO_MINT);

    await dscEngine.connect(liquidator).liquidate(await weth.getAddress(), user.address, AMOUNT_TO_MINT);

    const [remainingDebt] = await dscEngine.getAccountInformation(user.address);
    expect(remainingDebt).to.equal(0);
  });
});
