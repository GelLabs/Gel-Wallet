import {
  ed25519_getDerivedPrivateKey,
  jsonStringifyUniform,
  GenPrivateKeyError,
  NewAddressError,
  SignTxError,
  SendTxError,
  validSignedTransactionError,
  SignMsgError,
  EstimateTransferGasParams,
  EstimateTransferTokenGasParams,
  ITokenMetaData,
} from "@web3jskit/coin-base";
import { base, signUtil, bip39 } from "@web3jskit/crypto-lib";
import {
  Connection,
  Keypair,
  ParsedAccountData,
  PublicKey,
  RpcResponseAndContext,
  SimulatedTransactionResponse,
  SystemProgram,
  Transaction,
} from "@com.put/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAssociatedTokenAddress,
} from "@com.put/ppl-token";

export type TransactionType = "transfer" | "tokenTransfer";
export type PutSignParam = {
  type: TransactionType;
  payer: string;
  from: string;
  to: string;
  amount: string;
  mint?: string;
  blockhash?: string;
};

export async function requestRpc<T = any, P = any>(rpc: string, method: string, params?: P) {
  const result = await fetch(rpc, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: Math.floor(Math.random() * 100000),
      jsonrpc: "2.0",
      method,
      params: params || [],
    }),
  });
  const data = await result.json();
  return data.result as T;
}

export function getDerivedPath(index = 0) {
  return `m/44'/601'/${index}'/0'`;
}

export function validAddress(address: string): boolean {
  try {
    const array = base.fromBase58(address);
    return array.length == 32;
  } catch (e) {
    return false;
  }
}

export function checkPrivateKey(privateKey: string): boolean {
  try {
    const keyBytes = base.fromBase58(privateKey);
    return keyBytes.length == 64;
  } catch (error) {
    return false;
  }
}

export function checkMnemonic(mnemonic: string): boolean {
  return bip39.validateMnemonic(mnemonic);
}

// export function createWallet() {
//   const privateKey = ed25519_getRandomPrivateKey(true, "base58");
//   const publicKey = signUtil.ed25519.publicKeyCreate(base.fromBase58(privateKey));
//   return {
//     address: base.toBase58(publicKey),
//     publicKey,
//   };
// }

export async function createWallet(hdPath?: string) {
  try {
    const mnemonic = bip39.generateMnemonic();
    const privateKey = await getPrivateKeyByMnemonic(mnemonic, hdPath);
    const publicKey = signUtil.ed25519.publicKeyCreate(base.fromBase58(privateKey));
    return Promise.resolve({
      address: base.toBase58(publicKey),
      privateKey,
      mnemonic,
    });
  } catch (e) {
    return Promise.reject(e);
  }
}

export async function getAddressByPrivateKey(privateKey: string) {
  try {
    if (!checkPrivateKey(privateKey)) {
      return Promise.reject("Invalid private key");
    }
    const publicKey = signUtil.ed25519.publicKeyCreate(base.fromBase58(privateKey));
    return Promise.resolve(base.toBase58(publicKey));
  } catch (e) {
    return Promise.reject(e || NewAddressError);
  }
}

export async function getPrivateKeyByMnemonic(mnemonic: string, hdPath?: string) {
  try {
    if (!checkMnemonic(mnemonic)) {
      return Promise.reject("Invalid mnemonic");
    }
    hdPath = hdPath || getDerivedPath();
    const key = await ed25519_getDerivedPrivateKey(mnemonic, hdPath, true, "base58");
    return Promise.resolve(key);
  } catch (e) {
    return Promise.reject(e || GenPrivateKeyError);
  }
}

export async function getBalance(address: string, rpc: string) {
  try {
    const connection = new Connection(rpc);
    const balance = await connection.getBalance(new PublicKey(address));
    return Promise.resolve(balance.toString());
  } catch (error) {
    return Promise.reject(error);
  }
}

export async function getTokenBalance(address: string, tokenAddress: string, rpc: string) {
  try {
    const walletPublicKey = new PublicKey(address);
    const tokenPublicKey = new PublicKey(tokenAddress);
    const associatedAddress = await getAssociatedTokenAddress(tokenPublicKey, walletPublicKey);
    const connection = new Connection(rpc);
    const balance = await connection.getTokenAccountBalance(associatedAddress);
    return Promise.resolve(balance.value.amount);
  } catch (error) {
    return Promise.reject(error);
  }
}

export function signMessage(messageBase58: string, privateKey: string) {
  try {
    const message = base.fromBase58(messageBase58);
    const signature = signUtil.ed25519.sign(message, base.fromBase58(privateKey));
    return Promise.resolve(base.toBase58(signature));
  } catch (e) {
    return Promise.reject(e || SignMsgError);
  }
}

