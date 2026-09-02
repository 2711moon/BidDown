import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { ArrowRight, Inbox, Clock, LogOut } from 'lucide-react';

const VendorDashboard = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDashboard = async () => {
      const vendorId = localStorage.getItem('vendorId');
      if (!vendorId) {
        navigate('/vendor/login');
        return;
      }
      
      try {
        const res = await axios.get(`http://localhost:5000/api/vendor/dashboard?vendorId=${vendorId}`);
        setRooms(res.data);
      } catch (err) {
        toast.error('Failed to load your dashboard');
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('vendorId');
    localStorage.removeItem('vendorToken');
    navigate('/vendor/login');
  };

  if (loading) {
    return <div className="p-20 text-center animate-pulse text-indigo-400 font-bold text-xl">Loading your auctions...</div>;
  }

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-10 bg-gradient-to-r from-indigo-900 to-purple-900 p-8 rounded-3xl shadow-2xl shadow-indigo-900/20">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Your Procurement Portal</h1>
          <p className="text-indigo-200 mt-2">Manage your active and upcoming reverse auctions.</p>
        </div>
        <button onClick={handleLogout} className="bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-xl transition flex items-center backdrop-blur-md font-medium border border-white/10">
          <LogOut className="w-4 h-4 mr-2" /> Sign Out
        </button>
      </div>

      <div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center">
          <Inbox className="w-5 h-5 mr-2 text-indigo-500" /> Auction Invitations
        </h2>

        {rooms.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-xl border border-slate-100 dark:border-zinc-800 p-16 text-center">
            <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Inbox className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">No Active Invitations</h3>
            <p className="text-slate-500 dark:text-zinc-400 max-w-md mx-auto">You have not been invited to any upcoming reverse auctions. You will be notified by email when the Admin invites you to a new room.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map(room => {
              const start = new Date(room.startTime);
              const isFuture = start > new Date();
              
              return (
                <div key={room._id} className="bg-white dark:bg-zinc-900 rounded-3xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border border-slate-100 dark:border-zinc-800 overflow-hidden flex flex-col group">
                  <div className={`h-2 w-full ${isFuture ? 'bg-amber-400' : 'bg-emerald-500'}`}></div>
                  <div className="p-8 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-6">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${isFuture ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
                        {isFuture ? 'Upcoming' : room.status}
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-400 dark:text-zinc-500">#{room._id.slice(-6)}</span>
                    </div>
                    
                    <h3 className="font-bold text-xl text-slate-900 dark:text-white mb-2 line-clamp-1">
                      {room.product?.name || 'Unknown Product'}
                    </h3>
                    
                    <div className="mt-4 space-y-3 mb-8">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500 dark:text-zinc-400">Opening Price</span>
                        <span className="font-bold text-slate-700 dark:text-zinc-300">₹{room.basePrice.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500 dark:text-zinc-400">Scheduled Time</span>
                        <span className="font-bold text-slate-700 dark:text-zinc-300 flex items-center">
                          <Clock className="w-3 h-3 mr-1" /> {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => navigate(`/room/${room._id}`)}
                      className="mt-auto w-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500 dark:hover:text-white border border-indigo-100 dark:border-indigo-900/50 py-3 rounded-xl font-bold transition flex items-center justify-center group-hover:shadow-lg shadow-indigo-200"
                    >
                      {isFuture ? 'Enter Waiting Room' : 'Join Live Auction'} <ArrowRight className="w-4 h-4 ml-2" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default VendorDashboard;