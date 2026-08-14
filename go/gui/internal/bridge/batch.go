package bridge

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"sync"
	"time"

	"github.com/the1812/Touhou-Tagger/go/internal/config"
	"github.com/the1812/Touhou-Tagger/go/internal/domain"
	wails "github.com/wailsapp/wails/v3/pkg/application"
)

type batchJob struct {
	id                  string
	directory           string
	inferredAlbumName   string
	source              string
	matchDescription    string
	audioCount          int
	status              string
	issues              []StateIssue
	candidates          []AlbumCandidate
	selectedCandidateID string
	planID              string
	revision            int
	resolving           bool
	resolveToken        string
}

type batchSession struct {
	mu      sync.Mutex
	id      string
	root    string
	depth   int
	jobs    []*batchJob
	running bool
}

type BatchService struct {
	runtime   *runtimeState
	workspace *WorkspaceService
	ops       *operationManager
	app       *wails.App
	window    *wails.WebviewWindow

	mu       sync.RWMutex
	sessions map[string]*batchSession
}

func (service *BatchService) SelectBatchDirectory() (string, error) {
	return service.workspace.selectDirectory("选择批量写入根目录", batchDirectory)
}

func (service *BatchService) ScanBatch(
	ctx context.Context,
	directory string,
	depth int,
	sourceName string,
) (BatchPreview, error) {
	baseConfig := service.runtime.getConfig()
	if sourceName != "" {
		baseConfig.Source = sourceName
	}
	sourceName = baseConfig.Source
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
		id:    newID("batch"),
		root:  root,
		depth: depth,
		jobs:  make([]*batchJob, 0, len(jobs)),
	}
	for _, discovered := range jobs {
		if err := ctx.Err(); err != nil {
			return BatchPreview{}, err
		}
		job := &batchJob{
			id:                newID("job"),
			directory:         discovered.Directory,
			inferredAlbumName: discovered.Name,
			source:            sourceName,
			status:            "needs-candidate",
			issues:            []StateIssue{},
			candidates:        []AlbumCandidate{},
		}
		if discovered.Ignored {
			job.status = "ignored"
			job.matchDescription = "无音频，已忽略"
			session.jobs = append(session.jobs, job)
			continue
		}
		if discovered.PreflightErr != nil {
			job.status = "scan-failed"
			job.matchDescription = "扫描失败"
			job.issues = append(job.issues, errorIssue("scan-failed", discovered.PreflightErr.Error()))
			session.jobs = append(session.jobs, job)
			continue
		}
		scan, scanErr := applicationService.ScanAlbum(ctx, discovered.Directory)
		if scanErr != nil {
			job.status = "scan-failed"
			job.matchDescription = "扫描失败"
			job.issues = append(job.issues, errorIssue("scan-failed", scanErr.Error()))
			session.jobs = append(session.jobs, job)
			continue
		}
		job.audioCount = len(scan.AudioFiles)
		if scan.MetadataPath != "" {
			localCandidate := AlbumCandidate{
				ID:          "local-json",
				Title:       discovered.Name,
				Source:      "local-json",
				SourceLabel: sourceLabel("local-json"),
				Artists:     []string{},
				ExactMatch:  true,
			}
			job.candidates = []AlbumCandidate{localCandidate}
			job.selectedCandidateID = localCandidate.ID
			job.source = "local-json"
			job.matchDescription = "精确匹配"
			plan, prepareErr := service.workspace.prepareOwnedPlan(
				ctx,
				discovered.Directory,
				localCandidate.ID,
				localCandidate.Source,
				session.id,
			)
			if prepareErr != nil {
				job.status = "scan-failed"
				job.issues = append(job.issues, errorIssue("prepare-failed", prepareErr.Error()))
			} else {
				job.planID = plan.PlanID
				job.revision = plan.Revision
				job.issues = append(job.issues, plan.Issues...)
				if plan.CanCommit {
					job.status = "local-metadata"
				} else {
					job.status = "track-mismatch"
				}
			}
			session.jobs = append(session.jobs, job)
			continue
		}
		resolvedConfig, resolveErr := config.ResolveAlbum(
			discovered.Directory,
			baseConfig,
			baseConfig.LyricEnabled,
		)
		if resolveErr != nil {
			job.status = "scan-failed"
			job.matchDescription = "配置解析失败"
			job.issues = append(job.issues, errorIssue("config-failed", resolveErr.Error()))
			session.jobs = append(session.jobs, job)
			continue
		}
		job.source = resolvedConfig.Metadata.Source
		if !service.runtime.searchableSource(job.source) {
			job.status = "scan-failed"
			job.matchDescription = "配置解析失败"
			job.issues = append(job.issues, errorIssue(
				"config-failed",
				fmt.Sprintf("数据源 %q 不支持专辑搜索", job.source),
			))
			session.jobs = append(session.jobs, job)
			continue
		}
		candidates, searchErr := service.workspace.SearchAlbums(
			ctx,
			discovered.Directory,
			discovered.Name,
			job.source,
		)
		if searchErr != nil {
			job.status = "scan-failed"
			job.matchDescription = "搜索失败"
			job.issues = append(job.issues, errorIssue("search-failed", searchErr.Error()))
			session.jobs = append(session.jobs, job)
			continue
		}
		job.candidates = candidates
		exact := exactCandidate(candidates)
		switch {
		case exact != nil:
			job.selectedCandidateID = exact.ID
			job.matchDescription = "精确匹配"
			plan, prepareErr := service.workspace.prepareOwnedPlan(
				ctx,
				discovered.Directory,
				exact.ID,
				exact.Source,
				session.id,
			)
			if prepareErr != nil {
				job.status = "scan-failed"
				job.issues = append(job.issues, errorIssue("prepare-failed", prepareErr.Error()))
			} else {
				job.planID = plan.PlanID
				job.revision = plan.Revision
				job.issues = append(job.issues, plan.Issues...)
				if plan.CanCommit {
					job.status = "ready"
				} else {
					job.status = "track-mismatch"
				}
			}
		case len(candidates) == 0:
			job.matchDescription = "没有匹配结果"
			job.issues = append(job.issues, warningIssue(
				"candidate-required",
				"没有找到匹配专辑，请修改专辑名称后重新扫描。",
			))
		default:
			job.matchDescription = fmt.Sprintf("%d 个搜索结果", len(candidates))
			job.issues = append(job.issues, warningIssue(
				"candidate-required",
				"写入前需要选择匹配的专辑。",
			))
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
			service.workspace.plans.discardOwner(owner)
		}
	}
	service.sessions[session.id] = session
	service.mu.Unlock()
	return batchPreview(session), nil
}

