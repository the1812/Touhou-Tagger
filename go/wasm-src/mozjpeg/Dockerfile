FROM emscripten/emsdk:2.0.23@sha256:5871ba43a788243cbf890e2cb1a95e33e9cb72dcf52e1d2077ca39f2171f8b07

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends autoconf automake libtool pkg-config \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY build.sh mozjpeg.cpp /project/
ENV EMCC_CORES=4
ENTRYPOINT ["/bin/bash", "/project/build.sh"]
