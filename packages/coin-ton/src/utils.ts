import { Address, Cell, Dictionary, DictionaryValue, Slice, TonClient } from '@ton/ton';
import TonWeb from 'tonweb';
import { GetAddressInfoResponse, JettonMetadata } from './types';
import { base } from '@web3jskit/crypto-lib';
import { sha256 } from '@ton/crypto';
import { SNAKE_PREFIX } from './constants';
import { fetchJson } from './metadata';

export const TRANSFER_TIMEOUT_SEC = 600;
const IPFS_GATEWAY_BASE_URL: string = 'https://ipfs.io/ipfs/';

export const getWalletPublicKey = async (endpoint: string, address: string) => {
	try {
		const topClient = new TonClient({ endpoint });
		const res = await topClient.runMethod(Address.parse(address), 'get_public_key');
		const bigintKey = res.stack.readBigNumber();
		const hex = bigintKey.toString(16).padStart(64, '0');
		return TonWeb.utils.hexToBytes(hex);
	} catch (err) {
		console.log('err===>', err);

		return undefined;
	}
};

const callGetRpc = async (endpoint: string, body: Record<string, any>): Promise<any> => {
	return fetch(endpoint, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			id: 1,
			jsonrpc: '2.0',
			...body
		})
	})
		.then(response => response.json())
		.then(response => response.result);
};

export function getWalletInfo(endpoint: string, address: string) {
	return callGetRpc(endpoint, {
		method: 'getWalletInformation',
		params: {
			address
		}
	});
}

export function getAddressInfo(endpoint: string, address: string): Promise<GetAddressInfoResponse> {
	return callGetRpc(endpoint, { method: 'getAddressInformation', params: { address } });
}

export const readIntFromBitString = (bs: any, cursor: number, bits: number) => {
	let n = BigInt(0);
	for (let i = 0; i < bits; i++) {
		n *= BigInt(2);
		n += BigInt(bs.get(cursor + i));
	}
	return n;
};
export const parseAddress = (cell: Cell) => {
	let n = readIntFromBitString(cell.bits, 3, 8);
	if (n > BigInt(127)) {
		n = n - BigInt(256);
	}
	const hashPart = readIntFromBitString(cell.bits, 3 + 8, 256);
	if (n.toString(10) + ':' + hashPart.toString(16) === '0:0') return null;
	const s = n.toString(10) + ':' + hashPart.toString(16).padStart(64, '0');
	return s;
};

const dictSnakeBufferValue: DictionaryValue<Buffer> = {
	parse: slice => {
		const buffer = Buffer.from('');

		const sliceToVal = (s: Slice, v: Buffer, isFirst: boolean) => {
			if (isFirst && s.loadUint(8) !== SNAKE_PREFIX) {
				throw new Error('Only snake format is supported');
			}

			v = Buffer.concat([v, s.loadBuffer(s.remainingBits / 8)]);
			if (s.remainingRefs === 1) {
				v = sliceToVal(s.loadRef().beginParse(), v, false);
			}

			return v;
		};

		return sliceToVal(slice.loadRef().beginParse() as any, buffer, true);
	},
	serialize: () => {
		// pass
	}
};

const jettonOnChainMetadataSpec: {
	[key in keyof JettonMetadata]: 'utf8' | 'ascii' | undefined;
} = {
	uri: 'ascii',
	name: 'utf8',
	description: 'utf8',
	image: 'ascii',
	symbol: 'utf8',
	decimals: 'utf8'
};

export async function parseJettonOnchainMetadata(slice: Slice): Promise<JettonMetadata> {
	const dict = slice.loadDict(Dictionary.Keys.Buffer(32), dictSnakeBufferValue);

	const res: { [s in keyof JettonMetadata]?: string } = {};

	for (const [key, value] of Object.entries(jettonOnChainMetadataSpec)) {
		const sha256Key = Buffer.from(await sha256(Buffer.from(key, 'ascii')));
		const val = dict.get(sha256Key)?.toString(value);

		if (val) {
			res[key as keyof JettonMetadata] = val;
		}
	}

	return res as JettonMetadata;
}

export async function fetchJettonOffchainMetadata(uri: string, serverUrl: string): Promise<JettonMetadata> {
	let metadata: any = {};
	uri = uri.replace('ipfs://', IPFS_GATEWAY_BASE_URL);
	try {
		metadata = await fetchJson(uri);
	} catch (error) {
		metadata = await fetch(serverUrl, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				method: 'GET',
				url: uri
			})
		}).then(async response => {
			const { data } = (await response.json()) || { data: '' };
			const bodyUTF8 = base.fromBase64(data.body);
			const bodyStr = base.fromUtf8(bodyUTF8);
			const body = JSON.parse(bodyStr);
			if (body.image) {
				body.image = body.image.replace('ipfs://', IPFS_GATEWAY_BASE_URL);
			}

			return body;
		});
	}
	return metadata;

	// return pick(metadata, ['name', 'description', 'symbol', 'decimals', 'image', 'image_data']);
}

export function readSnakeBytes(slice: Slice) {
	let buffer = Buffer.alloc(0);

	while (slice.remainingBits >= 8) {
		buffer = Buffer.concat([buffer, slice.loadBuffer(slice.remainingBits / 8)]);
		if (slice.remainingRefs) {
			slice = slice.loadRef().beginParse();
		} else {
			break;
		}
	}

	return buffer;
}
