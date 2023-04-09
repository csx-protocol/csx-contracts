// //SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import "../Keepers/IKeepers.sol";
import "../Users/IUsers.sol";
import "../TradeFactory/ITradeFactory.sol";

contract CSXTrade {

    address payable public seller;
    address payable public buyer;

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

    FloatInfo public float;

    TradeStatus public status;

    IKeepers public keepersContract;
    IUsers public usersContract;
    ITradeFactory public factoryContract;

    string public disputeComplaint;
    TradeStatus public disputedStatus;
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
        FloatInfo memory _float
    ) {
        factoryContract = ITradeFactory(_factory);
        keepersContract = IKeepers(_keepers);
        usersContract = IUsers(_users);
        seller = payable(_seller);
        weiPrice = _weiPrice;
        status = TradeStatus.ForSale;
        itemMarketName = _itemMarketName;
        sellerTradeUrl = _sellerTradeUrl;
        itemSellerAssetId = _sellerAssetId;
        inspectLink = _inspectLink;
        itemImageUrl = _itemImageUrl;
        float.value = _float.value;
        float.min = _float.min;
        float.max = _float.max;
    }

    bool public hasInit;
    function initExtraInfo(Sticker[] memory _stickers, string memory _weaponType) external {
        require(msg.sender == address(factoryContract) && !hasInit, '!factory');
        hasInit = true;
        for (uint256 i = 0; i < _stickers.length; i++) {
            stickers.push(_stickers[i]);
        }
        usersContract.addUserInteractionStatus(address(this), Role.SELLER, seller, TradeStatus.ForSale);
        weaponType = _weaponType;
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
        usersContract.changeUserInteractionStatus(address(this), seller, status);
        string memory data = string(
            abi.encodePacked(
                Strings.toString(weiPrice) /*,
                "||", */
            )
        );
        factoryContract.onStatusChange(status, data);
        factoryContract.removeAssetIdUsed(itemSellerAssetId, seller);
    }

    // Buyer commits tokens to buy if status-state allows & Sends trade-offer to sellers trade-link off-chain.
    function commitBuy(TradeUrl memory _buyerTradeUrl) public payable {
        require(status == TradeStatus.ForSale, "trd st !pen.");
        require(msg.value >= weiPrice, "!value");
        require(msg.sender != seller, "!seller");
        status = TradeStatus.BuyerCommitted;
        buyerCommitTimestamp = block.timestamp;
        usersContract.startDeliveryTimer(address(this), seller);
        buyer = payable(msg.sender);
        buyerTradeUrl = _buyerTradeUrl;

        depositedValue = msg.value;
        
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
                Strings.toHexString(msg.sender),
                "||",
                Strings.toString(weiPrice)
            )
        );

        usersContract.changeUserInteractionStatus(address(this), seller, status);
        usersContract.addUserInteractionStatus(address(this), Role.BUYER, buyer, status);
        factoryContract.onStatusChange(status, data);
    }

    // Buyer can cancel the trade up til the seller has accepted the trade offer.
    function buyerCancel() external onlyAddress(buyer) {
        require(status == TradeStatus.BuyerCommitted, "trdsts!comm");
        // require(block.timestamp >= buyerCommitTimestamp + 24 hours, "!24hrs");
        // TODO: REMOVE THIS REQUIREMENT FOR TESTING
        require(block.timestamp >= buyerCommitTimestamp + 5 minutes, "!5mnts"); // FOR TESTING
        status = TradeStatus.BuyerCancelled;
        usersContract.changeUserInteractionStatus(address(this), seller, status);
        usersContract.changeUserInteractionStatus(address(this), buyer, status);
        (bool sent, ) = buyer.call{value: depositedValue}("");
        require(sent, "!Eth");
        factoryContract.onStatusChange(status, "BU DEFAULT");
    }

    // Seller Confirms or deny they have accepted the trade offer.
    function sellerTradeVeridict(bool sellerCommited) public onlyAddress(seller) {
        require(status == TradeStatus.BuyerCommitted, "trdsts!comm");
        if(sellerCommited) {
            status = TradeStatus.SellerCommitted;
            sellerAcceptedTimestamp = block.timestamp;
            usersContract.changeUserInteractionStatus(address(this), seller, status);
            usersContract.changeUserInteractionStatus(address(this), buyer, status);
            factoryContract.onStatusChange(status, "");
        } else {
            status = TradeStatus.SellerCancelledAfterBuyerCommitted;
            usersContract.changeUserInteractionStatus(address(this), seller, status);
            usersContract.changeUserInteractionStatus(address(this), buyer, status);
            (bool sent, ) = buyer.call{value: depositedValue}("");
            require(sent, "!Eth");
            factoryContract.onStatusChange(status, "SE DEFAULT");
        }
    }

    // Buyer Confirms they have received the item.
    function buyerConfirmReceived() public onlyAddress(buyer) {
        require(
            status == TradeStatus.BuyerCommitted || status == TradeStatus.SellerCommitted,
            "trdsts!comm|act."
        );
        status = TradeStatus.Completed;
        usersContract.endDeliveryTimer(address(this), seller);
        bool success = factoryContract.removeAssetIdUsed(itemSellerAssetId, seller);
        require(success, "didn't remove tradeId");
        (bool sent, ) = seller.call{value: depositedValue}("");
        require(sent, "Failure, ether not sent!");
        usersContract.changeUserInteractionStatus(address(this), seller, status);
        usersContract.changeUserInteractionStatus(address(this), buyer, status); 
        string memory data = string(
            abi.encodePacked(
                Strings.toString(weiPrice),
                "||",
                "MANUAL"
            )
        );
        factoryContract.onStatusChange(status, data);
    }

    // Seller confirms the trade has been made after 3 days from acceptance.
    function sellerConfirmsTrade() external onlyAddress(seller) {
        require(
            status == TradeStatus.SellerCommitted,
            "trdsts!comm"
        );
        require(
            block.timestamp >= sellerAcceptedTimestamp + 3 days,
            "3 days not passed"
        );
        status = TradeStatus.Completed;
        usersContract.endDeliveryTimer(address(this), seller);
        usersContract.changeUserInteractionStatus(address(this), seller, status);
        usersContract.changeUserInteractionStatus(address(this), buyer, status);
        (bool sS, ) = seller.call{value: depositedValue}("");
        require(sS, "!sntEth");
        string memory data = string(
            abi.encodePacked(
                Strings.toString(weiPrice)
            )
        );
        factoryContract.onStatusChange(status, data);
    }

    // KeeperNode Confirms the trade has been made.
    function keeperNodeConfirmsTrade(bool isTradeMade) external onlyKeeperNode {
        require(
            status == TradeStatus.BuyerCommitted || status == TradeStatus.SellerCommitted,
            "trdsts!>comm"
        );        
        if (isTradeMade) {
            status = TradeStatus.Completed;
            usersContract.endDeliveryTimer(address(this), seller);
            usersContract.changeUserInteractionStatus(address(this), seller, status);
            usersContract.changeUserInteractionStatus(address(this), buyer, status);
            (bool sS, ) = seller.call{value: depositedValue}("");
            require(sS, "!sntEth");
            string memory data = string(
                abi.encodePacked(
                    Strings.toString(weiPrice)
                )
            );
            factoryContract.onStatusChange(status, data);
        } else {
            TradeStatus oldStatus = status;
            status = TradeStatus.Clawbacked;
            usersContract.changeUserInteractionStatus(address(this), seller, status);        
            if(oldStatus >= TradeStatus.BuyerCommitted){
                usersContract.changeUserInteractionStatus(address(this), buyer, status);
            }
            (bool bS, ) = buyer.call{value: depositedValue}("");
            require(bS, "!sntEth");
            factoryContract.onStatusChange(status, "KO DEFAULT");
        }
        
        bool raS = factoryContract.removeAssetIdUsed(itemSellerAssetId, seller);
        require(raS, "!tradeId");
    }

    // Or Buyer/Seller opens dispute in any state.
    function openDispute(string memory _complaint)
        external
        onlyTheseAddresses(seller, buyer)
    {
        require(
            status != TradeStatus.Disputed &&
                status != TradeStatus.Resolved &&
                status != TradeStatus.Clawbacked,
            "alreadyDis"
        );
        status = TradeStatus.Disputed;
        disputeer = msg.sender;
        disputedStatus = status;
        disputeComplaint = _complaint;
        usersContract.changeUserInteractionStatus(address(this), seller, status);
        usersContract.changeUserInteractionStatus(address(this), buyer, status); 
        factoryContract.onStatusChange(status, _complaint);
    }

    // Keepers & KeeperNode resolves the dispute.
    function resolveDispute(
        bool isFavourOfBuyer,
        bool giveWarningToSeller,
        bool giveWarningToBuyer,
        bool isWithValue
    ) external onlyKeepersOrNode {
        require(status == TradeStatus.Disputed, "!disp");
        bool success = factoryContract.removeAssetIdUsed(itemSellerAssetId, seller);
        require(success, "!tradeId");
        if (isFavourOfBuyer) {
            status == TradeStatus.Clawbacked;
            if (isWithValue) {
                (bool sent, ) = buyer.call{value: depositedValue}("");
                require(sent, "!snt");
            }
        } else {
            status = TradeStatus.Resolved;
            if (isWithValue) {
                (bool sent, ) = seller.call{value: depositedValue}("");
                require(sent, "!snt2");
            }
        }
        if (giveWarningToSeller) {
            usersContract.warnUser(seller);
        }
        if (giveWarningToBuyer) {
            usersContract.warnUser(buyer);
        }
        usersContract.changeUserInteractionStatus(address(this), seller, status);
        usersContract.changeUserInteractionStatus(address(this), buyer, status);
        factoryContract.onStatusChange(status, "");
    }
}
