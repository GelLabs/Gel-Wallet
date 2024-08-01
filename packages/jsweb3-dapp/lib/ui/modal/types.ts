export enum LoginMode {
	PASSKEY = 'Passkey',
	PASSWORD = 'Password'
}

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
		tronLink?: boolean;
	};
	loginModes?: LoginMode[];
	height?: number | string;
	maxheight?: number | string;
	onLoad?: () => void;
}
