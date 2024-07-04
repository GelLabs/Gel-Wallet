import { PostMessage } from './message';
import { Metadata, MultipleRequestArgs, RequestArgs, ChainType } from './types/dapp.type';
import { Modal } from './ui/modal';
import { IModalConfig } from './ui/modal/types';
import logo from './assets/logo.png';
import { getMetadata } from './api/utils/common';
import { EvmProvider } from './provider/evm';
import { SolanaProvider } from './provider/solana';
import { PutProvider } from './provider/put';

export { ChainType };

export interface RequestParams {
	method: string;
	params: any;
}

interface Provider {
	put: PutProvider;
	solana: SolanaProvider;
	ethereum: EvmProvider;
}

export class Web3Kit {
	private static _instance: Web3Kit | undefined;
	private static userConf: Omit<IModalConfig, 'url'> = {};
	// @ts-expect-error - Singleton object
	private message: PostMessage;
	// @ts-expect-error - Singleton object
	private metadata: Metadata;
	ready: boolean = false;
	// @ts-expect-error - Singleton object
	readonly provider: Provider;
	constructor() {
		if (Web3Kit._instance) return Web3Kit._instance;
		const modal = new Modal({
			...Web3Kit.userConf,
			url: import.meta.env.VITE_APP_DID_DOMAIN
		});
		this.message = new PostMessage(modal);
		this.metadata = getMetadata();
		Web3Kit._instance = this;
		const putProvider = new PutProvider(this);
		const solanaProvider = new SolanaProvider(this);
		const ethereumProvider = new EvmProvider(this);
		this.provider = {
			put: putProvider,
			solana: solanaProvider,
			ethereum: ethereumProvider
		};

		if (Web3Kit.userConf.takeover?.put ?? true) {
			try {
				Object.defineProperty(globalThis, 'put', {
					value: putProvider,
					writable: false
				});
			} catch (err) {
				console.error(err);
			}
		}

		if (Web3Kit.userConf.takeover?.solana ?? true) {
			try {
				Object.defineProperty(globalThis, 'solana', {
					value: solanaProvider,
					writable: false
				});
			} catch (err) {
				console.error(err);
			}
		}

		if (Web3Kit.userConf.takeover?.ethereum ?? true) {
			try {
				Object.defineProperty(globalThis, 'ethereum', {
					value: ethereumProvider,
					writable: false
				});
			} catch (err) {
				console.error(err);
			}
		}
	}

	private static generateEvokingButton = () => {
		const btnEle = document.createElement('div');
		btnEle.style.cssText = `
      position: fixed;
      bottom: 15%;
      right: 0px;
      width: 58px;
      height: 40px;
      background-color: #fff;
      border-radius: 20px 0 0 20px;
      cursor: pointer;
      display: flex;
      justify-content: center;
      align-items: center;
      box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.10);
      border: 1px solid #E9EDF3;
      border-right: none;
      transition: all 0.3s;
      z-index: 999;
    `;
		btnEle.onmouseover = () => {
			btnEle.style.width = '68px';
			btnEle.style.backgroundColor = '#232323';
			btnEle.style.border = 'none';
		};
		btnEle.onmouseout = () => {
			btnEle.style.width = '58px';
			btnEle.style.backgroundColor = '#fff';
			btnEle.style.border = '1px solid #E9EDF3';
		};
		btnEle.innerHTML = `<img src="${logo}" style="width: 28px; height: 28px;" />`;
		btnEle.onclick = new Web3Kit().open;
		const body = document.body;
		body.appendChild(btnEle);
	};

	public static config = (userConf: Omit<IModalConfig, 'url'>) => {
		Web3Kit.userConf = userConf;
		if (!userConf.hideEvokingButton) {
			this.generateEvokingButton();
		}
	};

	public static clearInstance() {
		Web3Kit._instance = undefined;
	}

	public readonly open = () => this.message.modal.openModal();

	public readonly close = () => this.message.modal.closeModal();

	public readonly request = async <T = any>(data: RequestArgs<T>) => {
		return await this.message.send({
			...data,
			metadata: this.metadata
		});
	};

	public readonly multipleRequest = async (data: MultipleRequestArgs) => {
		const { events, chainType } = data;
		const promises = events.map(async event => {
			return await this.request({ ...event, chainType });
		});
		return Promise.all(promises);
	};

	public readonly on = <T = any>(eventName: string, callback: (value: T) => void) => {
		this.message.on(eventName, callback);
	};
	public readonly oauth = async ({ chainType }: { chainType: ChainType }) => {
		if (!Object.values(ChainType).includes(chainType)) {
			throw Error('chainType can only be one of Ethereum, PUT, and Solana');
		}
		return await this.request({
			chainType,
			methodName: 'oauth'
		});
	};
}

if (typeof window !== 'undefined') {
	globalThis['Web3Kit'] = Web3Kit;
}