import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { Users, LayoutDashboard, FileBarChart, Plus, CheckCircle, Monitor, Activity, LogOut, Package, Lock, Eye, EyeOff, Gavel, Trash2 } from "lucide-react";

const API = "http://localhost:5000";
const defaultItem = () => ({ name: "", basePrice: "", quantity: 1, decrementValue: "", image: null, documents: [] });

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [vendors, setVendors] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [reports, setReports] = useState({ totalSavings: 0, events: [] });
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [openCardModal, setOpenCardModal] = useState(null);
  const [selectedReports, setSelectedReports] = useState([]);
  const [selectedVendorsForAction, setSelectedVendorsForAction] = useState([]);
  const [selectedAuctionsForAction, setSelectedAuctionsForAction] = useState([]);
  const [reportFilters, setReportFilters] = useState({ year: "All", quarter: "All", month: "All", vendor: "All" });
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [viewDetails, setViewDetails] = useState(null);
  const [newVendor, setNewVendor] = useState({ _id: "", companyName: "", email: "", phone: "", contactPerson: "", password: "" });
  const [vendorFiles, setVendorFiles] = useState(null);
  const [vendorSearch, setVendorSearch] = useState("");
  const [passwordData, setPasswordData] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [showPwd, setShowPwd] = useState({ old: false, new: false, confirm: false });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [auctionItems, setAuctionItems] = useState([defaultItem()]);
  const [auctionSchedule, setAuctionSchedule] = useState({ startTime: "", endTime: "", selectedVendors: [] });

  const addItem = () => setAuctionItems(prev => [...prev, defaultItem()]);
  const removeItem = (idx) => setAuctionItems(prev => prev.filter((_, i) => i !== idx));
  const updateItem = (idx, field, value) => setAuctionItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  const grandTotalPreview = auctionItems.reduce((sum, it) => sum + (Number(it.basePrice)||0)*(Number(it.quantity)||0), 0);
  const safeMath = (val) => Number(val) || 0;
  const fmtDT = (dt) => new Date(dt).toLocaleString("en-GB", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit", hour12:true }).toUpperCase();
  const roomDisplayName = (room) => room.items && room.items.length > 1 ? `Basket of ${room.items.length} Items` : (room.product?.name || room.items?.[0]?.name || "Unknown");
  const roomTotalValue = (room) => room.grandTotalContractValue || (safeMath(room.basePrice) * safeMath(room.quantity)) || 0;
  const statusBadge = (s) => {
    const cls = s==="active" ? "border-green-200 text-green-700 bg-green-50" : s==="completed"||s==="closed" ? "border-slate-200 text-slate-500 bg-slate-50" : "border-amber-200 text-amber-700 bg-amber-50";
    return <span className={"px-2 py-0.5 text-xs font-bold uppercase border rounded " + cls}>{s}</span>;
  };

  const handleCreateVendor = async (e) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(newVendor.phone)) return toast.error("Phone number must be exactly 10 digits.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newVendor.email)) return toast.error("Please enter a valid email address.");
    try {
      const formData = new FormData();
      Object.keys(newVendor).forEach(key => { if (key !== "_id" || newVendor._id) formData.append(key, newVendor[key]); });
      if (vendorFiles) for (let i = 0; i < vendorFiles.length; i++) formData.append("documents", vendorFiles[i]);
      const token = localStorage.getItem("adminToken");
      if (newVendor._id) {
        await axios.put(`${API}/api/admin/vendors/${newVendor._id}`, formData, { headers: { "Content-Type": "multipart/form-data", Authorization: `Bearer ${token}` } });
        toast.success("Vendor updated successfully");
      } else {
        await axios.post(`${API}/api/admin/vendors`, formData, { headers: { "Content-Type": "multipart/form-data", Authorization: `Bearer ${token}` } });
        toast.success("Vendor created successfully");
      }
      setShowVendorModal(false); setNewVendor({ _id: "", companyName: "", email: "", phone: "", contactPerson: "", password: "" }); setVendorFiles(null); fetchData();
    } catch (err) { toast.error(err.response?.data?.message || "Error saving vendor"); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) return toast.error("New passwords don't match");
    if (passwordData.newPassword.length < 5 || passwordData.newPassword.length > 10) return toast.error("Password must be 5-10 characters");
    try {
      const token = localStorage.getItem("adminToken");
      const res = await axios.post(`${API}/api/admin/change-password`, { currentPassword: passwordData.currentPassword, newPassword: passwordData.newPassword }, { headers: { Authorization: "Bearer " + token } });
      toast.success(res.data.message || "Password changed successfully");
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) { toast.error(err.response?.data?.message || "Failed to change password"); }
  };

  const handleCreateAuction = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    for (let i = 0; i < auctionItems.length; i++) {
      const it = auctionItems[i];
      if (!it.name?.trim()) { toast.error(`Item ${i+1}: Name is required.`); setIsSubmitting(false); return; }
      if (!it.basePrice || Number(it.basePrice) <= 0) { toast.error(`Item ${i+1}: Valid base price is required.`); setIsSubmitting(false); return; }
      if (!it.decrementValue || Number(it.decrementValue) <= 0) { toast.error(`Item ${i+1}: Valid decrement step is required.`); setIsSubmitting(false); return; }
      if (!it.quantity || Number(it.quantity) < 1) { toast.error(`Item ${i+1}: Quantity must be at least 1.`); setIsSubmitting(false); return; }
    }
    if (!auctionSchedule.startTime || !auctionSchedule.endTime) { toast.error("Both Start Time and End Time are required."); setIsSubmitting(false); return; }
    if (auctionSchedule.selectedVendors.length === 0) { toast.error("You must invite at least one vendor."); setIsSubmitting(false); return; }
    if (new Date(auctionSchedule.endTime) <= new Date(auctionSchedule.startTime)) { toast.error("End time must be after start time."); setIsSubmitting(false); return; }
    if (new Date(auctionSchedule.endTime) <= new Date()) { toast.error("Auction end time must be in the future."); setIsSubmitting(false); return; }
    try {
      const formData = new FormData();
      formData.append("items", JSON.stringify(auctionItems.map(it => ({ name: it.name, basePrice: Number(it.basePrice), quantity: Number(it.quantity), decrementValue: Number(it.decrementValue) }))));
      formData.append("startTime", auctionSchedule.startTime);
      formData.append("endTime", auctionSchedule.endTime);
      formData.append("vendors", JSON.stringify(auctionSchedule.selectedVendors));
      auctionItems.forEach((it, idx) => {
        if (it.image) formData.append(`item_${idx}_image`, it.image);
        if (it.documents && it.documents.length) for (let d = 0; d < it.documents.length; d++) formData.append(`item_${idx}_documents`, it.documents[d]);
      });
      await axios.post(`${API}/api/admin/rooms`, formData, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Auction created! Invitation emails sent to vendors.");
      setActiveTab("rooms"); setAuctionItems([defaultItem()]); setAuctionSchedule({ startTime: "", endTime: "", selectedVendors: [] }); fetchData();
    } catch (err) { toast.error(err.response?.data?.message || err.message || "Error creating auction"); }
    finally { setIsSubmitting(false); }
  };

  const fetchData = async () => {
    try {
      const [vRes, rRes, roomRes] = await Promise.all([
        axios.get(`${API}/api/admin/vendors`),
        axios.get(`${API}/api/admin/reports`),
        axios.get(`${API}/api/admin/rooms`),
      ]);
      setVendors(vRes.data); setReports(rRes.data); setRooms(roomRes.data);
    } catch { toast.error("Failed to load dashboard data"); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleApprove = async (id) => {
    try { await axios.put(`${API}/api/admin/vendors/${id}/approve`); toast.success("Vendor approved"); fetchData(); }
    catch { toast.error("Error approving vendor"); }
  };
  const toggleBlacklist = async (id) => {
    try { const res = await axios.put(`${API}/api/admin/vendors/${id}/blacklist`); toast.success(res.data.message); fetchData(); }
    catch { toast.error("Error updating vendor status"); }
  };

  const pendingCount = vendors.filter(v => v.status !== "approved").length;
  const navItems = [
    { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { id: "rooms", icon: Gavel, label: "Auctions" },
    { id: "vendors", icon: Users, label: "Vendors" },
    { id: "reports", icon: FileBarChart, label: "Financial Reports" },
    { id: "change-password", icon: Lock, label: "Change Password" },
  ];

  const filterReports = () => reports.events.filter(e => {
    if (reportFilters.vendor !== "All" && e.winner !== reportFilters.vendor) return false;
    const d = new Date(e.endTime || e.startTime); if (!d) return true;
    const month = d.getMonth(), year = d.getFullYear();
    if (reportFilters.year !== "All") {
      const fyStart = reportFilters.year === "FY24" ? 2024 : reportFilters.year === "FY25" ? 2025 : 2026;
      if (!((year === fyStart && month >= 3) || (year === fyStart+1 && month <= 2))) return false;
    }
    if (reportFilters.quarter !== "All") { const qMap = {Q1:[3,4,5],Q2:[6,7,8],Q3:[9,10,11],Q4:[0,1,2]}; if (!qMap[reportFilters.quarter].includes(month)) return false; }
    if (reportFilters.month !== "All") { const mMap = {January:0,February:1,March:2,April:3,May:4,June:5,July:6,August:7,September:8,October:9,November:10,December:11}; if (mMap[reportFilters.month] !== month) return false; }
    return true;
  });

  return (
    <div className="flex min-h-screen bg-slate-100 w-full fixed inset-0 overflow-hidden">
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
        <span className="font-black text-lg text-slate-900 uppercase tracking-tight flex items-center gap-2"><Monitor className="w-5 h-5" /> Admin</span>
        <button onClick={() => setIsSidebarOpen(o => !o)} className="p-1 text-slate-700">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/></svg>
        </button>
      </div>
      <aside className={"fixed md:relative z-30 h-full flex flex-col bg-white border-r border-slate-200 transition-all duration-300 shrink-0 top-0 " + (isSidebarOpen ? "w-60 translate-x-0" : "w-[72px] -translate-x-full md:translate-x-0")}>
        <div className="flex items-center gap-4 px-5 py-5 border-b border-slate-200">
          <button onClick={() => setIsSidebarOpen(o => !o)} className="w-9 h-9 bg-slate-900 hover:bg-slate-700 rounded-xl flex items-center justify-center flex-shrink-0 transition active:scale-95 group"><Monitor className="w-5 h-5 text-white" /></button>
          {isSidebarOpen && <span className="font-black text-xl uppercase tracking-tight text-slate-900 whitespace-nowrap">Admin</span>}
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ id, icon: Icon, label }) => {
            const active = activeTab === id || (id === "rooms" && activeTab === "create-auction");
            return (
              <button key={id} onClick={() => setActiveTab(id)} title={label}
                className={"w-full flex items-center rounded-xl text-sm font-semibold transition-all duration-150 group relative " + (isSidebarOpen ? "px-4 py-3 gap-3 " : "justify-center py-3.5 ") + (active ? "bg-slate-900 text-white shadow-md" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900")}>
                <Icon className="w-5 h-5 flex-shrink-0" />
                {isSidebarOpen && <span className="truncate">{label}</span>}
                {id === "vendors" && pendingCount > 0 && (isSidebarOpen ? <span className="ml-auto bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold leading-none">{pendingCount}</span> : <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />)}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-slate-200">
          {isSidebarOpen ? (
            <div className="flex items-center px-3 py-3 gap-2">
              <div className="flex-1 text-xs text-slate-400 text-center font-medium truncate">Light Mode</div>
              <div className="w-px h-6 bg-slate-200" />
              <button onClick={() => { localStorage.removeItem("adminToken"); navigate("/vendor/login"); }} className="flex items-center gap-1.5 text-red-600 font-semibold text-xs px-2 py-1.5 rounded-lg hover:bg-red-50 transition" title="Log Out">
                <LogOut className="w-4 h-4" /> Log Out
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center py-3 gap-1">
              <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wide px-1">Light</span>
              <div className="w-8 h-px bg-slate-200" />
              <button onClick={() => { localStorage.removeItem("adminToken"); navigate("/vendor/login"); }} className="w-10 h-10 flex items-center justify-center rounded-xl text-red-600 hover:bg-red-50 transition" title="Log Out"><LogOut className="w-5 h-5" /></button>
            </div>
          )}
        </div>
      </aside>
      {isSidebarOpen && <div className="md:hidden fixed inset-0 z-20 bg-black/30" onClick={() => setIsSidebarOpen(false)} />}
      <main className="flex-1 overflow-y-auto md:pt-0 pt-14">
        <div className="max-w-6xl mx-auto p-6 md:p-8 pb-20">

          {activeTab === "dashboard" && (
            <div>
              <div className="mb-8"><h2 className="text-2xl font-black text-slate-900 flex items-center gap-3"><LayoutDashboard className="w-6 h-6 text-blue-600 animate-pulse" /> Dashboard</h2></div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[{key:"savings",label:"Total Savings",value:"Rs."+safeMath(reports.totalSavings).toLocaleString("en-IN"),color:"text-emerald-600"},{key:"spend",label:"Total Spend",value:"Rs."+reports.events.reduce((a,e)=>a+safeMath(e.winningBid),0).toLocaleString("en-IN"),color:"text-blue-600"},{key:"completed",label:"Completed Auctions",value:reports.events.length,color:"text-purple-600"},{key:"vendors",label:"Total Vendors",value:vendors.length,color:"text-amber-600"}].map(c => (
                  <div key={c.key} onClick={() => setOpenCardModal(c.key)} className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm hover:shadow-md cursor-pointer transition-all hover:-translate-y-0.5 active:scale-[0.98] text-center">
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">{c.label}</p>
                    <p className={"text-3xl font-black " + c.color}>{c.value}</p>
                  </div>
                ))}
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2"><Activity className="w-5 h-5 text-green-500 animate-pulse" /> Live Auction Rooms</h3>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                      <tr><th className="px-5 py-3">ID</th><th className="px-5 py-3">Product / Basket</th><th className="px-5 py-3">Total Contract Value</th><th className="px-5 py-3">Start Time</th><th className="px-5 py-3">Status</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rooms.filter(r=>r.status==="active").length===0 ? <tr><td colSpan="5" className="px-5 py-8 text-center text-slate-400">No live auctions right now.</td></tr>
                        : rooms.filter(r=>r.status==="active").map(room => (
                          <tr key={room._id} onClick={() => navigate("/admin/room/"+room._id)} className="hover:bg-slate-50 transition-colors cursor-pointer">
                            <td className="px-5 py-4 font-mono text-slate-400 text-xs">{room._id.slice(-6)}</td>
                            <td className="px-5 py-4 font-semibold text-slate-900">{roomDisplayName(room)}</td>
                            <td className="px-5 py-4 text-slate-900 font-bold">Rs.{roomTotalValue(room).toLocaleString("en-IN")}</td>
                            <td className="px-5 py-4 text-slate-500">{fmtDT(room.startTime)}</td>
                            <td className="px-5 py-4">{statusBadge(room.status)}</td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "rooms" && (
            <div>
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3"><Gavel className="w-6 h-6 text-blue-600" /> Auctions</h2>
                <button onClick={() => setActiveTab("create-auction")} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition shadow-sm active:scale-95"><Plus className="w-4 h-4" /> New Auction</button>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">{rooms.length} record{rooms.length!==1?"s":""}</span>
                    {selectedAuctionsForAction.length>0&&<button onClick={async()=>{if(window.confirm(`Delete ${selectedAuctionsForAction.length} auction(s)?`)){const token=localStorage.getItem("adminToken");try{for(let id of selectedAuctionsForAction)await axios.delete(`${API}/api/admin/rooms/${id}`,{headers:{Authorization:"Bearer "+token}});toast.success(selectedAuctionsForAction.length+" auction(s) deleted");setSelectedAuctionsForAction([]);fetchData();}catch{toast.error("Failed to delete auctions");}}}} className="text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-lg font-bold hover:bg-red-200 transition">Delete ({selectedAuctionsForAction.length})</button>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={()=>{const data=selectedAuctionsForAction.length>0?rooms.filter(r=>selectedAuctionsForAction.includes(r._id)):rooms;const csv="data:text/csv;charset=utf-8,"+["ID,Product,Total Contract Value,Start Time,Status"].concat(data.map(r=>[r._id.slice(-6),roomDisplayName(r),roomTotalValue(r),fmtDT(r.startTime),r.status].join(","))).join("\n");const a=document.createElement("a");a.href=encodeURI(csv);a.download="auctions.csv";document.body.appendChild(a);a.click();document.body.removeChild(a);}} className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg font-bold hover:bg-blue-200 transition">CSV</button>
                    <button onClick={async()=>{const XLSX=await import("xlsx");const data=selectedAuctionsForAction.length>0?rooms.filter(r=>selectedAuctionsForAction.includes(r._id)):rooms;const ws=XLSX.utils.json_to_sheet(data.map(r=>({ID:r._id.slice(-6),Product:roomDisplayName(r),"Total Contract Value":roomTotalValue(r),"Start Time":fmtDT(r.startTime),Status:r.status})));const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Auctions");XLSX.writeFile(wb,"auctions.xlsx");}} className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg font-bold hover:bg-emerald-200 transition">Excel</button>
                    <button onClick={async()=>{const{default:jsPDF}=await import("jspdf");const{default:autoTable}=await import("jspdf-autotable");const data=selectedAuctionsForAction.length>0?rooms.filter(r=>selectedAuctionsForAction.includes(r._id)):rooms;const doc=new jsPDF();doc.setFontSize(14);doc.text("Auctions List",14,16);autoTable(doc,{startY:22,head:[["ID","Product","Total Value","Start","Status"]],body:data.map(r=>[r._id.slice(-6),roomDisplayName(r),"Rs."+roomTotalValue(r).toLocaleString("en-IN"),fmtDT(r.startTime),r.status]),styles:{fontSize:8},headStyles:{fillColor:[15,23,42]}});doc.save("auctions.pdf");}} className="text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-lg font-bold hover:bg-red-200 transition">PDF</button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 w-10"><input type="checkbox" checked={rooms.length>0&&selectedAuctionsForAction.length===rooms.length} onChange={e=>setSelectedAuctionsForAction(e.target.checked?rooms.map(r=>r._id):[])} className="rounded" /></th>
                        <th className="px-5 py-3">ID</th><th className="px-5 py-3">Product / Basket</th><th className="px-5 py-3">Items</th><th className="px-5 py-3">Total Contract Value</th><th className="px-5 py-3">Start Time</th><th className="px-5 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rooms.length===0?<tr><td colSpan="7" className="px-5 py-8 text-center text-slate-400">No auctions yet.</td></tr>
                        :rooms.map(room=>(
                          <tr key={room._id} onClick={()=>navigate("/admin/room/"+room._id)} className="hover:bg-slate-50 transition-colors cursor-pointer">
                            <td className="px-4 py-4" onClick={e=>e.stopPropagation()}><input type="checkbox" checked={selectedAuctionsForAction.includes(room._id)} onChange={e=>setSelectedAuctionsForAction(e.target.checked?[...selectedAuctionsForAction,room._id]:selectedAuctionsForAction.filter(id=>id!==room._id))} className="rounded" /></td>
                            <td className="px-5 py-4 font-mono text-slate-400 text-xs">{room._id.slice(-6)}</td>
                            <td className="px-5 py-4 font-semibold text-slate-900">{roomDisplayName(room)}</td>
                            <td className="px-5 py-4 text-slate-500 text-xs">{room.items&&room.items.length>1?`${room.items.length} items`:"1 item"}</td>
                            <td className="px-5 py-4 text-slate-900 font-bold">Rs.{roomTotalValue(room).toLocaleString("en-IN")}</td>
                            <td className="px-5 py-4 text-slate-500">{fmtDT(room.startTime)}</td>
                            <td className="px-5 py-4">{statusBadge(room.status)}</td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "create-auction" && (
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center gap-3 mb-8">
                <button onClick={()=>setActiveTab("rooms")} className="text-slate-400 hover:text-slate-900 transition p-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
                </button>
                <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3"><Plus className="w-6 h-6 text-blue-600" /> Create Auction</h2>
              </div>
              <form onSubmit={handleCreateAuction} className="space-y-5">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900 flex items-center gap-2"><Package className="w-4 h-4 text-blue-500" /> Auction Items</h4>
                    <button type="button" onClick={addItem} className="flex items-center gap-1.5 text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-blue-700 transition"><Plus className="w-4 h-4" /> Add Item</button>
                  </div>
                  {auctionItems.map((item, idx) => (
                    <div key={idx} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                        <span className="font-bold text-slate-700 text-sm">Item {idx+1}{item.name ? ` — ${item.name}` : ""}</span>
                        {auctionItems.length > 1 && <button type="button" onClick={()=>removeItem(idx)} className="flex items-center gap-1 text-red-500 hover:text-red-700 text-xs font-bold px-2 py-1 rounded hover:bg-red-50 transition"><Trash2 className="w-3.5 h-3.5" /> Remove</button>}
                      </div>
                      <div className="p-4 space-y-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">Item Name *</label>
                          <input type="text" value={item.name} onChange={e=>updateItem(idx,"name",e.target.value)} placeholder="e.g. Laptop, Mouse Pad..." className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-slate-900" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div><label className="block text-xs font-bold text-slate-600 mb-1">Base Price / Unit *</label><input type="number" min="1" value={item.basePrice} onChange={e=>updateItem(idx,"basePrice",e.target.value)} placeholder="Rs." className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-slate-900" /></div>
                          <div><label className="block text-xs font-bold text-slate-600 mb-1">Quantity *</label><input type="number" min="1" value={item.quantity} onChange={e=>updateItem(idx,"quantity",e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-slate-900" /></div>
                          <div><label className="block text-xs font-bold text-slate-600 mb-1">Decrement Step *</label><input type="number" min="1" value={item.decrementValue} onChange={e=>updateItem(idx,"decrementValue",e.target.value)} placeholder="Rs." className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-slate-900" /></div>
                        </div>
                        {item.basePrice && item.quantity && <div className="p-2 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-between text-xs"><span className="font-bold text-blue-700">Item Contract Value:</span><span className="font-black text-blue-900">Rs.{(Number(item.basePrice)*Number(item.quantity)).toLocaleString("en-IN")}</span></div>}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">Item Image (optional)</label>
                            <input type="file" accept="image/*" onChange={e=>{const file=e.target.files[0];if(file&&file.size>50*1024*1024){toast.error("Image too large. Max 50 MB.");e.target.value="";return;}updateItem(idx,"image",file);}} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs cursor-pointer" />
                            {item.image && <div className="mt-2 relative"><img src={URL.createObjectURL(item.image)} alt="preview" className="w-full h-24 object-cover rounded-lg border border-slate-200" /><button type="button" onClick={()=>updateItem(idx,"image",null)} className="absolute top-1 right-1 bg-white border text-slate-600 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold hover:bg-red-50 hover:text-red-600">x</button></div>}
                          </div>
                          <div><label className="block text-xs font-bold text-slate-600 mb-1">Documents (PDF, Excel, Word)</label><input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx" onChange={e=>updateItem(idx,"documents",Array.from(e.target.files))} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs cursor-pointer" /></div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {grandTotalPreview > 0 && <div className="p-4 bg-slate-900 text-white rounded-xl flex items-center justify-between"><span className="font-bold text-sm">Grand Total Contract Value ({auctionItems.length} item{auctionItems.length>1?"s":""})</span><span className="text-2xl font-black">Rs.{grandTotalPreview.toLocaleString("en-IN")}</span></div>}
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                  <h4 className="font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2"><svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Schedule</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className="block text-sm font-bold text-slate-700 mb-1">Start Time</label><input required type="datetime-local" value={auctionSchedule.startTime} onChange={e=>setAuctionSchedule({...auctionSchedule,startTime:e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-slate-900 text-slate-900 text-sm" /></div>
                    <div><label className="block text-sm font-bold text-slate-700 mb-1">End Time</label><input required type="datetime-local" value={auctionSchedule.endTime} onChange={e=>setAuctionSchedule({...auctionSchedule,endTime:e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-slate-900 text-slate-900 text-sm" /></div>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <h4 className="font-bold text-slate-900 border-b border-slate-100 pb-2 mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-purple-500" /> Invite Vendors</h4>
                  <input type="text" placeholder="Search vendors..." value={vendorSearch} onChange={e=>setVendorSearch(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-slate-900 text-slate-900 text-sm mb-4" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                    {vendors.filter(v=>v.status==="approved"&&(v.companyName.toLowerCase().includes(vendorSearch.toLowerCase())||v.email.toLowerCase().includes(vendorSearch.toLowerCase()))).map(v=>(
                      <div key={v._id} onClick={()=>{if(v.blacklisted){toast.error("Cannot invite a blacklisted vendor.",{duration:4000});return;}const s=auctionSchedule.selectedVendors.includes(v._id)?auctionSchedule.selectedVendors.filter(id=>id!==v._id):[...auctionSchedule.selectedVendors,v._id];setAuctionSchedule({...auctionSchedule,selectedVendors:s});}} className={"flex items-center p-3 border rounded-xl transition "+(v.blacklisted?"opacity-70 bg-slate-100 border-slate-200 cursor-not-allowed":auctionSchedule.selectedVendors.includes(v._id)?"bg-blue-50 border-blue-300 cursor-pointer":"bg-slate-50 border-slate-200 hover:bg-slate-100 cursor-pointer")}>
                        <input type="checkbox" readOnly checked={auctionSchedule.selectedVendors.includes(v._id)} className="w-4 h-4 rounded" />
                        <div className="ml-3 flex-1">
                          <span className="flex items-center gap-2 text-sm font-bold text-slate-900">{v.companyName}{v.blacklisted&&<span className="text-[9px] font-black uppercase bg-red-100 text-red-700 px-1.5 py-0.5 rounded border border-red-200">Blacklisted</span>}</span>
                          <span className="block text-xs text-slate-400">{v.email}</span>
                        </div>
                      </div>
                    ))}
                    {vendors.filter(v=>v.status==="approved").length===0&&<p className="text-sm text-slate-400 col-span-2 p-2">No approved vendors available.</p>}
                  </div>
                  {auctionSchedule.selectedVendors.length>0&&(<div className="mt-4 pt-3 border-t border-slate-100"><p className="text-xs font-bold text-slate-400 uppercase mb-2">Selected ({auctionSchedule.selectedVendors.length})</p><div className="flex flex-wrap gap-2">{auctionSchedule.selectedVendors.map(id=>{const v=vendors.find(v=>v._id===id);return v?(<span key={id} className="flex items-center gap-1 bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-full">{v.companyName}<button type="button" onClick={()=>setAuctionSchedule({...auctionSchedule,selectedVendors:auctionSchedule.selectedVendors.filter(s=>s!==id)})} className="hover:text-red-600 ml-0.5 font-black">x</button></span>):null;})}</div></div>)}
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">Invitation emails with login credentials will be sent to all selected vendors upon creation. A reminder will be sent 5 minutes before the auction starts.</div>
                <div className="flex gap-3">
                  <button type="button" onClick={()=>setActiveTab("rooms")} className="flex-1 py-3 bg-slate-100 text-slate-900 font-bold rounded-xl hover:bg-slate-200 transition">Cancel</button>
                  <button type="submit" disabled={isSubmitting} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition disabled:opacity-60 shadow-sm">{isSubmitting?"Creating & Sending Emails...":"Create Auction"}</button>
                </div>
              </form>
            </div>
          )}

          {activeTab === "vendors" && (
            <div>
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3"><Users className="w-6 h-6 text-blue-600" /> Vendors</h2>
                <button onClick={()=>setShowVendorModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition shadow-sm active:scale-95"><Plus className="w-4 h-4" /> Add Vendor</button>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">{vendors.length} record{vendors.length!==1?"s":""}</span>
                    {selectedVendorsForAction.length>0&&<button onClick={async()=>{if(window.confirm(`Delete ${selectedVendorsForAction.length} vendor(s)?`)){const token=localStorage.getItem("adminToken");try{for(let id of selectedVendorsForAction)await axios.delete(`${API}/api/admin/vendors/${id}`,{headers:{Authorization:"Bearer "+token}});toast.success(selectedVendorsForAction.length+" vendor(s) deleted");setSelectedVendorsForAction([]);fetchData();}catch{toast.error("Failed to delete vendors");}}}} className="text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-lg font-bold hover:bg-red-200 transition">Delete ({selectedVendorsForAction.length})</button>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={()=>{const data=selectedVendorsForAction.length>0?vendors.filter(v=>selectedVendorsForAction.includes(v._id)):vendors;const csv="data:text/csv;charset=utf-8,"+["Company,Contact,Email,Phone,Status"].concat(data.map(v=>[v.companyName,v.contactPerson,v.email,v.phone,v.status].join(","))).join("\n");const a=document.createElement("a");a.href=encodeURI(csv);a.download="vendors.csv";document.body.appendChild(a);a.click();document.body.removeChild(a);}} className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg font-bold hover:bg-blue-200 transition">CSV</button>
                    <button onClick={async()=>{const XLSX=await import("xlsx");const data=selectedVendorsForAction.length>0?vendors.filter(v=>selectedVendorsForAction.includes(v._id)):vendors;const ws=XLSX.utils.json_to_sheet(data.map(v=>({Company:v.companyName,Contact:v.contactPerson,Email:v.email,Phone:v.phone,Status:v.status})));const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Vendors");XLSX.writeFile(wb,"vendors.xlsx");}} className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg font-bold hover:bg-emerald-200 transition">Excel</button>
                    <button onClick={async()=>{const{default:jsPDF}=await import("jspdf");const{default:autoTable}=await import("jspdf-autotable");const data=selectedVendorsForAction.length>0?vendors.filter(v=>selectedVendorsForAction.includes(v._id)):vendors;const doc=new jsPDF();doc.setFontSize(14);doc.text("Vendors List",14,16);autoTable(doc,{startY:22,head:[["Company","Contact","Email","Phone","Status"]],body:data.map(v=>[v.companyName,v.contactPerson,v.email,v.phone,v.status]),styles:{fontSize:8},headStyles:{fillColor:[15,23,42]}});doc.save("vendors.pdf");}} className="text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-lg font-bold hover:bg-red-200 transition">PDF</button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                      <tr><th className="px-4 py-3 w-10"><input type="checkbox" checked={vendors.length>0&&selectedVendorsForAction.length===vendors.length} onChange={e=>setSelectedVendorsForAction(e.target.checked?vendors.map(v=>v._id):[])} className="rounded" /></th><th className="px-5 py-3">Company</th><th className="px-5 py-3">Contact</th><th className="px-5 py-3">Email</th><th className="px-5 py-3">Phone</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Action</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {vendors.length===0?<tr><td colSpan="7" className="px-5 py-8 text-center text-slate-400">No vendors registered.</td></tr>
                        :vendors.map(v=>(
                          <tr key={v._id} onClick={()=>setViewDetails({type:"vendor",data:v})} className="hover:bg-slate-50 transition-colors cursor-pointer">
                            <td className="px-4 py-4" onClick={e=>e.stopPropagation()}><input type="checkbox" checked={selectedVendorsForAction.includes(v._id)} onChange={e=>setSelectedVendorsForAction(e.target.checked?[...selectedVendorsForAction,v._id]:selectedVendorsForAction.filter(id=>id!==v._id))} className="rounded" /></td>
                            <td className="px-5 py-4 font-bold text-slate-900">{v.companyName}</td>
                            <td className="px-5 py-4 text-slate-600">{v.contactPerson}</td>
                            <td className="px-5 py-4 text-slate-600">{v.email}</td>
                            <td className="px-5 py-4 text-slate-600">{v.phone}</td>
                            <td className="px-5 py-4"><div className="flex flex-col gap-1 items-start"><span className={"px-2 py-0.5 text-xs font-bold uppercase border rounded w-fit "+(v.status==="approved"?"border-green-200 text-green-700 bg-green-50":"border-amber-200 text-amber-700 bg-amber-50")}>{v.status}</span>{v.blacklisted&&<span className="px-2 py-0.5 text-[10px] font-black uppercase border rounded border-red-200 text-red-700 bg-red-50">Blacklisted</span>}</div></td>
                            <td className="px-5 py-4 text-right flex flex-col gap-2 items-end" onClick={e=>e.stopPropagation()}>
                              <div className="flex items-center gap-2">
                                <button onClick={()=>{setNewVendor({...v,password:""});setShowVendorModal(true);}} className="text-blue-600 font-bold text-xs hover:underline">Edit</button>
                                {v.status!=="approved"?<button onClick={()=>handleApprove(v._id)} className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-700 transition">Approve</button>:<span className="text-slate-400 text-xs font-bold flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Approved</span>}
                              </div>
                              <button onClick={()=>toggleBlacklist(v._id)} className={"text-[10px] font-bold px-2 py-1 rounded transition "+(v.blacklisted?"bg-green-100 text-green-700 hover:bg-green-200":"bg-red-50 text-red-600 hover:bg-red-100")}>{v.blacklisted?"Unblacklist Vendor":"Blacklist Vendor"}</button>
                            </td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "reports" && (
            <div>
              <div className="mb-8">
                <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3 mb-6"><FileBarChart className="w-6 h-6 text-blue-600" /> Financial Reports</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[{key:"year",label:"Financial Year",options:["All","FY27","FY26"]},{key:"quarter",label:"Quarter",options:["All","Q1","Q2","Q3","Q4"]},{key:"month",label:"Month",options:["All","January","February","March","April","May","June","July","August","September","October","November","December"]},{key:"vendor",label:"Vendor",options:["All",...vendors.filter(v=>v.status==="approved").map(v=>v.companyName)]}].map(f=>(
                    <div key={f.key}><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{f.label}</label><select value={reportFilters[f.key]} onChange={e=>setReportFilters({...reportFilters,[f.key]:e.target.value})} className="w-full bg-white border border-slate-200 text-sm font-semibold text-slate-700 px-3 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-slate-900 appearance-none">{f.options.map(o=><option key={o} value={o}>{o==="All"?"All "+f.label+"s":o}</option>)}</select></div>
                  ))}
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
                  <span className="text-sm font-bold text-slate-900">{filterReports().length} record{filterReports().length!==1?"s":""}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={()=>{const data=selectedReports.length>0?filterReports().filter(e=>selectedReports.includes(e.room)):filterReports();const csv="data:text/csv;charset=utf-8,"+["Room ID,Product,Winner,Total Base Price,Winning Bid,Savings"].concat(data.map(e=>[e.room.slice(-6),e.product,e.winner,safeMath(e.totalBasePrice),safeMath(e.winningBid),safeMath(e.saving)].join(","))).join("\n");const a=document.createElement("a");a.href=encodeURI(csv);a.download="reports.csv";document.body.appendChild(a);a.click();document.body.removeChild(a);}} className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg font-bold hover:bg-blue-200 transition">CSV</button>
                    <button onClick={async()=>{const XLSX=await import("xlsx");const data=selectedReports.length>0?filterReports().filter(e=>selectedReports.includes(e.room)):filterReports();const ws=XLSX.utils.json_to_sheet(data.map(e=>({"Room ID":e.room.slice(-6),Product:e.product,Winner:e.winner,"Total Base Price":safeMath(e.totalBasePrice),"Winning Bid":safeMath(e.winningBid),Savings:safeMath(e.saving)})));const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Reports");XLSX.writeFile(wb,"reports.xlsx");}} className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg font-bold hover:bg-emerald-200 transition">Excel</button>
                    <button onClick={async()=>{const{default:jsPDF}=await import("jspdf");const{default:autoTable}=await import("jspdf-autotable");const data=selectedReports.length>0?filterReports().filter(e=>selectedReports.includes(e.room)):filterReports();const doc=new jsPDF();doc.setFontSize(14);doc.text("Financial Reports",14,16);autoTable(doc,{startY:22,head:[["Room","Product","Winner","Total Base","Winning Bid","Savings"]],body:data.map(e=>[e.room.slice(-6),e.product,e.winner,"Rs."+safeMath(e.totalBasePrice).toLocaleString("en-IN"),"Rs."+safeMath(e.winningBid).toLocaleString("en-IN"),"Rs."+safeMath(e.saving).toLocaleString("en-IN")]),styles:{fontSize:8},headStyles:{fillColor:[15,23,42]}});doc.save("reports.pdf");}} className="text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-lg font-bold hover:bg-red-200 transition">PDF</button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                      <tr><th className="px-4 py-3 w-10"><input type="checkbox" checked={filterReports().length>0&&selectedReports.length===filterReports().length} onChange={e=>setSelectedReports(e.target.checked?filterReports().map(ev=>ev.room):[])} className="rounded" /></th><th className="px-5 py-3">Room</th><th className="px-5 py-3">Product</th><th className="px-5 py-3">Winner</th><th className="px-5 py-3 text-right">Total Base</th><th className="px-5 py-3 text-right">Winning Bid</th><th className="px-5 py-3 text-right text-emerald-700">Savings</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filterReports().length===0?<tr><td colSpan="7" className="px-5 py-8 text-center text-slate-400">No reports match the selected filters.</td></tr>
                        :filterReports().map(ev=>(
                          <tr key={ev.room} onClick={()=>setViewDetails({type:"auction",data:{_id:ev.room,product:{name:ev.product},totalBasePrice:ev.totalBasePrice,winner:{companyName:ev.winner},currentLowestBid:ev.winningBid,startTime:ev.startTime,endTime:ev.endTime,status:"completed",items:ev.items}})} className="hover:bg-slate-50 transition-colors cursor-pointer">
                            <td className="px-4 py-4" onClick={e=>e.stopPropagation()}><input type="checkbox" checked={selectedReports.includes(ev.room)} onChange={e=>setSelectedReports(e.target.checked?[...selectedReports,ev.room]:selectedReports.filter(id=>id!==ev.room))} className="rounded" /></td>
                            <td className="px-5 py-4 font-mono text-slate-400 text-xs">{ev.room.slice(-6)}</td>
                            <td className="px-5 py-4 font-semibold text-slate-900">{ev.product}</td>
                            <td className="px-5 py-4 text-slate-600">{ev.winner}</td>
                            <td className="px-5 py-4 text-right text-slate-400 line-through text-xs">Rs.{safeMath(ev.totalBasePrice).toLocaleString("en-IN")}</td>
                            <td className="px-5 py-4 text-right font-bold text-slate-900">Rs.{safeMath(ev.winningBid).toLocaleString("en-IN")}</td>
                            <td className="px-5 py-4 text-right font-bold text-emerald-600">Rs.{safeMath(ev.saving).toLocaleString("en-IN")}</td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "change-password" && (
            <div className="max-w-md mx-auto">
              <h2 className="text-2xl font-black text-slate-900 mb-8 flex items-center gap-3"><Lock className="w-6 h-6 text-blue-600" /> Change Password</h2>
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8">
                <form onSubmit={handleChangePassword} className="space-y-4">
                  {[["Current Password","old","currentPassword"],["New Password","new","newPassword"],["Confirm New Password","confirm","confirmPassword"]].map(([label,key,field])=>(
                    <div key={field}><label className="block text-sm font-bold text-slate-700 mb-1">{label}</label><div className="relative"><input required type={showPwd[key]?"text":"password"} value={passwordData[field]} onChange={e=>setPasswordData({...passwordData,[field]:e.target.value})} className="w-full p-2.5 pr-10 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-slate-900 text-slate-900 text-sm" /><button type="button" onClick={()=>setShowPwd(p=>({...p,[key]:!p[key]}))} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{showPwd[key]?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}</button></div>{field==="newPassword"&&<p className="text-xs text-slate-400 mt-1">5 to 10 characters.</p>}</div>
                  ))}
                  <button type="submit" className="w-full py-3 bg-slate-900 hover:bg-slate-700 text-white font-bold rounded-xl transition mt-2">Update Password</button>
                </form>
              </div>
            </div>
          )}

        </div>
      </main>

      {showVendorModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-black text-lg text-slate-900">{newVendor._id?"Edit Vendor":"Create New Vendor"}</h3>
              <button onClick={()=>setShowVendorModal(false)} className="text-slate-400 hover:text-slate-900 text-2xl leading-none font-bold">&times;</button>
            </div>
            <form onSubmit={handleCreateVendor} className="p-6 space-y-3">
              {[["Company Name","text","companyName"],["Contact Person","text","contactPerson"],["Email","email","email"]].map(([label,type,field])=>(<div key={field}><label className="block text-sm font-bold text-slate-700 mb-1">{label}</label><input required type={type} value={newVendor[field]} onChange={e=>setNewVendor({...newVendor,[field]:e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-slate-900 text-slate-900 text-sm" /></div>))}
              <div><label className="block text-sm font-bold text-slate-700 mb-1">Phone (10 digits)</label><input required type="tel" maxLength={10} pattern="[0-9]{10}" value={newVendor.phone} onInput={e=>{e.target.value=e.target.value.replace(/[^0-9]/g,"");setNewVendor({...newVendor,phone:e.target.value});}} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-slate-900 text-slate-900 text-sm" /></div>
              {!newVendor._id&&<div><label className="block text-sm font-bold text-slate-700 mb-1">Password</label><input required type="password" value={newVendor.password} onChange={e=>setNewVendor({...newVendor,password:e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-slate-900 text-slate-900 text-sm" /></div>}
              <div><label className="block text-sm font-bold text-slate-700 mb-1">Upload Documents</label><input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" onChange={e=>setVendorFiles(e.target.files)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-sm cursor-pointer" /></div>
              <div className="flex gap-3 pt-3 border-t border-slate-100">
                <button type="button" onClick={()=>setShowVendorModal(false)} className="flex-1 py-2.5 bg-slate-100 text-slate-900 font-bold rounded-xl hover:bg-slate-200 transition text-sm">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition text-sm">{newVendor._id?"Update Vendor":"Create Vendor"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewDetails && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center shrink-0">
              <h3 className="font-black text-lg text-slate-900">{viewDetails.type==="vendor"?"Vendor Details":"Auction Details"}</h3>
              <button onClick={()=>setViewDetails(null)} className="text-slate-400 hover:text-slate-900 text-2xl font-bold leading-none">&times;</button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {viewDetails.type==="vendor"&&(<div className="grid grid-cols-2 gap-4">{[["Company",viewDetails.data.companyName],["Contact",viewDetails.data.contactPerson],["Email",viewDetails.data.email],["Phone",viewDetails.data.phone],["Status",viewDetails.data.status]].map(([l,v])=>(<div key={l}><p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">{l}</p><p className="text-sm font-semibold text-slate-900">{v}</p></div>))}{viewDetails.data.documents&&viewDetails.data.documents.length>0&&<div className="col-span-2"><p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">Documents</p><div className="space-y-1">{viewDetails.data.documents.map((doc,i)=>(<a key={i} href={doc.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 text-sm text-blue-600 hover:underline truncate">{doc.name}</a>))}</div></div>}</div>)}
              {viewDetails.type==="auction"&&(
                <div>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    {[["Product",viewDetails.data.product?.name||"Basket"],["Status",viewDetails.data.status],["Start",fmtDT(viewDetails.data.startTime)],["End",fmtDT(viewDetails.data.endTime)],["Winner",viewDetails.data.winner?.companyName||"No Winner"],["Winning Bid","Rs."+safeMath(viewDetails.data.currentLowestBid||viewDetails.data.grandTotalContractValue||viewDetails.data.totalBasePrice).toLocaleString("en-IN")]].map(([l,v])=>(<div key={l}><p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">{l}</p><p className="text-sm font-semibold text-slate-900">{v}</p></div>))}
                  </div>
                  {viewDetails.data.items&&viewDetails.data.items.length>0&&(
                    <div className="mt-2 pt-3 border-t border-slate-100">
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">Line Items</p>
                      <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <table className="w-full text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-3 py-2 text-left">Item</th><th className="px-3 py-2 text-right">Unit Price</th><th className="px-3 py-2 text-center">Qty</th><th className="px-3 py-2 text-right">Total</th></tr></thead>
                          <tbody className="divide-y divide-slate-100">{viewDetails.data.items.map((it,i)=>(<tr key={i}><td className="px-3 py-2 font-medium">{it.name}</td><td className="px-3 py-2 text-right text-slate-500">Rs.{safeMath(it.basePrice).toLocaleString("en-IN")}</td><td className="px-3 py-2 text-center">{it.quantity}</td><td className="px-3 py-2 text-right font-bold">Rs.{(safeMath(it.basePrice)*safeMath(it.quantity)).toLocaleString("en-IN")}</td></tr>))}</tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-200 shrink-0"><button onClick={()=>setViewDetails(null)} className="w-full py-3 bg-slate-100 text-slate-900 font-bold rounded-xl hover:bg-slate-200 transition">Close</button></div>
          </div>
        </div>
      )}

      {openCardModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200">
            <div className="p-5 border-b border-slate-200 relative text-center">
              <h3 className="font-black text-slate-900">{openCardModal==="savings"?"Total Savings":openCardModal==="spend"?"Total Spend":openCardModal==="completed"?"Completed Auctions":"Vendor Statistics"}</h3>
              <button onClick={()=>setOpenCardModal(null)} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 text-2xl font-bold leading-none">&times;</button>
            </div>
            <div className="p-6 space-y-2 text-center">
              {openCardModal==="savings"&&<><p className="text-4xl font-black text-emerald-600">Rs.{safeMath(reports.totalSavings).toLocaleString("en-IN")}</p><p className="text-sm text-slate-500">Total savings across all completed auctions.</p></>}
              {openCardModal==="spend"&&<><p className="text-4xl font-black text-blue-600">Rs.{reports.events.reduce((a,e)=>a+safeMath(e.winningBid),0).toLocaleString("en-IN")}</p><p className="text-sm text-slate-500">Total procurement spend.</p></>}
              {openCardModal==="completed"&&<><p className="text-4xl font-black text-purple-600">{reports.events.length}</p><p className="text-sm text-slate-500">Auctions successfully completed.</p></>}
              {openCardModal==="vendors"&&<><p className="text-4xl font-black text-amber-600">{vendors.length}</p><p className="text-sm text-slate-500">{vendors.filter(v=>v.status==="approved").length} approved of {vendors.length} total.</p></>}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;
