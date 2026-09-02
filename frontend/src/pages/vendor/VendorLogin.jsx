
import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { LogIn, Mail, Lock, AlertCircle } from 'lucide-react';

const VendorLogin = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [gateMsg, setGateMsg] = useState(null);
  const navigate = useNavigate();

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setGateMsg(null);
    try {
      // Try admin login first
      try {
        const adminRes = await axios.post('http://localhost:5000/api/admin/login', {
          username: formData.email, password: formData.password
        });
        localStorage.setItem('adminToken', adminRes.data.token);
        toast.success('Admin login successful!');
        navigate('/admin');
        return;
      } catch { /* not admin, try vendor */ }

      // Vendor auction login
      const res = await axios.post('http://localhost:5000/api/vendor/login', formData);
      localStorage.setItem('vendorToken', res.data.token);
      localStorage.setItem('vendorId', res.data.vendor._id);

      if (res.data.waitingRoom) {
        toast.success('Logged in! Taking you to the waiting room...');
        navigate('/vendor/waiting', { state: { room: res.data.room, vendor: res.data.vendor } });
      } else {
        toast.success('Logged in! Entering auction...');
        navigate('/room/' + res.data.room._id);
      }
    } catch (err) {
      const msg = err.response?.data?.message;
      if (err.response?.status === 403 && err.response?.data?.minutesToStart) {
        setGateMsg({ minutesToStart: err.response.data.minutesToStart, startTime: err.response.data.startTime, msg });
      } else {
        toast.error(msg || 'Invalid credentials. Please check your email and password.');
      }
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">BID ON</h1>
          <p className="text-slate-500 text-sm mt-2">Enter your auction credentials to proceed</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center">
              <LogIn className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900">Welcome Back</h2>
              <p className="text-xs text-slate-400">Use the credentials from your auction invite email</p>
            </div>
          </div>

          {gateMsg && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 flex gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-800">Auction not yet open</p>
                <p className="text-xs text-amber-700 mt-1">{gateMsg.msg}</p>
                <p className="text-xs text-amber-600 mt-1">
                  Starts: {new Date(gateMsg.startTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  <br/>Please try again {gateMsg.minutesToStart > 5 ? 'in ' + (gateMsg.minutesToStart - 5) + ' minutes' : 'shortly'}.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email" name="email" value={formData.email} onChange={handleChange} required
                  placeholder="yourname@company.com"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-slate-900 font-medium text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Auction Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password" name="password" value={formData.password} onChange={handleChange} required
                  placeholder="5-character code from invite email"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-slate-900 font-medium text-sm"
                />
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-700 text-white font-bold py-3.5 px-4 rounded-xl transition active:scale-[0.98] disabled:opacity-60 mt-2">
              {loading ? 'Verifying...' : 'Sign In to Auction'}
            </button>
          </form>

          <p className="text-xs text-slate-400 text-center mt-6">
            Your credentials are sent via email when you are invited to an auction. Contact your procurement team if you have not received them.
          </p>
        </div>
      </div>
    </div>
  );
};

export default VendorLogin;
