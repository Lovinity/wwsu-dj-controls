// This class manages the WWSU server configuration

class WWSUconfig extends WWSUevents {
	/**
	 * Construct the class
	 *
	 * @param {sails.io} socket Socket connection to WWSU
	 * @param {WWSUreq} directorReq Request with director authorization
	 * @param {WWSUreq} hostReq Request with host authorization
	 */
	constructor(socket, directorReq, hostReq) {
		super();

		this.endpoints = {
			get: "/config/get",
		};
		this.data = {
			get: {},
		};
		this.requests = {
			director: directorReq,
			host: hostReq,
		};

		this.config = {};

		// Update internal config when websocket broadcasts a change
		socket.on("config", (data) => {
			Object.assign(this.config, data.update);
			this.emitEvent("configChanged", [data.update, this.config]);
		});
	}

	// Initialize the config class. Call this on socket connect event.
	init() {
		try {
			this.requests.host.request(
				{
					method: "post",
					url: this.endpoints.get,
					data: {},
				},
				(response) => {
					if (typeof response !== "object" && !response.website) {
						$(document).Toasts("create", {
							class: "bg-danger",
							title: "Error loading WWSU server configuration",
							body:
								"There was an error WWSU server configuration. Please report this to the engineer.",
							autoHide: true,
							delay: 10000,
							icon: "fas fa-skull-crossbones fa-lg",
						});
					} else {
						this.config = response;
						this.emitEvent("configChanged", [response, this.config]);
					}
				}
			);
		} catch (e) {
			$(document).Toasts("create", {
				class: "bg-danger",
				title: "Error loading WWSU server configuration",
				body:
					"There was an error WWSU server configuration. Please report this to the engineer.",
				autoHide: true,
				delay: 10000,
				icon: "fas fa-skull-crossbones fa-lg",
			});
			console.error(e);
		}
	}
}
