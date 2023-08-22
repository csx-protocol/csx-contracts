const { expect } = require('chai');
const { BN, ether, expectRevert } = require('@openzeppelin/test-helpers');
const UserProfileLevel = artifacts.require('UserProfileLevel');
const CSXToken = artifacts.require('CSXToken'); // Replace this with your actual CSX token contract

contract('UserProfileLevel', function ([deployer, user1, user2]) {
    let userProfileLevelInstance;
    let csxTokenInstance;

    beforeEach(async () => {
        csxTokenInstance = await CSXToken.new({ from: deployer }); 
        userProfileLevelInstance = await UserProfileLevel.new(csxTokenInstance.address, { from: deployer });

        // Mint some tokens for user1 and user2 for testing purposes
        await csxTokenInstance.transfer(user1, ether('40000000'), { from: deployer });
        await csxTokenInstance.transfer(user2, ether('40000000'), { from: deployer });

        // Approve the UserProfileLevel contract to burn tokens from user1 and user2
        await csxTokenInstance.approve(userProfileLevelInstance.address, ether('40000000'), { from: user1 });
        await csxTokenInstance.approve(userProfileLevelInstance.address, ether('40000000'), { from: user2 });
    });

    describe('Level Up', () => {
        it('allows a user to level up', async () => {
            const tokenAmount = ether('10');
            const levelsToIncrease = 1;
            await userProfileLevelInstance.levelUp(tokenAmount, levelsToIncrease, { from: user1 });

            const userLevel = await userProfileLevelInstance.getUserLevel(user1);
            expect(userLevel).to.be.bignumber.equal(new BN(1), 'User should be level 1 after leveling up');
        });

        it('checks the cost of leveling up', async () => {
            const tokenAmount = ether('10');
            const levelsToIncrease = 1;
            await userProfileLevelInstance.levelUp(tokenAmount, levelsToIncrease, { from: user1 });

            const userLevel = await userProfileLevelInstance.getUserLevel(user1);
            const costForNextLevel = await userProfileLevelInstance.getCostForNextLevels(user1, 1);
            const expectedCost = await userProfileLevelInstance.getLevelUpCost(userLevel, 1);
            expect(costForNextLevel).to.be.bignumber.equal(expectedCost, 'Cost for next level should match the expected cost');
        });

        it('reverts when trying to level up with insufficient tokens', async () => {
            const tokenAmount = ether('0.1');
            const levelsToIncrease = 1;
            await expectRevert(
                userProfileLevelInstance.levelUp(tokenAmount, levelsToIncrease, { from: user1 }),
                'Not enough tokens sent to level up.'
            );
        });

        it('reverts when trying to level up with 0 levels', async () => {
            const tokenAmount = ether('10');
            const levelsToIncrease = 0;
            await expectRevert(
                userProfileLevelInstance.levelUp(tokenAmount, levelsToIncrease, { from: user1 }),
                'Number of levels must be greater than 0.'
            );

        });

        it('levels up a user from 0 to 100 all at once', async () => {
            const currentLevel = new BN('0');
            const targetLevel = new BN('100');
            const levelsToIncrease = targetLevel.sub(currentLevel);
        
            const totalTokenAmount = await userProfileLevelInstance.getLevelUpCost(currentLevel, levelsToIncrease);

            await csxTokenInstance.transfer(user1, totalTokenAmount, { from: deployer });
            await csxTokenInstance.approve(userProfileLevelInstance.address, totalTokenAmount, { from: user1 });
            await userProfileLevelInstance.levelUp(totalTokenAmount, levelsToIncrease, { from: user1 });
        
            const userLevel = await userProfileLevelInstance.getUserLevel(user1);
            expect(userLevel).to.be.bignumber.equal(targetLevel, 'User should be level 100 after leveling up');
            const user1Balance = await csxTokenInstance.balanceOf(user1);
            expect(user1Balance).to.be.bignumber.gte(new BN(0), 'User1 should have a non-negative token balance');
        });
              
        describe('User Data', () => {
            beforeEach(async () => {
                const tokenAmount = ether('15');
                const levelsToIncrease = 5;
                await userProfileLevelInstance.levelUp(tokenAmount, levelsToIncrease, { from: user1 });
            });

            it('returns the correct user data', async () => {
                const userData = await userProfileLevelInstance.getUserData(user1);
                const userLevel = new BN(userData[0].toString());
                const costForNextLevel = new BN(userData[1].toString());
                const costForNext5Levels = new BN(userData[2].toString());
                const costForNext10Levels = new BN(userData[3].toString());
            
                expect(userLevel).to.be.bignumber.equal(new BN(5), 'User should be level 5');
            
                const expectedCostForNextLevel = await userProfileLevelInstance.getLevelUpCost(userLevel, 1);
                const expectedCostForNext5Levels = await userProfileLevelInstance.getLevelUpCost(userLevel, 5);
                const expectedCostForNext10Levels = await userProfileLevelInstance.getLevelUpCost(userLevel, 10);
            
                expect(costForNextLevel).to.be.bignumber.equal(expectedCostForNextLevel, 'Cost for next level should match the expected cost');
                expect(costForNext5Levels).to.be.bignumber.equal(expectedCostForNext5Levels, 'Cost for next 5 levels should match the expected cost');
                expect(costForNext10Levels).to.be.bignumber.equal(expectedCostForNext10Levels, 'Cost for next 10 levels should match the expected cost');
            });
            
            
        });

        describe('Transfer Profile', () => {
            beforeEach(async () => {
                const tokenAmount = ether('15');
                const levelsToIncrease = 5;
                await userProfileLevelInstance.levelUp(tokenAmount, levelsToIncrease, { from: user1 });
            });

            it('transfers the user profile to another address', async () => {
                await userProfileLevelInstance.transferProfile(user2, { from: user1 });

                const user1Level = await userProfileLevelInstance.getUserLevel(user1);
                const user2Level = await userProfileLevelInstance.getUserLevel(user2);

                expect(user1Level).to.be.bignumber.equal(new BN(0), 'User1 should have zero levels after transferring profile');
                expect(user2Level).to.be.bignumber.equal(new BN(5), 'User2 should have 5 levels after receiving the transferred profile');
            });

            it('reverts when trying to transfer profile to an address with non-zero levels', async () => {
                const tokenAmount = ether('1');
                const levelsToIncrease = 1;
                await userProfileLevelInstance.levelUp(tokenAmount, levelsToIncrease, { from: user2 });

                await expectRevert(
                    userProfileLevelInstance.transferProfile(user2, { from: user1 }),
                    'The new address must have zero levels.'
                );
            });

            it('reverts when trying to transfer profile to the zero address', async () => {
                await expectRevert(
                    userProfileLevelInstance.transferProfile('0x0000000000000000000000000000000000000000', { from: user1 }),
                    'The new address cannot be the zero address.'
                );
            });

            it('reverts when trying to transfer profile to the same address as the sender', async () => {
                await expectRevert(
                    userProfileLevelInstance.transferProfile(user1, { from: user1 }),
                    'The new address must have zero levels.'
                );
            });
        });
    });
});