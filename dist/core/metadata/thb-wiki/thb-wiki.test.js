"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const thb_wiki_1 = require("./thb-wiki");
const mp3_writer_1 = require("../../writer/mp3/mp3-writer");
test('Fetch metadata of "Violetium"', async () => {
    const expectedResult = [
        {
            "title": "intro",
            "artists": [
                "Aginomoto"
            ],
            "discNumber": "1",
            "trackNumber": "1",
            "comments": "原曲: 不思議なお祓い棒 (东方辉针城　～ Double Dealing Character.)",
            "album": "Violetium",
            "albumArtists": [
                "Matthiola Records"
            ],
            "genre": "Trance",
            "year": "2016"
        },
        {
            "title": "I'm in Rapture (2016 Rework) ft nayuta",
            "artists": [
                "nayuta"
            ],
            "discNumber": "1",
            "trackNumber": "2",
            "lyricists": [
                "朔夜月見"
            ],
            "album": "Violetium",
            "albumArtists": [
                "Matthiola Records"
            ],
            "genre": "Trance",
            "composers": [
                "DJ suslik"
            ],
            "year": "2016"
        },
        {
            "title": "Reset the World (Original Mix)",
            "artists": [
                "Nascent Nova"
            ],
            "discNumber": "1",
            "trackNumber": "3",
            "comments": "原曲: 少女綺想曲　～ Dream Battle (东方永夜抄　～ Imperishable Night.)",
            "album": "Violetium",
            "albumArtists": [
                "Matthiola Records"
            ],
            "genre": "Trance",
            "year": "2016"
        },
        {
            "title": "O(Escapers) ft darkxixin",
            "artists": [
                "Darkxixin",
                "DJ suslik"
            ],
            "discNumber": "1",
            "trackNumber": "4",
            "comments": "原曲: Oriental Magician (东方灵异传　～ Highly Responsive to Prayers.)",
            "lyricists": [
                "anonymous"
            ],
            "album": "Violetium",
            "albumArtists": [
                "Matthiola Records"
            ],
            "genre": "Trance",
            "year": "2016"
        },
        {
            "title": "Jasminum Sambac",
            "artists": [
                "猫腿P"
            ],
            "discNumber": "1",
            "trackNumber": "5",
            "comments": "原曲: 茉莉花 / Chinese Traditional Ballad",
            "album": "Violetium",
            "albumArtists": [
                "Matthiola Records"
            ],
            "genre": "Trance",
            "year": "2016"
        },
        {
            "title": "祀",
            "artists": [
                "轨"
            ],
            "discNumber": "1",
            "trackNumber": "6",
            "comments": "原曲: 遠野の森 (东方封魔录　～ the Story of Eastern Wonderland.)",
            "album": "Violetium",
            "albumArtists": [
                "Matthiola Records"
            ],
            "genre": "Trance",
            "year": "2016"
        },
        {
            "title": "Digital Nonentity (Original Mix)",
            "artists": [
                "Supa7onyz"
            ],
            "discNumber": "1",
            "trackNumber": "7",
            "album": "Violetium",
            "albumArtists": [
                "Matthiola Records"
            ],
            "genre": "Trance",
            "composers": [
                "Supa7onyz"
            ],
            "year": "2016"
        },
        {
            "title": "Skysurfing (Original Mix)",
            "artists": [
                "Nascent Nova"
            ],
            "discNumber": "1",
            "trackNumber": "8",
            "album": "Violetium",
            "albumArtists": [
                "Matthiola Records"
            ],
            "genre": "Trance",
            "composers": [
                "Nascent Nova"
            ],
            "year": "2016"
        },
        {
            "title": "Violet at Dawn",
            "artists": [
                "DJ suslik"
            ],
            "discNumber": "1",
            "trackNumber": "9",
            "comments": "原曲: 妖々夢　～ Snow or Cherry Petal (东方妖妖梦　～ Perfect Cherry Blossom.)",
            "album": "Violetium",
            "albumArtists": [
                "Matthiola Records"
            ],
            "genre": "Trance",
            "year": "2016"
        },
        {
            "title": "Glittering Wave",
            "artists": [
                "Reguluz"
            ],
            "discNumber": "1",
            "trackNumber": "10",
            "album": "Violetium",
            "albumArtists": [
                "Matthiola Records"
            ],
            "genre": "Trance",
            "composers": [
                "Reguluz"
            ],
            "year": "2016"
        },
        {
            "title": "Sunset at the Beach",
            "artists": [
                "TiIce"
            ],
            "discNumber": "1",
            "trackNumber": "11",
            "album": "Violetium",
            "albumArtists": [
                "Matthiola Records"
            ],
            "genre": "Trance",
            "composers": [
                "TiIce"
            ],
            "year": "2016"
        },
        {
            "title": "Memory Conflict",
            "artists": [
                "Sandwichii"
            ],
            "discNumber": "1",
            "trackNumber": "12",
            "album": "Violetium",
            "albumArtists": [
                "Matthiola Records"
            ],
            "genre": "Trance",
            "composers": [
                "Sandwichii"
            ],
            "year": "2016"
        }
    ];
    const album = 'Violetium';
    const metadata = await thb_wiki_1.thbWiki.getMetadata(album);
    expect(metadata).toEqual(expectedResult);
});
test('Write metadata of "覚めぬ夢 届かぬ恋"', async () => {
    const album = '覚めぬ夢 届かぬ恋';
    const metadata = await thb_wiki_1.thbWiki.getMetadata(album);
    const untaggedDir = 'test-files/untagged/';
    const taggedDir = 'test-files/tagged/';
    const files = fs_1.readdirSync(untaggedDir);
    const targetFiles = files.map((_, index) => {
        const maxLength = Math.max(Math.trunc(Math.log10(metadata.length)) + 1, 2);
        return `${taggedDir}${(index + 1).toString().padStart(maxLength, '0')} ${metadata[index].title}.mp3`;
    });
    files.forEach((file, index) => {
        fs_1.copyFileSync(untaggedDir + file, targetFiles[index]);
    });
    expect(mp3_writer_1.mp3Writer.writeAll(metadata, targetFiles)).not.toThrowError();
});
