import * as putSdk from '@web3jskit/coin-put';
import * as ethSdk from '@web3jskit/coin-ethereum';
import * as solSdk from '@web3jskit/coin-solana';
import { EstimateTransferGasParams, EstimateTransferTokenGasParams } from '@web3jskit/coin-base';
import { ChainType } from './typing';
import * as tonSdk from '@web3jskit/ton';

export function requestRpc<T = any, P = any>(chainType: ChainType, rpc: string, method: string, params?: P) {
	switch (chainType) {
		case ChainType.PUT:
			return putSdk.requestRpc<T, P>(rpc, method, params);
		case ChainType.EVM:
			return ethSdk.requestRpc<T, P>(rpc, method, params);
		case ChainType.SOL:
			return solSdk.requestRpc<T, P>(rpc, method, params);
		default:
			throw new Error(`Unsupported chain type: ${chainType}`);
	}
}

export function getDerivedPath(chainType: ChainType, index = 0) {
	switch (chainType) {
		case ChainType.PUT:
			return putSdk.getDerivedPath(index);
		case ChainType.EVM:
			return ethSdk.getDerivedPath(index);
		case ChainType.SOL:
			return solSdk.getDerivedPath(index);
		default:
			throw new Error(`Unsupported chain type: ${chainType}`);
	}
}

export function validAddress(chainType: ChainType, address: string): boolean {
	switch (chainType) {
		case ChainType.PUT:
			return putSdk.validAddress(address);
		case ChainType.EVM:
			return ethSdk.validAddress(address);
		case ChainType.SOL:
			return solSdk.validAddress(address);
		case ChainType.TON:
		case ChainType.TON_TEST:
			return tonSdk.validAddress(address, chainType as any);
		default:
			throw new Error(`Unsupported chain type: ${chainType}`);
	}
}

export function checkPrivateKey(chainType: ChainType, privateKey: string): boolean {
	switch (chainType) {
		case ChainType.PUT:
			return putSdk.checkPrivateKey(privateKey);
		case ChainType.EVM:
			return ethSdk.checkPrivateKey(privateKey);
		case ChainType.SOL:
			return solSdk.checkPrivateKey(privateKey);
		default:
			throw new Error(`Unsupported chain type: ${chainType}`);
	}
}

export function checkMnemonic(chainType: ChainType, mnemonic: string): boolean {
	switch (chainType) {
		case ChainType.PUT:
			return putSdk.checkMnemonic(mnemonic);
		case ChainType.EVM:
			return ethSdk.checkMnemonic(mnemonic);
		case ChainType.SOL:
			return solSdk.checkMnemonic(mnemonic);
		default:
			throw new Error(`Unsupported chain type: ${chainType}`);
	}
}

export function createWallet(chainType: ChainType, hdPath?: string) {
	switch (chainType) {
		case ChainType.PUT:
			return putSdk.createWallet(hdPath);
		case ChainType.EVM:
			return ethSdk.createWallet(hdPath);
		case ChainType.SOL:
			return solSdk.createWallet(hdPath);
		default:
			throw new Error(`Unsupported chain type: ${chainType}`);
	}
}

export function getAddressByPrivateKey(chainType: ChainType, privateKey: string) {
	switch (chainType) {
		case ChainType.PUT:
			return putSdk.getAddressByPrivateKey(privateKey);
		case ChainType.EVM:
			return ethSdk.getAddressByPrivateKey(privateKey);
		case ChainType.SOL:
			return solSdk.getAddressByPrivateKey(privateKey);
		default:
			throw new Error(`Unsupported chain type: ${chainType}`);
	}
}

export function getPrivateKeyByMnemonic(chainType: ChainType, mnemonic: string, hdPath?: string) {
	switch (chainType) {
		case ChainType.PUT:
			return putSdk.getPrivateKeyByMnemonic(mnemonic, hdPath);
		case ChainType.EVM:
			return ethSdk.getPrivateKeyByMnemonic(mnemonic, hdPath);
		case ChainType.SOL:
			return solSdk.getPrivateKeyByMnemonic(mnemonic, hdPath);
		default:
			throw new Error(`Unsupported chain type: ${chainType}`);
	}
}

