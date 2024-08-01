const Utils = {
	injectPromise(func: (...args: any[]) => void, ...args: unknown[]) {
		return new Promise((resolve, reject) => {
			func(...args, (err: null | Error, res: unknown) => {
				if (err) reject(err);
				else resolve(res);
			});
		});
	}
};

export default Utils;
