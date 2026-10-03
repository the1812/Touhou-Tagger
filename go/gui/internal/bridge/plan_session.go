package bridge

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"
	"sync"
	"time"

	coreapp "github.com/the1812/Touhou-Tagger/go/internal/application"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
)

type planSession struct {
	mu            sync.Mutex
	id            string
	owner         string
	revision      int
	albumName     string
	defaultSource string
	scan          domain.AlbumScan
	metadata      []domain.Metadata
	plan          *coreapp.Plan
	service       *coreapp.Service
	candidate     domain.AlbumCandidate
	cover         []byte
	coverSource   string
	saveCover     bool
	issues        []StateIssue
}

func newPlanSession(ctx context.Context, album coreapp.Album, applicationService *coreapp.Service, candidate domain.AlbumCandidate, data coreapp.AlbumMetadata, defaultSource, owner string) *planSession {
	session := &planSession{
		id:            newID("plan"),
		owner:         owner,
		revision:      1,
		albumName:     album.Name,
		defaultSource: defaultSource,
		scan:          album.Scan,
		metadata:      cloneMetadata(data.Metadata),
		candidate:     candidate,
		cover:         data.Cover,
		coverSource:   data.CoverSource,
		saveCover:     len(data.Cover) > 0 && album.Options.Cover,
		service:       applicationService,
	}
	session.rebuild(ctx)
	return session
}

func (session *planSession) update(ctx context.Context, patch PlanPatch) (PlanPreview, error) {
	session.mu.Lock()
	defer session.mu.Unlock()
	for _, trackPatch := range patch.Tracks {
		_, valid := trackIndex(trackPatch.ID, len(session.metadata))
		if !valid {
			return PlanPreview{}, fmt.Errorf("写入内容中不存在曲目 %q", trackPatch.ID)
		}
	}
	if patch.SaveCover != nil {
		canSaveCover := len(session.cover) > 0
		if *patch.SaveCover && !canSaveCover {
			return PlanPreview{}, fmt.Errorf("当前写入内容没有可保存的封面")
		}
		session.saveCover = *patch.SaveCover
	}
	metadata := cloneMetadata(session.metadata)
	if patch.Album != nil {
		applyAlbumPatch(metadata, *patch.Album)
	}
	for _, trackPatch := range patch.Tracks {
		index, _ := trackIndex(trackPatch.ID, len(metadata))
		applyTrackPatch(&metadata[index], trackPatch)
	}
	session.metadata = metadata
	session.revision++
	session.rebuild(ctx)
	return session.previewLocked(), nil
}

func (session *planSession) execute(
	ctx context.Context,
	operationID string,
	events coreapp.EventSink,
) (result WriteOperationResult, reusable bool, err error) {
	if !session.canExecute() {
		return result, true, fmt.Errorf("写入内容仍有未解决的问题")
	}
	started := time.Now()
	defer func() {
		session.mu.Lock()
		defer session.mu.Unlock()
		if reusable {
			session.revision++
			session.rebuild(context.WithoutCancel(ctx))
			if session.owner == "workspace" {
				preview := session.previewLocked()
				result.Plan = &preview
			}
		}
	}()
	session.mu.Lock()
	plan := session.plan
	candidate := session.candidate
	session.mu.Unlock()
	preview := plan.Preview()
	applied, err := plan.Execute(ctx, events)

	session.mu.Lock()
	if applied.PathsUpdated {
		for index, item := range preview.Items {
			session.scan.AudioFiles[index].Path = item.TargetPath
		}
	}
	if applied.CoverPath != "" {
		session.scan.CoverPath = applied.CoverPath
	}
	if err == nil && candidate.Source != "local-json" && candidate.Name != "" {
		session.albumName = candidate.Name
	}
	session.mu.Unlock()
	return WriteOperationResult{
		OperationID: operationID,
		Kind:        "workspace",
		Succeeded:   applied.Written,
		Renamed:     applied.Renamed,
		CoversSaved: applied.CoversSaved,
		LRCFiles:    applied.LRCFiles,
		DurationMS:  time.Since(started).Milliseconds(),
		Message:     fmt.Sprintf("已完成 %d 首曲目的写入。", applied.Written),
	}, applied.Reusable, err
}

func (session *planSession) rebuild(ctx context.Context) {
	session.issues = session.issues[:0]
	options := coreapp.PlanOptions{
		Candidate: session.candidate, DefaultAlbumName: session.albumName, DefaultSource: session.defaultSource,
	}
	cover, err := session.coverOutput()
	session.plan = nil
	if err == nil {
		options.Cover = cover
		session.plan, err = session.service.CreatePlan(ctx, session.scan, session.metadata, options)
	}
	if err != nil {
		session.issues = append(session.issues, planBuildIssue(err))
	}

	if len(session.cover) > 0 {
		if _, _, err := decodeCover(session.cover); err != nil {
			session.issues = append(session.issues, errorIssue(
				"invalid-cover",
				fmt.Sprintf("封面图片无法解码：%v", err),
			))
		}
	}
	if session.plan != nil {
		session.issues = append(session.issues, inspectPlanOutputs(session.plan.Preview().Conflicts)...)
	}

	for index, metadata := range session.metadata {
		itemID := trackID(index)
		if strings.TrimSpace(metadata.Title) == "" {
			session.issues = append(session.issues, itemError(
				"empty-title",
				"曲目标题不能为空。",
				itemID,
			))
		}
		if len(metadata.Artists) == 0 {
			session.issues = append(session.issues, itemWarning(
				"empty-artists",
				"数据源未提供曲目艺术家，将以空值继续写入。",
				itemID,
			))
		}
	}
}

