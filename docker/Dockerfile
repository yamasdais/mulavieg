FROM alpine:latest

ARG branch=master

WORKDIR /home
RUN apk --update add python3 git \
 && rm -rf /var/cache/apk/* \
 && git clone --branch $branch https://github.com/yamasdais/mulavieg.git
 
EXPOSE 8888