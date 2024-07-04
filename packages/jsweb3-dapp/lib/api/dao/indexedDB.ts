interface IndexedDBCreateDatabaseArgs {
	databaseName: string;
	version: number;
	onUpgradeneeded?: (db: IDBVersionChangeEvent) => void;
}

interface IndexedDBCreateTableArgs {
	database: IDBDatabase;
	tableName: string;
	options?: IDBObjectStoreParameters;
}

interface IndexedDBCreateIndexArgs {
	database: IDBDatabase;
	tableName: string;
	indexName: string;
	indexField: string | string[];
	options?: IDBIndexParameters;
}

interface IndexedDBInsertArgs<T> {
	database: IDBDatabase;
	tableName: string;
	data: T;
	key?: IDBValidKey;
}

interface IndexedDBGetArgs {
	database: IDBDatabase;
	tableName: string;
	query: IDBValidKey | IDBKeyRange;
}

interface IndexedDBGetAllArgs {
	database: IDBDatabase;
	tableName: string;
}

export class PIndexedDB {
	static getDatabase(args: IndexedDBCreateDatabaseArgs): Promise<IDBDatabase> {
		return new Promise((resolve, reject) => {
			const { databaseName, version, onUpgradeneeded } = args;
			const database = window.indexedDB.open(databaseName, version);
			database.onerror = err => {
				reject(err);
			};
			database.onsuccess = () => {
				resolve(database.result);
			};
			database.onupgradeneeded = e => {
				// const db: IDBDatabase = (e.target as any).result;
				onUpgradeneeded && onUpgradeneeded(e);
			};
		});
	}
	static async createTable(args: IndexedDBCreateTableArgs) {
		const { database, tableName, options } = args;
		if (!database.objectStoreNames.contains(tableName)) {
			database.createObjectStore(tableName, options);
		}
	}
	static createIndex(args: IndexedDBCreateIndexArgs) {
		const { database, tableName, indexName, indexField, options } = args;
		if (database.objectStoreNames.contains(tableName)) {
			const ts: IDBTransaction = database.transaction(tableName);
			const table = ts.objectStore(tableName);
			table.createIndex(indexName, indexField, options);
			ts.commit();
		}
	}
	static insert<T>(args: IndexedDBInsertArgs<T>): Promise<void> {
		const { database, tableName, data, key } = args;
		return new Promise((resolve, reject) => {
			if (database.objectStoreNames.contains(tableName)) {
				const request = database.transaction(tableName, 'readwrite').objectStore(tableName).add(data, key);
				request.onerror = err => {
					reject(err);
				};
				request.onsuccess = () => {
					resolve();
				};
			}
		});
	}

	static upsert<T>(args: IndexedDBInsertArgs<T>): Promise<void> {
		const { database, tableName, data, key } = args;
		return new Promise((resolve, reject) => {
			if (database.objectStoreNames.contains(tableName)) {
				const request = database.transaction(tableName, 'readwrite').objectStore(tableName).put(data, key);
				request.onerror = err => {
					reject(err);
				};
				request.onsuccess = () => {
					resolve();
				};
			}
		});
	}
	static get<T>(args: IndexedDBGetArgs): Promise<T> {
		const { database, tableName, query } = args;
		return new Promise((resolve, reject) => {
			const request = database.transaction(tableName, 'readwrite').objectStore(tableName).get(query);
			request.onerror = err => {
				reject(err);
			};
			request.onsuccess = () => {
				resolve(request.result);
			};
		});
	}
	static getAll<T>(args: IndexedDBGetAllArgs): Promise<T> {
		const { database, tableName } = args;
		return new Promise((resolve, reject) => {
			const request = database.transaction(tableName).objectStore(tableName);
			const cursorInstance = request.openCursor();

			cursorInstance.onerror = err => {
				reject(err);
			};
			cursorInstance.onsuccess = (event: any) => {
				const cursor = event?.target?.result;

				resolve(cursor);
			};
		});
	}
}
