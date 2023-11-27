// //SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {IKeepers} from "../Keepers/IKeepers.sol";
import {IUsers, TradeStatus, Role} from "../Users/IUsers.sol";
import {ITradeFactory, TradeUrl, Sticker, SkinInfo, PriceType} from "../TradeFactory/ITradeFactory.sol";
import {Strings} from "../utils/Strings.sol";
import {IStakedCSX, SafeERC20} from "../CSX/Interfaces.sol";
import {IReferralRegistry} from "../Referrals/IReferralRegistry.sol";

error NotFactory();
error NotForSale();
error NotCommitted();
error NotDisputed();
error NotSeller();
error NotBuyer();
error NotKeeperNode();
error NotKeeperOrNode();
error NotParty();
error NotGroup();
error TransferFailed();
error StatusNotBuyerCommitted();
error StatusNotSellerCommitted();
error StatusNotDisputeReady();
error TradeIDNotRemoved();
error SellerTransferFailed();
error AffiliatorTransferFailed();
error DividendDepositFailed();
error TimeNotElapsed();

contract CSXTrade {
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
        if (_factory == address(0)) {
            revert NotFactory();
        }
        if(_seller == address(0)) {
            revert NotSeller();
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
        uint totalStickers = _stickers.length;
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
            revert NotForSale();
        }
        weiPrice = _newPrice;
    }
   
    /**
     * @notice Cancel the listing
     * @dev Only the seller can cancel the listing
     * @dev The listing must be in status ForSale
     */
    function sellerCancel() external onlyAddress(SELLER_ADDRESS) {
        if (status != TradeStatus.ForSale) {
            revert NotForSale();
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
        IUSERS_CONTRACT.removeAssetIdUsed(itemSellerAssetId, SELLER_ADDRESS);
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
    ) external {
        if (status != TradeStatus.ForSale) {
            revert NotForSale();
        }

        address _buyer;
        if (msg.sender == address(ITRADEFACTORY_CONTRACT.buyAssistoor())) {
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

        (uint256 buyerNetValue, , , ) = getNetValue(_affLink);
        depositedValue = buyerNetValue;        

        string memory _data = string(
            abi.encodePacked(
                Strings.toString(weiPrice),
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
        paymentToken.safeTransferFrom(msg.sender, address(this), buyerNetValue);    
    }

    /**
     * @notice Cancel the trade
     * @dev Only the buyer can cancel the trade
     * @dev The listing must be in status BuyerCommitted
     * @dev The buyer can only cancel the trade if the seller has not veridicted the trade.
     * @dev The buyer can only cancel the trade if 24 hours have passed since the buyer committed to buy.
     */
    function buyerCancel() external onlyAddress(buyer) {
        if (status != TradeStatus.BuyerCommitted) {
            revert NotCommitted();
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

        paymentToken.safeTransfer(buyer, depositedValue);
    }

    /**
     * @notice Seller confirms or deny they have accepted the trade offer.
     * @dev Only the seller can confirm or deny they have accepted the trade offer.
     * @dev The listing must be in status BuyerCommitted
     * @param _sellerCommited Whether the seller has accepted the trade offer or not
     */
    function sellerTradeVeridict(
        bool _sellerCommited
    ) external onlyAddress(SELLER_ADDRESS) {
        if (status != TradeStatus.BuyerCommitted) {
            revert StatusNotBuyerCommitted();
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
                    Strings.toString(weiPrice)
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
            paymentToken.safeTransfer(buyer, depositedValue);
        }
    }

    /**
     * @notice Buyer confirms they have received the item.
     * @dev Only the buyer can confirm they have received the item.
     * @dev The listing must be in status BuyerCommitted or SellerCommitted
     */
    function buyerConfirmReceived() external onlyAddress(buyer) {
        if (status != TradeStatus.BuyerCommitted) {
            if(status != TradeStatus.SellerCommitted){
                revert StatusNotSellerCommitted();
            }
        }
        string memory _data = string( abi.encodePacked(Strings.toString(weiPrice), "||", "MANUAL"));
        _changeStatus(TradeStatus.Completed, _data);
        IUSERS_CONTRACT.endDeliveryTimer(address(this), SELLER_ADDRESS);
        bool success = IUSERS_CONTRACT.removeAssetIdUsed(itemSellerAssetId, SELLER_ADDRESS);

        if (!success) {
            revert TradeIDNotRemoved();
        }

        _distributeProceeds();

        IUSERS_CONTRACT.changeUserInteractionStatus(address(this), SELLER_ADDRESS, status);
        IUSERS_CONTRACT.changeUserInteractionStatus(address(this), buyer, status);
    }

    /**
     * @notice Seller confirms the trade has been made after 8 days from seller veridict.
     * @dev Only the seller can confirm the trade has been made.
     * @dev 8 days must have passed since the seller veridicted the trade.
     */
    function sellerConfirmsTrade() external onlyAddress(SELLER_ADDRESS) {
        if(block.timestamp < sellerAcceptedTimestamp + 8 days) {
            revert TimeNotElapsed();
        }
        if (status != TradeStatus.SellerCommitted) {
            revert StatusNotSellerCommitted();
        }

        string memory _data = string(
            abi.encodePacked(Strings.toString(weiPrice))
        );

        _changeStatus(TradeStatus.Completed, _data);
        IUSERS_CONTRACT.endDeliveryTimer(address(this), SELLER_ADDRESS);
        IUSERS_CONTRACT.changeUserInteractionStatus(address(this), SELLER_ADDRESS, status);
        IUSERS_CONTRACT.changeUserInteractionStatus(address(this), buyer, status);

        _distributeProceeds();
    }

    /**
     * @notice KeeperNode confirms the trade has been made.
     * @dev Only a KeeperNode can confirm the trade has been made.
     * @dev The listing must be in status BuyerCommitted, SellerCommitted or ForSale
     * @param isTradeMade Whether the trade has been made or not
     * @param message The message to be emitted
     */
    function keeperNodeConfirmsTrade(bool isTradeMade, string memory message) external {
        if (!IKEEPERS_CONTRACT.isKeeperNode(msg.sender)) {
            revert NotKeeperNode();
        }
        if (status != TradeStatus.BuyerCommitted) {
            if (status != TradeStatus.SellerCommitted) {
                if (status != TradeStatus.ForSale) {
                    revert StatusNotBuyerCommitted();
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
                paymentToken.safeTransfer(buyer, depositedValue);
            }    
        }

        bool raS = IUSERS_CONTRACT.removeAssetIdUsed(itemSellerAssetId, SELLER_ADDRESS);
        if (!raS) {
            revert TradeIDNotRemoved();
        }
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
                revert NotGroup();
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
    ) external {
        if (!IKEEPERS_CONTRACT.isKeeperNode(msg.sender)) {
            if(IKEEPERS_CONTRACT.indexOf(msg.sender) == 0){
                revert NotKeeperOrNode();
            }
        }
        if (status != TradeStatus.Disputed) {
            revert StatusNotDisputeReady();
        }
        if (isFavourOfBuyer) {
            _changeStatus(TradeStatus.Clawbacked, "KO_CLAWBACK");
            if (isWithValue) {
                paymentToken.safeTransfer(buyer, depositedValue);
            }
        } else {
            _changeStatus(TradeStatus.Resolved, "KO_RESOLVE");
            if (isWithValue) {
                _distributeProceeds();
            }
        }
        bool success = IUSERS_CONTRACT.removeAssetIdUsed(itemSellerAssetId, SELLER_ADDRESS);
        if (!success) {
            revert TradeIDNotRemoved();
        }
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

        (uint256 buyerNetPrice, uint256 sellerNetProceeds, uint256 affiliatorNetReward, uint256 tokenHoldersNetReward) = getNetValue(referralCode);
        paymentToken.safeTransfer(SELLER_ADDRESS, sellerNetProceeds);
        if (affiliatorNetReward > 0) {
            paymentToken.safeTransfer(referralRegistryContract.getReferralCodeOwner(referralCode), affiliatorNetReward);
            referralRegistryContract.emitReferralCodeRebateUpdated(
                address(this),
                address(paymentToken),
                referralCode,
                affiliatorNetReward
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

    /**
     * @notice Get the net value of the listing
     * @param _affLink The referral code
     * @return buyerNetPrice 
     * @return sellerNetProceeds 
     * @return affiliatorNetReward 
     * @return tokenHoldersNetReward 
     */
    function getNetValue(
        bytes32 _affLink
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
            weiPrice,
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
