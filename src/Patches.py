import json
import re
from Shnoolog import Shnoolog

class Patches:
    __namesKey = "names"
    __thumbnailsKey = "thumbnails"

    def __init__(self) -> None:
        self.logging = Shnoolog("Patches")
        self.timestampPattern = re.compile('^[0-9]{2}:[0-9]{2}:[0-9]{2}$')
        self.filename = "patches/patches.json"
        with open(self.filename, "r") as jsonFile:
            self.config = json.load(jsonFile)


    def processWildCard(self, searchIn, pattern, matchResult):
        if pattern[-1] == "*" and pattern[0] == "*":
            if searchIn.find(pattern[1:-1]) != -1:
                return matchResult
            return None

        if pattern[-1] == "*":
            if searchIn.startswith(pattern[:-1]):
                return matchResult
            return None

        if pattern[0] == "*":
            if searchIn.endswith(pattern[1:]):
                return matchResult
            return None

        if pattern == searchIn:
            return matchResult

        return None

    def processString(self, str):
        if not self.config:
            return str

        if not self.config[self.__namesKey]:
            return str

        for (search, replace) in self.config[self.__namesKey].items():
            ret = self.processWildCard(str, search, replace)
            if ret:
                return ret

        return str

    def processTimestamp(self, str):
        defaultTimestamp = "00:00:20"
        if not self.config:
            return defaultTimestamp

        if not self.config[self.__thumbnailsKey]:
            return defaultTimestamp

        for (search, replace) in self.config[self.__thumbnailsKey].items():
            ret = self.processWildCard(str, search, replace)
            if ret:
                if not self.timestampPattern.match(ret):
                    self.logging.warning(f"{self.__thumbnailsKey} values should be of pattern HH:MM:SS, value for {str} ignored")
                    return defaultTimestamp
                return ret

        return defaultTimestamp