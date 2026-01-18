import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Download, CheckCircle2, XCircle, Loader2, HardDrive } from 'lucide-react'

interface ModelInfo {
  name: string
  path: string
  exists: boolean
  repo: string | null
}

interface ModelsStatus {
  checkpoint_dir: string
  all_present: boolean
  models: ModelInfo[]
}

interface DownloadStatus {
  is_downloading: boolean
  current_model: string | null
  progress: number
  error: string | null
}

export function ModelStatus() {
  const [status, setStatus] = useState<ModelsStatus | null>(null)
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/models/status')
      const data = await response.json()
      setStatus(data)
    } catch (err) {
      console.error('Failed to fetch model status:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  useEffect(() => {
    if (!downloadStatus?.is_downloading) return

    // Poll download status
    const eventSource = new EventSource('/api/models/download/progress')

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data) as DownloadStatus
      setDownloadStatus(data)

      if (!data.is_downloading) {
        eventSource.close()
        // Refresh model status
        fetchStatus()
      }
    }

    eventSource.onerror = () => {
      eventSource.close()
    }

    return () => eventSource.close()
  }, [downloadStatus?.is_downloading])

  const handleDownload = async () => {
    setDownloadStatus({ is_downloading: true, current_model: null, progress: 0, error: null })

    try {
      const response = await fetch('/api/models/download', { method: 'POST' })
      const data = await response.json()

      if (data.status === 'complete') {
        // Already complete
        setDownloadStatus(null)
        fetchStatus()
      }
    } catch (err) {
      setDownloadStatus({
        is_downloading: false,
        current_model: null,
        progress: 0,
        error: 'Failed to start download',
      })
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking models...
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!status) {
    return null
  }

  // If all models are present, show minimal status
  if (status.all_present && !downloadStatus?.is_downloading) {
    return (
      <Card className="border-green-500/20 bg-green-500/5">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-green-500">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-medium">Models Ready</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const missingModels = status.models.filter(m => !m.exists && m.repo)

  return (
    <Card className={!status.all_present ? 'border-yellow-500/50' : ''}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          Model Status
        </CardTitle>
        <CardDescription>
          {status.all_present
            ? 'All required models are downloaded'
            : `${missingModels.length} model(s) need to be downloaded`
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Model List */}
        <div className="space-y-2">
          {status.models.map(model => (
            <div key={model.name} className="flex items-center justify-between py-1">
              <span className="text-sm">{model.name}</span>
              {model.exists ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-yellow-500" />
              )}
            </div>
          ))}
        </div>

        {/* Download Progress */}
        {downloadStatus?.is_downloading && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>
                {downloadStatus.current_model
                  ? `Downloading ${downloadStatus.current_model}...`
                  : 'Starting download...'
                }
              </span>
            </div>
            <Progress value={downloadStatus.progress} />
          </div>
        )}

        {/* Download Error */}
        {downloadStatus?.error && (
          <p className="text-sm text-destructive">{downloadStatus.error}</p>
        )}

        {/* Download Button */}
        {!status.all_present && !downloadStatus?.is_downloading && (
          <Button onClick={handleDownload} className="w-full">
            <Download className="mr-2 h-4 w-4" />
            Download Missing Models
          </Button>
        )}

        <p className="text-xs text-muted-foreground">
          Checkpoint directory: {status.checkpoint_dir}
        </p>
      </CardContent>
    </Card>
  )
}
