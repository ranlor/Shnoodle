import os
import re
import json
import time
import uuid
from Shnoolog import Shnoolog

logger = Shnoolog("MediaLibrary")

class SubtitleCache:
    __cache = {}
    __langs = {
        'eng':'English',
        'spa':'Latin America Spanish',
        'por':'Portuguese Brazilian',
        'dan':'Dansk',
        'ger':'Deutsch',
        'spa':'Español',
        'spa':'Español (Latinoamericano)',
        'fin':'Suomi',
        'fre':'Français',
        'fre':'Français (Canadien)',
        'ita':'Italiano',
        'jpn':'Japanese',
        'dut':'Nederlands',
        'nor':'Norsk',
        'por':'Português (Brasil)',
        'por':'Português',
        'swe':'Svenska',
        'chi':'Chinese (Hong Kong)',
        'chi':'Chinese (Simplified)',
        'ara':'العربية',
        'cze':'čeština',
        'dan':'dansk',
        'ger':'Deutsch',
        'gre':'Ελληνικά',
        'spa':'español',
        'fin':'suomi',
        'fre':'français',
        'heb':'עברית',
        'hrv':'hrvatski',
        'hun':'magyar',
        'ind':'Indonesia',
        'ita':'italiano',
        'jpn':'日本語',
        'kor':'Korean',
        'may':'Melayu',
        'nob':'norsk',
        'dut':'Nederlands',
        'pol':'polski',
        'por':'português',
        'rum':'română',
        'rus':'русский',
        'swe':'svenska',
        'tha':'ไทย',
        'tur':'Türkçe',
        'ukr':'українська',
        'vie':'Tiếng Việt',
        'chi':'中文',
        }

    __splitReg = re.compile("[\.\-\_]")

    def __init__(self) -> None:
        pass

    def __add(self, key, val):
        if key not in self.__cache:
            self.__cache[key] = []
        self.__cache[key].append(val)

    def __keyFromPath(self, filepath, file):
        if filepath == file:
            return os.sep
        return os.sep+filepath.replace(os.sep+file,"")

    def __getLanguage(self, subtitle):
        components = self.__splitReg.split(subtitle)
        for c in components:
            if c in self.__langs:
                return self.__langs[c]
        return None


    def addSubtitle(self, filepath, absFilePath):
        file  = os.path.basename(absFilePath)
        pathKey = self.__keyFromPath(filepath,file)
        if len(pathKey) == 0:
            logger.warning("attempting to insert empty key to SubtitleCache, skipped")
            return

        if pathKey == os.sep:
            self.__add(pathKey, absFilePath)
            return

        components = [c for c in pathKey.split(os.sep) if c != '']

        for c in components:
            self.__add(c, absFilePath)

    def getSubtitles(self, filepath, file, fullPaths=True):
        pathKey = self.__keyFromPath(filepath,file)
        if len(pathKey) == 0:
            return []

        if pathKey != os.sep:
            pathKey = os.path.basename(pathKey)

        if pathKey not in self.__cache:
            return []

        filename, _ = os.path.splitext(file)
        subtitles = self.__cache[pathKey]

        retSubtitles = []
        for subtitleFile in subtitles:
            returnedFilename = subtitleFile
            subtitleFilename = os.path.basename(subtitleFile)

            if not fullPaths:
                returnedFilename = subtitleFilename

            subname, _ =  os.path.splitext(subtitleFilename)
            if subname == filename:
                retSubtitles.insert(0, {'default': returnedFilename})
                continue
            lang = self.__getLanguage(subname)
            if lang:
                retSubtitles.append({lang: returnedFilename})

        return retSubtitles


