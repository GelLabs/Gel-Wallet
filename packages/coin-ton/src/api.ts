import { GenPrivateKeyError, NewAddressError } from '@web3jskit/coin-base';
import { base, signUtil } from '@web3jskit/crypto-lib';
import TonWeb from 'tonweb';
import { Address, JettonMaster, JettonWallet, TonClient, WalletContractV4, SendMode } from '@ton/ton';
import { mnemonicNew, mnemonicToPrivateKey, mnemonicValidate } from '@ton/crypto';
import { TRANSFER_TIMEOUT_SEC, fetchJettonOffchainMetadata, parseJettonOnchainMetadata, readSnakeBytes } from './utils';
import { IJettonTransferBodyParams, JettonMetadata, TonChainType, TransferParams } from './types';
import { OFFCHAIN_CONTENT_PREFIX, TOKEN_TRANSFER_TONCOIN_AMOUNT } from './constants';

export async function createWallet(testOnly: boolean) {
	try {
		// Generate new key
		const mnemonic = await mnemonicNew();
		const keyPair = await mnemonicToPrivateKey(mnemonic);

		// Create wallet contract
		const workchain = 0; // Usually you need a workchain 0
		const wallet = WalletContractV4.create({ workchain, publicKey: keyPair.publicKey });
		const address = wallet.address;

		const privateKey = keyPair.secretKey;
		return Promise.resolve({
			address: address.toString({ bounceable: false, testOnly }),
			privateKey: base.toBase58(privateKey),
			mnemonic: mnemonic.join(' '),
			publicKey: keyPair.publicKey
		});
	} catch (e) {
		return Promise.reject(e);
	}
}

export async function getAddressByPrivateKey(privateKey: string, testOnly: boolean) {
	try {
		if (!checkPrivateKey(privateKey)) {
			return Promise.reject('Invalid private key');
		}
		const publicKey = signUtil.ed25519.publicKeyCreate(base.fromBase58(privateKey));
		const workchain = 0; // Usually you need a workchain 0
		const wallet = WalletContractV4.create({ workchain, publicKey: Buffer.from(publicKey) });
		const address = wallet.address.toString({ bounceable: false, testOnly });
		return Promise.resolve({
			address,
			publicKey
		});
	} catch (e) {
		return Promise.reject(e || NewAddressError);
	}
}

export async function getPrivateKeyByMnemonic(mnemonic: string) {
	try {
		if (!checkMnemonic(mnemonic)) {
			return Promise.reject('Invalid mnemonic');
		}
		const key = await mnemonicToPrivateKey(mnemonic.split(' '));
		const privateKey = base.toBase58(key.secretKey);
		return Promise.resolve(privateKey);
	} catch (e) {
		return Promise.reject(e || GenPrivateKeyError);
	}
}

export function checkPrivateKey(privateKey: string) {
	try {
		const keyBytes = base.fromBase58(privateKey);
		return keyBytes.length == 64;
	} catch (error) {
		return false;
	}
}

export function checkMnemonic(mnemonic: string) {
	return mnemonicValidate(mnemonic.split(' '));
}

export async function getBalance(props: { address: string; endpoint: string; appKey?: string }) {
	const { address, endpoint, appKey } = props;
	try {
		const client = new TonClient({
			endpoint,
			apiKey: appKey
		});
		const balance = await client.getBalance(Address.parse(address));
		return Promise.resolve(balance.toString());
	} catch (error) {
		return Promise.reject(error);
	}
}

export async function getTokenBalance(props: {
	address: string;
	tokenAddress: string;
	endpoint: string;
	appKey?: string;
}) {
	const { address, tokenAddress, endpoint, appKey } = props;
	try {
		const client = new TonClient({
			endpoint,
			apiKey: appKey
		});
		const jettonMasterAddress = Address.parse(tokenAddress);
		const userAddress = Address.parse(address);

		const jettonMaster = client.open(JettonMaster.create(jettonMasterAddress));
		const jettonWalletAddress = await jettonMaster.getWalletAddress(userAddress);

		const jettonWallet = client.open(JettonWallet.create(jettonWalletAddress));

		const balance = await jettonWallet.getBalance();

		return Promise.resolve(balance.toString());
	} catch (error) {
		return Promise.reject(error);
	}
}

