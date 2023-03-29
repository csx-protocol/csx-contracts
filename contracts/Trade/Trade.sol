// //SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import "../Keepers/IKeepers.sol";
import "../Users/IUsers.sol";
import "../TradeFactory/ITradeFactory.sol";

contract SMTrade {

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

    uint256 public buyerDeposited;
    uint256 public weiPrice;
    uint256 public buyerCommittedTimestamp;

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
        status = TradeStatus.Pending;
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
        usersContract.addUserInteractionStatus(address(this), Role.SELLER, seller, TradeStatus.Pending);
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

    // Seller can cancel the listing up til any buyer has committed ETH.
    function sellerCancel() external onlyAddress(seller) {
        require(status == TradeStatus.Committed || status == TradeStatus.Pending, "st !pen");
        TradeStatus oldStatus = status;
        status = TradeStatus.SellerCancelled;
        usersContract.changeUserInteractionStatus(address(this), seller, status);
        if(oldStatus == TradeStatus.Committed) {
            usersContract.changeUserInteractionStatus(address(this), buyer, status);
            (bool sent, ) = buyer.call{value: buyerDeposited}("");
            require(sent, "!Eth");
        }
     
        string memory data = string(
            abi.encodePacked(
                Strings.toString(weiPrice) /*,
                "||", */
            )
        );
        factoryContract.onStatusChange(status, data);
        factoryContract.removeAssetIdUsed(itemSellerAssetId, seller);
    }

    // Buyer commits ETH to buy if status-state allows & Sends trade-offer to sellers trade-link off-chain.
    function commitBuy(TradeUrl memory _buyerTradeUrl) public payable {
        require(status == TradeStatus.Pending, "trd st !pen.");
        require(msg.value >= weiPrice, "!value");
        require(msg.sender != seller, "!seller");
        status = TradeStatus.Committed;
        usersContract.startDeliveryTimer(address(this), seller);
        buyer = payable(msg.sender);
        buyerTradeUrl = _buyerTradeUrl;

        buyerDeposited = msg.value;
        buyerCommittedTimestamp = block.timestamp;
        
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
                Strings.toHexString(msg.sender)
            )
        );
        
        usersContract.changeUserInteractionStatus(address(this), seller, status);
        usersContract.addUserInteractionStatus(address(this), Role.BUYER, buyer, status);
        factoryContract.onStatusChange(status, data);
    }

    // If automated Keeper-oracle can identify item has been successfully trade from seller to buyer, it will release here.
    // function keeperNodeConfirmsTradeMade() external onlyKeeperNode {
    //     require(
    //         status >= TradeStatus.Committed,
    //         "trdsts!>comm"
    //     );
    //     require(
    //         status < TradeStatus.Completed,
    //         "trdsts<comp"
    //     );
    //     status = TradeStatus.Completed;
    //     usersContract.endDeliveryTimer(address(this), seller);
    //     usersContract.changeUserInteractionStatus(address(this), seller, status);
    //     usersContract.changeUserInteractionStatus(address(this), buyer, status);
    //     bool success = factoryContract.removeAssetIdUsed(itemSellerAssetId, seller);
    //     require(success, "!tradeId");
    //     (bool sent, ) = seller.call{value: buyerDeposited}("");
    //     require(sent, "!sntEth");
    //     factoryContract.onStatusChange(status, "KEEPER-ORACLE CONFIRMED TRADE MADE");
    // }

    // Keeper-oracle recognizes wrong-doing and defaults the trade.
    // function keeperNodeConfirmsDefault() external onlyKeeperNode {
    //     require(
    //         status >= TradeStatus.Committed,
    //         "trdsts!>comm"
    //     );
    //     require(
    //         status < TradeStatus.Completed,
    //         "trdsts<comp"
    //     );
    //     TradeStatus oldStatus = status;
    //     status = TradeStatus.Clawbacked;
    //     usersContract.changeUserInteractionStatus(address(this), seller, status);        
    //     if(oldStatus >= TradeStatus.Committed){
    //         usersContract.changeUserInteractionStatus(address(this), buyer, status);
    //     }       
    //     bool success = factoryContract.removeAssetIdUsed(itemSellerAssetId, seller);
    //     require(success, "!tradeId");
    //     (bool sent, ) = buyer.call{value: buyerDeposited}("");
    //     require(sent, "!sntEth");
    //     factoryContract.onStatusChange(status, "KEEPER-ORACLE CONFIRMED DEFAULT");
    // }

    function keeperNodeConfirmsTrade(bool isTradeMade) external onlyKeeperNode {
        require(
            status >= TradeStatus.Committed,
            "trdsts!>comm"
        );
        require(
            status < TradeStatus.Completed,
            "trdsts<comp"
        );
        
        if (isTradeMade) {
            status = TradeStatus.Completed;
            usersContract.endDeliveryTimer(address(this), seller);
            usersContract.changeUserInteractionStatus(address(this), seller, status);
            usersContract.changeUserInteractionStatus(address(this), buyer, status);
            (bool sS, ) = seller.call{value: buyerDeposited}("");
            require(sS, "!sntEth");
            factoryContract.onStatusChange(status, "KO TRADE");
        } else {
            TradeStatus oldStatus = status;
            status = TradeStatus.Clawbacked;
            usersContract.changeUserInteractionStatus(address(this), seller, status);        
            if(oldStatus >= TradeStatus.Committed){
                usersContract.changeUserInteractionStatus(address(this), buyer, status);
            }
            (bool bS, ) = buyer.call{value: buyerDeposited}("");
            require(bS, "!sntEth");
            factoryContract.onStatusChange(status, "KO DEFAULT");
        }
        
        bool raS = factoryContract.removeAssetIdUsed(itemSellerAssetId, seller);
        require(raS, "!tradeId");
    }


    // Seller Confirms they have accepted the trade offer.
    function acceptTradeOffer() public onlyAddress(seller) {
        require(status == TradeStatus.Committed, "trdsts!comm");
        status = TradeStatus.Accepted;
        usersContract.changeUserInteractionStatus(address(this), seller, status);
        usersContract.changeUserInteractionStatus(address(this), buyer, status);   
        factoryContract.onStatusChange(status, "");
    }

    // Buyer Confirms they have received the item.
    function confirmReceived() public onlyAddress(buyer) {
        require(
            status == TradeStatus.Committed || status == TradeStatus.Accepted,
            "trdsts!comm|act."
        );
        status = TradeStatus.Completed;
        usersContract.endDeliveryTimer(address(this), seller);
        bool success = factoryContract.removeAssetIdUsed(itemSellerAssetId, seller);
        require(success, "didn't remove tradeId");
        (bool sent, ) = seller.call{value: buyerDeposited}("");
        require(sent, "Failure, ether not sent!");
        usersContract.changeUserInteractionStatus(address(this), seller, status);
        usersContract.changeUserInteractionStatus(address(this), buyer, status); 
        factoryContract.onStatusChange(status, "");
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
                (bool sent, ) = buyer.call{value: buyerDeposited}("");
                require(sent, "!snt");
            }
        } else {
            status = TradeStatus.Resolved;
            if (isWithValue) {
                (bool sent, ) = seller.call{value: buyerDeposited}("");
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