class MediaLibrary:
    __subtitleCache = SubtitleCache()

    def __init__(self, paths, allowedMediaExt, allowedSubtitleExt, blacklistPath, patches):
        self.mediaPaths = paths
        self.absPathFromUUID = {}
        self.media = {}
        self.allowedExt = allowedMediaExt
        self.allowedSubtitleExt = allowedSubtitleExt
        self.episodeRegex = re.compile("[Ss][0-9]{1,2}[Ee][0-9]{1,2}")
        self.showRegex = re.compile("[Ss][0-9]{1,2}")
        self.langList = [ "eng", "jpn", "ita", "spa"] #probably more
        self.p1Regex = re.compile("\([^\)]+\)")
        self.p2Regex = re.compile("\[[^\]]+\]")
        self.p3Regex = re.compile("\{[^\}]+\}")
        self.patches = patches

        self.blacklist = []
        self.compoundBlacklist = [] # blacklist that should be removed before tokenizing
        if blacklistPath:
            if os.path.exists(blacklistPath):
                with open(blacklistPath, "r") as jsonFile:
                    bl = json.load(jsonFile)
                    if bl:
                        self.blacklist = bl["blacklist"]
                        self.compoundBlacklist = bl["compound_blacklist"]
                    else:
                        logger.error("Malformed blacklist file")

            else:
                example = "{ \"blacklist\" : \[ 'a','b' \], \"compound_blacklist\" : \[ 'a b', 'ba' \] }"
                logger.error(f"Empty words blacklist in MediaLibrary, to add one crete a {blacklistPath} json file: {example}")

    def isMediaFile(self, path):
        path, ext = os.path.splitext(path)
        ext = ext[1:].lower()
        return ext in self.allowedExt

    def isSubtitleFile(self, path):
        path, ext = os.path.splitext(path)
        ext = ext[1:].lower()
        return ext in self.allowedSubtitleExt

    def extractLang(self, filename):
        # find strings like en jpn ita etc.
        variations = []
        for lang in self.langList:
            variations.append(lang.lower())
            variations.append(lang.upper())
            variations.append(lang[0:2].lower())
            variations.append(lang[0:2].upper())
            variations.append(lang[0:1].upper()+lang[1:])
            for v in variations:
                if v in filename:
                    return lang
        return ""

    def extractEpisodeNumber(self, filename):
        # episode numbering S[0-9]{1,2}E[0-9]{1,2}
        episodeDetails = self.episodeRegex.search(filename)
        if not episodeDetails:
            return ""
        return episodeDetails[0]

    """
    look at all path components of filepath
    sanitize each of them
    make a word cloud of all from them
    go over the properName argument and give each word it's count in the word cloud
    remove any words from properName that appear the least
    assume that what is left is the show name
    """
    def extractShowName(self, filepath, properName):

        def buildStringFromWordCloud(wordCloud, str, threshold):
            ret = []
            if threshold <= 0:
                threshold = 1
            strComps = [c for c in str.split(" ") if c != '']
            for strComp in strComps:
                count = wordCloud.get(strComp, 0)
                if count >= threshold:
                    ret.append(strComp)
            ret = " ".join(list(dict.fromkeys(ret))) # unique filtering and preserving order
            return ret


        pathComponents = [c for c in filepath.split(os.sep) if c != '']
        pathComponentsLen = len(pathComponents)
        wordCloud = {}
        for component in pathComponents:
            cleanComponent = self.sanitizeFilename(component)
            parts = set([c for c in cleanComponent.split(" ") if c != '']) # remove duplicates
            for part in parts:
                wordCloud[part] = wordCloud.get(part, 0) + 1


        padding = 0
        if pathComponentsLen > 2:
            padding = 1

        assumedShowName = buildStringFromWordCloud(wordCloud=wordCloud, str=properName, threshold=pathComponentsLen-padding)

        # let's be a bit less strict
        if len(assumedShowName) == 0:
            assumedShowName = buildStringFromWordCloud(wordCloud=wordCloud, str=properName, threshold=pathComponentsLen-(padding*2))

        # give up
        if len(assumedShowName) == 0:
            assumedShowName = properName

        # run patches on the show name (if available)
        if self.patches:
            return self.patches.processString(assumedShowName)

        return assumedShowName

    def sanitizeEpisodeNumbers(self, filename):
        return self.episodeRegex.sub("", filename)

    def sanitizeShowIndicators(self, filename):
        return self.showRegex.sub("", filename)

    def inBlacklist(self, str):
        for word in self.blacklist:
            if str == word:
                return True
        return False

    def sanitize(self, str):
        str = self.p1Regex.sub("", str)
        str = self.p2Regex.sub("", str)
        str = self.p3Regex.sub("", str)

        for word in self.compoundBlacklist:
            str = str.replace(word, "")

        sep = " "
        str = re.sub(r"[\.\-_\s]+",sep,str)

        tokens = str.split(sep)

        newStr = ""
        for token in tokens:
            if not token:
                continue

            if not token in self.blacklist:
                newStr  = newStr + " " + token

        return newStr.strip()

    """
    sanitize order
    episode numbering S[0-9]{1,2}E[0-9]{1,2}  (may be needed for extra info for the file)
    anything inside parenthesis \([^\)]+\) \[[^\]]+\] \{[^\}]+\}
    all the words inside the words bucket
    """
    def sanitizeFilename(self, path):
        path, ext = os.path.splitext(path)

        path = self.sanitizeEpisodeNumbers(path)

        return self.sanitize(path)

    def sanitizeDirname(self, path):
        path, ext = os.path.splitext(path)

        path = self.sanitizeShowIndicators(path)

        return self.sanitize(path)

    def getExtraData(self, file, nodeInfo, fullpath, properName):
        extraData = {}

        extraData["type"] = "Clip"

        episodeData = self.extractEpisodeNumber(file)
        if episodeData:
            extraData["episode"] = episodeData
            extraData["type"] = "Show"
            showName = self.extractShowName(fullpath, properName)
            if showName:
                extraData["show"] = showName

        langData = self.extractLang(file)
        if langData:
            extraData["lang"] = langData
        MB = 1024*1024
        if nodeInfo.st_size > 100*MB and not episodeData:
            extraData["type"] = "Movie"
        return extraData

    def getSubtitles(self, uuid, fullPaths=True):
        if uuid not in self.media:
            return {}

        file = self.media[uuid]['actual_name']
        path = self.media[uuid]['fullpath']

        return self.__subtitleCache.getSubtitles(path, file, fullPaths=fullPaths)

    def scan(self):
        logger.logInfo("Library scan started...")
        start=time.time()
        for mediaPath in self.mediaPaths:
            logger.info(f"Scanning media path: {mediaPath}")
            for root, dirs, files in os.walk(mediaPath):
                for file in files:

                    isMediaFile = self.isMediaFile(file)
                    isSubtitleFile = self.isSubtitleFile(file)

                    if not isMediaFile and not isSubtitleFile:
                        continue

                    filePath = os.path.join(root, file)
                    parentDir = os.path.basename(os.path.dirname(filePath))
                    fullRelativePath = filePath.replace(mediaPath+os.path.sep,"") #remove abs path from what is exposed

                    if isSubtitleFile:
                        self.__subtitleCache.addSubtitle(fullRelativePath, filePath)
                        continue

                    fileStats = os.stat(filePath)

                    properName = self.sanitizeFilename(file)

                    if not properName:
                        if not file:
                            continue # if the filename is empty skip this

                        # probably the file name is only the episode metadata
                        # with blacklisted words, so the parent dir will have
                        # more concrete data (hopefully)
                        properName = self.sanitizeDirname(parentDir)
                        logger.warning(f"Failed to get proper name for {file} using parent dir {parentDir}")
                        if not properName:
                            # fuck it take the filename with all the shit in it
                            properName = file
                            logger.warning(f"Failed to salvage any proper name for file, using filename as-is {file}")

                    entryUUID = str(uuid.uuid4())
                    self.media[entryUUID] = {
                        'name': properName,
                        'actual_name': file,
                        'fullpath': fullRelativePath,
                        'metadata': self.getExtraData(file, fileStats, fullRelativePath, properName),
                        'size': fileStats.st_size,
                        'modified_date': fileStats.st_mtime, #epoch time
                        'creation_date': fileStats.st_ctime  #epoch time
                    }
                    self.absPathFromUUID[entryUUID] = filePath
        logger.logInfo("Library scan done. {} seconds".format(time.time()-start))