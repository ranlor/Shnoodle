import os
import shutil
import subprocess
import time
import json
import shUtils
import random
from Shnoolog import Shnoolog


class FFMpeg:

    def __init__(self, ffmpegPath, ffprobePath, cdnPath, patches) -> None:
        self.logger = Shnoolog("FFMpeg")
        self.ffmpeg = ffmpegPath
        self.ffprobe = ffprobePath
        self.videoSubDir="vd"
        self.currentProcess=None
        self.cdnPath = cdnPath
        self.mediaMetadata = {} #cache the probe output of files
        self.playlistName = "shnoodle"
        self.tsName = "v_stream"
        self.thumbCache = {} #cache the image data of a media
        self.shutitup = False
        self.patches = patches

    def shutup(self):
        self.shutitup = True

    def talk(self):
        self.shutitup = False

    def initVideoFiles(self):
        targetDir = os.path.join(self.cdnPath, self.videoSubDir)
        if not os.path.exists(targetDir):
            os.mkdir(targetDir)

    def stopTranscodingProcess(self, kill=False):
        if self.currentProcess:
            returncode = self.currentProcess.poll()
            if not returncode:
                self.logger.info(f"Killing running transcoding {self.currentProcess.pid}")
                if kill:
                    self.currentProcess.kill()
                else:
                    self.currentProcess.terminate()
                time.sleep(0.2)

            self.currentProcess = None

    def stopTranscoding(self, mediaUUID) -> bool:
        self.stopTranscodingProcess()


        targetDir = os.path.join(self.cdnPath, self.videoSubDir, mediaUUID)
        if os.path.exists(targetDir):
            try:
                shutil.rmtree(targetDir)
            except Exception as error:
                self.logger.error("Failed to remove video files.")
                return False

        return True

    def clearVideoFiles(self):
        self.stopTranscodingProcess()

        targetDir = os.path.join(self.cdnPath, self.videoSubDir)
        if os.path.exists(targetDir):
            try:
                shutil.rmtree(targetDir)
            except Exception as error:
                self.logger.error("Failed to remove video files. waiting for a bit and trying again..")
                time.sleep(1)
                self.clearVideoFiles()

    def probe(self, mediaPath, mediaUUID):

        if mediaUUID in self.mediaMetadata.keys():
            return self.mediaMetadata[mediaUUID]

        args = [self.ffprobe]

        args += ['-print_format','json']
        args += ['-show_format']
        args += ['-show_streams']
        args += [mediaPath]

        self.logger.info("Running command: {}".format(" ".join(args)))
        result = subprocess.run(args, capture_output=True, text=True)

        if result.returncode != 0:
            return None

        output = result.stdout
        try:
            data = json.loads(output)
        except json.JSONDecodeError as e:
            self.logger.error(f"failed to parse ffprobe command. JSON: {e.msg}")
            return None

        self.mediaMetadata[mediaUUID] = data
        return data

    def showTimeCodes(self, timeCode, defaultTimestamp="00:00:00"):
        secondsRand = random.randint(10,50)
        match timeCode:
            case 0:
                return defaultTimestamp
            case 1:
                return "00:02:{}".format(secondsRand)
            case 2:
                return "00:03:{}".format(secondsRand)
            case 3:
                return "00:05:{}".format(secondsRand)
            case 4:
                return "00:08:{}".format(secondsRand)
        return defaultTimestamp

    def movieTimeCodes(self, timeCode, defaultTimestamp="00:00:00"):
        secondsRand = random.randint(10,50)
        match timeCode:
            case 1:
                return "00:05:{}".format(secondsRand)
            case 2:
                return "00:15:{}".format(secondsRand)
            case 3:
                return "00:25:{}".format(secondsRand)
            case 4:
                return "00:35:{}".format(secondsRand)
        return defaultTimestamp

    def clipTimeCodes(self, timeCode, defaultTimestamp="00:00:00"):
        timeCode = min(9, max(0,timeCode))
        return "00:00:0{}".format(timeCode)

    def timeCodeToTime(self, timeCodeType, mediaInfo):
        if mediaInfo['metadata']['type'] == "Show":
            defaultTimestamp = "00:00:00"
            if self.patches:
                defaultTimestamp = self.patches.processTimestamp(mediaInfo['metadata']['show'])
            return self.showTimeCodes(timeCodeType, defaultTimestamp)

        if mediaInfo['metadata']['type'] == "Movie":
            return self.movieTimeCodes(timeCodeType)

        return self.clipTimeCodes(timeCodeType)

    def generateThumbnail(self, mediaPath, mediaUUID, mediaInfo, timeCodeType, width, quality=70):
        if mediaUUID not in self.thumbCache:
            self.thumbCache[mediaUUID] = {}
        else:
            if timeCodeType in self.thumbCache[mediaUUID]:
                return self.thumbCache[mediaUUID][timeCodeType]

        imageCache = {
            'data' : b'',
            'mime' : 'webp/image',
            'size' : 0,
            'width' : 0
        }

        args = [self.ffmpeg]

        if self.shutitup:
            args += ['-hide_banner']
            args += ['-loglevel', 'error']

        args += [ '-ss', self.timeCodeToTime(timeCodeType, mediaInfo)]
        args += ['-i', mediaPath ]
        args += ['-vframes', '1']
        args += ['-f', 'image2pipe'] # output image data to stdout
        # image prop
        if quality:
            args += ['-quality', "{}".format(quality)]
        args += ['-preset', 'photo']
        if width:
            args += ['-vf' , 'scale={}:-1'.format(width)] # keep aspect ratio
        args += ['-vcodec', 'libwebp']
        # output bin data to std
        args += ['-']

        self.logger.info("Running thumb command: {}".format(" ".join(args)))
        # prevent stdin to get stuck after we done with the process we direct it to devnull (i.e. /dev/null in linux)
        devnull = open(os.devnull)
        ffmpeg_process = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, stdin=devnull)
        try:
            imageData, errors = ffmpeg_process.communicate()
        except TimeoutError:
            ffmpeg_process.kill()
            imageData, errors = ffmpeg_process.communicate()
        devnull.close()


        if errors:
            self.logger.error(errors)

        imageCache['data'] = imageData
        imageCache['mime'] = 'webp/image'
        imageCache['size'] = len(imageData)
        imageCache['width'] = width

        self.thumbCache[mediaUUID][timeCodeType] = imageCache

        return imageCache



    def transcodeVideo(self, mediaPath, mediaUUID,
                        subtitleStream=None,
                        subtitleFile=None,
                        audioStream=0,
                        videoStream=0,
                        gpuAccel=False,
                        gpuWrapper=None,
                        vSync=None,
                        pixFMT='yuv420p',
                        hlsTime=10,
                        colorSpace="HD",
                        stereoMixDown=True,
                        transcodeTimeoutSeconds=5):

        # stop any running transcoding
        self.stopTranscodingProcess()
        streamFilename = self.playlistName
        targetDir = os.path.join(self.cdnPath, self.videoSubDir, mediaUUID)
        targetStream = os.path.join(targetDir,streamFilename)
        targetStreamParts = os.path.join(targetDir, self.tsName)
        # re-encode each time since we kill the past process and it could be incomplete next time we chose the same video
        if os.path.exists(targetStream):
            try:
                shutil.rmtree(targetDir)
            except Exception as error:
                self.logger.error(f"Failed to remove old transcode video at {targetDir} error {error}")

        os.mkdir(targetDir)

        # transcode
        args = [self.ffmpeg]

        if self.shutitup:
            args += ['-hide_banner']
            args += ['-loglevel', 'error']

        encoder = "libx264"
        if gpuAccel and gpuWrapper != None:
            try:
                encoder = gpuWrapper.get246Encoder()
                vSync = '0'
            except Exception as e:
                self.logger.error(f"Failed to get gpu encoder {e}")

        if vSync:
            args += ['-vsync', vSync]

        args += ['-i', mediaPath ]
        if subtitleFile:
            args += ['-i', subtitleFile]
        args += ['-c:v', encoder]

        #color space
        if colorSpace == "SD":
            args += ['-color_primaries' , '1'] #BT.709.
            args += ['-colorspace' , '1' ] #BT.709.
            args += ['-color_trc' , '1' ] #BT.709.
        if colorSpace == "HD":
            args += ['-color_primaries' , 'bt2020'] #BT.2020.
            args += ['-colorspace' , 'bt2020nc' ] #BT.2020.
            args += ['-color_trc' , 'smpte2084' ] #BT.2020.

        args += ['-color_range', 'tv']

        args += ['-c:a', 'aac']
        if stereoMixDown:
            args += ['-ac', '2']

        args += ['-pix_fmt', pixFMT]

        # assume only one video/audio stream in container, and the first ones are the main ones
        args += ['-map','0:v:{}'.format(videoStream)] # input file position 0 (we use only one): (v)ideo type : stream default: 0
        args += ['-map','0:a:{}'.format(audioStream)] # input file position 0 (we use only one): (a)udio type : stream default:  0

        # if we have sutitble file we'll want to prefer it and use it
        subtitleMapPos = 0
        if subtitleFile:
            subtitleMapPos = 1 # 1 is the second '-i' that contain the srt input (0 is the media file input)
            subtitleStream = 0 # since we're using external file, the stream input is zero

        if subtitleStream != None:
            args += ['-map',str(subtitleMapPos)+':s:'+str(subtitleStream)] # input file position 0 (we use only one): (s)ubtitle type : stream id
            #stream grouping, how to group the streams we mapped, we must use sgroup for group name so it show up in the playlist
            args += ['-var_stream_map', 'v:0,a:0,s:0,sgroup:a_stream_group']
        else:
            args += ['-var_stream_map', 'v:0,a:0']

        args += ['-master_pl_name',streamFilename]
        args += ['-hls_time', "{}".format(hlsTime)]
        args += [ '-hls_playlist_type', 'event' ] # will force  '-hls_list_size', '0'
        args += ['-f', 'hls']
        args += [targetStreamParts]

        self.logger.info("Running command: {}".format(" ".join(args)))
        self.currentProcess = subprocess.Popen(args)
        self.logger.info(f"Running pid {self.currentProcess.pid}")

        ret = shUtils.waitOnFileCreation("{}{}.ts".format(targetStreamParts,3), transcodeTimeoutSeconds, self.currentProcess)
        if not ret:
            self.logger.error(f"transcode is very slow, timeout of {transcodeTimeoutSeconds} seconds was reached")
            raise Exception("transcoding reach timeout of {} seconds (i.e. too slow). check log or increase timeout in conf file".format(transcodeTimeoutSeconds))

        return targetStream