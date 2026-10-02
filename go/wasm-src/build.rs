use std::{env, fmt::Write as _, path::PathBuf, process::Command};

fn run(command: &mut Command) {
  assert!(command.status().unwrap().success(), "failed: {command:?}");
}

fn main() {
  let output = PathBuf::from(env::var("OUT_DIR").unwrap());
  let source = output.join("mozjpeg");
  let sdk = PathBuf::from(env::var("WASI_SDK_PATH").unwrap());
  let archive = env::var("MOZJPEG_ARCHIVE").unwrap();
  println!("cargo:rerun-if-env-changed=WASI_SDK_PATH");
  println!("cargo:rerun-if-env-changed=MOZJPEG_ARCHIVE");
  println!("cargo:rerun-if-changed={archive}");
  println!("cargo:rerun-if-changed=build.rs");

  std::fs::create_dir_all(&source).unwrap();
  run(
    Command::new("tar")
      .args(["-xzf", &archive, "--strip-components=1", "-C"])
      .arg(&source),
  );
  run(Command::new("autoreconf").arg("-iv").current_dir(&source));
  run(
    Command::new("./configure")
      .current_dir(&source)
      .env("CC", sdk.join("bin/clang"))
      .env("AR", sdk.join("bin/llvm-ar"))
      .env("RANLIB", sdk.join("bin/llvm-ranlib"))
      .env("CFLAGS", "-O3")
      .args([
        "--host=wasm32-wasi",
        "--disable-shared",
        "--without-turbojpeg",
        "--without-simd",
        "--without-arith-enc",
        "--without-arith-dec",
        "--with-build-date=squoosh",
      ]),
  );
  run(Command::new("make").current_dir(&source).args([
    "-j",
    &std::thread::available_parallelism().unwrap().to_string(),
    "libjpeg.la",
    "rdswitch.o",
  ]));
  run(
    Command::new(sdk.join("bin/llvm-ar"))
      .current_dir(&source)
      .args(["rcs", ".libs/librdswitch.a", "rdswitch.o"]),
  );

  let resource_dir = Command::new(sdk.join("bin/clang"))
    .arg("-print-resource-dir")
    .output()
    .unwrap();
  assert!(resource_dir.status.success());
  bindgen::Builder::default()
        .header_contents("bindings.h", "#include <stddef.h>\n#include <stdio.h>\n#include <stdlib.h>\n#include \"jpeglib.h\"\n#include \"cdjpeg.h\"\n")
        .clang_arg("--target=wasm32-wasi")
        .clang_arg("-fvisibility=default")
        .clang_arg(format!("-resource-dir={}", String::from_utf8(resource_dir.stdout).unwrap().trim()))
        .clang_arg(format!("--sysroot={}", sdk.join("share/wasi-sysroot").display()))
        .clang_arg(format!("-I{}", source.display()))
        .allowlist_function("jpeg_.*|set_quality_ratings|free")
        .allowlist_var("JPEG_LIB_VERSION|J.*")
        .generate_comments(false)
        .layout_tests(false)
        .formatter(bindgen::Formatter::None)
        .generate().unwrap()
        .write_to_file(output.join("mozjpeg.rs")).unwrap();
  println!(
    "cargo:rustc-link-search=native={}",
    source.join(".libs").display()
  );
  println!("cargo:rustc-link-lib=static=rdswitch");
  println!("cargo:rustc-link-lib=static=jpeg");

  let mut lookup_table = String::from("static SRGB_TO_LINEAR: [f32; 256] = [");
  for value in 0..=255 {
    let value = value as f32 / 255.0;
    let linear = if value < 0.04045 {
      value / 12.92
    } else {
      (((value + 0.055) / 1.055).powf(2.4)).clamp(0.0, 1.0)
    };
    write!(lookup_table, "{linear:.7},").unwrap();
  }
  lookup_table.push_str("];");
  std::fs::write(output.join("srgb_lut.rs"), lookup_table).unwrap();
}
