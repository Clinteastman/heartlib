import { create } from 'zustand'

interface GenerationSettings {
  temperature: number
  topk: number
  cfgScale: number
  maxAudioLengthMs: number
}

interface GenerationState {
  jobId: string | null
  status: 'idle' | 'queued' | 'loading' | 'generating' | 'completed' | 'failed'
  progress: number
  currentFrame: number
  totalFrames: number
  outputPath: string | null
  error: string | null
}

interface AppState {
  // Lyrics and tags
  lyrics: string
  tags: string
  setLyrics: (lyrics: string) => void
  setTags: (tags: string) => void

  // Generation settings
  settings: GenerationSettings
  setSettings: (settings: Partial<GenerationSettings>) => void

  // Generation state
  generation: GenerationState
  setGeneration: (state: Partial<GenerationState>) => void
  resetGeneration: () => void

  // Start generation
  startGeneration: () => Promise<void>
}

const DEFAULT_SETTINGS: GenerationSettings = {
  temperature: 1.0,
  topk: 50,
  cfgScale: 1.5,
  maxAudioLengthMs: 240000,
}

const DEFAULT_GENERATION: GenerationState = {
  jobId: null,
  status: 'idle',
  progress: 0,
  currentFrame: 0,
  totalFrames: 0,
  outputPath: null,
  error: null,
}

export const useAppStore = create<AppState>((set, get) => ({
  // Lyrics and tags
  lyrics: '',
  tags: '',
  setLyrics: (lyrics) => set({ lyrics }),
  setTags: (tags) => set({ tags }),

  // Generation settings
  settings: DEFAULT_SETTINGS,
  setSettings: (newSettings) =>
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    })),

  // Generation state
  generation: DEFAULT_GENERATION,
  setGeneration: (newState) =>
    set((state) => ({
      generation: { ...state.generation, ...newState },
    })),
  resetGeneration: () => set({ generation: DEFAULT_GENERATION }),

  // Start generation
  startGeneration: async () => {
    const { lyrics, tags, settings, setGeneration } = get()

    if (!lyrics.trim()) {
      throw new Error('Please enter lyrics')
    }

    if (!tags.trim()) {
      throw new Error('Please select at least one tag')
    }

    // Reset generation state
    setGeneration({
      ...DEFAULT_GENERATION,
      status: 'queued',
    })

    try {
      const response = await fetch('/api/generation/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lyrics: lyrics.trim(),
          tags: tags.trim(),
          temperature: settings.temperature,
          topk: settings.topk,
          cfg_scale: settings.cfgScale,
          max_audio_length_ms: settings.maxAudioLengthMs,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to start generation')
      }

      const data = await response.json()
      setGeneration({
        jobId: data.job_id,
        status: data.status,
      })

      return data.job_id
    } catch (error) {
      setGeneration({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Failed to start generation',
      })
      throw error
    }
  },
}))
