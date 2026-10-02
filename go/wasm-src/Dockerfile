FROM ghcr.io/webassembly/wasi-sdk:wasi-sdk-25@sha256:fdebde86990902087ecc470bf993ffec4d646e8fbd2e68c290a44120437622d0 AS wasi
FROM rust:1.88.0-slim-bookworm@sha256:a6cab604fa016ac022e78c24038497eb7617ab59150ca4c3dd2ede0fbd514d4b AS build

COPY --from=wasi /opt/wasi-sdk /opt/wasi-sdk
RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends autoconf automake libtool make pkg-config libclang-dev \
  && rm -rf /var/lib/apt/lists/* \
  && rustup target add wasm32-wasip1
RUN rustup component add rustfmt

COPY Cargo.toml Cargo.lock /manifest/
RUN mkdir /manifest/src \
  && touch /manifest/src/lib.rs \
  && cd /manifest \
  && cargo fetch --locked

ENV CARGO_NET_OFFLINE=true \
  CARGO_TARGET_DIR=/target \
  WASI_SDK_PATH=/opt/wasi-sdk \
  MOZJPEG_ARCHIVE=/source.tar.gz
WORKDIR /src
COPY --from=mozjpeg /mozjpeg.tar.gz /source.tar.gz
COPY Cargo.toml Cargo.lock rust-toolchain.toml rustfmt.toml build.rs ./
COPY src ./src
RUN --network=none cargo fmt --check \
  && cargo build --offline --locked --release --target wasm32-wasip1

FROM scratch AS artifact
COPY --from=build /target/wasm32-wasip1/release/touhou_tagger_imagecodec.wasm /imagecodec.wasm
