"use strict";

function langToFullQualified(lang)
{
    switch(lang.toLowerCase())
    {
        case 'eng': return 'English';
        case 'spa': return 'Latin America Spanish';
        case 'por': return 'Portuguese Brazilian';
        case 'dan': return 'Dansk';
        case 'ger': return 'Deutsch';
        case 'spa': return 'Español';
        case 'spa': return 'Español (Latinoamericano)';
        case 'fin': return 'Suomi';
        case 'fre': return 'Français';
        case 'fre': return 'Français (Canadien)';
        case 'ita': return 'Italiano';
        case 'jpn': return 'Japanese';
        case 'dut': return 'Nederlands';
        case 'nor': return 'Norsk';
        case 'por': return 'Português (Brasil)';
        case 'por': return 'Português';
        case 'swe': return 'Svenska';
        case 'chi': return 'Chinese (Hong Kong)';
        case 'chi': return 'Chinese (Simplified)';
        case 'ara': return 'العربية';
        case 'cze': return 'čeština';
        case 'dan': return 'dansk';
        case 'ger': return 'Deutsch';
        case 'gre': return 'Ελληνικά';
        case 'spa': return 'español';
        case 'fin': return 'suomi';
        case 'fre': return 'français';
        case 'heb': return 'עברית';
        case 'hrv': return 'hrvatski';
        case 'hun': return 'magyar';
        case 'ind': return 'Indonesia';
        case 'ita': return 'italiano';
        case 'jpn': return '日本語';
        case 'kor': return 'Korean';
        case 'may': return 'Melayu';
        case 'nob': return 'norsk';
        case 'dut': return 'Nederlands';
        case 'pol': return 'polski';
        case 'por': return 'português';
        case 'rum': return 'română';
        case 'rus': return 'русский';
        case 'swe': return 'svenska';
        case 'tha': return 'ไทย';
        case 'tur': return 'Türkçe';
        case 'ukr': return 'українська';
        case 'vie': return 'Tiếng Việt';
        case 'chi': return '中文';
    }
    return lang;
}

export function setFullQualifiedLangName(lang, title = "")
{
    const language = langToFullQualified(lang);
    if (title.length > 0) { return language+"-"+title; }
    return language;
}

export function sanitizeValue(value,hint = null)
{

    if (hint && typeof hint == "string")
    {
        let date = new Date(0);
        switch (hint.toLowerCase())
        {
            case "size":
                let sizes = ["KiBi", "MiBi", "GiBi", "TiBi"];
                let val = value;
                let name = "B";
                for (let sName of sizes)
                {
                    if (val < 1024) { break;}
                    val = val/1024;
                    name = sName;
                }

                return ""+(val).toFixed(2)+" "+name;
            case "duration": return ""+(value/60).toFixed(2)+"  Min";
            case "mod time":
            case "create time":
                date = new Date(value*1000);
                return date.toLocaleString();
            case "creation time":
            case "creation_time":
                date = new Date(value);
                return date.toLocaleString();
            case 'bit rate':
            case 'bit_rate':
            case 'bit-rate':
                return ""+(value/1024).toFixed(2) + " kbps";
        }
    }

    return value;
};

export function getShnoodleConf(key, defaultValue)
{
    if (window.shnoodleConfig.hasOwnProperty(key))
    {
        return window.shnoodleConfig[key];
    }
    return defaultValue;
};

export class FormDataElements
{
    static GPU = 'gpu';
    static SUBTITLES = 'subtitles';
    static SUBTITLE_FILE = 'subtitle_file'
    static AUDIO = 'audio';
    static VIDEO = 'video';

    #formDataElements = {};

    constructor() {}

    addFormElement(type, element)
    {
        this.#formDataElements[type] = element;
    }

    formDataToURI()
    {
        let formData = [];
        for (let e in this.#formDataElements)
        {
            if (!this.#formDataElements[e].hasValue) { continue; }
            formData.push(e +"="+ encodeURIComponent(this.#formDataElements[e].value));
        }
        return formData.join("&");
    }

    getFormDataElement(type)
    {
        if (!this.#formDataElements.hasOwnProperty(type)) { return null; }
        return this.#formDataElements[type];
    }

    contains(type)
    {
        let elem = this.getFormDataElement(type)
        return elem !== null;
    }

    clear() { this.#formDataElements = {}; }

    preserve(elementKeysToKeep)
    {
        if (elementKeysToKeep.length.length === 0) { return; }
        let cachedFormElements = {};
        for (let key of elementKeysToKeep)
        {
            if (!this.#formDataElements.hasOwnProperty(key)) { continue; }
            cachedFormElements[key] = this.#formDataElements[key];
        }
        this.clear();
        this.#formDataElements = cachedFormElements;
    }
};
