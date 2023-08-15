// //SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";

import "../Keepers/IKeepers.sol";
import "../Users/IUsers.sol";
import {ITradeFactory, TradeUrl, Sticker, SkinInfo, PriceType } from "../TradeFactory/ITradeFactory.sol";
import {Strings} from "../utils/Strings.sol";

import {IStakedCSX} from "../CSX/Interfaces.sol";

import "../Referrals/IReferralRegistry.sol";

contract CSXTrade {
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

    IKeepers public keepersContract;
    IUsers public usersContract;
    ITradeFactory public factoryContract;

    IReferralRegistry public referralRegistryContract;
    IStakedCSX public sCSXToken;

    string public disputeComplaint;
    address public disputeer;

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
        require(msg.sender == address(factoryContract) && !hasInit, "!factory");
        hasInit = true;
        for (uint256 i = 0; i < _stickers.length; i++) {
            stickers.push(_stickers[i]);
        }
        usersContract.addUserInteractionStatus(
            address(this),
            Role.SELLER,
            seller,
            TradeStatus.ForSale
        );
        weaponType = _weaponType;
        paymentToken = IERC20(_paymentToken);
        priceType = _priceType;
        referralRegistryContract = IReferralRegistry(_referralRegistryContract);
        sCSXToken = IStakedCSX(_sCSXToken);
    }

    function stickerLength() external view returns (uint256) {
        return stickers.length;
    }

    modifier onlyAddress(address _address) {
        require(msg.sender == _address, "!party");
        _;
    }

    modifier onlyTheseAddresses(address _add1, address _add2) {
        require(msg.sender == _add1 || msg.sender == _add2, "!group");
        _;
    }

    modifier onlyKeeperNode() {
        require(keepersContract.isKeeperNode(msg.sender));
        _;
    }

    modifier onlyKeepersOrNode() {
        require(
            keepersContract.isKeeperNode(msg.sender) ||
                keepersContract.indexOf(msg.sender) != 0,
            "!kepr or orcl"
        );
        _;
    }

    // Seller can cancel the listing up til any buyer has committed tokens.
    function sellerCancel() external onlyAddress(seller) {
        require(status == TradeStatus.ForSale, "st !pen");
        status = TradeStatus.SellerCancelled;
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
        factoryContract.removeAssetIdUsed(itemSellerAssetId, seller);
    }

    // Buyer commits tokens to buy if status-state allows & Sends trade-offer to sellers trade-link off-chain.
    function commitBuy(
        TradeUrl memory _buyerTradeUrl,
        bytes32 _affLink, 
        address _buyerAddress
    ) public {
        require(status == TradeStatus.ForSale, "!fs");

        address _buyer;
        if(msg.sender == factoryContract.buyAssistoor()){
            _buyer = _buyerAddress;
        } else {
            _buyer = msg.sender;
        }

        require(_buyer != seller, '!seller');

        (uint256 buyerNetValue,,,) = getNetValue(_affLink);

        require(paymentToken.transferFrom(msg.sender, address(this), buyerNetValue), 'transfer failed');

        referralCode = _affLink;
        
        status = TradeStatus.BuyerCommitted;
        buyerCommitTimestamp = block.timestamp;
        usersContract.startDeliveryTimer(address(this), seller);
        buyer = _buyer;
        buyerTradeUrl = _buyerTradeUrl;

        depositedValue = paymentToken.balanceOf(address(this));

        string memory data = string(
            abi.encodePacked(
                Strings.toString(sellerTradeUrl.partner),
                "+",
                sellerTradeUrl.token,
                "||",
                Strings.toString(_buyerTradeUrl.partner),
                "+",
                _buyerTradeUrl.token,
                "||",
                Strings.toHexString(buyer),
                "||",
                Strings.toString(weiPrice)
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
    }

    // Buyer can cancel the trade up til the seller has accepted the trade offer.
    function buyerCancel() external onlyAddress(buyer) {
        require(status == TradeStatus.BuyerCommitted, "trdsts!comm");
        // require(block.timestamp >= buyerCommitTimestamp + 24 hours, "!24hrs");
        // TODO: REMOVE THIS REQUIREMENT FOR TESTING
        // require(block.timestamp >= buyerCommitTimestamp + 5 minutes, "!5mnts"); // FOR TESTING
        status = TradeStatus.BuyerCancelled;
        usersContract.changeUserInteractionStatus(
            address(this),
            seller,
            status
        );
        usersContract.changeUserInteractionStatus(address(this), buyer, status);       
 

        require(paymentToken.transfer(buyer, depositedValue), "!snt");

        factoryContract.onStatusChange(status, "BU_DEFAULT", seller, buyer);
    }

    // Seller Confirms or deny they have accepted the trade offer.
    function sellerTradeVeridict(
        bool sellerCommited
    ) public onlyAddress(seller) {
        require(status == TradeStatus.BuyerCommitted, "trdsts!comm");
        if (sellerCommited) {
            status = TradeStatus.SellerCommitted;
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
            factoryContract.onStatusChange(status, "", seller, buyer);
        } else {
            status = TradeStatus.SellerCancelledAfterBuyerCommitted;
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
            require(paymentToken.transfer(buyer, depositedValue), "!snt");
            factoryContract.onStatusChange(status, "SE_DEFAULT", seller, buyer);
        }
    }

    // Buyer Confirms they have received the item.
    function buyerConfirmReceived() external onlyAddress(buyer) {
        require(
            status == TradeStatus.BuyerCommitted ||
                status == TradeStatus.SellerCommitted,
            "trdsts!comm|act."
        );
        status = TradeStatus.Completed;
        usersContract.endDeliveryTimer(address(this), seller);
        bool success = factoryContract.removeAssetIdUsed(
            itemSellerAssetId,
            seller
        );
        require(success, "didn't remove tradeId");
        
        _distributeProceeds();

        usersContract.changeUserInteractionStatus(address(this), seller, status);
        usersContract.changeUserInteractionStatus(address(this), buyer, status);
        string memory data = string(
            abi.encodePacked(Strings.toString(weiPrice), "||", "MANUAL")
        );
        factoryContract.onStatusChange(status, data, seller, buyer);
    }

    // Seller confirms the trade has been made after 3 days from acceptance.
    function sellerConfirmsTrade() external onlyAddress(seller) {
        require(status == TradeStatus.SellerCommitted, "trdsts!comm");
        require(
            block.timestamp >= sellerAcceptedTimestamp + 3 days,
            "3 days not passed"
        );
        status = TradeStatus.Completed;
        usersContract.endDeliveryTimer(address(this), seller);
        usersContract.changeUserInteractionStatus(
            address(this),
            seller,
            status
        );
        usersContract.changeUserInteractionStatus(address(this), buyer, status);
        
        //require(paymentToken.transfer(seller, depositedValue), "!snt");

        _distributeProceeds();

        string memory data = string(
            abi.encodePacked(Strings.toString(weiPrice))
        );
        factoryContract.onStatusChange(status, data, seller, buyer);
    }

    // KeeperNode Confirms the trade has been made.
    function keeperNodeConfirmsTrade(bool isTradeMade) external onlyKeeperNode {
        require(
            status == TradeStatus.BuyerCommitted ||
                status == TradeStatus.SellerCommitted,
            "trdsts!>comm"
        );
        if (isTradeMade) {
            status = TradeStatus.Completed;
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
            
            // require(paymentToken.transfer(seller, depositedValue), "!snt");
            _distributeProceeds();

            string memory data = string(
                abi.encodePacked(Strings.toString(weiPrice))
            );
            factoryContract.onStatusChange(status, data, seller, buyer);
        } else {
            TradeStatus oldStatus = status;
            status = TradeStatus.Clawbacked;
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
            require(paymentToken.transfer(buyer, depositedValue), "!snt");
            factoryContract.onStatusChange(status, "KO_DEFAULT", seller, buyer);
        }

        bool raS = factoryContract.removeAssetIdUsed(itemSellerAssetId, seller);
        require(raS, "!tradeId");
    }

    // Or Buyer/Seller opens dispute in any state.
    function openDispute(
        string memory _complaint
    ) external onlyTheseAddresses(seller, buyer) {
        require(
            status != TradeStatus.Disputed &&
                status != TradeStatus.Resolved &&
                status != TradeStatus.Clawbacked,
            "alreadyDis"
        );
        status = TradeStatus.Disputed;
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
        require(status == TradeStatus.Disputed, "!disp");
        bool success = factoryContract.removeAssetIdUsed(
            itemSellerAssetId,
            seller
        );
        require(success, "!tradeId");
        if (isFavourOfBuyer) {
            status == TradeStatus.Clawbacked;
            if (isWithValue) {
                require(paymentToken.transfer(buyer, depositedValue), "!snt");
            }
        } else {
            status = TradeStatus.Resolved;
            if (isWithValue) {
                // require(paymentToken.transfer(seller, depositedValue), "!snt");
                _distributeProceeds();
            }
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

    // Private Functions
    function _distributeProceeds() private {
        // Fetch the referral code from the registry for the buyer
        bytes32 storageRefCode = referralRegistryContract.getReferralCode(buyer);

        // If the fetched referral code is not zero (i.e., it exists), then check if it's different from the current referral code.
        // If it's different, then update the current referral code to the fetched one.
        if(storageRefCode != bytes32(0)){
            if(storageRefCode != referralCode){
                referralCode = storageRefCode;
            }
        // If the fetched referral code is zero (i.e., it doesn't exist), then check if the current referral code is not zero.
        // If the current referral code is not zero, then we need to validate it.
        } else if(referralCode != bytes32(0)) { 
            // Check if the current referral code is registered. If it's not, then we set the referral code to zero and skip further checks.
            if(!referralRegistryContract.isReferralCodeRegistered(referralCode)){
                referralCode = bytes32(0);
            } else {
                // If the referral code is valid, then we fetch the owner of the referral code.
                address refOwner = referralRegistryContract.getReferralCodeOwner(referralCode);
                // Check if the owner of the referral code is not the buyer.
                // If it's the buyer, then we set the referral code to zero.
                // If it's not the buyer, then we set the referral code as Primary for the buyer.
                if(refOwner == buyer){
                    referralCode = bytes32(0);
                } else {
                    referralRegistryContract.setReferralCodeAsTC(referralCode, buyer);
                } 
            }
        }

        (uint256 buyerNetPrice, uint256 sellerNetProceeds, uint256 affiliatorNetReward, uint256 tokenHoldersNetReward) = getNetValue(referralCode);
        require(paymentToken.transfer(seller, sellerNetProceeds), "!ssnt");
        if(affiliatorNetReward > 0){
            require(paymentToken.transfer(referralRegistryContract.getReferralCodeOwner(referralCode), affiliatorNetReward), "!rsnt");
            referralRegistryContract.emitReferralCodeRebateUpdated(address(this), address(paymentToken), referralCode, affiliatorNetReward);
        }
        paymentToken.approve(address(sCSXToken), tokenHoldersNetReward);
        require(sCSXToken.depositDividend(address(paymentToken), tokenHoldersNetReward), '!tsnt');
        usersContract.emitNewTrade(seller, buyer, referralCode, priceType, buyerNetPrice);        
    }

    function getNetValue(bytes32 _affLink) public view returns (uint256 buyerNetPrice, uint256 sellerNetProceeds, uint256 affiliatorNetReward, uint256 tokenHoldersNetReward) {
        bool hasReferral = referralRegistryContract.getReferralCodeOwner(
            _affLink
        ) != address(0);

        //uint256 ownerRatio;
        uint256 buyerRatio;

        if(hasReferral){
            (/*uint256 _ownerRatio*/, uint256 _buyerRatio) = referralRegistryContract.getReferralCodeRatios(_affLink);
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
}
