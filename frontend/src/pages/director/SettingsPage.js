import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { settingsApi } from '@/lib/api';
import { toast } from 'sonner';
import { Settings, Save, Palette, Type, Image, Film, Loader2 } from 'lucide-react';

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    app_name: 'SP GROUP',
    logo_url: '/sp-logo.png',
    bg_video_url: '/bg-video.mp4',
    primary_color: '#1a1a2e',
    tagline: 'Industrial Operating System',
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    settingsApi.get().then(r => {
      setSettings(prev => ({ ...prev, ...r.data }));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await settingsApi.update(settings);
      setSettings(prev => ({ ...prev, ...res.data }));
      toast.success('Settings saved successfully');
    } catch (err) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6 max-w-2xl" data-testid="settings-page">
      <div>
        <h1 className="text-4xl font-heading font-bold text-primary flex items-center gap-3">
          <Settings size={32} />App Settings
        </h1>
        <p className="text-muted-foreground mt-1">Customize the application appearance and branding</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Type size={18} />Branding</CardTitle>
          <CardDescription>Change the app name and tagline</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>App Name</Label>
            <Input value={settings.app_name} onChange={e => setSettings(s => ({ ...s, app_name: e.target.value }))} data-testid="settings-app-name" />
          </div>
          <div className="space-y-1">
            <Label>Tagline</Label>
            <Input value={settings.tagline} onChange={e => setSettings(s => ({ ...s, tagline: e.target.value }))} data-testid="settings-tagline" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Image size={18} />Logo</CardTitle>
          <CardDescription>Logo URL used on login page and sidebar</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Logo URL</Label>
              <Input value={settings.logo_url} onChange={e => setSettings(s => ({ ...s, logo_url: e.target.value }))} placeholder="/sp-logo.png or https://..." data-testid="settings-logo-url" />
            </div>
            {settings.logo_url && (
              <div className="p-4 bg-muted rounded-lg flex items-center justify-center">
                <img src={settings.logo_url} alt="Logo Preview" className="h-16 object-contain" onError={e => e.target.style.display = 'none'} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Film size={18} />Login Background</CardTitle>
          <CardDescription>Background video shown on the login page</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <Label>Background Video URL</Label>
            <Input value={settings.bg_video_url} onChange={e => setSettings(s => ({ ...s, bg_video_url: e.target.value }))} placeholder="/bg-video.mp4 or https://..." data-testid="settings-bg-video" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Palette size={18} />Theme</CardTitle>
          <CardDescription>Customize the primary color</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="space-y-1 flex-1">
              <Label>Primary Color</Label>
              <Input value={settings.primary_color} onChange={e => setSettings(s => ({ ...s, primary_color: e.target.value }))} data-testid="settings-color" />
            </div>
            <div className="w-12 h-12 rounded-lg border" style={{ backgroundColor: settings.primary_color }} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} size="lg" className="w-full" disabled={saving} data-testid="settings-save">
        {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
        Save Settings
      </Button>
    </div>
  );
}
