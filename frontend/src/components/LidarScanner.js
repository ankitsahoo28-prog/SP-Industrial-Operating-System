import { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { invApi } from '@/lib/api';
import { toast } from 'sonner';
import { ScanLine, Calculator, Loader2, Camera, CameraOff, Aperture } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function LidarScanner({ items, onComplete }) {
  const [mode, setMode] = useState('dimensions');
  const [itemId, setItemId] = useState('');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [volume, setVolume] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const calculatedVolume = mode === 'dimensions' && length && width && height
    ? (parseFloat(length) * parseFloat(width) * parseFloat(height)).toFixed(3)
    : volume;

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
      setCapturedImage(null);
      toast.success('Camera activated');
    } catch (err) {
      toast.error('Camera access denied or unavailable');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedImage(dataUrl);
    toast.success('Photo captured - enter dimensions based on your measurement');
  }, []);

  const handleScan = async (e) => {
    e.preventDefault();
    const vol = parseFloat(calculatedVolume);
    if (!itemId || !vol || vol <= 0) {
      toast.error('Please fill all fields');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await invApi.recordLidarScan({ item_id: itemId, volume_m3: vol, notes });
      setResult(res.data);
      toast.success('Scan recorded successfully');
      stopCamera();
      if (onComplete) onComplete();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Scan failed');
    } finally {
      setLoading(false);
    }
  };

  const bulkItems = (items || []).filter(i =>
    ['slag_crushing', 'stone_crusher'].includes(i.business_type) &&
    ['raw_materials', 'finished_goods'].includes(i.category)
  );

  return (
    <Card data-testid="lidar-scanner">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ScanLine size={20} />Stock Volume Measurement</CardTitle>
        <CardDescription>Use camera to capture stockpile, then enter dimensions to estimate weight</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Camera Section */}
        <div className="rounded-lg border border-dashed p-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium flex items-center gap-2"><Camera size={16} />Camera Assist</p>
            {!cameraActive ? (
              <Button size="sm" variant="outline" onClick={startCamera} data-testid="start-camera-btn">
                <Camera size={14} className="mr-1" />Open Camera
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" variant="default" onClick={capturePhoto} data-testid="capture-btn">
                  <Aperture size={14} className="mr-1" />Capture
                </Button>
                <Button size="sm" variant="outline" onClick={stopCamera} data-testid="stop-camera-btn">
                  <CameraOff size={14} className="mr-1" />Close
                </Button>
              </div>
            )}
          </div>

          {cameraActive && (
            <div className="relative rounded-lg overflow-hidden bg-black aspect-video max-h-[300px]">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" data-testid="camera-video" />
              {/* Overlay grid for measurement reference */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="w-full h-full border border-white/20 grid grid-cols-3 grid-rows-3">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="border border-white/10" />
                  ))}
                </div>
                <div className="absolute bottom-2 left-2 text-white/70 text-xs bg-black/40 px-2 py-1 rounded">
                  Live - Position device for measurement
                </div>
              </div>
            </div>
          )}

          {capturedImage && (
            <div className="rounded-lg overflow-hidden border">
              <img src={capturedImage} alt="Captured stockpile" className="w-full max-h-[200px] object-cover" data-testid="captured-image" />
              <div className="p-2 bg-muted text-xs text-muted-foreground text-center">
                Reference photo captured. Enter measurements below.
              </div>
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Mode Toggle */}
        <div className="flex gap-2">
          <Button variant={mode === 'dimensions' ? 'default' : 'outline'} size="sm" onClick={() => setMode('dimensions')} data-testid="mode-dimensions">
            <Calculator size={14} className="mr-1" />By Dimensions
          </Button>
          <Button variant={mode === 'volume' ? 'default' : 'outline'} size="sm" onClick={() => setMode('volume')} data-testid="mode-volume">
            Direct Volume
          </Button>
        </div>

        <form onSubmit={handleScan} className="space-y-3">
          <div className="space-y-1">
            <Label>Select Item</Label>
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger data-testid="lidar-item"><SelectValue placeholder="Choose stockpile item" /></SelectTrigger>
              <SelectContent>
                {bulkItems.map(i => <SelectItem key={i.id} value={i.id}>{i.name} ({i.business_type}) - {i.current_stock} {i.unit}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {mode === 'dimensions' ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>Length (m)</Label>
                  <Input type="number" step="0.01" value={length} onChange={e => setLength(e.target.value)} required data-testid="lidar-length" />
                </div>
                <div className="space-y-1">
                  <Label>Width (m)</Label>
                  <Input type="number" step="0.01" value={width} onChange={e => setWidth(e.target.value)} required data-testid="lidar-width" />
                </div>
                <div className="space-y-1">
                  <Label>Height (m)</Label>
                  <Input type="number" step="0.01" value={height} onChange={e => setHeight(e.target.value)} required data-testid="lidar-height" />
                </div>
              </div>
              {calculatedVolume > 0 && (
                <div className="p-3 bg-muted rounded-lg text-sm flex items-center gap-2">
                  <Calculator size={14} />
                  Calculated Volume: <strong>{calculatedVolume} m³</strong>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-1">
              <Label>Volume (m³)</Label>
              <Input type="number" step="0.001" value={volume} onChange={e => setVolume(e.target.value)} required data-testid="lidar-volume" />
            </div>
          )}

          <div className="space-y-1">
            <Label>Notes</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Location, measurement conditions..." data-testid="lidar-notes" />
          </div>

          <Button type="submit" className="w-full" disabled={loading} data-testid="lidar-submit">
            {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : <ScanLine size={16} className="mr-2" />}
            Record Measurement
          </Button>
        </form>

        {result && (
          <div className="rounded-lg border p-4 space-y-2 bg-muted/30">
            <p className="font-medium">Measurement Result: {result.item_name}</p>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div><span className="text-muted-foreground">Volume</span><p className="font-mono font-bold">{result.volume_m3} m³</p></div>
              <div><span className="text-muted-foreground">Scanned Weight</span><p className="font-mono font-bold">{result.scanned_weight_mt} MT</p></div>
              <div><span className="text-muted-foreground">System Stock</span><p className="font-mono font-bold">{result.system_stock_mt} MT</p></div>
            </div>
            <div className={`p-2 rounded text-sm font-medium ${result.variance_mt >= 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
              Variance: {result.variance_mt > 0 ? '+' : ''}{result.variance_mt} MT ({result.variance_pct}%)
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
