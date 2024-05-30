# Patches json file
patches.json will include rules for show names and show thumbnails that seem to be off when 
looking at poster view.
- for show names the logic does its best to try to assume the show name from the file structure but if that  fails these patches will patch things up
- for thumbnail image, patches can help to find a timestamp that represents the show as a whole (i.e. title card, opening credits etc)

these are key value options
key := describe the current show name that we want to change (can be the whole name or a substring)
for show name:
value := the official name we want the show to have
for thumbnail image we define the timestamp of pattern HH:MM:SS:
value := 00:01:10 
example:
```
{
    "names": { "nameof show":"Name of Show"},
    "thumbnails" : { "nameof show": 00:00:10 }
}
```
this will replace all the shows with that are `nameof show` with `Name of Show`
and generate the view thumbnail from that timestamp

the key match is case sensitive

## modifiers:

the key value can have modifiers
- `showname*` : means we will affect every show that starts with "show"
- `*showname` : means we will affect every show that ends with "show"
- `*showname*`: means we will affect every show includes the string "show"

example:

```
{
    "names": { "some show*":"Some Show Thing" },
    "thumbnails" : { "*some show*": 00:00:10 }
}
```
this will replace all the shows with that start with `some show` with `Some Show Thing`
and use a thumbnail of 10 seconds into the video file of a show with name that ends with `some show`

An important note: if the same show appears in "names" and "thumbnails" the "thumbnails" key should
be the corrected show name you used in "names"

Won't work, BAD:
```
{
    "names": { "SHOW1":"The best show" },
    "thumbnails" : { "SHOW1": 00:00:10 }
}
```

Will work, GOOD:
```
{
    "names": { "SHOW1":"The best show" },
    "thumbnails" : { "The best show": 00:00:10 }
}
```

This is due to thumbnails being evaluated after the show names
