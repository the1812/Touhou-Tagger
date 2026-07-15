use std::fmt::Write as _;

fn main() {
    let mut lookup_table = String::from("static SRGB_TO_LINEAR: [f32; 256] = [");
    for value in 0..=255 {
        write!(lookup_table, "{:.7},", srgb_to_linear(value as f32 / 255.0)).unwrap();
    }
    lookup_table.push_str("];");
    let output = std::path::PathBuf::from(std::env::var("OUT_DIR").unwrap()).join("srgb_lut.rs");
    std::fs::write(output, lookup_table).unwrap();
}

fn srgb_to_linear(value: f32) -> f32 {
    if value < 0.04045 {
        value / 12.92
    } else {
        (((value + 0.055) / 1.055).powf(2.4)).clamp(0.0, 1.0)
    }
}
