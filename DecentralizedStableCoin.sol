// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20Burnable, ERC20} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/*
 * @title DecentralizedStableCoin
 * @notice The ERC20 token itself. All logic (collateral checks, minting rules,
 *         health factor, liquidations) lives in DSCEngine, which is the owner
 *         of this contract and the only address allowed to mint/burn.
 * Collateral: Exogenous (WETH / WBTC)
 * Minting:    Algorithmic, driven by DSCEngine
 * Relative Stability: Pegged to $1 USD
 */
contract DecentralizedStableCoin is ERC20Burnable, Ownable {
    error DecentralizedStableCoin__AmountMustBeMoreThanZero();
    error DecentralizedStableCoin__BurnAmountExceedsBalance();
    error DecentralizedStableCoin__NotZeroAddress();

    constructor() ERC20("DecentralizedStableCoin", "DSC") Ownable(msg.sender) {}

    /// @notice Burn DSC from the caller's own balance. Only DSCEngine (owner) can call this,
    ///         and it burns from its own holdings after DSCEngine pulls tokens in during a
    ///         liquidation / redeem-and-burn flow.
    function burn(uint256 _amount) public override onlyOwner {
        uint256 balance = balanceOf(msg.sender);
        if (_amount == 0) {
            revert DecentralizedStableCoin__AmountMustBeMoreThanZero();
        }
        if (balance < _amount) {
            revert DecentralizedStableCoin__BurnAmountExceedsBalance();
        }
        super.burn(_amount);
    }

    /// @notice Mint new DSC. Only DSCEngine (owner) can call this, after verifying
    ///         the user has posted sufficient collateral.
    function mint(address _to, uint256 _amount) external onlyOwner returns (bool) {
        if (_to == address(0)) {
            revert DecentralizedStableCoin__NotZeroAddress();
        }
        if (_amount == 0) {
            revert DecentralizedStableCoin__AmountMustBeMoreThanZero();
        }
        _mint(_to, _amount);
        return true;
    }
}
