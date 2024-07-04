export interface MessageData<T> {
	messageId: string;
	methodName: string;
	params: T | any;
}

export interface SDKResult {
	messageId: string;
	data: any;
}
