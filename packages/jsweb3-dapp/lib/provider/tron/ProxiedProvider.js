import TronWeb from 'tronweb/dist/TronWeb';

const { HttpProvider } = TronWeb.providers;

class ProxiedProvider extends HttpProvider {
	constructor() {
		super('http://127.0.0.1');

		console.info('Provider initialised'); // eslint-disable-line

		this.ready = false;
		this.queue = [];
	}

	configure(url) {
		console.info('Received new node:', url); // eslint-disable-line

		this.host = url;
		this.instance.baseURL = url;

		this.ready = true;

		while (this.queue.length) {
			const { args, resolve, reject } = this.queue.shift();

			this.request(...args)
				.then(resolve)
				.catch(reject)
				.then(() => console.info(`Completed the queued request to ${args[0]}`)); // eslint-disable-line
		}
	}

	request(endpoint, payload = {}, method = 'get') {
		if (!this.ready) {
			console.info(`Request to ${endpoint} has been queued`); // eslint-disable-line

			return new Promise((resolve, reject) => {
				this.queue.push({
					args: [endpoint, payload, method],
					resolve,
					reject
				});
			});
		}

		return super.request(endpoint, payload, method).then(res => {
			const response = res.transaction || res;

			Object.defineProperty(response, '__payload__', {
				writable: false,
				enumerable: false,
				configurable: false,
				value: payload
			});

			return res;
		});
	}
}

export default ProxiedProvider;
