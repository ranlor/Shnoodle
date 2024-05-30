import logging

class Shnoolog:
    __outputToStd = False

    def __init__(self, name, toStd=False):
        self.__logging = logging.getLogger(name)
        self.__outputToStd = toStd

    def logError(self, msg, output=True):
        if output:
            print(f"[Error] {msg}", file=sys.stderr)
        self.__logging.error(msg)

    def logWarn(self, msg, output=True):
        if output:
            print(f"[Warning] {msg}")
        self.__logging.warning(msg)

    def logInfo(self, msg, output=True):
        if output:
            print(msg)
        self.__logging.info(msg)

    def error(self, msg):
        if self.__outputToStd:
            print("[Error]",msg)
        self.logError(msg, False)

    def info(self, msg):
        if self.__outputToStd:
            print("[Info]",msg)
        self.logInfo(msg, False)

    def warning(self, msg):
        if self.__outputToStd:
            print("[Warning]",msg)
        self.logWarn(msg, False)


