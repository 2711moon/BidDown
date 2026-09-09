import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { MessageSquare, 
  ChevronLeft, Activity, Clock, TrendingDown, Users, Package,
  AlertCircle, CheckCircle, Download, StopCircle, Crown, RefreshCw, Timer, X
 , Menu} from 'lucide-react';

const AdminRoomView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [bids, setBids] = useState([]);
  const [timeLeft, setTimeLeft] = useState('');
  const [isEndingSoon, setIsEndingSoon] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [endTime, setEndTime] = useState(null);
  const [extendMinutes, setExtendMinutes] = useState('5');
  const [extendLoading, setExtendLoading] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenDuration, setReopenDuration] = useState('30');
  const [reopenVendors, setReopenVendors] = useState([]);
  const [allVendors, setAllVendors] = useState([]);
  const [reopenLoading, setReopenLoading] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [presentVendors, setPresentVendors] = useState([]);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const socketRef = useRef(null);
  const bidFeedRef = useRef(null);

  useEffect(() => {
    let isActive = true;
    let localSocket = null;

    const fetchAndConnect = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('adminToken');
        if (!token) { navigate('/admin/login'); return; }

        const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/rooms/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!isActive) return;

        setRoom(res.data.room);
        setBids(res.data.bids || []);
        setEndTime(new Date(res.data.room.endTime));
        setLoading(false);

        // Connect socket as admin observer
        const socket = io((import.meta.env.VITE_API_URL || 'http://localhost:5000') + '');
        if (!isActive) { socket.disconnect(); return; }
        
        socketRef.current = socket;
        localSocket = socket;

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
          toast.success('New bid: Rs.' + bid.amount.toLocaleString('en-IN') + ' by ' + bid.vendor.companyName, { id: 'admin-bid-' + bid.amount });
        });

        socket.on('auctionStarted', (data) => {
          setRoom(prev => prev ? { ...prev, status: 'active', currentLowestBid: data.currentLowestBid, endTime: data.endTime } : prev);
          toast.success('Auction has started!', { duration: 4000, id: 'admin-auction-started' });
        });

        socket.on('timeExtended', ({ newEndTime, message, extendedBy }) => {
          setEndTime(new Date(newEndTime));
          setRoom(prev => prev ? { ...prev, endTime: newEndTime } : prev);
          toast(message, { duration: 5000, id: 'admin-time-extended', style: { background: '#f59e0b', color: '#fff', fontWeight: 'bold' } });
        });

        socket.on('auctionEnded', ({ message }) => {
          setRoom(prev => prev ? { ...prev, status: 'completed' } : prev);
          toast.success(message || 'Auction ended.', { id: 'admin-auction-ended' });
        });
        
        socket.on('syncBroadcasts', ({ broadcasts }) => {
          setRoom(prev => prev ? { ...prev, broadcasts } : prev);
        });
        
        socket.on('participantUpdate', ({ count, presentVendors }) => {
          if (presentVendors) {
            setParticipantCount(presentVendors.length);
            setPresentVendors(presentVendors);
          } else {
            setParticipantCount(count);
          }
        });

      } catch (err) {
        if (isActive) {
          toast.error('Failed to load room details');
          setLoading(false);
        }
      }
    };

    fetchAndConnect();
    return () => { 
      isActive = false;
      if (localSocket) localSocket.disconnect();
      else if (socketRef.current) socketRef.current.disconnect();
    };
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
      await axios.post((import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api/admin/rooms/' + id + '/end', {}, {
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
    // Local toast removed because the socket 'timeExtended' event will toast globally
  };

  const handleRemoveBroadcast = (broadcastId) => {
    if (!window.confirm('Remove this broadcast message?')) return;
    if (!socketRef.current) return;
    socketRef.current.emit('adminRemoveBroadcast', { roomId: id, broadcastId });
  };

  const handleBroadcast = () => {
    if (!broadcastMsg.trim()) return;
    if (!socketRef.current) return;
    socketRef.current.emit('adminBroadcast', { roomId: id, message: broadcastMsg.trim() });
    toast.success('Broadcast sent to all vendors');
    setBroadcastMsg('');
  };

  const openReopenModal = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const res = await axios.get((import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api/admin/vendors', {
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
      await axios.post((import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api/admin/rooms/' + id + '/reopen',
        { durationMinutes: Number(reopenDuration), retainedVendorIds, newVendorIds },
        { headers: { Authorization: 'Bearer ' + token } }
      );
      toast.success('Auction re-opened! Emails sent to all vendors.');
      setShowReopenModal(false);
      const res2 = await axios.get((import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api/admin/rooms/' + id, {
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
    const rows = [['#', 'Time', 'Vendor', 'Email', 'Item Name', 'Bid Amount (Rs.)', 'Savings from Base (Rs.)']];
    let rowIdx = 1;
    bids.forEach(b => {
      const time = new Date(b.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      const vName = b.vendor.companyName;
      const vEmail = b.vendor.email || '';
      if (room.items && room.items.length > 1 && b.itemBids && b.itemBids.length > 0) {
        b.itemBids.forEach(ib => {
          const matchedItem = room.items.find(ri => ri.name === ib.itemName);
          const itemBase = matchedItem ? (matchedItem.basePrice * matchedItem.quantity) : 0;
          rows.push([rowIdx++, time, vName, vEmail, ib.itemName, ib.amount, itemBase ? (itemBase - ib.amount) : '']);
        });
        rows.push(['', '', '', '', 'GRAND TOTAL', b.amount, room.grandTotalContractValue ? (room.grandTotalContractValue - b.amount) : '']);
      } else {
        const itemBase = room.grandTotalContractValue || (room.basePrice * (room.quantity || 1));
        rows.push([rowIdx++, time, vName, vEmail, room.product?.name || 'Item', b.amount, itemBase ? (itemBase - b.amount) : '']);
      }
    });
    const csv = 'data:text/csv;charset=utf-8,' + rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a'); a.href = encodeURI(csv); a.download = 'bid_history_' + id.slice(-6) + '.csv'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };
  const exportExcel = async () => {
    const XLSX = await import('xlsx');
    const data = [];
    let rowIdx = 1;
    bids.forEach(b => {
      const time = new Date(b.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      const vName = b.vendor.companyName;
      const vEmail = b.vendor.email || '';
      if (room.items && room.items.length > 1 && b.itemBids && b.itemBids.length > 0) {
        b.itemBids.forEach(ib => {
          const matchedItem = room.items.find(ri => ri.name === ib.itemName);
          const itemBase = matchedItem ? (matchedItem.basePrice * matchedItem.quantity) : 0;
          data.push({ '#': rowIdx++, 'Time': time, 'Vendor': vName, 'Email': vEmail, 'Item': ib.itemName, 'Bid Amount (Rs.)': ib.amount, 'Savings from Base (Rs.)': itemBase ? (itemBase - ib.amount) : '' });
        });
        data.push({ '#': '', 'Time': '', 'Vendor': '', 'Email': '', 'Item': 'GRAND TOTAL', 'Bid Amount (Rs.)': b.amount, 'Savings from Base (Rs.)': room.grandTotalContractValue ? (room.grandTotalContractValue - b.amount) : '' });
      } else {
        const itemBase = room.grandTotalContractValue || (room.basePrice * (room.quantity || 1));
        data.push({ '#': rowIdx++, 'Time': time, 'Vendor': vName, 'Email': vEmail, 'Item': room.product?.name || 'Item', 'Bid Amount (Rs.)': b.amount, 'Savings from Base (Rs.)': itemBase ? (itemBase - b.amount) : '' });
      }
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Bid History');
    XLSX.writeFile(wb, 'bid_history_' + id.slice(-6) + '.xlsx');
  };
  const exportPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF();
    doc.setFontSize(14); 
    const isMulti = room.items && room.items.length > 1;
    doc.text('Bid History - ' + (isMulti ? `Basket of ${room.items.length} Items` : (room?.product?.name || 'Auction')), 14, 16);
    
    const rows = [];
    let rowIdx = 1;
    bids.forEach(b => {
      const time = new Date(b.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      const vName = b.vendor.companyName;
      if (room.items && room.items.length > 1 && b.itemBids && b.itemBids.length > 0) {
        b.itemBids.forEach(ib => {
          const matchedItem = room.items.find(ri => ri.name === ib.itemName);
          const itemBase = matchedItem ? (matchedItem.basePrice * matchedItem.quantity) : 0;
          rows.push([rowIdx++, time, vName, ib.itemName, 'Rs.' + ib.amount.toLocaleString('en-IN'), itemBase ? 'Rs.' + (itemBase - ib.amount).toLocaleString('en-IN') : '']);
        });
        rows.push(['', '', '', 'GRAND TOTAL', 'Rs.' + b.amount.toLocaleString('en-IN'), room.grandTotalContractValue ? 'Rs.' + (room.grandTotalContractValue - b.amount).toLocaleString('en-IN') : '']);
      } else {
        const itemBase = room.grandTotalContractValue || (room.basePrice * (room.quantity || 1));
        rows.push([rowIdx++, time, vName, room.product?.name || 'Item', 'Rs.' + b.amount.toLocaleString('en-IN'), itemBase ? 'Rs.' + (itemBase - b.amount).toLocaleString('en-IN') : '']);
      }
    });

    autoTable(doc, { startY: 22, head: [['#', 'Time', 'Vendor', 'Item', 'Bid Amount', 'Savings']], body: rows, styles: { fontSize: 8 }, headStyles: { fillColor: [15, 23, 42] } });
    doc.save('bid_history_' + id.slice(-6) + '.pdf');
  };

  const fmt = (d) => d ? new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-';
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
        <button onClick={() => navigate('/admin')} className="mt-4 text-sm text-blue-600 hover:underline">Ã¢â€ Â Back to Dashboard</button>
      </div>
    </div>
  );

  const isLive = room.status === 'active';
  const isDone = room.status === 'completed';
  const totalBasePrice = room.basePrice * (room.quantity || 1);
  const savings = totalBasePrice && room.currentLowestBid ? totalBasePrice - room.currentLowestBid : 0;
  const savingsPct = totalBasePrice ? ((savings / totalBasePrice) * 100).toFixed(1) : 0;
  const winnerName = room.winner?.companyName || (bids[0]?.vendor?.companyName) || '-';

  return (
    <>
    <div className="min-h-screen bg-slate-100">

                  {/* Top Bar - Responsive */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        
        {/* Desktop View (lg and up) */}
        <div className="hidden lg:flex px-6 py-4 items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/admin')} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 font-semibold text-sm transition bg-slate-50 hover:bg-slate-100 px-3 py-2 rounded-lg">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <div className="w-px h-8 bg-slate-200" />
            <div>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Admin View</p>
              <h1 className="text-xl font-black text-slate-900 leading-tight">{room.auctionName || (room.items && room.items.length > 1 ? `Basket of ${room.items.length} Items` : (room.items?.[0]?.name || room.product?.name || 'Unknown Product'))}</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {isLive && (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700 text-xs font-bold px-3 py-1.5 rounded-full">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-ping" /> LIVE
                </span>
                <span className="flex items-center gap-1 text-slate-500 text-xs font-bold bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-full">
                  <Users className="w-3.5 h-3.5" /> {participantCount} online
                </span>
              </div>
            )}
            {isDone && (
              <span className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 text-slate-500 text-xs font-bold px-3 py-1.5 rounded-full">
                <CheckCircle className="w-3.5 h-3.5" /> COMPLETED
              </span>
            )}
            
            <div className="w-px h-6 bg-slate-200 mx-1" />
            
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <span className="text-[10px] font-bold text-slate-400 uppercase px-2">Export</span>
              <button onClick={exportCSV} className="text-xs font-bold text-slate-600 hover:text-blue-700 bg-white hover:bg-blue-50 px-3 py-1.5 rounded shadow-sm transition">CSV</button>
              <button onClick={exportExcel} className="text-xs font-bold text-slate-600 hover:text-emerald-700 bg-white hover:bg-emerald-50 px-3 py-1.5 rounded shadow-sm transition">Excel</button>
              <button onClick={exportPDF} className="text-xs font-bold text-slate-600 hover:text-red-700 bg-white hover:bg-red-50 px-3 py-1.5 rounded shadow-sm transition">PDF</button>
            </div>
          </div>
        </div>

        {/* Desktop Lower Tools Bar (lg and up) */}
        <div className="hidden lg:flex px-6 py-3 bg-slate-50 border-t border-slate-100 items-center justify-between">
          <div className="flex-1 max-w-xl">
            {isLive && (
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 p-1 rounded-lg w-full shadow-sm">
                <input type="text" value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} placeholder="Broadcast message to all vendors..." className="text-sm bg-transparent outline-none flex-1 px-3 py-1 text-slate-800 placeholder-slate-400" onKeyDown={e => e.key === 'Enter' && handleBroadcast()} />
                <button onClick={handleBroadcast} className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-5 py-1.5 rounded transition shadow-sm">Send</button>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {isLive && (
              <>
                <div className="flex items-center gap-2 bg-white border border-amber-200 p-1 rounded-lg shadow-sm">
                  <div className="flex items-center gap-1.5 px-2">
                    <Timer className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-bold text-amber-700">Extend:</span>
                  </div>
                  <select value={extendMinutes} onChange={e => setExtendMinutes(e.target.value)} className="text-sm font-bold text-amber-700 bg-amber-50 outline-none cursor-pointer py-1 px-2 rounded border border-amber-100">
                    {[5,10,15,20,30,45,60].map(m => <option key={m} value={m}>{m} min</option>)}
                  </select>
                  <button onClick={handleExtend} disabled={extendLoading} className="text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 px-4 py-1.5 rounded transition disabled:opacity-60 ml-1">+ Add</button>
                </div>
                <button onClick={handleEndAuction} disabled={ending} className="flex items-center gap-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 px-5 py-2 rounded-lg transition shadow-sm disabled:opacity-60">
                  <StopCircle className="w-4 h-4" /> {ending ? 'Ending...' : 'End Auction'}
                </button>
              </>
            )}
            {isDone && (
              <button onClick={openReopenModal} className="flex items-center gap-2 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 px-6 py-2 rounded-lg transition shadow-sm">
                <RefreshCw className="w-4 h-4" /> Re-open Auction
              </button>
            )}
          </div>
        </div>

        {/* Mobile View (Below lg) */}
        <div className="lg:hidden flex flex-col">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/admin')} className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none mb-1">Admin View</p>
                <h1 className="text-base font-black text-slate-900 leading-none truncate max-w-[180px] sm:max-w-xs">{room.auctionName || (room.items && room.items.length > 1 ? `Basket of ${room.items.length} Items` : (room.items?.[0]?.name || room.product?.name || 'Unknown Product'))}</h1>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {isLive && (
                <span className="flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700 text-[10px] font-bold px-2 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping" /> LIVE
                </span>
              )}
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition">
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Collapsible Mobile Menu */}
          {isMobileMenuOpen && (
            <div className="px-4 pb-4 pt-2 bg-slate-50 border-t border-slate-200 flex flex-col gap-4 animate-in slide-in-from-top-2">
              
              <div className="flex items-center justify-between">
                {isLive ? (
                  <span className="flex items-center gap-1 text-slate-500 text-xs font-bold bg-white border border-slate-200 px-3 py-1.5 rounded-full shadow-sm">
                    <Users className="w-3.5 h-3.5" /> {participantCount} online
                  </span>
                ) : isDone ? (
                  <span className="flex items-center gap-1 bg-slate-200 text-slate-600 text-xs font-bold px-3 py-1.5 rounded-full">
                    <CheckCircle className="w-3.5 h-3.5" /> COMPLETED
                  </span>
                ) : <span/>}
                
                <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-lg shadow-sm">
                  <button onClick={exportCSV} className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded">CSV</button>
                  <button onClick={exportExcel} className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded">Excel</button>
                  <button onClick={exportPDF} className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded">PDF</button>
                </div>
              </div>

              {isLive && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-1.5 bg-white border border-blue-200 p-1 rounded-lg w-full shadow-sm">
                    <input type="text" value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} placeholder="Broadcast..." className="text-sm bg-transparent outline-none flex-1 px-2 text-blue-900" onKeyDown={e => e.key === 'Enter' && handleBroadcast()} />
                    <button onClick={handleBroadcast} className="text-xs font-bold text-white bg-blue-600 px-4 py-2 rounded shadow-sm">Send</button>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-between bg-white border border-amber-200 p-1 rounded-lg flex-1 shadow-sm">
                      <select value={extendMinutes} onChange={e => setExtendMinutes(e.target.value)} className="text-xs font-bold text-amber-700 bg-transparent outline-none pl-2">
                        {[5,10,15,20,30,45,60].map(m => <option key={m} value={m}>{m} min</option>)}
                      </select>
                      <button onClick={handleExtend} disabled={extendLoading} className="text-xs font-bold text-white bg-amber-500 px-3 py-1.5 rounded">+ Add</button>
                    </div>
                    
                    <button onClick={handleEndAuction} disabled={ending} className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-red-600 py-2.5 rounded-lg shadow-sm">
                      <StopCircle className="w-3.5 h-3.5" /> End
                    </button>
                  </div>
                </div>
              )}
              
              {isDone && (
                <button onClick={openReopenModal} className="w-full flex items-center justify-center gap-2 text-sm font-bold text-white bg-violet-600 py-3 rounded-lg shadow-sm">
                  <RefreshCw className="w-4 h-4" /> Re-open Auction
                </button>
              )}
            </div>
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

          
          {/* Broadcast History */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2"><MessageSquare className="w-4 h-4 text-blue-500" /><span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Broadcast History</span></div>
              <span className="text-xs font-bold text-slate-400">{room.broadcasts?.length || 0} msgs</span>
            </div>
            {room.broadcasts && room.broadcasts.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {room.broadcasts.slice().reverse().map(b => (
                  <div key={b._id} className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex flex-col gap-2 group">
                    <p className="text-sm text-slate-800 break-words">{b.message}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-[10px] font-bold text-slate-400">{fmt(b.createdAt)}</p>
                      <button onClick={() => handleRemoveBroadcast(b._id)} className="text-[10px] font-bold text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition px-2 py-0.5 bg-red-50 rounded">Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center italic py-4">No broadcasts sent yet.</p>
            )}
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

          {/* Auction details */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4"><Package className="w-4 h-4 text-blue-500" /><span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Auction Info</span></div>
            <div className="space-y-2 text-sm">
              {[
                ['Grand Total Contract Value', room.grandTotalContractValue ? money(room.grandTotalContractValue) : money(room.basePrice * (room.quantity || 1))],
                ['Decrement Step', room.items && room.items.length > 1 ? 'Variable per item' : money(room.decrementValue)],
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
            
            {room.items && room.items.length > 1 ? (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Basket Items ({room.items.length})</p>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {room.items.map((it, idx) => (
                    <div key={idx} className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 flex justify-between items-center">
                      <div>
                        <p className="text-xs font-bold text-slate-900">{it.name}</p>
                        <p className="text-[10px] text-slate-500">Qty: {it.quantity} | Drop: {money(it.decrementValue)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-blue-700">{money(it.basePrice * it.quantity)}</p>
                        <p className="text-[9px] text-slate-400 uppercase">Base total</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-sm">
                <div className="flex justify-between py-1 border-b border-slate-50"><span className="text-slate-400 font-semibold">Unit Base Price</span><span className="font-bold text-slate-900">{money(room.basePrice)}</span></div>
                <div className="flex justify-between py-1 border-b border-slate-50"><span className="text-slate-400 font-semibold">Quantity</span><span className="font-bold text-slate-900">{room.quantity || 1}</span></div>
                {room.product?.imageUrl && (
                  <div className="mt-2 rounded-lg overflow-hidden border border-slate-200">
                    <img src={room.product.imageUrl} alt={room.product?.name} className="w-full object-cover max-h-32" />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Invited vendors */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4"><Users className="w-4 h-4 text-purple-500" /><span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Invited Vendors ({room.invitedVendors?.length || 0})</span></div>
            <div className="space-y-2">
              {(room.invitedVendors || []).length === 0
                ? <p className="text-xs text-slate-400">No vendors invited.</p>
                : (room.invitedVendors || []).map(v => {
                    const isPresent = presentVendors.includes(v._id || v._id?.toString());
                    return (
                      <div key={v._id} className={'flex items-center justify-between p-2.5 rounded-lg border ' + (isPresent ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100')}>
                        <div>
                          <p className="text-sm font-bold text-slate-900 flex items-center gap-1">{v.companyName}</p>
                          <p className="text-xs text-slate-400">{v.email}</p>
                        </div>
                        <span className={'text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ' + (isPresent ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600')}>
                          {isPresent ? 'Present' : 'Absent'}
                        </span>
                      </div>
                    );
                  })
              }
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN - Live Bid Feed */}
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
                  const isLowest = bid.amount === (room.currentLowestBid || (room.grandTotalContractValue || room.basePrice * (room.quantity||1)));
                  return (
                    <div key={bid._id || Math.random().toString()} className={'flex flex-col px-6 py-4 transition-all border-b border-slate-50 last:border-0 ' + (isLowest ? 'bg-emerald-50' : 'hover:bg-slate-50')}>
                      <div className="flex items-center">
                        {/* Indicator */}
                        <div className={'w-2 h-2 rounded-full mr-4 shrink-0 ' + (isLowest ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300')}></div>
                        
                        {/* Vendor */}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-900 text-sm truncate">{bid.vendor.companyName}</p>
                          <p className="text-xs text-slate-400 truncate">{bid.vendor.email}</p>
                        </div>
                        {/* Amount */}
                        <div className="text-right ml-4">
                          <p className={'text-lg font-black ' + (isLowest ? 'text-emerald-700' : 'text-slate-500 line-through text-sm font-semibold')}>{money(bid.amount)}</p>
                          <p className="text-[10px] text-slate-400 font-medium">{new Date(bid.createdAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
                        </div>
                      </div>
                      
                      {/* Item Breakdown (if multi-item) */}
                      {room.items && room.items.length > 1 && bid.itemBids && bid.itemBids.length > 0 && (
                        <div className="mt-3 ml-6 pl-4 border-l-2 border-slate-200/60">
                          <details className="group">
                            <summary className="text-[10px] font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-600 transition list-none select-none flex items-center gap-1">
                              <span className="group-open:hidden">▶</span><span className="hidden group-open:inline">▼</span> View Item Breakdown
                            </summary>
                            <div className="mt-2 space-y-1.5">
                              {bid.itemBids.map((ib, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-white border border-slate-100 rounded p-1.5 shadow-sm">
                                  <span className="text-xs font-bold text-slate-700 truncate mr-2">{ib.itemName}</span>
                                  <span className="text-xs font-black text-slate-900 shrink-0">{money(ib.amount)}</span>
                                </div>
                              ))}
                            </div>
                          </details>
                        </div>
                      )}
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
                      <div key={v._id} onClick={() => {
                        if (v.blacklisted) {
                          toast.error('Cannot invite a blacklisted vendor. You must unblacklist them from the Vendors tab first.', { duration: 4000 });
                          return;
                        }
                        toggleReopenVendor(v._id);
                      }}
                        className={'flex items-center gap-3 p-3 rounded-lg border transition ' + (v.blacklisted ? 'opacity-70 bg-slate-100 border-slate-200 cursor-not-allowed' : isSelected ? 'bg-violet-50 border-violet-200 cursor-pointer' : 'bg-slate-50 border-slate-100 hover:border-slate-200 cursor-pointer')}>
                        <div className={'w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ' + (v.blacklisted ? 'border-slate-300' : isSelected ? 'bg-violet-600 border-violet-600' : 'border-slate-300')}>
                          {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{v.companyName}</p>
                          <p className="text-xs text-slate-400 truncate">{v.email}</p>
                        </div>
                        {v.blacklisted && (
                          <span className="text-[9px] font-black uppercase bg-red-100 text-red-700 px-1.5 py-0.5 rounded border border-red-200 flex-shrink-0 ml-1">Blacklisted</span>
                        )}
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
    </>
  );
};

export default AdminRoomView;


