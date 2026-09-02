
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Clock } from 'lucide-react';

const WaitingRoom = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { room, vendor } = location.state || {};
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!room) { navigate('/vendor/login'); return; }
    const update = () => {
      const diff = Math.max(0, Math.floor((new Date(room.startTime) - new Date()) / 1000));
      setSecondsLeft(diff);
      if (diff === 0) navigate('/room/' + room._id, { replace: true });
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [room, navigate]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-10 max-w-md w-full text-center">
        <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <Clock className="w-10 h-10 text-blue-600 animate-pulse" />
        </div>
        <h1 className="text-2xl font-black text-slate-900 mb-2">Waiting Room</h1>
        <p className="text-slate-500 text-sm mb-8">
          Welcome, <strong>{vendor?.companyName}</strong>. The auction for <strong>{room?.product?.name}</strong> will begin shortly.
        </p>
        <div className="bg-slate-900 text-white rounded-xl px-8 py-6 mb-6 inline-block">
          <p className="text-xs uppercase tracking-widest text-slate-400 mb-2">Starts in</p>
          <p className="text-5xl font-black tracking-widest font-mono">{mm}:{ss}</p>
        </div>
        <p className="text-xs text-slate-400">You will be automatically redirected when the auction starts.</p>
        <div className="mt-8 pt-6 border-t border-slate-100 text-xs text-slate-400 space-y-1">
          <p>Start: {new Date(room?.startTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
          <p>End: {new Date(room?.endTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
          <p>Base Price: Rs. {Number(room?.basePrice || 0).toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
};

export default WaitingRoom;
