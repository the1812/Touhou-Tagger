package domain

const DefaultMetadataSeparator = " / "
const DefaultMetadataSource = "thb-wiki"

type LyricType string

const (
	LyricOriginal   LyricType = "original"
	LyricTranslated LyricType = "translated"
	LyricMixed      LyricType = "mixed"
)

type LyricOutput string

const (
	LyricMetadata LyricOutput = "metadata"
	LyricLRC      LyricOutput = "lrc"
)

type LyricConfig struct {
	Type                 LyricType   `json:"type"`
	Output               LyricOutput `json:"output"`
	Time                 bool        `json:"time"`
	TranslationSeparator string      `json:"translationSeparator"`
	MaxCacheSize         int         `json:"maxCacheSize"`
}

type MetadataConfig struct {
	Lyric                   *LyricConfig `json:"lyric,omitempty"`
	LyricEnabled            bool         `json:"lyricEnabled,omitempty"`
	Source                  string       `json:"source"`
	CommentLanguage         string       `json:"commentLanguage"`
	CoverCompressSize       float64      `json:"coverCompressSize"`
	CoverCompressResolution int          `json:"coverCompressResolution"`
	Separator               string       `json:"separator"`
	Timeout                 int          `json:"timeout"`
	Retry                   int          `json:"retry"`
}

func DefaultMetadataConfig() MetadataConfig {
	lyric := DefaultLyricConfig()
	return MetadataConfig{
		Lyric:                   &lyric,
		Source:                  DefaultMetadataSource,
		CommentLanguage:         "zho",
		CoverCompressSize:       0,
		CoverCompressResolution: 0,
		Separator:               DefaultMetadataSeparator,
		Timeout:                 30,
		Retry:                   3,
	}
}

func DefaultLyricConfig() LyricConfig {
	return LyricConfig{
		Type:                 LyricOriginal,
		Output:               LyricMetadata,
		Time:                 true,
		TranslationSeparator: " // ",
		MaxCacheSize:         16,
	}
}

type CoverOptions struct {
	MaxDimension int
}
