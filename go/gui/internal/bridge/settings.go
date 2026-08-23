package bridge

import (
	"fmt"
	"strings"

	"github.com/the1812/Touhou-Tagger/go/internal/config"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
)

type SettingsService struct {
	runtime *runtimeState
}

func (service *SettingsService) GetCapabilities() Capabilities {
	return Capabilities{
		Sources: service.runtime.getSources(),
		CommentLanguages: []SelectOption{
			{Value: "zho", Label: "中文"},
			{Value: "jpn", Label: "日本語"},
			{Value: "eng", Label: "English"},
		},
		LyricTypes: []SelectOption{
			{Value: string(domain.LyricOriginal), Label: "原文"},
			{Value: string(domain.LyricTranslated), Label: "译文"},
			{Value: string(domain.LyricMixed), Label: "混合"},
		},
	}
}

func (service *SettingsService) LoadSettings() (Settings, error) {
	value, err := config.Load()
	if err != nil {
		return Settings{}, err
	}
	value.Source = searchableSourceOrDefault(value.Source, service.runtime.getSources())
	service.runtime.setConfig(value)
	return settingsFromConfig(value), nil
}

func (service *SettingsService) SaveSettings(settings Settings) (Settings, error) {
	value, err := service.configFromSettings(settings)
	if err != nil {
		return Settings{}, err
	}
	if err := config.Save(value); err != nil {
		return Settings{}, err
	}
	service.runtime.setConfig(value)
	return settingsFromConfig(value), nil
}

func (service *SettingsService) ResetSettings() (Settings, error) {
	value := domain.DefaultMetadataConfig()
	if err := config.Save(value); err != nil {
		return Settings{}, err
	}
	service.runtime.setConfig(value)
	return settingsFromConfig(value), nil
}

func (service *SettingsService) configFromSettings(settings Settings) (domain.MetadataConfig, error) {
	if !service.supportsSource(settings.DefaultSource) {
		return domain.MetadataConfig{}, fmt.Errorf("不支持的数据源 %q", settings.DefaultSource)
	}
	if len(settings.CommentLanguage) != 3 {
		return domain.MetadataConfig{}, fmt.Errorf("注释语言必须是三位 ISO-639-2 代码")
	}
	if strings.TrimSpace(settings.MP3MultiValueSeparator) == "" {
		return domain.MetadataConfig{}, fmt.Errorf("MP3 多值分隔符不能为空")
	}
	if settings.RequestTimeoutSeconds < 1 || settings.RequestTimeoutSeconds > 300 {
		return domain.MetadataConfig{}, fmt.Errorf("请求超时必须在 1 到 300 秒之间")
	}
	if settings.RetryCount < 1 || settings.RetryCount > 10 {
		return domain.MetadataConfig{}, fmt.Errorf("重试次数必须在 1 到 10 次之间")
	}
	if settings.CoverCompressionThresholdKB < 0 || settings.CoverMaxEdge < 0 {
		return domain.MetadataConfig{}, fmt.Errorf("封面压缩阈值和最大边长不能为负数")
	}
	lyricType := domain.LyricType(settings.LyricType)
	if lyricType != domain.LyricOriginal && lyricType != domain.LyricTranslated && lyricType != domain.LyricMixed {
		return domain.MetadataConfig{}, fmt.Errorf("不支持的歌词类型 %q", settings.LyricType)
	}
	if strings.TrimSpace(settings.MixedLyricSeparator) == "" {
		return domain.MetadataConfig{}, fmt.Errorf("混合歌词分隔符不能为空")
	}
	if settings.LyricCacheSize < 1 || settings.LyricCacheSize > 10000 {
		return domain.MetadataConfig{}, fmt.Errorf("歌词缓存数量必须在 1 到 10000 之间")
	}
	if settings.WriteLyricsMetadata && settings.WriteLRCFiles {
		return domain.MetadataConfig{}, fmt.Errorf("歌词不能同时写入文件元数据和 LRC")
	}
	value := domain.MetadataConfig{
		LyricEnabled:            settings.WriteLyricsMetadata || settings.WriteLRCFiles,
		Source:                  settings.DefaultSource,
		CommentLanguage:         settings.CommentLanguage,
		CoverCompressSize:       settings.CoverCompressionThresholdKB / 1024,
		CoverCompressResolution: settings.CoverMaxEdge,
		Separator:               settings.MP3MultiValueSeparator,
		Timeout:                 settings.RequestTimeoutSeconds,
		Retry:                   settings.RetryCount,
	}
	output := domain.LyricMetadata
	if settings.WriteLRCFiles {
		output = domain.LyricLRC
	}
	value.Lyric = &domain.LyricConfig{
		Type:                 lyricType,
		Output:               output,
		Time:                 settings.PreserveLyricTimeline,
		TranslationSeparator: settings.MixedLyricSeparator,
		MaxCacheSize:         settings.LyricCacheSize,
	}
	return value, nil
}

func (service *SettingsService) supportsSource(value string) bool {
	for _, option := range service.runtime.getSources() {
		if option.Value == value && option.SupportsSearch {
			return true
		}
	}
	return false
}

func settingsFromConfig(value domain.MetadataConfig) Settings {
	lyric := domain.DefaultLyricConfig()
	if value.Lyric != nil {
		lyric = *value.Lyric
	}
	return Settings{
		DefaultSource:               value.Source,
		CommentLanguage:             value.CommentLanguage,
		MP3MultiValueSeparator:      value.Separator,
		RequestTimeoutSeconds:       value.Timeout,
		RetryCount:                  value.Retry,
		CoverCompressionThresholdKB: value.CoverCompressSize * 1024,
		CoverMaxEdge:                value.CoverCompressResolution,
		LyricType:                   string(lyric.Type),
		WriteLyricsMetadata:         value.LyricEnabled && lyric.Output == domain.LyricMetadata,
		WriteLRCFiles:               value.LyricEnabled && lyric.Output == domain.LyricLRC,
		PreserveLyricTimeline:       lyric.Time,
		MixedLyricSeparator:         lyric.TranslationSeparator,
		LyricCacheSize:              lyric.MaxCacheSize,
	}
}

func searchableSourceOrDefault(value string, sources []SourceOption) string {
	for _, source := range sources {
		if source.Value == value && source.SupportsSearch {
			return value
		}
	}
	for _, source := range sources {
		if source.Value == domain.DefaultMetadataSource && source.SupportsSearch {
			return source.Value
		}
	}
	for _, source := range sources {
		if source.SupportsSearch {
			return source.Value
		}
	}
	return value
}
