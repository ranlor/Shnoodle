"use strict";

import { sanitizeValue } from "./utils.js";
import { ErrorToaster, LoadingScreen } from "./elements.js";

/**
 * generate a sort button
 * clicking it will sort the given DOM elements
 * by the sort action and property name
 * a sort action will be done on each click of the
 * button
 */
class FSSortButton
{
    #element = null;
    #reorderList = [];
    #elementsMetaData = [];
    #elementsToSort = {};
    #sortAction =  (a,b) => { return 0; }
    #propName = "";
    #label = "";
    #id = "";

    /**
     * @param {string} label the label of the button
     * @param {string} id unique identifier for the button
     */
    constructor(label, id)
    {
        this.#label = label;
        this.#id = id;
    }

    /**
     * list of elements to sort, the element list structure:
     * { <element key> : <dom element>, ... }
     * @param {Object} elements
     */
    set elementsToSort(elements) { this.#elementsToSort = elements; }

    /**
    * list of elements meta data with the same keys as the elementsToSort
    * { <element key> : { name: "...", mod: 123, size: 432}, ... }
    * @param {Object} elements
    */
    set elementsMetaData(elements) { this.#elementsMetaData = elements; }

    /**
     * @param {string} propertyName a property that exists in elementsMetaData
     */
    set propertyToSortBy(propertyName) { this.#propName = propertyName; }

    /**
     * @param {(a: any, b: any) => number} callback to be sorted by return -1/0/1
     */
    set sortCallback(callback) { this.#sortAction = callback; }

    /**
     * get the button element with a onclick event already set
     */
    get button()
    {
        this.#element = this.#makeSortBtn();
        return this.#element;
    }

    /**
     * callback to sort elements by given elements
     * the sort list will only be created on the first call
     * but the reordering of the elements will happen on each click
     */
    makeSortBtnAction()
    {
        if (this.#reorderList.length === 0)
        {
            if (Object.keys(this.#elementsMetaData).length === 0) { ErrorToaster.showError("Metadata is empty, it could be that the wrong list was supplied or the list supplied was reallocated"); }
            for (let key of Object.keys(this.#elementsMetaData))
            {
                if (!this.#elementsMetaData[key].hasOwnProperty(this.#propName)) { throw new Error("no property "+this.#propName+" in object ",this.#elementsMetaData);  }

                this.#reorderList.push( { 'key' : key, 'sort' : this.#elementsMetaData[key][this.#propName] } );
            }

            this.#reorderList.sort(this.#sortAction);
        }

        for (const obj of this.#reorderList)
        {
            this.#elementsToSort[obj.key].parentElement.append(this.#elementsToSort[obj.key]);
        }
    }

    /**
     * generate the sort button add a click event and return it
     * @returns a DOM element of a sort button with attached events
     */
    #makeSortBtn()
    {
        let sortButton = document.createElement("div");
        sortButton.classList.add("sort-button");
        sortButton.classList.add("sort-"+this.#id);
        sortButton.innerText = this.#label;
        sortButton.onclick = (e) => { this.makeSortBtnAction(); };
        return sortButton;
    }

};

/**
 * attach click events to a DOM menu links
 * for each link click event will trigger according to it's
 * data-action value.
 * also add the selected state when menu button is clicked
 */
export class MediaMenu
{
    #menuElements = null;
    #actionCallbacks = null;
    static #actionAttr = "data-action";

    /**
     * initializes the menu events
     * @param {DOMElement} parentElement menu element to look for links in
     * @param {Object} actionCallbacks an object which keys are data-action of the link
     * elements and values are the callback you want to trigger on click
     */
    constructor(parentElement, actionCallbacks)
    {
        let menu = parentElement.getElementsByClassName("mediaMenu")[0];
        this.#menuElements = menu.getElementsByTagName("a");
        this.#actionCallbacks = actionCallbacks;
        this.#setCallbacks();
    }

    /**
     * clear selected state from all menu buttons
     */
    clearSelectedState()
    {
        for (let menuButton of  this.#menuElements)
        {
            menuButton.classList.remove("selected");
        }
    }

    /**
     * trigger the onclick event on the menu button at index given
     * @param {number} index index number of the menu item
     */
    triggerMenuElement(index)
    {
        let i = 0;
        for (let menuButton of  this.#menuElements)
        {
            if (index === i)
            {
                menuButton.click();
                return;
            }
            i++;
        }
    }

    /**
     * trigger the onclick event on the menu button with the data-action
     * @param {string} buttonActionName data-action value of menu button
     */
    triggerMenuElementFromAction(buttonActionName)
    {
        for (let menuButton of  this.#menuElements)
        {
            const actionName = menuButton.getAttribute(MediaMenu.#actionAttr);
            if (actionName == buttonActionName)
            {
                menuButton.click();
                return;
            }
        }
    }

    /**
     * set the callback for every menu button according to the
     * data-action attribute
     */
    #setCallbacks()
    {
        for (let menuButton of  this.#menuElements)
        {
            menuButton.classList.remove("selected");
            menuButton.onclick = (e) => {
                this.clearSelectedState();
                e.target.classList.add("selected");
                const action = menuButton.getAttribute(MediaMenu.#actionAttr);
                this.#actionCallbacks[action]();
            }
        }
    }
};


/**
 * Base class of the media presentation
 * class will get a media list and will call
 * paint methods on each list entry and add a onclick event to it
 * when used multiple times the DOM Element generation will happen
 * one and cached
 */
class MediaPresentation
{
    canvas = null;
    #name = null;
    #elementCache = [];
    #onclick = (uuid, mediaInfo) => {};

    /**
     * initialize MediaPresentation base class
     * @param {DOMElement} parentElement element to paint on to
     * @param {string} name the name and css class name of the presentation
     */
    constructor(parentElement, name)
    {
        this.canvas = parentElement;
        this.#name = name;
    }

    /**
     * parent method to be overridden by extending implementation
     * return the element added to the page in order to cache it for future paintings
     * if null is returned then that element will not be cached and will not be
     * repainted in future calls to paint
     * @param {string} mediaUUID the uuid of the media related to the element
     * @param {object} mediaInfo object containing all the meta data related to the element
     * @return null or dom element
     */
    addMediaElement(mediaUUID, mediaInfo)
    {
        throw new Error("addMediaElement method is not overridden by extending implementation");
    }

    /**
     * actions to execute before painting elements to the canvas
     * regardless if those elements are cached or not
     */
    prePaintProcess()
    {
        throw new Error("prePaintProcess method is not overridden by extending implementation");
    }

    /**
     * actions to execute after painting elements to the canvas
     * regardless if those elements are cached or not
     */
    postPaintProcess()
    {
        throw new Error("postPaintProcess method is not overridden by extending implementation");
    }

    /**
     * @param {function(uuid, mediainfo)} callback - onclick callback that will get the uuid and media info of the media element
     */
    set onclick(callback)
    {
        this.#onclick = callback;
    }

    /**
     * invoke the click event on an element to be used by implementing logic (that's why it's not private)
     * @param {string} uuid  the uuid of the media list element
     * @param {Object} mediaInfo object with info of the media list elements
     */
    invokeOnClick(uuid, mediaInfo) { this.#onclick(uuid, mediaInfo); }


    /**
     * paints the elements to the DOM Tree how elements are actually painted is done by the implementing logic
     * after the initial call implementing logic to paint the specific elements (addMediaElement) will not be
     * called since the cached elements will be use to repaint on the DOM Tree.
     * before painting a call to prePaintProcess will be invoked (regardless of using cached elements or not)
     * after painting a call to postPaintProcess will be invoked (regardless of using cached elements or not)
     * parent element we paint no will be hidden while painting to prevent multiple reflow triggers in DOM Tree
     * @param {Object} mediaData object with media name as keys and media info as values
     */
    paint(mediaData)
    {
        window.showLoadingFullscreen();
        this.canvas.style="display:none;"; // hide to prevent constant reflow event and get 100% cpu
        this.canvas.innerHTML = "";
        this.canvas.setAttribute("class","");

        this.canvas.classList.add(this.#name);

        // paint/do any other data/actions specific to the type of presentation
        this.prePaintProcess();

        // if available use cache:
        if (this.#elementCache.length > 0)
        {
            for (let element of this.#elementCache)
            {
                this.canvas.append(element);
            }
        }
        else
        {
            // generate the elements on the page and save them to a cache
            for (let mediaItem in mediaData)
            {
                let element = this.addMediaElement(mediaItem, mediaData[mediaItem]);
                if (element !== null) { this.#elementCache.push(element); }
            }
        }

        // paint/do any other data/actions specific to the type of presentation
        this.postPaintProcess();

        this.canvas.style=""; // show all the elements to make a single reflow event
        window.hideLoadingFullscreen();
    }
}


/**
 * a list presentation of media list , this presentation includes a search bar and shows
 * each media list entry as the title and type alone
 */
export class MediaPresentationList extends MediaPresentation
{
    #searchElement = null;
    #searchElements = {};
    #searchElementKey = {
        uuidSep: "<:>",
        getUniqueSearchKey: function(mediaInfo, mediaUUID, extraData)
        {
            return mediaInfo.name.toLowerCase()+" "+extraData+this.uuidSep+mediaUUID;
        },
        getSearchTermsFromUniqueKey: function(key)
        {
           const element = key.split(this.uuidSep);
           if (element.length < 2) { return ""; }
           return element[0];
        }
    };

    constructor(canvas)
    {
        super(canvas,"present-list-view");

    }

    /**
     * check if all strings in components is found inside str
     * @param {string} searchKey a uuid search key to get search terms from
     * @param {[string]} components array of strings to find in str
     * @returns true if all components are in str else false
     */
    #componentsInString(searchKey, components)
    {
        if (components.length == 0) { return true; }
        const searchTerm = this.#searchElementKey.getSearchTermsFromUniqueKey(searchKey);
        let ret = true;
        for (let comp of components)
        {
            ret = ret & searchTerm.includes(comp);
        }
        return ret;
    }

    /**
     * hide all elements failing the search keywords and show all the rest
     * @param {string} searchTerm what to search for
     */
    #filterResults(searchTerm)
    {
        searchTerm = searchTerm.toLowerCase();
        const searchComponents = searchTerm.split(" ").filter((c) => { return c.length > 0;});
        for (let searchKey in this.#searchElements)
        {
            if (this.#componentsInString(searchKey, searchComponents))
            {
                this.#searchElements[searchKey].classList.remove("hide-search-result");
            }
            else
            {
                this.#searchElements[searchKey].classList.add("hide-search-result");
            }
        }
    }

    /**
     * create the DOM element for the search mechanism
     * @returns DOM element for search
     */
    #makeSearchElement()
    {
        let textbox = document.createElement("input");
        textbox.type="search";
        textbox.placeholder="look for show/movie";
        textbox.classList.add("search-box");
        textbox.oninput = (e) => { this.#filterResults(e.target.value); }
        return textbox;
    }

    // -- parent methods -- //

    /**
     * before painting make the search element and add it to the DOM (once)
     */
    prePaintProcess()
    {
        if (this.#searchElement == null)
        {
            this.#searchElement = this.#makeSearchElement();
        }
        this.canvas.append(this.#searchElement);
    }

    postPaintProcess() {}

    /**
     * paint the media list item as title and media type
     * @param {uuid} mediaUUID  uuid of the media list entry
     * @param {Object} mediaInfo a object containing the info of the media list entry
     * @returns DOM element of a media list as title and media type
     */
    addMediaElement(mediaUUID, mediaInfo)
    {
        let metadataBox = document.createElement("span");

        if (mediaInfo.metadata.hasOwnProperty("episode"))
        {
            metadataBox.innerText = mediaInfo.metadata.episode;
            metadataBox.classList.add('metaBoxShow');
        }
        else
        {
            metadataBox.innerText = mediaInfo.metadata.type;
            metadataBox.classList.add('metaBoxMovie');
        }
        metadataBox.classList.add("metaBox");

        let mediaLink = document.createElement("a");
        mediaLink.innerText = mediaInfo.name;
        mediaLink.href = "#" + mediaUUID;
        mediaLink.title = mediaInfo.actual_name;
        mediaLink.classList.add("mediaLink");
        mediaLink.onclick = (e) => {
            window.seasonAutoPlay.invalidate();
            super.invokeOnClick(mediaUUID, mediaInfo);
        }

        let mediaBox = document.createElement("div");
        mediaBox.classList.add("mediaBox");


        mediaBox.append(mediaLink);
        mediaBox.append(metadataBox);

        this.canvas.append(mediaBox);
        const searchKey = this.#searchElementKey.getUniqueSearchKey(mediaInfo, mediaUUID, metadataBox.innerText.toLocaleLowerCase());
        this.#searchElements[searchKey] = mediaBox;
        return mediaBox;
    }
};

/**
 * a file system presentation of media list , this presentation includes
 * the media files with their fs name + size + modification time
 * a collapsible directory tree for the media list entries
 * add sort buttons which will sort directories and files
 */
export class MediaPresentationFiles extends MediaPresentation
{
    #cache = {};
    #parent = null;
    #updatedDirectoriesMeta = false;
    static #dirClassID = "dir-view";
    static #fileClassID = "file-view";
    static #fsSeparator = "/"; // windows: "\s"

    #FSElem = {
        name: "",
        mod: 0,
        size: 0
    };
    // a list of FSElem objects with cacheKeys
    #metaList = {};

    // -- tool bar elements
    #toolbar = null;
    #nameSortButton = null;
    #sizeSortButton = null;
    #modSortButton = null;

    /**
     * generate file system presentation view
     * @param {DOMElement} canvas where to add DOM elements
     */
    constructor(canvas)
    {
        super(canvas,"present-fs-view");

        // initialize sort buttons
        this.#nameSortButton = new FSSortButton("filename", "ab");
        this.#nameSortButton.elementsToSort = this.#cache;
        this.#nameSortButton.elementsMetaData = this.#metaList;
        this.#nameSortButton.propertyToSortBy = "name";
        this.#nameSortButton.sortCallback = (a,b) => { return a.sort.localeCompare(b.sort); };

        this.#sizeSortButton = new FSSortButton("size","sz");
        this.#sizeSortButton.elementsToSort = this.#cache;
        this.#sizeSortButton.elementsMetaData = this.#metaList;
        this.#sizeSortButton.propertyToSortBy = "size";
        this.#sizeSortButton.sortCallback = (a,b) => { return b.sort - a.sort; };

        this.#modSortButton = new FSSortButton("modified","md");
        this.#modSortButton.elementsToSort = this.#cache;
        this.#modSortButton.elementsMetaData = this.#metaList;
        this.#modSortButton.propertyToSortBy = "mod";
        this.#modSortButton.sortCallback = (a,b) => { return b.sort - a.sort; };

    }

    /**
     * generate the DOM elements for each media list entry with name, size, modification time
     * @param {DOMElement} parent where to append the entry row
     * @param {string} name the name of the directory/file
     * @param {Object} attributes size,mod time for the file/directory
     */
    #rowAttributes(parent, name, attributes)
    {
        let title = document.createElement("span");
        title.classList.add("attr");
        title.classList.add("name");
        title.innerText = name;
        parent.setAttribute("data-name", name);

        let size = document.createElement("span");
        size.classList.add("attr");
        size.classList.add("size");
        size.innerText = sanitizeValue(attributes.size, 'size');
        parent.setAttribute("data-size", attributes.size);

        let mod = document.createElement("span");
        mod.classList.add("attr");
        mod.classList.add("mod");
        mod.innerText = sanitizeValue(attributes.modified_date, 'mod time');
        parent.setAttribute("data-mod", attributes.modified_date);

        parent.append(title);
        parent.append(size);
        parent.append(mod);
    }

    /**
     * make a collapsible element which will act as a directory that can be
     * opened and closed
     * @param {string} name the name of the directory
     * @param {Object} info size,mod time for the directory
     * @returns DOMElement for the collapsible directory
     */
    #makeCollapseElement(name, info)
    {
        let details = document.createElement("details");
        let summary = document.createElement("summary");
        this.#rowAttributes(summary, name, info);
        details.append(summary);
        details.classList.add(MediaPresentationFiles.#dirClassID);
        return details;
    }

     /**
     * make a element which will act as a file entry
     * @param {string} name the name of the directory
     * @param {string} uuid uuid of the media list entry
     * @param {Object} info size,mod time for the directory
     * @returns DOMElement file entry
     */
    #makeFilenameElement(name, uuid, info)
    {
        let filename = document.createElement("div");
        this.#rowAttributes(filename, name, info);
        filename.classList.add("mediaLink");
        filename.classList.add(MediaPresentationFiles.#fileClassID);
        filename.onclick = (e) =>
        {
            window.seasonAutoPlay.invalidate();
            super.invokeOnClick(uuid, info);
        }
        return filename;
    }

    /**
     * generate a unique cache key from path components until we reach index
     * @param {number} index index in components where we need to stop using for cache key
     * @param {[string]} components components of a path
     * @returns a unique cache key which includes the components until index
     */
    #cacheKey(index, components)
    {
        let key = "";
        let sep = "";
        for (let i=0; i<=index; ++i)
        {
            key += sep + components[i];
            sep = ":#:";
        }
        return key;

    }

    /**
     * recursive method, will call itself with path components
     * each recursive call goes down the path levels from max-level -> 1
     * where level 1 is where the path ends
     * @param {int} level component levels, 1 means end of the path
     * @param {Array(string)} components consecutive components of a fs path ('bin','usr','bash')
     * @param {string} uuid the id of the media file the path belong to
     * @param {obj} info metadata of the media file
     * @param {DOmElement} elem parent element to append to
     * @returns either the top level DOMElement added to the DOMTree or null if no new top level
     * element was added (i.e. only child element added)
     */
    #addToTree(level, components, uuid, info, elem)
    {
        let componentIndex = components.length - level;
        let name = components[ componentIndex ];
        if (level === 1)
        {
            let filename = this.#makeFilenameElement(name, uuid, info);
            elem.append(filename);

            if (components.length === 1) // if this element has no parents
            {
                // caching for sorting purposes rather than caching purposes
                this.#cache[this.#cacheKey(componentIndex, components)] = filename;
                return filename;
            }
            else // return the parent element (or null if that element was already returned)
            {
                return this.#parent;
            }
        }

        let cacheKey = this.#cacheKey(componentIndex, components);
        if (!this.#cache.hasOwnProperty(cacheKey))
        {
            let e = this.#makeCollapseElement(name, info);
            this.#cache[cacheKey] = e;
            elem.append(e);

            // we save the parent only when it's a new element
            // otherwise the parent returned is null
            // this will allow the calling logic only cache the
            // top level elements once
            if (this.#parent === null && level == components.length)
            {
                this.#parent = this.#cache[cacheKey];
            }
        }

        return this.#addToTree(level-1, components, uuid, info, this.#cache[cacheKey]);
    }

    /**
     * go over elements in cache,
     * if they have dir/file children then accumulate their sizes as the parent directory size
     * and update the modified time of the directory to it's earliest modified child
     *
     * use mutation events on the elements to catch the meta attribute change and update the
     * size and mod time elements with the new meta data accordingly (i.e. size meta is updated
     * then update the span showing the size also)
     */
    #updateDirectoriesMetadata()
    {
        if (this.#updatedDirectoriesMeta) { return; }
        let updateChildrenOnAttributeChange = (mutationList) =>
        {
            for (const mutation of mutationList)
            {
                if (mutation.type === "attributes")
                {
                    let newValue = mutation.target.getAttribute(mutation.attributeName);
                    switch(mutation.attributeName)
                    {
                        case "data-size":
                            mutation.target.children[1].innerText = sanitizeValue(newValue, 'size');
                            break;
                        case "data-mod":
                            mutation.target.children[2].innerText = sanitizeValue(newValue, 'mod time');
                            break;
                    }
                }
            }
        };

        const observer = new MutationObserver(updateChildrenOnAttributeChange);
        observer.observe(this.canvas, { attributes: true, subtree: true });

        for (let key in this.#cache)
        {
            let ref = this.#cache[key];
            let files = ref.querySelectorAll("."+MediaPresentationFiles.#fileClassID);
            if (files.length === 0) { continue; }
            let size = 0;
            let modTime = (Date.now() + 1000) + 0.0;
            for (let file of files)
            {
                size += parseInt(file.getAttribute("data-size"));
                let cmod = parseFloat(file.getAttribute("data-mod"));
                if ( cmod < modTime) { modTime = cmod; }
            }
            let summary = ref.children[0];
            // mutation observer will get the attribute change
            // and will update the children accordingly
            summary.setAttribute("data-size",size);
            summary.setAttribute("data-mod",modTime);
        }

        // save all unreported mutation events, since they will be removed on disconnect
        let mutations = observer.takeRecords();
        observer.disconnect();
        if (mutations.length > 0) { updateChildrenOnAttributeChange(mutations); }
        this.#updatedDirectoriesMeta = true;
    }

    /**
     * go over all the elements in the cache and save their metadata into
     * a collection that can be used to sort these elements
     */
    #generateFileMetaList()
    {
        if (Object.keys(this.#metaList).length > 0) { return; }
        for (let key in this.#cache)
        {
            let ref = this.#cache[key];
            this.#metaList[key] = { ...this.#FSElem };
            let attrRef = null;
            if (ref.classList.contains(MediaPresentationFiles.#fileClassID))
            {
                attrRef = ref;
            }
            if (ref.classList.contains(MediaPresentationFiles.#dirClassID))
            {
                attrRef = ref.children[0];
            }
            if (attrRef === null)
            {
                console.warn("skipping invalid element "+ref);
                continue;
            }
            this.#metaList[key].name = attrRef.getAttribute('data-name');
            this.#metaList[key].mod = attrRef.getAttribute('data-mod');
            this.#metaList[key].size = attrRef.getAttribute('data-size');
        }
    }

    // -- parent methods -- //

    /**
     * paint the sorting buttons
     */
    prePaintProcess()
    {
        if (this.#toolbar === null)
        {
            this.#toolbar = document.createElement("div");
            this.#toolbar.classList.add("toolbar");
            this.#toolbar.append(this.#nameSortButton.button);
            this.#toolbar.append(this.#sizeSortButton.button);
            this.#toolbar.append(this.#modSortButton.button);
        }
        this.canvas.append(this.#toolbar);
    }

    /**
     * updates the size and mod time of directories representation with the files contained in them
     * generate meta list of all files present in the file system representation to avoid multiple
     * called to DOM tree
     */
    postPaintProcess()
    {
        // both these methods are initialized once
        this.#updateDirectoriesMetadata();
        this.#generateFileMetaList();
    }

    /**
     * generates the directory tree recursively, this means that certain media elements will
     * be added to a directory element already present in the dom, in which case this method
     * will return null, to prevent the same element to be cached twice at the Base Class
     * implementation (i.e. a directory X with 2 files is 2 media list entries that need to
     * only return the parent directory X only once, on first call return the directory, on
     * second call return null)
     * @param {string} mediaUUID uuid of a media list entry
     * @param {Object} mediaInfo meta data of the media list entry
     * @returns DOMElement if the element is a top level file or a directory not added before
     * if the path is the same as previous calls the file entry will just be appended to the
     * directory DOM element, and null will be returned
     */
    addMediaElement(mediaUUID, mediaInfo)
    {
        let pathComponents = mediaInfo.fullpath.split(MediaPresentationFiles.#fsSeparator).filter((c) => { return c.length > 0;});

        if (pathComponents.length === 0) { return null;}
        this.#parent = null;
        let elem = this.#addToTree(pathComponents.length, pathComponents, mediaUUID, mediaInfo, this.canvas);
        return elem;

    }
};



class EpisodesContainer
{
    #parent = null;
    #module = null;
    #listContainer = null;
    #loadImagePromise = (uuid, thumbID) => { return new Promise((resolve, reject) => reject(new Error("missing implementation")))};
    #timeouts = [];
    #backImages = [];
    #backImageAnimationDirection = true;
    static #hideCls = "hide-module";
    static #Meees = [];
    static #backImageFade=0.65;

    constructor(episodes, onClickCallback, imageLoadPromise)
    {
        this.#parent = document.createElement("div");
        this.#parent.classList.add("episode-container-backdrop");
        this.#parent.classList.add("float-module");
        this.#parent.classList.add(EpisodesContainer.#hideCls);

        this.#module = document.createElement("div");
        this.#module.classList.add("episode-container");

        this.#parent.append(this.#module);

        let closeButton = document.createElement("button");
        closeButton.textContent = "X";
        closeButton.classList.add("close-button");
        closeButton.onclick = (e) => {
            this.hide();
            e.stopPropagation();
            window.episodeContainerRef = null;
            return false;
        };
        this.#module.append(closeButton);

        this.#listContainer = document.createElement("div");
        this.#listContainer.classList.add("episode-list-container");
        this.#module.append(this.#listContainer);

        EpisodesContainer.#Meees.push(this);
        this.#paintEpisodes(episodes, onClickCallback);

        this.#loadImagePromise = imageLoadPromise;
    }

    hide()
    {
        this.#parent.classList.add(EpisodesContainer.#hideCls);
        document.body.classList.remove("noScroll");
    }

    static hideAllBrethren()
    {
        for (let brother of EpisodesContainer.#Meees)
        {
            brother.hide();
        }
    }

    show()
    {
        this.#parent.classList.remove(EpisodesContainer.#hideCls);
        document.body.classList.add("noScroll");
        window.episodeContainerRef = this;
    }

    #sortEpisodes(episodes)
    {
        const Season = {
            name: "",
            episodes: []
        };

        let sorted = {};
        const episodeRegex = /s(?<season>[0-9]{1,2})e(?<episode>[0-9]{1,2})/;
        for (const ep of episodes)
        {
            const epMarker = ep.info.metadata.episode.toLowerCase();
            const matches = epMarker.match(episodeRegex);
            if (matches === null) { continue; }
            if (!matches.hasOwnProperty('groups')) { continue; }
            const season = Number(matches.groups.season);
            const episode = Number(matches.groups.episode);
            if (!sorted.hasOwnProperty(season))
            {
                sorted[season] = structuredClone(Season);
                sorted[season].name = "Season "+season;
            }
            sorted[season].episodes.push({ order:episode , data: ep});
        }

        // sort episodes inside a season
        for (let season of Object.values(sorted))
        {
            season.episodes.sort((ep1, ep2) => {
                return ep1.order - ep2.order;
            });
        }

        // no need to sort seasons since their keys are ints
        // and that is sorted automatically in an object

        return sorted;
    }

    #paintEpisodeEntrySection(text, type)
    {
        let section = document.createElement('span');
        section.classList.add('ep-sec-'+type);
        section.textContent = text;
        return section;
    }

    #fadeIn(element,endOpacity)
    {
        return element.animate([
            { opacity: 0 },
            { opacity: endOpacity}
        ],300);
    }

    #fadeOut(element,startOpacity)
    {
        return element.animate([
            { opacity: startOpacity },
            { opacity: 0}
        ],300);
    }

    #panMove(element, duration, direction = false)
    {
        const padding = 10;
        const scale =5;
        const endX=Math.abs(((element.width*scale) - padding) - window.innerWidth);
        const endY=Math.abs(((element.height*scale) - padding) - window.innerHeight);
        return element.animate({
            transform: [ `translate(-${padding}px , -${padding}px) scale(${scale})` , `translate(-${endX}px,-${endY}px) scale(${scale})`],
            transformOrigin: ["0 0","0 0"]
        },{
            duration: duration,
            iterations: Infinity,
            direction: direction ? "alternate-reverse" : "alternate",
            easing: direction ? "ease-in" : "ease-out"
        });
    }

    #removeBackdropImage(imageElement)
    {
        this.#fadeOut(imageElement, EpisodesContainer.#backImageFade).onfinish = (e) => {
            this.#parent.removeChild(imageElement);
        }
    }

    #addBackdropImage(imageElement)
    {
        for (const image of this.#backImages)
        {
            this.#removeBackdropImage(image);
        }
        this.#backImages = [];

        this.#backImages.push(imageElement);
        imageElement.classList.add('episode-backdrop-image');
        this.#parent.append(imageElement);
        this.#fadeIn(imageElement, EpisodesContainer.#backImageFade).onfinish = ()=>{ imageElement.style.opacity = EpisodesContainer.#backImageFade };
        this.#panMove(imageElement, 30*1000, this.#backImageAnimationDirection);
        this.#backImageAnimationDirection = !this.#backImageAnimationDirection;
    }

    #clearTimeouts()
    {
        for (const timeout of this.#timeouts)
        {
            clearTimeout(timeout);
        }
        this.#timeouts = [];
    }

    #setImageWithTimeout(uuid, thumbType, millisec)
    {
        this.#clearTimeouts();

        const timeout = setTimeout( (loadImagePromise, addToDOM) => {
            loadImagePromise()
            .then( imageData => {
                addToDOM(imageData.image)
            })
            .catch( e => ErrorToaster.showError("in loading thumbnail image:",e));
        }
        , millisec,
        // params to timeout:
        ()=>{
            return this.#loadImagePromise(uuid, thumbType)
        },
        (element) => {this.#addBackdropImage(element);}
        );

        this.#timeouts.push(timeout);
    }

    #paintEpisodeListItem(ep,season, onClickCallback)
    {
        let con = document.createElement("li");
        con.classList.add("episode-list-item");

        con.append(this.#paintEpisodeEntrySection(ep.data.info.metadata.episode,'detail'));
        con.append(this.#paintEpisodeEntrySection(ep.data.info.name,'name'));
        con.onclick = (e) => {
            EpisodesContainer.hideAllBrethren();
            window.seasonAutoPlay.validate(season, ep);
            onClickCallback(ep.data.uuid,ep.data.info);
            e.stopPropagation();
            return false;
        };
        con.onmouseenter = (e) => {
            this.#setImageWithTimeout(ep.data.uuid, 2, 500);
        };
        con.onmouseleave = (e) => {
            this.#clearTimeouts();
        };
        return con;
    }

    #paintEpisodeList(season, onClickCallback)
    {
        let episodeList = document.createElement("ul");
        episodeList.classList.add("episode-list");

        for (const ep of season.episodes)
        {
            episodeList.append(this.#paintEpisodeListItem(ep, season, onClickCallback));
        }

        return episodeList;
    }

    #paintSeasonListItem(season, onClickCallback)
    {
        let con = document.createElement("li");
        con.classList.add("season-list-item");

        let seasonCon = document.createElement("details");
        let seasonConName = document.createElement("summary");
        seasonConName.textContent = season.name;
        seasonCon.append(seasonConName);

        seasonCon.append(this.#paintEpisodeList(season, onClickCallback));

        con.append(seasonCon);
        return con;
    }

    #paintEpisodes(episodes, onClickCallback)
    {
        const orderedEpisodes = this.#sortEpisodes(episodes);
        let seasonList = document.createElement("ul");
        seasonList.classList.add("season-list");
        for (const season of Object.values(orderedEpisodes))
        {
            seasonList.append(this.#paintSeasonListItem(season, onClickCallback));
        }

        this.#listContainer.append(seasonList);

    }

    get element() { return this.#parent; }
}

class ImageLoadingStopped extends Error
{
    constructor(message, type)
    {
        super(message);
        this.name = "ImageLoadingStopped";
        this.tye = type
    }
}

/**
 * a box for a poster view of a media file
 * builds the DOM structure of the poster while leaving one
 * api to add images to the using code, this allow a using logic
 * to determine when an image will be loaded
 */
class PosterContainer
{
    #parent = null;
    #title = null;
    #posterContainer = null;
    #imageTypeIndex = 0;
    // array of image types, each number represent a different image type
    // each image type appears once and is unique, so this also behaves
    // as the amount of possible images in the element
    #imageTypes = [1,3];//[1,2,3];
    #uuid = "";
    #info = {};
    #images = [];
    #currentLoadingJobs = {};
    #imageLoadingScreen = null;
    static posterImageCls = 'poster-img';
    static posterCls = 'poster-view';
    static posterContainerCls = 'poster-img-con';
    static aniClasses = ['poster-pan','poster-scan'];//,'poster-tri'];
    static aniDirectionClasses = ['reverse-animation','normal-animation'];

    constructor(mediaUUID, mediaInfo)
    {
        this.#uuid = mediaUUID;
        this.#info = mediaInfo;

        this.#parent = document.createElement('div');
        this.#parent.classList.add(PosterContainer.posterCls);
        this.#parent.setAttribute('data-uuid', mediaUUID);

        this.#title = document.createElement('h3');
        this.#title.innerText = mediaInfo.name;
        this.#parent.append(this.#title);


        if (mediaInfo['metadata'].hasOwnProperty('type'))
        {
            this.#parent.append(this.#makeMetadataBox(mediaInfo['metadata']['type']));
        }


        this.#posterContainer = document.createElement("div");
        this.#posterContainer.classList.add(PosterContainer.posterContainerCls);
        this.#parent.append(this.#posterContainer);

        this.#imageLoadingScreen = new LoadingScreen(["loading image..."], window.loadingScreenFrames);
        this.#parent.append(this.#imageLoadingScreen.element);

    }

    #makeMetadataBox(content)
    {
        let box = document.createElement("div");
        box.classList.add('poster-metabox-'+content.toLowerCase());
        box.classList.add('poster-metabox');
        box.textContent = content;
        return box;
    }

    #addImageContainer()
    {
        let img = document.createElement('div');
        img.classList.add(PosterContainer.posterImageCls);
        this.#images.push(img);
        this.#posterContainer.append(img);
        return img;
    }

    loadImage(uuid, type, promiseCache = null)
    {
        const imagePath = "/thumb?UUID="+uuid+"&type="+type;
        return new Promise((resolve, reject)=>{
            const actualImage = document.createElement('img');
            actualImage.src = imagePath;
            actualImage.lazy = "true";

            if (promiseCache)
            {
                promiseCache[imagePath] = () => reject(new ImageLoadingStopped("out of view", type));
            }

            actualImage.onload = () => {
                if (promiseCache) { delete promiseCache[imagePath]; }
                return resolve({"image": actualImage, "path":imagePath})
            };
            actualImage.onerror = (e) => {
                if (promiseCache) { delete promiseCache[imagePath]; }
                reject(new Error("failed to load image at "+imagePath+" : "+e));
            }
        });
    }

    addImage()
    {
        if (!this.shouldAddMoreImages) { return; }
        this.#imageLoadingScreen.show();
        this.loadImage(this.#uuid, this.currentImageType, this.#currentLoadingJobs)
        .then( imageData => {
            let con = this.#addImageContainer();

            this.randomizeAnimation(imageData.image);
            con.append(imageData.image);
            setTimeout(()=>{
                this.#imageLoadingScreen.hide();
            },200);
        })
        .catch( error => {
            if (error instanceof ImageLoadingStopped)
            {
                this.#imageTypeIndex--;
            }
            this.#imageLoadingScreen.hide();
        });

        this.#imageTypeIndex++;
    }

    rejectAllImageLoads()
    {
        for (const imageLoading of Object.values(this.#currentLoadingJobs))
        {
            imageLoading(); //this will reject any pending promises (but not break the network call)
        }
    }

    randomizeAnimation(elem)
    {
        const randAni = Math.floor(Math.random() * PosterContainer.aniClasses.length);
        const randDir = Math.floor(Math.random() * PosterContainer.aniDirectionClasses.length);
        elem.classList.add(PosterContainer.aniClasses[randAni]);
        elem.classList.add(PosterContainer.aniDirectionClasses[randDir]);
    }

    get imageCount() { return this.#imageTypeIndex; } // we may not need to save an array of images

    get element() { return this.#parent; }

    get shouldAddMoreImages() { return this.#imageTypeIndex < this.#imageTypes.length; }

    get uuid() { return this.#uuid; }

    get currentImageType() { return this.#imageTypes[this.#imageTypeIndex]; }

    get imageTypes() { return this.#imageTypes; }


    /**
     * @param {(uuid: string, info: {}) => void} callback what to invoke on a click event
     */
    set onClick(callback) {
        this.#parent.onclick = (e) => {
            EpisodesContainer.hideAllBrethren();
            callback(this.#uuid, this.#info);
        }
    }

    //////////
    // set methods that are supposed to be used only by extending logic
    /////////

    /**
     * @param {Array[int]} types array of int indicates type of images
     */
    set imageTypes(types) { this.#imageTypes = types; }

    /**
     * @param {string} str the title content
     */
    set title(str) { this.#title.innerText = str; }
};


class SeriesPoster extends PosterContainer
{
    #clickCallback = (uuid, info) => { console.log("not set yet"); }
    #shows = {}
    #showModule = null;
    static aniClasses = ['show-poster-animation-scale','show-poster-animation-pan','show-poster-animation-rotate'];

    constructor(mediaUUID, mediaInfo)
    {
        super(mediaUUID, mediaInfo);
        super.imageTypes = [0];
        super.title = mediaInfo.metadata.show;
        super.element.classList.remove(PosterContainer.posterCls);
        super.element.classList.add("poster-show-view");
        super.element.setAttribute("title",mediaInfo.name+" "+mediaInfo.metadata.episode);
        super.element.onclick = (e) => { this.#showEpisodesModule(); }
    }

    #showEpisodesModule()
    {
        if (this.#showModule == null)
        {
            this.#showModule = new EpisodesContainer(this.#shows, this.#clickCallback, this.loadImage);
            // we pollute the body element because this element is set to be fixed
            // and if the container element has any css property that the spec deems to
            // create "containing block", the fixed element will be contained in it
            // example of such css rules: filter, transform, perspective, backdrop-filter
            // and more : https://drafts.fxtf.org/filter-effects/#FilterProperty
            document.body.append(this.#showModule.element);
        }
        this.#showModule.show();
    }

    randomizeAnimation(elem)
    {
        const randAni = Math.floor(Math.random() * SeriesPoster.aniClasses.length);
        const randDir = Math.floor(Math.random() * PosterContainer.aniDirectionClasses.length);
        elem.classList.add(SeriesPoster.aniClasses[randAni]);
        elem.classList.add(PosterContainer.aniDirectionClasses[randDir]);
    }

    /**
     * @param {(uuid: string, info: {}) => void} callback what to invoke on a click event
     */
    set onClick(callback) { this.#clickCallback = callback; }

    /**
     * @param {} shows a reference to all the episodes data for the current show
     */
    set showsReference(shows) { this.#shows = shows; }



};

export class MediaPresentationPoster extends MediaPresentation
{
    #lazyLoadingTimeouts = {};
    #viewObserver = null;
    #posterViewObjects = {};
    #series = {};
    static #lazyLoadTimeoutMs = [1500,2500,4000];

    constructor(canvas)
    {
        super(canvas,"present-poster-view");
        this.#viewObserver = new IntersectionObserver((entries)=>{

            for (const entry of entries)
            {
                const ttl = entry.target.getElementsByTagName('h3')[0].innerText;
                if (entry.intersectionRatio <= 0.0)
                {
                    entry.target.classList.remove('in-view');
                    this.stopImageGenerationTimeout(entry.target);
                }
                else
                {
                    entry.target.classList.add('in-view');
                    this.triggerImageGenerationTimeout(entry.target);
                }
            }
        },{threshold: 0.0});
    }


    prePaintProcess() {}

    postPaintProcess() {}

    #addTimeout(posterObject)
    {
        const timeoutKey = this.#timeoutUUID(posterObject.uuid, posterObject.currentImageType);
        this.#lazyLoadingTimeouts[timeoutKey] = setTimeout((_this, _poster, _timeoutKey) => {

            delete this.#lazyLoadingTimeouts[_timeoutKey];

            _poster.addImage();
            if (_poster.shouldAddMoreImages)
            {
                _this.#addTimeout(_poster);
            }
        }, MediaPresentationPoster.#lazyLoadTimeoutMs[posterObject.imageCount] , this, posterObject, timeoutKey);
    }

    triggerImageGenerationTimeout(elem)
    {
        const uuid = elem.getAttribute('data-uuid');
        let obj = this.#posterViewObjects[uuid];
        if (!obj.shouldAddMoreImages)
        {
            console.log("all image loaded, no need to trigger timeout");
            return;
        }

        this.#addTimeout(obj);
    }

    stopImageGenerationTimeout(elem)
    {
        const uuid = elem.getAttribute('data-uuid');
        let obj = this.#posterViewObjects[uuid];

        obj.rejectAllImageLoads();

        for (const type of obj.imageTypes)
        {
            const key = this.#timeoutUUID(uuid, type);
            if ( this.#lazyLoadingTimeouts.hasOwnProperty(key) )
            {
                clearTimeout(this.#lazyLoadingTimeouts[key]);
                delete this.#lazyLoadingTimeouts[key];
            }
        }
    }

    #timeoutUUID(mediaUUID, type)
    {
        return mediaUUID+'::'+type;
    }

    addMediaElement(mediaUUID, mediaInfo)
    {
        let poster = null;
        if (mediaInfo.metadata.hasOwnProperty('show'))
        {
            const name = mediaInfo.metadata.show;
            if (!this.#series.hasOwnProperty(name))
            {
                this.#series[name] = [];

                poster = new SeriesPoster(mediaUUID, mediaInfo);
                poster.showsReference = this.#series[name];
            }
            this.#series[name].push({ info: mediaInfo, uuid: mediaUUID });
        }
        else
        {
            poster = new PosterContainer(mediaUUID, mediaInfo);
        }

        if (poster === null) { return null; }

        this.#posterViewObjects[mediaUUID] = poster;

        this.canvas.append(this.#posterViewObjects[mediaUUID].element);
        // this is only called once on 'PosterContainer' since in future calls 'PosterContainer' is cached
        // in the base class and this method is not called
        this.#viewObserver.observe(this.#posterViewObjects[mediaUUID].element);
        this.#posterViewObjects[mediaUUID].onClick = (uuid, info) => { super.invokeOnClick(uuid, info); }
        return this.#posterViewObjects[mediaUUID].element;
    }
}