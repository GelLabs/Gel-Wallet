
import { JSWEB3_DAPP_DATABASE_NAME, JSWEB3_DAPP_DATABASE_VERSION, JSWEB3_DAPP_MESSAGES_TABLE } from "../../constants/database";
import { PIndexedDB } from "./indexedDB";

export interface UpsertArgs<T> {
    tableName: string;
    data: T; 
}

export interface GetArgs {
    tableName: string;
    query: IDBValidKey | IDBKeyRange;
}

export interface GetAllArgs {
    tableName: string;
}

export enum MessageTabKeyPath {
	Tasks = 'tasks'
}

export class DappDB {
    static instance: DappDB;
	static store: typeof PIndexedDB;
    static async getInstance(store?: typeof PIndexedDB) {
		if (!DappDB.store && store) {
			DappDB.store = store;
		}
		if (!DappDB.instance) {
			await DappDB.initDatabase();
			DappDB.instance = new DappDB();
		}
		return DappDB.instance;
	}
    static async initDatabase() {
		await DappDB.store.getDatabase({
			databaseName: JSWEB3_DAPP_DATABASE_NAME,
			version: JSWEB3_DAPP_DATABASE_VERSION,
			onUpgradeneeded: (e: IDBVersionChangeEvent) => {
				const db = (e.target as any).result;
				try {
					DappDB.store.createTable({
						database: db,
						tableName: JSWEB3_DAPP_MESSAGES_TABLE,
						options: {
							keyPath: ['name']
						}
					});
				} catch (error) {
					console.error('onUpgradeneeded error', error);
				}
			}
		});
	}
    static async upsert<T>(args: UpsertArgs<T>) {
        const { tableName, data } = args;
		const database = await DappDB.store.getDatabase({
			databaseName: JSWEB3_DAPP_DATABASE_NAME,
			version: JSWEB3_DAPP_DATABASE_VERSION
		});
		await DappDB.store.upsert({
            database,
            tableName,
            data
        });
	}
	static async insert<T>(args: UpsertArgs<T>) {
        const { tableName, data } = args;
		const database = await DappDB.store.getDatabase({
			databaseName: JSWEB3_DAPP_DATABASE_NAME,
			version: JSWEB3_DAPP_DATABASE_VERSION
		});
		await DappDB.store.insert({
            database,
            tableName,
            data
        });
	}
    static async get<T>(args: GetArgs): Promise<T> {
        const { tableName, query } = args;
		const database = await DappDB.store.getDatabase({
			databaseName: JSWEB3_DAPP_DATABASE_NAME,
			version: JSWEB3_DAPP_DATABASE_VERSION
		});
        return await DappDB.store.get({
            database,
            tableName,
            query
        });
    }
    static async getAll<T>(args: GetAllArgs): Promise<T> {
        const { tableName } = args;
		const database = await DappDB.store.getDatabase({
			databaseName: JSWEB3_DAPP_DATABASE_NAME,
			version: JSWEB3_DAPP_DATABASE_VERSION
		});
        return await DappDB.store.getAll({
            database,
            tableName,
        });
    }
}