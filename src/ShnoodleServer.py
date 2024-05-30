from http.server import BaseHTTPRequestHandler, HTTPServer, ThreadingHTTPServer
import os
import json
from MediaLibrary import MediaLibrary
import mimetypes
import FFMpeg
import shutil
from Telemetry import Telemetry
from gpu.create import createGPU
from gpu.gpu import GPU
from urllib import parse
from Config import Config
from HTMLPYCache import HTMLPYCache
from http import HTTPStatus
from Shnoolog import Shnoolog
"""
The Shnoodle server, the shitty ffmpeg wrapper with nice graphics
the idea of the server is to be in-place while running
this means that is has no database or memory and everything
is setup in the start of the server
any transcoding and processing is done while the server is running
and when the server is closed everything is removed
leaving nothing behind, like it never ran
this is for use cases when you just want to stream something from
one PC to another without worrying about what it will leave behind
or save on the streaming pc
"""

logger = Shnoolog("ShnoodleServer")

class ShnoodleServerContext():
    shnoodleHTMLMimeType = "shnoodlepy"
    streamProxyPath="content"


    def __init__(self, config:Config, cache: HTMLPYCache, ffmpeg: FFMpeg, library: MediaLibrary, telemetry: Telemetry, gpuWrapper: GPU) -> None:
        self.ffmpeg = ffmpeg
        self.cache = cache
        self.config = config
        self.library = library
        self.telemetry = telemetry
        self.gpuWrapper = gpuWrapper

    def suppressFFMpegOutput(self):
        self.ffmpeg.shutup()

    def verboseFFMpegOutput(self):
        self.ffmpeg.talk()

    def getTelemetry(self):
        if not self.telemetry:
            return None

        data = {}

        try:
            data['CPU Use'] = "{}%".format(self.telemetry.cpuUsage())
            data['Memory Use'] = "{}%".format(self.telemetry.memUsage())
            data['GPU Memory Use'] = "{}%".format(self.telemetry.gpuMemUsage())
            data['GPU Usage'] = "{}%".format(self.telemetry.gpuUsage())
            data['GPU Temp'] = "{} C".format(self.telemetry.gpuTemp())
            temps = self.telemetry.getTemps(self.config.get("telemetryTempValues",[]))

            for entry in temps:
                data[entry[0]] = "{:.2f} C".format(entry[1])

        except Exception as e:
            logger.error(f"Failed to get telemetry {e}")

        return data

    def resolveMimeType(self, fullpath):
        mimetype, encoding = mimetypes.guess_type(fullpath)
        filename, ext = os.path.splitext(fullpath)

        if os.path.basename(filename) == self.ffmpeg.playlistName and ext == "":
            return ("application/vnd.apple.mpegurl", encoding)

        if ext == ".ts":
            return ("video/mp2t", encoding)

        if ext == ".vtt":
            return ("text/vtt", encoding)

        if ext == ".htmlpy":
            return ("text/html", encoding)

        return (mimetype, encoding)

    @staticmethod
    def isStaticResource(mimetype):
        staticMimeTypes = ['image/svg+xml','font/ttf', 'image/vnd.microsoft.icon', 'image/png', 'image/jpeg', 'text/javascript', 'text/css']
        return mimetype in staticMimeTypes


class ShnoodleServerHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "Nanya Business/HTTP1.1"
    sys_version = "Clouds & Whispers/1.3.2-patch.1.1"

    # overwrite request log with nothing to prevent from console prints
    def log_request(self, code='-', size='-'):
        return

    ########################################################################
    # context related methods
    ########################################################################
    __context = None

    @staticmethod
    def setContext(context):
        ShnoodleServerHandler.__context = context

    def ffmpeg(self):
        return ShnoodleServerHandler.__context.ffmpeg

    def library(self):
        return ShnoodleServerHandler.__context.library

    def conf(self):
        return ShnoodleServerHandler.__context.config

    def cache(self):
        return ShnoodleServerHandler.__context.cache

    def telemetry(self):
        return ShnoodleServerHandler.__context.telemetry

    def streamProxyPath(self):
        return ShnoodleServerContext.streamProxyPath

    def gpuWrapper(self):
        return ShnoodleServerHandler.__context.gpuWrapper

    def getHTMLCacheKeyFor(self, file):
        return os.path.join(self.conf().get('root_path'), file)

    def protectedWrite(self, obj):
        try:
            self.wfile.write(obj)
        except Exception as e:
            logger.warning(f"socket closed before end of content {e}")

    ########################################################################
    # utility methods
    ########################################################################

    def fileOutput(self,filepath):
        if os.path.exists(filepath):
            with open(filepath, "rb") as file:
                self.protectedWrite(file.read())

    def serve404(self, content=True):
        size = 0
        content = ""
        if content:
            cacheKey = self.getHTMLCacheKeyFor(self.conf().get("404File"))
            cached = self.cache().get(cacheKey)
            size = cached['length']
            content = cached['content']

        self.serveHTML(content, length=size, status=HTTPStatus.NOT_FOUND)

    def serveThumbnail(self, thumb):
        self.send_response(200)
        self.send_header('Content-type', thumb['mime'])
        self.send_header("Content-Length", thumb['size'])
        self.send_header("Cache-Control", "public, max-age=604800, immutable")
        self.send_header("Connection", "close")
        self.end_headers()
        self.protectedWrite(thumb['data'])

    def serveFile(self, path, isRealPath=False):
        file = path.strip()
        if file[0] == "/":
            file = file.lstrip("/")
        if not file:
            return self.serve404()

        fullpath = os.path.join(self.conf().get("root_path"),file)
        if isRealPath: # actual physical path on the host machine needs no processing
            fullpath = path

        if not os.path.exists(fullpath):
            return self.serve404()

        size = 0
        cachedFile = self.cache().get(self.getHTMLCacheKeyFor(path))
        if cachedFile:
            logger.info("serve [Cached] file: {} size: {} MiBi".format(fullpath,cachedFile['length']/1024/1024))
            self.serveHTML(cachedFile['content'], cachedFile['length'])
            return

        # read file from filesystem
        fileStats = os.stat(fullpath)
        size = fileStats.st_size

        mimetype, encoding = ShnoodleServerHandler.__context.resolveMimeType(fullpath)

        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Length", size)

        if mimetype:
            self.send_header("Content-Type", mimetype)
            # if ShnoodleServerContext.isStaticResource(mimetype):
                # make the browser cache any static resource
                # self.send_header("Cache-Control", "public, max-age=604800, immutable")
        if encoding:
            self.send_header("Content-Encoding", encoding)

        self.end_headers()

        logger.info("serve file: {} size: {} MiBi".format(fullpath, size/1024/1024))
        self.fileOutput(fullpath)

    def serveErrorAsJSON(self, errorMessage):
        self.serveObjectAsJsonData({"error": errorMessage})

    def serveObjectAsJsonData(self, obj):
        data = json.dumps(obj).encode()
        self.send_response(HTTPStatus.OK)
        self.send_header('Content-Type', 'application/json')
        self.send_header("Content-Length", len(data))
        self.end_headers()
        self.protectedWrite(data)

    def serveText(self, data):
        self.send_response(HTTPStatus.OK)
        self.send_header('Content-Type', 'text/plain')
        self.send_header("Content-Length", len(data))
        self.end_headers()
        self.protectedWrite(data.encode())

    def serveHTML(self, data, length=None, status=HTTPStatus.OK):
        self.send_response(status)
        self.send_header('Content-Type', 'text/html')
        if length:
            self.send_header("Content-Length", length)
        else:
            self.send_header("Content-Length", len(data))
        self.end_headers()
        self.protectedWrite(data.encode())

    def getQueryParam(self,path, paramKey, optional=False):
        urlComponents = parse.urlparse(path)
        if not urlComponents.query:
            logger.error(f"request is missing query params {path}")
            return None

        urlParams = parse.parse_qs(urlComponents.query)
        if not paramKey in urlParams.keys():
            if not optional:
                logger.error(f"request is missing {paramKey} arg {path}")
            return None

        return urlParams[paramKey][0]

    def getValidUUIDParam(self, path, key):
        mediaUUID = self.getQueryParam(path, key)
        if not mediaUUID:
            return None

        if not mediaUUID in self.library().media.keys():
            logger.error(f"can't find uuid {mediaUUID} in library")
            return None

        return mediaUUID

    ########################################################################
    # request processing methods
    ########################################################################

    def processThumbnailRequest(self, url):
        mediaUUID = self.getValidUUIDParam(url, "UUID")
        if not mediaUUID:
            return self.serve404()

        mediaPath = self.library().absPathFromUUID[mediaUUID]
        if not os.path.exists(mediaPath):
            logger.error(f"Failed to find the file: {mediaPath} to generate thumbnail from")
            return self.serve404()

        timeCodeType = self.getQueryParam(self.path, "type")
        if not timeCodeType:
            return self.serve404()

        thumb = self.ffmpeg().generateThumbnail(mediaPath,
                                                mediaUUID,
                                                self.library().media[mediaUUID],
                                                int(timeCodeType),
                                                self.conf().get('thumbWidth'),
                                                self.conf().get('thumbQuality'))

        return self.serveThumbnail(thumb)

    def processProbeRequest(self, url):
        mediaUUID = self.getValidUUIDParam(url, "UUID")
        if not mediaUUID:
            return self.serve404()

        mediaPath = self.library().absPathFromUUID[mediaUUID]
        if not os.path.exists(mediaPath):
            logger.error(f"Failed to find the file: {mediaPath} to probe")
            return self.serve404()

        metadata = self.ffmpeg().probe(mediaPath, mediaUUID)

        if not metadata:
            return self.serve404()

        metadata['subtitles'] = self.library().getSubtitles(mediaUUID, fullPaths=False)

        return self.serveObjectAsJsonData(metadata)

    def processStreamRequest(self, url):
        mediaUUID = self.getValidUUIDParam(url, "UUID")
        if not mediaUUID:
            return self.serve404()

        mediaPath = self.library().absPathFromUUID[mediaUUID]
        if not os.path.exists(mediaPath):
            logger.error(f"Failed to find the file: {mediaPath} to stream")
            return self.serve404()


        useGPU = self.getQueryParam(url, "gpu")

        if not useGPU or useGPU == "false":
            useGPU = False
        else:
            useGPU = True

        if self.conf().get('enableGPUEncoding',False) == False or self.gpuWrapper() == None:
            useGPU = False

        subtitleStreamId = self.getQueryParam(url, "subtitles")
        if not subtitleStreamId:
            subtitleStreamId = None

        # if we get subtitle from files it'll get priority, since the assumption that
        # a user will use these files when the embedded subtitles are wrong/not working
        try:
            subtitleFileId = self.getQueryParam(url, "subtitle_file")
            subtitleFile = None
            if subtitleFileId:
                subtitleFiles = self.library().getSubtitles(mediaUUID)
                if subtitleFiles:
                    subtitleFile = next(iter(subtitleFiles[int(subtitleFileId)].values()))
                    subtitleStreamId = None
        except:
            logger.warning("failed to parse subtitle_file parameter")

        videoStream = self.getQueryParam(url, 'video')
        if not videoStream:
            videoStream = 0

        audioStream = self.getQueryParam(url, 'audio')
        if not audioStream:
            audioStream = 0

        streamPath = None
        try:
            timeout = self.conf().get('transcodingTimeoutInSeconds',1)
            streamPath = self.ffmpeg().transcodeVideo(mediaPath,
                                                        mediaUUID,
                                                        gpuAccel=useGPU,
                                                        gpuWrapper=self.gpuWrapper(),
                                                        subtitleStream=subtitleStreamId,
                                                        subtitleFile=subtitleFile,
                                                        videoStream=videoStream,
                                                        audioStream=audioStream,
                                                        transcodeTimeoutSeconds=timeout)
        except Exception as e:
            return self.serveErrorAsJSON(str(e))

        # replace resource path with proxy path, so all request go to the streamProxyPath endpoint which will
        # redirect to the actual placement on the host machine
        relativePath = streamPath.removeprefix(self.conf().get('resource_path')+os.path.sep)
        streamPath = os.path.join(self.streamProxyPath(), relativePath)

        return self.serveObjectAsJsonData({"stream":"/"+streamPath})

    def processDownloadRequest(self, url):
        mediaUUID = self.getValidUUIDParam(url, "UUID")
        if not mediaUUID:
            return self.serve404()

        mediaPath = self.library().absPathFromUUID[mediaUUID]
        if not os.path.exists(mediaPath):
            logger.error(f"Failed to find the file: {mediaPath} to download")
            return self.serve404()

        mediaInfo = self.library().media[mediaUUID]

        with open(mediaPath, 'rb') as file:
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", 'application/octet-stream')
            self.send_header("Content-Disposition", 'attachment; filename="{}"'.format(os.path.basename(mediaPath)))
            self.send_header("Content-Length", str(mediaInfo['size']) )
            self.end_headers()
            shutil.copyfileobj(file, self.wfile)


    ########################################################################
    # HTMLServer overrides
    ########################################################################

    def do_HEAD(self):
        if self.path.startswith('/stop?'):
            mediaUUID = self.getValidUUIDParam(self.path, "UUID")
            if not mediaUUID:
                return self.serve404()

            if not self.ffmpeg().stopTranscoding(mediaUUID):
                return self.serve404(False)

            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Length", 0)
            self.end_headers()
            return

    def do_GET(self):

        if self.path == '/list':
            self.serveObjectAsJsonData(self.library().media)
            return

        if self.path.startswith("/"+self.streamProxyPath()):
            #go to physical resource path
            resourcePath = self.conf().get("resource_path")
            realPath = self.path.replace("/"+self.streamProxyPath(),resourcePath)
            self.serveFile(realPath, True)
            return

        if self.path.startswith("/telemetry"):
            temps = ShnoodleServerHandler.__context.getTelemetry()
            if not temps:
                return self.serve404()

            self.serveObjectAsJsonData(temps)
            return

        if self.path.startswith("/download"):
            return self.processDownloadRequest(self.path)

        if self.path.startswith('/stream?'):
            return self.processStreamRequest(self.path)

        if self.path.startswith('/probe?'):
            return self.processProbeRequest(self.path)

        if self.path.startswith('/thumb?'):
           return self.processThumbnailRequest(self.path)

        path = self.path.strip()
        if not path or path == "/":
            path = self.conf().get("defaultFile")
            self.ffmpeg().stopTranscodingProcess()
        try:
            self.serveFile(path)
        except Exception as e:
            logger.error(f"Exception thrown on {path} exception: {e}")
