import { BN } from '@web3jskit/crypto-lib';
import type { TransferBodyParams } from 'tonweb/dist/types/contract/token/ft/jetton-wallet';

export type TransferParams = {
	from: string;
	to: string;
	amount: string;
	gasFee?: string;
	tokenAddress?: string;
	privateKey?: string;
};

export type GetAddressInfoResponse = {
	'@type': 'raw.fullAccountState';
	balance: string | 0;
	code: string;
	data: string;
	last_transaction_id: {
		'@type': 'internal.transactionId';
		lt: string;
		hash: string;
	};
	block_id: {
		'@type': 'ton.blockIdExt';
		workchain: number;
		shard: string;
		seqno: number;
		root_hash: string;
		file_hash: string;
	};
	frozen_hash: string;
	sync_utime: number;
	'@extra': string;
	state: 'uninitialized' | 'active';
};

export interface IJettonTransferBodyParams extends TransferBodyParams {
	jettonAmount: BN;
}

export interface JettonMetadata {
	name: string;
	symbol: string;
	description?: string;
	decimals?: number | string;
	image?: string;
	image_data?: string;
	uri?: string;
}

export enum TonChainType {
	TON = 'TON',
	TON_TEST = 'TONTESTNET'
}
