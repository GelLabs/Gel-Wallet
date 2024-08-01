import lottie from 'lottie-web';
import { IModalConfig } from './types';
import loadingAnimation from './loadingAnimation.json?url';

const CONTAINER_ID = 'jsweb3_dapp_default_container';

export const IframeID = `${CONTAINER_ID}_iframe`;
export const LoadingID = `${CONTAINER_ID}_loading`;
export class Modal {
	private static _instance: Modal;
	private static sdkWindow: Window;
	private isLoadingDefault: boolean = false;
	readyState: boolean | 'padding' = false;
	userConf: IModalConfig = { url: '' };

	constructor(modalConf: IModalConfig) {
		if (Modal._instance) return Modal._instance;
		this.userConf = modalConf;
		Modal._instance = this;
	}
	private init = () => {
		const containerEle = this.getContainer(this.userConf['did']);
		this.getLoadingContainer(this.userConf['loading']);

		this.createDefaultCSS();
		this.loadIframe(containerEle);
	};
	private getContainer = (modalConf: Partial<IModalConfig['did']>): HTMLDivElement => {
		if (modalConf?.container) {
			const containerEle = modalConf.container;
			return containerEle;
		}
		let height = this.userConf.height || 'calc(100% - 20px)';
		let maxHeight = this.userConf.maxheight || '812px';
		height = typeof height === 'number' ? `${height}px` : height;
		maxHeight = typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight;
		const body = document.body;
		const containerEle = document.createElement('div');
		containerEle.id = CONTAINER_ID;
		containerEle.style.height = height;
		containerEle.style.maxHeight = maxHeight;
		containerEle.className = `${CONTAINER_ID}_hide`; // Default className
		body.appendChild(containerEle);
		return containerEle;
	};

	private createDefaultCSS = () => {
		const head = document.getElementsByTagName('head')[0];
		const css = document.createElement('style');
		css.innerHTML = `
      #${CONTAINER_ID} {
        position: fixed;
        top: 40px;
        right: 40px;
        width: 375px;
        overflow: hidden;
        box-shadow: 0px 4px 20px 0px rgba(0, 0, 0, 0.10);
        z-index: 999999999;
        cursor: grab;
        border-radius: 17px;
        background-color: #ddd;
      }
      .${CONTAINER_ID}_hide {
        opacity: 0;
        pointer-events: none;
        z-index: -999;
      }
      #${CONTAINER_ID} > #${IframeID} {
		position: absolute;
        left: 3px;
		top: 3px;
		width: calc(100% - 6px);
		height: calc(100% - 6px);
        background-color: #fff;
        border-radius: 15px;
      }
      #${LoadingID} {
        position: fixed;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
      }
      @media (max-width: 640px) {
        .${CONTAINER_ID}_hide {
          transform: translateY(200%);
        }
        #${CONTAINER_ID} {
          width: 100%;
          height: 97%;
          max-height: 100%;
          left: 0!important;
          bottom: 0!important;
          top: auto!important;
          background: transparent;
          padding: 0;
          border-radius: 10px 10px 0 0;
          transition: all 0.3s;
        }
        #${CONTAINER_ID} > #${IframeID} {
          border-radius: 0;
		  width: 100%;
		  height: 100%;
		  left: 0;
		  top: 0;
        }
      }
    `;
		head.appendChild(css);
	};

	private getLoadingContainer = (loadingConf: Partial<IModalConfig['loading']>) => {
		const defaultLoadingEle = document.createElement('div');
		defaultLoadingEle.style.cssText = `
      width: 100px;
      height: 100px;
      background-color: rgba(0,0,0,0.5);
      z-index: 99;
      border-radius: 10px;
    `;
		lottie.loadAnimation({
			container: defaultLoadingEle,
			renderer: 'svg',
			loop: true,
			autoplay: true,
			path: loadingAnimation
		});
		const loadingEle = loadingConf?.element || defaultLoadingEle;
		if (loadingConf?.container) {
			const loadingEle = loadingConf.container;
			if (loadingEle) {
				loadingEle.appendChild(loadingConf.element as Element);
				return loadingEle;
			}
		}
		loadingEle.id = LoadingID;
		const body = document.body;
		body.appendChild(loadingEle);
		this.isLoadingDefault = true;
		return loadingEle;
	};

