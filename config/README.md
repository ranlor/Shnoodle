## Shnoodle configuration file
configuration file is a json object that will determine many of the initializations and run-time parameters of Shnoodle

## Configurations

- `port (Number)`: port the server will listen on. i.e. : `8080`
- `mediaPaths (Array[Strings])`: an array of paths to scan for media files. i.e. : `['path/to/here/' , 'path/to/there']`
- `allowedMediaExt (Array[String])`: what files types to consider as media types (as long as they are supported by ffmpeg/ffprob). i.e. `["mkv","mp4"]`
- `blacklist (String)`: a path of the blacklist json file (more info about this file is later in this doc). i.e. : `'path/to/blacklist.json`
- `root_path (String)`: a relative path to where all the front end files are found (js/html/css), defaulted to 'frontend. i.e. `'frontend'`
- `resource_path (String)`: a absolute/relative path (absolute path will start with `/`) to where to store the transcoded files when streaming a file/creating thumbnails. note that this path will be cleaned on exit. i.e. `'/some/path/with/alot/of/diskspace/`'
- `404File (String)`: the name of the file that will be served on any 404 status code, this file must be found in the root of `root_path`, i.e. `'404.html'`
- `defaultFile (String)`:  the name of the index file (the file that will be served on / access to the server), this file can be a regular html file or htmlpy file (described later here), file must be at root of `root_path`. i.e. `'index.html'`
- `ffmpeg (String)` : path to ffmpeg executable (or just 'ffmpeg' in linux, if in PATH). i.e. `/my/ffmpeg/ffmpeg`
- `ffprobe (String)`: path to ffprob executable (or just 'ffprobe' in linux, if in PATH). i.e. `/my/ffmpeg/ffprob`
- `thumbWidth (Number)`: the width (in pixels) of the generated thumbnails (height is proportional to the ratio of the video frame). i.e. `640`
- `thumbQuality (Number)`: the quality the webp file generated for thumbnails [0 low - 100 highest]. i.e. `90`
- `transcodingTimeoutInSeconds (Number)`: number of seconds to wait until we consider a transcoding of a video file too slow for streaming and just give up (slower machines my want to increase it). i.e. `30`
- `enableGPUEncoding (Boolean)` : whether to allow a user to transcode media with GPU acceleration or not. i.e. `true`
- `gpu (String)` : an enum which determines what kind of GPU to try to transcode with, if this is `none` the `enableGPUEncoding` will be disabled, acceptable values nvidia/amd/intel/none. currently only implemented for nvidia, other GPU will need to add implementation (described in this doc) i.e. `"nvidia"`
- `initialView (String)` : what tab to show on the home page options: `filesview, posterview, listview`. i.e. : `"listview"`
- `telemetry (Boolean)` : if to show telemetry gui in the front end, telemetry means CPU/GPU(if available)/Memory usage and temps(only available in Linux with `sensors` installed). i.e. `true`
- `telemetryIntervalSec (Number)` : number of seconds between updates of the telemetry
- `telemetryTempValues (Object)` : an object that helps to parse temperatures for a machine using `sensors` in linux. the object is a key:value pair with the key being how the device appear in the sensors output, and the value is the human readable name of the property. i.e. `{ "Package id 0":"CPU Avg Temp C" }`
- `subtitlesDelay (Number)` : number of milliseconds to delay subtitles when playing a video. i.e.  `{ "subtitlesDelay" : 1000 }`


## Blacklist
Blacklist is a json file that will have lists of strings which you want sanitized from filenames that appear in you media paths (in paths at `mediaPaths` options)

For example:
- for a filename : `Cool Video [encoded by Prox]`
- you want only the name of the video `Cool Video` to appear in the front end
- you'll add `[encoded by Prox]` to the blacklist and it will sanitized from all files in the media paths

### Blacklist Structure
The blacklist json file looks like this:
```
{
    "blacklist" : ["this", "that", ....]
    ,
    "compound_blacklist" : [ "this that", "that this" ... ]
}
```
- blacklist: is an array of single strings with no `\s\.\-\(\)` you wish to sanitize
- compound_blacklist: is array of strings combinations with `\s\.\-\(\)` in them you want to sanitize

#### Rational:
if you have 2 files:
- `video H.264`
- `video of something else 264`

if you add `H` and `264` to the blacklist only i.e. `{ "blacklist" : ["H" , "264"] }`


you'll get sanitized filenames:
- `video .` <-- dot is still there
- `video of something else`

so for this kind of situations you use compound_blacklist. i.e. `{ "blacklist" : ["264"], "compound_blacklist" : ["H.264] }`

and you'll get sanitized filenames:
- `video`
- `video of something else`

as intended


### HTMLPY file types
HTMLPY extension on files will be processed which will generate an HTML file with extra strings in it.
the strings are generated from python objects which are converted to json objects
it is very primitive and will only occur once per session, since the result will be cached while the server is running

this allows the python server code to inject parameters into the html file

HTMLPY file:
```
<html>
...
<py%
paramInPython
%py>
</html>
```
each section is started and end between `<py%` and `%py>` tags. each section can have one python object that will be translated to json.

the python object will have a key associated to it and will be inserted into the processes HTML file

example:
- python dictionary:
```
{
    "data one": "data should be displayed",
    "data two": { "this": 1, "that": True}
}
```

- HTMLPY file
```
<html>
    <head>
        <title><py% data one %py></title>
    </head>
    <body>
        <script>
            const stuff = <py% data two %py>;
        </script>
    </body>
</html>
```

- Resulting HTML file

```
<html>
    <head>
        <title>data should be displayed</title>
    </head>
    <body>
        <script>
            const stuff =  { "this": 1, "that": true};
        </script>
    </body>
</html>
```

# GPU Configuration
described under `/gpu/` path