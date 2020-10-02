// This class manages WWSU hosts
class WWSUhosts extends WWSUdb {
	/**
	 * Construct the class
	 *
	 * @param {sails.io} socket Socket connection to WWSU
	 * @param {WWSUmeta} meta WWSUmeta class instance
	 * @param {WWSUrecipients} recipients WWSUrecipients class instance
	 * @param {string} machineID The ID of this machine / installation
	 * @param {string} app The app name and version this host is running
	 * @param {WWSUreq} hostReq Request with host authorization
	 * @param {WWSUreq} directorReq Request with director authorization
	 */
	constructor(socket, meta, recipients, machineID, app, hostReq, directorReq) {
		super(); // Create the db

		this.endpoints = {
			get: "/hosts/get",
		};
		this.requests = {
			host: hostReq,
			director: directorReq,
		};
		this.data = {
			get: { host: machineID, app: app },
		};
		this.meta = meta;
		this.recipients = recipients;

		this.host = machineID;

		this.table;

		this.assignSocketEvent("hosts", socket);

		// Contains information about the current host
		this.client = {};

		// Update client info if it changed
		this.on("update", "WWSUhosts", (record) => {
			if (record.host === this.host) {
				this.client = record;
				this.emitEvent("clientChanged", [record]);
			}
		});

		this.on("change", "WWSUhosts", () => {
			this.updateTable();
		});

		this.animations = new WWSUanimations();
	}

	/**
	 * Get / authorize this host in the WWSU API.
	 * This should be called BEFORE any other WWSU init functions are called.
	 *
	 * @param {function} cb Callback w/ parameter. 1 = authorized and connected. 0 = not authorized, -1 = authorized, but already connected
	 */
	get(cb) {
		this.requests.host.request(
			{ method: "POST", url: this.endpoints.get, data: this.data.get },
			(body) => {
				try {
					this.client = body;

					if (!this.client.authorized) {
						cb(0);
					} else {
						if (body.otherHosts) {
							this.query(body.otherHosts, true);
							delete this.client.otherHosts;
						}
						this.recipients.addRecipientComputer(
							this.client.host,
							(recipient, success) => {
								if (success) {
									cb(1);
								} else {
									cb(-1);
								}
							}
						);
					}
				} catch (e) {
					cb(0);
					console.error(e);
				}
			}
		);
	}

	/**
	 * Is this DJ Controls the host of the current broadcast?
	 *
	 * @return {boolean} True if this host started the current broadcast, false otherwise
	 */
	get isHost() {
		return this.client.ID === this.meta.meta.host;
	}

	/**
	 * If another host started the current broadcast, display a confirmation prompt to prevent accidental interference with another broadcast.
	 *
	 * @param {string} action Description of the action being taken
	 * @param {function} cb Callback when we are the host, or "yes" is chosen on the confirmation dialog.
	 */
	promptIfNotHost(action, cb) {
		if (this.meta.meta.host && !this.isHost) {
			var util = new WWSUutil();
			util.confirmDialog(
				`<strong>Your host did not start the current broadcast</strong>. Are you sure you want to ${action}? You may be interfering with someone else's broadcast.`,
				null,
				() => {
					cb();
				}
			);
		} else {
			cb();
		}
	}

	/**
	 * Initialize Hosts management table
	 *
	 * @param {string} table DOm query string for the div container to put the table.
	 */
	initTable(table) {
		this.animations.add("hosts-init-table", () => {
			var util = new WWSUutil();

			// Init html
			$(table).html(
				`<p class="wwsumeta-timezone-display">Times are shown in the timezone ${
					this.meta ? this.meta.meta.timezone : moment.tz.guess()
				}.</p><table id="section-hosts-table" class="table table-striped display responsive" style="width: 100%;"></table>`
			);

			util.waitForElement(`#section-hosts-table`, () => {
				// Generate table
				this.table = $(`#section-hosts-table`).DataTable({
					paging: false,
					data: [],
					columns: [
						{ title: "Name" },
						{ title: "Authorized?" },
						{ title: "Responsibility" },
						{ title: "Admin?" },
						{ title: "Remote Calls?" },
						{ title: "Actions" },
					],
					columnDefs: [{ responsivePriority: 1, targets: 5 }],
					order: [[0, "asc"]],
					pageLength: 10,
					drawCallback: () => {
						// Action button click events
						$(".btn-host-edit").unbind("click");
						$(".btn-host-delete").unbind("click");

						$(".btn-host-edit").click((e) => {
							var host = this.find().find(
								(host) => host.ID === parseInt($(e.currentTarget).data("id"))
							);
							this.showHostForm(host);
						});

						$(".btn-host-delete").click((e) => {
							var util = new WWSUutil();
							var host = this.find().find(
								(host) => host.ID === parseInt($(e.currentTarget).data("id"))
							);
							util.confirmDialog(
								`Are you sure you want to remove the host "${host.name}"?
							<ul>
							<li>The host will no longer have access to WWSU.</li>
							<li>The settings for the host will be removed.</li>
							<li>The host will be removed from the hosts list until / unless they try to connect to WWSU again. Otherwise, they will be re-added, but unauthorized to connect.</li>
                            </ul>`,
								host.ID,
								() => {
									this.remove({ ID: host.ID });
								}
							);
						});
					},
				});

				// Update with information
				this.updateTable();
			});
		});
	}
}
