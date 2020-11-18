class WWSUremote extends WWSUevents {
	/**
	 * Construct the class
	 *
	 * @param {sails.io} socket Socket connection to WWSU
	 * @param {WWSUreq} hostReq Request with host authorization
	 * @param {WWSUrecipients} recipients Initialized recipients module (uses recipients.recipient for Skyway credential authorization and peerId)
	 */
	constructor(socket, hostReq, recipients) {
		super();
		this.endpoints = {
			request: "/call/request",
			credentialComputer: "/call/credential-computer",
			quality: "/call/quality",
		};
		this.requests = {
			host: hostReq,
		};
		this.data = {
			request: {},
		};

		this.recipients = recipients;

		socket.on("call-quality", "WWSUremote", (quality) => {
			this.emitEvent("callQuality", [quality]);
		});
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

	/**
	 * Authorize a host for connecting to Skyway.js.
	 * TODO: Once the new DJ Controls is ready, credentials should be forced on the Skyway.js dashboard.
	 *
	 * @param {object} data Data to be passed to the API
	 * @param {?function} cb Callback which returns credential data on success
	 */
	credentialComputer(data, cb) {
		try {
			this.requests.host.request(
				{ method: "post", url: this.endpoints.credentialComputer, data },
				(response) => {
					if (response.authToken) {
						if (typeof cb === "function") {
							cb(response);
						}
					} else {
						$(document).Toasts("create", {
							class: "bg-danger",
							title: "Error generating Skyway.js credential",
							body:
								"There was an error generating a credential token to authorize Skyway.js for an audio call. Please contact the engineer.",
							autoHide: true,
							delay: 15000,
							icon: "fas fa-skull-crossbones fa-lg",
						});
						if (typeof cb === "function") {
							cb(false);
						}
					}
				}
			);
		} catch (e) {
			$(document).Toasts("create", {
				class: "bg-danger",
				title: "Error generating Skyway.js credential",
				body:
					"There was an error generating a credential token to authorize Skyway.js for an audio call. Please contact the engineer.",
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

	/**
	 * Send call quality data to WWSU API to be transmitted in sockets.
	 *
	 * @param {object} data Data to be passed to the API
	 */
	sendQuality(data) {
		try {
			this.requests.host.request(
				{ method: "post", url: this.endpoints.quality, data },
				(response) => {}
			);
		} catch (e) {
			console.error(e);
		}
	}
}
