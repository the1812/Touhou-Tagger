package bridge

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"sync"
	"time"

	"github.com/the1812/Touhou-Tagger/go/internal/application"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
)

type batchJob struct {
	id                  string
	directory           string
	inferredAlbumName   string
	source              string
	audioCount          int
	status              string
	issues              []StateIssue
	candidates          []AlbumCandidate
	selectedCandidateID string
	plan                *planSession
	loadID              string
}

func (job *batchJob) canRun() bool {
	if job.loadID != "" || job.plan == nil {
		return false
	}
	job.plan.mu.Lock()
	defer job.plan.mu.Unlock()
	return canCommit(job.plan)
}

type batchSession struct {
	mu           sync.Mutex
	id           string
	root         string
	depth        int
	searchSource string
	jobs         []*batchJob
	running      bool
}

type BatchService struct {
	runtime   *runtimeState
	planner   *planCoordinator
	catalog   *candidateCatalog
	desktop   *desktopService
	ops       *operationManager
	loadSlots chan struct{}

	mu       sync.RWMutex
	sessions map[string]*batchSession
}

func (service *BatchService) SelectBatchDirectory(title string) (string, error) {
	return service.desktop.selectDirectory(title, batchDirectory)
}

func (service *BatchService) ScanBatch(
	ctx context.Context,
	directory string,
	depth int,
	sourceName string,
) (BatchPreview, error) {
	if sourceName == "" {
		sourceName = service.runtime.getConfig().Source
	}
	applicationService, err := service.runtime.service(nil)
	if err != nil {
		return BatchPreview{}, err
	}
	jobs, err := applicationService.ScanBatch(ctx, directory, depth)
	if err != nil {
		return BatchPreview{}, err
	}
	root, err := filepath.Abs(directory)
	if err != nil {
		return BatchPreview{}, fmt.Errorf("解析批量写入目录: %w", err)
	}
	session := &batchSession{
		id:           newID("batch"),
		root:         root,
		depth:        depth,
		searchSource: sourceName,
		jobs:         make([]*batchJob, 0, len(jobs)),
	}
	for _, discovered := range jobs {
		job := &batchJob{
			id:                newID("job"),
			directory:         discovered.Directory,
			inferredAlbumName: discovered.Name,
			source:            sourceName,
			audioCount:        discovered.AudioCount,
			status:            "loading",
			issues:            []StateIssue{},
			candidates:        []AlbumCandidate{},
		}
		if discovered.Ignored {
			job.status = "no-audio"
			session.jobs = append(session.jobs, job)
			continue
		}
		if discovered.PreflightErr != nil {
			job.status = "scan-failed"
			job.issues = append(job.issues, failureIssue("scan-failed", discovered.PreflightErr))
		}
		session.jobs = append(session.jobs, job)
	}
	service.mu.Lock()
	for id, previous := range service.sessions {
		previous.mu.Lock()
		running := previous.running
		owner := previous.id
		previous.mu.Unlock()
		if !running {
			delete(service.sessions, id)
			service.planner.discardOwner(owner)
		}
	}
	service.sessions[session.id] = session
	service.mu.Unlock()
	return batchPreview(session), nil
}

func (service *BatchService) LoadBatchJob(ctx context.Context, batchID, jobID string) (BatchJobPreview, error) {
	select {
	case service.loadSlots <- struct{}{}:
		defer func() { <-service.loadSlots }()
	case <-ctx.Done():
		return BatchJobPreview{}, ctx.Err()
	}
	return service.updateJob(ctx, batchID, jobID, service.loadBatchJob)
}

func (service *BatchService) ResolveBatchCandidate(ctx context.Context, batchID, jobID, candidateID string) (BatchJobPreview, error) {
	return service.updateJob(ctx, batchID, jobID, func(ctx context.Context, session *batchSession, job *batchJob) error {
		for _, candidate := range job.candidates {
			if candidate.ID != candidateID {
				continue
			}
			job.selectedCandidateID = candidate.ID
			job.source = candidate.Source
			plan, err := service.planner.prepareOwnedPlan(ctx, job.directory, candidate.ID, candidate.Source, service.runtime.getConfig().Source, session.id)
			job.plan = plan
			return err
		}
		return fmt.Errorf("专辑中不存在搜索结果 %q", candidateID)
	})
}

