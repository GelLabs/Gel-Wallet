import { assert, test } from 'vitest';

import { createWallet } from '../src/api';

test('create wallet', async () => {
	const { address, mnemonic, privateKey } = await createWallet();
	assert.isString(address);
	assert.isString(mnemonic);
	assert.isString(privateKey);
});
