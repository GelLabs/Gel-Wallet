export interface TronSendTransactionDTO {
	to: string;
	amount: string;
	privateKey: string;
	rpc: string;
}

export interface TronSendTokenDTO {
	from: string;
	to: string;
	amount: string;
	privateKey: string;
	tokenContract: string;
	rpc: string;
}

export interface EstimateEnergyCost {
	from: string;
	to: string;
	contractAddress: string;
	rpc: string;
	amount: string;
}

export interface AppKeys {
	[rpc: string]: string;
}
