FROM alpine:latest

ARG repository=https://github.com/yamasdais/mulavieg.git
ARG branch=master

WORKDIR /home
RUN apk --update add python3 git \
 && rm -rf /var/cache/apk/* \
 && git clone --branch ${branch} ${repository}
 
EXPOSE 8888
CMD mulavieg/docker/runOnContainer.sh