FROM alpine:latest

ARG repository=https://github.com/yamasdais/mulavieg.git
ARG branch=master
ARG ffmpegcore_cdn=https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.0/dist/

WORKDIR /home
RUN apk --update add python3 git curl \
 && rm -rf /var/cache/apk/* \
 && git config --global core.fileMode false \
 && git clone --branch ${branch} ${repository} \
 && chmod +x mulavieg/docker/runOnContainer.sh \
 && (cd mulavieg/src/lib; for f in ffmpeg-core.js ffmpeg-core.wasm ffmpeg-core.worker.js; do curl -OL ${ffmpegcore_cdn}$f; done)
 
EXPOSE 8888
CMD mulavieg/docker/runOnContainer.sh