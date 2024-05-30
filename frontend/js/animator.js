export class ImageAnimator
{
    #parent = null;
    #context = null;
    #timeoutId = null;
    #running = false;
    #interval = 0;
    #frames = []
    #currentFrame = 0;
    #isLooping = false;
    #isResized = false;
    #dim = {width:0, height:0};
    #imageSrcs = []

    constructor(frames, frameInterval, loop = true)
    {
        this.#parent = document.createElement("canvas");
        this.#parent.classList.add("image-animator");
        this.#context = this.#parent.getContext("2d");
        this.#interval = frameInterval;
        this.#isResized = false;
        this.#isLooping = loop;
        this.#imageSrcs = frames;
        this.#setSize(256,256);

    }

    #setSize(width,height)
    {
        this.#parent.width = width;
        this.#parent.height = height;
        this.#dim.width = width;
        this.#dim.height = height;
        this.#isResized = width > 0 && height > 0;
    }

    #clear()
    {
        // go over alpha channel in every pixel and set it to 0
        // to achieve a transparent clearance of the background
        // so the next image with transparency can be drawn and
        // no trails will show
        let imageData = this.#context.getImageData(0,0,this.#dim.width, this.#dim.height);
        for (let i=3; i<imageData.data.length; i+=4) // data is rgba format
        {
            imageData.data[i] = 0; // alpha channel
        }
        this.#context.putImageData(imageData,0,0);
    }

    #paint()
    {
        if (this.#isResized)
        {
            this.#context.drawImage(this.#frames[this.#currentFrame],0,0,this.#dim.width, this.#dim.height);
            this.#currentFrame = (this.#currentFrame+1) % this.#frames.length;
        }
        if (!this.#isLooping) { return; }
        if (!this.#running) { return; }
        this.#timeoutId = setTimeout((_this)=>{
            _this.#clear();
            _this.#paint();
        },this.#interval, this);
    }

    #initFrames()
    {
        // load all images
        for(let frame of this.#imageSrcs)
        {
            let image = new Image();
            image.onload = () => {
                (function(_img, _this){
                    _this.#setSize(_img.width, _img.height)
                })(image, this);
            };
            this.#frames.push(image);
            image.src = frame;
        }
    }

    start()
    {
        if (this.#running) { return; }
        this.#running = true;
        if (this.#frames.length == 0)
        {
            this.#initFrames();
        }
        this.#paint();
    }

    stop()
    {
        if (!this.#running) { return; }
        this.#running = false;
        clearTimeout(this.#timeoutId);
    }

    get element() { return this.#parent; }
}