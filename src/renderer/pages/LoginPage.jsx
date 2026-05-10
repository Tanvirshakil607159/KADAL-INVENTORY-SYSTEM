import React, { useState } from 'react';
import useStore from '../store/useStore';
import { Lock, User, LogIn, ShieldCheck, Box } from 'lucide-react';

export default function LoginPage() {
  const { setUser, addToast } = useStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [regForm, setRegForm] = useState({ username: '', fullName: '', password: '', confirm: '' });

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      addToast('error', 'Please enter username and password');
      return;
    }

    setLoading(true);
    try {
      const res = await window.kadal.auth.login(username, password);
      if (res.success) {
        setUser(res.data.user);
        addToast('success', `Welcome back, ${res.data.user.fullName}!`);
      } else {
        addToast('error', res.error || 'Invalid credentials');
      }
    } catch (err) {
      addToast('error', 'An error occurred during login');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!regForm.username || !regForm.fullName || !regForm.password) {
      addToast('error', 'All fields are required');
      return;
    }
    if (regForm.password !== regForm.confirm) {
      addToast('error', 'Passwords do not match');
      return;
    }
    
    setLoading(true);
    try {
      const res = await window.kadal.auth.register(regForm.username, regForm.password, regForm.fullName);
      if (res.success) {
        addToast('success', 'Registration successful! Please wait for Admin approval.');
        setIsRegister(false);
      } else {
        addToast('error', res.error);
      }
    } catch (err) {
      addToast('error', 'Failed to register');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-bg-elements">
        <div className="floating-shape shape-1"></div>
        <div className="floating-shape shape-2"></div>
        <div className="floating-shape shape-3"></div>
      </div>
      
      <div className="login-card-container">
        <div className="login-card-glass">
          <div className="login-header">
            <div className="brand-icon-wrapper">
              <Box size={38} className="brand-icon" />
            </div>
            <div className="brand-text">
              <h1>KADAL</h1>
              <span>Inventory Management</span>
            </div>
          </div>

          <div className="login-welcome">
            <h2>{isRegister ? 'Create Account' : 'Welcome Back'}</h2>
            <p>{isRegister ? 'Enter your details to register a new account' : 'Please enter your credentials to access your dashboard'}</p>
          </div>

          <form className="login-form-modern" onSubmit={isRegister ? handleRegister : handleLogin}>
            {isRegister ? (
              <>
                <div className="input-group-modern">
                  <label>Full Name</label>
                  <div className="input-wrapper-modern">
                    <ShieldCheck size={18} className="input-icon" />
                    <input 
                      type="text" 
                      placeholder="John Doe"
                      value={regForm.fullName}
                      onChange={(e) => setRegForm({...regForm, fullName: e.target.value})}
                      required
                    />
                  </div>
                </div>

                <div className="input-group-modern">
                  <label>Username</label>
                  <div className="input-wrapper-modern">
                    <User size={18} className="input-icon" />
                    <input 
                      type="text" 
                      placeholder="johndoe"
                      value={regForm.username}
                      onChange={(e) => setRegForm({...regForm, username: e.target.value})}
                      required
                    />
                  </div>
                </div>

                <div className="input-group-modern">
                  <label>Password</label>
                  <div className="input-wrapper-modern">
                    <Lock size={18} className="input-icon" />
                    <input 
                      type="password" 
                      placeholder="••••••••"
                      value={regForm.password}
                      onChange={(e) => setRegForm({...regForm, password: e.target.value})}
                      required
                    />
                  </div>
                </div>

                <div className="input-group-modern">
                  <label>Confirm Password</label>
                  <div className="input-wrapper-modern">
                    <Lock size={18} className="input-icon" />
                    <input 
                      type="password" 
                      placeholder="••••••••"
                      value={regForm.confirm}
                      onChange={(e) => setRegForm({...regForm, confirm: e.target.value})}
                      required
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="input-group-modern">
                  <label>Username</label>
                  <div className="input-wrapper-modern">
                    <User size={18} className="input-icon" />
                    <input 
                      type="text" 
                      placeholder="admin"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>

                <div className="input-group-modern">
                  <label>Password</label>
                  <div className="input-wrapper-modern">
                    <Lock size={18} className="input-icon" />
                    <input 
                      type="password" 
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}

            <button 
              type="submit" 
              className={`login-submit-btn ${loading ? 'loading' : ''}`}
              disabled={loading}
            >
              {loading ? (
                <div className="spinner-small"></div>
              ) : (
                <>
                  <span>{isRegister ? 'Register' : 'Sign In'}</span>
                  <LogIn size={20} />
                </>
              )}
            </button>
          </form>

          <div className="login-switch-mode">
            <button className="btn-link" onClick={() => setIsRegister(!isRegister)}>
              {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Create one"}
            </button>
          </div>

          <div className="login-footer-modern">
            <div className="footer-line"></div>
            <p>© 2026 KA Design Accessories LTD</p>
            <div className="system-status">
              <div className="status-dot"></div>
              <span>System Secure</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
