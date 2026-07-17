FROM rust:1.88.0-slim-bookworm@sha256:a6cab604fa016ac022e78c24038497eb7617ab59150ca4c3dd2ede0fbd514d4b

RUN rustup target add wasm32-unknown-unknown

COPY Cargo.toml Cargo.lock /manifest/
RUN mkdir /manifest/src \
    && touch /manifest/src/lib.rs \
    && cd /manifest \
    && cargo fetch --locked --target wasm32-unknown-unknown

ENV CARGO_NET_OFFLINE=true
ENV CARGO_TARGET_DIR=/target
WORKDIR /src
ENTRYPOINT ["/bin/sh", "-c", "cargo build --offline --locked --release --target wasm32-unknown-unknown && cp /target/wasm32-unknown-unknown/release/touhou_tagger_resize_wasm.wasm /out/resize.wasm"]
