// This class manages messages/chat from a host level

class WWSUmessages extends WWSUdb {

    /**
     * The class constructor.
     * 
     * @param {sails.io} socket The sails.io socket connected to the WWSU API.
     * @param {WWSUmeta} meta initialized WWSU meta class
     * @param {WWSUhosts} hosts initialized hosts class
     * @param {WWSUreq} hostReq Request with host authorization
     */
    constructor(socket, meta, hosts, hostReq) {
        super();

        this.endpoints = {
            get: '/messages/get',
            remove: '/messages/remove',
            send: '/messages/send'
        };
        this.data = {
            get: {}
        };
        this.requests = {
            host: hostReq,
        };

        this.meta = meta;
        this.hosts = hosts;

        this.assignSocketEvent('messages', socket);
    }

    // Initialize connection. Call this on socket connect event.
    init () {
        this.replaceData(this.requests.host, this.endpoints.get, this.data.get);
    }

    /**
     * Send a message via WWSU API.
     * 
     * @param {object} data Data to pass to WWSU API
     * @param {?function} cb Callback function after request is completed.
     */
    send (data, cb) {
        try {
            this.requests.host.request({ method: 'post', url: this.endpoints.send, data }, (response) => {
                if (response !== 'OK') {
                    $(document).Toasts('create', {
                        class: 'bg-danger',
                        title: 'Error sending message',
                        body: 'There was an error sending the message. Please report this to the engineer.',
                        autoHide: true,
                        delay: 10000,
                        icon: 'fas fa-skull-crossbones fa-lg',
                    });
                    if (typeof cb === 'function') {
                        cb(false);
                    }
                } else {
                    if (typeof cb === 'function') {
                        cb(true);
                    }
                }
            })
        } catch (e) {
            $(document).Toasts('create', {
                class: 'bg-danger',
                title: 'Error sending message',
                body: 'There was an error sending the message. Please report this to the engineer.',
                autoHide: true,
                delay: 10000,
                icon: 'fas fa-skull-crossbones fa-lg',
            });
            if (typeof cb === 'function') {
                cb(false);
            }
            console.error(e);
        }
    }
}