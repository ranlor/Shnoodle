import os
import json
from enum import Enum
from Shnoolog import Shnoolog

class Config:

    class GPU(Enum):
        NONE='none'
        NVIDIA='nvidia'
        AMD='amd'
        INTEL='intel'

    __conf = {}
    __loaded = False

    def __init__(self, confilePath) -> None:
        self.logger = Shnoolog("Config")
        if confilePath:
            if os.path.exists(confilePath):
                with open(confilePath, "r") as jsonFile:
                    conf = json.load(jsonFile)
                    if conf:
                        self.__conf = conf
                        self.__loaded = True
                    else:
                        self.logger.error("Malformed configuration file")

            else:
                self.logger.error(f"configuration file {confilePath} not found")

        if not self.__validateGPU__() and self.__loaded:
            self.logger.warning("invalid value in gpu config {}".format(self.__conf['gpu']))


    def __validateGPU__(self):
        if not self.__loaded:
            return False

        gpuVal = self.get('gpu', Config.GPU.NONE.value)

        try:
            self.__conf['gpu'] = Config.GPU(gpuVal)
        except:
            return False

        return True

    def didLoad(self):
        return self.__loaded

    def get(self, key, defaultValue=None):
        if self.__loaded and key in self.__conf:
            return self.__conf[key]
        return defaultValue

    def set(self, key, value):
        self.__conf[key] = value