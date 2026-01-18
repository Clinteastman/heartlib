import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LyricsGenerator } from '@/components/LyricsGenerator'
import { LyricsEditor } from '@/components/LyricsEditor'
import { TagSelector } from '@/components/TagSelector'
import { GenerationSettings } from '@/components/GenerationSettings'
import { ProgressIndicator } from '@/components/ProgressIndicator'
import { AudioPlayer } from '@/components/AudioPlayer'
import { SettingsPanel } from '@/components/SettingsPanel'
import { ModelStatus } from '@/components/ModelStatus'
import { useSSE } from '@/hooks/useSSE'
import { useAppStore } from '@/store/appStore'
import { Music, Loader2, Heart, Settings } from 'lucide-react'

interface SSEData {
  job_id: string
  status: string
  progress: number
  current_frame: number
  total_frames: number
  output_path: string | null
  error: string | null
}

type GenerationStatus = 'idle' | 'queued' | 'loading' | 'generating' | 'completed' | 'failed'

function App() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('generate')

  const {
    lyrics,
    tags,
    generation,
    setGeneration,
    startGeneration,
    resetGeneration,
  } = useAppStore()

  // SSE URL - only connect when we have a job ID and it's not completed/failed
  const sseUrl =
    generation.jobId &&
    generation.status !== 'completed' &&
    generation.status !== 'failed'
      ? `/api/generation/progress/${generation.jobId}`
      : null

  const handleSSEMessage = useCallback(
    (data: unknown) => {
      const sseData = data as SSEData
      setGeneration({
        status: sseData.status as GenerationStatus,
        progress: sseData.progress,
        currentFrame: sseData.current_frame,
        totalFrames: sseData.total_frames,
        outputPath: sseData.output_path,
        error: sseData.error,
      })

      // Stop generating state when done
      if (sseData.status === 'completed' || sseData.status === 'failed') {
        setIsGenerating(false)
      }
    },
    [setGeneration]
  )

  useSSE(sseUrl, {
    onMessage: handleSSEMessage,
    onError: () => {
      console.error('SSE connection error')
      // If we lose connection during generation, show an error
      if (isGenerating || generation.status === 'loading' || generation.status === 'generating') {
        setError('Connection to server lost. The backend may have crashed during model loading (possibly out of memory). Check the terminal for details.')
        setIsGenerating(false)
        setGeneration({
          status: 'failed',
          error: 'Connection lost - backend may have crashed',
        })
      }
    },
  })

  const handleGenerate = async () => {
    setError(null)
    setIsGenerating(true)

    try {
      await startGeneration()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start generation')
      setIsGenerating(false)
    }
  }

  const handleReset = () => {
    resetGeneration()
    setError(null)
    setIsGenerating(false)
  }

  const canGenerate =
    lyrics.trim() && tags.trim() && !isGenerating && generation.status !== 'generating'

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 flex h-16 items-center justify-between">
          <div className="flex items-center">
            <div className="flex items-center gap-2">
              <Heart className="h-6 w-6 text-primary fill-primary" />
              <span className="text-xl font-bold">HeartMuLa</span>
            </div>
            <span className="ml-4 text-sm text-muted-foreground">
              AI Music Generation
            </span>
          </div>

          {/* Tab Navigation */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="generate">
                <Music className="mr-2 h-4 w-4" />
                Generate
              </TabsTrigger>
              <TabsTrigger value="settings">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {activeTab === 'generate' ? (
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Left Column - Lyrics */}
            <div className="space-y-6">
              <LyricsGenerator />
              <LyricsEditor />
            </div>

            {/* Right Column - Tags, Settings, Generation */}
            <div className="space-y-6">
              <ModelStatus />
              <TagSelector />
              <GenerationSettings />

              {/* Generate Button */}
              <div className="space-y-4">
                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}

                <div className="flex gap-4">
                  <Button
                    size="lg"
                    className="flex-1"
                    onClick={handleGenerate}
                    disabled={!canGenerate}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Music className="mr-2 h-5 w-5" />
                        Generate Music
                      </>
                    )}
                  </Button>

                  {(generation.status === 'completed' ||
                    generation.status === 'failed') && (
                    <Button variant="outline" size="lg" onClick={handleReset}>
                      New Generation
                    </Button>
                  )}
                </div>
              </div>

              {/* Progress & Player */}
              <ProgressIndicator />
              <AudioPlayer />
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-6">
            <ModelStatus />
            <SettingsPanel />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t py-6 mt-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>
            Powered by HeartMuLa - Open Source Music Foundation Models
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App
