import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import AdminDashboard from './pages/admin/AdminDashboard';
import AdminRoomView from './pages/admin/AdminRoomView';
import BiddingRoom from './pages/vendor/BiddingRoom';
import CreateRoom from './pages/admin/CreateRoom';
import VendorLogin from './pages/vendor/VendorLogin';
import VendorDashboard from './pages/vendor/VendorDashboard';
import WaitingRoom from './pages/vendor/WaitingRoom';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-100 text-slate-900">
        <Toaster position="top-right" toastOptions={{ style: { borderRadius: '10px', background: '#fff', color: '#111' } }} />
        <Routes>
          <Route path="/" element={<Navigate to="/vendor/login" />} />
          <Route path="/vendor/login" element={<VendorLogin />} />
          <Route path="/vendor/dashboard" element={<VendorDashboard />} />
          <Route path="/vendor/waiting" element={<WaitingRoom />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/create-room" element={<CreateRoom />} />
          <Route path="/admin/room/:id" element={<AdminRoomView />} />
          <Route path="/room/:id" element={<BiddingRoom />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
