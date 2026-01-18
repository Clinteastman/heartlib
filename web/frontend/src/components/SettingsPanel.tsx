import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Settings, Eye, EyeOff, Check, Loader2 } from 'lucide-react'

interface LLMProvider {
  id: string
  name: string
  requires_api_key: boolean
  models: string[]
  default_model: string
}

interface LLMSettings {
  provider: string
  model: string
  api_key_set: boolean
}

export function SettingsPanel() {
  const [providers, setProviders] = useState<LLMProvider[]>([])
  const [settings, setSettings] = useState<LLMSettings | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<string>('openai')
  const [selectedModel, setSelectedModel] = useState<string>('gpt-4o')
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  useEffect(() => {
    // Fetch providers
    fetch('/api/settings/llm/providers')
      .then(res => res.json())
      .then(setProviders)
      .catch(console.error)

    // Fetch current settings
    fetch('/api/settings/llm')
      .then(res => res.json())
      .then((data: LLMSettings) => {
        setSettings(data)
        setSelectedProvider(data.provider)
        setSelectedModel(data.model)
      })
      .catch(console.error)
  }, [])

  const currentProvider = providers.find(p => p.id === selectedProvider)

  const handleProviderChange = (providerId: string) => {
    setSelectedProvider(providerId)
    const provider = providers.find(p => p.id === providerId)
    if (provider) {
      setSelectedModel(provider.default_model)
    }
    setApiKey('')
  }

  const handleSave = async () => {
    setIsSaving(true)
    setSaveMessage(null)

    try {
      const response = await fetch('/api/settings/llm', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          model: selectedModel,
          api_key: apiKey || undefined,
        }),
      })

      if (response.ok) {
        setSaveMessage('Settings saved!')
        setApiKey('')
        // Refresh settings
        const data = await fetch('/api/settings/llm').then(r => r.json())
        setSettings(data)
      } else {
        const data = await response.json()
        setSaveMessage(`Error: ${data.detail}`)
      }
    } catch (err) {
      setSaveMessage('Failed to save settings')
    } finally {
      setIsSaving(false)
      setTimeout(() => setSaveMessage(null), 3000)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          AI Provider Settings
        </CardTitle>
        <CardDescription>
          Configure your LLM provider for AI-powered lyrics generation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Provider Selection */}
        <div className="space-y-2">
          <Label>Provider</Label>
          <div className="grid grid-cols-3 gap-2">
            {providers.map(provider => (
              <Button
                key={provider.id}
                variant={selectedProvider === provider.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleProviderChange(provider.id)}
                className="w-full"
              >
                {provider.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Model Selection */}
        {currentProvider && (
          <div className="space-y-2">
            <Label>Model</Label>
            <div className="flex flex-wrap gap-2">
              {currentProvider.models.map(model => (
                <Button
                  key={model}
                  variant={selectedModel === model ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedModel(model)}
                >
                  {model}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* API Key */}
        {currentProvider?.requires_api_key && (
          <div className="space-y-2">
            <Label htmlFor="api-key">
              API Key
              {settings?.api_key_set && settings.provider === selectedProvider && (
                <span className="ml-2 text-xs text-green-500">(configured)</span>
              )}
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="api-key"
                  type={showApiKey ? 'text' : 'password'}
                  placeholder={settings?.api_key_set && settings.provider === selectedProvider
                    ? '••••••••••••••••'
                    : `Enter your ${currentProvider.name} API key`
                  }
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedProvider === 'openai' && 'Get your API key from platform.openai.com'}
              {selectedProvider === 'anthropic' && 'Get your API key from console.anthropic.com'}
              {selectedProvider === 'ollama' && 'No API key required for local Ollama'}
            </p>
          </div>
        )}

        {/* Save Button */}
        <div className="flex items-center gap-4">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Save Settings
              </>
            )}
          </Button>
          {saveMessage && (
            <span className={`text-sm ${saveMessage.startsWith('Error') ? 'text-destructive' : 'text-green-500'}`}>
              {saveMessage}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
