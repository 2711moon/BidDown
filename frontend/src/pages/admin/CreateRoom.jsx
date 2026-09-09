import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Settings, Clock, Users, Package, ChevronRight, Check } from 'lucide-react';

const CreateRoom = () => {
  const navigate = useNavigate();
  const [vendors, setVendors] = useState([]);
  const [formData, setFormData] = useState({
    productName: '', description: '', documentUrl: '', basePrice: '', decrementValue: '',
    quantity: '1', startTime: '', endTime: '', selectedVendors: []
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchVendors = async () => {
      try {
        const res = await axios.get((import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api/admin/vendors');
        setVendors(res.data.filter(v => v.status === 'approved'));
      } catch (err) {
        toast.error('Failed to load vendors');
      }
    };
    fetchVendors();
  }, []);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleVendorToggle = (vendorId) => {
    setFormData(prev => {
      const selected = prev.selectedVendors.includes(vendorId)
        ? prev.selectedVendors.filter(id => id !== vendorId)
        : [...prev.selectedVendors, vendorId];
      return { ...prev, selectedVendors: selected };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const loadingToast = toast.loading('Scheduling auction room...');
    try {
      const productRes = await axios.post((import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api/admin/products', {
        name: formData.productName, 
        description: formData.description, 
        documentUrl: formData.documentUrl,
        billingParameters: { paymentTerms: 'Net 30' }
      });
      await axios.post((import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api/admin/rooms', {
        product: productRes.data._id,
        basePrice: Number(formData.basePrice), decrementValue: Number(formData.decrementValue),
        quantity: Number(formData.quantity), startTime: new Date(formData.startTime), endTime: new Date(formData.endTime),
        invitedVendors: formData.selectedVendors
      });
      toast.success('Room successfully scheduled!', { id: loadingToast });
      navigate('/admin');
    } catch (err) {
      toast.error('Error creating room: ' + (err.response?.data?.message || err.message), { id: loadingToast });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto mt-8 mb-12">
      <div className="flex items-center text-slate-500 mb-6 text-sm font-medium">
        <a href="/admin" className="hover:text-slate-900 transition">Admin Dashboard</a>
        <ChevronRight className="w-4 h-4 mx-2" />
        <span className="text-slate-900">Schedule Auction</span>
      </div>
      
      <div className="bg-white p-8 md:p-12 rounded-2xl shadow-xl border border-slate-100">
        <h1 className="text-3xl font-black mb-8 text-slate-900 tracking-tight">Schedule New Auction</h1>
        
        <form onSubmit={handleSubmit} className="space-y-10">
          
          {/* Section 1: Product */}
          <div>
            <div className="flex items-center mb-6 border-b border-slate-100 pb-2">
              <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center mr-3"><Package className="w-4 h-4"/></div>
              <h2 className="text-xl font-bold text-slate-800">Product Details</h2>
            </div>
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Product/Service Name</label>
                <input type="text" name="productName" value={formData.productName} onChange={handleChange} required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Description</label>
                <textarea name="description" value={formData.description} onChange={handleChange} required rows="3" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"></textarea>
              </div>
            </div>
          </div>

          {/* Section 2: Rules */}
          <div>
            <div className="flex items-center mb-6 border-b border-slate-100 pb-2">
              <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center mr-3"><Settings className="w-4 h-4"/></div>
              <h2 className="text-xl font-bold text-slate-800">Bidding Rules</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Base Price (₹)</label>
                <input type="number" name="basePrice" value={formData.basePrice} onChange={handleChange} required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-mono" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Decrement Step (₹)</label>
                <input type="number" name="decrementValue" value={formData.decrementValue} onChange={handleChange} required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-mono" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Quantity Required</label>
                <input type="number" name="quantity" value={formData.quantity} onChange={handleChange} required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-mono" />
              </div>
            </div>
          </div>

          {/* Section 3: Schedule */}
          <div>
            <div className="flex items-center mb-6 border-b border-slate-100 pb-2">
              <div className="w-8 h-8 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center mr-3"><Clock className="w-4 h-4"/></div>
              <h2 className="text-xl font-bold text-slate-800">Time & Scheduling</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Start Time</label>
                <input type="datetime-local" name="startTime" value={formData.startTime} onChange={handleChange} required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Base End Time</label>
                <input type="datetime-local" name="endTime" value={formData.endTime} onChange={handleChange} required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none" />
              </div>
            </div>
            <div className="mt-4 bg-amber-50 border border-amber-200 p-4 rounded-xl text-sm text-amber-800 flex items-start">
              <Check className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5 text-amber-600"/>
              <p><strong>Anti-Sniping Enabled:</strong> If a bid is placed in the final 3 minutes, the end time will automatically extend by exactly 3 minutes. This will happen only once per auction.</p>
            </div>
          </div>

          {/* Section 4: Vendors */}
          <div>
            <div className="flex items-center mb-6 border-b border-slate-100 pb-2">
              <div className="w-8 h-8 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center mr-3"><Users className="w-4 h-4"/></div>
              <h2 className="text-xl font-bold text-slate-800">Invite Vendors</h2>
            </div>
            {vendors.length === 0 ? (
              <div className="bg-slate-50 p-6 rounded-xl text-center border border-slate-200">
                <p className="text-slate-500 font-medium">No approved vendors found. Approve vendors in the dashboard first.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {vendors.map(v => (
                  <label key={v._id} className={`flex items-center p-4 border rounded-xl cursor-pointer transition ${formData.selectedVendors.includes(v._id) ? 'bg-purple-50 border-purple-300 shadow-sm' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                    <input type="checkbox" checked={formData.selectedVendors.includes(v._id)} onChange={() => handleVendorToggle(v._id)} className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500 border-gray-300" />
                    <div className="ml-3">
                      <span className="block text-sm font-bold text-slate-800">{v.companyName}</span>
                      <span className="block text-xs text-slate-500">{v.email}</span>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <button type="submit" disabled={loading} className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-slate-800 transition active:scale-[0.98] shadow-lg text-lg flex items-center justify-center">
            {loading ? 'Processing...' : 'Launch Bidding Room'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateRoom;