func (session *planSession) previewLocked() PlanPreview {
	preview := coreapp.PlanPreview{}
	if session.plan != nil {
		preview = session.plan.Preview()
	}
	metadataCount := len(session.metadata)
	audioCount := len(session.scan.AudioFiles)
	count := max(metadataCount, audioCount)
	items := make([]PlanItemPreview, 0, count)
	for index := 0; index < count; index++ {
		item := PlanItemPreview{
			ID:      trackID(index),
			Artists: []string{},
			Issues:  []StateIssue{},
		}
		if index < audioCount {
			audio := session.scan.AudioFiles[index]
			item.SourceName = filepath.Base(audio.Path)
			item.Format = strings.ToUpper(string(audio.Format))
		}
		if index < metadataCount {
			metadata := session.metadata[index]
			item.DiscNumber = metadata.DiscNumber
			item.TrackNumber = metadata.TrackNumber
			item.Title = metadata.Title
			item.Artists = dtoSlice(metadata.Artists)
			item.Comments = metadata.Comments
		}
		if index < len(preview.Items) {
			planItem := preview.Items[index]
			item.TargetName = filepath.Base(planItem.TargetPath)
			item.WillRename = planItem.SourcePath != planItem.TargetPath
		}
		for _, issue := range session.issues {
			if issue.ItemID == item.ID {
				item.Issues = append(item.Issues, issue)
			}
		}
		if index >= metadataCount || index >= audioCount {
			item.Issues = append(item.Issues, itemError(
				"track-count-mismatch",
				"本地文件与元数据曲目无法一一对应。",
				item.ID,
			))
		}
		items = append(items, item)
	}
	album := AlbumMetadata{Artists: []string{}, Genres: []string{}}
	if metadataCount > 0 {
		first := session.metadata[0]
		album = AlbumMetadata{
			Title:      first.Album,
			AlbumOrder: first.AlbumOrder,
			Artists:    dtoSlice(first.AlbumArtists),
			Year:       first.Year,
			Genres:     dtoSlice(first.Genres),
		}
	}
	cover := session.coverPreview()
	renamed := 0
	for _, item := range items {
		if item.WillRename {
			renamed++
		}
	}
	lrcFiles := 0
	for _, output := range preview.Outputs {
		if output.Kind == coreapp.OutputLRC {
			lrcFiles++
		}
	}
	compressCover := session.service.Config.CoverCompressSize > 0 &&
		float64(len(session.cover)) > session.service.Config.CoverCompressSize*1024*1024
	canSaveCover := len(session.cover) > 0
	issues := make([]StateIssue, 0, len(session.issues))
	for _, issue := range session.issues {
		if issue.ItemID == "" && issue.Code != "invalid-cover" {
			issues = append(issues, issue)
		}
	}
	return PlanPreview{
		PlanID:    session.id,
		Revision:  session.revision,
		Directory: session.scan.Directory,
		Album:     album,
		Source:    session.candidate.Source,
		Cover:     cover,
		Items:     items,
		Issues:    issues,
		Options: PlanOptions{
			WriteFiles:    len(preview.Items),
			RenameFiles:   renamed,
			CanSaveCover:  canSaveCover,
			SaveCover:     canSaveCover && session.saveCover,
			CompressCover: compressCover,
			LRCFiles:      lrcFiles,
		},
		CanExecute: session.canExecuteLocked(),
	}
}

func (session *planSession) coverPreview() CoverPreview {
	if len(session.cover) == 0 {
		return CoverPreview{
			Source: "none",
		}
	}
	width, height, err := decodeCover(session.cover)
	if err != nil {
		issue := errorIssue("invalid-cover", fmt.Sprintf("封面图片无法解码：%v", err))
		return CoverPreview{
			Source:   session.coverSource,
			ByteSize: len(session.cover),
			Issue:    &issue,
		}
	}
	return CoverPreview{
		URL:      fmt.Sprintf("/gui/preview/%s/cover?revision=%d", session.id, session.revision),
		Source:   session.coverSource,
		Width:    width,
		Height:   height,
		ByteSize: len(session.cover),
	}
}
func (session *planSession) canExecuteLocked() bool {
	if session.plan == nil {
		return false
	}
	for _, issue := range session.issues {
		if issue.Severity == "error" {
			return false
		}
	}
	return true
}

func (session *planSession) coverOutput() (*coreapp.CoverOutput, error) {
	if !session.saveCover || len(session.cover) == 0 {
		return nil, nil
	}
	path := session.scan.CoverPath
	if path == "" {
		var err error
		path, err = coreapp.CoverPath(session.scan.Directory, session.cover)
		if err != nil {
			return nil, err
		}
	}
	return &coreapp.CoverOutput{Path: path, Data: session.cover, Replace: session.scan.CoverPath != ""}, nil
}

func (session *planSession) preview() PlanPreview {
	session.mu.Lock()
	defer session.mu.Unlock()
	return session.previewLocked()
}

func (session *planSession) canExecute() bool {
	session.mu.Lock()
	defer session.mu.Unlock()
	return session.canExecuteLocked()
}

func (session *planSession) stateIssues() []StateIssue {
	session.mu.Lock()
	defer session.mu.Unlock()
	return dtoSlice(session.issues)
}

func (session *planSession) coverData(revision int) []byte {
	session.mu.Lock()
	defer session.mu.Unlock()
	if session.revision != revision {
		return nil
	}
	return append([]byte(nil), session.cover...)
}

func (session *planSession) replaces(other *planSession) bool {
	if session.owner != other.owner {
		return false
	}
	return session.owner == "workspace" || equalPath(session.scan.Directory, other.scan.Directory)
}
