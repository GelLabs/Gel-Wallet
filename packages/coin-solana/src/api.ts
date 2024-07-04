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
	ITokenMetaData
} from '@web3jskit/coin-base';
import { base, bip39, signUtil } from '@web3jskit/crypto-lib';
import {
	Keypair,
	PublicKey,
	SystemProgram,
	Transaction,
	TransactionInstruction,
	TransactionMessage,
	VersionedTransaction,
	Connection
} from '@solana/web3.js';
import {
	createAssociatedTokenAccountInstruction,
	createTransferInstruction,
	getAssociatedTokenAddress
} from '@solana/spl-token';
import { transferNftBuilder, Metaplex } from '@metaplex-foundation/js';

export declare enum TokenStandard {
	NonFungible = 0,
	FungibleAsset = 1,
	Fungible = 2,
	NonFungibleEdition = 3,
	ProgrammableNonFungible = 4,
	ProgrammableNonFungibleEdition = 5
}

export type TransactionType = 'transfer' | 'tokenTransfer' | 'nftTransfer';
export type SolSignParam = {
	type: TransactionType;
	payer: string;
	from: string;
	to: string;
	amount: string;
	mint?: string;
	blockhash?: string;
	// 0-VersionedTransaction, 'legacy'-legacyTransaction
	version?: 0 | 'legacy';
	tokenStandard?: TokenStandard;
};

export async function requestRpc<T = any, P = any>(rpc: string, method: string, params?: P) {
	const result = await fetch(rpc, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			id: Math.floor(Math.random() * 100000),
			jsonrpc: '2.0',
			method,
			params: params || []
		})
	});
	const data = await result.json();
	return data.result as T;
}

export function getDerivedPath(index = 0) {
	return `m/44'/501'/${index}'/0'`;
}

export function validAddress(address: string) {
	try {
		const array = base.fromBase58(address);
		return array.length == 32;
	} catch (e) {
		return false;
	}
}

export function checkPrivateKey(privateKey: string) {
	try {
		const keyBytes = base.fromBase58(privateKey);
		return keyBytes.length == 64;
	} catch (error) {
		return false;
	}
}

export function checkMnemonic(mnemonic: string) {
	return bip39.validateMnemonic(mnemonic);
}

export function checkVersionedTransaction(tx: string) {
	try {
		VersionedTransaction.deserialize(base.fromBase58(tx));
		return true;
	} catch (e) {
		return false;
	}
}

// export function createWallet() {
//   const privateKey = ed25519_getRandomPrivateKey(true, "base58");
//   const publicKey = signUtil.ed25519.publicKeyCreate(base.fromBase58(privateKey));
//   return {
//     address: base.toBase58(publicKey),
//     publicKey: base.toBase58(publicKey),
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
			mnemonic
		});
	} catch (e) {
		return Promise.reject(e);
	}
}

export async function getAddressByPrivateKey(privateKey: string) {
	try {
		if (!checkPrivateKey(privateKey)) {
			return Promise.reject('Invalid private key');
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
			return Promise.reject('Invalid mnemonic');
		}
		hdPath = hdPath || getDerivedPath();
		const key = await ed25519_getDerivedPrivateKey(mnemonic, hdPath, true, 'base58');
		return Promise.resolve(key);
	} catch (e) {
		return Promise.reject(e || GenPrivateKeyError);
	}
}

