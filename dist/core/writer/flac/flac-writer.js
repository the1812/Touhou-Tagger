"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const metadata_writer_1 = require("../metadata-writer");
const flac = require("flac-metadata");
const imageinfo = require("imageinfo");
const fs_1 = require("fs");
const core_config_1 = require("../../core-config");
const stream_1 = require("stream");
const util_1 = require("util");
const DefaultVendor = 'reference libFLAC 1.3.2 20170101';
const getVorbisComments = (metadata) => {
    const comments = [
        `ARTIST=${metadata.artists.join(core_config_1.MetadataSeparator)}`,
        `TITLE=${metadata.title}`,
        `ALBUM=${metadata.album}`,
        `ALBUMSORT=${metadata.albumOrder}`,
        `TRACKNUMBER=${metadata.trackNumber}`,
        `DISCNUMBER=${metadata.discNumber}`,
    ];
    if (metadata.composers) {
        comments.push(`COMPOSER=${metadata.composers.join(core_config_1.MetadataSeparator)}`);
    }
    if (metadata.comments) {
        comments.push(`COMMENT=${metadata.comments}`);
    }
    if (metadata.lyric) {
        comments.push(`LYRICS=${metadata.lyric}`);
    }
    if (metadata.lyricists) {
        comments.push(`LYRICIST=${metadata.lyricists.join(core_config_1.MetadataSeparator)}`);
    }
    if (metadata.albumArtists) {
        comments.push(`ALBUMARTIST=${metadata.albumArtists.join(core_config_1.MetadataSeparator)}`);
    }
    if (metadata.genres) {
        comments.push(`GENRE=${metadata.genres.join(core_config_1.MetadataSeparator)}`);
    }
    if (metadata.year) {
        comments.push(`DATE=${metadata.year}`);
    }
    return comments;
};
class FlacWriter extends metadata_writer_1.MetadataWriter {
    async write(metadata, filePath) {
        const commentsProcessor = new flac.Processor({ parseMetaDataBlocks: true });
        const pictureProcessor = new flac.Processor({ parseMetaDataBlocks: true });
        const lyricConfig = this.config.lyric;
        commentsProcessor.on('preprocess', function (mdb) {
            if (!mdb.isLast) {
                if (mdb.type === flac.Processor.MDB_TYPE_VORBIS_COMMENT) {
                    mdb.remove();
                }
            }
            else {
                let vorbisComments = getVorbisComments(metadata);
                if (lyricConfig && lyricConfig.output === 'lrc') {
                    vorbisComments = vorbisComments.filter(c => !c.startsWith('LYRICS='));
                }
                const mdbVorbis = flac.data.MetaDataBlockVorbisComment.create(!metadata.coverImage, DefaultVendor, vorbisComments);
                this.push(mdbVorbis.publish());
            }
        });
        pictureProcessor.on('preprocess', function (mdb) {
            if (!mdb.isLast) {
                if (mdb.type === flac.Processor.MDB_TYPE_PICTURE) {
                    mdb.remove();
                }
            }
            else if (metadata.coverImage) {
                const info = imageinfo(metadata.coverImage);
                const mdbPicture = flac.data.MetaDataBlockPicture.create(!!metadata.coverImage, 3 /* front cover */, info.mimeType, metadata.album, info.width, info.height, 24, /* bits per pixel: unknown */ 0, /* colors: unknown */ metadata.coverImage);
                this.push(mdbPicture.publish());
            }
        });
        const fileBuffer = fs_1.readFileSync(filePath);
        const reader = new stream_1.Readable({
            read() {
                this.push(fileBuffer);
                this.push(null);
            }
        });
        const writer = fs_1.createWriteStream(filePath);
        reader.pipe(commentsProcessor).pipe(pictureProcessor).pipe(writer);
        await util_1.promisify(stream_1.finished)(writer);
    }
}
exports.FlacWriter = FlacWriter;
exports.flacWriter = new FlacWriter();
