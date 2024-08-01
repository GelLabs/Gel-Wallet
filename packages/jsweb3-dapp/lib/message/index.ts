import { v4 as randomUUID } from 'uuid';
import { PublicKey } from '@solana/web3.js';
import { Modal } from '../ui/modal';
import { Metadata } from '../types/dapp.type';
import { ChainType, DID_EVENT_NAME } from '@web3jskit/type';

interface SendArgs {
	chainType: ChainType;
	methodName: string;
	metadata: Metadata;
	params?: any;
}

interface PromiseMap {
	[messageId: string]: {
		resolve: (value: any) => void;
		reject: (reason?: any) => void;
	};
}

export enum MessageType {
	dappEvent = 'dapp_event',
	didEvent = 'did_event'
}

export { DID_EVENT_NAME };

export class PostMessage {
	private static _instance: PostMessage;
	static readonly DAPP_MESSAGE_TARGET = 'jsweb3-dapp';
	static readonly DID_MESSAGE_TARGET = 'jsweb3-did';
	static promiseMap: PromiseMap = {};
	// @ts-expect-error - Singleton object
	modal: Modal;
	eventListenerMap: { [eventName: string]: (value: any) => void } = {};

	constructor(modal: Modal) {
		if (PostMessage._instance) return PostMessage._instance;
		this.modal = modal;
		PostMessage._instance = this;
		window.addEventListener('message', this.receive, false);
	}

	private readonly receive = (msg: MessageEvent) => {
		const msgData = msg.data;
		if (msgData.target === PostMessage.DID_MESSAGE_TARGET) {
			if (msgData.type === MessageType.dappEvent && msgData.messageId) {
				const resolve = PostMessage.promiseMap[msgData.messageId]?.resolve;
				const reject = PostMessage.promiseMap[msgData.messageId]?.reject;
				if (msgData.status === 'success' && typeof resolve === 'function') {
					resolve(msgData.data);
				}
				if (msgData.status === 'fail' && typeof reject === 'function') {
					reject(msgData.data);
				}
			}
			if (msgData.type === MessageType.didEvent) {
				const eventName: DID_EVENT_NAME = msgData.eventName;
				const events = {
					[DID_EVENT_NAME.LOADED]: () => {
						this.modal.loaded();
					},
					[DID_EVENT_NAME.OPEN]: () => {
						this.modal.openModal();
					},
					[DID_EVENT_NAME.CLOSE]: () => {
						this.modal.closeModal();
					},
					[DID_EVENT_NAME.ACCOUNTS_CHANGED]: () => {
						const event = this.eventListenerMap.accountsChanged;
						if (typeof event !== 'function') return;

						const { account, connectedWebs } = msgData.data;
						if (!account) {
							event([]);
							return;
						}

						const currentWeb = connectedWebs?.find((web: any) => web.origin === window.location.origin);
						if (currentWeb) {
							const chainType = currentWeb?.net?.chainType;
							const connectAddress = account?.seriesWallets?.[chainType]?.walletAddress;
							if (!connectAddress) return;
							event([connectAddress]);
						}
					},
					[DID_EVENT_NAME.DISCONNECT]: () => {
						const event = this.eventListenerMap.accountsChanged;
						if (typeof event !== 'function') return;

						const { origin } = msgData.data;
						if (origin !== window.location.origin) return;
						event([]);
					},
					[DID_EVENT_NAME.CHAIN_CHANGED]: () => {
						const event = this.eventListenerMap.chainChanged;
						if (typeof event !== 'function') return;

						const { origin, net } = msgData.data;
						if (origin !== window.location.origin) return;
						event(net);
					},
					[DID_EVENT_NAME.TRON_SET_ACCOUNT]: () => {
						const event = this.eventListenerMap.tronSetAccount;
						if (typeof event !== 'function') return;
						event(msgData.data);
					},
					[DID_EVENT_NAME.TRON_SET_NODE]: () => {
						const event = this.eventListenerMap.tronSetNode;
						if (typeof event !== 'function') return;
						event(msgData.data);
					}
				};
				const event = events[eventName];
				typeof event === 'function' && event();
			}
		}
	};

	private readonly _generateResponse = async (message: {
		target: string;
		type: string;
		messageId: string;
		data: SendArgs;
	}) => {
		await this.modal.waitReady();
		const sdkWindow = await this.modal.getSDKWindow();
		return new Promise((resolve, reject) => {
			let confirmResponse = (data: any) => {
				resolve(data);
			};
			if (message.data.chainType === ChainType.SOL && message.data.methodName === 'connect') {
				confirmResponse = data => {
					console.log('data===>', data.publicKey);

					data.publicKey = new PublicKey(data.publicKey);
					resolve(data);
				};
			}
			PostMessage.promiseMap[message.messageId] = { resolve: confirmResponse, reject };
			sdkWindow.postMessage(message, '*');
		});
	};
	sendDidMsg = async (data: { methodName: string; metadata: Metadata; params?: any }) => {
		await this.modal.waitReady();
		const sdkWindow = await this.modal.getSDKWindow();
		const messageId = randomUUID();
		const message = {
			target: PostMessage.DAPP_MESSAGE_TARGET,
			type: MessageType.didEvent,
			messageId,
			data
		};
		return sdkWindow.postMessage(message, '*');
	};
	send = async (data: SendArgs) => {
		const messageId = randomUUID();
		const message = {
			target: PostMessage.DAPP_MESSAGE_TARGET,
			type: MessageType.dappEvent,
			messageId,
			data
		};

		return this._generateResponse(message);
	};
	on = (eventName: string, callback: (value: any) => void) => {
		this.eventListenerMap[eventName] = callback;
	};
}
