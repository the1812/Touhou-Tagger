use resize::{Pixel, Type};

include!(concat!(env!("OUT_DIR"), "/srgb_lut.rs"));

pub fn resize_rgba(
  input: &[u8],
  input_width: usize,
  input_height: usize,
  output: &mut [u8],
  output_width: usize,
  output_height: usize,
) {
  let mut preprocessed = vec![0.0_f32; input.len()];
  for (source, target) in input.chunks_exact(4).zip(preprocessed.chunks_exact_mut(4)) {
    let alpha = f32::from(source[3]) / 255.0;
    for channel in 0..3 {
      target[channel] = srgb_to_linear(source[channel]) * alpha;
    }
    target[3] = alpha;
  }

  let mut resized = vec![0.0_f32; output.len()];
  let mut resizer = resize::new(
    input_width,
    input_height,
    output_width,
    output_height,
    Pixel::RGBAF32,
    Type::Lanczos3,
  );
  resizer.resize(&preprocessed, &mut resized);

  for (source, target) in resized.chunks_exact(4).zip(output.chunks_exact_mut(4)) {
    let alpha = source[3];
    for channel in 0..3 {
      let value = if alpha == 0.0 {
        0.0
      } else {
        source[channel] / alpha
      };
      target[channel] = linear_to_srgb(value);
    }
    target[3] = (alpha * 255.0).round().clamp(0.0, 255.0) as u8;
  }
}

fn srgb_to_linear(value: u8) -> f32 {
  SRGB_TO_LINEAR[usize::from(value)]
}

fn linear_to_srgb(value: f32) -> u8 {
  let value = if value < 0.0031308 {
    value * 12.92
  } else {
    (1.055 * value.powf(1.0 / 2.4) - 0.055).clamp(0.0, 1.0)
  };
  (value * 255.0).clamp(0.0, 255.0) as u8
}
