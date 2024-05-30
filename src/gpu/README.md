## GPU
as described in `/config/README.md` this is where different GPU will help the server to get data on them, data like Usage/Temps/transcoder

each of the directory has a file that extends the GPU parent class which have to implement all or none of the public api:
- `getUsagePercent`: (optional) the usage percent of the gpu (used if telemetry is turned on)
- `getMemoryUsagePercent`: (optional) the usage percent of the gpu memory (used if telemetry is turned on)
- `get246Encoder`: (optional) the name of the h264 encoder that will use the GPU and transcoding with ffmpeg (used if `enableGPUEncoding` is true)

example implementation is only available for nvidia gpu under linux (using nvidia-smi)