"use strict";

// This class manages messages/chat from a host level
// NOTE: event also supports 'newMessage' emitted when a new message is received that should be notified.

// REQUIRES these WWSUmodules: WWSUrecipients, WWSUMeta, WWSUhosts, hostReq (WWSUreq), WWSUutil, WWSUanimations
class WWSUmessages extends WWSUdb {
	/**
	 * The class constructor.
	 *
	 * @param {WWSUmodules} manager The modules class which initiated this module
	 * @param {object} options Options to be passed to this module
	 */
	constructor(manager, options) {
		super();

		this.manager = manager;

		this.endpoints = {
			get: "/messages/get",
			remove: "/messages/remove",
			send: "/messages/send"
		};
		this.data = {
			get: {}
		};

		this.assignSocketEvent("messages", this.manager.socket);

		this.chatActiveRecipient;
		this.chatStatus;
		this.chatMessages;
		this.chatForm;
		this.chatMute;
		this.chatBan;
		this.menuNew;
		this.menuIcon;

		this.read = [];
		this.notified = [];

		// Prune old messages (over 1 hour old) every minute.
		this.prune = setInterval(() => {
			this.find().forEach(message => {
				if (
					moment(
						this.manager.get("WWSUMeta")
							? this.manager.get("WWSUMeta").meta.time
							: undefined
					)
						.subtract(1, "hours")
						.isAfter(moment(message.createdAt))
				) {
					this.query({ remove: message.ID });
				}
			});
		}, 60000);

		this.firstLoad = true;
	}

