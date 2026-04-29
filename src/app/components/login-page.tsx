import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useAuth } from '../contexts/auth-context';
import { AlertCircle, FlaskConical } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const success = login(email, password);
    if (!success) {
      setError('Invalid email or password');
    }
  };

  const quickLogin = (userEmail: string, userPassword: string) => {
    setEmail(userEmail);
    setPassword(userPassword);
    login(userEmail, userPassword);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-slate-100 flex items-center justify-center p-6">
      <div className="max-w-5xl w-full grid md:grid-cols-2 gap-8">
        {/* Login Form */}
        <Card className="shadow-2xl">
          <CardHeader className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center">
                <FlaskConical className="size-7 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl">ISSF Platform</CardTitle>
                <p className="text-sm text-slate-600">Sign in to continue</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700">
                Sign In
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Demo Accounts */}
        <div className="space-y-4">
          <Card className="bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-200">
            <CardHeader>
              <CardTitle className="text-lg">Demo Accounts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <button
                onClick={() => quickLogin('panelist1@example.com', 'demo123')}
                className="w-full p-3 bg-blue-50 rounded-lg border border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-all cursor-pointer text-left"
              >
                <div className="font-bold text-blue-900 mb-1">Panelist Account</div>
                <div className="text-sm text-blue-700 space-y-1">
                  <div>Email: <span className="font-mono">panelist1@example.com</span></div>
                  <div>Password: <span className="font-mono">demo123</span></div>
                  <div className="text-xs mt-2 italic">Access: Fill out questionnaires only</div>
                </div>
                <div className="text-xs font-semibold text-blue-600 mt-2">Click to login →</div>
              </button>

              <button
                onClick={() => quickLogin('developer@example.com', 'demo123')}
                className="w-full p-3 bg-emerald-50 rounded-lg border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 transition-all cursor-pointer text-left"
              >
                <div className="font-bold text-emerald-900 mb-1">Developer Account</div>
                <div className="text-sm text-emerald-700 space-y-1">
                  <div>Email: <span className="font-mono">developer@example.com</span></div>
                  <div>Password: <span className="font-mono">demo123</span></div>
                  <div className="text-xs mt-2 italic">Access: Analysis, testing & comparison views</div>
                </div>
                <div className="text-xs font-semibold text-emerald-600 mt-2">Click to login →</div>
              </button>

              <button
                onClick={() => quickLogin('admin@example.com', 'demo123')}
                className="w-full p-3 bg-purple-50 rounded-lg border border-purple-200 hover:bg-purple-100 hover:border-purple-300 transition-all cursor-pointer text-left"
              >
                <div className="font-bold text-purple-900 mb-1">Administrator Account</div>
                <div className="text-sm text-purple-700 space-y-1">
                  <div>Email: <span className="font-mono">admin@example.com</span></div>
                  <div>Password: <span className="font-mono">demo123</span></div>
                  <div className="text-xs mt-2 italic">Access: Full system access + configuration</div>
                </div>
                <div className="text-xs font-semibold text-purple-600 mt-2">Click to login →</div>
              </button>
            </CardContent>
          </Card>

          <Card className="bg-slate-50 border border-slate-200">
            <CardContent className="pt-4 text-xs text-slate-600">
              <p className="font-bold mb-2">Role Permissions:</p>
              <ul className="space-y-1">
                <li>• <strong>Panelists:</strong> Fill out questionnaires only</li>
                <li>• <strong>Developer:</strong> Analysis, machine testing & comparison views</li>
                <li>• <strong>Admin:</strong> Full access including product configuration</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}