"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const metadata_writer_1 = require("./metadata-writer");
const flac = require("flac-metadata");
const fs_1 = require("fs");
const core_config_1 = require("../core-config");
const DefaultVendor = 'reference libFLAC 1.3.2 20170101';
const getVorbisComments = (metadata) => {
    const comments = [
        `ARTIST=${metadata.artists.join(core_config_1.MetadataSeparator)}`,
        `TITLE=${metadata.title}`,
        `ALBUM=${metadata.album}`,
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
        comments.push(`ORIGINALYEAR=${metadata.year}`);
    }
    return comments;
};
class FlacWriter extends metadata_writer_1.MetadataWriter {
    async write(metadata, filePath) {
        const flacProcessor = new flac.Processor();
        flacProcessor.on("postprocess", function (mdb) {
            if (mdb.type === flac.Processor.MDB_TYPE_VORBIS_COMMENT) {
                mdb.remove();
                if (mdb.removed || mdb.isLast) {
                    const mdbVorbis = flac.data.MetaDataBlockVorbisComment.create(mdb.isLast, DefaultVendor, getVorbisComments(metadata));
                    this.push(mdbVorbis.publish());
                }
            }
            // if (mdb.type === flac.Processor.MDB_TYPE_PICTURE) {
            //   if (mdb.removed || mdb.isLast) {
            //     const mdbPicture = flac.data.MetaDataBlockPicture.create(mdb.isLast, 3 /* front cover */,
            //       )
            //     this.push(mdbPicture.publish())
            //   }
            // }
        });
        fs_1.createReadStream(filePath).pipe(flacProcessor).pipe(fs_1.createWriteStream(filePath));
    }
    async update(metadata, filePath) {
        throw new Error('Method not implemented.');
    }
}
exports.FlacWriter = FlacWriter;