	/**
	 * Initialize chat components. This should be called before init (eg. on DOM ready).
	 *
	 * @param {string} chatActiveRecipient DOM query string of where the currently selected recipient should be shown.
	 * @param {string} chatStatus DOM query string where the chat status info box is contained.
	 * @param {string} chatMessages DOM query string where chat messages should be displayed.
	 * @param {string} chatForm DOM query string where the Alpaca form for sending messages should be generated.
	 * @param {string} chatMute DOM query string of the chat mute action button
	 * @param {string} chatBan DOM query string of the chat ban action button
	 * @param {string} menuNew DOM query string of the badge containing number of unread messages
	 * @param {string} menuIcon DOM query string of the menu icon to flash green when an unread message is present
	 */
	initComponents(
		chatActiveRecipient,
		chatStatus,
		chatMessages,
		chatForm,
		chatMute,
		chatBan,
		menuNew,
		menuIcon
	) {
		// Set properties
		this.chatActiveRecipient = chatActiveRecipient;
		this.chatStatus = chatStatus;
		this.chatMessages = chatMessages;
		this.chatForm = chatForm;
		this.chatMute = chatMute;
		this.chatBan = chatBan;
		this.menuNew = menuNew;
		this.menuIcon = menuIcon;

		// Generate Alpaca form
		$(this.chatForm).alpaca({
			schema: {
				type: "object",
				properties: {
					message: {
						type: "string",
						title: "Message",
						required: true,
						maxLength: 1024
					}
				}
			},
			options: {
				fields: {
					message: {
						type: "markdown"
					}
				},
				form: {
					buttons: {
						submit: {
							title: "Send Message",
							click: (form, e) => {
								form.refreshValidationState(true);
								if (!form.isValid(true)) {
									if (this.manager.has("WWSUehhh"))
										this.manager.get("WWSUehhh").play();
									form.focus();
									return;
								}

								if (!this.manager.get("WWSUrecipients").activeRecipient) {
									if (this.manager.has("WWSUehhh"))
										this.manager.get("WWSUehhh").play();
									$(document).Toasts("create", {
										class: "bg-warning",
										title: "Error sending message",
										body:
											"You must select a recipient before you can send a message.",
										autohide: true,
										delay: 10000,
										icon: ""
									});
									return;
								}

								let value = form.getValue();
								value.to = this.manager.get(
									"WWSUrecipients"
								).activeRecipient.host;
								value.toFriendly = this.manager.get(
									"WWSUrecipients"
								).activeRecipient.label;

								this.send(value, success => {
									if (success) {
										form.clear();
									}
								});
							}
						}
					}
				}
			}
		});

		// Prune removed messages from memory of which were read and which were notified; we don't need them anymore.
		this.on("remove", "WWSUmessages", (query, db) => {
			this.read = this.read.filter(value => value !== query);
			this.notified = this.notified.filter(value => value !== query);
		});

		// Update messages box when a change in messages occurs
		this.on("change", "WWSUmessages", db => {
			this.updateMessages();
		});

		// On a new message, display a toast.
		messages.on("newMessage", "WWSUmessages", message => {
			$(document).Toasts("create", {
				class: "bg-primary",
				title: `New Message from ${message.fromFriendly}`,
				autohide: true,
				delay: 30000,
				body: `${discordMarkdown.toHTML(
					message.message
				)}<p><strong>To reply:</strong> Click "Messages / Chat" in the left menu and select the recipient.</p>`,
				icon: "fas fa-comment fa-lg",
				position: "bottomRight"
			});
		});

		// Call updateRecipient whenever a recipient changes. This is in case an actively-selected recipient goes offline/online; we must update the message in the message window.
		this.manager.get("WWSUrecipients").on("change", "WWSUmessages", () => {
			this.updateRecipient();
		});

		// Whenever meta changes, update chat status box
		this.manager
			.get("WWSUMeta")
			.on("newMeta", "WWSUmessages", (newMeta, meta) => {
				if (!meta.webchat) {
					$(this.chatStatus).html(`<div class="callout callout-danger">
	  <ul>
		<li><i class="fas fa-times-circle text-danger p-1"></i> You or someone else has disabled the chat.</li>
		<li><i class="fas fa-times-circle text-danger p-1"></i> You will not receive any messages from the website nor the Discord server until the broadcast ends.</li>
	  </ul>
	  </div>`);
				} else if (meta.state.startsWith("automation_")) {
					$(this.chatStatus).html(`<div class="callout callout-warning">
	  <ul>
		<li><i class="fas fa-check-circle text-success p-1"></i> The web chat is enabled.</li>
		<li><i class="fas fa-minus-circle text-warning p-1"></i> Automation is currently running; public messages you send will go to the website and the #general channel of our Discord server. You will only see Discord messages posted in the #general channel.</li>
		<li><i class="fas fa-times-circle text-danger p-1"></i> You will not be notified of new messages from the web or Discord when in automation; you will only be notified of messages from other hosts / DJ Controls.</li>
	  </ul>
	  </div>`);
				} else if (meta.state.startsWith("prerecord_")) {
					$(this.chatStatus).html(`<div class="callout callout-info">
	  <ul>
		<li><i class="fas fa-check-circle text-success p-1"></i> The web chat is enabled.</li>
		<li><i class="fas fa-check-circle text-success p-1"></i> A prerecord is currently running; public messages you send will go to the website and the text channel specific to this broadcast in our Discord server. You will only see Discord messages sent in the text channel specific to the current broadcast.</li>
		<li><i class="fas fa-times-circle text-danger p-1"></i> The current broadcast is prerecorded; you will not be notified of new messages from the web or Discord; you will only be notified of messages from other hosts / DJ Controls.</li>
	  </ul>
	  </div>`);
				} else if (
					meta.state.startsWith("sports_") ||
					meta.state.startsWith("sportsremote_")
				) {
					$(this.chatStatus).html(`<div class="callout callout-success">
	  <ul>
		<li><i class="fas fa-check-circle text-success p-1"></i> The web chat is enabled.</li>
		<li><i class="fas fa-check-circle text-success p-1"></i> A sports broadcast is on the air; public messages you send will go to the website and the #sports channel of our Discord server. You will only see Discord messages posted in the #sports channel.</li>
		${
			this.manager.get("WWSUhosts").isHost
				? `<li><i class="fas fa-check-circle text-success p-1"></i> You will be notified of new messages from the web and Discord.</li>`
				: `<li><i class="fas fa-times-circle text-danger p-1"></i> You will not be notified of new messages from the web / Discord because you did not start the current broadcast.</li>`
		}
	  </ul>
	  </div>`);
				} else if (
					meta.state.startsWith("live_") ||
					meta.state.startsWith("remote_")
				) {
					$(this.chatStatus).html(`<div class="callout callout-success">
	  <ul>
		<li><i class="fas fa-check-circle text-success p-1"></i> The web chat is enabled.</li>
		<li><i class="fas fa-check-circle text-success p-1"></i> A broadcast is currently running; public messages you send will go to the website and the text channel specific to this broadcast in our Discord server. You will only see Discord messages sent in the text channel specific to the current broadcast.</li>
		${
			this.manager.get("WWSUhosts").isHost
				? `<li><i class="fas fa-check-circle text-success p-1"></i> You will be notified of new messages from the web and Discord.</li>`
				: `<li><i class="fas fa-times-circle text-danger p-1"></i> You will not be notified of new messages from the web / Discord because you did not start the current broadcast.</li>`
		}
	  </ul>
	  </div>`);
				} else {
					$(this.chatStatus).html(`<div class="callout callout-secondary">
		<p><i class="fas fa-minus-circle text-secondary p-1"></i> We do not currently know the status of the web chat.</p>
	  </div>`);
				}
			});
	}

