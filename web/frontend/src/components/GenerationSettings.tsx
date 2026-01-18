import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Settings } from 'lucide-react'
import { useAppStore } from '@/store/appStore'

export function GenerationSettings() {
  const { settings, setSettings } = useAppStore()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Generation Settings
        </CardTitle>
        <CardDescription>
          Fine-tune the music generation parameters
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Temperature */}
        <div className="space-y-3">
          <div className="flex justify-between">
            <Label>Temperature</Label>
            <span className="text-sm text-muted-foreground">{settings.temperature.toFixed(1)}</span>
          </div>
          <Slider
            value={[settings.temperature]}
            onValueChange={([value]) => setSettings({ temperature: value })}
            min={0.1}
            max={2.0}
            step={0.1}
          />
          <p className="text-xs text-muted-foreground">
            Lower = more consistent, Higher = more creative/varied
          </p>
        </div>

        {/* Top-K */}
        <div className="space-y-3">
          <div className="flex justify-between">
            <Label>Top-K</Label>
            <span className="text-sm text-muted-foreground">{settings.topk}</span>
          </div>
          <Slider
            value={[settings.topk]}
            onValueChange={([value]) => setSettings({ topk: value })}
            min={1}
            max={200}
            step={1}
          />
          <p className="text-xs text-muted-foreground">
            Number of top tokens to consider during generation
          </p>
        </div>

        {/* CFG Scale */}
        <div className="space-y-3">
          <div className="flex justify-between">
            <Label>CFG Scale</Label>
            <span className="text-sm text-muted-foreground">{settings.cfgScale.toFixed(1)}</span>
          </div>
          <Slider
            value={[settings.cfgScale]}
            onValueChange={([value]) => setSettings({ cfgScale: value })}
            min={1.0}
            max={3.0}
            step={0.1}
          />
          <p className="text-xs text-muted-foreground">
            Classifier-free guidance strength. Higher = follows tags more closely
          </p>
        </div>

        {/* Max Audio Length */}
        <div className="space-y-3">
          <div className="flex justify-between">
            <Label>Max Duration</Label>
            <span className="text-sm text-muted-foreground">
              {Math.floor(settings.maxAudioLengthMs / 60000)}:{String(Math.floor((settings.maxAudioLengthMs % 60000) / 1000)).padStart(2, '0')}
            </span>
          </div>
          <Slider
            value={[settings.maxAudioLengthMs]}
            onValueChange={([value]) => setSettings({ maxAudioLengthMs: value })}
            min={60000}
            max={480000}
            step={30000}
          />
          <p className="text-xs text-muted-foreground">
            Maximum duration of generated audio (1-8 minutes)
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
