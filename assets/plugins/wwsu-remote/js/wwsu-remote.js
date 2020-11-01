class WWSUremote extends WWSUevents {
	/**
	 * Construct the class
	 *
	 * @param {sails.io} socket Socket connection to WWSU
	 * @param {WWSUreq} hostReq Request with host authorization
	 */
	constructor(socket, hostReq) {
		super();
		this.endpoints = {
			request: "/call/request",
		};
		this.requests = {
			host: hostReq,
		};
		this.data = {
			request: {},
		};
	}

	/**
	 * Request for an audio call to the API so other DJ Controls loads its remote process
	 *
	 * @param {object} data Data to send to the API
	 * @param {?function} cb Callback after request is made
	 */
	request(data, cb) {
		try {
			this.requests.host.request(
				{ method: "post", url: this.endpoints.request, data },
				(response) => {
					if (response !== "OK") {
						$(document).Toasts("create", {
							class: "bg-danger",
							title: "Error requesting audio call",
							body:
								"There was an error informing the WWSU API we want to start an audio call for a remote broadcast. Please contact the engineer.",
							autoHide: true,
							delay: 15000,
							icon: "fas fa-skull-crossbones fa-lg",
						});
						if (typeof cb === "function") {
							cb(false);
						}
					} else {
						if (typeof cb === "function") {
							cb(true);
						}
					}
				}
			);
		} catch (e) {
			$(document).Toasts("create", {
				class: "bg-danger",
				title: "Error requesting audio call",
				body:
					"There was an error informing the WWSU API we want to start an audio call for a remote broadcast. Please contact the engineer.",
				autoHide: true,
				delay: 15000,
				icon: "fas fa-skull-crossbones fa-lg",
			});
			if (typeof cb === "function") {
				cb(false);
			}
			console.error(e);
		}
	}
}
