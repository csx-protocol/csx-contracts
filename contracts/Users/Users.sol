//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import {IKeepers} from "../Keepers/IKeepers.sol";
import {ITradeFactory, PriceType, UserInteraction, Role, TradeStatus, TradeInfo} from "../TradeFactory/ITradeFactory.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract Users is ReentrancyGuard {
    struct User {
        uint256 reputationPos;
        uint256 reputationNeg;
        uint256 totalTrades;
        uint256 warnings;
        bool isBanned;
        DeliveryTimes deliveryInfo;
        uint256 totalTradesAsSeller; // NEW
        uint256 totalTradesAsBuyer; // NEW
    }

    event NewTrade(
        address indexed seller,
        address indexed buyer,
        bytes32 indexed refCode,
        PriceType priceType,
        uint256 value
    );

    function emitNewTrade(
        address seller,
        address buyer,
        bytes32 refCode,
        PriceType priceType,
        uint256 value
    ) external onlyTradeContracts(msg.sender) {
        ++users[seller].totalTradesAsSeller;
        ++users[buyer].totalTradesAsBuyer;
        emit NewTrade(seller, buyer, refCode, priceType, value);
    }

    struct DeliveryTimes {
        uint256 totalStarts;
        uint256 totalDeliveryTime;
        uint256 numberOfDeliveries;
        uint256 averageDeliveryTime;
    }

    mapping(address => User) public users;
    mapping(address => mapping(address => uint256)) UserToContractDeliveryStartTime;

    IKeepers public keepers;
    ITradeFactory public factory;

    constructor(address _keepers) {
        keepers = IKeepers(_keepers);
    }

    function setFactoryAddress(address _factoryAddress) external {
        require(keepers.isCouncil(msg.sender));
        factory = ITradeFactory(_factoryAddress);
    }

    modifier onlyFactory() {
        require(msg.sender == address(factory));
        _;
    }

    modifier onlyTradeContracts(address contractAddress) {
        require(
            msg.sender == contractAddress &&
                factory.isThisTradeContract(contractAddress),
            "not trade contract"
        );
        _;
    }

    modifier onlyKeepers() {
        require(
            keepers.indexOf(msg.sender) != 0 ||
                keepers.indexOf(tx.origin) != 0 ||
                keepers.isKeeperNode(msg.sender)
        );
        _;
    }

    function warnUser(address _user) public onlyKeepers {
        User storage user = users[_user];
        user.reputationNeg += 5;
        ++user.warnings;
        if (user.warnings >= 3) {
            user.isBanned = true;
        }
    }

    function banUser(address _user) public onlyKeepers {
        User storage user = users[_user];
        user.isBanned = true;
    }

    function unbanUser(address _user) public onlyKeepers {
        User storage user = users[_user];
        user.isBanned = false;
    }

    function getUserData(address user) external view returns (User memory) {
        return users[user];
    }

    function isBanned(address _user) external view returns (bool) {
        return users[_user].isBanned;
    }

    function _repAfterTrade(address _user, bool isPositive) private {
        User storage user = users[_user];
        if (isPositive) {
            ++user.reputationPos;
        } else {
            ++user.reputationNeg;
        }
    }

    function startDeliveryTimer(
        address contractAddress,
        address user
    ) external onlyTradeContracts(contractAddress) {
        UserToContractDeliveryStartTime[user][contractAddress] = block
            .timestamp;
        ++users[user].deliveryInfo.totalStarts;
    }

    function endDeliveryTimer(
        address contractAddress,
        address user
    ) external onlyTradeContracts(contractAddress) {
        uint256 deliveryTime = block.timestamp -
            UserToContractDeliveryStartTime[user][contractAddress];
        users[user].deliveryInfo.totalDeliveryTime += deliveryTime;
        ++users[user].deliveryInfo.numberOfDeliveries;
        users[user].deliveryInfo.averageDeliveryTime =
            users[user].deliveryInfo.totalDeliveryTime /
            users[user].deliveryInfo.numberOfDeliveries;
    }

    function getAverageDeliveryTime(
        address user
    ) external view returns (uint256) {
        return users[user].deliveryInfo.averageDeliveryTime;
    }
 

    //User to Trades
    mapping(address => UserInteraction[]) userTrades;
    mapping(address => mapping(address => uint256)) tradeAddrsToUserAddrsInteractionIndex;

    function addUserInteractionStatus(
        address tradeAddress,
        Role role,
        address userAddress,
        TradeStatus status
    ) external onlyTradeContracts(tradeAddress) {
        userTrades[userAddress].push(
            UserInteraction(tradeAddress, role, status)
        );
        tradeAddrsToUserAddrsInteractionIndex[tradeAddress][userAddress] =
            userTrades[userAddress].length -
            1;
    }

    function changeUserInteractionStatus(
        address tradeAddress,
        address userAddress,
        TradeStatus status
    ) external onlyTradeContracts(tradeAddress) {
        uint256 iIndex = tradeAddrsToUserAddrsInteractionIndex[tradeAddress][
            userAddress
        ];
        userTrades[userAddress][iIndex].status = status;
    }

    function getUserTotalTradeUIs(
        address userAddrss
    ) external view returns (uint256) {
        return userTrades[userAddrss].length;
    }

    function getUserTradeUIByIndex(
        address userAddrss,
        uint256 i
    ) external view returns (UserInteraction memory) {
        return userTrades[userAddrss][i];
    }

    function getUserTradeCountByStatus(
        address userAddress,
        TradeStatus status
    ) external view returns (uint256) {
        uint256 count;
        for (uint256 i = 0; i < userTrades[userAddress].length; ++i) {
            if (userTrades[userAddress][i].status == status) {
                ++count;
            }
        }
        return count;
    }

    function getUserTradeUIsByStatus(
        address userAddress,
        TradeStatus status,
        uint256 indexFrom,
        uint256 maxResults
    ) external view returns (UserInteraction[] memory) {
        UserInteraction[] memory tradeUIs = new UserInteraction[](maxResults);
        uint256 resultIndex;
        uint256 i = indexFrom;
        while (resultIndex < maxResults && i < userTrades[userAddress].length) {
            UserInteraction memory ui = userTrades[userAddress][i];

            if (ui.status == status) {
                tradeUIs[resultIndex] = ui;
                ++resultIndex;
            }

            ++i;
        }
        return tradeUIs;
    }

    mapping(address => mapping(Role => bool)) tradeAdrsToRoleToHasRep;

    function repAfterTrade(
        address tradeAddrs,
        bool isPositive
    ) external nonReentrant {
        require(tradeAddrs != address(0), "0 tradeAddrs");

        TradeInfo memory _tradeContract = factory.getTradeDetailsByAddress(
            tradeAddrs
        );

        require(
            _tradeContract.status >= TradeStatus.Completed,
            "tde !complete"
        );

        require(
            msg.sender == _tradeContract.buyer ||
                msg.sender == _tradeContract.seller,
            "!part of trade"
        );

        if (msg.sender == _tradeContract.buyer) {
            require(
                tradeAdrsToRoleToHasRep[tradeAddrs][Role.BUYER] == false,
                "alrdy rep as-b"
            );
            tradeAdrsToRoleToHasRep[tradeAddrs][Role.BUYER] = true;
            _repAfterTrade(_tradeContract.seller, isPositive);
        } else if (msg.sender == _tradeContract.seller) {
            require(
                tradeAdrsToRoleToHasRep[tradeAddrs][Role.SELLER] == false,
                "alrdy rep as-s"
            );
            tradeAdrsToRoleToHasRep[tradeAddrs][Role.SELLER] = true;
            _repAfterTrade(_tradeContract.buyer, isPositive);
        }
    }

    function hasMadeRepOnTrade(
        address tradeAddrs
    ) external view returns (bool hasBuyer, bool hasSeller, bool isTime) {
        TradeInfo memory _tradeContract = factory.getTradeDetailsByAddress(
            tradeAddrs
        );

        isTime = (_tradeContract.status >= TradeStatus.Completed);

        hasBuyer = tradeAdrsToRoleToHasRep[tradeAddrs][Role.BUYER];

        hasSeller = tradeAdrsToRoleToHasRep[tradeAddrs][Role.SELLER];
    }
}