func (service *BatchService) ResolveBatchCandidate(
	ctx context.Context,
	batchID string,
	jobID string,
	candidateID string,
) (BatchJobPreview, error) {
	service.mu.RLock()
	session, exists := service.sessions[batchID]
	if !exists {
		service.mu.RUnlock()
		return BatchJobPreview{}, fmt.Errorf("批量扫描结果已失效，请重新扫描")
	}
	session.mu.Lock()
	service.mu.RUnlock()
	if session.running {
		session.mu.Unlock()
		return BatchJobPreview{}, fmt.Errorf("批量写入期间不能修改搜索结果")
	}
	var job *batchJob
	for _, item := range session.jobs {
		if item.id == jobID {
			job = item
			break
		}
	}
	if job == nil {
		session.mu.Unlock()
		return BatchJobPreview{}, fmt.Errorf("批量写入专辑 %q 不存在", jobID)
	}
	if job.resolving {
		session.mu.Unlock()
		return BatchJobPreview{}, fmt.Errorf("这个专辑正在加载搜索结果，请稍候")
	}
	var candidate *AlbumCandidate
	for index := range job.candidates {
		if job.candidates[index].ID == candidateID {
			value := job.candidates[index]
			candidate = &value
			break
		}
	}
	if candidate == nil {
		session.mu.Unlock()
		return BatchJobPreview{}, fmt.Errorf("专辑中不存在搜索结果 %q", candidateID)
	}
	token := newID("resolve")
	job.resolving = true
	job.resolveToken = token
	directory := job.directory
	session.mu.Unlock()
	plan, err := service.workspace.prepareOwnedPlan(
		ctx,
		directory,
		candidate.ID,
		candidate.Source,
		session.id,
	)
	service.mu.RLock()
	current, currentExists := service.sessions[batchID]
	if !currentExists || current != session {
		service.mu.RUnlock()
		if err == nil {
			service.workspace.plans.discard(plan.PlanID)
		}
		return BatchJobPreview{}, fmt.Errorf("批量扫描结果已失效，请重新扫描")
	}
	session.mu.Lock()
	service.mu.RUnlock()
	defer session.mu.Unlock()
	if session.running || !job.resolving || job.resolveToken != token {
		if err == nil {
			service.workspace.plans.discard(plan.PlanID)
		}
		return BatchJobPreview{}, fmt.Errorf("搜索结果已失效")
	}
	job.resolving = false
	job.resolveToken = ""
	job.selectedCandidateID = candidate.ID
	job.source = candidate.Source
	job.matchDescription = "已选择搜索结果"
	job.issues = job.issues[:0]
	if err != nil {
		job.status = "scan-failed"
		job.issues = append(job.issues, errorIssue("prepare-failed", err.Error()))
		return batchJobPreview(session.root, job), nil
	}
	job.planID = plan.PlanID
	job.revision = plan.Revision
	job.issues = append(job.issues, plan.Issues...)
	if plan.CanCommit {
		job.status = "ready"
	} else {
		job.status = "track-mismatch"
	}
	return batchJobPreview(session.root, job), nil
}

