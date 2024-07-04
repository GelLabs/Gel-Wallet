export const getMetadata = () => {
	const iconLink = document.querySelector('link[rel="icon"]') || document.querySelector('link[rel="shortcut icon"]');
	let iconUrl = iconLink?.getAttribute('href') || '';
	if (iconUrl && !iconUrl.startsWith('http')) {
		iconUrl = new URL(iconUrl, window.location.origin).href;
	}
	return {
		name: window.document.title,
		url: window.location.href,
		origin: window.location.origin,
		icon: iconUrl
	};
};