export async function signTransaction(data: PutSignParam, privateKey: string, rpc: string) {
  try {
    const feePayer = data.payer ? new PublicKey(data.payer) : null;
    const fromPubkey = data.from ? new PublicKey(data.from) : null;
    const toPubkey = data.to ? new PublicKey(data.to) : null;
    const amount = data.amount ? BigInt(data.amount) : null;
    if (!feePayer || !fromPubkey || !toPubkey || !amount) {
      return Promise.reject(SignTxError);
    }

    const connection = new Connection(rpc);
    let blockhash = data.blockhash;
    if (!blockhash) {
      blockhash = (await connection.getLatestBlockhash()).blockhash;
      if (!blockhash) return Promise.reject("get blockhash error");
    }

    const transaction = new Transaction({
      feePayer,
      recentBlockhash: blockhash,
    });
    if (data.type === "transfer") {
      transaction.add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports: amount,
        })
      );
    } else if (data.type === "tokenTransfer") {
      const mintPubkey = data.mint ? new PublicKey(data.mint) : null;
      if (!mintPubkey) return Promise.reject(SignTxError);

      const fromAssociatedToken = await getAssociatedTokenAddress(mintPubkey, fromPubkey);
      const toAssociatedToken = await getAssociatedTokenAddress(mintPubkey, toPubkey);

      if (!(await connection.getAccountInfo(toAssociatedToken, "confirmed"))) {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            fromPubkey,
            toAssociatedToken,
            toPubkey,
            mintPubkey
          )
        );
      }

      transaction.add(
        createTransferInstruction(fromAssociatedToken, toAssociatedToken, fromPubkey, amount)
      );
    } else {
      return Promise.reject(SignTxError);
    }

    if (!privateKey) {
      return Promise.resolve(base.toHex(transaction.serialize({ verifySignatures: false })));
    }

    transaction.sign(Keypair.fromSecretKey(base.fromBase58(privateKey)));
    if (!transaction.signature) {
      return Promise.reject(SignTxError);
    }
    return Promise.resolve(base.toBase58(transaction.serialize()));
  } catch (e) {
    return Promise.reject(e || SignTxError);
  }
}

export function signRawTransaction(rawTxBase58: string, privateKey: string) {
  try {
    const originTransaction = Transaction.from(base.fromBase58(rawTxBase58));
    const transaction = new Transaction({
      feePayer: originTransaction.feePayer,
      recentBlockhash: originTransaction.recentBlockhash,
      signatures: originTransaction.signatures,
      nonceInfo: originTransaction.nonceInfo,
    });
    originTransaction.instructions.forEach((ins) => transaction.add(ins));
    transaction.sign(Keypair.fromSecretKey(base.fromBase58(privateKey)));
    if (!transaction.signature) {
      return Promise.reject(SignTxError);
    }
    return Promise.resolve(base.toBase58(transaction.serialize()));
  } catch (e) {
    return Promise.reject(e || SignTxError);
  }
}

export async function sendRawTransaction(rawTxBase58: string, rpc: string) {
  try {
    const connection = new Connection(rpc);
    const signature = await connection.sendRawTransaction(base.fromBase58(rawTxBase58), {
      skipPreflight: true,
    });
    return Promise.resolve(signature);
  } catch (e) {
    return Promise.reject(e || SendTxError);
  }
}

export function validSignedTransaction(tx: string, skipCheckSign = false) {
  try {
    const transaction = Transaction.from(base.fromBase58(tx));
    const signature = transaction.signature!;
    const hash = transaction.serializeMessage();
    const publicKey = transaction.feePayer!.toBytes();
    if (!skipCheckSign && !signUtil.ed25519.verify(hash, signature, publicKey)) {
      throw Error("signature error");
    }
    return Promise.resolve(jsonStringifyUniform(transaction));
  } catch (e) {
    return Promise.reject(e || validSignedTransactionError);
  }
}

export function verifyMessage(messageBase58: string, signatureBase58: string, address: string) {
  try {
    const message = base.fromBase58(messageBase58);
    const signature = base.fromBase58(signatureBase58);
    const publicKey = base.fromBase58(address);
    const result = signUtil.ed25519.verify(message, signature, publicKey);
    return Promise.resolve(result);
  } catch (e) {
    return Promise.reject(e);
  }
}

export async function estimateGasByRawTx(rawTx: string, rpc: string): Promise<string> {
  try {
    const transaction = Transaction.from(base.fromBase58(rawTx));
    const connection = new Connection(rpc);
    const gasFee = await transaction.getEstimatedFee(connection);
    return Promise.resolve(gasFee.toString());
  } catch (e) {
    return Promise.reject(e);
  }
}

