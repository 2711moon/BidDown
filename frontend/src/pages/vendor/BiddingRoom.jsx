import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import axios from 'axios';
import { formatDistanceToNow, differenceInSeconds } from 'date-fns';
import { toast } from 'react-hot-toast';
import { Clock, TrendingDown, Package, FileText, Lock, AlertCircle, ChevronRight, ArrowUp } from 'lucide-react';

const BiddingRoom = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [socket, setSocket] = useState(null);
  const [roomState, setRoomState] = useState({ status: 'loading' });
  const [timeLeft, setTimeLeft] = useState('');
  const [isEndingSoon, setIsEndingSoon] = useState(false);
  const [hasAcknowledged, setHasAcknowledged] = useState(sessionStorage.getItem(`ack_${id}`) === 'true');
  const [broadcasts, setBroadcasts] = useState([]);
  const [extensionNotice, setExtensionNotice] = useState('');
  
  const [itemInputs, setItemInputs] = useState({});
  const [bidsHistory, setBidsHistory] = useState({});
  const [showScrollTop, setShowScrollTop] = useState(false);
  const navRef = useRef(null);

  useEffect(() => {
    let interval;
    const fetchRoom = async () => {
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/vendor/rooms/${id}`);
        const room = res.data;
        const now = new Date();
        const start = new Date(room.startTime);
        setRoomState({ ...room, status: start > now ? 'waiting' : room.status });
        
        const initialInputs = {};
        if (room.items && room.items.length > 0) {
          room.items.forEach(it => {
            const lowest = room.itemLowestBids?.find(lb => lb.itemName === it.name)?.amount || (it.basePrice * it.quantity);
            initialInputs[it.name] = lowest.toString();
          });
        } else {
          const name = room.product?.name || 'Product';
          initialInputs[name] = (room.currentLowestBid || (room.basePrice * (room.quantity||1))).toString();
        }
        setItemInputs(initialInputs);

        setBroadcasts(room.broadcasts || []);
        if (room.extensions?.length > 0) {
          const latestExt = room.extensions[room.extensions.length - 1];
          setExtensionNotice(`Auction extended by ${latestExt.minutes} minute${latestExt.minutes > 1 ? 's' : ''}`);
        }
      } catch (err) {
        toast.error('Failed to load room details', { id: 'room-load-err' });
        setRoomState({ status: 'error', message: 'Could not load room' });
      }
    };
    fetchRoom();

    const newSocket = io((import.meta.env.VITE_API_URL || 'http://localhost:5000') + '');
    setSocket(newSocket);
    const vendorId = localStorage.getItem('vendorId');
    if (!vendorId && !localStorage.getItem('adminToken')) toast.error('You are not logged in!', { id: 'not-logged-in' });
    
    newSocket.emit('joinRoom', { roomId: id, vendorId: vendorId || 'anonymous' });

    newSocket.on('newLowestBid', (data) => {
      setRoomState(prev => {
        const updated = { ...prev, currentLowestBid: data.amount };
        if (data.itemLowestBids && data.itemLowestBids.length > 0) {
          updated.itemLowestBids = data.itemLowestBids;
        }
        return updated;
      });
      // Update input fields — MERGE so unchanged items keep their values
      if (data.itemBids && data.itemBids.length > 0) {
        const newInputs = {};
        data.itemBids.forEach(ib => { if (ib.itemName) newInputs[ib.itemName] = ib.amount.toString(); });
        setItemInputs(prev => ({ ...prev, ...newInputs }));
      } else if (data.itemLowestBids && data.itemLowestBids.length > 0) {
        const newInputs = {};
        data.itemLowestBids.forEach(ib => { if (ib.itemName) newInputs[ib.itemName] = ib.amount.toString(); });
        setItemInputs(prev => ({ ...prev, ...newInputs }));
      }
      toast.success(`New lowest bid: Rs.${data.amount.toLocaleString('en-IN')}`, { id: 'bid-' + data.amount, style: { borderRadius: '10px', background: '#333', color: '#fff' } });
      // Update bid history panel
      setBidsHistory(prev => {
        const next = { ...prev };
        const bidsToRecord = data.itemBids && data.itemBids.length > 0 ? data.itemBids : (data.itemLowestBids || []);
        if (bidsToRecord.length > 0) {
          bidsToRecord.forEach(ib => {
            if (!ib.itemName) return;
            if (!next[ib.itemName]) next[ib.itemName] = [];
            next[ib.itemName] = [{ amount: ib.amount, time: new Date() }, ...next[ib.itemName]].slice(0, 5);
          });
        } else {
          const name = 'Product';
          if (!next[name]) next[name] = [];
          next[name] = [{ amount: data.amount, time: new Date() }, ...next[name]].slice(0, 5);
        }
        return next;
      });
    });

    newSocket.on('newBidHistory', (data) => {
      if (data.itemBids && data.itemBids.length > 0) {
        setBidsHistory(prev => {
          const next = { ...prev };
          data.itemBids.forEach(ib => {
            if (!next[ib.itemName]) next[ib.itemName] = [];
            next[ib.itemName] = [{ amount: ib.amount, time: new Date() }, ...next[ib.itemName]].slice(0, 5);
          });
          return next;
        });
      }
    });


    newSocket.on('auctionStarted', (data) => {
      setRoomState(prev => ({ ...prev, status: 'active', endTime: data.endTime, currentLowestBid: data.currentLowestBid }));
      toast.success('Auction has started! Place your bids now.', { duration: 4000, id: 'auction-started' });
    });
    newSocket.on('timeExtended', ({ newEndTime, message, extendedBy }) => {
      setRoomState(prev => ({ ...prev, endTime: newEndTime }));
      setExtensionNotice(extendedBy ? `Auction extended by ${extendedBy} minute${extendedBy > 1 ? 's' : ''}` : 'Auction duration extended');
      toast(message, { duration: 6000, id: 'time-extended', style: { background: '#f59e0b', color: '#fff', fontWeight: 'bold' } });
    });
    newSocket.on('bidError', (data) => toast.error(data.message, { id: 'bid-error' }));
    newSocket.on('broadcastReceived', ({ message }) => setBroadcasts(prev => [...prev, { message }]));
    newSocket.on('syncBroadcasts', ({ broadcasts }) => setBroadcasts(broadcasts));

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
        setIsEndingSoon(seconds < 180);
        const d = Math.floor(seconds / (3600*24)), h = Math.floor((seconds % (3600*24)) / 3600), m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0'), s = Math.floor(seconds % 60).toString().padStart(2, '0');
        if (d > 0) setTimeLeft(`${d}d ${h}h`);
        else if (h > 0) setTimeLeft(`${h}:${m}:${s}`);
        else setTimeLeft(`${m}:${s}`);
        return prev;
      });
    }, 1000);

    return () => { newSocket.close(); clearInterval(interval); };
  }, [id]);

  useEffect(() => {
    const handleScroll = () => {
      if (navRef.current && window.scrollY > navRef.current.offsetTop + 100) setShowScrollTop(true);
      else setShowScrollTop(false);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const items = roomState.items && roomState.items.length > 0 
    ? roomState.items 
    : (roomState.basePrice ? [{ name: roomState.product?.name || 'Product', basePrice: roomState.basePrice, quantity: roomState.quantity || 1, decrementValue: roomState.decrementValue }] : []);

  const handleInputChange = (itemName, val) => setItemInputs(prev => ({ ...prev, [itemName]: val }));
  const getGrandTotalInput = () => items.reduce((sum, it) => sum + (Number(itemInputs[it.name]) || 0), 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!socket) return;
    const isMulti = roomState.items && roomState.items.length > 1;
    const totalInput = getGrandTotalInput();
    const currentGrandTotal = roomState.currentLowestBid || roomState.grandTotalContractValue || (roomState.basePrice * (roomState.quantity||1));
    
    if (totalInput >= currentGrandTotal) {
      toast.error('Grand total must be strictly lower than the current market price!');
      return;
    }

    const payload = {
      roomId: id,
      vendorId: localStorage.getItem('vendorId') || 'anonymous',
      amount: totalInput
    };
    
    if (isMulti) {
      payload.itemBids = items.map(it => ({
        itemId: it._id || 'legacy',
        itemName: it.name,
        amount: Number(itemInputs[it.name])
      }));
    }
    socket.emit('placeBid', payload);
  };

  const money = n => 'Rs.' + Number(n||0).toLocaleString('en-IN');
  const scrollToNav = () => {
    if (navRef.current) {
      window.scrollTo({ top: navRef.current.offsetTop - 20, behavior: 'smooth' });
    }
  };

  if (roomState.status === 'loading') return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div></div>;
  if (roomState.status === 'waiting') return (
    <div className="max-w-2xl mx-auto mt-20 bg-white p-12 rounded-2xl shadow-xl text-center border-t-8 border-amber-400">
      <Clock className="w-16 h-16 text-amber-400 mx-auto mb-6 animate-bounce" />
      <h2 className="text-4xl font-extrabold mb-4 text-slate-800">Waiting Room</h2>
      <p className="text-slate-600 mb-8 text-lg">Auction starts at <br/><span className="font-bold text-slate-900">{new Date(roomState.startTime).toLocaleString('en-IN')}</span></p>
    </div>
  );

  return (
    <>
      {!hasAcknowledged && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-slate-900 px-6 py-4 text-center shrink-0">
              <p className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-1">Reverse Auction Platform</p>
              <h2 className="text-xl font-black text-white">Bidder Acknowledgement</h2>
              <p className="text-xs text-slate-400 mt-1">बोलीदाता स्वीकृती &nbsp;|&nbsp; बोलीदाता स्वीकृति</p>
            </div>

            {/* Scrollable disclaimer body — concise unified set */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-0 text-sm">

              {/* Unified box */}
              <div className="rounded-xl overflow-hidden border border-slate-800">

                {/* Box header — three language names stacked vertically */}
                <div className="bg-slate-900 px-4 py-3 text-center">
                  <p className="text-xs font-black uppercase tracking-widest text-amber-400 leading-relaxed">
                    ⚖️ Administrator's Absolute Authority
                  </p>
                  <p className="text-xs font-black uppercase tracking-widest text-amber-300 leading-relaxed mt-0.5">
                    प्रशासकाचा सर्वोच्च अधिकार
                  </p>
                  <p className="text-xs font-black uppercase tracking-widest text-amber-300 leading-relaxed mt-0.5">
                    प्रशासक का सर्वोच्च अधिकार
                  </p>
                </div>

                {/* English */}
                <div className="px-4 pt-3 pb-3 border-b border-slate-200">
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-2 border-b border-blue-100 pb-1">English</p>
                  <ul className="space-y-1.5 text-slate-700 list-disc list-inside leading-relaxed text-sm">
                    <li>This is a <strong>legally binding reverse auction.</strong> My bid is a firm supply commitment at the quoted price. All bids are final. <strong>Auto-bidding is permanently disabled.</strong></li>
                    <li>Anonymity is guaranteed. No vendor identity is disclosed during the auction. Grand Total must be <strong>strictly lower</strong> than the current market price to be accepted.</li>
                    <li>The <strong>Administrator's decision is final, supreme, and binding</strong> in all matters — disputes, bid validity, timing, vendor eligibility, and blacklisting — without exception or appeal.</li>
                    <li>The Administrator may end, extend, void, or cancel the auction; disqualify or remove any vendor (including the winner); and blacklist vendors. <strong>Reinstatement is solely at the Administrator's discretion.</strong></li>
                    <li>Participation constitutes <strong>full and unconditional acceptance</strong> of all the above.</li>
                  </ul>
                </div>

                {/* Marathi */}
                <div className="px-4 pt-3 pb-3 border-b border-slate-200">
                  <p className="text-[10px] font-black uppercase tracking-widest text-orange-600 mb-2 border-b border-orange-100 pb-1">मराठी</p>
                  <ul className="space-y-1.5 text-slate-700 list-disc list-inside leading-relaxed text-sm">
                    <li>हा एक <strong>कायदेशीरदृष्ट्या बंधनकारक रिव्हर्स लिलाव</strong> आहे. बोली म्हणजे पुरवठ्याची ठाम वचनबद्धता. सर्व बोली अंतिम असतात. <strong>ऑटो-बिडिंग कायमस्वरूपी अक्षम आहे.</strong></li>
                    <li>गुप्तता राखली जाते. एकूण बोली सद्य बाजार किमतीपेक्षा <strong>कमी</strong> असणे आवश्यक आहे.</li>
                    <li>लिलावाच्या प्रत्येक बाबतीत — वाद, बोली वैधता, कालावधी, विक्रेता पात्रता आणि काळ्या यादीत — <strong>प्रशासकाचा निर्णय अंतिम, सर्वोच्च आणि बंधनकारक</strong> आहे. कोणताही अपवाद नाही.</li>
                    <li>प्रशासक लिलाव संपवू, वाढवू, रद्द करू शकतो; कोणत्याही विक्रेत्याला — विजेत्यासह — काढून टाकू शकतो; आणि काळ्या यादीत टाकू शकतो. <strong>काळ्या यादीतून काढणे पूर्णपणे प्रशासकाच्या विवेकाधीन आहे.</strong></li>
                    <li>सहभागी होणे म्हणजे वरील सर्व अटींना <strong>बिनशर्त स्वीकृती</strong> होय.</li>
                  </ul>
                </div>

                {/* Hindi */}
                <div className="px-4 pt-3 pb-3">
                  <p className="text-[10px] font-black uppercase tracking-widest mb-2 border-b pb-1" style={{ color: 'oklch(0.74 0.3 146.74)', borderColor: 'oklch(0.92 0.1 146.74)' }}>हिन्दी</p>
                  <ul className="space-y-1.5 text-slate-700 list-disc list-inside leading-relaxed text-sm">
                    <li>यह एक <strong>कानूनी रूप से बाध्यकारी रिवर्स नीलामी</strong> है। बोली आपूर्ति की दृढ़ प्रतिबद्धता है। सभी बोलियाँ अंतिम हैं। <strong>ऑटो-बिडिंग स्थायी रूप से अक्षम है।</strong></li>
                    <li>गुमनामी सुनिश्चित है। कुल बोली वर्तमान बाजार मूल्य से <strong>कम</strong> होनी चाहिए।</li>
                    <li>इस नीलामी के प्रत्येक मामले में — विवाद, बोली वैधता, समय, विक्रेता योग्यता और काली सूची — <strong>प्रशासक का निर्णय अंतिम, सर्वोच्च और बाध्यकारी</strong> है। कोई अपवाद नहीं।</li>
                    <li>प्रशासक नीलामी समाप्त, विस्तारित या रद्द कर सकता है; किसी भी विक्रेता को — विजेता सहित — हटा सकता है; और काली सूची में डाल सकता है। <strong>काली सूची से बाहर निकालना पूरी तरह प्रशासक के विवेक पर निर्भर है।</strong></li>
                    <li>भाग लेना उपरोक्त सभी शर्तों की <strong>पूर्ण और बिना शर्त स्वीकृति</strong> मानी जाएगी।</li>
                  </ul>
                </div>

              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 shrink-0">
              <p className="text-xs text-slate-500 text-center mb-3">By clicking <strong>"I Agree"</strong>, you confirm you have read and accept all the above terms.</p>
              <button
                onClick={() => { sessionStorage.setItem(`ack_${id}`, 'true'); setHasAcknowledged(true); }}
                className="w-full bg-slate-900 hover:bg-slate-700 active:scale-95 text-white font-black text-base py-3.5 rounded-xl transition shadow-lg"
              >
                ✓ &nbsp; I Agree &nbsp;/&nbsp; मी सहमत आहे &nbsp;/&nbsp; मैं सहमत हूँ
              </button>
            </div>
          </div>
        </div>
      )}

      {broadcasts.length > 0 && (
        <div className="bg-red-100 border-y-4 border-red-600 py-2 z-50">
          <marquee className="text-red-600 font-black text-2xl uppercase tracking-widest animate-pulse" scrollamount="10">
            {broadcasts.map((b, idx) => <span key={idx} className="mx-8">⚠️ {b.message}</span>)}
          </marquee>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 mt-6 pb-40">
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => navigate(localStorage.getItem('adminToken') ? '/admin' : '/vendor/dashboard')} className="flex items-center text-sm font-bold bg-white border border-slate-200 px-4 py-2 rounded-lg shadow-sm">
            <ChevronRight className="w-4 h-4 mr-2 rotate-180" /> Back
          </button>
          {isEndingSoon && roomState.status !== 'closed' && (
            <span className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-xs font-bold animate-pulse flex items-center">
              <AlertCircle className="w-3 h-3 mr-1"/> Soft Close Active
            </span>
          )}
        </div>

        {/* Header Dashboard */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-6">
          <div className="flex flex-col items-center sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Title + badges — centred on mobile, left on desktop */}
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2 leading-tight break-words">
                {roomState.auctionName || (roomState.items && roomState.items.length > 1 ? `Basket of ${roomState.items.length} Items` : (roomState.items?.[0]?.name || roomState.product?.name || 'Multi-Item Auction'))}
              </h1>
              <div className="flex items-center justify-center sm:justify-start flex-wrap gap-2 text-sm text-slate-500">
                <span className="flex items-center gap-1 whitespace-nowrap">
                  <Lock className="w-4 h-4 text-emerald-500 flex-shrink-0"/> Anonymity Active
                </span>
                <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700 font-bold text-xs whitespace-nowrap">
                  {roomState.status.toUpperCase()}
                </span>
              </div>
            </div>
            {/* Time Left — always centred on mobile, right on desktop */}
            <div className="text-center sm:text-right flex-shrink-0 border-t border-slate-100 pt-4 w-full sm:w-auto sm:border-t-0 sm:pt-0">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Time Left</p>
              <p className={`text-4xl font-black font-mono ${isEndingSoon ? 'text-red-600 animate-pulse' : 'text-slate-800'}`}>
                {timeLeft || '--:--'}
              </p>
            </div>
          </div>
        </div>


        {/* Sticky Nav Bar */}
        <div ref={navRef} className="sticky top-0 z-40 bg-slate-100/90 backdrop-blur-md py-4 border-b border-slate-200 mb-6 flex gap-2 overflow-x-auto hide-scrollbar">
          {items.map((it, idx) => (
            <a key={idx} href={`#item-${idx}`} className="whitespace-nowrap px-4 py-2 bg-white border border-slate-200 text-slate-700 font-bold text-sm rounded-full shadow-sm hover:border-blue-500 hover:text-blue-600 transition">
              {it.name}
            </a>
          ))}
        </div>

        {/* Item Cards Stack */}
        <div className="space-y-6">
          {items.map((it, idx) => {
            const currentItemLowest = roomState.itemLowestBids?.find(lb => lb.itemName === it.name)?.amount || (it.basePrice * it.quantity);
            const history = bidsHistory[it.name] || [];
            return (
              <div key={idx} id={`item-${idx}`} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row scroll-mt-24">
                
                {/* Left: Info & Input */}
                <div className="p-6 md:w-2/3 border-b md:border-b-0 md:border-r border-slate-100 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-xl font-bold text-slate-900">{it.name}</h3>
                      <div className="text-right">
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">Base Price</p>
                        <p className="text-sm text-slate-600">{money(it.basePrice)} × {it.quantity}</p>
                      </div>
                    </div>
                    <div className="flex gap-4 mb-6">
                      <div className="bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-100 flex-1">
                        <p className="text-xs text-emerald-600 font-bold uppercase mb-1">Current Lowest</p>
                        <p className="text-2xl font-black text-emerald-700">{money(currentItemLowest)}</p>
                      </div>
                      <div className="bg-amber-50 px-4 py-2 rounded-lg border border-amber-100">
                        <p className="text-xs text-amber-600 font-bold uppercase mb-1">Decrement</p>
                        <p className="text-lg font-bold text-amber-700">{money(it.decrementValue)}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Your Bid (Total for {it.quantity} qty)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">Rs.</span>
                      <input 
                        type="number" 
                        value={itemInputs[it.name] || ''}
                        onChange={(e) => handleInputChange(it.name, e.target.value)}
                        disabled={roomState.status === 'closed'}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl font-bold text-lg text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition disabled:opacity-50"
                      />
                    </div>
                  </div>
                </div>

                {/* Right: History */}
                <div className="p-6 md:w-1/3 bg-slate-50/50">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1"><TrendingDown className="w-3 h-3"/> Recent Bids</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {history.length > 0 ? history.map((hb, hidx) => (
                      <div key={hidx} className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm text-sm">
                        <span className="font-bold text-slate-700">{money(hb.amount)}</span>
                        <span className="text-xs text-slate-400">{hb.time.toLocaleTimeString('en-IN')}</span>
                      </div>
                    )) : (
                      <p className="text-xs text-slate-400 text-center py-4">No bids yet for this item.</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Scroll Top */}
      {showScrollTop && (
        <button onClick={scrollToNav} className="fixed bottom-32 right-6 bg-slate-900 hover:bg-slate-700 text-white p-3 rounded-full shadow-2xl transition z-50">
          <ArrowUp className="w-6 h-6" />
        </button>
      )}

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-50 p-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex-1">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Grand Total Contract Value</p>
            <p className="text-3xl font-black text-slate-900">{money(getGrandTotalInput())}</p>
            <p className="text-xs text-slate-500 mt-1">Current Market Leader: <span className="font-bold text-blue-600">{money(roomState.currentLowestBid || roomState.grandTotalContractValue || (roomState.basePrice*(roomState.quantity||1)))}</span></p>
          </div>
          <button 
            onClick={handleSubmit}
            disabled={roomState.status === 'closed'}
            className="w-full sm:w-1/3 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black text-lg py-4 rounded-xl shadow-lg transition disabled:opacity-50 disabled:active:scale-100"
          >
            SUBMIT BID
          </button>
        </div>
      </div>
    </>
  );
};
export default BiddingRoom;

