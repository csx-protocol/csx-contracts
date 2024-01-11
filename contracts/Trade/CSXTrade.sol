// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {IKeepers} from "../Keepers/IKeepers.sol";
import {IUsers, TradeStatus, Role} from "../Users/IUsers.sol";
import {ITradeFactory, TradeUrl, Sticker, SkinInfo, PriceType} from "../TradeFactory/ITradeFactory.sol";
import {Strings} from "../utils/Strings.sol";
import {IStakedCSX, SafeERC20} from "../CSX/Interfaces.sol";
import {IReferralRegistry} from "../Referrals/IReferralRegistry.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

error NotFactory();
error StatusIncorrect();
error NotSeller();
error NotKeeperNode();
error NotKeeperOrNode();
error NotParty();
error StatusNotDisputeReady();
error TradeIDNotRemoved();
error DividendDepositFailed();
error TimeNotElapsed();
error ZeroAddress();

contract CSXTrade is ReentrancyGuard {
    using SafeERC20 for IERC20;
    IERC20 public paymentToken;
    bytes32 public referralCode;
    PriceType public priceType;

    address public immutable SELLER_ADDRESS;
    address public buyer;

    string public itemMarketName;
    string public itemSellerAssetId;

    TradeUrl public sellerTradeUrl;
    TradeUrl public buyerTradeUrl;

    string public inspectLink;
    string public itemImageUrl;
    Sticker[] public stickers;

    string public weaponType;

    uint256 public depositedValue;
    uint256 public depositedValueWithFees;
    uint256 public weiPrice;

    uint256 public sellerAcceptedTimestamp;
    uint256 public buyerCommitTimestamp;

    SkinInfo public skinInfo;

    TradeStatus public status;

    TradeStatus[] public statusHistory;

    IKeepers public immutable IKEEPERS_CONTRACT;
    IUsers public immutable IUSERS_CONTRACT;
    ITradeFactory public immutable ITRADEFACTORY_CONTRACT;

    IReferralRegistry public referralRegistryContract;
    IStakedCSX public sCSXToken;

    string public disputeComplaint;
    address public disputeer;

    string public finalityResult;

    modifier onlyAddress(address _address) {
        if (msg.sender != _address) {
            revert NotParty();
        }
        _;
    }

    constructor(
        address _factory,
        address _keepers,
        address _users,
        address _seller,
        uint256 _weiPrice,
        string memory _itemMarketName,
        TradeUrl memory _sellerTradeUrl,
        string memory _sellerAssetId,
        string memory _inspectLink,
        string memory _itemImageUrl,
        SkinInfo memory _skinInfo
    ) {
        if(_factory == address(0)) {
            revert ZeroAddress();
        }
        if(_keepers == address(0)) {
            revert ZeroAddress();
        }
        if(_users == address(0)) {
            revert ZeroAddress();
        }
        if(_seller == address(0)) {
            revert ZeroAddress();
        }
        ITRADEFACTORY_CONTRACT = ITradeFactory(_factory);
        IKEEPERS_CONTRACT = IKeepers(_keepers);
        IUSERS_CONTRACT = IUsers(_users);
        SELLER_ADDRESS = _seller;
        weiPrice = _weiPrice;
        status = TradeStatus.ForSale;
        itemMarketName = _itemMarketName;
        sellerTradeUrl = _sellerTradeUrl;
        itemSellerAssetId = _sellerAssetId;
        inspectLink = _inspectLink;
        itemImageUrl = _itemImageUrl;
        skinInfo = _skinInfo;
    }

    bool public hasInit;

    /**
     * @notice Initialize the extra info for the trade
     * @dev Only the factory contract can call this function
     * @param _stickers Stickers for the item (if any)
     * @param _weaponType The Item weapon type
     * @param _paymentToken The payment token address
     * @param _priceType The price type of the listing
     * @param _referralRegistryContract The referral registry contract address
     * @param _sCSXToken The staked CSX token address
     */
    function initExtraInfo(
        Sticker[] memory _stickers,
        string memory _weaponType,
        address _paymentToken,
        PriceType _priceType,
        address _referralRegistryContract,
        address _sCSXToken
    ) external {
        if (msg.sender != address(ITRADEFACTORY_CONTRACT) || hasInit) {
            revert NotFactory();
        }
        hasInit = true;
        uint256 totalStickers = _stickers.length;
        for (uint256 i; i < totalStickers; i++) {
            stickers.push(_stickers[i]);
        }
        weaponType = _weaponType;
        paymentToken = IERC20(_paymentToken);
        priceType = _priceType;
        referralRegistryContract = IReferralRegistry(_referralRegistryContract);
        sCSXToken = IStakedCSX(_sCSXToken);
        IUSERS_CONTRACT.addUserInteractionStatus(
            address(this),
            Role.SELLER,
            SELLER_ADDRESS,
            TradeStatus.ForSale
        );
    }

    /**
     * @notice Change the price of the listing
     * @dev Only the seller can change the price of the listing
     * @dev The listing must be in status ForSale
     * @param _newPrice The new price of the listing
     */
    function changePrice(uint256 _newPrice) external onlyAddress(SELLER_ADDRESS) {
        if (status != TradeStatus.ForSale) {
            revert StatusIncorrect();
        }
        weiPrice = _newPrice;
        ITRADEFACTORY_CONTRACT.onPriceChange(_newPrice, SELLER_ADDRESS);
    }
   
    /**
     * @notice Cancel the listing
     * @dev Only the seller can cancel the listing
     * @dev The listing must be in status ForSale
     */
    function sellerCancel() external onlyAddress(SELLER_ADDRESS) {
        if (status != TradeStatus.ForSale) {
            revert StatusIncorrect();
        }
        string memory _data = string(
            abi.encodePacked(
                Strings.toString(weiPrice) /*,
                "||", */
            )
        );   
        _changeStatus(TradeStatus.SellerCancelled, _data);
        IUSERS_CONTRACT.changeUserInteractionStatus(
            address(this),
            SELLER_ADDRESS,
            status
        );             
        _rmvAId();
    }

    /**
     * @notice Commit to buy the listing
     * @dev Only a buyer can commit to buy the listing
     * @dev The listing must be in status ForSale
     * @param _buyerTradeUrl The buyer's trade url
     * @param _affLink The referral code (0x000.. in full length if none)
     * @param _buyerAddress The buyer's address (if the buyer is a proxy from BuyAssistoor contract)
     */
    function commitBuy(
        TradeUrl memory _buyerTradeUrl,
        bytes32 _affLink,
        address _buyerAddress
    ) external nonReentrant {
        if (status != TradeStatus.ForSale) {
            revert StatusIncorrect();
        }

        address _buyer;
        if (msg.sender == address(ITRADEFACTORY_CONTRACT.buyAssistoor())) {
            if(_buyerAddress == address(0)) {
                revert ZeroAddress();
            }
            _buyer = _buyerAddress;
        } else {
            _buyer = msg.sender;
        }

        if (_buyer == SELLER_ADDRESS) {
            revert NotSeller();
        }

        referralCode = _affLink;

        buyerCommitTimestamp = block.timestamp;
        
        buyer = _buyer;
        buyerTradeUrl = _buyerTradeUrl;

        (uint256 buyerNetValue, , , ) = getNetValue(_affLink, weiPrice);
        depositedValue = _transferToken(msg.sender, address(this), buyerNetValue);
        depositedValueWithFees = weiPrice * (depositedValue * 1e18 / buyerNetValue) / 1e18; // Will work for all ERC20 tokens that have decimals <= 18

        string memory _data = string(
            abi.encodePacked(
                Strings.toString(depositedValue),
                "||",
                Strings.toHexString(buyer)
            )
        );

        _changeStatus(TradeStatus.BuyerCommitted, _data);

        IUSERS_CONTRACT.changeUserInteractionStatus(
            address(this),
            SELLER_ADDRESS,
            status
        );
        IUSERS_CONTRACT.addUserInteractionStatus(
            address(this),
            Role.BUYER,
            buyer,
            status
        );
        IUSERS_CONTRACT.startDeliveryTimer(address(this), SELLER_ADDRESS);
    }

    /**
     * @notice Cancel the trade
     * @dev Only the buyer can cancel the trade
     * @dev The listing must be in status BuyerCommitted
     * @dev The buyer can only cancel the trade if the seller has not veridicted the trade.
     * @dev The buyer can only cancel the trade if 24 hours have passed since the buyer committed to buy.
     */
    function buyerCancel() external onlyAddress(buyer) nonReentrant {
        if (status != TradeStatus.BuyerCommitted) {
            revert StatusIncorrect();
        }
        if (block.timestamp < buyerCommitTimestamp + 24 hours) {
           revert TimeNotElapsed();
        }
        _changeStatus(TradeStatus.BuyerCancelled, "BU_DEFAULT");
        IUSERS_CONTRACT.changeUserInteractionStatus(
            address(this),
            SELLER_ADDRESS,
            status
        );
        IUSERS_CONTRACT.changeUserInteractionStatus(address(this), buyer, status);

        _transferToken(address(this), buyer, depositedValue);

        _rmvAId();
    }

    /**
     * @notice Seller confirms or deny they have accepted the trade offer.
     * @dev Only the seller can confirm or deny they have accepted the trade offer.
     * @dev The listing must be in status BuyerCommitted
     * @param _sellerCommited Whether the seller has accepted the trade offer or not
     */
    function sellerTradeVeridict(
        bool _sellerCommited
    ) external onlyAddress(SELLER_ADDRESS) nonReentrant {
        if (status != TradeStatus.BuyerCommitted) {
            revert StatusIncorrect();
        }
        if (_sellerCommited) {
            string memory _data = string(abi.encodePacked(Strings.toString(sellerTradeUrl.partner),
                    "+",
                    sellerTradeUrl.token,
                    "||",
                    Strings.toString(buyerTradeUrl.partner),
                    "+",
                    buyerTradeUrl.token,
                    "||",
                    Strings.toHexString(buyer),
                    "||",
                    Strings.toString(depositedValue)
                )
            );
            _changeStatus(TradeStatus.SellerCommitted, _data);
            sellerAcceptedTimestamp = block.timestamp;
            IUSERS_CONTRACT.changeUserInteractionStatus(
                address(this),
                SELLER_ADDRESS,
                status
            );
            IUSERS_CONTRACT.changeUserInteractionStatus(
                address(this),
                buyer,
                status
            );
        } else {
            _changeStatus(TradeStatus.SellerCancelledAfterBuyerCommitted, "SE_DEFAULT");
            IUSERS_CONTRACT.changeUserInteractionStatus(address(this), SELLER_ADDRESS, status);
            IUSERS_CONTRACT.changeUserInteractionStatus(address(this), buyer, status);
            _transferToken(address(this), buyer, depositedValue);
            _rmvAId();
        }
    }

    /**
     * @notice Buyer confirms they have received the item.
     * @dev Only the buyer can confirm they have received the item.
     * @dev The listing must be in status BuyerCommitted or SellerCommitted
     */
    function buyerConfirmReceived() external nonReentrant onlyAddress(buyer) {
        if (status != TradeStatus.BuyerCommitted) {
            if(status != TradeStatus.SellerCommitted){
                revert StatusIncorrect();
            }
        }
        
        IUSERS_CONTRACT.endDeliveryTimer(address(this), SELLER_ADDRESS);
        _rmvAId();

        _distributeProceeds();
        string memory _data = string( abi.encodePacked(Strings.toString(weiPrice), "||", "MANUAL"));
        _changeStatus(TradeStatus.Completed, _data);

        IUSERS_CONTRACT.changeUserInteractionStatus(address(this), SELLER_ADDRESS, status);
        IUSERS_CONTRACT.changeUserInteractionStatus(address(this), buyer, status);
    }

    /**
     * @notice Seller confirms the trade has been made after 8 days from seller veridict.
     * @dev Only the seller can confirm the trade has been made.
     * @dev 8 days must have passed since the seller veridicted the trade.
     */
    function sellerConfirmsTrade() external onlyAddress(SELLER_ADDRESS) nonReentrant {
        if(block.timestamp < sellerAcceptedTimestamp + 8 days) {
            revert TimeNotElapsed();
        }
        if (status != TradeStatus.SellerCommitted) {
            revert StatusIncorrect();
        }

        string memory _data = string(
            abi.encodePacked(Strings.toString(weiPrice))
        );

        _changeStatus(TradeStatus.Completed, _data);
        IUSERS_CONTRACT.endDeliveryTimer(address(this), SELLER_ADDRESS);
        IUSERS_CONTRACT.changeUserInteractionStatus(address(this), SELLER_ADDRESS, status);
        IUSERS_CONTRACT.changeUserInteractionStatus(address(this), buyer, status);

        _distributeProceeds();
        _rmvAId();
    }

    /**
     * @notice KeeperNode confirms the trade has been made.
     * @dev Only a KeeperNode can confirm the trade has been made.
     * @dev The listing must be in status BuyerCommitted, SellerCommitted or ForSale
     * @param isTradeMade Whether the trade has been made or not
     * @param message The message to be emitted
     */
    function keeperNodeConfirmsTrade(bool isTradeMade, string memory message) external nonReentrant {
        if (!IKEEPERS_CONTRACT.isKeeperNode(msg.sender)) {
            revert NotKeeperNode();
        }
        if (status != TradeStatus.BuyerCommitted) {
            if (status != TradeStatus.SellerCommitted) {
                if (status != TradeStatus.ForSale) {
                    revert StatusIncorrect();
                }
            }
        }
        finalityResult = message;
        if (isTradeMade) {
            string memory _data = string(
                abi.encodePacked(Strings.toString(weiPrice))
            );
            _changeStatus(TradeStatus.Completed, _data);
            IUSERS_CONTRACT.endDeliveryTimer(address(this), SELLER_ADDRESS);
            IUSERS_CONTRACT.changeUserInteractionStatus(
                address(this),
                SELLER_ADDRESS,
                status
            );
            IUSERS_CONTRACT.changeUserInteractionStatus(
                address(this),
                buyer,
                status
            );

            _distributeProceeds();
        } else {
            TradeStatus oldStatus = status;
            _changeStatus(TradeStatus.Clawbacked, message);
            IUSERS_CONTRACT.changeUserInteractionStatus(
                address(this),
                SELLER_ADDRESS,
                status
            );
            if (oldStatus >= TradeStatus.BuyerCommitted) {
                IUSERS_CONTRACT.changeUserInteractionStatus(
                    address(this),
                    buyer,
                    status
                );
                _transferToken(address(this), buyer, depositedValue);
            }    
        }

        _rmvAId();
    }

    /**
     * @notice Open a dispute
     * @dev Only the seller or the buyer can open a dispute
     * @dev The listing can not already be disputed, resolved or clawbacked.
     * @param _complaint The complaint of the dispute
     */
    function openDispute(
        string memory _complaint
    ) external {
        if (msg.sender != SELLER_ADDRESS) {
            if(msg.sender != buyer){
                revert NotParty();
            }
        }
        if (status == TradeStatus.Disputed || status == TradeStatus.Resolved || status == TradeStatus.Clawbacked || status == TradeStatus.ForSale) {
            revert StatusNotDisputeReady();
        }        
        disputeer = msg.sender;
        disputeComplaint = _complaint;
        _changeStatus(TradeStatus.Disputed, _complaint);
        IUSERS_CONTRACT.changeUserInteractionStatus(
            address(this),
            SELLER_ADDRESS,
            status
        );
        IUSERS_CONTRACT.changeUserInteractionStatus(address(this), buyer, status);
    }

    /**
     * @notice Resolve the dispute
     * @dev Only a Keeper or a KeeperNode can resolve the dispute
     * @dev The listing must be in status Disputed
     * @param isFavourOfBuyer Whether the dispute is in favour of the buyer or not
     * @param giveWarningToSeller Whether to give a warning to the seller or not
     * @param giveWarningToBuyer Whether to give a warning to the buyer or not
     * @param isWithValue Whether to transfer the value of the listing to the favoured party or not
     */
    function resolveDispute(
        bool isFavourOfBuyer,
        bool giveWarningToSeller,
        bool giveWarningToBuyer,
        bool isWithValue
    ) external nonReentrant {
        if (!IKEEPERS_CONTRACT.isKeeperNode(msg.sender)) {
            if(!IKEEPERS_CONTRACT.isKeeper(msg.sender)){
                revert NotKeeperOrNode();
            }
        }
        if (status != TradeStatus.Disputed) {
            revert StatusNotDisputeReady();
        }
        if (isFavourOfBuyer) {
            _changeStatus(TradeStatus.Clawbacked, "KO_CLAWBACK");
            if (isWithValue) {
                _transferToken(address(this), buyer, depositedValue);
            }
        } else {
            _changeStatus(TradeStatus.Resolved, "KO_RESOLVE");
            if (isWithValue) {
                _distributeProceeds();
            }
        }
        _rmvAId();
        if (giveWarningToSeller) {
            IUSERS_CONTRACT.warnUser(SELLER_ADDRESS);
        }
        if (giveWarningToBuyer) {
            IUSERS_CONTRACT.warnUser(buyer);
        }
        IUSERS_CONTRACT.changeUserInteractionStatus(
            address(this),
            SELLER_ADDRESS,
            status
        );
        IUSERS_CONTRACT.changeUserInteractionStatus(address(this), buyer, status);
    }

    /**
     * @notice Distribute the proceeds of the listing
     * @dev This function is used to distribute the proceeds of the listing
     */
    function _distributeProceeds() private {
        // Fetch the referral code from the registry for the buyer
        bytes32 storageRefCode = referralRegistryContract.getReferralCode(buyer);

        // If the fetched referral code is not zero (i.e., it exists), then check if it's different from the current referral code.
        // If it's different, then update the current referral code to the fetched one.
        if (storageRefCode != bytes32(0)) {
            if (storageRefCode != referralCode) {
                referralCode = storageRefCode;
            }
            // If the fetched referral code is zero (i.e., it doesn't exist), then check if the current referral code is not zero.
            // If the current referral code is not zero, then we need to validate it.
        } else if (referralCode != bytes32(0)) {
            // Check if the current referral code is registered. If it's not, then we set the referral code to zero and skip further checks.
            if (!referralRegistryContract.isReferralCodeRegistered(referralCode)) {
                referralCode = bytes32(0);
            } else {
                // If the referral code is valid, then we fetch the owner of the referral code.
                address refOwner = referralRegistryContract.getReferralCodeOwner(referralCode);
                // Check if the owner of the referral code is not the buyer.
                // If it's the buyer, then we set the referral code to zero.
                // If it's not the buyer, then we set the referral code as Primary for the buyer.
                if (refOwner == buyer) {
                    referralCode = bytes32(0);
                } else {
                    referralRegistryContract.setReferralCodeAsTC(referralCode, buyer);
                }
            }
        }

        (uint256 buyerNetPrice, uint256 sellerNetProceeds, uint256 affiliatorNetReward, uint256 tokenHoldersNetReward) = getNetValue(referralCode, depositedValueWithFees);
        _transferToken(address(this), SELLER_ADDRESS, sellerNetProceeds);
        if (affiliatorNetReward > 0) {
            uint256 actualAmountTransferredToAff = _transferToken(address(this), referralRegistryContract.getReferralCodeOwner(referralCode), affiliatorNetReward);
            referralRegistryContract.emitReferralCodeRebateUpdated(
                address(this),
                address(paymentToken),
                referralCode,
                actualAmountTransferredToAff
            );
        }

        if(priceType == PriceType.USDT){
            paymentToken.forceApprove(address(sCSXToken), tokenHoldersNetReward);
        } else {
            paymentToken.safeIncreaseAllowance(address(sCSXToken), tokenHoldersNetReward);
        }
        
        if (!sCSXToken.depositDividend(address(paymentToken), tokenHoldersNetReward)) {
            revert DividendDepositFailed();
        }
        IUSERS_CONTRACT.emitNewTrade(
            SELLER_ADDRESS,
            buyer,
            referralCode,
            priceType,
            buyerNetPrice
        );
    }

    /**
     * @notice Transfers tokens from the sender to the recipient
     * @param from From address
     * @param to To address
     * @param amount Amount of tokens
     * @return actualAmountTransferred
     * @dev This function is used to transfer tokens from the sender to the recipient
     * @dev If the token is a potential fee on transfer token, it will calculate the actual amount transferred
     */
    function _transferToken(address from, address to, uint256 amount) private returns (uint256) {
        bool isFeeOnTransferToken = priceType == PriceType.USDT || priceType == PriceType.USDC;
        uint256 beforeBalance;

        if (isFeeOnTransferToken) {
            beforeBalance = paymentToken.balanceOf(to);
        }

        if (from == address(this)) {
            paymentToken.safeTransfer(to, amount);
        } else {
            paymentToken.safeTransferFrom(from, to, amount);
        }

        uint256 actualAmountTransferred = amount;
        if (isFeeOnTransferToken) {
            uint256 afterBalance = paymentToken.balanceOf(to);
            actualAmountTransferred = afterBalance - beforeBalance;
        }

        return actualAmountTransferred;
    }

    /**
     * @notice Change the status of the listing
     * @param _status The new status of the listing
     * @param data The data to be emitted
     */
    function _changeStatus(TradeStatus _status, string memory data) private {
        TradeStatus prevStatus = status;
        status = _status;
        statusHistory.push(_status);
        ITRADEFACTORY_CONTRACT.onStatusChange(status, prevStatus, data, SELLER_ADDRESS, buyer);
    }

    /** Remove Asset Id
     * @notice Remove the asset id from the used asset ids list by seller
     * @dev This function is used to remove the asset id from the used asset ids list by seller
     */
    function _rmvAId() private {
        bool _s = IUSERS_CONTRACT.removeAssetIdUsed(itemSellerAssetId, SELLER_ADDRESS);

        if (!_s) {
            revert TradeIDNotRemoved();
        }
    }

    /**
     * @notice Get the net value of the listing
     * @param _affLink The referral code
     * @return buyerNetPrice 
     * @return sellerNetProceeds 
     * @return affiliatorNetReward 
     * @return tokenHoldersNetReward 
     */
    function getNetValue(
        bytes32 _affLink,
        uint256 _value
    )
        public
        view
        returns (
            uint256 buyerNetPrice,
            uint256 sellerNetProceeds,
            uint256 affiliatorNetReward,
            uint256 tokenHoldersNetReward
        )
    {
        bool hasReferral = referralRegistryContract.getReferralCodeOwner(
            _affLink
        ) != address(0);

        uint256 buyerRatio;

        if (hasReferral) {
            (,uint256 _buyerRatio) = referralRegistryContract.getReferralCodeRatios(_affLink);
            buyerRatio = (_buyerRatio / 2);
        }(
            buyerNetPrice,
            sellerNetProceeds,
            affiliatorNetReward,
            tokenHoldersNetReward
        ) = referralRegistryContract.calculateNetValue(
            _value,
            hasReferral,
            ITRADEFACTORY_CONTRACT.baseFee(),
            buyerRatio
        );
    }

    /**
     * @notice Get the status history length of the listing
     */
    function getStatusCount() external view returns (uint256) {
        return statusHistory.length;
    }

    /**
     * @notice Get the amount of stickers the item has
     */
    function stickerLength() external view returns (uint256) {
        return stickers.length;
    }
}