export async function getBalance(address: string, rpc: string) {
	try {
		const connection = new Connection(rpc);
		const result = await connection.getBalance(new PublicKey(address));
		return Promise.resolve(result.toString());
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
		const result = await connection.getTokenAccountBalance(associatedAddress);
		return Promise.resolve(result.value.amount);
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

async function createAndSignVersionedTransaction(
	payerKey: PublicKey,
	blockHash: string,
	instructions: TransactionInstruction[],
	privateKey: string
) {
	const messageV0 = new TransactionMessage({
		payerKey,
		recentBlockhash: blockHash,
		instructions
	}).compileToV0Message();

	const transaction = new VersionedTransaction(messageV0);

	const keypair = Keypair.fromSecretKey(base.fromBase58(privateKey));
	transaction.sign([
		{
			publicKey: keypair.publicKey,
			secretKey: keypair.secretKey
		}
	]);

	if (!transaction.signatures.length) {
		return Promise.reject('sign error');
	}

	return Promise.resolve(base.toBase58(transaction.serialize()));
}

export async function signTransaction(data: SolSignParam, privateKey: string, rpc: string) {
	try {
		const feePayer = data.payer ? new PublicKey(data.payer) : null;
		const fromPubkey = data.from ? new PublicKey(data.from) : null;
		const toPubkey = data.to ? new PublicKey(data.to) : null;
		const amount = data.amount ? BigInt(data.amount) : null;
		if (!feePayer || !fromPubkey || !toPubkey) {
			return Promise.reject('Must provide payer, from and to address.');
		}

		const connection = new Connection(rpc);

		let blockhash = data.blockhash;
		let lastValidBlockHeight = 0;
		if (!blockhash) {
			const blockhashRes = await connection.getLatestBlockhash();
			if (!blockhashRes) return Promise.reject('get blockhash error');
			blockhash = blockhashRes.blockhash;
			lastValidBlockHeight = blockhashRes.lastValidBlockHeight;
		}

		const legacyTransaction = new Transaction({
			feePayer,
			blockhash,
			lastValidBlockHeight
		});
		if (data.type === 'transfer') {
			if (!amount) return Promise.reject('Must provide amount.');

			if (data.version === 0) {
				const instructions = [
					SystemProgram.transfer({
						fromPubkey,
						toPubkey,
						lamports: amount
					})
				];
				return createAndSignVersionedTransaction(feePayer, blockhash, instructions, privateKey);
			}

			legacyTransaction.add(
				SystemProgram.transfer({
					fromPubkey,
					toPubkey,
					lamports: amount
				})
			);
		} else if (data.type === 'tokenTransfer') {
			if (!amount) return Promise.reject('Must provide amount.');

			const mintPubkey = data.mint ? new PublicKey(data.mint) : null;
			if (!mintPubkey) {
				return Promise.reject('Must provide mint address');
			}
			const fromAssociatedToken = await getAssociatedTokenAddress(mintPubkey, fromPubkey);
			const toAssociatedToken = await getAssociatedTokenAddress(mintPubkey, toPubkey);
			let associatedIns;
			if (!(await connection.getAccountInfo(toAssociatedToken, 'confirmed'))) {
				associatedIns = createAssociatedTokenAccountInstruction(fromPubkey, toAssociatedToken, toPubkey, mintPubkey);
			}
			const transferIns = createTransferInstruction(fromAssociatedToken, toAssociatedToken, fromPubkey, amount);
			if (data.version === 0) {
				const instructions = [];
				if (associatedIns) instructions.push(associatedIns);

				instructions.push(transferIns);

				return createAndSignVersionedTransaction(feePayer, blockhash, instructions, privateKey);
			}

			if (associatedIns) legacyTransaction.add(associatedIns);
			legacyTransaction.add(transferIns);
		} else if (data.type === 'nftTransfer') {
			const mintPubkey = data.mint ? new PublicKey(data.mint) : null;
			if (!mintPubkey) {
				return Promise.reject('Must provide mint address');
			}
			const nft = {
				tokenStandard: data.tokenStandard || TokenStandard.ProgrammableNonFungible,
				address: mintPubkey
			};
			const authority = {
				publicKey: fromPubkey,
				secretKey: base.fromBase58(privateKey)
			};

			const builder = transferNftBuilder(Metaplex.make(connection), {
				nftOrSft: nft,
				authority,
				fromOwner: fromPubkey,
				toOwner: toPubkey
			});
			const transaction = builder.toTransaction({
				blockhash,
				lastValidBlockHeight
			});
			transaction.sign(authority);
			return Promise.resolve(base.toBase58(transaction.serialize()));
		} else {
			return Promise.reject(SignTxError);
		}

		if (!privateKey) {
			return Promise.resolve(base.toHex(legacyTransaction.serialize({ verifySignatures: false })));
		}
		legacyTransaction.sign(Keypair.fromSecretKey(base.fromBase58(privateKey)));
		if (!legacyTransaction.signature) {
			return Promise.reject(SignTxError);
		}
		return Promise.resolve(base.toBase58(legacyTransaction.serialize()));
	} catch (e) {
		return Promise.reject(SignTxError);
	}
}

export async function signRawTransaction(rawTxBase58: string, privateKey: string) {
	try {
		const version = checkVersionedTransaction(rawTxBase58);
		if (version) {
			const originTransaction = VersionedTransaction.deserialize(base.fromBase58(rawTxBase58));
			const transaction = new VersionedTransaction(originTransaction.message, originTransaction.signatures);
			const keypair = Keypair.fromSecretKey(base.fromBase58(privateKey));
			transaction.sign([
				{
					publicKey: keypair.publicKey,
					secretKey: keypair.secretKey
				}
			]);
			if (!transaction.signatures.length) {
				return Promise.reject(SignTxError);
			}
			return Promise.resolve(base.toBase58(transaction.serialize()));
		}

		const originTransaction = Transaction.from(base.fromBase58(rawTxBase58));
		const transaction = new Transaction({
			feePayer: originTransaction.feePayer,
			signatures: originTransaction.signatures,
			blockhash: originTransaction.recentBlockhash!,
			lastValidBlockHeight: originTransaction.lastValidBlockHeight!
		});
		originTransaction.instructions.forEach(ins => transaction.add(ins));
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
			skipPreflight: true
		});
		return Promise.resolve(signature);
	} catch (e) {
		return Promise.reject(e || SendTxError);
	}
}

