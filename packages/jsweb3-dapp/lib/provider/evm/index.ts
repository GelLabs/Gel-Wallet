import { ChainType } from '@web3jskit/type';
import { RequestParams } from '../types';
export class EvmProvider {
	isMetaMask = true;
	chainId?: string;
	networkVersion?: string;
	selectedAddress: string | null = null;
	private readonly web3Kit: any;
	constructor(web3Kit: any) {
		this.web3Kit = web3Kit;
		this._bindMethodCallback();
		this._bindEventCallback();
	}
	enable = async () => {
		return this.request({
			method: 'eth_requestAccounts',
			params: undefined
		});
	};
	_bindEventCallback = () => {
		this.web3Kit.on('chainChanged', this._handleChainChanged);
		this.web3Kit.on('accountsChanged', this._handleAccountsChanged);
	};
	_bindMethodCallback = () => {
		this.web3Kit.on('eth_chainId', this._handleChainChanged);
		this.web3Kit.on('net_version', this._handleChainChanged);
		this.web3Kit.on('eth_requestAccounts', this._handleAccountsChanged);
	};
	_handleChainChanged = (chainId: string) => {
		this.chainId = chainId && `0x${parseInt(chainId).toString(16)}`;
		this.networkVersion = chainId && parseInt(chainId).toString();
	};
	_handleAccountsChanged = (account: string[]) => {
		this.selectedAddress = account?.[0];
	};
	request = (param: RequestParams): Promise<unknown> => {
		return this.web3Kit.request({
			chainType: ChainType.EVM,
			methodName: param.method,
			params: param.params
		});
	};
}
