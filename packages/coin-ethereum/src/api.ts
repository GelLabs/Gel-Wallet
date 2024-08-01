import { abi, base, BigNumber, signUtil, bip32, bip39 } from '@web3jskit/crypto-lib';
import {
	privateToPublic,
	publicToAddress,
	sigUtil,
	TxData,
	AccessListEIP2930TxData,
	FeeMarketEIP1559TxData,
	TransactionFactory,
	ecdsaSign,
	makeSignature,
	recoverFromSignature,
	isValidAddress
} from './sdk';
import {
	EstimateTransferGasParams,
	EstimateTransferTokenGasParams,
	GenPrivateKeyError,
	jsonStringifyUniform,
	NewAddressError,
	SignTxError,
	validSignedTransactionError,
	ITokenMetaData
} from '@web3jskit/coin-base';
import { hashMessage, MessageTypes } from './message';
import { signTypedMessage, TypedDataUtils, typedSignatureHash } from 'eth-sig-util';
import { padWithZeroes } from './sdk/eth-sig-util';

export type EthEncryptedData = sigUtil.EthEncryptedData;

export type EthTxParams = {
	to?: string;
	value?: string;

	nonce?: string;

	contractAddress?: string;
	gasPrice?: string;
	gasLimit?: string;

	data?: string;
	// default chainId: eth mainnet
	chainId?: string;

	// Typed-Transaction features
	// 0: legacy transaction
	// 2：EIP-1559 transaction
	type?: number;

	// EIP-1559; Type 2
	maxPriorityFeePerGas?: string;
	maxFeePerGas?: string;
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
	if (data.error) return Promise.reject(data.error);
	return data.result as T;
}

export function getDerivedPath(index = 0) {
	return `m/44'/60'/0'/0/${index}`;
}

export function checkPrivateKey(privateKey: string) {
	try {
		const keyBytes = base.fromHex(privateKey);
		return keyBytes.length == 32;
	} catch (e) {
		return false;
	}
}

export function checkMnemonic(mnemonic: string) {
	return bip39.validateMnemonic(mnemonic);
}

export async function createWallet(hdPath?: string) {
	try {
		const mnemonic = bip39.generateMnemonic();
		const privateKey = await getPrivateKeyByMnemonic(mnemonic, hdPath);
		const publicKey = privateToPublic(base.fromHex(privateKey));
		const address = publicToAddress(publicKey);
		return Promise.resolve({
			address: base.toHex(address, true),
			privateKey,
			mnemonic
		});
	} catch (e) {
		return Promise.reject(e);
	}
}

export function getAddressByPrivateKey(privateKeyHex: string) {
	try {
		if (!checkPrivateKey(privateKeyHex)) {
			return Promise.reject('Invalid private key');
		}
		const publicKey = privateToPublic(base.fromHex(privateKeyHex));
		const address = publicToAddress(publicKey);
		return Promise.resolve(base.toHex(address, true));
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
		const seed = await bip39.mnemonicToSeed(mnemonic);
		const key = bip32.fromSeed(seed).derivePath(hdPath).privateKey;
		if (!key) return Promise.reject(GenPrivateKeyError);
		return Promise.resolve(base.toHex(key));
	} catch (e) {
		return Promise.reject(e || GenPrivateKeyError);
	}
}

export function validAddress(address: string) {
	return isValidAddress(address);
}

const hex2string = (hex: string) => {
	const formatHex = hex === '0x' ? '0x0' : hex;
	if (base.isHexString(formatHex)) {
		return base.fromBigIntHex(formatHex).toString(10);
	} else {
		return formatHex;
	}
};

export async function getBalance(address: string, rpc: string) {
	try {
		const balance = await requestRpc<string>(rpc, 'eth_getBalance', [address, 'latest']);
		return Promise.resolve(hex2string(balance));
	} catch (e) {
		return Promise.reject(e);
	}
}

