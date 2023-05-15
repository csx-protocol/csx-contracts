# csx-contracts

## Env
Create .env file in root with:

`
HEXKEY=''
RPCURL=''
`

## Development

Install dependencies via Yarn & Foundry:

```bash
yarn install

forge install
```

Setup Husky to format code on commit:

```bash
yarn prepare
```

Link local packages and install remaining dependencies via Lerna:

```bash
yarn run lerna bootstrap
```

Compile contracts via Hardhat and Foundry:

```bash
yarn run hardhat compile

forge build
```

Automatically upgrade dependencies with yarn-up:

```bash
yarn upgrade-dependencies
```

### Testing

Test contracts with Hardhat and generate gas report using `hardhat-gas-reporter`:

```bash
yarn run hardhat test

forge test
```

Generate a code coverage report using `solidity-coverage`:

```bash
yarn run hardhat coverage

forge coverage
```

### Publication

Publish packages via Lerna:

```bash
yarn lerna-publish
```

## Tests

`truffle test --network ganache`