export async function estimateTransferGas(
  data: EstimateTransferGasParams,
  rpc: string
): Promise<string> {
  try {
    const fromPubkey = new PublicKey(data.from);
    const toPubkey = new PublicKey(data.to);
    const amount = BigInt(data.amount || 1);

    const connection = new Connection(rpc);
    const { blockhash } = await connection.getLatestBlockhash();
    if (!blockhash) {
      return Promise.reject("get blockhash error");
    }

    const transaction = new Transaction({
      feePayer: fromPubkey,
      recentBlockhash: blockhash,
    });
    transaction.add(
      SystemProgram.transfer({
        fromPubkey,
        toPubkey,
        lamports: amount,
      })
    );

    const gasFee = await transaction.getEstimatedFee(connection);
    return Promise.resolve(gasFee.toString());
  } catch (e) {
    return Promise.reject(e);
  }
}

export async function estimateTransferTokenGas(
  data: EstimateTransferTokenGasParams,
  rpc: string
): Promise<string> {
  try {
    const fromPubkey = new PublicKey(data.from);
    const toPubkey = new PublicKey(data.to);
    const mintPubkey = new PublicKey(data.token);
    const amount = BigInt(data.amount || 1);

    const connection = new Connection(rpc);
    const { blockhash } = await connection.getLatestBlockhash();
    if (!blockhash) {
      return Promise.reject("get blockhash error");
    }

    const fromAssociatedToken = await getAssociatedTokenAddress(mintPubkey, fromPubkey);
    const toAssociatedToken = await getAssociatedTokenAddress(mintPubkey, toPubkey);

    const transaction = new Transaction({
      feePayer: fromPubkey,
      recentBlockhash: blockhash,
    });

    if (!(await connection.getAccountInfo(toAssociatedToken, "confirmed"))) {
      transaction.add(
        createAssociatedTokenAccountInstruction(fromPubkey, toAssociatedToken, toPubkey, mintPubkey)
      );
    }

    transaction.add(
      createTransferInstruction(fromAssociatedToken, toAssociatedToken, fromPubkey, amount)
    );

    const gasFee = await transaction.getEstimatedFee(connection);
    return Promise.resolve(gasFee.toString());
  } catch (e) {
    return Promise.reject(e);
  }
}

export async function getTokenMetaData(tokenAddress: string, rpc: string): Promise<ITokenMetaData> {
  try {
    const tokenAccount = await requestRpc(rpc, "getAccountInfo", [
      tokenAddress,
      { encoding: "jsonParsed" },
    ]);
    const data = tokenAccount.value?.data as ParsedAccountData;
    const tokenInfo = data?.parsed?.info;
    if (!data || !tokenInfo) {
      return Promise.reject("token account not found");
    }
    return Promise.resolve({
      logo: tokenInfo.icon,
      name: tokenInfo.name,
      symbol: tokenInfo.symbol,
      decimals: tokenInfo.decimals,
      supply: tokenInfo.supply,
    });
  } catch (e) {
    return Promise.reject(e);
  }
}

function readBigUInt128LE(buffer: Buffer): bigint {
  const lower = buffer.readBigUInt64LE(0);
  const upper = buffer.readBigUInt64LE(8);
  return (upper << BigInt(64)) | lower;
}

export async function simulateTransaction(
  params: {
    transaction: string;
    accounts?: string[];
  },
  rpc: string
) {
  try {
    const result = await requestRpc<RpcResponseAndContext<SimulatedTransactionResponse>>(
      rpc,
      "simulateTransaction",
      [
        params.transaction,
        {
          accounts: params.accounts
            ? {
                addresses: params.accounts,
                encoding: "jsonParsed",
              }
            : void 0,
          encoding: "base58",
          replaceRecentBlockhash: true,
        },
      ]
    );

    const accounts = result.value?.accounts
      ? result.value.accounts.map((account) => {
          if (!account?.data?.[0]) return account;
          try {
            const dataBuf = Buffer.from(account.data[0], "base64");
            const mint = base.toBase58(dataBuf.slice(0, 32));
            const owner = base.toBase58(dataBuf.slice(32, 64));
            const amount = readBigUInt128LE(dataBuf.slice(64)).toString();
            return {
              ...account,
              data: {
                parsed: {
                  info: { mint, owner, amount },
                  type: "account",
                },
                program: "ppl-token",
                // @ts-ignore
                space: account?.space,
              },
            };
          } catch (error) {
            return account;
          }
        })
      : null;
    return Promise.resolve({
      ...result.value,
      accounts,
    });
  } catch (e) {
    return Promise.reject(e);
  }
}