export async function getTokenBalance(address: string, tokenAddress: string, rpc: string) {
	try {
		const data = {
			from: address,
			to: tokenAddress,
			data: `0x70a08231000000000000000000000000${address.slice(2)}`
		};
		const balance = await requestRpc<string>(rpc, 'eth_call', [data, 'latest']);
		return Promise.resolve(hex2string(balance));
	} catch (e) {
		return Promise.reject(e);
	}
}

function convert2HexString(data: string | number): string {
	let n: BigNumber;
	if (BigNumber.isBigNumber(data)) {
		n = data;
	} else {
		// number or string
		n = new BigNumber(data);
	}
	return base.toBigIntHex(n);
}

function convert2TxParam(data: EthTxParams): EthTxParams {
	const param = {
		to: data.to,
		// default: value = 0
		value: convert2HexString(data.value || 0),
		nonce: data?.nonce ? convert2HexString(data.nonce) : void 0,
		contractAddress: data.contractAddress,
		gasPrice: convert2HexString(data.gasPrice || 0),
		gasLimit: convert2HexString(data.gasLimit || 0),
		data: data.data,
		// default chainId: eth mainnet
		chainId: convert2HexString(data?.chainId || 1),
		type: data.type || 0,
		maxPriorityFeePerGas: convert2HexString(data.maxPriorityFeePerGas || 0),
		maxFeePerGas: convert2HexString(data.maxFeePerGas || 0)
	};
	return param;
}

function signTxData(txData: TxData | AccessListEIP2930TxData | FeeMarketEIP1559TxData, privateKeyHex: string) {
	if (!checkPrivateKey(privateKeyHex)) {
		throw new Error('Invalid private key');
	}
	const tx = TransactionFactory.fromTxData(txData);
	const privateKey = base.fromHex(privateKeyHex);
	const signedTx = tx.sign(privateKey);
	return base.toHex(signedTx.serialize(), true);
}

export function signTransaction(params: EthTxParams, privateKey: string) {
	try {
		const txParams = convert2TxParam(params);
		const chainId = txParams.chainId;
		const nonce = txParams.nonce;
		const type = txParams.type;

		let toAddress = txParams.to;
		const tokenAddress = txParams.contractAddress;
		let value = txParams.value;
		let data: string | undefined;
		if (tokenAddress) {
			data =
				txParams.data || '0x' + abi.ABI.simpleEncode('transfer(address,uint256)', toAddress, value).toString('hex');
			toAddress = tokenAddress;
			value = '0x0';
		} else {
			data = txParams.data;
		}
		if (type === 0 || type === 1) {
			const gasPrice = txParams.gasPrice;
			const txData = {
				nonce: nonce,
				gasPrice: gasPrice,
				gasLimit: txParams.gasLimit,
				to: toAddress,
				value: value,
				data: data,
				chainId: chainId,
				type: type
			};
			const signedTx = signTxData(txData, privateKey);
			return Promise.resolve(signedTx);
		} else if (type === 2) {
			// EIP-1559 transaction fee
			const txData = {
				nonce: nonce,
				gasLimit: txParams.gasLimit,
				to: toAddress,
				value: value,
				data: data,
				chainId: chainId,
				type: type,
				maxPriorityFeePerGas: txParams.maxPriorityFeePerGas,
				maxFeePerGas: txParams.maxFeePerGas
			};
			const signedTx = signTxData(txData, privateKey);
			return Promise.resolve(signedTx);
		}
		return Promise.reject(SignTxError);
	} catch (e) {
		return Promise.reject(e || SignTxError);
	}
}

export function validSignedTransaction(tx: string, chainId?: number, publicKey?: string) {
	try {
		const signedTx = TransactionFactory.fromSerializedData(base.fromHex(tx), chainId);
		const msgHash = signedTx.getMessageToSign(true);
		const rStr = padWithZeroes(base.toHex(signedTx.r!.toArrayLike(Buffer)), 64);
		const sStr = padWithZeroes(base.toHex(signedTx.s!.toArrayLike(Buffer)), 64);
		const rs = base.fromHex(rStr.concat(sStr));
		if (publicKey && !signUtil.secp256k1.verifyWithNoRecovery(msgHash, rs, base.fromHex(publicKey))) {
			throw new Error('signature error');
		}
		return Promise.resolve(jsonStringifyUniform(signedTx));
	} catch (e) {
		return Promise.reject(e || validSignedTransactionError);
	}
}

