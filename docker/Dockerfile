FROM alpine:latest

ARG repository=https://github.com/yamasdais/mulavieg.git
ARG branch=master

WORKDIR /home
RUN apk --update add python3 git \
 && rm -rf /var/cache/apk/* \
 && git config --global core.fileMode false \
 && git clone --branch ${branch} ${repository} \
 && chmod +x mulavieg/docker/runOnContainer.sh
 
EXPOSE 8888
CMD mulavieg/docker/runOnContainer.sh