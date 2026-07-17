#!/usr/bin/env bash
set -euo pipefail

cp -R /source/. /build/
cd /build

autoreconf -iv
emconfigure ./configure \
  --disable-shared \
  --without-turbojpeg \
  --without-simd \
  --without-arith-enc \
  --without-arith-dec \
  --with-build-date=squoosh

emmake make -j1 libjpeg.la rdswitch.o \
  CFLAGS="-O3 -flto" \
  CXXFLAGS="-O3 -flto -std=c++17"

em++ \
  -I /build \
  -O3 \
  -flto \
  -std=c++17 \
  --no-entry \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s ERROR_ON_UNDEFINED_SYMBOLS=1 \
  -s FILESYSTEM=0 \
  -s MALLOC=emmalloc \
  -s STANDALONE_WASM=1 \
  -s 'EXPORTED_FUNCTIONS=["_abi_version","_alloc","_free","_mozjpeg_encode"]' \
  -Wl,--strip-all \
  /project/mozjpeg.cpp \
  /build/rdswitch.o \
  /build/.libs/libjpeg.a \
  -o /out/mozjpeg.wasm
