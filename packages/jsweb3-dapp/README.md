# @web3jskit/dapp

## Introduction

@web3jskit/dapp is an interface layer that communicates with Gel.Wallet. By integrating @web3jskit/dapp, web2 and web3 developers can easily use multi-chain wallets.

## Documentation

Full [documentation](https://doc.gelwallet.com/)

## Usage

```javascript
import { Web3Kit, ChainType } from "@web3jskit/dapp";

// Web3Kit uses a singleton, multiple instances of new Web3Kit() will not cause memory consumption

// Example of getting user balance
function example() {
  const web3Kit = new Web3Kit();
  web3Kit.request({
    chainType: ChainType.PUT,
    methodName: "connect",
  });
}

// Send Connect And SignMessage
function multiple() {
  const web3Kit = new Web3Kit();
  const response = await web3Kit.multipleRequest({
    chainType: ChainType.PUT,
    events: [
      {
        methodName: "connect",
      },
      {
        methodName: "signMessage",
        params: {
          message: "", // base58
          display: "utf8",
        },
      },
    ],
  });
}
```
