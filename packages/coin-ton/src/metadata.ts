// import { BRILLIANT_API_BASE_URL, IS_CAPACITOR } from '../config';

const IPFS_GATEWAY_BASE_URL: string = 'https://ipfs.io/ipfs/';

export function fixIpfsUrl(url: string) {
	return url.replace('ipfs://', IPFS_GATEWAY_BASE_URL);
}

export async function fetchJson(url: string) {
	const response = await fetch(url);
	if (!response.ok) {
		throw Error(`Http error ${response.status}`);
	}
	return response.json();
}
