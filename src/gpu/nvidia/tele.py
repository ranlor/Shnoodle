import os
import subprocess
from Shnoolog import Shnoolog

class NvidiaTelemetry:

    def __init__(self) -> None:
        self.logger = Shnoolog("NvidiaTelemetry")
        match os.name:
            case "posix":
                self.cli = "nvidia-smi"
            case "nt":
                self.cli = "nvidia-smi.exe"
        try:
            result = self.runTerminal([self.cli])
            if not result:
                raise Exception("missing requirement {}, make sure it's in the path".format(self.cli))
        except Exception as e:
            raise Exception("Requirement failure: {}".format(e))



    def runTerminal(self, command):
        self.logger.info("Running command: {}".format(" ".join(command)))
        result = subprocess.run(command, capture_output=True, text=True)

        if result.returncode != 0:
            return None

        output = result.stdout
        output = output.strip(' \r\n\t')
        return output

    def usagePercent(self):
        ret = self.runTerminal([self.cli, '--query-gpu=utilization.gpu', '--format=csv,noheader,nounits'])
        return ret

    def memoryPercent(self):
        ret = self.runTerminal([self.cli, '--query-gpu=utilization.memory', '--format=csv,noheader,nounits'])
        return ret

    def tempC(self):
        ret = self.runTerminal([self.cli, '--query-gpu=temperature.gpu', '--format=csv,noheader,nounits'])
        return ret

