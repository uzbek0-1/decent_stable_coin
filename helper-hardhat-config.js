const networkConfig = {
  31337: {
    name: "hardhat",
  },
  11155111: {
    name: "sepolia",
    wethUsdPriceFeed: "0x694AA1769357215DE4FAC081bf1f309aDC325306",
    wbtcUsdPriceFeed: "0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43",
    weth: "0xdd13E55209Fd76AfE204dBda4007C227904f0a8",
    wbtc: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
  },
};

const DECIMALS = 8;
const INITIAL_WETH_PRICE = 2000e8; // $2000
const INITIAL_BTC_PRICE = 60000e8; // $60000
const developmentChains = ["hardhat", "localhost"];

module.exports = {
  networkConfig,
  developmentChains,
  DECIMALS,
  INITIAL_WETH_PRICE,
  INITIAL_BTC_PRICE,
};
