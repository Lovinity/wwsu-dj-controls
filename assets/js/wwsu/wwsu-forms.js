
// Class for building and managing forms
class WWSUForm {

    constructor(dom) {
        this._dom = dom;
        this._inputs = [];
        this._buttons = [];
        this._id = ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
            (c ^ window.crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
    }

    addItem(options) {
        var html = `<div class="form-group p-1" title="${options.title || ``}">`;
        delete options.title;
        if (options.label)
            html += `<label for="${this._id}-${options.name}">Station Website URL</label>`;
        delete options.label;
        delete options.id;
        options.class = options.class || `form-control`;
        html += `<input type="${options.type}" id="${this._id}-${options.name}" class="form-control"`;
        delete options.name;
        for (var key in options)
        {
            if (options.hasOwnProperty(key))
            {
                if (options[key] !== null)
                {
                    html += ` ${key}="${options[key]}"`;
                } else {
                    html += ` ${key}`;
                }
            }
        }
        html += `>`;
        html += `</div>`;
    }

}
;


