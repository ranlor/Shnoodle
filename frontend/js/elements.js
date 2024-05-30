"use strict";

import { ImageAnimator } from "./animator.js";

/**
 * generic drop down element which takes a list of key=>value
 * object and created a dropdown element for it
 */
export class DropDownFormElement
{
    #elem = null;
    static #NO_VAL = "no-value-selected"

    constructor(itemList)
    {
        let dropdown = document.createElement("select");
        this.#addOption(dropdown, "none", DropDownFormElement.#NO_VAL);
        for (let name in itemList)
        {
            this.#addOption(dropdown, name, itemList[name]);
        }
        this.#elem = dropdown;
    }

    #addOption(dropdown,name,value)
    {
        let option = document.createElement("option");
        option.setAttribute("value",value);
        option.innerText = name;
        dropdown.append(option);
    }

    get hasValue() { return this.#elem.value != DropDownFormElement.#NO_VAL; }

    /**
     * get the dropdown DOM element
     */
    get element() { return this.#elem; }

    /**
     * get the value selected in the drop down element
     */
    get value() { return this.#elem.value ;}
};


/**
 * extend the DropDownElement for video/audio/subtitles object
 */
export class DropDownFormElementSubtitles extends DropDownFormElement
{
    constructor(subtitleList)
    {
        let properList = {};
        let index = 0;
        for (let name in subtitleList)
        {
            let optionName = subtitleList[name].name;
            if (properList.hasOwnProperty(optionName))
            {
                optionName += " "+index;
            }
            properList[optionName] = index++;
        }
        super(properList);
    }
}

export class DropDownFormElementSubtitleFiles extends DropDownFormElement
{
    constructor(subtitleList)
    {
        let subtitleDropdown = {};
        for (let index in subtitleList)
        {
            for (const [fullQualifiedName, filename] of Object.entries(subtitleList[index]) )
            {
                let optionName = fullQualifiedName;
                if (subtitleDropdown.hasOwnProperty(optionName))
                {
                    optionName += " "+index;
                }
                subtitleDropdown[optionName] = index;
            }
        }
        super(subtitleDropdown);
    }
}

/**
 * create a toggle element
 */
export class ToggleFormElement
{
    #elem = null;
    #checkbox = null;

    constructor(initialState = false)
    {
        let con = document.createElement("label");
        con.classList.add("switch");

        this.#checkbox = document.createElement("input");
        this.#checkbox.setAttribute("type","checkbox");
        if (initialState) { this.#checkbox.setAttribute("checked","checked"); }

        let slider = document.createElement("span");

        con.append(this.#checkbox);
        con.append(slider);
        this.#elem = con;
    }

    get hasValue() { return true; }

    get element() { return this.#elem; }

    get value() { return this.#checkbox.checked; }
};



export class ToTopButton
{
    #parent = null;
    #button = null;
    #scrollY = 0;
    #scrollTick = false;
    #scrollYThreshold = 200;

    constructor(parent)
    {
        this.#parent = parent;
        this.#button = this.#makeButton();
        this.#scrollEvent();
        this.#parent.append(this.#button);
        this.#scrollYThreshold = window.innerHeight;
    }

    #makeButton()
    {
        let button = document.createElement("button");
        button.classList.add("to-top-button");
        button.classList.add("hide");
        button.innerText = "to top";
        button.onclick = () => {
            document.documentElement.scrollTo({top:0, left:0, behavior: 'smooth'});
        };
        return button;
    }

    #triggerScrollEvent()
    {
        if (this.#scrollY > this.#scrollYThreshold)
        {
            this.#button.classList.remove("hide");
            this.#button.classList.add("show");
        }
        else
        {
            this.#button.classList.remove("show");
            this.#button.classList.add("hide");
        }
    }

    #scrollEvent()
    {
        window.onscroll = (event) => {
            (function(_this){
                _this.#scrollY = window.scrollY;

                if (!_this.#scrollTick)
                {
                    window.requestAnimationFrame( () => {
                        _this.#triggerScrollEvent();
                        _this.#scrollTick = false;
                    });

                    _this.#scrollTick = true;
                }

            })(this);
        };
    }
};

class Range
{
    max = 0;
    min = 0;
    len = 0;
    constructor(min,max)
    {
        if (min > max) { throw new Error("Range ctor, 'min' must be smaller than 'max'"); }
        this.min = Number(min);
        this.max = Number(max);
        this.len = this.max-this.min;
    }
};

class Countdown
{
    static FORWARD=false;
    static BACKWARD=true;
    #parent = null;
    #progressBar = null;
    #range = null;
    #startTime = 0;
    #reverse = false;
    #runningAnimation = false;

    constructor(range, direction)
    {
        this.#parent = document.createElement('div');
        this.#parent.classList.add('countdown-con');

        let progressContainer = document.createElement('div');
        progressContainer.classList.add('countdown-progress-bar');
        this.#parent.append(progressContainer);

        this.#progressBar = document.createElement('div');
        this.#progressBar.classList.add('countdown-backdrop');
        progressContainer.append(this.#progressBar);

        this.#reverse = direction;

        if (!(range instanceof Range))
        {
            throw Error("range needs to be of type Range");
        }
        this.#range = range;
    }

    updateProgress(newValue)
    {
        if (this.#range.len === 0) { return; }
        const percent = newValue * (100/this.#range.len);
        const styleValue = this.#reverse ? (100.0 - percent) : percent ;

        window.requestAnimationFrame( () => {
            this.#progressBar.style.width = (styleValue < 0.0 ? 0 : styleValue) +"%";
        });

        return percent >= 100.0;
    }

    #runningCountdown(timeStamp)
    {
        let elapsed = timeStamp - this.#startTime;

        const done = this.updateProgress(elapsed + this.#range.min);

        if (this.#runningAnimation && !done)
        {
            window.requestAnimationFrame((timeStamp) => { this.#runningCountdown(timeStamp); });
        }
    }

    startCountdown()
    {
        if (this.#runningAnimation) { return; }
        this.#runningAnimation = true;
        this.#startTime = performance.now();
        window.requestAnimationFrame((timeStamp) => { this.#runningCountdown(timeStamp); });
    }

    stopCountdown()
    {
        if (!this.#runningAnimation) { return; }
        this.#runningAnimation = false;
    }

    get element() { return this.#parent; }
};

function exitFullScreen()
{
    if (document.fullscreenElement !== null)
    {
        document.exitFullscreen();
    }
}

export class SeasonAutoPlay
{
    #parent = null;
    #currentSeason = null;
    #episodeInterval = 5000;
    #timeout = null;
    #video = null;
    #countdown = null;
    #textElement = null;
    #addedToDOM = false;
    #currentEpisodeIndex = null;
    #triggerVideoCallback = (uuid,autoplay) => {}

    constructor(videoElement, triggerVideoCallback, episodeInterval)
    {
        this.#video = videoElement;
        this.#triggerVideoCallback = triggerVideoCallback;
        this.#episodeInterval = episodeInterval;
        this.#countdown = new Countdown(new Range(0, this.#episodeInterval), Countdown.BACKWARD);
        this.#parent = this.#makePlayingNextEpisodeModule();
        this.#video.onended = (e) => {
            exitFullScreen();
            this.#triggerOnVideoEnd();
        };
    }

    #triggerOnVideoEnd()
    {
        if (!this.#addedToDOM) { return; }
        if (!this.#increment()) { return; }
        const name = this.#currentSeason.episodes[this.#currentEpisodeIndex].data.info.name;
        const ep = this.#currentSeason.episodes[this.#currentEpisodeIndex].data.info.metadata.episode;
        this.#updateModuleText(ep+" "+name);
        this.show();
        let callback = ()=>{this.#playNextVideo();}

        this.#timeout = setTimeout((playVideo) => {
            playVideo();
        }, this.#episodeInterval, callback);
    }

    #playNextVideo()
    {
        if (!this.#addedToDOM) { return; }
        this.hide();
        const uuid = this.#currentSeason.episodes[this.#currentEpisodeIndex].data.uuid;
        this.#triggerVideoCallback(uuid, true /*auto play*/,['gpu'] /*preserve only gpu data*/);
    }

    #increment()
    {
        if (this.#currentEpisodeIndex == null) { return false; }
        if (this.#currentSeason == null) { return false; }
        const index = this.#currentEpisodeIndex + 1;
        if (index < 0) { return false; }
        if (index >= this.#currentSeason.episodes.length) { return false; }
        this.#currentEpisodeIndex = index;
        return true;
    }

    #updateModuleText(text)
    {
        if (this.#textElement === null) { return; }
        this.#textElement.innerText = "Playing next "+text+" in "+this.#episodeInterval/1000+" seconds";
    }


    #makeButton(text, callback)
    {
        let btn = document.createElement("button");
        btn.classList.add("next-episode-btn-"+text);
        btn.classList.add("next-episode-btn");
        btn.innerText = text;
        btn.onclick = (e) => {
            e.target.blur();
            callback();
        };
        return btn;
    }

    #makePlayingNextEpisodeModule()
    {
        let con = document.createElement("dialog");
        con.classList.add("next-episode-module");
        this.#textElement = document.createElement("div");
        this.#textElement.classList.add("prompt-content");
        let cancelButton = this.#makeButton("cancel", (e)=>{ this.invalidate(); });
        let goButton = this.#makeButton("go", (e)=>{
            this.stopAutoPlay();
            this.#playNextVideo();
        });

        con.append(this.#textElement);
        con.append(this.#countdown.element);
        con.append(cancelButton);
        con.append(goButton);
        return con;
    }

    #getIndexFromEpisode(episode)
    {
        const uuid = episode.data.uuid;
        for (let index=0; index < this.#currentSeason.episodes.length; ++index)
        {
            if (uuid == this.#currentSeason.episodes[index].data.uuid) { return index; }
        }
        return -1;
    }

    hide()
    {
        this.#parent.close();
        this.#countdown.stopCountdown();
    }
    show()
    {
        this.#parent.showModal();
        this.#countdown.startCountdown();
    }

    invalidate()
    {
        this.stopAutoPlay();
        this.hide();
        if (this.#addedToDOM) { document.body.removeChild(this.#parent); }
        this.#currentSeason = null;
        this.#currentEpisodeIndex = null;
        this.#addedToDOM = false;
    }

    validate(season, episode)
    {
        this.#currentSeason = season;
        const index = this.#getIndexFromEpisode(episode);
        if (index == -1) { return; } // do nothing when episode on found in season
        this.#currentEpisodeIndex = index;
        this.#addToDOM();
    }

    stopAutoPlay()
    {
        if (this,this.#timeout ==  null) { return; }
        clearTimeout(this.#timeout);
        this.hide();
    }

    #addToDOM()
    {
        this.hide();
        if (this.#addedToDOM) { return; }
        document.body.append(this.#parent);
        this.#addedToDOM = true;
    }
}

export class ErrorToaster
{
    static #parent = null;
    static #content = null;
    static #showCls = 'err-toaster-show';

    static #makeErrorElement()
    {
        ErrorToaster.#parent = document.createElement("dialog");
        ErrorToaster.#parent.classList.add('error-toaster');

        ErrorToaster.#content = document.createElement('span');
        ErrorToaster.#content.classList.add('error-toaster-text');

        ErrorToaster.#parent.append(ErrorToaster.#content);

        const okButton = document.createElement('button');
        okButton.classList.add('error-toaster-button');
        okButton.onclick = (e) => {
            ErrorToaster.#parent.classList.remove(ErrorToaster.#showCls);
            e.target.blur();
            ErrorToaster.#parent.close();
        };
        okButton.innerText = "OK";
        ErrorToaster.#parent.append(okButton);

        document.body.append(ErrorToaster.#parent);
    }

    static addToDOM()
    {
        if (ErrorToaster.#parent == null || ErrorToaster.#content == null)
        {
            ErrorToaster.#makeErrorElement();
        }
    }

    static showError(message, obj = null)
    {
        ErrorToaster.addToDOM();

        if (message.length > 0)
        {
            if ( obj != null) { message += ' '+obj.toString(); }
            ErrorToaster.#content.innerText = message;
            ErrorToaster.#parent.showModal();
            ErrorToaster.#parent.classList.add(ErrorToaster.#showCls);
            exitFullScreen();
        }
    }
}

class SloganSwitcher
{
    static #bufferLen = 2;
    static #sloganInterval = 3000;
    #parent = null;
    #buffers = [];
    #buffersContainer = null;
    #currentBuffer = 0;
    #slogans = [];
    #currentSlogan = 0;
    #interval = null;
    #inProgress = false;

    constructor(slogans)
    {
        this.#slogans = slogans;

        this.#parent = document.createElement('div');
        this.#parent.classList.add("slogan-container");

        if ( !(this.#slogans instanceof Array) || this.#slogans.length == 0)
        {
            return;
        }

        this.#buffersContainer = document.createElement('div');
        this.#buffersContainer.classList.add('slogan-inner-container');
        this.#buffersContainer.style.position = "absolute";
        this.#parent.append(this.#buffersContainer);

        for (let i=0; i<SloganSwitcher.#bufferLen; ++i)
        {
            const buffer = document.createElement('div');
            buffer.classList.add("slogan-buf");
            buffer.classList.add("slogan-buf-index-"+ i);
            this.#buffers.push(buffer);
        }

        if (SloganSwitcher.#bufferLen > 0)
        {
            this.#currentSlogan = 0;
            this.#currentBuffer = 0;
            this.#buffers[this.#currentBuffer].innerText = this.#slogans[this.#currentSlogan];
            this.#buffersContainer.append(this.#buffers[this.#currentBuffer]);
        }

        //TODO: why all this hard coded?
        this.#parent.style.overflow = 'hidden';
        this.#parent.style.position = 'absolute';
        this.#parent.style.top = '50%';
        this.#parent.style.left = '50%';
        this.#parent.style.transform = 'translateX(-50%)';
    }

    #setParentHeight()
    {
        const rect = this.#buffers[this.#currentBuffer].getBoundingClientRect();
        this.#parent.style.height = rect.height+'px';
    }

    #shuffleSlogans()
    {
        for (let i=this.#slogans.length-1; i > 0; --i)
        {
            const j = Math.floor(Math.random() * i);
            const temp = this.#slogans[i];
            this.#slogans[i] = this.#slogans[j];
            this.#slogans[j] = temp;
        }
    }

    start()
    {
        // mix slogans
        this.#shuffleSlogans();

        this.#setParentHeight();

        if (this.#slogans.length < 2) { return; }
        if (this.#buffers.length == 0) { return; }
        if (this.#interval !== null) { return; }

        this.#interval = setInterval(()=>{
            window.requestAnimationFrame(() => { this.#nextSlogan(); });
        },SloganSwitcher.#sloganInterval);

    }

    stop()
    {
        if (this.#slogans.length < 2) { return; }
        if (this.#buffers.length == 0) { return; }
        if (this.#interval === null) { return; }

        clearInterval(this.#interval);

        this.#interval = null;
    }

    #nextSlogan()
    {
        if (this.#inProgress) { return; }
        this.#inProgress = true;
        this.#currentSlogan = (this.#currentSlogan + 1) % this.#slogans.length;
        const nextBuffer = (this.#currentBuffer + 1) % this.#buffers.length;
        this.#buffers[nextBuffer].innerText = this.#slogans[this.#currentSlogan];
        this.#buffersContainer.style.top = 0;
        this.#buffersContainer.append(this.#buffers[nextBuffer]);

        const bufferRect = this.#buffers[nextBuffer].getBoundingClientRect();

        this.#setParentHeight();

        this.#buffersContainer.animate({
            top: [ 0, -bufferRect.height+'px' ]
        },
        {
            duration: 400,
            iterations: 1,
            easing: "ease-out"
        }).onfinish = () => {
            this.#buffersContainer.removeChild(this.#buffers[this.#currentBuffer]);
            this.#currentBuffer = nextBuffer;
            this.#inProgress = false;
        };
    }

    get element() { return this.#parent; }
}

export class LoadingScreen
{
    #parent = null;
    static #hideCls = "loading-hide";
    #sloganSwitcher = null;
    #animator = null;

    constructor(slogans = [], frames = [], frameTime = 200, loop = true)
    {
        this.#parent = document.createElement("div");
        this.#parent.classList.add("loading-screen");
        this.#parent.classList.add(LoadingScreen.#hideCls);

        if (frames.length > 0)
        {
            this.#animator = new ImageAnimator(frames,frameTime,loop);
            this.#parent.append(this.#animator.element);
        }

        if (slogans.length > 0)
        {
            this.#sloganSwitcher = new SloganSwitcher(slogans);
            this.#parent.append(this.#sloganSwitcher.element);
        }
    }

    hide()
    {
        this.#parent.parentElement.style.overflow = "";
        this.#parent.classList.add(LoadingScreen.#hideCls);
        if (this.#sloganSwitcher !== null) { this.#sloganSwitcher.stop(); }
        if (this.#animator !== null) { this.#animator.stop(); }
    }

    show()
    {
        this.#parent.parentElement.style.overflow = 'hidden';
        this.#parent.classList.remove(LoadingScreen.#hideCls);
        if (this.#sloganSwitcher !== null) { this.#sloganSwitcher.start(); }
        if (this.#animator !== null) { this.#animator.start(); }
    }

    get element() { return this.#parent; }
}

export class TelemetryDrawer
{
    static #openCls = "telemetry-drawer-open";
    #parent = null;
    #showButton = null;
    #interval = null;
    #isDrawerOpen = false;
    #timeoutBar = null;
    #telemetryBlocks = {};
    #refreshInterval = 1000;

    constructor(refreshInterval)
    {
        this.#refreshInterval = refreshInterval;
        this.#parent = document.createElement("div");
        this.#parent.classList.add("telemetry-drawer");

        this.#showButton = document.createElement("button");
        this.#showButton.classList.add("telemetry-drawer-show");
        this.#showButton.innerText = "telemetry";
        this.#showButton.onclick = (e) => {
            if (this.#isDrawerOpen)
            {
                this.hide();
                this.#isDrawerOpen = false;
            }
            else
            {
                this.show();
                this.#isDrawerOpen = true;
            }
        };


        this.#parent.append(this.#showButton);

        this.#timeoutBar = document.createElement('div');
        this.#timeoutBar.classList.add('telemetry-timeout-bar');

        this.#parent.append(this.#timeoutBar);
    }

    #updateTelemetryBlock(name, value)
    {
        if (this.#telemetryBlocks.hasOwnProperty(name))
        {
            this.#telemetryBlocks[name].innerText = value;
            return;
        }

        const telemetryBlock = document.createElement("div");
        telemetryBlock.classList.add("telemetry-block");

        const teleName = document.createElement("div");
        teleName.classList.add("telemetry-block-name");
        teleName.innerText = name;

        this.#telemetryBlocks[name] = document.createElement("div");
        this.#telemetryBlocks[name].classList.add("telemetry-block-value");
        this.#telemetryBlocks[name].innerText = value;

        telemetryBlock.append(teleName);
        telemetryBlock.append(this.#telemetryBlocks[name]);

        this.#parent.append(telemetryBlock);
    }

    #updateTelemetry(data)
    {
        for(let key of Object.keys(data))
        {
            this.#updateTelemetryBlock(key, data[key]);
        }
    }

    #askForTelemetry()
    {
        fetch("/telemetry", {method:"GET"})
        .then(response => {
            if (!response.ok) { throw new Error("failed to get telemetry");}
            return response.json();
        }).
        then( json => {
            this.#updateTelemetry(json);
        })
        .catch(error => {
            ErrorToaster.showError('Error getting telemetry:'+error.message);
            this.hide();
        });
    }

    #animateTimeoutBar()
    {
        const padding = 100;
        this.#timeoutBar.animate([
            { width: 0 },
            { width: '100%'}
        ],this.#refreshInterval-padding);
    }

    show()
    {
        if (this.#interval !== null)  { return; }
        this.#askForTelemetry();
        this.#animateTimeoutBar();

        this.#parent.classList.add(TelemetryDrawer.#openCls);
        this.#interval = setInterval(()=>{
            this.#askForTelemetry();
            this.#animateTimeoutBar();
        },this.#refreshInterval);
    }

    hide()
    {
        if (this.#interval === null)  { return; }
        clearInterval(this.#interval);
        this.#interval = null;
        this.#parent.classList.remove(TelemetryDrawer.#openCls);
    }

    get element() { return this.#parent; }
}