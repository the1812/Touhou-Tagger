package bridge

import (
	"fmt"

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

func (service *SettingsService) LoadSettings() (domain.MetadataConfig, error) {
	value, err := config.Load()
	if err != nil {
		return domain.MetadataConfig{}, err
	}
	value.Source = searchableSourceOrDefault(value.Source, service.runtime.getSources())
	service.runtime.setConfig(value)
	return value, nil
}

func (service *SettingsService) SaveSettings(value domain.MetadataConfig) (domain.MetadataConfig, error) {
	if err := service.validate(value); err != nil {
		return domain.MetadataConfig{}, err
	}
	if err := config.Save(value); err != nil {
		return domain.MetadataConfig{}, err
	}
	service.runtime.setConfig(value)
	return value, nil
}

func (service *SettingsService) ResetSettings() (domain.MetadataConfig, error) {
	value := domain.DefaultMetadataConfig()
	if err := config.Save(value); err != nil {
		return domain.MetadataConfig{}, err
	}
	service.runtime.setConfig(value)
	return value, nil
}

func (service *SettingsService) validate(value domain.MetadataConfig) error {
	if !service.runtime.searchableSource(value.Source) {
		return fmt.Errorf("不支持的数据源 %q", value.Source)
	}
	if value.Timeout < 1 || value.Timeout > 300 {
		return fmt.Errorf("请求超时必须在 1 到 300 秒之间")
	}
	if value.Retry < 1 || value.Retry > 10 {
		return fmt.Errorf("重试次数必须在 1 到 10 次之间")
	}
	if value.Lyric.MaxCacheSize < 1 || value.Lyric.MaxCacheSize > 10000 {
		return fmt.Errorf("歌词缓存数量必须在 1 到 10000 之间")
	}
	return config.ValidateMetadata(value)
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
