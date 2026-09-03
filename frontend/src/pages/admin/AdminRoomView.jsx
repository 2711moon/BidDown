import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import {
  ChevronLeft, Activity, Clock, TrendingDown, Users, Package,
  AlertCircle, CheckCircle, Download, StopCircle, Crown, RefreshCw, Timer, X
} from 'lucide-react';

const AdminRoomView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [bids, setBids] = useState([]);
  const [timeLeft, setTimeLeft] = useState('');
  const [isEndingSoon, setIsEndingSoon] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const [endTime, setEndTime] = useState(null);
  const [extendMinutes, setExtendMinutes] = useState('5');
  const [extendLoading, setExtendLoading] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenDuration, setReopenDuration] = useState('30');
  const [reopenVendors, setReopenVendors] = useState([]);
  const [allVendors, setAllVendors] = useState([]);
  const [reopenLoading, setReopenLoading] = useState(false);
  const socketRef = useRef(null);
  const bidFeedRef = useRef(null);

  useEffect(() => {
    const fetchAndConnect = async () => {
      try {
        const token = localStorage.getItem('adminToken');
        const res = await axios.get('http://172.16.100.174:5000/api/admin/rooms/' + id, {
          headers: { Authorization: 'Bearer ' + token }
        });
        setRoom(res.data.room);
        setBids(res.data.bids || []);
        setEndTime(new Date(res.data.room.endTime));
        setLoading(false);

        // Connect socket as admin observer
        const socket = io('http://172.16.100.174:5000');
        socketRef.current = socket;

        socket.on('connect', () => {
          socket.emit('joinRoom', { roomId: id, role: 'admin' });
        });

        socket.on('adminRoomState', (data) => {
          setRoom(data.room);
          setBids(data.bids || []);
          setEndTime(new Date(data.room.endTime));
        });

        socket.on('adminNewBid', (bid) => {
          setBids(prev => [bid, ...prev]);
          setRoom(prev => prev ? { ...prev, currentLowestBid: bid.amount, winner: bid.vendor } : prev);
          toast.success('New bid: Rs.' + bid.amount.toLocaleString() + ' by ' + bid.vendor.companyName, { icon: 'ðŸ“‰' });
        });

        socket.on('timeExtended', ({ newEndTime, message }) => {
          setEndTime(new Date(newEndTime));
          setRoom(prev => prev ? { ...prev, endTime: newEndTime } : prev);
          toast(message, { icon: 'â±ï¸', duration: 5000 });
        });

        socket.on('auctionEnded', ({ message }) => {
          setRoom(prev => prev ? { ...prev, status: 'completed' } : prev);
          toast.success(message || 'Auction ended.');
        });

      } catch (err) {
        toast.error('Failed to load room details');
        setLoading(false);
      }
    };

    fetchAndConnect();
    return () => { if (socketRef.current) socketRef.current.disconnect(); };
  }, [id]);

  // Countdown timer
  useEffect(() => {
    if (!endTime) return;
    const tick = setInterval(() => {
      const diff = Math.max(0, Math.floor((endTime - new Date()) / 1000));
      if (diff === 0) { setTimeLeft('Ended'); setIsEndingSoon(false); clearInterval(tick); return; }
      setIsEndingSoon(diff < 180);
      const h = Math.floor(diff / 3600);
      const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
      const s = String(diff % 60).padStart(2, '0');
      setTimeLeft(h > 0 ? h + ':' + m + ':' + s : m + ':' + s);
    }, 1000);
    return () => clearInterval(tick);
  }, [endTime]);

  const handleEndAuction = async () => {
    if (!window.confirm('Are you sure you want to end this auction now?')) return;
    setEnding(true);
    try {
      const token = localStorage.getItem('adminToken');
      await axios.post('http://172.16.100.174:5000/api/admin/rooms/' + id + '/end', {}, {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (socketRef.current) socketRef.current.emit('adminEndAuction', { roomId: id });
      setRoom(prev => prev ? { ...prev, status: 'completed' } : prev);
      toast.success('Auction ended successfully.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to end auction');
    } finally { setEnding(false); }
  };

  const handleExtend = () => {
    const mins = Number(extendMinutes);
    if (!mins || mins <= 0) { toast.error('Enter a valid duration'); return; }
    if (!socketRef.current) return;
    socketRef.current.emit('adminManualExtend', { roomId: id, minutes: mins });
    toast.success('Extending auction by ' + mins + ' minutes...');
  };

  const openReopenModal = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const res = await axios.get('http://172.16.100.174:5000/api/admin/vendors', {
        headers: { Authorization: 'Bearer ' + token }
      });
      setAllVendors(res.data);
      const existingIds = (room.invitedVendors || []).map(v => (v._id || v).toString());
      setReopenVendors(existingIds);
      setShowReopenModal(true);
    } catch (err) { toast.error('Failed to load vendors'); }
  };

  const handleReopen = async () => {
    if (!reopenDuration || Number(reopenDuration) <= 0) { toast.error('Enter a valid duration'); return; }
    setReopenLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      const existingIds = (room.invitedVendors || []).map(v => (v._id || v).toString());
      const retainedVendorIds = reopenVendors.filter(vid => existingIds.includes(vid.toString()));
      const newVendorIds = reopenVendors.filter(vid => !existingIds.includes(vid.toString()));
      await axios.post('http://172.16.100.174:5000/api/admin/rooms/' + id + '/reopen',
        { durationMinutes: Number(reopenDuration), retainedVendorIds, newVendorIds },
        { headers: { Authorization: 'Bearer ' + token } }
      );
      toast.success('Auction re-opened! Emails sent to all vendors.');
      setShowReopenModal(false);
      const res2 = await axios.get('http://172.16.100.174:5000/api/admin/rooms/' + id, {
        headers: { Authorization: 'Bearer ' + token }
      });
      setRoom(res2.data.room);
      setBids(res2.data.bids || []);
      setEndTime(new Date(res2.data.room.endTime));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to re-open auction');
    } finally { setReopenLoading(false); }
  };

  const toggleReopenVendor = (vendorId) => {
    setReopenVendors(prev => prev.includes(vendorId) ? prev.filter(v => v !== vendorId) : [...prev, vendorId]);
  };

  const exportCSV = () => {
    const rows = [['#', 'Time', 'Vendor', 'Email', 'Bid Amount (Rs.)', 'Savings from Base (Rs.)'], ...bids.map((b, i) => [i + 1, new Date(b.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }), b.vendor.companyName, b.vendor.email || '', b.amount, room ? (room.basePrice - b.amount) : ''])];
    const csv = 'data:text/csv;charset=utf-8,' + rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a'); a.href = encodeURI(csv); a.download = 'bid_history_' + id.slice(-6) + '.csv'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };
  const exportExcel = async () => {
    const XLSX = await import('xlsx');
    const data = bids.map((b, i) => ({ '#': i + 1, 'Time': new Date(b.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }), 'Vendor': b.vendor.companyName, 'Email': b.vendor.email || '', 'Bid Amount (Rs.)': b.amount, 'Savings from Base (Rs.)': room ? (room.basePrice - b.amount) : '' }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Bid History');
    XLSX.writeFile(wb, 'bid_history_' + id.slice(-6) + '.xlsx');
  };
  const exportPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF();
    doc.setFontSize(14); doc.text('Bid History - ' + (room?.product?.name || 'Auction'), 14, 16);
    autoTable(doc, { startY: 22, head: [['#', 'Time', 'Vendor', 'Bid Amount', 'Savings']], body: bids.map((b, i) => [i + 1, new Date(b.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }), b.vendor.companyName, 'Rs.' + b.amount.toLocaleString(), 'Rs.' + (room ? (room.basePrice - b.amount) : 0).toLocaleString()]), styles: { fontSize: 8 }, headStyles: { fillColor: [15, 23, 42] } });
    doc.save('bid_history_' + id.slice(-6) + '.pdf');
  };

  const fmt = (d) => d ? new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'â€”';
  const money = (n) => 'Rs. ' + Number(n || 0).toLocaleString('en-IN');

  if (loading) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-slate-500 font-medium text-sm">Loading auction room...</p>
      </div>
    </div>
  );

  if (!room) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="text-center">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
        <p className="text-slate-700 font-bold">Room not found</p>
        <button onClick={() => navigate('/admin')} className="mt-4 text-sm text-blue-600 hover:underline">â† Back to Dashboard</button>
      </div>
    </div>
  );

  const isLive = room.status === 'active';
  const isDone = room.status === 'completed';
  const savings = room.basePrice && room.currentLowestBid ? room.basePrice - room.currentLowestBid : 0;
  const savingsPct = room.basePrice ? ((savings / room.basePrice) * 100).toFixed(1) : 0;
  const winnerName = room.winner?.companyName || (bids[0]?.vendor?.companyName) || 'â€”';

  return (
    <div className="min-h-screen bg-slate-100">

      {/* Top Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/admin')} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 font-semibold text-sm transition">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <div className="w-px h-5 bg-slate-200" />
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Admin View</p>
            <h1 className="text-lg font-black text-slate-900 leading-tight">{room.product?.name || 'Unknown Product'}</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isLive && (
            <span className="flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700 text-xs font-bold px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-ping" /> LIVE
            </span>
          )}
          {isDone && (
            <span className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 text-slate-500 text-xs font-bold px-3 py-1.5 rounded-full">
              <CheckCircle className="w-3.5 h-3.5" /> COMPLETED
            </span>
          )}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <span className="text-[10px] font-bold text-slate-400 uppercase px-2">Export</span>
            <button onClick={exportCSV} className="text-xs font-bold text-slate-600 hover:text-blue-700 bg-white hover:bg-blue-50 px-3 py-1.5 rounded transition shadow-sm">CSV</button>
            <button onClick={exportExcel} className="text-xs font-bold text-slate-600 hover:text-emerald-700 bg-white hover:bg-emerald-50 px-3 py-1.5 rounded transition shadow-sm">Excel</button>
            <button onClick={exportPDF} className="text-xs font-bold text-slate-600 hover:text-red-700 bg-white hover:bg-red-50 px-3 py-1.5 rounded transition shadow-sm">PDF</button>
          </div>
          {isLive && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
                <Timer className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-xs font-bold text-amber-700">Extend:</span>
                <select
                  value={extendMinutes}
                  onChange={e => setExtendMinutes(e.target.value)}
                  className="text-xs font-bold text-amber-700 bg-transparent outline-none cursor-pointer"
                >
                  {[5,10,15,20,30,45,60].map(m => <option key={m} value={m}>{m} min</option>)}
                </select>
                <button onClick={handleExtend} disabled={extendLoading}
                  className="text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 px-2 py-1 rounded transition disabled:opacity-60">
                  + Add
                </button>
              </div>
              <button onClick={handleEndAuction} disabled={ending}
                className="flex items-center gap-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg transition disabled:opacity-60">
                <StopCircle className="w-3.5 h-3.5" /> {ending ? 'Ending...' : 'End Auction'}
              </button>
            </div>
          )}
          {isDone && (
            <button onClick={openReopenModal}
              className="flex items-center gap-2 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 px-3 py-1.5 rounded-lg transition">
              <RefreshCw className="w-3.5 h-3.5" /> Re-open Auction
            </button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT COLUMN */}
        <div className="space-y-5">

          {/* Timer card */}
          <div className={isEndingSoon ? 'bg-red-600 rounded-xl p-5 text-white' : 'bg-slate-900 rounded-xl p-5 text-white'}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider opacity-60 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Time Remaining</span>
              {isEndingSoon && <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full animate-pulse">Soft Close Active</span>}
            </div>
            <p className={'text-5xl font-black font-mono tracking-widest ' + (isEndingSoon ? 'text-white' : 'text-white')}>{timeLeft || '--:--'}</p>
            <p className="text-xs opacity-50 mt-2">Ends: {fmt(room.endTime)}</p>
          </div>

          {/* Current winner / lowest bid */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Crown className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{isDone ? 'Winner' : 'Current Leader'}</span>
            </div>
            <p className="text-4xl font-black text-slate-900 mb-1">{money(room.currentLowestBid || room.basePrice)}</p>
            <p className="text-sm font-bold text-slate-600 mb-3">{winnerName}</p>
            {savings > 0 && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 text-xs font-bold text-emerald-700">
                Savings: {money(savings)} ({savingsPct}% off base)
              </div>
            )}
          </div>

          {/* Product Image */}
          {room.product?.imageUrl && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <img src={room.product.imageUrl} alt={room.product?.name} className="w-full object-cover max-h-52" />
            </div>
          )}

          {/* Auction details */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4"><Package className="w-4 h-4 text-blue-500" /><span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Auction Info</span></div>
            <div className="space-y-2 text-sm">
              {[
                ['Base Price', money(room.basePrice)],
                ['Decrement Step', money(room.decrementValue)],
                ['Quantity', room.quantity || 1],
                ['Start', fmt(room.startTime)],
                ['End', fmt(room.endTime)],
                ['Status', room.status],
                ['Total Bids', bids.length],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between py-1.5 border-b border-slate-50 last:border-0">
                  <span className="text-slate-400 font-semibold">{l}</span>
                  <span className="font-bold text-slate-900 capitalize">{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Invited vendors */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4"><Users className="w-4 h-4 text-purple-500" /><span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Invited Vendors ({room.invitedVendors?.length || 0})</span></div>
            <div className="space-y-2">
              {(room.invitedVendors || []).length === 0
                ? <p className="text-xs text-slate-400">No vendors invited.</p>
                : (room.invitedVendors || []).map(v => {
                    const hasBid = bids.some(b => b.vendor._id === v._id || b.vendor._id?.toString() === v._id?.toString());
                    const isWinner = room.winner && (room.winner._id === v._id || room.winner._id?.toString() === v._id?.toString());
                    return (
                      <div key={v._id} className={'flex items-center justify-between p-2.5 rounded-lg border ' + (isWinner ? 'bg-amber-50 border-amber-200' : hasBid ? 'bg-green-50 border-green-100' : 'bg-slate-50 border-slate-100')}>
                        <div>
                          <p className="text-sm font-bold text-slate-900 flex items-center gap-1">{isWinner && <Crown className="w-3 h-3 text-amber-500" />}{v.companyName}</p>
                          <p className="text-xs text-slate-400">{v.email}</p>
                        </div>
                        <span className={'text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ' + (isWinner ? 'bg-amber-100 text-amber-700' : hasBid ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500')}>
                          {isWinner ? 'Winner' : hasBid ? 'Bidding' : 'Invited'}
                        </span>
                      </div>
                    );
                  })
              }
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN â€” Live Bid Feed */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col" style={{ minHeight: '70vh' }}>
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className={'w-4 h-4 ' + (isLive ? 'text-green-500 animate-pulse' : 'text-slate-400')} />
                <span className="font-bold text-slate-900 text-sm">Live Bid Feed</span>
                <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{bids.length} bids</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                <TrendingDown className="w-3.5 h-3.5" /> Decrement: {money(room.decrementValue)}
              </div>
            </div>

            {bids.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-300">
                <Activity className="w-12 h-12 mb-4" />
                <p className="font-bold text-slate-400">No bids yet</p>
                <p className="text-sm text-slate-300 mt-1">{isLive ? 'Waiting for vendors to place bids...' : 'Auction has not started yet.'}</p>
              </div>
            ) : (
              <div ref={bidFeedRef} className="flex-1 overflow-y-auto divide-y divide-slate-50">
                {bids.map((bid, i) => {
                  const isTop = i === 0;
                  return (
                    <div key={bid._id || i}
                      className={'flex items-center px-6 py-4 transition-all ' + (isTop ? 'bg-emerald-50' : 'hover:bg-slate-50')}>
                      {/* Rank */}
                      <div className={'w-8 h-8 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0 mr-4 ' + (isTop ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400')}>
                        {i + 1}
                      </div>
                      {/* Vendor */}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 text-sm truncate">{bid.vendor.companyName}</p>
                        <p className="text-xs text-slate-400 truncate">{bid.vendor.email}</p>
                      </div>
                      {/* Amount */}
                      <div className="text-right ml-4">
                        <p className={'text-lg font-black ' + (isTop ? 'text-emerald-700' : 'text-slate-500 line-through text-sm font-semibold')}>{money(bid.amount)}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{new Date(bid.createdAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>

      {/* Re-open Auction Modal */}
      {showReopenModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-black text-slate-900">Re-open Auction</h2>
                <p className="text-sm text-slate-400 mt-0.5">Configure and notify vendors</p>
              </div>
              <button onClick={() => setShowReopenModal(false)} className="text-slate-400 hover:text-slate-600 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="text-sm font-bold text-slate-700 block mb-2">Re-open Duration (minutes)</label>
                <input
                  type="number"
                  value={reopenDuration}
                  onChange={e => setReopenDuration(e.target.value)}
                  placeholder="e.g. 30"
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-violet-500 outline-none"
                />
                <p className="text-xs text-slate-400 mt-1">Auction will start in 2 minutes and run for this duration from now.</p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-bold text-slate-700">Select Vendors to Invite</label>
                  <div className="flex gap-2">
                    <button onClick={() => setReopenVendors(allVendors.map(v => v._id))} className="text-xs text-violet-600 font-bold hover:underline">Select All</button>
                    <span className="text-slate-300">|</span>
                    <button onClick={() => setReopenVendors([])} className="text-xs text-slate-400 font-bold hover:underline">Clear</button>
                  </div>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {allVendors.map(v => {
                    const wasInvited = (room.invitedVendors || []).some(iv => (iv._id || iv).toString() === v._id.toString());
                    const isSelected = reopenVendors.includes(v._id);
                    return (
                      <div key={v._id} onClick={() => toggleReopenVendor(v._id)}
                        className={'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ' + (isSelected ? 'bg-violet-50 border-violet-200' : 'bg-slate-50 border-slate-100 hover:border-slate-200')}>
                        <div className={'w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ' + (isSelected ? 'bg-violet-600 border-violet-600' : 'border-slate-300')}>
                          {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{v.companyName}</p>
                          <p className="text-xs text-slate-400 truncate">{v.email}</p>
                        </div>
                        {wasInvited && (
                          <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded flex-shrink-0">Previous</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  <span className="font-bold text-amber-600">Previous</span> vendors keep the same credentials.
                  New vendors receive fresh credentials. All get email notifications.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowReopenModal(false)}
                  className="flex-1 border border-slate-200 text-slate-600 font-bold py-2.5 rounded-lg hover:bg-slate-50 transition text-sm">
                  Cancel
                </button>
                <button onClick={handleReopen} disabled={reopenLoading || reopenVendors.length === 0}
                  className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-bold py-2.5 rounded-lg transition disabled:opacity-60 text-sm flex items-center justify-center gap-2">
                  <RefreshCw className={'w-4 h-4 ' + (reopenLoading ? 'animate-spin' : '')} />
                  {reopenLoading ? 'Re-opening...' : 'Re-open & Notify Vendors'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
  );
};

export default AdminRoomView;
