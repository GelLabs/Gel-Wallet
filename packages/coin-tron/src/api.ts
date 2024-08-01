// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import TronWeb from 'tronweb';
import { AppKeys, EstimateEnergyCost, TronSendTokenDTO, TronSendTransactionDTO } from './types';
import { getCurrentPrices } from './helper';

const SIGNATURE_LENGTH = 64;
const APP_KEYS: AppKeys = {};

export * from './types';

export { TronWeb };

export const setAppKeys = (keys: AppKeys) => {
	Object.keys(keys).forEach(rpc => {
		const appKey = keys[rpc];
		APP_KEYS[rpc] = appKey;
	});
};

const getTronWebInstance = (rpc: string, args: any) => {
	return new TronWeb({
		headers: { 'TRON-PRO-API-KEY': APP_KEYS[rpc] },
		...args
	});
};

export const removePrivateKeyPrefix = (privateKey: string) => {
	return privateKey.replace(/^0x/, '');
};

export async function requestRpc<T = any, P = any>(rpc: string, params?: P) {
	const result = await fetch(rpc, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'TRON-PRO-API-KEY': APP_KEYS[rpc]
		},
		body: JSON.stringify(params)
	});
	const data = await result.json();
	if (data.error) return Promise.reject(data.error);
	return data.result as T;
}

export function validAddress(address: string): boolean {
	return TronWeb.isAddress(address);
}

export function checkPrivateKey(privateKey: string): boolean {
	return !!TronWeb.address.fromPrivateKey(removePrivateKeyPrefix(privateKey));
}

export function checkMnemonic(mnemonic: string): boolean {
	return !!TronWeb.fromMnemonic(mnemonic);
}

export async function createWallet() {
	const { address, privateKey, mnemonic } = TronWeb.createRandom();
	return {
		address,
		privateKey: removePrivateKeyPrefix(privateKey),
		mnemonic: mnemonic.phrase
	};
}

export async function getBalance(address: string, rpc: string) {
	const tronWeb = getTronWebInstance(rpc, {
		fullHost: rpc
	});
	const res = await tronWeb.trx.getBalance(address);
	return res;
}
//
export async function getTokenBalance(address: string, tokenAddress: string, rpc: string) {
	const tronWeb = getTronWebInstance(rpc, {
		fullHost: rpc
	});
	const tokenContract = await tronWeb.contract().at(tokenAddress);
	const res = await tokenContract.methods.balanceOf(address).call({ from: address });
	return res.toString();
}

export function getAccountResources(address: string, rpc: string) {
	const tronWeb = getTronWebInstance(rpc, {
		fullHost: rpc
	});
	return tronWeb.trx.getAccountResources(address);
}

export async function getBandwidth(address: string, rpc: string) {
	const tronWeb = getTronWebInstance(rpc, {
		fullHost: rpc
	});
	return await tronWeb.trx.getBandwidth(address);
}

export async function getAccount(address: string, rpc: string) {
	const tronWeb = getTronWebInstance(rpc, {
		fullHost: rpc
	});
	return await tronWeb.trx.getAccount(address);
}

export function getAddressByPrivateKey(privateKey: string) {
	const address = TronWeb.address.fromPrivateKey(removePrivateKeyPrefix(privateKey));
	if (typeof address !== 'string') {
		throw Error('Invalid private key');
	}
	return address;
}

export function getPrivateKeyByMnemonic(mnemonic: string) {
	const res = TronWeb.fromMnemonic(mnemonic);
	return removePrivateKeyPrefix(res.privateKey);
}

export function sendTransaction({ to, amount, privateKey, rpc }: TronSendTransactionDTO) {
	const tronWeb = getTronWebInstance(rpc, {
		fullHost: rpc
	});
	return tronWeb.trx.sendTransaction(to, amount, removePrivateKeyPrefix(privateKey));
}

export async function sendToken({ to, amount, tokenContract, privateKey, rpc }: TronSendTokenDTO) {
	const tronWeb = getTronWebInstance(rpc, {
		fullHost: rpc,
		privateKey: removePrivateKeyPrefix(privateKey)
	});
	const functionSelector = 'transfer(address,uint256)';
	const parameter = [
		{ type: 'address', value: to },
		{ type: 'uint256', value: amount }
	];
	const tx = await tronWeb.transactionBuilder.triggerSmartContract(tokenContract, functionSelector, {}, parameter);
	const signedTx = await tronWeb.trx.sign(tx.transaction);
	const result = await tronWeb.trx.sendRawTransaction(signedTx);
	return result.txid;
}

export const getBandWidthPrice = async (rpc: string) => {
	const tronWeb = getTronWebInstance(rpc, {
		fullHost: rpc
	});
	const prices = await tronWeb.trx.getBandwidthPrices();
	return getCurrentPrices(prices);
};

export const getEnergyPrice = async (rpc: string) => {
	const tronWeb = getTronWebInstance(rpc, {
		fullHost: rpc
	});
	const prices = await tronWeb.trx.getEnergyPrices();
	return getCurrentPrices(prices);
};

export const estimateEnergyAndBandwidthCost = async ({
	contractAddress,
	rpc,
	from,
	to,
	amount
}: EstimateEnergyCost) => {
	const tronWeb = getTronWebInstance(rpc, {
		fullHost: rpc
	});
	const energyCostObject = {
		feeLimit: tronWeb.toSun('40000'),
		callValue: 0
	};

	const parameters = [
		{ type: 'address', value: tronWeb.address.toHex(from) },
		{ type: 'uint256', value: tronWeb.toHex(amount) }
	];
	let raw_data_hex = '';
	let energyUsed = 0;
	if (contractAddress) {
		const energyPromise = await tronWeb.transactionBuilder.triggerConstantContract(
			tronWeb.address.toHex(contractAddress, energyCostObject),
			'transfer(address,uint256)',
			energyCostObject,
			parameters,
			tronWeb.address.toHex(from)
		);
		energyUsed = energyPromise.energy_used;
		raw_data_hex = energyPromise.transaction.raw_data_hex;
	} else {
		const transaction = await tronWeb.transactionBuilder.sendTrx(to, amount, from);
		raw_data_hex = transaction.raw_data_hex;
	}
	const bandwidthUsed = 10 + 60 + TronWeb.utils.code.hexStr2byteArray(raw_data_hex).length + SIGNATURE_LENGTH;
	return {
		energyUsed,
		bandwidthUsed
	};
};

export const getTokenMetaData = async (from: string, tokenContract: string, rpc: string) => {
	const tronWeb = getTronWebInstance(rpc, {
		fullHost: rpc
	});
	const contract = await tronWeb.contract().at(tokenContract);
	const decimals = await contract.decimals().call({ from });
	const name = await contract.name().call({ from });
	const symbol = await contract.symbol().call({ from });
	return {
		decimals,
		name,
		symbol
	};
};

export const sign = (transaction: any, privateKey: string, rpc: string) => {
	const tronWeb = getTronWebInstance(rpc, {
		fullHost: rpc
	});
	return tronWeb.trx.sign(transaction, removePrivateKeyPrefix(privateKey));
};

export const sendRawTransaction = (signedTransaction: any, rpc: string) => {
	const tronWeb = getTronWebInstance(rpc, {
		fullHost: rpc
	});
	return tronWeb.trx.sendRawTransaction(signedTransaction);
};
