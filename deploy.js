const { ethers, network } = require("hardhat");
const {
  networkConfig,
  developmentChains,
  DECIMALS,
  INITIAL_WETH_PRICE,
  INITIAL_BTC_PRICE,
} = require("../helper-hardhat-config");

async function deployMocks(deployer) {
  const ERC20Mock = await ethers.getContractFactory("ERC20Mock", deployer);
  const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator", deployer);

  const wethUsdPriceFeed = await MockV3Aggregator.deploy(DECIMALS, INITIAL_WETH_PRICE);
  await wethUsdPriceFeed.waitForDeployment();

  const wbtcUsdPriceFeed = await MockV3Aggregator.deploy(DECIMALS, INITIAL_BTC_PRICE);
  await wbtcUsdPriceFeed.waitForDeployment();

  const weth = await ERC20Mock.deploy("WETH", "WETH", deployer.address, ethers.parseEther("1000"));
  await weth.waitForDeployment();

  const wbtc = await ERC20Mock.deploy("WBTC", "WBTC", deployer.address, ethers.parseEther("1000"));
  await wbtc.waitForDeployment();

  console.log("Mocks deployed:");
  console.log("  wethUsdPriceFeed:", await wethUsdPriceFeed.getAddress());
  console.log("  wbtcUsdPriceFeed:", await wbtcUsdPriceFeed.getAddress());
  console.log("  weth:", await weth.getAddress());
  console.log("  wbtc:", await wbtc.getAddress());

  return {
    wethUsdPriceFeed: await wethUsdPriceFeed.getAddress(),
    wbtcUsdPriceFeed: await wbtcUsdPriceFeed.getAddress(),
    weth: await weth.getAddress(),
    wbtc: await wbtc.getAddress(),
  };
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Network:", network.name);

  let wethUsdPriceFeed, wbtcUsdPriceFeed, weth, wbtc;

  if (developmentChains.includes(network.name)) {
    const mocks = await deployMocks(deployer);
    ({ wethUsdPriceFeed, wbtcUsdPriceFeed, weth, wbtc } = mocks);
  } else {
    const config = networkConfig[network.config.chainId];
    if (!config) throw new Error(`No network config for chainId ${network.config.chainId}`);
    ({ wethUsdPriceFeed, wbtcUsdPriceFeed, weth, wbtc } = config);
  }

  const tokenAddresses = [weth, wbtc];
  const priceFeedAddresses = [wethUsdPriceFeed, wbtcUsdPriceFeed];

  const DecentralizedStableCoin = await ethers.getContractFactory("DecentralizedStableCoin", deployer);
  const dsc = await DecentralizedStableCoin.deploy();
  await dsc.waitForDeployment();
  console.log("DecentralizedStableCoin deployed to:", await dsc.getAddress());

  const DSCEngine = await ethers.getContractFactory("DSCEngine", deployer);
  const dscEngine = await DSCEngine.deploy(tokenAddresses, priceFeedAddresses, await dsc.getAddress());
  await dscEngine.waitForDeployment();
  console.log("DSCEngine deployed to:", await dscEngine.getAddress());

  // Transfer DSC ownership to the engine so only it can mint/burn.
  const tx = await dsc.transferOwnership(await dscEngine.getAddress());
  await tx.wait();
  console.log("DSC ownership transferred to DSCEngine.");

  return { dsc, dscEngine, weth, wbtc, wethUsdPriceFeed, wbtcUsdPriceFeed };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