export function signRawTransaction(rawTx: string, privateKey: string) {
	try {
		const transaction = TransactionFactory.fromSerializedData(base.fromHex(rawTx));
		transaction.sign(base.fromHex(privateKey));
		return Promise.resolve(base.toHex(transaction.serialize()));
	} catch (e) {
		return Promise.reject(e || SignTxError);
	}
}

export async function sendRawTransaction(rawTx: string, rpc: string) {
	try {
		const hash = await requestRpc(rpc, 'eth_sendRawTransaction', [rawTx]);
		return Promise.resolve(hash);
	} catch (e) {
		return Promise.reject(e);
	}
}

export async function signMessage(messageType: MessageTypes, message: string, privateKeyHex?: string) {
	try {
		if (!privateKeyHex) {
			if (messageType == MessageTypes.TYPE_DATA_V1) {
				return typedSignatureHash(JSON.parse(message));
			} else if (messageType == MessageTypes.TYPE_DATA_V3) {
				return base.toHex(TypedDataUtils.sign(JSON.parse(message), false));
			} else if (messageType == MessageTypes.TYPE_DATA_V4) {
				return base.toHex(TypedDataUtils.sign(JSON.parse(message)));
			}
			return hashMessage(messageType, message);
		}
		const privateKey = base.fromHex(privateKeyHex);

		if (messageType == MessageTypes.TYPE_DATA_V1) {
			return signTypedMessage(privateKey, { data: JSON.parse(message) }, 'V1');
		} else if (messageType == MessageTypes.TYPE_DATA_V3) {
			return signTypedMessage(privateKey, { data: JSON.parse(message) }, 'V3');
		} else if (messageType == MessageTypes.TYPE_DATA_V4) {
			return signTypedMessage(privateKey, { data: JSON.parse(message) }, 'V4');
		}

		const msgHash = hashMessage(messageType, message);
		const { v, r, s } = ecdsaSign(base.fromHex(msgHash), privateKey);
		return makeSignature(v, r, s);
	} catch (e) {
		return Promise.reject(e);
	}
}

export function verifyMessage(messageType: MessageTypes, message: string, signatureHex: string, address: string) {
	const signature = base.fromHex(signatureHex);
	const [r, s, v] = [signature.slice(0, 32), signature.slice(32, 64), signature[64]];
	const msgHash = hashMessage(messageType, message);
	const publicKey = recoverFromSignature(base.fromHex(msgHash), v, r, s);
	return address.toLowerCase() === base.toHex(publicToAddress(publicKey), true).toLowerCase();
}

export const encrypt = sigUtil.encrypt;
export const decrypt = sigUtil.decrypt;

export async function estimateGas(
	data: {
		from?: string;
		to?: string;
		value?: string;
		input?: string;
		gas?: string;
		gasPrice?: string;
	},
	rpc: string
) {
	try {
		const gasFee = await requestRpc<string>(rpc, 'eth_estimateGas', [data, 'latest']);
		return Promise.resolve(hex2string(gasFee));
	} catch (e) {
		return Promise.reject(e);
	}
}

export async function estimateTransferGas(data: EstimateTransferGasParams, rpc: string): Promise<string> {
	try {
		const txData = {
			from: data.from,
			to: data.to,
			value: base.toBigIntHex(new BigNumber(data.amount || 0))
		};
		const gasFee = await requestRpc<string>(rpc, 'eth_estimateGas', [txData, 'latest']);
		return Promise.resolve(hex2string(gasFee));
	} catch (e) {
		return Promise.reject(e);
	}
}

