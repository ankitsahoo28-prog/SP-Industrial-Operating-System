import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { settingsApi, uploadApi } from '@/lib/api';
import { API } from '@/lib/api';
import { toast } from 'sonner';
import { Settings, Save, Palette, Type, Image, Film, Loader2, Upload, X, CheckCircle } from 'lucide-react';

function FileUploadField({ label, description, currentUrl, onUpload, accept, category, testId }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadApi.upload(file, category);
      const fullUrl = res.data.url;
      onUpload(fullUrl);
      toast.success(`${label} uploaded successfully`);
    } catch (err) {
      toast.error(`Failed to upload ${label.toLowerCase()}`);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const resolveUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    if (url.startsWith('/api/')) return `${API.replace('/api', '')}${url}`;
    return url;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Input value={currentUrl || ''} onChange={(e) => onUpload(e.target.value)} placeholder={`URL or upload a file`} data-testid={`${testId}-url`} />
        </div>
        <div className="relative">
          <input type="file" accept={accept} onChange={handleFile} ref={inputRef} className="hidden" />
          <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()} data-testid={`${testId}-upload`}>
            {uploading ? <Loader2 size={14} className="animate-spin mr-1" /> : <Upload size={14} className="mr-1" />}
            Upload
          </Button>
        </div>
      </div>
      {currentUrl && (
        <div className="p-3 bg-muted rounded-lg">
          {accept.includes('image') ? (
            <img src={resolveUrl(currentUrl)} alt={`${label} preview`} className="h-20 object-contain rounded"
              onError={(e) => { e.target.style.display = 'none'; }} />
          ) : accept.includes('video') ? (
            <video src={resolveUrl(currentUrl)} className="h-24 rounded" controls muted />
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle size={14} className="text-success" />File set: {currentUrl}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    app_name: 'SP GROUP', logo_url: '/sp-logo.png',
    bg_video_url: '/bg-video.mp4', primary_color: '#1a1a2e',
    tagline: 'Industrial Operating System',
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    settingsApi.get().then(r => setSettings(prev => ({ ...prev, ...r.data }))).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await settingsApi.update(settings);
      setSettings(prev => ({ ...prev, ...res.data }));
      toast.success('Settings saved successfully');
    } catch { toast.error('Failed to save settings'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="animate-spin h-12 w-12 text-primary" /></div>;

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
          <CardDescription>Upload a logo image or provide a URL</CardDescription>
        </CardHeader>
        <CardContent>
          <FileUploadField label="Logo" currentUrl={settings.logo_url}
            onUpload={(url) => setSettings(s => ({ ...s, logo_url: url }))}
            accept="image/*" category="logo" testId="settings-logo" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Film size={18} />Login Background</CardTitle>
          <CardDescription>Upload a background video or image for the login page</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm mb-2 block">Background Video</Label>
            <FileUploadField label="Background Video" currentUrl={settings.bg_video_url}
              onUpload={(url) => setSettings(s => ({ ...s, bg_video_url: url }))}
              accept="video/mp4,video/webm" category="bg-video" testId="settings-bg-video" />
          </div>
          <div>
            <Label className="text-sm mb-2 block">Background Image (fallback)</Label>
            <FileUploadField label="Background Image" currentUrl={settings.bg_image_url}
              onUpload={(url) => setSettings(s => ({ ...s, bg_image_url: url }))}
              accept="image/*" category="bg-image" testId="settings-bg-image" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Palette size={18} />Theme Color</CardTitle>
          <CardDescription>Customize the primary brand color</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="space-y-1 flex-1">
              <Label>Primary Color</Label>
              <div className="flex gap-2">
                <Input value={settings.primary_color} onChange={e => setSettings(s => ({ ...s, primary_color: e.target.value }))} data-testid="settings-color" className="flex-1" />
                <input type="color" value={settings.primary_color} onChange={e => setSettings(s => ({ ...s, primary_color: e.target.value }))} className="w-12 h-10 rounded border cursor-pointer" />
              </div>
            </div>
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
