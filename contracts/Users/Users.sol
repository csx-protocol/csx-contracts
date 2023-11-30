//SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {IKeepers} from "../Keepers/IKeepers.sol";
import {ITradeFactory, PriceType, UserInteraction, Role, TradeStatus, TradeInfo} from "../TradeFactory/ITradeFactory.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

error NotFactory();
error NotCouncil();
error NotTradeContract();
error NotKeepersOrTradeContract();
error TradeNotCompleted();
error AlreadyReppedAsBuyer();
error AlreadyReppedAsSeller();
error NotPartOfTrade();
error ZeroTradeAddress();
error AlreadyRepresentedAsBuyer();
error AlreadyRepresentedAsSeller();
error ZeroAddress();

contract Users is ReentrancyGuard {
    struct User {
        uint256 reputationPos;
        uint256 reputationNeg;
        uint256 totalTrades;
        uint256 warnings;
        bool isBanned;
        DeliveryTimes deliveryInfo;
        uint256 totalTradesAsSeller;
        uint256 totalTradesAsBuyer;
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
        if (_keepers == address(0)) {
            revert ZeroAddress();
        }
        keepers = IKeepers(_keepers);
    }

    /**
     * @notice Function to change the keepers and factory contracts
     * @dev This is used when the keepers or factory contracts are upgraded
     * @dev This function can only be called by a council member
     * @param _factoryAddress The address of the new factory contract
     * @param _keepers The address of the new keepers contract
     */
    function changeContracts(address _factoryAddress, address _keepers) external {
        if (!keepers.isCouncil(msg.sender)) {
            revert NotCouncil();
        }
        if (_factoryAddress == address(0)) {
            revert ZeroAddress();
        }
        if (_keepers == address(0)) {
            revert ZeroAddress();
        }
        factory = ITradeFactory(_factoryAddress);
        keepers = IKeepers(_keepers);
    }

    modifier onlyTradeContracts(address contractAddress) {
        if (
            msg.sender != contractAddress ||
            !factory.isThisTradeContract(contractAddress)
        ) {
            revert NotTradeContract();
        }
        _;
    }

    modifier onlyKeepersOrTradeContracts(address contractAddress) {
        // Check if the sender is a keeper
        bool isKeeperOrKeeperNode = keepers.isKeeper(msg.sender) || keepers.isKeeperNode(msg.sender);
        
        // Check if the sender is a trade contract
        bool isTradeContract = msg.sender == contractAddress && factory.isThisTradeContract(contractAddress);
        
        if (!isKeeperOrKeeperNode) {
            if(!isTradeContract){
                revert NotKeepersOrTradeContract();
            }
        }
        _;
    }

    /**
     * @notice Give user a warning
     * @dev This function can only be called by a keeper or a trade contract
     * @param _user The address of the user to warn
     */
    function warnUser(address _user) external onlyKeepersOrTradeContracts(msg.sender) {
        User storage user = users[_user];
        user.reputationNeg += 3;
        ++user.warnings;
        if (user.warnings >= 3) {
            user.isBanned = true;
        }
    }

    /**
     * @notice Ban a user
     * @dev This function can only be called by a keeper or a trade contract
     * @param _user The address of the user to ban
     */
    function banUser(address _user) external onlyKeepersOrTradeContracts(msg.sender) {
        User storage user = users[_user];
        user.isBanned = true;
    }

    /**
     * @notice Unban a user
     * @param _user The address of the user to unban
     * @dev This function can only be called by a keeper or a trade contract
     */
    function unbanUser(address _user) external onlyKeepersOrTradeContracts(msg.sender) {
        User storage user = users[_user];
        user.isBanned = false;
    }

    /**
     * @notice Get user data
     * @param user The address of the user
     * @return User struct
     */
    function getUserData(address user) external view returns (User memory) {
        return users[user];
    }

    /**
     * @notice Get if user is banned
     * @param _user The address of the user
     * @return true if user is banned, false otherwise
     */
    function isBanned(address _user) external view returns (bool) {
        return users[_user].isBanned;
    }

    /**
     * @notice Give reputation to a user
     * @param _user The address of the user to give reputation to
     * @param isPositive Whether the reputation is positive or negative
     */
    function _repAfterTrade(address _user, bool isPositive) private {
        User storage user = users[_user];
        if (isPositive) {
            ++user.reputationPos;
        } else {
            ++user.reputationNeg;
        }
    }

    /**
     * @notice Start delivery timer for a seller
     * @dev This function can only be called by a trade contract
     * @param contractAddress The address of the trade contract
     * @param user The address of the seller
     */
    function startDeliveryTimer(
        address contractAddress,
        address user
    ) external onlyTradeContracts(contractAddress) {
        UserToContractDeliveryStartTime[user][contractAddress] = block
            .timestamp;
        ++users[user].deliveryInfo.totalStarts;
    }

    /**
     * @notice End delivery timer for a seller
     * @dev This function can only be called by a trade contract
     * @param contractAddress The address of the trade contract
     * @param user The address of the seller
     */
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

    /**
     * @notice Get the average delivery time for a seller
     * @param user The address of the seller
     * @return Average delivery time
     */
    function getAverageDeliveryTime(
        address user
    ) external view returns (uint256) {
        return users[user].deliveryInfo.averageDeliveryTime;
    }

    //User to Trades
    mapping(address => UserInteraction[]) userTrades;
    mapping(address => mapping(address => uint256)) tradeAddrsToUserAddrsInteractionIndex;

    /**
     * @notice Add a trade to a user's interaction list
     * @dev This function can only be called by a trade contract
     * @param tradeAddress The address of the trade contract
     * @param role The role of the user in the trade
     * @param userAddress The address of the user
     * @param status The status of the trade
     */
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

    /**
     * @notice Change the status of a trade in a user's interaction list
     * @dev This function can only be called by a trade contract
     * @param tradeAddress The address of the trade contract
     * @param userAddress The address of the user
     * @param status The status of the trade
     */
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

    /**
     * @notice Get the total number of trades in a user's interaction list
     * @param userAddrss The address of the user
     * @return The total number of trades in a user's interaction list
     */
    function getUserTotalTradeUIs(
        address userAddrss
    ) external view returns (uint256) {
        return userTrades[userAddrss].length;
    }

    /**
     * @notice Get a trade in a user's interaction list by index
     * @param userAddrss The address of the user
     * @param i The index of the trade
     * @return UserInteraction struct
     */
    function getUserTradeUIByIndex(
        address userAddrss,
        uint256 i
    ) external view returns (UserInteraction memory) {
        return userTrades[userAddrss][i];
    }

    mapping(address => mapping(Role => bool)) tradeAdrsToRoleToHasRep;

    /**
     * @notice Give reputation to a user after a trade
     * @dev This function can only be called by buyer or seller of a trade contract
     * @param tradeAddrs The address of the trade contract
     * @param isPositive Whether the reputation is positive or negative
     */
    function repAfterTrade(
        address tradeAddrs,
        bool isPositive
    ) external nonReentrant {
        if (tradeAddrs == address(0)) {
            revert ZeroTradeAddress();
        }

        TradeInfo memory _tradeContract = factory.getTradeDetailsByAddress(
            tradeAddrs
        );

        if (_tradeContract.status < TradeStatus.Completed) {
            revert TradeNotCompleted();
        }

        if (msg.sender != _tradeContract.buyer) {
            if (msg.sender != _tradeContract.seller) {
                revert NotPartOfTrade();
            }
        }

        if (msg.sender == _tradeContract.buyer) {
            if (tradeAdrsToRoleToHasRep[tradeAddrs][Role.BUYER]) {
                revert AlreadyRepresentedAsBuyer();
            }
            tradeAdrsToRoleToHasRep[tradeAddrs][Role.BUYER] = true;
            _repAfterTrade(_tradeContract.seller, isPositive);
        } else if (msg.sender == _tradeContract.seller) {
            if (tradeAdrsToRoleToHasRep[tradeAddrs][Role.SELLER]) {
                revert AlreadyRepresentedAsSeller();
            }
            tradeAdrsToRoleToHasRep[tradeAddrs][Role.SELLER] = true;
            _repAfterTrade(_tradeContract.buyer, isPositive);
        }
    }

    /**
     * @notice Check if a user has given reputation to a trade
     * @param tradeAddrs The address of the trade contract
     * @return hasBuyer
     * @return hasSeller 
     * @return isTime 
     */
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

    mapping(string => mapping(address => address))
        public assetIdFromUserAddrssToTradeAddress;

    /**
     * @notice Remove an asset ID from a user's address mapping
     * @dev This function can only be called by a trade contract
     * @param _assetId The asset ID
     * @param sellerAddrss The address of the seller
     */
    function removeAssetIdUsed(
        string memory _assetId,
        address sellerAddrss
    ) external onlyTradeContracts(msg.sender) returns (bool) {
        assetIdFromUserAddrssToTradeAddress[_assetId][sellerAddrss] = address(0);
        return true;
    }

    /**
     * @notice Check if a user has already listed an item
     * @param _assetId The asset ID
     * @param sellerAddrss The address of the seller
     * @return true if the user has already listed an item, false otherwise
     */
    function hasAlreadyListedItem(
        string memory _assetId,
        address sellerAddrss
    ) external view returns (bool) {
        if (
            assetIdFromUserAddrssToTradeAddress[_assetId][sellerAddrss] ==
            address(0)
        ) {
            return false;
        } else {
            return true;
        }
    }

    /**
     * @notice Set the Asset Id used
     * @dev This function can only be called by the factory contract
     * @param _assetId The asset ID
     * @param sellerAddrss The address of the seller
     * @param tradeAddrss The address of the trade contract
     */
    function setAssetIdUsed(
        string memory _assetId,
        address sellerAddrss,
        address tradeAddrss
    ) external returns (bool) {
        if (msg.sender != address(factory)) {
            revert NotFactory();
        }
        assetIdFromUserAddrssToTradeAddress[_assetId][
            sellerAddrss
        ] = tradeAddrss;
        return true;
    }
}