	private bindDragEvents = (container: HTMLDivElement) => {
		const mousedown = (e: any) => {
			const diffX = e.clientX - container.offsetLeft;
			const diffY = e.clientY - container.offsetTop;
			const mousemove = (e: any) => {
				// Browser compatible
				e = e || window.event;
				let left = e.clientX - diffX;
				let top = e.clientY - diffY;
				if (left < 0) {
					left = 0;
				} else if (left > window.innerWidth - container.offsetWidth) {
					left = window.innerWidth - container.offsetWidth;
				}
				if (top < 0) {
					top = 0;
				} else if (top > window.innerHeight - container.offsetHeight) {
					top = window.innerHeight - container.offsetHeight;
				}
				container.style.left = left + 'px';
				container.style.top = top + 'px';
			};
			const mouseup = () => {
				document.removeEventListener('mousemove', mousemove, false);
				document.removeEventListener('mouseup', mouseup, false);
			};
			document.addEventListener('mousemove', mousemove, false);
			document.addEventListener('mouseup', mouseup, false);
		};
		const stop = (e: any) => {
			e.stopPropagation();
		};
		const iframe = document.getElementById(IframeID);
		container.addEventListener('mousedown', mousedown, false);
		iframe?.addEventListener('mousedown', stop, false);
	};
	private loadIframe = (container: HTMLDivElement) => {
		// const height = this.
		const htmlStr = `
      <iframe
        id="${IframeID}"
        allow-top-navigation="true"
        allow="publickey-credentials-create *;publickey-credentials-get *;camera *"
        src="${this.userConf.url}"
        frameborder="0"
      ></iframe>
    `;

		container.innerHTML = htmlStr;

		// const iframe: HTMLIFrameElement = document.getElementById(IframeID) as HTMLIFrameElement;
		this.bindDragEvents(container);
		// iframe.onload = this.loaded;
	};

	waitReady = async () => {
		if (this.readyState === true) {
			return true;
		}
		if (this.readyState === false) {
			this.readyState = 'padding';
			this.init();
		}
		return new Promise(res => {
			window.setTimeout(async () => {
				res(this.waitReady());
			}, 300);
		});
	};

	loaded = () => {
		if (this.readyState === true) return;
		this.readyState = true;
		const body = document.body;
		if (typeof this.userConf.onLoad === 'function') {
			this.userConf.onLoad();
		}
		if (this.isLoadingDefault) {
			const loadingNode = document.getElementById(LoadingID);
			loadingNode && body.removeChild(loadingNode);
		}
		this.userConf?.loading?.finished?.();
	};

	readonly closeModal = () => {
		const modal = document.getElementById(CONTAINER_ID);
		if (modal) modal.className = `${CONTAINER_ID}_hide`;

		this.userConf?.did?.close?.();
	};

	readonly openModal = async () => {
		await this.waitReady();
		const modal = document.getElementById(CONTAINER_ID);
		if (modal) modal.className = '';

		this.userConf?.did?.open?.();
	};

	readonly getSDKWindow = async (): Promise<Window> => {
		if (Modal.sdkWindow) return Modal.sdkWindow;
		return new Promise((resolve, reject) => {
			const iframe: HTMLIFrameElement = document.getElementById(IframeID) as HTMLIFrameElement;
			if (!iframe) {
				return reject('No iframe element found.');
			}
			const contentWindow = iframe?.contentWindow;
			if (contentWindow) {
				Modal.sdkWindow = contentWindow;
				resolve(contentWindow);
			} else {
				iframe.onload = () => {
					Modal.sdkWindow = iframe.contentWindow!;
					resolve(iframe.contentWindow!);
				};
			}
		});
	};
}