func (service *BatchService) updateJob(
	ctx context.Context,
	batchID, jobID string,
	load func(context.Context, *batchSession, *batchJob) error,
) (BatchJobPreview, error) {
	service.mu.RLock()
	session, exists := service.sessions[batchID]
	if !exists {
		service.mu.RUnlock()
		return BatchJobPreview{}, fmt.Errorf("批量任务已失效，请重新扫描目录")
	}
	session.mu.Lock()
	service.mu.RUnlock()
	job := session.findJob(jobID)
	if job == nil {
		session.mu.Unlock()
		return BatchJobPreview{}, fmt.Errorf("批量写入专辑 %q 不存在", jobID)
	}
	if session.running || job.loadID != "" {
		session.mu.Unlock()
		return BatchJobPreview{}, fmt.Errorf("这个专辑正在处理，请稍候")
	}
	working := *job
	working.plan = nil
	working.issues = nil
	working.status = "ready"
	previousPlan := job.plan
	token := newID("load")
	job.loadID = token
	session.mu.Unlock()

	if previousPlan != nil {
		service.planner.discard(previousPlan.id)
	}
	if err := load(ctx, session, &working); err != nil {
		working.status = "scan-failed"
		working.issues = []StateIssue{failureIssue("load-failed", err)}
	}

	service.mu.RLock()
	current := service.sessions[batchID]
	session.mu.Lock()
	service.mu.RUnlock()
	defer session.mu.Unlock()
	if current != session || session.running || job.loadID != token {
		if working.plan != nil {
			service.planner.discard(working.plan.id)
		}
		if current != session {
			service.catalog.discardOwner(session.id)
		}
		return BatchJobPreview{}, fmt.Errorf("专辑加载结果已失效，请重新扫描目录")
	}
	*job = working
	return batchJobPreview(session.root, job), nil
}

func (service *BatchService) loadBatchJob(ctx context.Context, session *batchSession, job *batchJob) error {
	base := service.runtime.getConfig()
	base.Source = session.searchSource
	album, err := application.OpenAlbum(ctx, job.directory, base)
	if err != nil {
		return err
	}
	job.inferredAlbumName = album.Name
	job.audioCount = len(album.Scan.AudioFiles)
	job.source = album.Config.Metadata.Source
	job.candidates = nil
	job.selectedCandidateID = ""
	if job.audioCount == 0 {
		job.status = "no-audio"
		return nil
	}
	applicationService, err := service.runtime.albumService(album, "")
	if err != nil {
		return err
	}
	if album.Scan.MetadataPath != "" {
		job.candidates = []AlbumCandidate{candidateToDTO(domain.AlbumCandidate{
			ID: "local-json", Name: album.Name, Source: "local-json",
		}, album.Name)}
	} else {
		job.candidates, err = service.catalog.search(ctx, applicationService, session.id, album.Name, false)
		if err != nil {
			return err
		}
	}
	candidate := exactCandidate(job.candidates)
	if candidate == nil {
		job.status = "needs-candidate"
		job.issues = []StateIssue{warningIssue("candidate-required", "写入前需要选择匹配的专辑，未匹配的专辑会自动跳过。")}
		return nil
	}
	job.selectedCandidateID = candidate.ID
	job.plan, err = service.planner.prepareAlbumPlan(ctx, album, applicationService, candidate.ID, service.runtime.getConfig().Source, session.id)
	return err
}

func (service *BatchService) RunBatch(
	batchID string,
	failedOnly bool,
) (OperationStart, error) {
	service.mu.RLock()
	session, exists := service.sessions[batchID]
	service.mu.RUnlock()
	if !exists {
		return OperationStart{}, fmt.Errorf("批量任务已失效，请重新扫描目录")
	}
	session.mu.Lock()
	if session.running {
		session.mu.Unlock()
		return OperationStart{}, fmt.Errorf("批量写入正在运行")
	}
	for _, job := range session.jobs {
		if job.loadID != "" || job.status == "loading" {
			session.mu.Unlock()
			return OperationStart{}, fmt.Errorf("仍有专辑数据正在加载，请稍候")
		}
	}
	selected := make([]string, 0, len(session.jobs))
	previousStatuses := make(map[string]string, len(session.jobs))
	for _, job := range session.jobs {
		if failedOnly {
			if job.status == "failed" && job.canRun() {
				selected = append(selected, job.id)
				previousStatuses[job.id] = job.status
				job.status = "queued"
			}
			continue
		}
		if job.canRun() {
			selected = append(selected, job.id)
			previousStatuses[job.id] = job.status
			job.status = "queued"
		}
	}
	if len(selected) == 0 {
		session.mu.Unlock()
		return OperationStart{}, fmt.Errorf("没有可以写入的专辑")
	}
	session.running = true
	session.mu.Unlock()
	started, err := service.ops.start("batch", func(ctx context.Context, operationID string) (any, error) {
		defer func() {
			session.mu.Lock()
			session.running = false
			session.mu.Unlock()
		}()
		return service.executeBatch(ctx, operationID, session, selected)
	})
	if err != nil {
		session.mu.Lock()
		session.running = false
		for _, id := range selected {
			if job := session.findJob(id); job != nil && job.status == "queued" {
				job.status = previousStatuses[id]
			}
		}
		session.mu.Unlock()
		return OperationStart{}, err
	}
	return started, nil
}

