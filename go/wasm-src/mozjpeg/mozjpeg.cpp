#include <inttypes.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

#include "config.h"
#include "jpeglib.h"

extern "C" {
#include "cdjpeg.h"
}

#define ABI_VERSION 1

extern "C" uint32_t abi_version(void) { return ABI_VERSION; }

extern "C" void *alloc(size_t size) { return malloc(size); }

extern "C" uint32_t mozjpeg_encode(const uint8_t *rgba, uint32_t width,
                                    uint32_t height, uint32_t quality,
                                    uint32_t *output_descriptor) {
  if (rgba == NULL || width == 0 || height == 0 || output_descriptor == NULL) {
    return 1;
  }

  output_descriptor[0] = 0;
  output_descriptor[1] = 0;

  struct jpeg_compress_struct compressor;
  struct jpeg_error_mgr error_manager;
  compressor.err = jpeg_std_error(&error_manager);
  jpeg_create_compress(&compressor);

  uint8_t *output = NULL;
  unsigned long output_size = 0;
  jpeg_mem_dest(&compressor, &output, &output_size);

  compressor.image_width = width;
  compressor.image_height = height;
  compressor.input_components = 4;
  compressor.in_color_space = JCS_EXT_RGBA;
  jpeg_set_defaults(&compressor);

  jpeg_set_colorspace(&compressor, JCS_YCbCr);
  jpeg_c_set_int_param(&compressor, JINT_BASE_QUANT_TBL_IDX, 3);
  compressor.optimize_coding = TRUE;
  compressor.arith_code = FALSE;
  compressor.smoothing_factor = 0;
  jpeg_c_set_bool_param(&compressor, JBOOLEAN_USE_SCANS_IN_TRELLIS, FALSE);
  jpeg_c_set_bool_param(&compressor, JBOOLEAN_TRELLIS_EOB_OPT, FALSE);
  jpeg_c_set_bool_param(&compressor, JBOOLEAN_TRELLIS_Q_OPT, FALSE);
  jpeg_c_set_int_param(&compressor, JINT_TRELLIS_NUM_LOOPS, 1);
  jpeg_c_set_int_param(&compressor, JINT_DC_SCAN_OPT_MODE, 0);

  if (quality > 100) {
    quality = 100;
  }
  char quality_string[4];
  snprintf(quality_string, sizeof(quality_string), "%" PRIu32, quality);
  set_quality_ratings(&compressor, quality_string, FALSE);
  jpeg_simple_progression(&compressor);

  jpeg_start_compress(&compressor, TRUE);
  const uint32_t row_stride = width * 4;
  while (compressor.next_scanline < compressor.image_height) {
    JSAMPROW row =
        (JSAMPROW)&rgba[compressor.next_scanline * row_stride];
    jpeg_write_scanlines(&compressor, &row, 1);
  }
  jpeg_finish_compress(&compressor);
  jpeg_destroy_compress(&compressor);

  if (output == NULL || output_size == 0 || output_size > UINT32_MAX) {
    free(output);
    return 2;
  }

  output_descriptor[0] = (uint32_t)(uintptr_t)output;
  output_descriptor[1] = (uint32_t)output_size;
  return 0;
}
