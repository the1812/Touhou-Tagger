use anyhow::{ensure, Error};
use std::{mem, ptr, slice};

#[allow(
  non_camel_case_types,
  non_snake_case,
  non_upper_case_globals,
  dead_code
)]
mod ffi {
  include!(concat!(env!("OUT_DIR"), "/mozjpeg.rs"));
}

struct Encoder {
  compressor: ffi::jpeg_compress_struct,
  output: *mut u8,
}

impl Drop for Encoder {
  fn drop(&mut self) {
    unsafe {
      ffi::jpeg_destroy_compress(&mut self.compressor);
      ffi::free(self.output.cast());
    }
  }
}

pub fn encode(rgba: &[u8], width: usize, height: usize, quality: u32) -> Result<Vec<u8>, Error> {
  unsafe {
    let mut error_manager = mem::zeroed();
    let mut encoder = Encoder {
      compressor: mem::zeroed(),
      output: ptr::null_mut(),
    };
    let compressor = &mut encoder.compressor;
    compressor.err = ffi::jpeg_std_error(&mut error_manager);
    ffi::jpeg_CreateCompress(
      compressor,
      ffi::JPEG_LIB_VERSION as i32,
      mem::size_of::<ffi::jpeg_compress_struct>(),
    );

    let mut output_size = 0;
    ffi::jpeg_mem_dest(compressor, &mut encoder.output, &mut output_size);
    compressor.image_width = width as u32;
    compressor.image_height = height as u32;
    compressor.input_components = 4;
    compressor.in_color_space = ffi::J_COLOR_SPACE_JCS_EXT_RGBA;
    ffi::jpeg_set_defaults(compressor);
    ffi::jpeg_set_colorspace(compressor, ffi::J_COLOR_SPACE_JCS_YCbCr);
    ffi::jpeg_c_set_int_param(compressor, ffi::J_INT_PARAM_JINT_BASE_QUANT_TBL_IDX, 3);
    compressor.optimize_coding = 1;
    compressor.arith_code = 0;
    compressor.smoothing_factor = 0;
    ffi::jpeg_c_set_bool_param(
      compressor,
      ffi::J_BOOLEAN_PARAM_JBOOLEAN_USE_SCANS_IN_TRELLIS,
      0,
    );
    ffi::jpeg_c_set_bool_param(compressor, ffi::J_BOOLEAN_PARAM_JBOOLEAN_TRELLIS_EOB_OPT, 0);
    ffi::jpeg_c_set_bool_param(compressor, ffi::J_BOOLEAN_PARAM_JBOOLEAN_TRELLIS_Q_OPT, 0);
    ffi::jpeg_c_set_int_param(compressor, ffi::J_INT_PARAM_JINT_TRELLIS_NUM_LOOPS, 1);
    ffi::jpeg_c_set_int_param(compressor, ffi::J_INT_PARAM_JINT_DC_SCAN_OPT_MODE, 0);
    let mut quality = quality.to_string().into_bytes();
    quality.push(0);
    ensure!(
      ffi::set_quality_ratings(compressor, quality.as_mut_ptr().cast(), 0) != 0,
      "MozJPEG rejected quality"
    );
    ffi::jpeg_simple_progression(compressor);
    ffi::jpeg_start_compress(compressor, 1);
    while compressor.next_scanline < compressor.image_height {
      let mut row = rgba
        .as_ptr()
        .add(compressor.next_scanline as usize * width * 4)
        .cast_mut();
      ffi::jpeg_write_scanlines(compressor, &mut row, 1);
    }
    ffi::jpeg_finish_compress(compressor);
    ensure!(
      !encoder.output.is_null() && output_size > 0 && output_size <= isize::MAX as _,
      "MozJPEG returned invalid output"
    );
    Ok(slice::from_raw_parts(encoder.output, output_size as usize).to_vec())
  }
}