type EstimateTransferGasResult = Promise<{
	fee: string;
}>;

export async function estimateTransferGas(props: {
	data: TransferParams;
	endpoint: string;
	testOnly: boolean;
	appKey?: string;
}): EstimateTransferGasResult {
	const { data, endpoint, testOnly, appKey } = props;
	const fromAddress = data.from;
	let toAddress = data.to;
	const amount = data.amount;
	const tonweb = new TonWeb(new TonWeb.HttpProvider(endpoint, { apiKey: appKey }));
	const info = await tonweb.provider.getAddressInfo(toAddress);
	if (info.state !== 'active') {
		toAddress = new TonWeb.utils.Address(toAddress).toString(true, true, false, testOnly); // convert to non-bounce
	}
	const WalletClass = tonweb.wallet.all.v4R2;
	const senderWallet = new WalletClass(tonweb.provider, { address: fromAddress });
	const seqno = (await senderWallet.methods.seqno().call()) || 0; // call get-method `seqno` of wallet smart contract

	let totalFee = '0';
	if (!data.tokenAddress) {
		const { balance } = await tonweb.provider.getWalletInfo(fromAddress);
		const isFullTonBalance = balance === amount;
		const transfer = senderWallet.methods.transfer({
			secretKey: Buffer.from(new Uint8Array(64)),
			toAddress: toAddress,
			amount: data.amount,
			seqno,
			sendMode: isFullTonBalance
				? SendMode.CARRY_ALL_REMAINING_BALANCE
				: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS
		});
		const { source_fees: fees } = await transfer.estimateFee();

		totalFee = BigInt(fees.in_fwd_fee + fees.storage_fee + fees.gas_fee + fees.fwd_fee).toString();
	} else {
		// Jetton Transfer

		const jettonMinter = new TonWeb.token.jetton.JettonMinter(tonweb.provider, {
			address: data.tokenAddress,
			adminAddress: new TonWeb.utils.Address(fromAddress),
			jettonContentUri: '',
			jettonWalletCodeHex: ''
		});
		const jettonSenderAddress = await jettonMinter.getJettonWalletAddress(new TonWeb.utils.Address(fromAddress));
		// const jettonReceiverAddress = await jettonMinter.getJettonWalletAddress(new TonWeb.utils.Address(toAddress));
		const jettonWallet = new TonWeb.token.ft.JettonWallet(tonweb.provider, {
			address: jettonSenderAddress
		});
		const transferBody = await jettonWallet.createTransferBody({
			queryId: seqno,
			jettonAmount: new TonWeb.utils.BN(amount),
			toAddress: new TonWeb.utils.Address(toAddress),
			responseAddress: new TonWeb.utils.Address(fromAddress)
		} as IJettonTransferBodyParams);
		const transfer = await senderWallet.methods.transfer({
			secretKey: Buffer.from(new Uint8Array(64)),
			toAddress: jettonSenderAddress,
			seqno,
			amount: TOKEN_TRANSFER_TONCOIN_AMOUNT.toString(),
			sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
			payload: transferBody
		});
		const { source_fees: fees } = await transfer.estimateFee();

		totalFee = BigInt(fees.in_fwd_fee + fees.storage_fee + fees.gas_fee + fees.fwd_fee).toString();
	}
	return {
		fee: totalFee.toString()
	};
}