export function validSignedTransaction(tx: string, skipCheckSign = false) {
	try {
		const version = checkVersionedTransaction(tx);
		if (version) {
			const transaction = VersionedTransaction.deserialize(base.fromBase58(tx));
			const signatures = transaction.signatures;
			const hash = transaction.message.serialize();
			const publicKey = transaction.message.getAccountKeys().get(0)?.toBytes();
			if (!skipCheckSign) {
				if (signatures.length === 0 || !publicKey) {
					throw Error('signature error');
				}
				const validResult = signatures.some(signature => signUtil.ed25519.verify(hash, signature, publicKey));
				if (!validResult) {
					throw Error('signature error');
				}
			}
			return Promise.resolve(jsonStringifyUniform(transaction));
		}

		const transaction = Transaction.from(base.fromBase58(tx));
		const signature = transaction.signature!;
		const hash = transaction.serializeMessage();
		const publicKey = transaction.feePayer!.toBytes();
		if (!skipCheckSign && !signUtil.ed25519.verify(hash, signature, publicKey)) {
			throw Error('signature error');
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

export async function estimateGasByRawTx(rawTxBase58: string, rpc: string): Promise<string> {
	try {
		const connection = new Connection(rpc);
		const version = checkVersionedTransaction(rawTxBase58);
		let gasFee: number | null;
		if (version) {
			const transaction = VersionedTransaction.deserialize(base.fromBase58(rawTxBase58));
			const result = await connection.getFeeForMessage(transaction.message);
			gasFee = result.value;
		} else {
			const transaction = Transaction.from(base.fromBase58(rawTxBase58));
			const result = await connection.getFeeForMessage(transaction.compileMessage());
			gasFee = result.value;
		}
		if (!gasFee) {
			return Promise.reject('Failed to get gas fee');
		}
		return Promise.resolve(String(gasFee));
	} catch (e) {
		return Promise.reject(e);
	}
}

export async function estimateTransferGas(data: EstimateTransferGasParams, rpc: string): Promise<string> {
	try {
		const fromPubkey = new PublicKey(data.from);
		const toPubkey = new PublicKey(data.to);
		const amount = BigInt(data.amount || 1);

		const connection = new Connection(rpc);
		const { blockhash } = await connection.getLatestBlockhash();
		if (!blockhash) {
			return Promise.reject('get blockhash error');
		}

		const instructions = [
			SystemProgram.transfer({
				fromPubkey,
				toPubkey,
				lamports: amount
			})
		];
		const messageV0 = new TransactionMessage({
			payerKey: fromPubkey,
			recentBlockhash: blockhash,
			instructions
		}).compileToV0Message();
		const { value } = await connection.getFeeForMessage(messageV0);
		if (!value) {
			return Promise.reject('Failed to get gas fee');
		}
		return Promise.resolve(String(value));
	} catch (error) {
		return Promise.reject(error);
	}
}

export async function estimateTransferTokenGas(data: EstimateTransferTokenGasParams, rpc: string): Promise<string> {
	try {
		const fromPubkey = new PublicKey(data.from);
		const toPubkey = new PublicKey(data.to);
		const tokenPubkey = new PublicKey(data.token);
		const amount = BigInt(data.amount || 1);

		const connection = new Connection(rpc);
		const { blockhash } = await connection.getLatestBlockhash();
		if (!blockhash) {
			return Promise.reject('get blockhash error');
		}

		const fromAssociatedToken = await getAssociatedTokenAddress(tokenPubkey, fromPubkey);
		const toAssociatedToken = await getAssociatedTokenAddress(tokenPubkey, toPubkey);
		const instructions = [];
		if (!(await connection.getAccountInfo(toAssociatedToken, 'confirmed'))) {
			const associatedIns = createAssociatedTokenAccountInstruction(
				fromPubkey,
				toAssociatedToken,
				toPubkey,
				tokenPubkey
			);
			instructions.push(associatedIns);
		}
		const transferIns = createTransferInstruction(fromAssociatedToken, toAssociatedToken, fromPubkey, amount);
		instructions.push(transferIns);
		const messageV0 = new TransactionMessage({
			payerKey: fromPubkey,
			recentBlockhash: blockhash,
			instructions
		}).compileToV0Message();
		const { value } = await connection.getFeeForMessage(messageV0);
		if (!value) {
			return Promise.reject('Failed to get gas fee');
		}
		return Promise.resolve(String(value));
	} catch (error) {
		return Promise.reject(error);
	}
}

export async function getTokenMetaData(tokenAddress: string, rpc: string): Promise<ITokenMetaData> {
	try {
		const connection = new Connection(rpc);
		const tokenInfo = await connection.getParsedAccountInfo(new PublicKey(tokenAddress));
		// @ts-expect-error -- type error
		const decimals: number = tokenInfo?.value?.data?.parsed?.info?.decimals;
		// @ts-expect-error -- type error
		const supply: string = tokenInfo?.value?.data?.parsed?.info?.supply;
		if (!decimals && !supply) return Promise.reject('Token not found');

		try {
			const metadata = await getNftMetaData(tokenAddress, rpc);
			return Promise.resolve({
				logo: metadata.json?.image,
				name: metadata.name,
				symbol: metadata.symbol,
				decimals,
				supply
			});
		} catch (error) {
			return Promise.resolve({
				decimals,
				supply
			});
		}
	} catch (error) {
		return Promise.reject(error);
	}
}

export async function getNftMetaData(nftAddress: string, rpc: string) {
	try {
		const connection = new Connection(rpc);
		const metaplex = Metaplex.make(connection);
		const nftPublicKey = new PublicKey(nftAddress);

		let metadata = await metaplex.nfts().findByMint({ mintAddress: nftPublicKey });
		if (metadata.uri && !metadata.json) {
			try {
				const uriRes = await fetch(metadata.uri);
				const json = await uriRes.json();
				metadata = {
					...metadata,
					json,
					jsonLoaded: true
				};
			} catch (error) {
				return Promise.resolve(metadata);
			}
		}
		return Promise.resolve(metadata);
	} catch (error) {
		return Promise.reject(error);
	}
}

export async function simulateTransaction(
	params: {
		transaction: string;
		accounts?: string[];
	},
	rpc: string
) {
	try {
		const result = await requestRpc(rpc, 'simulateTransaction', [
			params.transaction,
			{
				accounts: params.accounts
					? {
							addresses: params.accounts,
							encoding: 'jsonParsed'
						}
					: void 0,
				encoding: 'base58',
				replaceRecentBlockhash: true
			}
		]);
		return Promise.resolve(result.value);
	} catch (e) {
		return Promise.reject(e);
	}
}
