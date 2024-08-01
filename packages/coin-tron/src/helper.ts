export const getCurrentPrices = (prices: string) => {
	let current = { timestamp: 0, price: '0' };
	(prices || '').split(',').forEach((item: string) => {
		const [timestamp, price] = item.split(':');
		if (Number(timestamp) >= current.timestamp) {
			current = {
				timestamp: Number(timestamp),
				price: price
			};
		}
	});
	return current.price;
};
