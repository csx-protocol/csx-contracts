// //SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

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

    address public seller;
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

    IKeepers public keepersContract;
    IUsers public usersContract;
    ITradeFactory public factoryContract;

    IReferralRegistry public referralRegistryContract;
    IStakedCSX public sCSXToken;

    string public disputeComplaint;
    address public disputeer;

    modifier onlyAddress(address _address) {
        if (msg.sender != _address) {
            revert NotParty();
        }
        _;
    }

    modifier onlyTheseAddresses(address _add1, address _add2) {
        if (msg.sender != _add1 && msg.sender != _add2) {
            revert NotGroup();
        }
        _;
    }

    modifier onlyKeeperNode() {
        if (!keepersContract.isKeeperNode(msg.sender)) {
            revert NotKeeperNode();
        }
        _;
    }

    modifier onlyKeepersOrNode() {
        if (!keepersContract.isKeeperNode(msg.sender) && keepersContract.indexOf(msg.sender) == 0) {
            revert NotKeeperOrNode();
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
        factoryContract = ITradeFactory(_factory);
        keepersContract = IKeepers(_keepers);
        usersContract = IUsers(_users);
        seller = _seller;
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

    function initExtraInfo(
        Sticker[] memory _stickers,
        string memory _weaponType,
        address _paymentToken,
        PriceType _priceType,
        address _referralRegistryContract,
        address _sCSXToken
    ) external {
        if (msg.sender != address(factoryContract) || hasInit) {
            revert NotFactory();
        }
        hasInit = true;
        for (uint256 i = 0; i < _stickers.length; i++) {
            stickers.push(_stickers[i]);
        }
        weaponType = _weaponType;
        paymentToken = IERC20(_paymentToken);
        priceType = _priceType;
        referralRegistryContract = IReferralRegistry(_referralRegistryContract);
        sCSXToken = IStakedCSX(_sCSXToken);
        usersContract.addUserInteractionStatus(
            address(this),
            Role.SELLER,
            seller,
            TradeStatus.ForSale
        );
    }

    // Seller can cancel the listing up til any buyer has committed tokens.
    function sellerCancel() external onlyAddress(seller) {
        if (status != TradeStatus.ForSale) {
            revert NotForSale();
        }
        _changeStatus(TradeStatus.SellerCancelled);
        usersContract.changeUserInteractionStatus(
            address(this),
            seller,
            status
        );
        string memory data = string(
            abi.encodePacked(
                Strings.toString(weiPrice) /*,
                "||", */
            )
        );
        factoryContract.onStatusChange(status, data, seller, buyer);
        usersContract.removeAssetIdUsed(itemSellerAssetId, seller);
    }

    // Buyer commits tokens to buy if status-state allows & Sends trade-offer to sellers trade-link off-chain.
    function commitBuy(
        TradeUrl memory _buyerTradeUrl,
        bytes32 _affLink,
        address _buyerAddress
    ) public {
        if (status != TradeStatus.ForSale) {
            revert NotForSale();
        }

        address _buyer;
        if (msg.sender == address(factoryContract.buyAssistoor())) {
            _buyer = _buyerAddress;
        } else {
            _buyer = msg.sender;
        }

        if (_buyer == seller) {
            revert NotSeller();
        }

        referralCode = _affLink;

        _changeStatus(TradeStatus.BuyerCommitted);

        buyerCommitTimestamp = block.timestamp;
        
        buyer = _buyer;
        buyerTradeUrl = _buyerTradeUrl;

        depositedValue = paymentToken.balanceOf(address(this));

        // string memory data = string(
        //     abi.encodePacked(
        //         Strings.toString(sellerTradeUrl.partner),
        //         "+",
        //         sellerTradeUrl.token,
        //         "||",
        //         Strings.toString(_buyerTradeUrl.partner),
        //         "+",
        //         _buyerTradeUrl.token,
        //         "||",
        //         Strings.toHexString(buyer),
        //         "||",
        //         Strings.toString(weiPrice)
        //     )
        // );

        string memory data = string(
            abi.encodePacked(
                Strings.toString(weiPrice),
                "||",
                Strings.toHexString(buyer)
            )
        );

        usersContract.changeUserInteractionStatus(
            address(this),
            seller,
            status
        );
        usersContract.addUserInteractionStatus(
            address(this),
            Role.BUYER,
            buyer,
            status
        );
        factoryContract.onStatusChange(status, data, seller, buyer);
        usersContract.startDeliveryTimer(address(this), seller);

        (uint256 buyerNetValue, , , ) = getNetValue(_affLink);
        paymentToken.safeTransferFrom(msg.sender, address(this), buyerNetValue);    
    }

    // Buyer can cancel the trade up til the seller has accepted the trade offer.
    function buyerCancel() external onlyAddress(buyer) {
        if (status != TradeStatus.BuyerCommitted) {
            revert NotCommitted();
        }
        if (block.timestamp < buyerCommitTimestamp + 24 hours) {
           revert TimeNotElapsed();
        }
        _changeStatus(TradeStatus.BuyerCancelled);
        usersContract.changeUserInteractionStatus(
            address(this),
            seller,
            status
        );
        usersContract.changeUserInteractionStatus(address(this), buyer, status);

        if (!paymentToken.transfer(buyer, depositedValue)) {
            revert TransferFailed();
        }

        factoryContract.onStatusChange(status, "BU_DEFAULT", seller, buyer);
    }

    //--------------------------------------------------------------------------------

    // Seller Confirms or deny they have accepted the trade offer.
    function sellerTradeVeridict(
        bool sellerCommited
    ) public onlyAddress(seller) {
        if (status != TradeStatus.BuyerCommitted) {
            revert StatusNotBuyerCommitted();
        }
        if (sellerCommited) {
            _changeStatus(TradeStatus.SellerCommitted);
            sellerAcceptedTimestamp = block.timestamp;
            usersContract.changeUserInteractionStatus(
                address(this),
                seller,
                status
            );
            usersContract.changeUserInteractionStatus(
                address(this),
                buyer,
                status
            );
            string memory data = string(abi.encodePacked(Strings.toString(sellerTradeUrl.partner),
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

            factoryContract.onStatusChange(status, data, seller, buyer);
        } else {
            _changeStatus(TradeStatus.SellerCancelledAfterBuyerCommitted);
            usersContract.changeUserInteractionStatus(address(this), seller, status);
            usersContract.changeUserInteractionStatus(address(this), buyer, status);
            if (!paymentToken.transfer(buyer, depositedValue)) {
                revert TransferFailed();
            }
            factoryContract.onStatusChange(status, "SE_DEFAULT", seller, buyer);
        }
    }

    // Buyer Confirms they have received the item.
    function buyerConfirmReceived() external onlyAddress(buyer) {
        if (status != TradeStatus.BuyerCommitted && status != TradeStatus.SellerCommitted) {
            revert StatusNotBuyerCommitted();
        }
        _changeStatus(TradeStatus.Completed);
        usersContract.endDeliveryTimer(address(this), seller);
        bool success = usersContract.removeAssetIdUsed(itemSellerAssetId, seller);

        if (!success) {
            revert TradeIDNotRemoved();
        }

        _distributeProceeds();

        usersContract.changeUserInteractionStatus(address(this), seller, status);
        usersContract.changeUserInteractionStatus(address(this), buyer, status);
        string memory data = string( abi.encodePacked(Strings.toString(weiPrice), "||", "MANUAL"));
        factoryContract.onStatusChange(status, data, seller, buyer);
    }

    // Seller confirms the trade has been made after 8 days from acceptance.
    function sellerConfirmsTrade() external onlyAddress(seller) {
        if(block.timestamp < sellerAcceptedTimestamp + 8 days) {
            revert TimeNotElapsed();
        }
        if (status != TradeStatus.SellerCommitted) {
            revert StatusNotSellerCommitted();
        }

        _changeStatus(TradeStatus.Completed);
        usersContract.endDeliveryTimer(address(this), seller);
        usersContract.changeUserInteractionStatus(address(this), seller, status);
        usersContract.changeUserInteractionStatus(address(this), buyer, status);

        _distributeProceeds();

        string memory data = string(
            abi.encodePacked(Strings.toString(weiPrice))
        );
        factoryContract.onStatusChange(status, data, seller, buyer);
    }

    // KeeperNode Confirms the trade has been made.
    function keeperNodeConfirmsTrade(bool isTradeMade) external onlyKeeperNode {
        if (status != TradeStatus.BuyerCommitted && status != TradeStatus.SellerCommitted) {
            revert StatusNotBuyerCommitted();
        }
        if (isTradeMade) {
            _changeStatus(TradeStatus.Completed);
            usersContract.endDeliveryTimer(address(this), seller);
            usersContract.changeUserInteractionStatus(
                address(this),
                seller,
                status
            );
            usersContract.changeUserInteractionStatus(
                address(this),
                buyer,
                status
            );

            _distributeProceeds();

            string memory data = string(
                abi.encodePacked(Strings.toString(weiPrice))
            );
            factoryContract.onStatusChange(status, data, seller, buyer);
        } else {
            TradeStatus oldStatus = status;
            _changeStatus(TradeStatus.Clawbacked);
            usersContract.changeUserInteractionStatus(
                address(this),
                seller,
                status
            );
            if (oldStatus >= TradeStatus.BuyerCommitted) {
                usersContract.changeUserInteractionStatus(
                    address(this),
                    buyer,
                    status
                );
            }
            if(!paymentToken.transfer(buyer, depositedValue)) {
                revert TransferFailed();
            }
            factoryContract.onStatusChange(status, "KO_DEFAULT", seller, buyer);
        }

        bool raS = usersContract.removeAssetIdUsed(itemSellerAssetId, seller);
        if (!raS) {
            revert TradeIDNotRemoved();
        }
    }

    // Or Buyer/Seller opens dispute in any state.
    function openDispute(
        string memory _complaint
    ) external onlyTheseAddresses(seller, buyer) {
        if (status == TradeStatus.Disputed || status == TradeStatus.Resolved || status == TradeStatus.Clawbacked) {
            revert StatusNotDisputeReady();
        }
        _changeStatus(TradeStatus.Disputed);
        disputeer = msg.sender;
        disputeComplaint = _complaint;
        usersContract.changeUserInteractionStatus(
            address(this),
            seller,
            status
        );
        usersContract.changeUserInteractionStatus(address(this), buyer, status);
        factoryContract.onStatusChange(status, _complaint, seller, buyer);
    }

    // Keepers & KeeperNode resolves the dispute.
    function resolveDispute(
        bool isFavourOfBuyer,
        bool giveWarningToSeller,
        bool giveWarningToBuyer,
        bool isWithValue
    ) external onlyKeepersOrNode {
        if (status != TradeStatus.Disputed) {
            revert StatusNotDisputeReady();
        }
        if (isFavourOfBuyer) {
            status == TradeStatus.Clawbacked;
            if (isWithValue) {
                if(!paymentToken.transfer(buyer, depositedValue)) {
                    revert TransferFailed();
                }
            }
        } else {
            _changeStatus(TradeStatus.Resolved);
            if (isWithValue) {
                _distributeProceeds();
            }
        }
        bool success = usersContract.removeAssetIdUsed(itemSellerAssetId, seller);
        if (!success) {
            revert TradeIDNotRemoved();
        }
        if (giveWarningToSeller) {
            usersContract.warnUser(seller);
        }
        if (giveWarningToBuyer) {
            usersContract.warnUser(buyer);
        }
        usersContract.changeUserInteractionStatus(
            address(this),
            seller,
            status
        );
        usersContract.changeUserInteractionStatus(address(this), buyer, status);
        factoryContract.onStatusChange(status, "", seller, buyer);
    }

    ////////////////////////////////////////////////////////////////////////////

    // Private Functions
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
        if (!paymentToken.transfer(seller, sellerNetProceeds)) {
            revert SellerTransferFailed();
        }
        if (affiliatorNetReward > 0) {
            if (!paymentToken.transfer(referralRegistryContract.getReferralCodeOwner(referralCode), affiliatorNetReward)) {
                revert AffiliatorTransferFailed();
            }
            referralRegistryContract.emitReferralCodeRebateUpdated(
                address(this),
                address(paymentToken),
                referralCode,
                affiliatorNetReward
            );
        }
        paymentToken.approve(address(sCSXToken), tokenHoldersNetReward);
        if (!sCSXToken.depositDividend(address(paymentToken), tokenHoldersNetReward)) {
            revert DividendDepositFailed();
        }
        usersContract.emitNewTrade(
            seller,
            buyer,
            referralCode,
            priceType,
            buyerNetPrice
        );
    }

    function _changeStatus(TradeStatus _status) private {
        status = _status;
        statusHistory.push(_status);
    }

    // Public Functions
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

        //uint256 ownerRatio;
        uint256 buyerRatio;

        if (hasReferral) {
            (
                ,
                /*uint256 _ownerRatio*/ uint256 _buyerRatio
            ) = referralRegistryContract.getReferralCodeRatios(_affLink);
            //ownerRatio = _ownerRatio;
            buyerRatio = (_buyerRatio / 2);
        }

        (
            buyerNetPrice,
            sellerNetProceeds,
            affiliatorNetReward,
            tokenHoldersNetReward
        ) = referralRegistryContract.calculateNetValue(
            weiPrice,
            hasReferral,
            factoryContract.baseFee(),
            buyerRatio
        );
    }

    function getStatusCount() public view returns (uint) {
        return statusHistory.length;
    }

    function stickerLength() external view returns (uint256) {
        return stickers.length;
    }
}
