export interface TronNode {
	fullNode?: string;
	solidityNode?: string;
	eventServer?: string;
}

export interface TronAccount {
	address: string;
	name: string;
	type: number;
}