export async function estimateTransferTokenGas(data: EstimateTransferTokenGasParams, rpc: string): Promise<string> {
	const amountHex = base.toBigIntHex(new BigNumber(data.amount || 0)).replace('0x', '');
	try {
		const txData = {
			from: data.from,
			to: data.token,
			data: `0xa9059cbb000000000000000000000000${data.to.slice(2)}${
				amountHex.length % 64 == 0 ? amountHex : '0'.repeat(64 - amountHex.length) + amountHex
			}`
		};
		const gasFee = await requestRpc<string>(rpc, 'eth_estimateGas', [txData, 'latest']);
		return Promise.resolve(hex2string(gasFee));
	} catch (e) {
		return Promise.reject(e);
	}
}

export async function getGasPrice(rpc: string) {
	try {
		const gasPrice = await requestRpc<string>(rpc, 'eth_gasPrice');
		return Promise.resolve(hex2string(gasPrice));
	} catch (e) {
		return Promise.reject(e);
	}
}

export async function getMaxPriorityFeePerGas(rpc: string) {
	try {
		const maxPriorityFeePerGas = await requestRpc<string>(rpc, 'eth_maxPriorityFeePerGas');
		return Promise.resolve(hex2string(maxPriorityFeePerGas));
	} catch (e) {
		return Promise.reject(e);
	}
}

const formatTokenName = (name: string) => {
	if (name.startsWith('0x')) name = name.slice(2);
	if (name.length < 64) return '';
	try {
		const nameBytes = base.fromHex(name);
		const length = parseInt(nameBytes.slice(32, 64).toString('hex'), 16);
		const nameStr = nameBytes.slice(64).toString();
		return nameStr.slice(0, length);
	} catch (error) {
		return '';
	}
};

export async function getTokenName(tokenAddress: string, rpc: string) {
	try {
		const nameHex = await requestRpc<string>(rpc, 'eth_call', [{ to: tokenAddress, data: '0x06fdde03' }, 'latest']);
		if (!nameHex || nameHex === '0x') return Promise.resolve('');
		return Promise.resolve(formatTokenName(nameHex));
	} catch (e) {
		return Promise.reject(e);
	}
}

export async function getTokenSymbol(tokenAddress: string, rpc: string) {
	try {
		const symbolHex = await requestRpc<string>(rpc, 'eth_call', [{ to: tokenAddress, data: '0x95d89b41' }, 'latest']);
		if (!symbolHex || symbolHex === '0x') return Promise.resolve('');
		return Promise.resolve(formatTokenName(symbolHex));
	} catch (e) {
		return Promise.reject(e);
	}
}

export async function getTokenDecimals(tokenAddress: string, rpc: string) {
	try {
		const decimals = await requestRpc<string>(rpc, 'eth_call', [{ to: tokenAddress, data: '0x313ce567' }, 'latest']);
		if (!decimals || decimals === '0x') return Promise.resolve(0);
		return Promise.resolve(Number(decimals));
	} catch (e) {
		return Promise.reject(e);
	}
}

export async function getTokenTotalSupply(tokenAddress: string, rpc: string) {
	try {
		const totalSupply = await requestRpc<string>(rpc, 'eth_call', [{ to: tokenAddress, data: '0x18160ddd' }, 'latest']);
		if (!totalSupply || totalSupply === '0x') return Promise.resolve('');
		return Promise.resolve(hex2string(totalSupply));
	} catch (e) {
		return Promise.reject(e);
	}
}

export async function getTokenMetaData(tokenAddress: string, rpc: string): Promise<ITokenMetaData> {
	try {
		const [name, symbol, decimals, totalSupply] = await Promise.all([
			getTokenName(tokenAddress, rpc),
			getTokenSymbol(tokenAddress, rpc),
			getTokenDecimals(tokenAddress, rpc),
			getTokenTotalSupply(tokenAddress, rpc)
		]);
		if (!name && !symbol && !decimals && !totalSupply) {
			return Promise.reject('Token not found');
		}
		return Promise.resolve({
			name,
			symbol,
			decimals,
			supply: totalSupply
		});
	} catch (e) {
		return Promise.reject(e);
	}
}
