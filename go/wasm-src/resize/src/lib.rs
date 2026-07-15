use resize::{Pixel, Type};
use std::alloc::{alloc as system_alloc, dealloc, Layout};
use std::slice;

const ABI_VERSION: u32 = 1;
const HEADER_SIZE: usize = 8;
const ALLOCATION_ALIGNMENT: usize = 8;
const FLAG_LANCZOS3: u32 = 1 << 0;
const FLAG_PREMULTIPLY_ALPHA: u32 = 1 << 1;
const FLAG_LINEAR_RGB: u32 = 1 << 2;
const SUPPORTED_FLAGS: u32 = FLAG_LANCZOS3 | FLAG_PREMULTIPLY_ALPHA | FLAG_LINEAR_RGB;

include!(concat!(env!("OUT_DIR"), "/srgb_lut.rs"));

#[no_mangle]
pub extern "C" fn abi_version() -> u32 {
    ABI_VERSION
}

#[no_mangle]
pub extern "C" fn alloc(size: usize) -> *mut u8 {
    let Some(total_size) = size.checked_add(HEADER_SIZE) else {
        return std::ptr::null_mut();
    };
    let Ok(layout) = Layout::from_size_align(total_size, ALLOCATION_ALIGNMENT) else {
        return std::ptr::null_mut();
    };

    unsafe {
        let base = system_alloc(layout);
        if base.is_null() {
            return base;
        }
        (base as *mut usize).write(size);
        base.add(HEADER_SIZE)
    }
}

#[no_mangle]
pub extern "C" fn free(pointer: *mut u8) {
    if pointer.is_null() {
        return;
    }

    unsafe {
        let base = pointer.sub(HEADER_SIZE);
        let size = (base as *const usize).read();
        if let Some(total_size) = size.checked_add(HEADER_SIZE) {
            if let Ok(layout) = Layout::from_size_align(total_size, ALLOCATION_ALIGNMENT) {
                dealloc(base, layout);
            }
        }
    }
}

#[no_mangle]
pub extern "C" fn resize(
    input_pointer: *const u8,
    input_width: usize,
    input_height: usize,
    output_pointer: *mut u8,
    output_width: usize,
    output_height: usize,
    flags: u32,
) -> u32 {
    if input_pointer.is_null()
        || output_pointer.is_null()
        || input_width == 0
        || input_height == 0
        || output_width == 0
        || output_height == 0
    {
        return 1;
    }
    if flags & FLAG_LANCZOS3 == 0 || flags & !SUPPORTED_FLAGS != 0 {
        return 2;
    }

    let Some(input_length) = rgba_length(input_width, input_height) else {
        return 3;
    };
    let Some(output_length) = rgba_length(output_width, output_height) else {
        return 3;
    };

    unsafe {
        let input = slice::from_raw_parts(input_pointer, input_length);
        let output = slice::from_raw_parts_mut(output_pointer, output_length);
        resize_rgba(
            input,
            input_width,
            input_height,
            output,
            output_width,
            output_height,
            flags & FLAG_PREMULTIPLY_ALPHA != 0,
            flags & FLAG_LINEAR_RGB != 0,
        );
    }

    0
}

fn rgba_length(width: usize, height: usize) -> Option<usize> {
    width.checked_mul(height)?.checked_mul(4)
}

#[allow(clippy::too_many_arguments)]
fn resize_rgba(
    input: &[u8],
    input_width: usize,
    input_height: usize,
    output: &mut [u8],
    output_width: usize,
    output_height: usize,
    premultiply_alpha: bool,
    linear_rgb: bool,
) {
    if !premultiply_alpha && !linear_rgb {
        let mut resizer = resize::new(
            input_width,
            input_height,
            output_width,
            output_height,
            Pixel::RGBA,
            Type::Lanczos3,
        );
        resizer.resize(input, output);
        return;
    }

    let mut preprocessed = vec![0.0_f32; input.len()];
    for (source, target) in input.chunks_exact(4).zip(preprocessed.chunks_exact_mut(4)) {
        let alpha = f32::from(source[3]) / 255.0;
        for channel in 0..3 {
            let value = if linear_rgb {
                srgb_to_linear(source[channel])
            } else {
                f32::from(source[channel]) / 255.0
            };
            target[channel] = if premultiply_alpha {
                value * alpha
            } else {
                value
            };
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
            let value = if premultiply_alpha {
                if alpha == 0.0 {
                    0.0
                } else {
                    source[channel] / alpha
                }
            } else {
                source[channel]
            };
            target[channel] = if linear_rgb {
                linear_to_srgb(value)
            } else {
                (value * 255.0).clamp(0.0, 255.0) as u8
            };
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
