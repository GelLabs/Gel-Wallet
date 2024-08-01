// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import TronWeb from 'tronweb/dist/TronWeb';
import Utils from './utils';
import { TronNode, TronAccount } from './types';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import ProxiedProvider from './ProxiedProvider';
import { ChainType } from '@web3jskit/type';
import { RequestParams } from '../../types/dapp.type';
export class TronProvider {
	private readonly web3Kit: any;
	public tronWeb: TronWeb;
	private proxiedMethods: {
		setAddress?: (address: string) => void;
		sign?: (...params: unknown[]) => void;
	} = {
		setAddress: undefined,
		sign: undefined
	};

	constructor(web3Kit: any) {
		this.web3Kit = web3Kit;
		this._bindTronWeb();
		this._bindEvents();
		this._init();
	}
	private _bindTronWeb = () => {
		const fullNode = new ProxiedProvider();
		const solidityNode = new ProxiedProvider();
		const eventNode = new ProxiedProvider();
		const tronWeb = new TronWeb(fullNode, solidityNode, eventNode);

		this.proxiedMethods = {
			sign: tronWeb.trx.sign.bind(tronWeb),
			setAddress: tronWeb.setAddress.bind(tronWeb)
		};

		['setPrivateKey', 'setAddress', 'setFullNode', 'setSolidityNode', 'setEventServer'].forEach(method => {
			tronWeb[method] = () => new Error('Broearn Wallet has disabled this method');
		});

		tronWeb.trx.sign = this.sign;

		this.tronWeb = tronWeb;
		(window as any)['tronWeb'] = tronWeb;
	};
	private _bindEvents = () => {
		this.web3Kit.on('tronSetAccount', (account: TronAccount) => {
			this.setAddress(account);
		});

		this.web3Kit.on('tronSetNode', (node: TronNode) => {
			this.setNode(node);
		});
	};
	private _init = async () => {
		const initRes = (await this.request({
			method: 'tron_init',
			params: undefined
		})) as any;
		const { node, name, address, type } = initRes || {};
		if (node?.fullNode) this.setNode(node);
		if (address) this.setAddress({ name, address, type });
	};
	setNode(node: TronNode) {
		const tronWeb = this.tronWeb;
		node.fullNode && tronWeb['fullNode'].configure(node.fullNode);
		node.solidityNode && tronWeb['solidityNode'].configure(node.solidityNode);
		node.eventServer && tronWeb['eventServer'].configure(node.eventServer);
	}

	setAddress = (account: TronAccount) => {
		const { address, name, type } = account;
		const tronWeb = this.tronWeb;
		if (!tronWeb.isAddress(address)) {
			tronWeb.defaultAddress = {
				hex: false,
				base58: false
			};
			tronWeb.ready = false;
			return;
		}
		this.proxiedMethods.setAddress?.(address);
		tronWeb['defaultAddress'].name = name;
		tronWeb['defaultAddress'].type = type;
		tronWeb.ready = true;
	};
	sign = async (
		transaction: any,
		privateKey = false,
		useTronHeader = true,
		callback: false | ((err: unknown, data?: unknown) => void) = false
	): Promise<unknown> => {
		if (!callback) return Utils.injectPromise(this.sign.bind(this), transaction, privateKey, useTronHeader);
		if (privateKey) return this.proxiedMethods.sign?.(transaction, privateKey, useTronHeader, callback);

		if (!transaction) return callback('Invalid transaction provided');
		const tronWeb = this.tronWeb;
		if (!tronWeb.ready) return callback('User has not unlocked wallet');
		try {
			const tx = await this.request({
				method: 'tron_sign',
				params: {
					transaction,
					useTronHeader,
					input:
						typeof transaction === 'string'
							? transaction
							: transaction.__payload__ || transaction.raw_data.contract[0].parameter.value
				}
			});
			callback(null, tx);
		} catch (err) {
			callback(err);
		}
	};
	request = (param: RequestParams): Promise<unknown> => {
		return this.web3Kit.request({
			chainType: ChainType.Tron,
			methodName: param.method,
			params: param.params
		});
	};
}
