# mulavieg

Cumulative text movie maker on single page application

## description

This SPA(single page application) generates highlighted code image and movie of accumulating it.
I hope this is useful, but without any warranty.
Your *sacred* code will not be uploaded anywhere (unless the site or one of the dependency script's CDNs is cracked and replaced with BAD js files, of course).
 
## Usage

Open the html file via web browser. It requires a http server. 'file:' protocol won't work.
The easiest way is run [webservice.py](./src/webservice.py) and access to port 8888.

### Run on Docker container

~~~
# build container image in docker directory
docker build --pull --rm -t mulavieg:latest .
# build container image from develop branch if you want
docker build --pull --rm -t mulavieg:dev --build-arg branch=develop .
# run container
docker run --name mulavieg_master -p 8888:8888 mulavieg:latest
~~~

## Copyright

[License](./LICENSE)