func (service *BatchService) IgnoreBatchJob(
	batchID string,
	jobID string,
) (BatchJobPreview, error) {
	service.mu.RLock()
	session, exists := service.sessions[batchID]
	if !exists {
		service.mu.RUnlock()
		return BatchJobPreview{}, fmt.Errorf("批量扫描结果已失效，请重新扫描")
	}
	session.mu.Lock()
	service.mu.RUnlock()
	if session.running {
		session.mu.Unlock()
		return BatchJobPreview{}, fmt.Errorf("批量写入期间不能忽略专辑")
	}
	var job *batchJob
	for _, item := range session.jobs {
		if item.id == jobID {
			job = item
			break
		}
	}
	if job == nil {
		session.mu.Unlock()
		return BatchJobPreview{}, fmt.Errorf("批量写入专辑 %q 不存在", jobID)
	}
	if job.resolving {
		session.mu.Unlock()
		return BatchJobPreview{}, fmt.Errorf("这个专辑正在加载搜索结果，请稍候")
	}
	planID := job.planID
	job.planID = ""
	job.revision = 0
	job.selectedCandidateID = ""
	job.status = "ignored"
	job.matchDescription = "已忽略"
	job.issues = []StateIssue{}
	preview := batchJobPreview(session.root, job)
	session.mu.Unlock()
	if planID != "" {
		service.workspace.plans.discard(planID)
	}
	return preview, nil
}

