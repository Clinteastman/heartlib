import { useRef, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Play, Pause, Download, Volume2, VolumeX, RotateCcw } from 'lucide-react'
import { useAppStore } from '@/store/appStore'

export function AudioPlayer() {
  const { generation } = useAppStore()
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)

  const audioUrl = generation.outputPath

  useEffect(() => {
    // Reset player state when new audio is loaded
    setIsPlaying(false)
    setCurrentTime(0)
  }, [audioUrl])

  if (!audioUrl || generation.status !== 'completed') {
    return null
  }

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
    }
  }

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0]
      setCurrentTime(value[0])
    }
  }

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0]
    setVolume(newVolume)
    if (audioRef.current) {
      audioRef.current.volume = newVolume
    }
    setIsMuted(newVolume === 0)
  }

  const toggleMute = () => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.volume = volume || 1
        setIsMuted(false)
      } else {
        audioRef.current.volume = 0
        setIsMuted(true)
      }
    }
  }

  const restart = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0
      setCurrentTime(0)
    }
  }

  const handleEnded = () => {
    setIsPlaying(false)
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = audioUrl
    link.download = `heartmula_${generation.jobId?.slice(0, 8) || 'music'}.mp3`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Generated Music</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
        />

        {/* Progress Slider */}
        <div className="space-y-2">
          <Slider
            value={[currentTime]}
            onValueChange={handleSeek}
            max={duration || 100}
            step={0.1}
            className="cursor-pointer"
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={restart}>
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button size="icon" onClick={togglePlay}>
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-2 w-32">
            <Button variant="ghost" size="icon" onClick={toggleMute}>
              {isMuted ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
            <Slider
              value={[isMuted ? 0 : volume]}
              onValueChange={handleVolumeChange}
              max={1}
              step={0.01}
              className="w-20"
            />
          </div>

          {/* Download */}
          <Button variant="outline" onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
