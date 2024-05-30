from gpu.gpu import GPU

class Intel(GPU):

    def __init__(self, useTelemetry=False) -> None:
        super().__init__()
        raise Exception("Not implemented")

    def getUsagePercent(self):
        raise Exception("Not implemented")

    def getMemoryUsagePercent(self):
        raise Exception("Not implemented")

    def getTemp(self):
        raise Exception("not implemented")

    def get246Encoder(self):
        raise Exception("Not implemented")