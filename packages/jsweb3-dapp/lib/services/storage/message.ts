import { JSWEB3_DAPP_MESSAGES_TABLE } from './../../constants/database';
import { DappDB, MessageTabKeyPath } from '../../api/dao/dappDB';
import { PIndexedDB } from '../../api/dao/indexedDB';
import { MessageData } from '../../domain/message';
import { uniqBy } from 'lodash-es';

interface AddMessageArgs {
	messages: MessageData<any>[];
}

interface GetMessagesRes {
	name: MessageTabKeyPath.Tasks;
	list: MessageData<any>[];
}

export class MessageStorage {
	constructor() {
		DappDB.getInstance(PIndexedDB);
	}
	getMessages = async () => {
		const res = await DappDB.get<GetMessagesRes>({
			tableName: JSWEB3_DAPP_MESSAGES_TABLE,
			query: [MessageTabKeyPath.Tasks]
		});
		return res?.list || [];
	};
	addMessage = async ({ messages }: AddMessageArgs) => {
		const oldList = await this.getMessages();
		const newMessages = uniqBy([...oldList, ...messages], 'messageId');
		await DappDB.insert({
			tableName: JSWEB3_DAPP_MESSAGES_TABLE,
			data: newMessages
		});
	};
}
