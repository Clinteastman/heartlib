import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Sparkles, Loader2 } from 'lucide-react'
import { useAppStore } from '@/store/appStore'

export function LyricsGenerator() {
  const [prompt, setPrompt] = useState('')
  const [genre, setGenre] = useState('')
  const [mood, setMood] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { setLyrics, setTags } = useAppStore()

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a description for your song')
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      const response = await fetch('/api/lyrics/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          genre: genre.trim() || undefined,
          mood: mood.trim() || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to generate lyrics')
      }

      const data = await response.json()
      setLyrics(data.lyrics)
      setTags(data.tags)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate lyrics')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleLoadExample = async () => {
    try {
      const response = await fetch('/api/lyrics/example')
      const data = await response.json()
      setLyrics(data.lyrics)
      setTags(data.tags)
    } catch (err) {
      setError('Failed to load example')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          AI Lyrics Generator
        </CardTitle>
        <CardDescription>
          Describe the song you want and let AI write the lyrics
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="prompt">Song Description</Label>
          <Input
            id="prompt"
            placeholder="A love song about summer nights and dancing under the stars..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="genre">Genre (optional)</Label>
            <Input
              id="genre"
              placeholder="pop, rock, ballad..."
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mood">Mood (optional)</Label>
            <Input
              id="mood"
              placeholder="happy, melancholic..."
              value={mood}
              onChange={(e) => setMood(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex-1"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Lyrics
              </>
            )}
          </Button>
          <Button variant="outline" onClick={handleLoadExample}>
            Load Example
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
