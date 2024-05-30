"use strict";

import { sanitizeValue } from "./utils.js";
import { ErrorToaster } from "./elements.js";

/**
 * encapsulate visibility controls for an object
 */
class MetaBoxVisibilityControl
{
    #element = null;
    static #hideClassName = "meta-box-hide";

    constructor() {}

    setup(element) { this.#element = element; }

    hide()
    {
        if (this.#element === null)
        {
            ErrorToaster.showError("MetaBoxVisibilityControl won't work with empty elements, call setup");
            return;
        }
        this.#element.classList.add(MetaBoxVisibilityControl.#hideClassName);
    }

    show()
    {
        if (this.#element === null)
        {
            ErrorToaster.showError("MetaBoxVisibilityControl won't work with empty elements, call setup");
            return;
        }
        this.#element.classList.remove(MetaBoxVisibilityControl.#hideClassName);
    }
}


/**
 * generates a meta box which is a container that has multiple meta lines
 * each line is a key-value
 */
class MetaBox extends MetaBoxVisibilityControl
{
    #name = null;
    #metaChildElements = [];
    #metaParent = null;
    #parent = null;
    #created = false;

    /////////// ctor ///////////////

    constructor(name, parent)
    {
        super();
        this.#name = name;
        this.#parent = parent;
        this.#created = false;
    }

    /////////// private ///////////////

    /**
     * sanitize a meta key name
     * @param {string} keyname a string of a meta line
     * @returns a sanitized name of the meta line key
     */
    #sanitizeKey(keyname)
    {
        switch(keyname)
        {
            case "nb_streams" : return "stream #";
            case "nb_programs" : return "programs #";

        }

        return keyname.replace(/[\-_]+/g," ");
    }

    /**
     * meta box may have longer than usual meta lines
     * this will asses the length of the meta line and give it
     * a appropriate class
     * Note: hard coded values are font family/size related
     * @param {string} value the meta line value
     * @returns the class name to use with the meta line according to the meta value
     */
    #getClassNameFromValueLength(value)
    {
        const numOfCharMakesLongestData = 65;
        const numOfCharMakesLongData = 35;
        const len = value.length;
        if (len >= numOfCharMakesLongestData) { return 'longest-meta-val'; }
        if (len >= numOfCharMakesLongData) { return 'long-meta-val'; }
        return 'normal-meta-val';
    }

    /**
     * generate the meta val dom element for simple text meta value
     * @param {string} value the meta value as text for a meta line
     * @returns DOM element containing the meta value text
     */
    #generateTextElement(value)
    {
        let val = document.createElement("span");
        val.classList.add('meta-val');
        val.setAttribute('title', value);
        val.innerText = value;
        return val;
    }

    /////////// public ///////////////

    /**
     * generate a meta box DOM element and adds it to the DOM document
     * if called multiple times will only generate one DOM element
     */
    gen()
    {
        if (this.#created) { return; }
        this.#metaParent = document.createElement("ul");
        this.#metaParent.classList.add("meta-box");
        this.#metaParent.classList.add("meta-box-"+this.#name);

        this.#parent.append(this.#metaParent);
        this.setup(this.#metaParent);
        this.#created = true;
    }

    /**
     * pushes a new meta line into the meta box DOM element
     * @param {string} name meta key of the meta line
     * @param {any} value can be a bool/number/string/DOM element
     * @param {boolean} prepend adding the meta line in the start of the meta box (else added in the end)
     */
    push(name, value, prepend = false)
    {
        if (!this.#created)
        {
            ErrorToaster.showError("meta box push was called before it was created");
            return;
        }
        let key = document.createElement("span");
        key.classList.add('meta-key');
        key.innerText = this.#sanitizeKey(name);

        let val = null;
        switch (typeof value)
        {
            case "boolean":
            case "number":
            case "string":
                val = this.#generateTextElement( sanitizeValue(value, name) );
                break;
            case "object": // it's an DOM element
                val = value;
                val.classList.add('meta-val');
                break;
        }

        if (val == null)
        {
            ErrorToaster.showError("meta box value is undefined");
            return;
        }

        let line = document.createElement("li");
        line.classList.add(this.#getClassNameFromValueLength(value));
        line.append(key);
        line.append(val);

        // add meta line to the meta box
        this.#metaChildElements.push(line);
        if (prepend)
        {
            this.#metaParent.prepend(line);
        }
        else
        {
            this.#metaParent.append(line);
        }
        this.show();
    }

    /**
     * clears all the meta lines from the meta box
     */
    clear()
    {
        if (!this.#created)
        {
            ErrorToaster.showError("meta box clear was called before it was created");
            return;
        }

        for (let elem of this.#metaChildElements)
        {
            this.#metaParent.removeChild(elem);
        }
        this.#metaChildElements = [];
        this.hide();
    }

};


/**
 * generates a meta box which is a container that has multiple meta lines
 * each line is a key-value
 * this implementation will create a meta box that can be collapsed
 * Note: this implementation encapsulates the MetaBox elements and adds to it
 * like the decoration pattern
 */
class MetaBoxCollapsible extends MetaBoxVisibilityControl
{
    #name = null;
    #metaBox = null;
    #metaParent = null;
    #parent = null;
    #created = false;

    /////////// ctor ///////////////

    constructor(name, parent)
    {
        super();
        this.#name = name;
        this.#parent = parent;
        this.#created = false;
    }

    /////////// public ///////////////

    /**
     * generates the collapsible meta box and adds it to the DOM document
     * if called multiple times will only generate one DOM element
     */
    gen()
    {
        if (this.#created) { return; }
        this.#metaParent = document.createElement("details");
        let summary = document.createElement("summary");
        summary.innerText = this.#name;
        this.#metaParent.append(summary);
        this.#metaParent.classList.add("meta-box-"+this.#name);
        this.#metaParent.classList.add("collapsible-meta");

        this.#metaBox = new MetaBox(this.#name, this.#metaParent);
        this.#metaBox.gen();

        this.#parent.append(this.#metaParent);
        this.setup(this.#metaParent);
        this.#created = true;
    }

    /**
     * pushes a new meta line into the meta box DOM element
     * @param {string} name meta key of the meta line
     * @param {any} value can be a bool/number/string/DOM element
     * @param {boolean} prepend adding the meta line in the start of the meta box (else added in the end)
     */
    push(key, value, prepend = false)
    {
        if (!this.#created)
        {
            ErrorToaster.showError("meta box collapsible push was called before it was created");
            return;
        }
        this.#metaBox.push(key, value, prepend);
        this.show();
    }

    /**
     * clears all the meta lines from the meta box
     */
    clear()
    {
        if (!this.#created)
        {
            ErrorToaster.showError("meta box collapsible clear was called before it was created");
            return;
        }
        this.#metaBox.clear();
        this.#metaParent.removeAttribute("open");
        this.hide();
    }

};

/**
 * generates the screen with all the media details of a video file
 */
export class MediaDetails
{
    #mainTitleElement = null;
    #subTitleElement = null;
    #links = null;
    #linkElements = {};
    #metaBoxes = {};
    #parent = null;
    #warning = null;
    #MetaSectionType = Object.freeze({
        Collapse:0,
        Static:1
    });

    constructor(parentElement)
    {
        this.#parent = parentElement;
    };

    /**
     * return the available section types supported by this MediaDetails view
     */
    get sectionType() { return this.#MetaSectionType; }

    /**
     * set main title of the MediaDetails view
     * will generate the DOM Element if doesn't exist
     * @param {string} titleString title of the media
     */
    set title(titleString)
    {
        if (this.#mainTitleElement === null)
        {
            this.#mainTitleElement = document.createElement("h2");
            this.#mainTitleElement.classList.add("main-title");
            this.#parent.appendChild(this.#mainTitleElement);
        }
        this.#mainTitleElement.innerText = titleString;
    };

    /**
     * set sub title of the MediaDetails view
     * will generate the DOM Element if doesn't exist
     * @param {string} subtitleString subtitle of the media
     */
    set subtitle(subtitleString)
    {
        if (this.#subTitleElement === null)
        {
            this.#subTitleElement = document.createElement("h4");
            this.#subTitleElement.classList.add("sub-title");
            this.#parent.appendChild(this.#subTitleElement);
        }
        this.#subTitleElement.innerText = subtitleString;
    }

    /**
     * set a warning in the media meta data, initial call to this
     * will set the warning in the DOM and other calls will just
     * update the message in the warning
     * empty messages will add the element in the DOM but it'll be 
     * hidden, messages with content will make the message show
     * so if you want to hide it send an empty message and vice versa
     * will generate the DOM Element if doesn't exist
     * @param {string} message message for the warning
     */
    set warning(message)
    {
        const hideCls = 'warning-hide';
        if (this.#warning === null)
        {
            this.#warning = document.createElement("span");
            this.#warning.classList.add("warning");
            this.#parent.appendChild(this.#warning);
        }
        if (message.length === 0)
        {
            this.#warning.classList.add(hideCls);
            this.#warning.innerText = "";
        }
        else
        {
            this.#warning.classList.remove(hideCls);
            this.#warning.innerText = message;
        }
    }


    set youtube(name)
    {
        const q = name+" promo trailer";
        const urlQuery = window.encodeURIComponent(q);
        this.#addLink("https://www.youtube.com/results?search_query="+urlQuery, 'youtube', 'youtube');
    }

    set imdb(name)
    {
        const urlQuery = window.encodeURIComponent(name);
        this.#addLink("https://www.imdb.com/find/?q="+urlQuery, 'imdb', 'imdb');
    }

    #addLink(url, type, name)
    {
        if (this.#links === null)
        {
            this.#links = document.createElement("div");
            this.#links.classList.add("media-links");
            this.#parent.append(this.#links);
        }
        if (this.#linkElements.hasOwnProperty(type))
        {
            this.#linkElements[type].href = url;
        }
        else
        {
            const link  = document.createElement("a");
            link.href = url;
            link.target = "about:blank";
            link.classList.add('media-link-'+type);
            link.innerText = name;
            this.#linkElements[type] = link;
            this.#links.append(link);
        }
    }

    /**
    * add a meta box to the MediaDetails
    * @param {string} id  uuid of the metabox (used to only generate the same metabox once)
    * @param {MetaSectionType} sectionType type of metabox to add
    */
    #addMetaBox(id, sectionType)
    {
        if ( this.#metaBoxes.hasOwnProperty(id) )
        {
            return;
        }

        let metaBox = null;
        switch (sectionType)
        {
            case this.#MetaSectionType.Static:
                metaBox = new MetaBox(id, this.#parent);
                break;
            case this.#MetaSectionType.Collapse:
                metaBox = new MetaBoxCollapsible(id, this.#parent);
                break;
        }

        if (null !== metaBox)
        {
            metaBox.gen();
            this.#metaBoxes[id] = metaBox;
        }
    }

    /**
     * add meta line to a meta box (create the meta box if doesn't exist)
     * @param {string} id uuid of the meta box to add a line to
     * @param {string} name the name of the meta box line
     * @param {any} value bool/number/string/DOM Element value of the meta box line
     * @param {MetaSectionType} type (optional. default: Static) type of the meta box
     * @param {boolean} prepend adding the meta line in the start of the meta box (else added in the end)
     */
    addMeta(id, name, value, type = this.#MetaSectionType.Static, prepend = false)
    {
        this.#addMetaBox(id, type);

        this.#metaBoxes[id].push(name,value,prepend);
    }

    /**
     * clear all meta boxes from values
     */
    clearMeta()
    {
        for (let meta of Object.values(this.#metaBoxes))
        {
            meta.clear();
        }
    }
};