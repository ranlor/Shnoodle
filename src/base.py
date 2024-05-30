#! /usr/bin/python3.10
from http.server import ThreadingHTTPServer
import os
import sys
import MediaLibrary
import shUtils
import FFMpeg
import Patches
import logging
import logging.handlers
from Telemetry import Telemetry
from gpu.create import createGPU
from Config import Config
from HTMLPYCache import HTMLPYCache
from ShnoodleServer import ShnoodleServerHandler
from ShnoodleServer import ShnoodleServerContext
from Shnoolog import Shnoolog

logger = Shnoolog("ShnoodleBase", False) #False: don't log to stdout

def runServer(config, context):
    port = config.get('port')
    if not port:
        logger.logError("no port defined. existing")
        return

    serverAddress = ('', port)
    # inject context
    ShnoodleServerHandler.setContext(context)
    httpd = ThreadingHTTPServer(serverAddress, ShnoodleServerHandler)
    ip = shUtils.getLANip()
    logger.logInfo(f'Starting httpd on http://{ip}:{port}...')
    httpd.serve_forever()

def initServer(configPath):
    config = Config(configPath)
    htmlCache = HTMLPYCache(config)

    rootPath = config.get("root_path")
    if not rootPath:
        logger.logError("missing root_path in config file. exiting")
        return

    html404Path = os.path.join(rootPath,config.get("404File",""))
    if not os.path.exists(html404Path):
        logger.logError(f"Missing default 404 HTML page in root_path: '{html404Path}', exiting.")
        return

    indexPath = os.path.join(rootPath,config.get("defaultFile",""))
    if not os.path.exists(indexPath):
        logger.logError(f"Missing default HTML/HTMLPY page in root_path: '{indexPath}' exiting.")
        return

    htmlCache.add(html404Path)
    htmlCache.add(indexPath)

    gpuWrapper = None
    if config.get('gpu',Config.GPU.NONE) == Config.GPU.NONE:
        logger.logWarn("No GPU defined in conf file, GPU encoding it turned off")
        config.set("enableGPUEncoding",False)
    else:
        try:
            gpuWrapper = createGPU(config.get('gpu'), useTelemetry=config.get('telemetry',False))
        except Exception as e:
            logger.error(e)

    telemetry = None
    if config.get('telemetry'):
        telemetry = Telemetry(gpuTelemetry=gpuWrapper)

    patches = None
    try:
        patches = Patches.Patches()
    except Exception as e:
        logger.logWarn(f"Failed to load patches,'{e}'. no patches will be applied")

    library = MediaLibrary.MediaLibrary(config.get("mediaPaths",[]),
                                        config.get("allowedMediaExt",[]),
                                        config.get("allowedSubtitleExt",[]),
                                        config.get('blacklist',""),
                                        patches)

    resourcePath = config.get("resource_path")

    if not resourcePath or len(resourcePath) == 0:
        logger.logError("resource_path configuration is missing. exiting")
        sys.exit(2)

    if resourcePath == ShnoodleServerContext.streamProxyPath:
        logger.logError(f"resource_path can't be {ShnoodleServerContext.streamProxyPath} it's used for stream urls")
        sys.exit(3)

    if resourcePath[0] != os.path.pathsep:
        resourcePath = os.path.join(rootPath, resourcePath) #relative path
        config.set("resource_path", resourcePath)

    if not os.path.exists(resourcePath):
        logger.logError(f"resource path {resourcePath} doesn't exist")
        sys.exit(4)

    ffmpeg = FFMpeg.FFMpeg(ffmpegPath=config.get('ffmpeg','ffmpeg'),
                           ffprobePath=config.get('ffprobe','ffprobe'),
                           cdnPath=resourcePath,
                           patches=patches)

    try:
        ffmpeg.initVideoFiles()
        library.scan()
        context = ShnoodleServerContext(config, htmlCache, ffmpeg, library, telemetry, gpuWrapper)
        context.suppressFFMpegOutput()
        runServer(config, context)
    except KeyboardInterrupt:
        pass
    except Exception as error:
        logger.error(error)
        pass
    finally:
        logger.logInfo("Program terminated, cleaning up...")
        logger.logInfo("Video Files...")
        ffmpeg.clearVideoFiles()
        logger.logInfo("Done.")

if __name__ == "__main__":
    maxLogSize = 5*1024*1024
    handler = logging.handlers.RotatingFileHandler(filename="shnoodle.log", maxBytes=maxLogSize, backupCount=5)
    logging.basicConfig(level=logging.DEBUG, format='%(asctime)s %(name)s[%(levelname)s] %(message)s',handlers=[handler])
    configPath = "config/config_linux.json"
    initServer(configPath)
