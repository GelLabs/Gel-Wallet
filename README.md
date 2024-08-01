# GelID

This is monorepo for GelID JavaScript SDK.

## Overview

- `@web3jskit/coin-ethereum`: SDK for manipulating `EVM-compatible blockchains` assets.
- `@web3jskit/coin-solana`: SDK for `Solana` chain assets.
- `@web3jskit/coin-put`: SDK for `PUT` chain assets.
- `@web3jskit/dapp`: SDK for DApp developers.

Most developers can directly use `@web3jskit/dapp` to complete most job. full [documentation](https://doc.gelwallet.com)

## Development

### Installation

```
npm install @web3jskit/dapp
```

### Access

```typescript
import { Web3Kit } from '@web3jskit/dapp';

Web3Kit.config();
async function connect() {
	// Initialized Web3Kit, used singletons, new Web3Kit() multiple times does not waste memory
	const web3Kit = new Web3Kit();
	const serRes: IConnectRes = await web3Kit.request({
		chainType: ChainType.EVM,
		methodName: 'connect'
	});
}

connect();
```
