# mulavieg

Cumulative text movie maker on single page application

<div><video controls muted preload="metadata"
            poster="https://user-images.githubusercontent.com/24844381/192092716-fd71b548-6b2d-4a85-95d6-1886acb4d085.png"
            src="https://user-images.githubusercontent.com/24844381/192092736-a64e75e1-2394-4e69-aece-9fe68184380b.mp4"></video></div>

## Description

This SPA(Single Page Application) generates highlighted(by highlight.js) code image and movie of accumulating it.
You can select the font, code style, duration, frame per second and so on.
Your *sacred* code will not be uploaded anywhere (unless the site or one of the dependency script's CDNs is cracked and replaced with BAD js files, of course).
I hope this is useful, but without any warranty.
 
## How to run

Unfortunately I don't have any public web server to host this SPA.
Clone this and open the html file with a modern web browser via a http server. 'file:' protocol won't work.
The easiest way is run [webservice.py](./src/webservice.py) and access to port 8888.

### Run on Docker container

~~~shell
# build container image in docker directory
docker build --pull --rm -t mulavieg:latest .
# build container image from develop branch if you want
docker build --pull --rm -t mulavieg:dev --build-arg branch=develop .
# run container
docker run --name mulavieg_master -p 8888:8888 mulavieg:latest
~~~

Then access http://localhost:8888/ on you web browser.

## Usage

1. Paste your code into the input code text area.
2. Push 'Prepare' button and let highlight.js deduce the language of the code.
3. Push 'Preview' and adjust as you like.
4. Push 'Image' button if you want the PNG image.
5. Push 'Movie' button and download the movie file.

## Copyright

[License](./LICENSE)

Notice the ffmpeg core library may contain various non-free libraries.