export async function submitTransfer(props: {
	data: TransferParams;
	endpoint: string;
	testOnly: boolean;
	appKey?: string;
}) {
	const { data, endpoint, testOnly, appKey } = props;
	if (!data.privateKey) {
		throw new Error('Params Invalid');
	}
	const { address: PKAddr } = await getAddressByPrivateKey(data.privateKey, testOnly);
	const fromAddress = data.from;
	if (fromAddress !== PKAddr) {
		throw new Error('private key not match sender address');
	}

	let toAddress = data.to;
	const amount = data.amount;
	const tonweb = new TonWeb(new TonWeb.HttpProvider(endpoint, { apiKey: appKey }));
	const info = await tonweb.provider.getAddressInfo(toAddress);
	if (info.state !== 'active') {
		toAddress = new TonWeb.utils.Address(toAddress).toString(true, true, false, testOnly); // convert to non-bounce
	}

	const WalletClass = tonweb.wallet.all.v4R2;
	const senderWallet = new WalletClass(tonweb.provider, { address: fromAddress });

	const seqno = (await senderWallet.methods.seqno().call()) || 0; // call get-method `seqno` of wallet smart contract

	const expireAt = Math.round(Date.now() / 1000) + TRANSFER_TIMEOUT_SEC;
	if (!data.tokenAddress) {
		// ton transfer
		const { balance } = await tonweb.provider.getWalletInfo(fromAddress);

		const isFullTonBalance = balance === amount;
		const transfer = senderWallet.methods.transfer({
			secretKey: Buffer.from(base.fromBase58(data.privateKey)),
			toAddress: toAddress,
			amount: amount,
			seqno,
			sendMode: isFullTonBalance
				? SendMode.CARRY_ALL_REMAINING_BALANCE
				: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
			expireAt
		});
		await transfer.send();
	} else {
		// Jetton Transfer
		// const jettonMinterData = await tonweb.provider.call2(data.tokenAddress, 'get_jetton_data');
		// const adminAddress = parseAddress(jettonMinterData[2]);

		// if (!adminAddress) {
		// 	throw new Error('Network error');
		// }

		const jettonMinter = new TonWeb.token.jetton.JettonMinter(tonweb.provider, {
			address: data.tokenAddress,
			adminAddress: new TonWeb.utils.Address(fromAddress),
			jettonContentUri: '',
			jettonWalletCodeHex: ''
		});
		const jettonSenderAddress = await jettonMinter.getJettonWalletAddress(new TonWeb.utils.Address(fromAddress));
		const jettonWallet = new TonWeb.token.ft.JettonWallet(tonweb.provider, {
			address: jettonSenderAddress
		});

		const transferBody = await jettonWallet.createTransferBody({
			queryId: seqno,
			jettonAmount: new TonWeb.utils.BN(amount),
			toAddress: new TonWeb.utils.Address(toAddress),
			responseAddress: new TonWeb.utils.Address(fromAddress)
		} as IJettonTransferBodyParams);

		await senderWallet.methods
			.transfer({
				secretKey: Buffer.from(base.fromBase58(data.privateKey)),
				toAddress: jettonSenderAddress,
				seqno,
				amount: (data.gasFee || TOKEN_TRANSFER_TONCOIN_AMOUNT).toString(),
				sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
				expireAt,
				payload: transferBody
			})
			.send();
	}
}

export async function getTokenMetaData(props: {
	tokenAddress: string;
	endpoint: string;
	serverUrl: string;
	appKey?: string;
}): Promise<JettonMetadata> {
	const { endpoint, tokenAddress, appKey, serverUrl } = props;
	const contract = new TonClient({
		endpoint,
		apiKey: appKey
	}).open(new JettonMaster(Address.parse(tokenAddress)));

	const { content } = await contract.getJettonData();
	let metadata: JettonMetadata;

	const slice = content.asSlice();
	const prefix = slice.loadUint(8);

	if (prefix === OFFCHAIN_CONTENT_PREFIX) {
		const bytes = readSnakeBytes(slice);
		const contentUri = bytes.toString('utf-8');
		metadata = await fetchJettonOffchainMetadata(contentUri, serverUrl);
	} else {
		// On-chain content
		metadata = await parseJettonOnchainMetadata(slice);
		if (metadata.uri) {
			// Semi-chain content
			const offchainMetadata = await fetchJettonOffchainMetadata(metadata.uri, serverUrl);
			metadata = { ...offchainMetadata, ...metadata };
		}
	}

	return metadata;
}

export const validAddress = (address: string, chainType: TonChainType) => {
	try {
		if (
			(chainType === TonChainType.TON && !/^U/.test(address)) ||
			(chainType === TonChainType.TON_TEST && !/^0/.test(address))
		)
			return false;
		const isValid = !!Address.parse(address);
		return isValid;
	} catch (err) {
		console.error(err);
		return false;
	}
};
