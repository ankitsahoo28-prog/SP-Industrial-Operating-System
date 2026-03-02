import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { settingsApi, authApi } from '@/lib/api';
import { LogIn, UserPlus, KeyRound, ArrowLeft, Loader2 } from 'lucide-react';

export default function Login() {
  const [mode, setMode] = useState('login'); // login, register, forgot, reset
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('ground_staff');
  const [businessType, setBusinessType] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [appSettings, setAppSettings] = useState(null);
  const { user, login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    settingsApi.get().then(r => setAppSettings(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (user && user.role) {
      switch (user.role) {
        case 'director': navigate('/director', { replace: true }); break;
        case 'manager': navigate('/manager', { replace: true }); break;
        case 'ground_staff': navigate('/ground-staff', { replace: true }); break;
        default: break;
      }
    }
  }, [user, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const result = await login(email, password);
    if (result.success) {
      toast.success('Welcome back!');
    } else {
      toast.error(result.error || 'Login failed');
    }
    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.selfRegister({
        email, password, name, phone,
        role, business_type: businessType || null,
      });
      toast.success('Account created! Awaiting Director approval.');
      setMode('login');
      setName(''); setPhone(''); setRole('ground_staff'); setBusinessType('');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registration failed');
    } finally { setLoading(false); }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authApi.forgotPassword(email);
      if (res.data.reset_token) {
        setResetToken(res.data.reset_token);
        setMode('reset');
        toast.success('Reset token generated. Enter it below with your new password.');
      } else {
        toast.success('If the email exists, instructions have been sent');
      }
    } catch { toast.error('Request failed'); }
    finally { setLoading(false); }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.resetPassword(resetToken, newPassword);
      toast.success('Password reset! You can now log in.');
      setMode('login');
      setResetToken(''); setNewPassword('');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Reset failed');
    } finally { setLoading(false); }
  };

  const logoUrl = appSettings?.logo_url || '/sp-logo.png';
  const bgVideo = appSettings?.bg_video_url || '/bg-video.mp4';

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden" data-testid="login-page">
      <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover" data-testid="login-bg-video">
        <source src={bgVideo} type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-gradient-to-br from-black/50 via-black/35 to-slate-900/50" />

      <div className="relative z-10 w-full max-w-md px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center bg-white rounded-2xl mb-6 px-12 py-6 shadow-2xl">
            <img src={logoUrl} alt={appSettings?.app_name || 'SP Group'} className="h-28 w-auto object-contain" data-testid="login-logo" />
          </div>
        </div>

        <Card className="shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-2xl font-heading">
              {mode === 'login' && 'Welcome Back'}
              {mode === 'register' && 'Create Account'}
              {mode === 'forgot' && 'Forgot Password'}
              {mode === 'reset' && 'Reset Password'}
            </CardTitle>
            <CardDescription>
              {mode === 'login' && (appSettings?.tagline || 'Sign in to access your dashboard')}
              {mode === 'register' && 'Your account will need Director approval'}
              {mode === 'forgot' && 'Enter your email to receive a reset link'}
              {mode === 'reset' && 'Enter the token and your new password'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* LOGIN FORM */}
            {mode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2"><Label>Email</Label><Input type="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} required data-testid="email-input" /></div>
                <div className="space-y-2"><Label>Password</Label><Input type="password" placeholder="--------" value={password} onChange={e => setPassword(e.target.value)} required data-testid="password-input" /></div>
                <Button type="submit" className="w-full bg-accent hover:bg-accent/90" disabled={loading} data-testid="login-button">
                  {loading ? <Loader2 size={18} className="animate-spin mr-2" /> : <LogIn size={18} className="mr-2" />}
                  {loading ? 'Signing in...' : 'Sign In'}
                </Button>
                <div className="flex justify-between text-sm">
                  <button type="button" className="text-primary hover:underline" onClick={() => setMode('forgot')} data-testid="forgot-password-link">Forgot Password?</button>
                  <button type="button" className="text-primary hover:underline" onClick={() => setMode('register')} data-testid="create-account-link">Create Account</button>
                </div>
              </form>
            )}

            {/* REGISTER FORM */}
            {mode === 'register' && (
              <form onSubmit={handleRegister} className="space-y-3">
                <div className="space-y-1"><Label>Full Name</Label><Input value={name} onChange={e => setName(e.target.value)} required data-testid="register-name" /></div>
                <div className="space-y-1"><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} required data-testid="register-email" /></div>
                <div className="space-y-1"><Label>Phone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} data-testid="register-phone" /></div>
                <div className="space-y-1"><Label>Password</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} required data-testid="register-password" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Role</Label>
                    <Select value={role} onValueChange={setRole}>
                      <SelectTrigger data-testid="register-role"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="ground_staff">Ground Staff</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Business</Label>
                    <Select value={businessType} onValueChange={setBusinessType}>
                      <SelectTrigger data-testid="register-business"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="petrol_pump">Petrol Pump</SelectItem>
                        <SelectItem value="hotel">Hotel</SelectItem>
                        <SelectItem value="fl_shop">FL Shop</SelectItem>
                        <SelectItem value="transport">Transport</SelectItem>
                        <SelectItem value="slag_crushing">Slag Crushing</SelectItem>
                        <SelectItem value="stone_crusher">Stone Crusher</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading} data-testid="register-submit">
                  {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : <UserPlus size={16} className="mr-2" />}
                  Create Account
                </Button>
                <button type="button" className="text-sm text-primary hover:underline flex items-center gap-1" onClick={() => setMode('login')} data-testid="back-to-login"><ArrowLeft size={14} />Back to Sign In</button>
              </form>
            )}

            {/* FORGOT PASSWORD FORM */}
            {mode === 'forgot' && (
              <form onSubmit={handleForgot} className="space-y-4">
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} required data-testid="forgot-email" /></div>
                <Button type="submit" className="w-full" disabled={loading} data-testid="forgot-submit">
                  {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : <KeyRound size={16} className="mr-2" />}
                  Send Reset Token
                </Button>
                <button type="button" className="text-sm text-primary hover:underline flex items-center gap-1" onClick={() => setMode('login')}><ArrowLeft size={14} />Back to Sign In</button>
              </form>
            )}

            {/* RESET PASSWORD FORM */}
            {mode === 'reset' && (
              <form onSubmit={handleReset} className="space-y-4">
                <div className="space-y-2"><Label>Reset Token</Label><Input value={resetToken} onChange={e => setResetToken(e.target.value)} required data-testid="reset-token" /></div>
                <div className="space-y-2"><Label>New Password</Label><Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required data-testid="reset-password" /></div>
                <Button type="submit" className="w-full" disabled={loading} data-testid="reset-submit">
                  {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : <KeyRound size={16} className="mr-2" />}
                  Reset Password
                </Button>
                <button type="button" className="text-sm text-primary hover:underline flex items-center gap-1" onClick={() => setMode('login')}><ArrowLeft size={14} />Back to Sign In</button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
