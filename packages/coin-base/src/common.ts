export type EstimateGasParams =
	| {
			from: string;
			to: string;
			contract?: string;
			amount?: string;
	  }
	| string;

export interface EstimateTransferGasParams {
	from: string;
	to: string;
	amount?: string;
}

export interface EstimateTransferTokenGasParams {
	from: string;
	to: string;
	token: string;
	amount?: string;
}

export interface ITokenMetaData {
	logo?: string;
	name?: string;
	symbol?: string;
	decimals?: number;
	supply?: string;
}
