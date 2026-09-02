import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import axios from 'axios';
import { formatDistanceToNow, differenceInSeconds } from 'date-fns';
import { toast } from 'react-hot-toast';
import { Clock, TrendingDown, Package, FileText, Lock, AlertCircle, ChevronRight } from 'lucide-react';

const BiddingRoom = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [socket, setSocket] = useState(null);
  const [roomState, setRoomState] = useState({ status: 'loading' });
  const [currentBid, setCurrentBid] = useState(null);
  const [bidInput, setBidInput] = useState('');
  const [autoBidFloor, setAutoBidFloor] = useState('');
  const [activeAutoBidFloor, setActiveAutoBidFloor] = useState(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [isEndingSoon, setIsEndingSoon] = useState(false);

  useEffect(() => {
    let interval;
    
    const fetchRoom = async () => {
      try {
        const res = await axios.get(`http://172.16.100.174:5000/api/vendor/rooms/${id}`);
        const room = res.data;
        
        const now = new Date();
        const start = new Date(room.startTime);
        
        setRoomState({
          ...room,
          status: start > now ? 'waiting' : room.status
        });
        setCurrentBid(room.currentLowestBid);
      } catch (err) {
        toast.error('Failed to load room details');
        setRoomState({ status: 'error', message: 'Could not load room' });
      }
    };

    fetchRoom();

    const newSocket = io('http://172.16.100.174:5000');
    setSocket(newSocket);

    const vendorId = localStorage.getItem('vendorId');
    const adminToken = localStorage.getItem('adminToken');
    if (!vendorId && !adminToken) {
      toast.error('You are not logged in!');
    }
    
    newSocket.emit('joinRoom', { roomId: id, vendorId: vendorId || 'anonymous' });

    newSocket.on('newLowestBid', (data) => {
      setCurrentBid(data.amount);
      toast.success(`New lowest bid: Rs.${data.amount.toLocaleString()}`, {
        style: { borderRadius: '10px', background: '#333', color: '#fff' }
      });
    });

    newSocket.on('auctionState', (data) => {
      if (data.myAutoBidFloor) setActiveAutoBidFloor(data.myAutoBidFloor);
    });
    newSocket.on('autoBidSuccess', (data) => {
      setActiveAutoBidFloor(data.floorAmount);
      toast.success('Auto-Bid active at Rs.' + data.floorAmount.toLocaleString());
      setAutoBidFloor('');
    });
    newSocket.on('bidError', (data) => {
      toast.error(data.message);
    });

    // Countdown Timer logic
    interval = setInterval(() => {
      setRoomState(prev => {
        if (!prev.endTime) return prev;
        const now = new Date();
        const end = new Date(prev.endTime);
        const seconds = differenceInSeconds(end, now);
        
        if (seconds <= 0) {
          setTimeLeft('Auction Ended');
          setIsEndingSoon(false);
          return { ...prev, status: 'closed' };
        }
        
        setIsEndingSoon(seconds < 180); // Less than 3 mins
        
        const d = Math.floor(seconds / (3600*24));
        const h = Math.floor((seconds % (3600*24)) / 3600);
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = Math.floor(seconds % 60).toString().padStart(2, '0');
        
        if (d > 0) setTimeLeft(`${d}d ${h}h`);
        else if (h > 0) setTimeLeft(`${h}:${m}:${s}`);
        else setTimeLeft(`${m}:${s}`);
        
        return prev;
      });
    }, 1000);

    return () => {
      newSocket.close();
      clearInterval(interval);
    };
  }, [id]);

  const handleAutoBid = () => {
    if (!autoBidFloor || !socket) return;
    const vendorId = localStorage.getItem('vendorId');
    socket.emit('setupAutoBid', { roomId: id, vendorId, floorAmount: autoBidFloor });
  };
  
  const handleCancelAutoBid = () => {
    // We could add an event to cancel, but for now we can just set floor to something super high, or we can add logic to socket.
    // For simplicity, let's just alert that it's set.
  };

  const handleManualBid = (e) => {
    e.preventDefault();
    if (!bidInput || !socket) return;
    
    if (Number(bidInput) >= currentBid) {
      toast.error('Bid must be lower than the current best price!');
      return;
    }

    socket.emit('placeBid', { 
      roomId: id, 
      vendorId: localStorage.getItem('vendorId') || 'anonymous', 
      amount: Number(bidInput) 
    });
    setBidInput('');
  };

  if (roomState.status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-slate-500 font-medium animate-pulse">Establishing secure connection...</p>
      </div>
    );
  }

  if (roomState.status === 'waiting') {
    return (
      <div className="max-w-2xl mx-auto mt-20 bg-white p-12 rounded-2xl shadow-xl text-center border-t-8 border-amber-400">
        <Clock className="w-16 h-16 text-amber-400 mx-auto mb-6 animate-bounce" />
        <h2 className="text-4xl font-extrabold mb-4 text-slate-800">Waiting Room</h2>
        <p className="text-slate-600 mb-8 text-lg">You are early! The auction is scheduled to start at <br/><span className="font-bold text-slate-900">{new Date(roomState.startTime).toLocaleString()}</span></p>
        <div className="bg-slate-50 p-4 rounded-lg inline-block">
          <div className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Time until start</div>
          <div className="text-2xl font-mono font-bold text-amber-600">
            {roomState.startTime ? formatDistanceToNow(new Date(roomState.startTime)) : 'Soon'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 mt-8">
      {/* Top Navigation */}
      <div className="flex justify-between items-center mb-6">
        <button 
          onClick={() => {
            const isAdmin = localStorage.getItem('adminToken');
            navigate(isAdmin ? '/admin' : '/vendor/dashboard');
          }} 
          className="flex items-center text-sm font-bold text-slate-500 dark:text-zinc-400 hover:text-black dark:hover:text-white transition bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 px-4 py-2 rounded-lg shadow-sm"
        >
          <ChevronRight className="w-4 h-4 mr-2 rotate-180" /> Back to Dashboard
        </button>
      </div>
      
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left Column: Product Details */}
        <div className="lg:w-1/3 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center space-x-3 mb-6">
              <Package className="w-6 h-6 text-blue-600" />
              <h2 className="text-2xl font-bold text-slate-800">{roomState.product?.name || 'Product Details'}</h2>
            </div>
            
            <div className="aspect-video bg-slate-100 rounded-xl mb-6 flex items-center justify-center border border-slate-200">
              <span className="text-slate-400 font-medium">No Image Provided</span>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">Description</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  {roomState.product?.description || 'No description available for this item.'}
                </p>
              </div>

              {roomState.product?.documents && roomState.product.documents.length > 0 && (
                <div className="pt-4 border-t border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Documents</h3>
                  <ul className="space-y-2">
                    {roomState.product.documents.map((doc, idx) => (
                      <li key={idx}>
                        <a href={doc.url} target="_blank" rel="noreferrer" className="flex items-center text-sm text-blue-600 hover:text-blue-800 transition font-medium">
                          <FileText className="w-4 h-4 mr-2" /> {doc.name || 'View Document'}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        <div className="bg-slate-900 rounded-2xl shadow-sm p-6 text-white">
          <div className="flex items-start space-x-3">
            <Lock className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-bold text-emerald-400 mb-1">Strict Anonymity Active</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Competitor names, identities, and the total number of participants are hidden. You will only see the current lowest market price.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Live Bidding */}
      <div className="lg:w-2/3 flex flex-col">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden flex-1 flex flex-col">
          
          {/* Header */}
          <div className="bg-slate-50 border-b border-slate-200 p-6 flex justify-between items-center">
            <div className="flex items-center space-x-3">
              {roomState.status === 'closed' ? (
                <span className="bg-slate-200 text-slate-700 px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wide">
                  Auction Closed
                </span>
              ) : (
                <span className="bg-emerald-100 text-emerald-700 px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wide flex items-center shadow-sm">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping mr-2"></span>
                  Live Auction
                </span>
              )}
            </div>
            <div className={`text-right flex flex-col items-end ${isEndingSoon ? 'animate-pulse' : ''}`}>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Time Remaining</span>
              <span className={`text-3xl font-mono font-black ${isEndingSoon ? 'text-red-600' : 'text-slate-800'}`}>
                {timeLeft || '--:--'}
              </span>
              {isEndingSoon && roomState.status !== 'closed' && (
                <span className="text-xs font-semibold text-red-500 mt-1 flex items-center">
                  <AlertCircle className="w-3 h-3 mr-1" /> Soft close active
                </span>
              )}
            </div>
          </div>

          {/* Price Display */}
          <div className="p-12 text-center flex-1 flex flex-col justify-center border-b border-slate-100">
            <span className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Current Lowest Market Price</span>
            <div className="text-7xl font-black text-slate-900 tracking-tighter flex items-center justify-center">
              <span className="text-4xl text-slate-400 mr-2">Rs.</span>
              {currentBid ? currentBid.toLocaleString() : '---'}
            </div>
            <div className="mt-6 inline-flex items-center bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-sm font-medium">
              <TrendingDown className="w-4 h-4 mr-2" />
              Minimum decrement step: Rs.{roomState.decrementValue?.toLocaleString()}
            </div>
          </div>

          {/* Action Area */}
          <div className="p-8 bg-slate-50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Manual Bid */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm transition hover:shadow-md">
                <h3 className="font-bold text-slate-800 mb-4">Place Manual Bid</h3>
                <form onSubmit={handleManualBid} className="space-y-4">
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">Rs.</span>
                    <input 
                      type="number" 
                      value={bidInput}
                      onChange={(e) => setBidInput(e.target.value)}
                      placeholder="Enter bid amount"
                      disabled={roomState.status === 'closed'}
                      className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-lg text-lg font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition disabled:opacity-50"
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={roomState.status === 'closed'}
                    className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 shadow-sm"
                  >
                    Submit Bid
                  </button>
                </form>
              </div>

              {/* Auto Bid */}
              <div className="bg-slate-900 p-6 rounded-xl shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 opacity-10 rounded-bl-full"></div>
                <h3 className="font-bold text-white mb-2 relative z-10">Smart Auto-Bid</h3>
                <p className="text-xs text-slate-400 mb-4 relative z-10">Set your absolute floor price. The system will automatically counter-bid for you.</p>
                <div className="space-y-4 relative z-10">
                  {activeAutoBidFloor ? (
                    <div className="bg-emerald-900/50 border border-emerald-500/30 p-4 rounded-lg text-center">
                      <p className="text-emerald-400 font-bold text-sm mb-1">AUTO-BID ACTIVE</p>
                      <p className="text-white text-2xl font-black mb-1">Rs.{activeAutoBidFloor.toLocaleString()}</p>
                      <p className="text-xs text-emerald-200/70">System is bidding on your behalf down to this floor.</p>
                    </div>
                  ) : null}
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">Rs.</span>
                    <input 
                      type="number" 
                      value={autoBidFloor}
                      onChange={(e) => setAutoBidFloor(e.target.value)}
                      placeholder="Your floor price"
                      disabled={roomState.status === 'closed'}
                      className="w-full pl-8 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-lg font-bold text-white focus:ring-2 focus:ring-blue-500 outline-none transition disabled:opacity-50"
                    />
                  </div>
                  <button 
                    onClick={handleAutoBid}
                    disabled={roomState.status === 'closed' || !autoBidFloor}
                    className="w-full bg-white text-slate-900 font-bold py-3 rounded-lg hover:bg-slate-100 transition active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
                  >
                    {activeAutoBidFloor ? 'Update Auto-Bid' : 'Activate Auto-Bid'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};

export default BiddingRoom;
