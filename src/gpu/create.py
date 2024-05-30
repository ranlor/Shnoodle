from gpu.nvidia.nvidia import Nvidia
from gpu.amd.amd import AMD
from gpu.intel.intel import Intel
from Config import Config

def createGPU(identifier, useTelemetry=False):
    match identifier:
        case Config.GPU.NVIDIA:
            return Nvidia(useTelemetry)
        case Config.GPU.AMD:
            return AMD(useTelemetry)
        case Config.GPU.INTEL:
            return Intel(useTelemetry)
    return None