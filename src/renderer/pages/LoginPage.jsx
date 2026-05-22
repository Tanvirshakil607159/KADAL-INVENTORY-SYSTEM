import React, { useState, useEffect } from 'react';
import useStore from '../store/useStore';
import { Lock, User, LogIn, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import logo from '../assets/logo.png';

export default function LoginPage() {
  const { setUser, addToast } = useStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [regForm, setRegForm] = useState({ username: '', fullName: '', password: '', confirm: '' });

  // Autofill logic for Remember Me
  useEffect(() => {
    const savedData = localStorage.getItem('remembered_login');
    if (savedData) {
      try {
        const { u, p, role } = JSON.parse(savedData);
        // Only autofill for normal users, NOT Admin or Super Admin
        if (role !== 'Admin' && role !== 'Super Admin') {
          setUsername(u);
          setPassword(p);
          setRememberMe(true);
        } else {
          // Just set the username for admins to be helpful, but not the password
          setUsername(u);
        }
      } catch (e) {}
    }
  }, []);

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
        const user = res.data.user;
        setUser(user);
        
        if (rememberMe) {
          // Save credentials ONLY if NOT admin/superadmin
          if (user.roleName !== 'Admin' && user.roleName !== 'Super Admin') {
            localStorage.setItem('remembered_login', JSON.stringify({ u: username, p: password, role: user.roleName }));
          } else {
            // For admins, just save the username if they really want to be "remembered" but we won't autofill password
            localStorage.setItem('remembered_login', JSON.stringify({ u: username, role: user.roleName }));
          }
        } else {
          localStorage.removeItem('remembered_login');
        }

        addToast('success', `Welcome back, ${user.fullName}!`);
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

  const [version, setVersion] = useState('');
  useEffect(() => {
    window.kadal.system.getVersion().then(res => {
      if (res.success) setVersion(res.data);
    });
  }, []);

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
              <img src={logo} alt="KADAL Logo" className="brand-icon" />
            </div>
            <div className="brand-text">
              <h1> KADAL </h1>
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
                      onChange={(e) => setRegForm({ ...regForm, fullName: e.target.value })}
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
                      onChange={(e) => setRegForm({ ...regForm, username: e.target.value })}
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
                      onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
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
                      onChange={(e) => setRegForm({ ...regForm, confirm: e.target.value })}
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
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button 
                      type="button" 
                      className="password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex="-1"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="login-options">
                  <label className="remember-me">
                    <input 
                      type="checkbox" 
                      checked={rememberMe} 
                      onChange={(e) => setRememberMe(e.target.checked)} 
                    />
                    <span>Remember Me</span>
                  </label>
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
            <p>© 2026 KA Design Accessories LTD <span className="app-version" style={{ opacity: 0.5, marginLeft: '8px' }}>v{version}</span></p>
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