	// Initialize connection. Call this on socket connect event.
	init() {
		this.replaceData(
			this.manager.get("hostReq"),
			this.endpoints.get,
			this.data.get
		);
	}

	/**
	 * Send a message via WWSU API.
	 *
	 * @param {object} data Data to pass to WWSU API
	 * @param {?function} cb Callback function after request is completed.
	 */
	send(data, cb) {
		try {
			this.manager
				.get("hostReq")
				.request(
					{ method: "post", url: this.endpoints.send, data },
					response => {
						if (response !== "OK") {
							if (this.manager.has("WWSUehhh"))
								this.manager.get("WWSUehhh").play();
							$(document).Toasts("create", {
								class: "bg-danger",
								title: "Error sending message",
								body:
									"There was an error sending the message. Your DJ Controls might not be allowed to send messages to website visitors or display signs when you are not on the air. If this is not the case, please contact the engineer.",
								autohide: true,
								delay: 20000,
								icon: "fas fa-skull-crossbones fa-lg"
							});
							if (typeof cb === "function") {
								cb(false);
							}
						} else {
							$(document).Toasts("create", {
								class: "bg-success",
								title: "Message sent",
								body: "Your message was sent!",
								autohide: true,
								delay: 5000
							});
							if (typeof cb === "function") {
								cb(true);
							}
						}
					}
				);
		} catch (e) {
			if (this.manager.has("WWSUehhh")) this.manager.get("WWSUehhh").play();
			$(document).Toasts("create", {
				class: "bg-danger",
				title: "Error sending message",
				body:
					"There was an error sending the message. Please report this to the engineer.",
				autohide: true,
				delay: 10000,
				icon: "fas fa-skull-crossbones fa-lg"
			});
			if (typeof cb === "function") {
				cb(false);
			}
			console.error(e);
		}
	}

