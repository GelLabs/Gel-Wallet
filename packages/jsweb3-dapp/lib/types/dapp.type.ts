import { ChainType } from '@web3jskit/type';

export interface RequestArgs<T = any> {
	chainType: ChainType;
	methodName: string;
	params?: T;
}

export interface MultipleRequestArgs {
	chainType: ChainType;
	events: {
		methodName: string;
		params?: any;
	}[];
}

export interface Metadata {
	name: string;
	url: string;
	origin: string;
	icon: string;
}

export interface IDappConfig {
	did?: {
		container?: string;
		class?: string;
		style?: string;
	};
}

export interface RequestParams {
	method: string;
	params: any;
}
