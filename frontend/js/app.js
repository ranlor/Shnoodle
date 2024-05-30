"use strict";

import { MediaPresentationList, MediaPresentationFiles,  MediaPresentationPoster, MediaMenu  } from "./library.js";
import { MediaDetails } from "./media.js";
import { ToggleFormElement, DropDownFormElement, DropDownFormElementSubtitles, DropDownFormElementSubtitleFiles, ToTopButton, SeasonAutoPlay, ErrorToaster, LoadingScreen, TelemetryDrawer } from "./elements.js";
import { setFullQualifiedLangName, FormDataElements, getShnoodleConf } from "./utils.js";

(function init()
{
    const hideClass = "hiddenBlock"
    const header = document.getElementById("pageHeader");
    const videoSection = document.getElementById("videoPlayerSection");
    const videoSectionClose = document.getElementById("videoPlayerSectionClose");
    const mediaSection = document.getElementById("mediaSection");
    const mediaSectionClose = document.getElementById("mediaSectionClose");
    const mediaLibrarySection = document.getElementById("mediaList");
    const mediaLibrarySectionCanvas = document.getElementById("mediaListCanvas");
    const playButton = document.getElementById("playButton");
    const videoElement = document.getElementById("videoPlayer");
    const videoStreamLink = document.getElementById("copyStreamLink");
    const videoTitle = document.getElementById("videoTitle");
    const downloadButton = document.getElementById("download");
    const toTopButton = new ToTopButton(document.body);
    const videoProbeCache = {};
    let mediaLibraryCache = null;
    let formDataElements = new FormDataElements();
    let hls = null;
    let mediaSectionParts = new MediaDetails(mediaSection);
    // episode container ref
    window.episodeContainerRef = null;
    // global elements
    window.seasonAutoPlay = new SeasonAutoPlay(videoElement, triggerVideoPlayer, 5000);
    window.loadingScreenFrames = [...Array(15)].map((val, i) => "/res/frames/s00"+((++i) < 10 ? "0"+i : i)+".png");
    window.loadingScreen = new LoadingScreen([
        "setting up some bullshit...",
        "this doesn't work, one sec....",
        "transcoding the thing, or something, not sure...",
        "please wait, or don't, doesn't really matter",
        "that's not supposed to happen, or does it?",
        "how this thing work again?",
        "is it working?",
        "hello? anyone there?",
        "moving bits from one side to the other...",
        "why does it take so long?",
        "Shnoodle, the shitty media center",
        "that's... shouldn't make that noise, right?"
    ], window.loadingScreenFrames);
    window.showLoadingFullscreen = () => !!window.loadingScreen && window.loadingScreen.show();
    window.hideLoadingFullscreen = () => !!window.loadingScreen && window.loadingScreen.hide();
    document.body.append(window.loadingScreen.element);
    if (getShnoodleConf('useTelemetry', false))
    {
        const refreshInterval = getShnoodleConf('telemetryInterval', 2000);
        let Telemetry = new TelemetryDrawer(refreshInterval);
        document.body.append(Telemetry.element);
    }

    videoElement.controls = true;

    function showSection(section) { section.classList.remove(hideClass); }
    function hideSection(section) { section.classList.add(hideClass); }
    function updateStreamLinkOnView(streamlink)
    {
        videoStreamLink.innerText = window.location.protocol+"//"+(window.location.host+"/"+streamlink).replace("//","/");
    }

    function updateFileDownloadLink(uuid)
    {
        downloadButton.href = "/download?UUID="+uuid;
    }

    function goBackToMediaListSection()
    {
        hideSection(videoSection);
        hideSection(mediaSection);
        showSection(mediaLibrarySection);
        showSection(header);
        window.seasonAutoPlay.stopAutoPlay();
        if (window.episodeContainerRef !== null)
        {
            window.episodeContainerRef.show();
        }
    }

    function goBackToMediaSection(currentUUID)
    {
        window.seasonAutoPlay.stopAutoPlay();
        videoElement.pause();
        if (hls && hls.media)
        {
            hls.stopLoad();
            hls.detachMedia(hls.media);
            hls = null;
        }

        hideSection(videoSection);
        showSection(mediaSection);

        // send request to kill transcoding
        fetch("/stop?UUID="+currentUUID, {method:"HEAD"})
        .then(response => {
            if (!response.ok) { console.warn("didn't stop transcoding"); }
        })
        .catch(error => {
            ErrorToaster.showError('Error stopping stream:'+error.message);
        });
    }

    function presentVideoElement(videoUUID, autoplay)
    {
        window.showLoadingFullscreen();
        let extraData = formDataElements.formDataToURI();
        fetch('/stream?UUID='+videoUUID+"&"+extraData)
        .then(response => {
            if (!response.ok) { throw new Error("failed to get video stream");}
            return response.json();
        })
        .then(streamObject => {

            if (streamObject.hasOwnProperty('error'))
            {
                throw new Error("Failure to stream video: "+streamObject['error']);
            }

            const streamFile = streamObject['stream'];
            console.log("stream file: " + streamFile);
            updateStreamLinkOnView(streamFile);
            updateFileDownloadLink(videoUUID);
            hls = new Hls({debug: false, subtitleDelay: getShnoodleConf('subtitlesDelay',0)});
            hls.loadSource(streamFile);
            hls.attachMedia(videoElement);
            hls.on(Hls.Events.MEDIA_ATTACHED, () => {
                if (!autoplay) { videoElement.pause(); }
            });
            hls.on(Hls.Events.MANIFEST_PARSED, (e,data) => {
                // for some reason you need a timeout
                // to be able to actually affect the video
                // element current time from here
                // even though this is quite a late event
                setTimeout((vid, autoplay) => {
                    vid.currentTime = 0;
                    window.hideLoadingFullscreen();
                    if (autoplay) { vid.play(); }
                } , 400, videoElement, autoplay);
            });
            let title = "";
            if (mediaLibraryCache[videoUUID].metadata.hasOwnProperty('episode'))
            {
                title += mediaLibraryCache[videoUUID].metadata.episode+" ";
            }
            title += mediaLibraryCache[videoUUID].name;
            videoTitle.innerText = title;
            videoSectionClose.setAttribute("data-uuid", videoUUID);
            showSection(videoSection);
            videoElement.currentTime = 0;
        })
        .catch(error => {
            ErrorToaster.showError('Error fetching stream:'+error.message);
            goBackToMediaSection(videoUUID);
            window.hideLoadingFullscreen();
        });

    }

    function presentMetadataFromServer(data)
    {
        let recurseLevels = 0;
        let maxRecurseLevels = 3;

        let dumpMetasRecurse = (metaObj, type) => {
            recurseLevels++;
            for (let metaItem in metaObj)
            {
                if (typeof metaObj[metaItem] == 'object')
                {
                    if (recurseLevels < maxRecurseLevels)
                    {
                        dumpMetas(metaObj[metaItem],type);
                        recurseLevels--;
                    }
                    continue;
                }
                else
                {
                    mediaSectionParts.addMeta(type, metaItem, metaObj[metaItem], mediaSectionParts.sectionType.Collapse);
                }
            }
        };

        let dumpMetas = (metaObj, type) => {
            recurseLevels = 0;
            dumpMetasRecurse(metaObj, type);
        };

        if (data["format"].hasOwnProperty("duration"))
        {
            mediaSectionParts.addMeta('general',"duration",data["format"]["duration"] );
        }

        // format section
        delete data["format"]["filename"];
        dumpMetas(data["format"], "format");
        const hasStreams = data.hasOwnProperty["streams"];
        const hasStreamsFormat = data["format"].hasOwnProperty("nb_streams");

        if ((!hasStreamsFormat))
        {
            ErrorToaster.showError("no streams found in file");
            // hide play button
            playButton.classList.add(hideClass);
            return;
        }

        // stream sections
        const streamCount = data["format"]["nb_streams"];
        let streamTypes = [];
        for (let streamIndex = 0; streamIndex < streamCount; ++streamIndex)
        {
            streamTypes.push(data["streams"][streamIndex]["codec_type"]);
        }



        let availableLanguagesList = {};
        let availableAudioStreams = {};
        let availableVideoStreams = {};
        let videoStreamCounter = 0;
        let audioStreamCounter = 0;
        for (let streamIndex = 0; streamIndex < streamCount; ++streamIndex)
        {
            let stream = data["streams"][streamIndex];
            switch(streamTypes[streamIndex])
            {
                case "subtitle":
                {
                    let languageName = stream['tags']['language'];
                    let languageTitle = stream['tags'].hasOwnProperty('title') ? stream['tags']['title'] : "" ;
                    languageName+="-"+languageTitle;
                    availableLanguagesList[languageName+streamIndex] = {"name" : setFullQualifiedLangName(stream['tags']['language'], languageTitle), "id" : streamIndex };
                }
                break;
                case "video":
                {
                    availableVideoStreams["video"+streamIndex] = videoStreamCounter++;
                }
                break;
                case "audio":
                {
                    let audioLanguage = stream['tags'].hasOwnProperty('language') ? stream['tags']['language'] : "default";
                    let audioHandler = stream['tags'].hasOwnProperty('handler_name') ? stream['tags']['handler_name'] : "" ;
                    availableAudioStreams[setFullQualifiedLangName(audioLanguage, audioHandler)] = audioStreamCounter++;
                }
                break;
            }

            if ( "subtitle" !== streamTypes[streamIndex])
            {
                dumpMetas(stream, "stream-"+streamTypes[streamIndex]+"-"+streamIndex);
            }
        }

         // add codec and resolution metas to file and general sections
         for (let id in streamTypes)
         {
            if (streamTypes[id] == "video"
                && data["streams"][id].hasOwnProperty("height")
                && data["streams"][id].hasOwnProperty("width"))
            {
                mediaSectionParts.addMeta('general',"resolution", data["streams"][id]['width']+"x"+data["streams"][id]['height'] );
            }

            if (streamTypes[id] == "video"
                && data["streams"][id].hasOwnProperty("codec_name"))
            {
                mediaSectionParts.addMeta('file',"codec", data["streams"][id]['codec_name'] , true);
            }
         }

        // subtitles from files dropdown
        const subtitles = data['subtitles'];
        if (Object.keys(subtitles).length > 0)
        {
            // add display
            dumpMetas(subtitles, "subtitle-files");
            // add dropdown
            formDataElements.addFormElement(FormDataElements.SUBTITLE_FILE, new DropDownFormElementSubtitleFiles(subtitles));
            mediaSectionParts.addMeta("general", "subtitle files", formDataElements.getFormDataElement(FormDataElements.SUBTITLE_FILE).element);
        }

        // add dropdown of subtitles from stream
        if (Object.keys(availableLanguagesList).length > 0)
        {
            dumpMetas(availableLanguagesList,"stream-subtitles");

            formDataElements.addFormElement(FormDataElements.SUBTITLES, new DropDownFormElementSubtitles(availableLanguagesList));
            mediaSectionParts.addMeta("general", "subtitles", formDataElements.getFormDataElement(FormDataElements.SUBTITLES).element);
        }

        // add dropdown of audio from stream
        if (audioStreamCounter > 1)
        {
            formDataElements.addFormElement(FormDataElements.AUDIO, new DropDownFormElement(availableAudioStreams));
            mediaSectionParts.addMeta("general", "audio", formDataElements.getFormDataElement(FormDataElements.AUDIO).element);
        }

        // add dropdown of video from stream
        if (videoStreamCounter > 1)
        {
            formDataElements.addFormElement(FormDataElements.VIDEO, new DropDownFormElement(availableVideoStreams));
            mediaSectionParts.addMeta("general", "video", formDataElements.getFormDataElement(FormDataElements.VIDEO).element);
        }

        // show warning to user when there's 2 types of subtitles
        if (formDataElements.contains(FormDataElements.SUBTITLES) && formDataElements.contains(FormDataElements.SUBTITLE_FILE))
        {
            mediaSectionParts.warning = "Both file subtitles & stream subtitles are present, file subtitles will take preference, stream will be ignored"
        }
    }

    function presentMediaSection(mediaUUID, mediaInfo)
    {
        window.showLoadingFullscreen();
        playButton.classList.remove(hideClass);
        // the order of these elements will be the order of them in the html page
        mediaSectionParts.title = mediaInfo.name;
        mediaSectionParts.subtitle = mediaInfo.actual_name;
        let queryString = mediaInfo.name;
        if (mediaInfo.metadata.hasOwnProperty("episode"))
        {
            queryString+=" "+mediaInfo.metadata.episode;
        }
        mediaSectionParts.youtube = queryString;
        mediaSectionParts.imdb = queryString;

        // set the warning element after links
        mediaSectionParts.warning = "";

        mediaSectionParts.clearMeta();
        formDataElements.clear();
        if (mediaInfo.metadata.hasOwnProperty("type"))
        {
            mediaSectionParts.addMeta('general',"media type",mediaInfo.metadata.type);
        }
        if (mediaInfo.metadata.hasOwnProperty("episode"))
        {
            mediaSectionParts.addMeta('general',"episode", mediaInfo.metadata.episode);
        }

        if (getShnoodleConf('gpuAvailable',false))
        {
            formDataElements.addFormElement(FormDataElements.GPU, new ToggleFormElement());
            mediaSectionParts.addMeta('general',"Use GPU", formDataElements.getFormDataElement(FormDataElements.GPU).element);
        }

        mediaSectionParts.addMeta('file',"size", mediaInfo.size);
        mediaSectionParts.addMeta('file',"mod time", mediaInfo.modified_date);
        mediaSectionParts.addMeta('file',"create time", mediaInfo.creation_date);
        mediaSectionParts.addMeta('file',"path", mediaInfo.fullpath);

        if (!videoProbeCache.hasOwnProperty(mediaUUID))
        {
            // fetch server with command to run ffprobe
            fetch('/probe?UUID='+mediaUUID)
            .then(response => {
                if (!response.ok) { throw new Error("failed to get media probe"); }
                return response.json();
            })
            .then(data => {
                videoProbeCache[mediaUUID] = data;
                presentMetadataFromServer(data);
                window.hideLoadingFullscreen();

            })
            .catch(error => {
                ErrorToaster.showError('Error fetching media probe:', error);
                window.hideLoadingFullscreen();
            });
        }
        else // use cache
        {
            presentMetadataFromServer(videoProbeCache[mediaUUID]);
            window.hideLoadingFullscreen();
        }

        playButton.setAttribute("data-uuid", mediaUUID);

        mediaSectionClose.setAttribute("data-uuid", mediaUUID);

        showSection(mediaSection);
        hideSection(mediaLibrarySection);
        hideSection(header);
    }


    function initMediaLibraryView(presentationModel, data)
    {
        presentationModel.onclick = (uuid, info) =>  presentMediaSection(uuid, info);
        presentationModel.paint(data);
        showSection(mediaLibrarySection);
    }

    function presentMediaLibrarySection(presentationModel)
    {

        if (mediaLibraryCache !== null)
        {
            initMediaLibraryView(presentationModel, mediaLibraryCache);
        }
        else
        {
            fetch('/list')
            .then(response => {
                if (!response.ok) { throw new Error("failed to get media list"); }
                return response.json();
            })
            .then(data => {
                mediaLibraryCache = data;
                initMediaLibraryView(presentationModel, mediaLibraryCache);
            })
            .catch(error => {
                ErrorToaster.showError('Error fetching media list:', error);
            });
        }
    };

    function triggerVideoPlayer(uuid, autoplay = false, preserveFormElements = [] )
    {
        hideSection(mediaSection);
        hideSection(videoSection);
        videoElement.currentTime = 0;

        if (preserveFormElements.length > 0)
        {
            formDataElements.preserve(preserveFormElements);
        }

        presentVideoElement(uuid, autoplay);
    }

    if (document.readyState == "loading")
    {
        console.log("script call should be called only when DOM is ready");
        return;
    }

    const mediaListPresentation = new MediaPresentationList(mediaLibrarySectionCanvas);
    const mediaFilesPresentation = new MediaPresentationFiles(mediaLibrarySectionCanvas);
    const mediaPosterPresentation = new MediaPresentationPoster(mediaLibrarySectionCanvas);

    const menu = new MediaMenu(mediaLibrarySection,{
        "listview": () => {
            console.log("present list view");
            presentMediaLibrarySection(mediaListPresentation);
        },
        "filesview": () => {
            console.log("present files view");
            presentMediaLibrarySection(mediaFilesPresentation);
        },
        "posterview": () => {
            console.log("present poster view");
            presentMediaLibrarySection(mediaPosterPresentation);
        }
    });
    const initialView = getShnoodleConf('initialView', 'filesview');
    menu.triggerMenuElementFromAction(initialView);

    playButton.innerText = "play";
    playButton.onclick = (e) => {
        let uuid = e.target.getAttribute("data-uuid");
        triggerVideoPlayer(uuid);
    };
    videoSectionClose.onclick = (e) => { goBackToMediaSection(e.target.getAttribute("data-uuid")); }
    mediaSectionClose.onclick = (e) => { goBackToMediaListSection();  }
    ErrorToaster.addToDOM();
})();
