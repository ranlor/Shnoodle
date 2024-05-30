import os
import re
from Config import Config
from HTMLPYParser import HTMLPYParser
from Shnoolog import Shnoolog

"""
will process any htmlpy files and store their result in a cache
if a normal html file is given then it's stored as is
"""
class HTMLPYCache:
    __cache = {}
    __htmlpyExt = "htmlpy"
    __controlCharacters = re.compile('[\x00-\x1f]+') #0-31
    __multispaceBetweenTags = re.compile('>[\s]+<')
    __multispace = re.compile('[\s]+')

    def __init__(self, config) -> None:
        self.logging = Shnoolog('HTMLPYCache')
        self.__config = config

    def get(self,filepath):
        if filepath in self.__cache.keys():
            return self.__cache[filepath]
        return None

    def add(self, filepath):
        if filepath in self.__cache.keys():
            return

        content = ""

        if not os.path.exists(filepath):
            raise Exception("file {} doesn't exist".format(filepath))

        with open(filepath, "r") as file:
            content = file.read()

        path, ext = os.path.splitext(filepath)
        ext = ext[1:].lower()
        if self.__htmlpyExt == ext:
            self.logging.info(f"compiling shnoodle file to serve {filepath}")
            content = self.processHTMLPY(content)

        self.addEntry(filepath, content)

    def processHTMLPY(self,content):
        parser = HTMLPYParser(content)
        data = {'config': {
            'useTelemetry': self.__config.get('telemetry',False),
            'telemetryInterval' : self.__config.get('telemetryIntervalSec',1) * 1000,
            'gpuAvailable' : self.__config.get('enableGPUEncoding',False) and self.__config.get('gpu',Config.GPU.NONE) != Config.GPU.NONE,
            'subtitlesDelay': self.__config.get('subtitlesDelay', 0),
            'initialView' : self.__config.get('initialView','listView')
        }}

        parser.compile(data)
        return parser.getCompiledData()

    def addEntry(self, filepath, content):
        if filepath in self.__cache.keys():
            return

        if not content:
            self.logging.error("adding entry to cache with no content")
            return

        content = self.__controlCharacters.sub('', content)
        content = self.__multispaceBetweenTags.sub('><',content)
        content = self.__multispace.sub(' ',content)
        length = len(content)

        self.__cache[filepath] = {
            "content": content,
            "length":length
        }