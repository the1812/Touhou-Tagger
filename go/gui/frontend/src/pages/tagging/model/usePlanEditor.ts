import { computed, ref, watch } from 'vue'

import { useWorkspaceStore } from '../../../features/workspace'
import type { AlbumMetadata, PlanItemPreview } from '../../../shared/api'

type TrackDraft = Pick<
  PlanItemPreview,
  'discNumber' | 'trackNumber' | 'title' | 'artists' | 'comments'
>
type EditorDraft =
  | { kind: 'album'; value: AlbumMetadata }
  | { kind: 'track'; trackId: string; value: TrackDraft }

export const usePlanEditor = (workspace: ReturnType<typeof useWorkspaceStore>) => {
  const draft = ref<EditorDraft>()
  const kind = computed(() => draft.value?.kind)
  const albumDraft = computed(() => (draft.value?.kind === 'album' ? draft.value.value : undefined))
  const trackDraft = computed(() => (draft.value?.kind === 'track' ? draft.value.value : undefined))
  const selectedTrack = computed(() => {
    const current = draft.value
    return current?.kind === 'track'
      ? workspace.plan?.items.find(item => item.id === current.trackId)
      : undefined
  })
  const close = () => {
    draft.value = undefined
  }
  const openAlbum = () => {
    const album = workspace.plan?.album
    if (!album || workspace.isBusy || workspace.stalePlan) {
      return
    }
    draft.value = {
      kind: 'album',
      value: { ...album, artists: [...album.artists], genres: [...album.genres] },
    }
  }
  const openTrack = (trackId: string) => {
    const item = workspace.plan?.items.find(track => track.id === trackId)
    if (!item || workspace.isBusy || workspace.stalePlan) {
      return
    }
    draft.value = {
      kind: 'track',
      trackId,
      value: {
        discNumber: item.discNumber,
        trackNumber: item.trackNumber,
        title: item.title,
        artists: [...item.artists],
        comments: item.comments,
      },
    }
  }
  const updateAlbumDraft = (value: AlbumMetadata) => {
    if (draft.value?.kind === 'album') {
      draft.value.value = value
    }
  }
  const updateTrackDraft = (value: TrackDraft) => {
    if (draft.value?.kind === 'track') {
      draft.value.value = value
    }
  }
  const saveAlbum = async () => {
    const album = albumDraft.value
    if (
      album &&
      (await workspace.updatePlan({
        album: { ...album, artists: [...album.artists], genres: [...album.genres] },
      }))
    ) {
      close()
    }
  }
  const saveTrack = async () => {
    const current = draft.value
    if (
      current?.kind === 'track' &&
      (await workspace.updatePlan({
        tracks: [{ id: current.trackId, ...current.value, artists: [...current.value.artists] }],
      }))
    ) {
      close()
    }
  }

  watch(() => workspace.plan?.planId, close)

  return {
    kind,
    albumDraft,
    trackDraft,
    selectedTrack,
    close,
    openAlbum,
    openTrack,
    updateAlbumDraft,
    updateTrackDraft,
    saveAlbum,
    saveTrack,
  }
}
