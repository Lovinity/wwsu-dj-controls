/* global WWSUdb */

// This class manages directors from WWSU.
class WWSUapi {

    /**
     * Construct the directors.
     * 
     * @param {sails.io} socket The socket connection to WWSU
     * @param {WWSUreq} noReq A request with no authorization
     * @param {WWSUreq} hostReq A request with no authorization
     * @param {WWSUreq} djReq A request with no authorization
     * @param {WWSUreq} directorReq A request with no authorization
     * @param {WWSUreq} adminDirectorReq A request with no authorization
     */
    constructor(noReq, hostReq, djReq, directorReq, adminDirectorReq) {
        this.requests = {
            no: noReq,
            host: hostReq,
            dj: djReq,
            director: directorReq,
            adminDirector: adminDirectorReq
        };

        this.dom;
    }

    /**
     * Make API query to WWSU
     * 
     * @param {string} path sails.js URL path
     * @param {string} req this.requests key indicating which WWSUreq to use.
     * @param {object} data Data to pass to API
     * @param {function} cb Callback executed. Parameter is returned data from WWSU.
     */
    query (path, req, data, cb) {
        try {
            this.requests[ req ].request({ dom: this.dom, method: 'post', url: path, data }, (response) => {
                if (typeof cb === 'function') {
                    cb(response);
                }
            })
        } catch (e) {
            $(document).Toasts('create', {
                class: 'bg-danger',
                title: 'Error making API query',
                body: 'There was an error making the API query. Please report this to the engineer.',
                icon: 'fas fa-skull-crossbones fa-lg',
            });
            console.error(e);
        }
    }

    /**
     * Initialize Alpaca form for API query.
     * 
     * @param {*} dom DOM query string where to generate the form.
     */
    initApiForm (dom) {
        this.dom = dom;
        $(dom).alpaca({
            "schema": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "title": "API / URL Path",
                        "required": true
                    },
                    "req": {
                        "type": "string",
                        "title": "Authorization to use",
                        "enum": [ 'Select One', 'no', 'host', 'dj', 'director', 'adminDirector' ],
                        "required": true
                    },
                    "data": {
                        "type": "string",
                        "title": "JSON data to send to API",
                    },
                    "response": {
                        "type": "string",
                        "title": "Response from server"
                    }
                }
            },
            "options": {
                "fields": {
                    "path": {
                        "helper": "If using relative path, must begin with a /."
                    },
                    "data": {
                        "type": "json"
                    },
                    "response": {
                        "type": "textarea",
                    }
                },
                "form": {
                    "buttons": {
                        "submit": {
                            "title": "Submit Query",
                            "click": (form, e) => {
                                form.refreshValidationState(true);
                                if (!form.isValid(true)) {
                                    form.focus();
                                    return;
                                }
                                var value = form.getValue();
                                console.dir(value);
                                this.query(value.path, value.req, value.data, (response) => {
                                    form.setValue({ path: value.path, req: value.req, data: value.data, response: JSON.stringify(response) })
                                });
                            }
                        }
                    }
                }
            },
        });
    }
}