func (service *BatchService) RunBatch(
	batchID string,
	failedOnly bool,
) (OperationStart, error) {
	service.mu.RLock()
	session, exists := service.sessions[batchID]
	service.mu.RUnlock()
	if !exists {
		return OperationStart{}, fmt.Errorf("批量扫描结果已失效，请重新扫描")
	}
	session.mu.Lock()
	if session.running {
		session.mu.Unlock()
		return OperationStart{}, fmt.Errorf("批量写入正在运行")
	}
	for _, job := range session.jobs {
		if job.resolving {
			session.mu.Unlock()
			return OperationStart{}, fmt.Errorf("仍有搜索结果正在加载，请稍候")
		}
	}
	selected := make([]string, 0, len(session.jobs))
	previousStatuses := make(map[string]string, len(session.jobs))
	for _, job := range session.jobs {
		if failedOnly {
			if job.status == "failed" {
				selected = append(selected, job.id)
				previousStatuses[job.id] = job.status
				job.status = "queued"
			}
			continue
		}
		if job.status == "ready" || job.status == "local-metadata" {
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
		for _, selectedID := range selected {
			for _, job := range session.jobs {
				if job.id == selectedID && job.status == "queued" {
					job.status = previousStatuses[selectedID]
				}
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
		service.workspace.plans.discardOwner(owner)
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
		candidateID := job.selectedCandidateID
		sourceName := job.source
		planID := job.planID
		revision := job.revision
		session.mu.Unlock()
		service.ops.emitProgress(OperationProgress{
			OperationID: operationID,
			Stage:       "preparing",
			Current:     index,
			Total:       len(selected),
			Path:        filepath.Base(directory),
			Message:     fmt.Sprintf("正在处理专辑 %d / %d", index+1, len(selected)),
		})
		if planID == "" || !service.claimPlan(planID, revision) {
			plan, prepareErr := service.workspace.prepareOwnedPlan(
				ctx,
				directory,
				candidateID,
				sourceName,
				session.id,
			)
			if prepareErr != nil {
				if errors.Is(prepareErr, context.Canceled) {
					service.cancelRemaining(session, selected[index:])
					result.Cancelled = true
					result.Message = "已取消当前准备阶段，并停止写入后续专辑。"
					result.DurationMS = time.Since(started).Milliseconds()
					result.Jobs = batchJobPreviews(session)
					return result, nil
				}
				service.failJob(session, job, prepareErr)
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
			planID = plan.PlanID
			revision = plan.Revision
			session.mu.Lock()
			job.planID = planID
			job.revision = revision
			session.mu.Unlock()
			if !plan.CanCommit || !service.claimPlan(planID, revision) {
				service.failJob(session, job, fmt.Errorf("写入内容仍有未解决的问题"))
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
		}
		commitResult, _, commitErr := service.workspace.executeCommit(
			ctx,
			operationID,
			planID,
			service.batchEventSink(operationID, index, len(selected), directory),
		)
		service.workspace.plans.delete(planID)
		if errors.Is(commitErr, context.Canceled) {
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

func (service *BatchService) claimPlan(planID string, revision int) bool {
	session, exists := service.workspace.plans.get(planID)
	if !exists {
		return false
	}
	session.mu.Lock()
	defer session.mu.Unlock()
	if session.revision != revision || !canCommit(session) {
		return false
	}
	session.committing = true
	return true
}

func (service *BatchService) failJob(session *batchSession, job *batchJob, err error) {
	session.mu.Lock()
	job.status = "failed"
	job.issues = []StateIssue{errorIssue("operation-failed", err.Error())}
	session.mu.Unlock()
}

func (service *BatchService) cancelRemaining(session *batchSession, ids []string) {
	session.mu.Lock()
	defer session.mu.Unlock()
	for _, id := range ids {
		for _, job := range session.jobs {
			if job.id == id && (job.status == "queued" || job.status == "running") {
				job.status = "cancelled"
			}
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
		return nil, nil, fmt.Errorf("批量扫描结果已失效，请重新扫描")
	}
	session.mu.Lock()
	defer session.mu.Unlock()
	for _, job := range session.jobs {
		if job.id == jobID {
			return session, job, nil
		}
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
	return BatchJobPreview{
		ID:                  job.id,
		RelativePath:        relative,
		InferredAlbumName:   job.inferredAlbumName,
		Source:              job.source,
		MatchDescription:    job.matchDescription,
		AudioCount:          job.audioCount,
		Status:              job.status,
		Issues:              dtoSlice(job.issues),
		Candidates:          dtoSlice(job.candidates),
		SelectedCandidateID: job.selectedCandidateID,
	}
}

func exactCandidate(candidates []AlbumCandidate) *AlbumCandidate {
	for index := range candidates {
		if candidates[index].ExactMatch {
			return &candidates[index]
		}
	}
	return nil
}
