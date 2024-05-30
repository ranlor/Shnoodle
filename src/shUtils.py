import subprocess
import json
import os
import time
from Shnoolog import Shnoolog

logger = Shnoolog("Utilities")

def getLANip():
    loopback="127.0.0.1"
    result = subprocess.run(["ip", "-4", "-brief", "-json", "address", "show"], capture_output=True, text=True)

    if result.returncode != 0:
        return loopback

    output = result.stdout
    try:
        data = json.loads(output)
    except json.JSONDecodeError as e:
        logger.error(f"failed to parse ip command JSON: {e.msg}")
        return loopback

    try:
        for interface in data:
            if interface["operstate"] == "UP":
                return interface["addr_info"][0]["local"]
    except (KeyError,IndexError,TypeError) as e:
        logger.error(f"Failed to parse ip address info: {e}")

    return loopback


# a dumb solution to watch for file creation,
# the better way is to use inotify events while watching the
# parent directory instead of this dumb while loop
# https://pypi.org/project/inotify/
# or bash script with inotifyWait or inotifyBlock
# or just write your own c/cpp exec that used inotify kernel event
def waitOnFileCreation(path, timeoutSeconds, runningProcess) -> bool:

    def didFinish():
        if os.path.exists(path):
            return True
        returnCode = runningProcess.poll()
        if returnCode != None:
            raise RuntimeError("Process exited with signal {}".format(returnCode))

    if didFinish():
        return True

    maxTries = 20
    sleepInterval = timeoutSeconds / maxTries
    for i in range(maxTries):
        time.sleep(sleepInterval)
        if didFinish():
            return True

    return False
