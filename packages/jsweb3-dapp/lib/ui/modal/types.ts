export interface IModalConfig {
	url: string;
	did?: {
		container?: HTMLDivElement;
		open?: () => void;
		close?: () => void;
	};
	loading?: {
		container?: Element;
		element?: Element;
		finished?: () => void;
	};
	hideEvokingButton?: boolean;
	takeover?: {
		put?: boolean;
		ethereum?: boolean;
		solana?: boolean;
	};
}
