use anyhow::ensure;
use extism_pdk::*;

mod mozjpeg;
mod resize;

struct Image<'a> {
  width: usize,
  height: usize,
  output_width: usize,
  output_height: usize,
  quality: u32,
  rgba: &'a [u8],
}

impl<'a> Image<'a> {
  fn read(input: &'a [u8]) -> Result<Self, Error> {
    ensure!(input.len() >= 20, "missing image parameters");
    let mut fields = input[..20]
      .chunks_exact(4)
      .map(|bytes| u32::from_le_bytes(bytes.try_into().unwrap()));
    let image = Self {
      width: fields.next().unwrap() as usize,
      height: fields.next().unwrap() as usize,
      output_width: fields.next().unwrap() as usize,
      output_height: fields.next().unwrap() as usize,
      quality: fields.next().unwrap(),
      rgba: &input[20..],
    };
    ensure!(
      image.rgba.len() == rgba_length(image.width, image.height)?,
      "RGBA data length does not match dimensions"
    );
    rgba_length(image.output_width, image.output_height)?;
    ensure!(image.quality <= 100, "JPEG quality exceeds 100");
    Ok(image)
  }

  fn resize(&self) -> Result<Vec<u8>, Error> {
    let mut output = vec![0; rgba_length(self.output_width, self.output_height)?];
    resize::resize_rgba(
      self.rgba,
      self.width,
      self.height,
      &mut output,
      self.output_width,
      self.output_height,
    );
    Ok(output)
  }
}

fn rgba_length(width: usize, height: usize) -> Result<usize, Error> {
  ensure!(width > 0 && height > 0, "invalid RGBA dimensions");
  width
    .checked_mul(height)
    .and_then(|pixels| pixels.checked_mul(4))
    .filter(|length| *length <= isize::MAX as usize)
    .ok_or_else(|| Error::msg("RGBA image exceeds WASM32 memory"))
}

#[plugin_fn]
pub fn compress(input: Vec<u8>) -> FnResult<Vec<u8>> {
  let image = Image::read(&input)?;
  let resized;
  let rgba = if image.width == image.output_width && image.height == image.output_height {
    image.rgba
  } else {
    resized = image.resize()?;
    &resized
  };
  Ok(mozjpeg::encode(
    rgba,
    image.output_width,
    image.output_height,
    image.quality,
  )?)
}

#[plugin_fn]
pub fn resize(input: Vec<u8>) -> FnResult<Vec<u8>> {
  Ok(Image::read(&input)?.resize()?)
}
