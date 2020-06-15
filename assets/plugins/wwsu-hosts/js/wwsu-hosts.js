// This class manages WWSU hosts
class WWSUhosts extends WWSUdb {

    /**
     * Construct the class
     * 
     * @param {sails.io} socket Socket connection to WWSU
     * @param {WWSUmeta} meta WWSUmeta class instance
     * @param {string} machineID The ID of this machine / installation
     * @param {string} app The app name and version this host is running
     * @param {WWSUreq} hostReq Request with host authorization
     * @param {WWSUreq} directorReq Request with director authorization
     */
    constructor(socket, meta, machineID, app, hostReq, directorReq) {
        super(); // Create the db

        this.endpoints = {
            get: '/hosts/get',
            addRecipientComputer: '/recipients/add-computers'
        };
        this.requests = {
            host: hostReq,
            director: directorReq
        };
        this.data = {
            get: { host: machineID, app: app },
        };
        this.events = new EventEmitter();
        this.meta = meta;

        this.assignSocketEvent('hosts', socket);

        // Contains information about the current host and recipient
        this.client = {};
        this.recipient = {};

        // Determines if we connected to the API at least once before
        this.connectedBefore = false;

        // If true, ignores whether or not this host is already connected
        this.development = true;
    }

    /**
     * Get / authorize this host in the WWSU API.
     * This should be called BEFORE any other WWSU init functions are called.
     * 
     * @param {function} cb Callback w/ parameter. 1 = authorized and connected. 0 = not authorized, -1 = authorized, but already connected
     */
    get (cb) {
        this.requests.host.request({ method: 'POST', url: this.endpoints.get, data: this.data.get }, (body) => {
            try {
                this.client = body

                if (!this.client.authorized) {
                    cb(0);
                } else {
                    if (body.otherHosts) {
                        this.query(body.otherHosts, true);
                        delete this.client.otherHosts;
                    }
                    this.addRecipientComputer((success) => {
                        if (success) {
                            cb(1);
                        } else {
                            cb(-1);
                        }
                    })
                }
            } catch (e) {
                cb(0)
                console.error(e)
            }
        })
    }

    /**
     * Add this host as a computer recipient to the WWSU API (register as online).
     * 
     * @param {function} cb Callback; true = success, false = no success (or another host is already connected)
     */
    addRecipientComputer (cb) {
        this.requests.host.request({ method: 'post', url: this.endpoints.addRecipientComputer, data: { host: this.client.host } }, (response2) => {
            try {
                this.recipient = response2;
                if (this.connectedBefore || (typeof response2.alreadyConnected !== 'undefined' && !response2.alreadyConnected) || this.development) {
                    this.connectedBefore = true
                    cb(true)
                } else {
                    cb(false)
                }
            } catch (e) {
                cb(false)
                console.error(e)
            }
        })
    }

    /**
     * Is this DJ Controls the host of the current broadcast?
     * 
     * @return {boolean} True if this host started the current broadcast, false otherwise
     */
    get isHost () {
        return this.client.ID === this.meta.meta.host;
    }

    /**
     * Check if this DJ Controls is DJ-locked.
     * 
     * @param {string} action Description of the action being performed.
     * @param {function} cb Function executed if we are not locked to a DJ (allowed to perform action).
     */
    checkDJLocked (action, cb) {
        if (this.client.lockToDJ === null || this.client.lockToDJ === this.meta.meta.dj || this.client.lockToDJ === this.meta.meta.cohostDJ1 || this.client.lockToDJ === this.meta.meta.cohostDJ2 || this.client.lockToDJ === this.meta.meta.cohostDJ3 || this.isHost) {
            cb()
        } else {
            $(document).Toasts('create', {
                class: 'bg-warning',
                title: 'Action not allowed',
                delay: 20000,
                autohide: true,
                body: `You are not allowed to ${action} at this time. Your host is locked to a specific DJ that is not on the air. If you are trying to start a broadcast, wait until no more than 5 minutes before scheduled show time, and no one else is on the air, before starting.`,
            });
        }
    }

    /**
     * If another host started the current broadcast, display a confirmation prompt to prevent accidental interference with another broadcast.
     * 
     * @param {string} action Description of the action being taken
     * @param {function} cb Callback when we are the host, or "yes" is chosen on the confirmation dialog.
     */
    promptIfNotHost (action, cb) {
        if (this.meta.meta.host && !this.isHost) {
            var util = new WWSUutil();
            util.confirmDialog(`<strong>Your host did not start the current broadcast</strong>. Are you sure you want to ${action}? You may be interfering with someone else's broadcast.`, null, () => {
                cb();
            });
        } else {
            cb();
        }
    }
}