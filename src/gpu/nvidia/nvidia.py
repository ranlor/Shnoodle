from gpu.gpu import GPU
from gpu.nvidia.tele import NvidiaTelemetry

class Nvidia(GPU):

    def __init__(self, useTelemetry=False) -> None:
        super().__init__()
        self.telemetry = None
        if useTelemetry:
            self.telemetry = NvidiaTelemetry()

    def getUsagePercent(self):
        if self.telemetry:
            return self.telemetry.usagePercent()
        return None

    def getMemoryUsagePercent(self):
        if self.telemetry:
            return self.telemetry.memoryPercent()
        return None

    def getTemp(self):
        if self.telemetry:
            return self.telemetry.tempC()
        return None

    def get246Encoder(self):
        return 'h264_nvenc'