import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, CheckCircle2, XCircle, Music } from 'lucide-react'
import { useAppStore } from '@/store/appStore'

export function ProgressIndicator() {
  const { generation } = useAppStore()

  if (!generation.jobId) {
    return null
  }

  const getStatusIcon = () => {
    switch (generation.status) {
      case 'queued':
      case 'loading':
        return <Loader2 className="h-5 w-5 animate-spin text-primary" />
      case 'generating':
        return <Music className="h-5 w-5 animate-pulse text-primary" />
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />
      case 'failed':
        return <XCircle className="h-5 w-5 text-destructive" />
      default:
        return null
    }
  }

  const getStatusText = () => {
    switch (generation.status) {
      case 'queued':
        return 'Queued...'
      case 'loading':
        return 'Loading models...'
      case 'generating':
        return `Generating music... ${Math.round(generation.progress * 100)}%`
      case 'completed':
        return 'Generation complete!'
      case 'failed':
        return `Error: ${generation.error || 'Generation failed'}`
      default:
        return 'Unknown status'
    }
  }

  const getTimeEstimate = () => {
    if (generation.status !== 'generating' || generation.totalFrames === 0) {
      return null
    }

    const framesRemaining = generation.totalFrames - generation.currentFrame
    // Estimate ~80ms per frame (based on the 80ms frame rate)
    const msRemaining = framesRemaining * 80
    const secondsRemaining = Math.ceil(msRemaining / 1000)

    if (secondsRemaining > 60) {
      const minutes = Math.floor(secondsRemaining / 60)
      const seconds = secondsRemaining % 60
      return `~${minutes}m ${seconds}s remaining`
    }
    return `~${secondsRemaining}s remaining`
  }

  return (
    <Card className={generation.status === 'failed' ? 'border-destructive' : ''}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          {getStatusIcon()}
          Music Generation
        </CardTitle>
        <CardDescription>
          {getStatusText()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {(generation.status === 'loading' || generation.status === 'generating') && (
          <>
            <Progress value={generation.progress * 100} />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>
                Frame {generation.currentFrame} / {generation.totalFrames}
              </span>
              <span>{getTimeEstimate()}</span>
            </div>
          </>
        )}

        {generation.status === 'completed' && generation.outputPath && (
          <p className="text-sm text-muted-foreground">
            Your music is ready! Use the player below to listen and download.
          </p>
        )}

        {generation.status === 'failed' && (
          <p className="text-sm text-destructive">
            {generation.error || 'An error occurred during generation. Please try again.'}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