func (service *BatchService) DiscardBatch(batchID string) {
	service.mu.Lock()
	session, exists := service.sessions[batchID]
	if !exists {
		service.mu.Unlock()
		return
	}
	session.mu.Lock()
	running := session.running
	owner := session.id
	session.mu.Unlock()
	if !running {
		delete(service.sessions, batchID)
	}
	service.mu.Unlock()
	if !running {
		service.planner.discardOwner(owner)
	}
}

func (service *BatchService) CancelBatch(operationID string) {
	service.ops.cancelOperation(operationID)
}

func (service *BatchService) StartBatch(operationID string) error {
	return service.ops.release(operationID, "batch")
}

func (service *BatchService) executeBatch(
	ctx context.Context,
	operationID string,
	session *batchSession,
	selected []string,
) (BatchRunResult, error) {
	started := time.Now()
	result := BatchRunResult{
		OperationID: operationID,
		Kind:        "batch",
	}
	for index, jobID := range selected {
		select {
		case <-ctx.Done():
			service.cancelRemaining(session, selected[index:])
			result.Cancelled = true
			result.Message = "已完成当前安全阶段，并停止写入后续专辑。"
			result.DurationMS = time.Since(started).Milliseconds()
			result.Jobs = batchJobPreviews(session)
			return result, nil
		default:
		}
		_, job, err := service.lookupJob(session.id, jobID)
		if err != nil {
			return BatchRunResult{}, err
		}
		session.mu.Lock()
		job.status = "running"
		directory := job.directory
		plan := job.plan
		session.mu.Unlock()
		service.ops.emitProgress(OperationProgress{
			OperationID: operationID,
			Stage:       "preparing",
			Current:     index,
			Total:       len(selected),
			Path:        filepath.Base(directory),
			Message:     fmt.Sprintf("正在处理专辑 %d / %d", index+1, len(selected)),
		})
		if !service.planner.claim(plan) {
			service.failJob(session, job, fmt.Errorf("写入内容不可用，请重新加载此专辑"))
			session.mu.Lock()
			job.plan = nil
			session.mu.Unlock()
			result.Failed++
			continue
		}
		commitResult, reusable, commitErr := service.planner.executeCommit(
			ctx,
			operationID,
			plan,
			service.batchEventSink(operationID, index, len(selected), directory),
		)
		if !reusable {
			service.planner.delete(plan.id)
			session.mu.Lock()
			job.plan = nil
			session.mu.Unlock()
		}
		if errors.Is(commitErr, context.Canceled) && reusable {
			service.cancelRemaining(session, selected[index+1:])
			session.mu.Lock()
			job.status = "cancelled"
			session.mu.Unlock()
			result.Cancelled = true
			result.Message = "已完成当前安全阶段，并停止写入后续专辑。"
			result.DurationMS = time.Since(started).Milliseconds()
			result.Jobs = batchJobPreviews(session)
			return result, nil
		}
		if commitErr != nil {
			service.failJob(session, job, commitErr)
			result.Failed++
			service.emitBatchAlbumProgress(
				operationID,
				index+1,
				len(selected),
				directory,
				fmt.Sprintf("专辑 %d / %d 处理失败", index+1, len(selected)),
			)
			continue
		}
		session.mu.Lock()
		job.status = "succeeded"
		job.issues = []StateIssue{}
		session.mu.Unlock()
		result.Succeeded++
		result.Renamed += commitResult.Renamed
		result.CoversSaved += commitResult.CoversSaved
		result.LRCFiles += commitResult.LRCFiles
		service.emitBatchAlbumProgress(
			operationID,
			index+1,
			len(selected),
			directory,
			fmt.Sprintf("已完成专辑 %d / %d", index+1, len(selected)),
		)
	}
	result.DurationMS = time.Since(started).Milliseconds()
	result.Message = fmt.Sprintf(
		"批量写入完成：%d 个成功，%d 个失败。",
		result.Succeeded,
		result.Failed,
	)
	result.Jobs = batchJobPreviews(session)
	return result, nil
}

