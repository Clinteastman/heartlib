import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tags, X, Plus } from 'lucide-react'
import { useAppStore } from '@/store/appStore'

interface TagPresets {
  instruments: string[]
  moods: string[]
  genres: string[]
  feels: string[]
  vocals: string[]
}

export function TagSelector() {
  const { tags, setTags } = useAppStore()
  const [tagPresets, setTagPresets] = useState<TagPresets | null>(null)
  const [newTag, setNewTag] = useState('')

  const tagList = tags ? tags.split(',').filter(t => t.trim()) : []

  useEffect(() => {
    fetch('/api/lyrics/tag-presets')
      .then(res => res.json())
      .then(setTagPresets)
      .catch(console.error)
  }, [])

  const addTag = (tag: string) => {
    const normalizedTag = tag.toLowerCase().trim()
    if (!normalizedTag || tagList.includes(normalizedTag)) return

    const newTags = [...tagList, normalizedTag]
    setTags(newTags.join(','))
  }

  const removeTag = (tagToRemove: string) => {
    const newTags = tagList.filter(t => t !== tagToRemove)
    setTags(newTags.join(','))
  }

  const handleAddCustomTag = () => {
    if (newTag.trim()) {
      addTag(newTag)
      setNewTag('')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tags className="h-5 w-5" />
          Tags
        </CardTitle>
        <CardDescription>
          Select tags to guide the music style. Choose 4-8 tags for best results.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Tags */}
        <div className="space-y-2">
          <Label>Selected Tags ({tagList.length}/8)</Label>
          <div className="flex flex-wrap gap-2 min-h-[40px] p-2 border rounded-md bg-muted/50">
            {tagList.length === 0 ? (
              <span className="text-sm text-muted-foreground">No tags selected</span>
            ) : (
              tagList.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  {tag}
                  <button
                    onClick={() => removeTag(tag)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))
            )}
          </div>
        </div>

        {/* Custom Tag Input */}
        <div className="flex gap-2">
          <Input
            placeholder="Add custom tag..."
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddCustomTag()}
          />
          <Button variant="outline" onClick={handleAddCustomTag}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Tag Presets */}
        {tagPresets && (
          <Tabs defaultValue="instruments" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="instruments">Instruments</TabsTrigger>
              <TabsTrigger value="moods">Moods</TabsTrigger>
              <TabsTrigger value="genres">Genres</TabsTrigger>
              <TabsTrigger value="feels">Feel</TabsTrigger>
              <TabsTrigger value="vocals">Vocals</TabsTrigger>
            </TabsList>

            {(Object.entries(tagPresets) as [string, string[]][]).map(([category, presetTags]) => (
              <TabsContent key={category} value={category} className="mt-4">
                <div className="flex flex-wrap gap-2">
                  {presetTags.map((tag: string) => (
                    <Button
                      key={tag}
                      variant={tagList.includes(tag) ? "default" : "outline"}
                      size="sm"
                      onClick={() => tagList.includes(tag) ? removeTag(tag) : addTag(tag)}
                    >
                      {tag}
                    </Button>
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </CardContent>
    </Card>
  )
}
