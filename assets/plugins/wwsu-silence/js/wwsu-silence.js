/**
 * This class manages reporting silence to WWWSU.
 * For silence detection, use wwsu-audio/wwsu-silence (WWSUsilenceaudio class).
 */
class WWSUSilence extends WWSUevents {
	/**
	 * Construct the class
	 *
	 * @param {WWSUreq} hostReq WWSU request with host authorization
	 */
	constructor(hostReq) {
		super();
		this.endpoints = {
			active: "/silence/active",
			inactive: "/silence/inactive",
		};
		this.requests = {
			host: hostReq,
		};
	}

	/**
	 * Tell WWSU there is unacceptable silence active. This should be re-triggered every minute until silence is no longer active (this.inactive should then be triggered).
	 *
	 * @param {?function} cb Callback executed after API call is made.
	 */
	active(cb) {
		try {
			this.requests.host.request(
				{ method: "post", url: this.endpoints.active, data },
				(response) => {
					if (!response) {
						$(document).Toasts("create", {
							class: "bg-danger",
							title: "Error sending silence alarm",
							body:
								"There was an error sending a silence alarm to WWSU. Please report this to the engineer.",
							autoHide: true,
							delay: 10000,
							icon: "fas fa-skull-crossbones fa-lg",
						});
					} else {
						if (typeof cb === "function") {
							cb(response);
						}
					}
				}
			);
		} catch (e) {
			$(document).Toasts("create", {
				class: "bg-danger",
				title: "Error sending silence alarm",
				body:
					"There was an error sending a silence alarm to WWSU. Please report this to the engineer.",
				autoHide: true,
				delay: 10000,
				icon: "fas fa-skull-crossbones fa-lg",
			});
			console.error(e);
		}
	}

	/**
	 * Tell WWSU there is no longer silence.
	 *
	 * @param {?function} cb Callback function after API call is made.
	 */
	inactive(cb) {
		try {
			this.requests.host.request(
				{ method: "post", url: this.endpoints.inactive, data },
				(response) => {
					if (!response) {
						$(document).Toasts("create", {
							class: "bg-danger",
							title: "Error sending silence alarm",
							body:
								"There was an error deactivating the silence alarm on WWSU. Please report this to the engineer.",
							autoHide: true,
							delay: 10000,
							icon: "fas fa-skull-crossbones fa-lg",
						});
					} else {
						if (typeof cb === "function") {
							cb(response);
						}
					}
				}
			);
		} catch (e) {
			$(document).Toasts("create", {
				class: "bg-danger",
				title: "Error sending silence alarm",
				body:
					"There was an error deactivating the silence alarm on WWSU. Please report this to the engineer.",
				autoHide: true,
				delay: 10000,
				icon: "fas fa-skull-crossbones fa-lg",
			});
			console.error(e);
		}
	}
}
