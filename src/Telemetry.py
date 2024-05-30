import psutil

class Telemetry:

    def __init__(self, gpuTelemetry = None) -> None:
        self.gpuTelemetry = gpuTelemetry
        psutil.cpu_percent() #initialize cpu percent for future calls

    def cpuUsage(self):
        return psutil.cpu_percent()

    def memUsage(self):
        mem = psutil.virtual_memory()
        return mem.percent

    def gpuUsage(self):
        if self.gpuTelemetry:
            return self.gpuTelemetry.getUsagePercent()

    def gpuMemUsage(self):
        if self.gpuTelemetry:
            return self.gpuTelemetry.getMemoryUsagePercent()

    def gpuTemp(self):
        if self.gpuTelemetry:
            return self.gpuTelemetry.getTemp()

    def getTemps(self, temperatureKeys):
        returnedTemps = []
        temps = psutil.sensors_temperatures()
        if not temps:
            return returnedTemps

        for qualifiedName, label in temperatureKeys.items():
            for name, entries in temps.items():
                for entry in entries:
                    if name == label or entry.label == label:
                        returnedTemps.append((qualifiedName, entry.current))

        return returnedTemps