export function getBalance(chainType: ChainType, address: string, rpc: string) {
	switch (chainType) {
		case ChainType.PUT:
			return putSdk.getBalance(address, rpc);
		case ChainType.EVM:
			return ethSdk.getBalance(address, rpc);
		case ChainType.SOL:
			return solSdk.getBalance(address, rpc);
		default:
			throw new Error(`Unsupported chain type: ${chainType}`);
	}
}

export function getTokenBalance(chainType: ChainType, address: string, tokenAddress: string, rpc: string) {
	switch (chainType) {
		case ChainType.PUT:
			return putSdk.getTokenBalance(address, tokenAddress, rpc);
		case ChainType.EVM:
			return ethSdk.getTokenBalance(address, tokenAddress, rpc);
		case ChainType.SOL:
			return solSdk.getTokenBalance(address, tokenAddress, rpc);
		default:
			throw new Error(`Unsupported chain type: ${chainType}`);
	}
}

export function signRawTransaction(chainType: ChainType, rawTx: string, privateKey: string) {
	switch (chainType) {
		case ChainType.PUT:
			return putSdk.signRawTransaction(rawTx, privateKey);
		case ChainType.EVM:
			return ethSdk.signRawTransaction(rawTx, privateKey);
		case ChainType.SOL:
			return solSdk.signRawTransaction(rawTx, privateKey);
		default:
			throw new Error(`Unsupported chain type: ${chainType}`);
	}
}

export function sendRawTransaction(chainType: ChainType, rawTx: string, rpc: string) {
	switch (chainType) {
		case ChainType.PUT:
			return putSdk.sendRawTransaction(rawTx, rpc);
		case ChainType.EVM:
			return ethSdk.sendRawTransaction(rawTx, rpc);
		case ChainType.SOL:
			return solSdk.sendRawTransaction(rawTx, rpc);
		default:
			throw new Error(`Unsupported chain type: ${chainType}`);
	}
}

export function estimateGasByRawTx(chainType: ChainType, rawTx: string, rpc: string) {
	switch (chainType) {
		case ChainType.PUT:
			return putSdk.estimateGasByRawTx(rawTx, rpc);
		case ChainType.EVM:
			return ethSdk.estimateGasByRawTx(rawTx, rpc);
		case ChainType.SOL:
			return solSdk.estimateGasByRawTx(rawTx, rpc);
		default:
			throw new Error(`Unsupported chain type: ${chainType}`);
	}
}

export function estimateTransferGas(chainType: ChainType, data: EstimateTransferGasParams, rpc: string) {
	switch (chainType) {
		case ChainType.PUT:
			return putSdk.estimateTransferGas(data, rpc);
		case ChainType.EVM:
			return ethSdk.estimateTransferGas(data, rpc);
		case ChainType.SOL:
			return solSdk.estimateTransferGas(data, rpc);
		default:
			throw new Error(`Unsupported chain type: ${chainType}`);
	}
}

export function estimateTransferTokenGas(chainType: ChainType, data: EstimateTransferTokenGasParams, rpc: string) {
	switch (chainType) {
		case ChainType.PUT:
			return putSdk.estimateTransferTokenGas(data, rpc);
		case ChainType.EVM:
			return ethSdk.estimateTransferTokenGas(data, rpc);
		case ChainType.SOL:
			return solSdk.estimateTransferTokenGas(data, rpc);
		default:
			throw new Error(`Unsupported chain type: ${chainType}`);
	}
}

export function getTokenMetaData(chainType: ChainType, tokenAddress: string, rpc: string) {
	switch (chainType) {
		case ChainType.PUT:
			return putSdk.getTokenMetaData(tokenAddress, rpc);
		case ChainType.EVM:
			return ethSdk.getTokenMetaData(tokenAddress, rpc);
		case ChainType.SOL:
			return solSdk.getTokenMetaData(tokenAddress, rpc);
		default:
			throw new Error(`Unsupported chain type: ${chainType}`);
	}
}
