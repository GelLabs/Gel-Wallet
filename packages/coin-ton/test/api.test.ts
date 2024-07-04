import { assert, expect, test } from 'vitest';
import TonWeb from 'tonweb';
import {
	createWallet,
	getPrivateKeyByMnemonic,
	getAddressByPrivateKey,
	getBalance,
	getTokenBalance,
	estimateTransferGas,
	submitTransfer,
	getTokenMetaData
} from '../src/api';

const endpoint = 'https://testnet.toncenter.com/api/v2/jsonRPC';
const appKey = '2924a96bd3ee8554be8109670fce54ce2d65ebcc7d0d6859c7d8ba48192e0f80';

test('create wallet', async () => {
	const { address, mnemonic, privateKey } = await createWallet(true);
	assert.isString(address);
	assert.isString(mnemonic);
	assert.isString(privateKey);
});

test('import wallet from mnemonic', async () => {
	const mnemonic =
		'glow sugar habit tone chair grunt buddy chunk confirm pistol cloud kid menu amateur real during receive wrong pluck useful patch rifle sunny provide';
	// const mnemonic =
	// 	'spider news tongue sauce isolate attend future gain rigid benefit leader water off price goat tooth myself carbon dial army session depth drift cable';
	const privateKey = await getPrivateKeyByMnemonic(mnemonic);

	const { address } = await getAddressByPrivateKey(privateKey, false);
	expect(address).equal('UQCsS_GrVMge3RpIU1Hnz7hYfbyN6iyPmfdSVlGMCP4vPold');
});

test('import wallet from private key', async () => {
	const privateKey = '5Ni3qxCJFT78YEPq6VrQXiJgFQTH6ctB5JpDSBoSeZN3vfyjF9BUTpPDaXdVC9tY1TxLMzgvE2yEbNRbfTAGJeYi';
	const { address } = await getAddressByPrivateKey(privateKey, false);
	expect(address).equal('UQCsS_GrVMge3RpIU1Hnz7hYfbyN6iyPmfdSVlGMCP4vPold');
});

test('get balance', async () => {
	const address = '0QDkXxrkvuW2KHEoNPb_4AzzFMs3UJJv6c8BVVMF1SMjv0eq';
	const balance = await getBalance({ address, endpoint, appKey });
	expect(Number(balance)).toBeGreaterThan(0);
});

test('get token balance', async () => {
	const tokenAddress = 'EQBm-ZZebUJRIAEG1Ta9PT3bYUGOA6duiyO6379ZxphZ6bPS';
	const address = '0QDkXxrkvuW2KHEoNPb_4AzzFMs3UJJv6c8BVVMF1SMjv0eq';
	const balance = await getTokenBalance({ address, tokenAddress, endpoint, appKey });
	expect(Number(balance)).toBeGreaterThan(0);
});

test('estimate', async () => {
	const data = {
		from: '0QDkXxrkvuW2KHEoNPb_4AzzFMs3UJJv6c8BVVMF1SMjv0eq',
		// from: '0QCsS_GrVMge3RpIU1Hnz7hYfbyN6iyPmfdSVlGMCP4vPjLX',
		to: '0QDkXxrkvuW2KHEoNPb_4AzzFMs3UJJv6c8BVVMF1SMjv0eq',
		amount: '1000000'
	};
	const { fee } = await estimateTransferGas({ data, endpoint, testOnly: true, appKey });
	expect(Number(fee)).gt(0);
});

test('estimate token', async () => {
	const data = {
		from: '0QDkXxrkvuW2KHEoNPb_4AzzFMs3UJJv6c8BVVMF1SMjv0eq',
		// from: '0QCsS_GrVMge3RpIU1Hnz7hYfbyN6iyPmfdSVlGMCP4vPjLX',
		to: '0QDkXxrkvuW2KHEoNPb_4AzzFMs3UJJv6c8BVVMF1SMjv0eq',
		tokenAddress: 'kQBm-ZZebUJRIAEG1Ta9PT3bYUGOA6duiyO6379ZxphZ6QhY',
		amount: '1000000'
	};
	const { fee } = await estimateTransferGas({ data, endpoint, testOnly: true, appKey });
	expect(Number(fee)).gt(0);
});

test('transfer ton coin', async () => {
	const amount = TonWeb.utils.toNano('0.003');

	const data = {
		from: '0QDkXxrkvuW2KHEoNPb_4AzzFMs3UJJv6c8BVVMF1SMjv0eq',
		to: '0QCAxg4vkOCxpMyeqr2ojzAJtLKC8Vu314FdE7jsUYQmEgXp',
		privateKey: '3UmYkASj4pRm9LQSre97YBCBug3ga8KTfGXno4TDndXfoNyJK9jFiMkrko4zPU72KiSgihJmEZV9CCGkuH4NEdns',
		// tokenAddress: 'EQBm-ZZebUJRIAEG1Ta9PT3bYUGOA6duiyO6379ZxphZ6bPS',
		amount: amount.toString()
	};
	await submitTransfer({ data, endpoint, testOnly: true, appKey });
});

test('submit token coin', async () => {
	const amount = TonWeb.utils.toNano('0.01');

	const data = {
		from: '0QDkXxrkvuW2KHEoNPb_4AzzFMs3UJJv6c8BVVMF1SMjv0eq',
		to: '0QCAxg4vkOCxpMyeqr2ojzAJtLKC8Vu314FdE7jsUYQmEgXp',
		privateKey: '3UmYkASj4pRm9LQSre97YBCBug3ga8KTfGXno4TDndXfoNyJK9jFiMkrko4zPU72KiSgihJmEZV9CCGkuH4NEdns',
		tokenAddress: 'kQBm-ZZebUJRIAEG1Ta9PT3bYUGOA6duiyO6379ZxphZ6QhY',
		amount: amount.toString()
	};
	await submitTransfer({ data, endpoint, testOnly: true, appKey });
});

test('test get metadata', async () => {
	// const tokenAddress = 'kQBm-ZZebUJRIAEG1Ta9PT3bYUGOA6duiyO6379ZxphZ6QhY';
	const tokenAddress = 'kQAVyE75IZg7FIx-ANZzqz5h5thFaVslnMduS48BzTHc8ULL';
	const metadata = await getTokenMetaData({ tokenAddress, endpoint, appKey });
	assert.isString(metadata.name);
});