func (service *BatchService) batchEventSink(
	operationID string,
	completed int,
	total int,
	directory string,
) func(domain.ProgressEvent) error {
	return func(event domain.ProgressEvent) error {
		if event.Stage == domain.StageComplete {
			return nil
		}
		message := operationMessage(event)
		if event.Stage == domain.StageWrite && event.Path != "" {
			message += " · " + filepath.Base(event.Path)
		}
		service.ops.emitProgress(OperationProgress{
			OperationID: operationID,
			Stage:       operationStage(event.Stage),
			Current:     completed,
			Total:       total,
			Path:        filepath.Base(directory),
			Message: fmt.Sprintf(
				"专辑 %d / %d · %s",
				completed+1,
				total,
				message,
			),
		})
		return nil
	}
}

func (service *BatchService) emitBatchAlbumProgress(
	operationID string,
	current int,
	total int,
	directory string,
	message string,
) {
	service.ops.emitProgress(OperationProgress{
		OperationID: operationID,
		Stage:       "writing",
		Current:     current,
		Total:       total,
		Path:        filepath.Base(directory),
		Message:     message,
	})
}

func (service *BatchService) failJob(session *batchSession, job *batchJob, err error) {
	session.mu.Lock()
	job.status = "failed"
	job.issues = []StateIssue{failureIssue("operation-failed", err)}
	session.mu.Unlock()
}

func (service *BatchService) cancelRemaining(session *batchSession, ids []string) {
	session.mu.Lock()
	defer session.mu.Unlock()
	for _, id := range ids {
		if job := session.findJob(id); job != nil && (job.status == "queued" || job.status == "running") {
			job.status = "cancelled"
		}
	}
}

func (service *BatchService) lookupJob(
	batchID string,
	jobID string,
) (*batchSession, *batchJob, error) {
	service.mu.RLock()
	session, exists := service.sessions[batchID]
	service.mu.RUnlock()
	if !exists {
		return nil, nil, fmt.Errorf("批量任务已失效，请重新扫描目录")
	}
	session.mu.Lock()
	defer session.mu.Unlock()
	if job := session.findJob(jobID); job != nil {
		return session, job, nil
	}
	return nil, nil, fmt.Errorf("批量写入专辑 %q 不存在", jobID)
}

func batchPreview(session *batchSession) BatchPreview {
	session.mu.Lock()
	defer session.mu.Unlock()
	result := BatchPreview{
		BatchID:       session.id,
		RootDirectory: session.root,
		Depth:         session.depth,
		Jobs:          make([]BatchJobPreview, len(session.jobs)),
	}
	for index, job := range session.jobs {
		result.Jobs[index] = batchJobPreview(session.root, job)
	}
	return result
}

func batchJobPreviews(session *batchSession) []BatchJobPreview {
	session.mu.Lock()
	defer session.mu.Unlock()
	result := make([]BatchJobPreview, len(session.jobs))
	for index, job := range session.jobs {
		result[index] = batchJobPreview(session.root, job)
	}
	return result
}

func batchJobPreview(root string, job *batchJob) BatchJobPreview {
	relative, err := filepath.Rel(root, job.directory)
	if err != nil {
		relative = filepath.Base(job.directory)
	}
	status := job.status
	issues := dtoSlice(job.issues)
	if job.plan != nil {
		job.plan.mu.Lock()
		issues = append(issues, job.plan.issues...)
		if status == "ready" {
			if !canCommit(job.plan) {
				status = "blocked"
			} else if job.source == "local-json" {
				status = "local-metadata"
			}
		}
		job.plan.mu.Unlock()
	}
	return BatchJobPreview{
		CanRun:              job.canRun(),
		ID:                  job.id,
		RelativePath:        relative,
		InferredAlbumName:   job.inferredAlbumName,
		Source:              job.source,
		MatchDescription:    batchMatchDescription(job, status),
		AudioCount:          job.audioCount,
		Status:              status,
		Issues:              issues,
		Candidates:          dtoSlice(job.candidates),
		SelectedCandidateID: job.selectedCandidateID,
	}
}

func batchMatchDescription(job *batchJob, status string) string {
	switch status {
	case "loading":
		return "正在加载"
	case "no-audio":
		return "无音频"
	case "scan-failed":
		return "加载失败"
	case "blocked":
		return "写入内容存在问题"
	case "failed":
		return "写入失败"
	case "needs-candidate":
		return fmt.Sprintf("%d 个搜索结果", len(job.candidates))
	default:
		for _, candidate := range job.candidates {
			if candidate.ID == job.selectedCandidateID && !candidate.ExactMatch {
				return "已选择搜索结果"
			}
		}
		return "精确匹配"
	}
}

func (session *batchSession) findJob(id string) *batchJob {
	for _, job := range session.jobs {
		if job.id == id {
			return job
		}
	}
	return nil
}

func exactCandidate(candidates []AlbumCandidate) *AlbumCandidate {
	for index := range candidates {
		if candidates[index].ExactMatch {
			return &candidates[index]
		}
	}
	return nil
}
