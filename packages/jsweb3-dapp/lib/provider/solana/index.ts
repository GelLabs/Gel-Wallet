import { ChainType } from '@web3jskit/type';
import { RequestParams } from '../types';

export interface SignMessageParams {
	message: string; // the message, base58 encoded
	session: string; // token received from connect-method
	display: 'utf8' | 'hex'; // the encoding to use when displaying the message  'utf8' | 'hex'
}

export interface SignTransactionParams {
	session: string; // token received from connect-method
	transaction: string; // serialized transaction, base58 encoded
}

export interface SignAllTransactionsParams {
	transactions: string[]; // serialized transaction, bs58-encoded
	session: string; // token received from connect-method
}

export interface SignAndSendTransactionParams extends SignTransactionParams {}

export class SolanaProvider {
	private readonly web3Kit: any;

	constructor(web3Kit: any) {
		this.web3Kit = web3Kit;
	}
	request = ({ method, params }: RequestParams) => {
		return this.web3Kit.request({
			chainType: ChainType.SOL,
			methodName: method,
			params
		});
	};
	connect = () => {
		return this.request({
			method: 'sol_connect',
			params: {}
		});
	};
	disconnect = () => {
		return this.request({
			method: 'sol_disconnect',
			params: {}
		});
	};
	signMessage = (payload: SignMessageParams) => {
		const { message, display = 'utf8', session } = payload;
		return this.request({
			method: 'sol_signMessage',
			params: {
				message,
				display,
				session
			}
		});
	};

	signTransaction = async (payload: SignTransactionParams) => {
		const { transaction, session } = payload;
		return this.request({
			method: 'sol_signTransaction',
			params: {
				transaction,
				session
			}
		});
	};

	signAllTransactions = async (payload: SignAllTransactionsParams) => {
		const { transactions, session } = payload;
		return this.request({
			method: 'sol_signAllTransactions',
			params: {
				transactions,
				session
			}
		});
	};

	signAndSendTransaction = async (payload: SignAndSendTransactionParams) => {
		const { transaction, session } = payload;
		return this.request({
			method: 'sol_signAndSendTransaction',
			params: {
				transaction,
				session
			}
		});
	};
}
