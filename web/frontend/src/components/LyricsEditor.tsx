import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, Plus } from 'lucide-react'
import { useAppStore } from '@/store/appStore'

const SECTION_MARKERS = ['[Intro]', '[Verse]', '[Prechorus]', '[Chorus]', '[Bridge]', '[Outro]']

export function LyricsEditor() {
  const { lyrics, setLyrics } = useAppStore()

  const insertSection = (section: string) => {
    const newLyrics = lyrics ? `${lyrics}\n\n${section}\n` : `${section}\n`
    setLyrics(newLyrics)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Lyrics Editor
        </CardTitle>
        <CardDescription>
          Edit your lyrics or write them from scratch. Use section markers to structure your song.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {SECTION_MARKERS.map((section) => (
            <Button
              key={section}
              variant="outline"
              size="sm"
              onClick={() => insertSection(section)}
            >
              <Plus className="mr-1 h-3 w-3" />
              {section.replace('[', '').replace(']', '')}
            </Button>
          ))}
        </div>

        <div className="space-y-2">
          <Label htmlFor="lyrics">Lyrics</Label>
          <Textarea
            id="lyrics"
            placeholder={`[Intro]

[Verse]
Write your verse lyrics here...

[Chorus]
Write your chorus lyrics here...`}
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            className="min-h-[300px] font-mono text-sm"
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Tip: Lyrics will be converted to lowercase automatically. Use section markers like [Verse], [Chorus], [Bridge] to structure your song.
        </p>
      </CardContent>
    </Card>
  )
}