	/**
	 * Remove a message via WWSU API.
	 *
	 * @param {object} data Data to pass to WWSU API
	 * @param {?function} cb Callback function after request is completed.
	 */
	remove(data, cb) {
		try {
			this.manager
				.get("hostReq")
				.request(
					{ method: "post", url: this.endpoints.remove, data },
					response => {
						if (response !== "OK") {
							if (this.manager.has("WWSUehhh"))
								this.manager.get("WWSUehhh").play();
							$(document).Toasts("create", {
								class: "bg-danger",
								title: "Error removing message",
								body:
									"There was an error removing the message. Your DJ Controls might not be allowed to remove messages when you are not on the air. If this is not the case, please contact the engineer.",
								autohide: true,
								delay: 15000,
								icon: "fas fa-skull-crossbones fa-lg"
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
			if (this.manager.has("WWSUehhh")) this.manager.get("WWSUehhh").play();
			$(document).Toasts("create", {
				class: "bg-danger",
				title: "Error removing message",
				body:
					"There was an error removing the message. Please report this to the engineer.",
				autohide: true,
				delay: 10000,
				icon: "fas fa-skull-crossbones fa-lg"
			});
			if (typeof cb === "function") {
				cb(false);
			}
			console.error(e);
		}
	}

	/**
	 * Update messages to be displayed.
	 */
	updateMessages() {
		let unreadMessages = 0;

		// Check for and notify of new messages
		this.find({ status: "active" })
			.filter(
				message =>
					(message.to === "DJ" ||
						message.to === "DJ-private" ||
						message.to === this.manager.get("WWSUrecipients").recipient.host) &&
					this.read.indexOf(message.ID) === -1
			)
			.forEach(message => {
				unreadMessages++;

				// Notify on new messages
				if (!this.firstLoad && this.notified.indexOf(message.ID) === -1) {
					this.notified.push(message.ID);
					this.emitEvent("newMessage", [message]);
				}
			});

		// Update unread messages badge and pulsing
		if (unreadMessages <= 0) {
			$(this.menuNew).html(`0`);
			$(this.menuNew).removeClass(`badge-danger`);
			$(this.menuNew).addClass(`badge-secondary`);
			$(this.menuIcon).removeClass(`pulse-success`);
		} else {
			$(this.menuNew).html(unreadMessages);
			$(this.menuNew).removeClass(`badge-secondary`);
			$(this.menuNew).addClass(`badge-danger`);
			$(this.menuIcon).addClass(`pulse-success`);
		}

		// Update messages HTML
		let chatHTML = ``;

		let query = [
			{
				to: [
					this.manager.get("WWSUhosts").client.host,
					"DJ",
					"DJ-private",
					this.manager.get("WWSUrecipients").recipient.host
				]
			},
			{
				from: [
					this.manager.get("WWSUhosts").client.host,
					this.manager.get("WWSUrecipients").recipient.host
				]
			}
		];

		$(this.chatMessages).html(``);

		this.find(query)
			.sort(
				(a, b) => moment(a.createdAt).valueOf() - moment(b.createdAt).valueOf()
			)
			.map(message => {
				chatHTML += `<div class="message" id="message-${message.ID}">
		${this.messageHTML(message)}
		</div>`;
				this.manager
					.get("WWSUutil")
					.waitForElement(`#message-${message.ID}`, () => {
						$(`#message-${message.ID}`).unbind("click");

						$(`#message-${message.ID}`).click(() => {
							if (this.read.indexOf(message.ID) === -1) {
								this.read.push(message.ID);
								this.updateMessages();
							}
						});
					});

				this.manager
					.get("WWSUutil")
					.waitForElement(`#message-delete-${message.ID}`, () => {
						$(`#message-delete-${message.ID}`).unbind("click");

						$(`#message-delete-${message.ID}`).click(() => {
							this.manager
								.get("WWSUutil")
								.confirmDialog(
									`Are you sure you want to permanently delete this message? It will be removed from everyone's messenger window.`,
									null,
									() => {
										this.remove({ ID: message.ID });
									}
								);
						});
					});
			});

		$(this.chatMessages).html(chatHTML);

		// Mark this is no longer first loaded
		this.firstLoad = false;
	}

	// Update messages to be displayed
	checkUnreadMessages() {
		let unreadMessages = 0;

		// Check number of unread messages
		this.find({ status: "active" }).forEach(message => {
			// Check unread messages
			if (
				(message.to === "DJ" ||
					message.to === "DJ-private" ||
					message.to === this.manager.get("WWSUrecipients").recipient.host) &&
				this.read.indexOf(message.ID) === -1
			) {
				unreadMessages++;

				// Notify on new messages
				if (!this.firstLoad && this.notified.indexOf(message.ID) === -1) {
					this.notified.push(message.ID);
					this.emitEvent("newMessage", [message]);
				}
			}
		});

		// Update unread messages badge and pulsing
		if (unreadMessages <= 0) {
			$(this.menuNew).html(`0`);
			$(this.menuNew).removeClass(`badge-danger`);
			$(this.menuNew).addClass(`badge-secondary`);
			$(this.menuIcon).removeClass(`pulse-success`);
		} else {
			$(this.menuNew).html(unreadMessages);
			$(this.menuNew).removeClass(`badge-secondary`);
			$(this.menuNew).addClass(`badge-danger`);
			$(this.menuIcon).addClass(`pulse-success`);
		}

		// This is no longer the first load
		this.firstLoad = false;
	}

	/**
	 * Call this whenever recipientChanged is emitted from WWSUrecipients.
	 *
	 * @param {?object} recipient The recipient that was selected (null: no recipient)
	 */
	changeRecipient(recipient) {
		this.manager.get("WWSUanimations").add("change-recipient", () => {
			if (!recipient) {
				$(this.chatActiveRecipient).html(`(Select a recipient)`);

				$(this.chatMute).addClass("d-none");
				$(this.chatBan).addClass("d-none");
			} else {
				$(this.chatActiveRecipient).html(
					`${jdenticon.toSvg(recipient.host, 24)} ${recipient.label} ${
						recipient.host !== "website" &&
						recipient.group !== "display" &&
						recipient.group !== "system"
							? `${
									recipient.group === "discord"
										? ` (public reply)`
										: ` (private message)`
							  }`
							: ``
					}`
				);

				if (recipient.host.startsWith("website-")) {
					$(this.chatMute).removeClass("d-none");
					$(this.chatBan).removeClass("d-none");
				} else {
					$(this.chatMute).addClass("d-none");
					$(this.chatBan).addClass("d-none");
				}
			}
		});
	}

	/**
	 * Generate an HTML block for a message.
	 * NOTE: This does NOT return the direct-chat-msg container; you must construct this first.
	 *
	 * @param {object} message The message
	 * @returns {string} The HTML for this message
	 */
	messageHTML(message) {
		// Message was from this host
		if (message.from === this.manager.get("WWSUrecipients").recipient.host) {
			return `<div class="direct-chat-msg right">
            <div class="direct-chat-infos clearfix">
              <span class="direct-chat-name float-right">YOU -> ${
								message.toFriendly
							}</span>
              <span class="direct-chat-timestamp float-left">${moment
								.tz(
									message.createdAt,
									this.manager.get("WWSUMeta")
										? this.manager.get("WWSUMeta").meta.timezone
										: moment.tz.guess()
								)
								.format(
									"hh:mm A"
								)} <i class="fas fa-trash" id="message-delete-${
				message.ID
			}"></i></span>
            </div>
            <div class="direct-chat-img bg-secondary">${jdenticon.toSvg(
							message.from,
							40
						)}</div>
            <div class="direct-chat-text bg-success dark-mode">
			${discordMarkdown.toHTML(message.message)}
            </div>
        </div>`;
		} else {
			// Unread message
			if (this.read.indexOf(message.ID) === -1) {
				return `<div class="direct-chat-msg">
                <div class="direct-chat-infos clearfix">
                  <span class="direct-chat-name float-left">${
										message.fromFriendly
									} -> ${message.toFriendly}</span>
                  <span class="direct-chat-timestamp float-right">${moment
										.tz(
											message.createdAt,
											this.manager.get("WWSUMeta")
												? this.manager.get("WWSUMeta").meta.timezone
												: moment.tz.guess()
										)
										.format(
											"hh:mm A"
										)} <i class="fas fa-trash" id="message-delete-${
					message.ID
				}"></i></span></span>
                </div>
                <div class="direct-chat-img bg-secondary">${jdenticon.toSvg(
									message.from,
									40
								)}</div>
                <div class="direct-chat-text bg-danger dark-mode">
				${discordMarkdown.toHTML(message.message)}
                </div>
            </div>`;
				// Read message
			} else {
				return `<div class="direct-chat-msg">
                <div class="direct-chat-infos clearfix">
                  <span class="direct-chat-name float-left">${
										message.fromFriendly
									} -> ${message.toFriendly}</span>
                  <span class="direct-chat-timestamp float-right">${moment
										.tz(
											message.createdAt,
											this.manager.get("WWSUMeta")
												? this.manager.get("WWSUMeta").meta.timezone
												: moment.tz.guess()
										)
										.format(
											"hh:mm A"
										)} <i class="fas fa-trash" id="message-delete-${
					message.ID
				}"></i></span></span>
                </div>
                <div class="direct-chat-img bg-secondary">${jdenticon.toSvg(
									message.from,
									40
								)}</div>
                <div class="direct-chat-text bg-secondary dark-mode">
				${discordMarkdown.toHTML(message.message)}
                </div>
            </div>`;
			}
		}
	}

	// Call this on any changes to messages or the active recipient
	updateRecipient() {
		this.changeRecipient(this.manager.get("WWSUrecipients").activeRecipient);
	}
}
