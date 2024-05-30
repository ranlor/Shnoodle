import json

class HTMLPYParser:
    __start = "<%py"
    __end = "py%>"

    def __init__(self, content) -> None:
        self.__content = content
        self.__compiledContent = None

    def compile(self, data):
        if self.__compiledContent:
            return

        extractedVariables = self.parseHTMLPY()
        if not extractedVariables:
            self.__compiledContent = self.__content
            return

        compiledData = []
        for match in extractedVariables:
            varName = match['content']
            if varName in data:
                compiledData.append({
                    "data" : data[varName],
                    "match": match
                })

        self.transplantData(compiledData)



    def getCompiledData(self):
        return self.__compiledContent


    def parseHTMLPY(self):
        matches = []
        offset = 0
        match = {}
        for line in str(self.__content).splitlines():
            start = line.find(self.__start)
            end = line.find(self.__end)
            if start != -1:
                match["start"] = offset + start + len(self.__start)

            if end != -1:
                match["end"] = offset + end
                matches.append(match)
                match = {}

            offset += len(line)+1

        resultMatches = []
        for match in matches:
            if 'start' not in match:
                continue
            if 'end' not in match:
                continue

            resultMatches.append({
                "start"  : match['start'],
                "end"    : match['end'],
                "content": self.__content[match['start']:match['end']].strip(' \n\t\r\n')
            })

        return resultMatches

    def transplantData(self,compiledData):
        compiledContent = []

        lastOffset = 0
        for compiledSegment in compiledData:
            compiledContent.append(self.__content[lastOffset:compiledSegment['match']['start'] - len(self.__start)])
            compiledContent.append(json.dumps(compiledSegment['data']))
            lastOffset = compiledSegment['match']['end'] + len(self.__end)

        compiledContent.append(self.__content[lastOffset:])

        self.__compiledContent = "".join(compiledContent)
