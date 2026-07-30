import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// 👇 已经为您直接写死您的专属网址和秘钥！无需修改！
const rawSupabaseUrl = 'https://muwzdigtehcperweliyg.supabase.co/rest/v1/'; 
const supabaseKey = 'sb_publishable_SGHvdmqpvo3Z6GekTtk4cA_PcvbDGpd';

// 🛡️ 智能清理网址 (自动把多余的 /rest/v1/ 删掉，防止迷路)
const supabaseUrl = rawSupabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabase = createClient(supabaseUrl, supabaseKey);

export default function App() {
  // 1. 全局控制状态
  const [currentView, setCurrentView] = useState('client-home'); 
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [dbStatus, setDbStatus] = useState({ status: 'checking', message: '' }); 
  const [products, setProducts] = useState([]); 
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // 2. 客户首页状态 (提升到最顶层，彻底防止刷新丢失)
  const [step, setStep] = useState(1);
  const [selection, setSelection] = useState({
    cabinet: null, width: '', height: '', depth: '', door: null, hardware: null, upgrades: []
  });
  const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '' });
  const [isSavingQuote, setIsSavingQuote] = useState(false);
  const [generatedQuoteId, setGeneratedQuoteId] = useState('');

  // 3. 后台管理状态
  const [adminPassword, setAdminPassword] = useState('');
  const [formData, setFormData] = useState({ product_name: '', category: '柜体', price: '', unit: '平方米' });
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  // 获取产品数据
  const fetchProducts = async () => {
    try {
      setDbStatus({ status: 'checking', message: '' });
      const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setProducts(data || []);
      setDbStatus({ status: 'connected', message: '' });
    } catch (e) {
      setDbStatus({ status: 'error', message: e.message });
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const calculateItemPrice = (item, area) => {
    if (!item) return 0;
    if (item.unit.includes('平方') || item.unit.includes('㎡')) {
      return item.price * area;
    }
    return item.price; // 项、套、个等固定价格直接相加
  };

  const generateQuotation = () => {
    const w = parseFloat(selection.width) / 1000 || 0; 
    const h = parseFloat(selection.height) / 1000 || 0;
    const area = w * h; 

    const cabinetFee = calculateItemPrice(selection.cabinet, area);
    const doorFee = calculateItemPrice(selection.door, area);
    const hardwareFee = calculateItemPrice(selection.hardware, area);
    
    let upgradeFee = 0;
    selection.upgrades.forEach(upg => {
      upgradeFee += calculateItemPrice(upg, area);
    });

    return {
      area: area.toFixed(2),
      cabinetFee: Math.round(cabinetFee),
      doorFee: Math.round(doorFee),
      hardwareFee: Math.round(hardwareFee),
      upgradeFee: Math.round(upgradeFee),
      total: Math.round(cabinetFee + doorFee + hardwareFee + upgradeFee)
    };
  };

  const quote = generateQuotation(); 

  const handleSaveFormalQuote = async () => {
    if (!customerInfo.name || !customerInfo.phone) {
      showToast('请填写完整的客户姓名和电话', 'error');
      return;
    }
    setIsSavingQuote(true);

    const details = `尺寸: ${selection.width}x${selection.height}x${selection.depth}mm\n` +
                    `柜体: ${selection.cabinet?.product_name || '无'}\n` +
                    `门板: ${selection.door?.product_name || '无'}\n` +
                    `五金: ${selection.hardware?.product_name || '无'}\n` +
                    `升级: ${selection.upgrades.map(u => u.product_name).join(', ')}`;

    const payload = {
      customer_name: `${customerInfo.name} (${customerInfo.phone})`,
      product_details: details,
      total_amount: quote.total
    };

    try {
      // 生成安全的专业单号
      const dateStr = new Date().toISOString().slice(2,10).replace(/-/g,''); 
      const randomNum = Math.floor(Math.random() * 9000 + 1000); 
      const newQuoteId = `NY-${dateStr}-${randomNum}`;
      setGeneratedQuoteId(newQuoteId);

      const { error } = await supabase.from('quotes').insert([payload]);
      if (error) throw error;
      
      // ✅ 最重要的一步：先强制跳转到第 6 步，再弹出提示，防止刷新重置！
      setStep(6); 
      showToast('✅ 报价单已成功存档！');
      
    } catch (err) {
      showToast('保存失败: ' + err.message, 'error');
    } finally {
      setIsSavingQuote(false);
    }
  };

  const renderClientHome = () => {
    const cabinets = products.filter(p => p.category === '柜体' || p.category.includes('柜'));
    const doors = products.filter(p => p.category === '门板');
    const hardwares = products.filter(p => p.category === '五金');
    const upgradeOptions = products.filter(p => p.category === '升级配件');

    const toggleUpgrade = (item) => {
      const exists = selection.upgrades.find(u => u.id === item.id);
      if (exists) {
        setSelection({...selection, upgrades: selection.upgrades.filter(u => u.id !== item.id)});
      } else {
        setSelection({...selection, upgrades: [...selection.upgrades, item]});
      }
    };

    const copyToClipboard = () => {
      const text = `【诺一家具定制 专属报价】\n客户：${customerInfo.name}\n报价单号：${generatedQuoteId}\n----------------------\n预估尺寸：${selection.width}W × ${selection.height}H × ${selection.depth}D mm\n预估总价：¥${quote.total}\n\n*具体金额以实际上门测量为准*`;
      navigator.clipboard.writeText(text);
      showToast('分享文本已复制！可以直接去微信粘贴。');
    };

    const resetAndGoHome = () => {
      setSelection({ cabinet: null, width: '', height: '', depth: '', door: null, hardware: null, upgrades: [] });
      setCustomerInfo({ name: '', phone: '' });
      setStep(1);
    };

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col font-sans relative">
        <div className="max-w-md w-full mx-auto bg-white min-h-screen shadow-xl relative pb-24 print:shadow-none print:max-w-none print:bg-white print:p-0">
          
          {/* 进度条 (打印时隐藏) */}
          {step < 6 && (
            <div className="p-6 pb-2 print:hidden">
              <h1 className="text-2xl font-light tracking-widest text-gray-900">NOEY<span className="font-bold">CUSTOM</span></h1>
              <p className="text-xs text-gray-400 mt-1 uppercase tracking-wider">诺 一 家 具 定 制</p>
              <div className="flex gap-2 mt-6">
                {[1, 2, 3, 4, 5].map(s => (
                  <div key={s} className={`h-1 flex-1 rounded transition-colors ${step >= s ? 'bg-black' : 'bg-gray-200'}`} />
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="p-6 animate-fade-in print:hidden">
              <h2 className="text-xl font-medium mb-6 text-gray-800">您想定制什么家具？</h2>
              <div className="grid grid-cols-2 gap-4">
                {cabinets.map(item => (
                  <div key={item.id} onClick={() => setSelection({...selection, cabinet: item})}
                    className={`aspect-square p-4 border rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all ${selection.cabinet?.id === item.id ? 'border-black border-2 bg-gray-50 shadow-md' : 'border-gray-200 hover:border-gray-300'}`}>
                    <div className="w-12 h-12 bg-gray-100 rounded-full mb-3 flex items-center justify-center text-xl">🪑</div>
                    <span className="font-medium text-gray-800">{item.product_name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="p-6 animate-fade-in print:hidden">
              <h2 className="text-xl font-medium mb-2 text-gray-800">请输入大致尺寸</h2>
              <p className="text-sm text-gray-500 mb-6">单位: 毫米 (mm)</p>
              <div className="space-y-6">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">宽度 (W)</label><input type="number" placeholder="例如: 2000" value={selection.width} onChange={(e) => setSelection({...selection, width: e.target.value})} className="w-full border-b-2 border-gray-200 py-2 focus:outline-none focus:border-black text-xl" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">高度 (H)</label><input type="number" placeholder="例如: 2400" value={selection.height} onChange={(e) => setSelection({...selection, height: e.target.value})} className="w-full border-b-2 border-gray-200 py-2 focus:outline-none focus:border-black text-xl" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">深度 (D)</label><input type="number" placeholder="例如: 600" value={selection.depth} onChange={(e) => setSelection({...selection, depth: e.target.value})} className="w-full border-b-2 border-gray-200 py-2 focus:outline-none focus:border-black text-xl" /></div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="p-6 animate-fade-in print:hidden">
              <h2 className="text-xl font-medium mb-6 text-gray-800">个性化选配</h2>
              <div className="space-y-8">
                <div>
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">门板材质</h3>
                  <div className="flex flex-wrap gap-2">
                    {doors.map(item => (<button key={item.id} onClick={() => setSelection({...selection, door: item})} className={`px-4 py-2 border rounded-full text-sm transition-all ${selection.door?.id === item.id ? 'bg-black text-white border-black shadow-md' : 'text-gray-700 border-gray-300 bg-white'}`}>{item.product_name}</button>))}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">五金品牌</h3>
                  <div className="flex flex-wrap gap-2">
                    {hardwares.map(item => (<button key={item.id} onClick={() => setSelection({...selection, hardware: item})} className={`px-4 py-2 border rounded-full text-sm transition-all ${selection.hardware?.id === item.id ? 'bg-black text-white border-black shadow-md' : 'text-gray-700 border-gray-300 bg-white'}`}>{item.product_name}</button>))}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">升级配件 (可多选)</h3>
                  <div className="flex flex-col gap-3">
                    {upgradeOptions.map(item => {
                      const isSelected = selection.upgrades.find(u => u.id === item.id);
                      return (
                        <div key={item.id} onClick={() => toggleUpgrade(item)} className={`p-4 border rounded-xl flex justify-between items-center cursor-pointer transition-all ${isSelected ? 'border-black bg-gray-50' : 'border-gray-200 bg-white'}`}>
                          <div>
                            <div className={`font-medium ${isSelected ? 'text-black' : 'text-gray-700'}`}>{item.product_name}</div>
                            <div className="text-xs text-gray-500 mt-1">+ ¥{item.price} / {item.unit}</div>
                          </div>
                          <div className={`w-6 h-6 rounded-full border flex items-center justify-center ${isSelected ? 'bg-black border-black' : 'border-gray-300'}`}>
                            {isSelected && <span className="text-white text-xs">✓</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="p-6 animate-fade-in print:hidden">
              <h2 className="text-2xl font-medium mb-6 text-gray-800">您的专属报价</h2>
              <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 shadow-sm mb-6">
                <div className="flex justify-between items-end border-b border-gray-200 pb-6 mb-6">
                  <span className="text-gray-500 font-medium">预估总价</span>
                  <span className="text-4xl font-bold text-black">¥{quote.total}</span>
                </div>
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between bg-white p-3 rounded-lg border border-gray-100">
                    <span className="text-gray-500">项目尺寸</span>
                    <span className="font-medium">{selection.width} × {selection.height} × {selection.depth} mm (约 {quote.area} ㎡)</span>
                  </div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-6 mb-2">费用明细</h3>
                  <div className="flex justify-between items-center"><span className="text-gray-600">柜体 ({selection.cabinet?.product_name})</span><span className="font-medium text-gray-900">¥{quote.cabinetFee}</span></div>
                  <div className="flex justify-between items-center"><span className="text-gray-600">门板 ({selection.door?.product_name || '未选'})</span><span className="font-medium text-gray-900">¥{quote.doorFee}</span></div>
                  <div className="flex justify-between items-center"><span className="text-gray-600">五金 ({selection.hardware?.product_name || '未选'})</span><span className="font-medium text-gray-900">¥{quote.hardwareFee}</span></div>
                  {quote.upgradeFee > 0 && (
                    <div className="flex justify-between items-start pt-2 border-t border-gray-100 mt-2">
                      <div className="text-gray-600">升级配件 <div className="text-xs text-gray-400 mt-1">{selection.upgrades.map(u => u.product_name).join(', ')}</div></div>
                      <span className="font-medium text-gray-900">¥{quote.upgradeFee}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="p-6 animate-fade-in print:hidden">
              <h2 className="text-2xl font-medium mb-2 text-gray-800">完善客户信息</h2>
              <p className="text-sm text-gray-500 mb-8">信息将用于生成最终报价单并存档</p>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">客户称呼</label>
                  <input type="text" placeholder="例如：张先生" value={customerInfo.name} onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})} className="w-full border-2 border-gray-100 p-4 rounded-xl focus:border-black focus:outline-none transition-colors" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">联系电话</label>
                  <input type="tel" placeholder="例如：13800138000" value={customerInfo.phone} onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})} className="w-full border-2 border-gray-100 p-4 rounded-xl focus:border-black focus:outline-none transition-colors" />
                </div>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="animate-fade-in bg-white min-h-screen p-8 print:p-0 print:w-[210mm] print:mx-auto">
              
              <div className="flex justify-between items-start border-b-2 border-black pb-6 mb-8 mt-4 print:mt-0">
                <div>
                  <img src="/LOGO英版.png" alt="NOEY Logo" className="h-16 object-contain mb-2" />
                  <div className="text-xs text-gray-500 tracking-widest mt-2 uppercase font-bold">Quotation</div>
                </div>
                <div className="text-right text-sm">
                  <div className="font-bold text-gray-800 mb-1">诺一家具定制</div>
                  <div className="text-gray-500">单号: {generatedQuoteId}</div>
                  <div className="text-gray-500">日期: {new Date().toLocaleDateString()}</div>
                </div>
              </div>

              <div className="mb-8 p-4 bg-gray-50 rounded-lg print:bg-gray-50 print:border print:border-gray-200">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-gray-500 mr-2">客户致名:</span><span className="font-bold text-gray-800">{customerInfo.name}</span></div>
                  <div><span className="text-gray-500 mr-2">联系电话:</span><span className="font-bold text-gray-800">{customerInfo.phone}</span></div>
                  <div className="col-span-2"><span className="text-gray-500 mr-2">项目名称:</span><span className="font-medium text-gray-800">{selection.cabinet?.product_name}定制</span></div>
                </div>
              </div>

              <table className="w-full text-sm border-collapse mb-8">
                <thead>
                  <tr className="border-b-2 border-gray-800 text-left">
                    <th className="py-3 font-bold text-gray-800">项目明细</th>
                    <th className="py-3 font-bold text-gray-800 text-right">规格/数量</th>
                    <th className="py-3 font-bold text-gray-800 text-right">金额 (¥)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="py-4">
                      <div className="font-bold text-gray-800">{selection.cabinet?.product_name}</div>
                      <div className="text-xs text-gray-500 mt-1">柜体基础项</div>
                    </td>
                    <td className="py-4 text-right text-gray-600">
                      {selection.width}W × {selection.height}H × {selection.depth}D<br/>
                      (约 {quote.area} ㎡)
                    </td>
                    <td className="py-4 text-right font-medium">¥{quote.cabinetFee}</td>
                  </tr>
                  
                  {selection.door && (
                    <tr>
                      <td className="py-4"><div className="font-bold text-gray-800">{selection.door.product_name}</div><div className="text-xs text-gray-500 mt-1">门板材质</div></td>
                      <td className="py-4 text-right text-gray-600">随柜体面积</td>
                      <td className="py-4 text-right font-medium">¥{quote.doorFee}</td>
                    </tr>
                  )}
                  
                  {selection.hardware && (
                    <tr>
                      <td className="py-4"><div className="font-bold text-gray-800">{selection.hardware.product_name}</div><div className="text-xs text-gray-500 mt-1">五金品牌配置</div></td>
                      <td className="py-4 text-right text-gray-600">按单项计</td>
                      <td className="py-4 text-right font-medium">¥{quote.hardwareFee}</td>
                    </tr>
                  )}
                  
                  {selection.upgrades.length > 0 && (
                    <tr>
                      <td className="py-4">
                        <div className="font-bold text-gray-800">升级配件</div>
                        <div className="text-xs text-gray-500 mt-1">{selection.upgrades.map(u => u.product_name).join('、')}</div>
                      </td>
                      <td className="py-4 text-right text-gray-600">共 {selection.upgrades.length} 项</td>
                      <td className="py-4 text-right font-medium">¥{quote.upgradeFee}</td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="border-t-2 border-black pt-4 flex justify-between items-end">
                <div className="text-xs text-gray-500 w-1/2">
                  备注：本报价为初步预估，最终价格以实际上门测量尺寸与最终确认图纸为准。
                </div>
                <div className="text-right">
                  <span className="text-gray-500 text-sm mr-4">合计金额</span>
                  <span className="text-3xl font-bold text-gray-900">¥{quote.total}</span>
                </div>
              </div>

              <div className="mt-16 text-center text-xs text-gray-400 tracking-[0.2em] uppercase font-bold hidden print:block">
                Our Promise Your Satisfaction<br/>
                <span className="font-light tracking-[0.1em] mt-1 inline-block">Noey Furniture Manufacture</span>
              </div>

              <div className="mt-12 space-y-4 print:hidden">
                <button onClick={() => window.print()} className="w-full bg-black text-white py-4 rounded-xl font-bold shadow-md hover:bg-gray-800 flex items-center justify-center gap-2">
                  <span>📄</span> 导出 PDF 或 打印
                </button>
                <div className="flex gap-4">
                  <button onClick={copyToClipboard} className="flex-1 bg-white border-2 border-black text-black py-3 rounded-xl font-medium hover:bg-gray-50">
                    复制文字分享
                  </button>
                  <button onClick={resetAndGoHome} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-200">
                    返回首页
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 底部导航按钮 */}
          {step < 6 && (
            <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-100 p-4 flex gap-4 z-20 print:hidden">
              {step > 1 && <button onClick={() => setStep(step - 1)} className="px-6 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50">返回</button>}
              
              {step < 4 && (
                <button 
                  onClick={() => setStep(step + 1)} 
                  disabled={(step === 1 && !selection.cabinet) || (step === 2 && (!selection.width || !selection.height))} 
                  className="flex-1 bg-black text-white py-3 rounded-xl font-medium disabled:bg-gray-200 disabled:text-gray-400 transition-colors shadow-md">
                  下一步
                </button>
              )}
              
              {step === 4 && (
                <button onClick={() => setStep(5)} className="flex-1 bg-black text-white py-3 rounded-xl font-medium shadow-md">
                  生成正式报价单
                </button>
              )}

              {step === 5 && (
                <button onClick={handleSaveFormalQuote} disabled={isSavingQuote} className="flex-1 bg-black text-white py-3 rounded-xl font-medium shadow-md disabled:bg-gray-400">
                  {isSavingQuote ? '正在生成并存档...' : '确认生成'}
                </button>
              )}
            </div>
          )}
          
          {step < 6 && (
            <div className="absolute top-6 right-6 z-20 print:hidden">
              <button onClick={() => setCurrentView('admin-login')} className="text-xs text-gray-300 hover:text-gray-500 px-2 py-1">管理</button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderAdminLogin = () => {
    const handleLogin = () => {
      if (adminPassword === 'admin123') { setIsAdminLoggedIn(true); setCurrentView('admin-products'); } 
      else { showToast('密码错误', 'error'); }
    };
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 font-sans">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-96 border border-gray-100">
          <h2 className="text-2xl font-bold mb-8 text-center text-gray-800 tracking-wider">NOEY<span className="font-light">ADMIN</span></h2>
          <input type="password" placeholder="请输入管理员密码 (admin123)" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} className="w-full border-2 border-gray-100 p-3 rounded-xl mb-6 focus:border-black focus:outline-none transition-colors" />
          <button onClick={handleLogin} className="w-full bg-black text-white p-3 rounded-xl font-medium hover:bg-gray-800 transition-colors shadow-md">登 录 系 统</button>
          <button onClick={() => setCurrentView('client-home')} className="w-full mt-4 text-gray-400 text-sm hover:text-black transition-colors">← 返回客户首页</button>
        </div>
      </div>
    );
  };

  const renderAdminProducts = () => {
    const handleCategoryChange = (e) => {
      const cat = e.target.value;
      let defaultUnit = '平方米';
      if (cat === '五金' || cat === '升级配件') defaultUnit = '项';
      setFormData({ ...formData, category: cat, unit: defaultUnit });
    };

    const handleSaveProduct = async (e) => {
      e.preventDefault();
      setIsSavingProduct(true);
      const payload = { 
        product_name: formData.product_name, category: formData.category, 
        price: parseFloat(formData.price), unit: formData.unit 
      };
      try {
        const { error } = await supabase.from('products').insert([payload]);
        if (error) throw error;
        showToast('✅ 添加成功！');
        setFormData({ ...formData, product_name: '', price: '' });
        fetchProducts(); 
      } catch (err) {
        showToast('保存失败: ' + err.message, 'error');
      } finally {
        setIsSavingProduct(false);
      }
    };

    return (
      <div className="flex bg-gray-100 min-h-screen font-sans">
        <div className="w-72 bg-gray-900 text-white flex flex-col p-6 shadow-2xl z-10">
          <h1 className="text-2xl font-bold mb-8 tracking-wider">NOEY<span className="font-light">ADMIN</span></h1>
          <div className="mb-8 p-4 rounded-xl bg-gray-800/50 border border-gray-700/50">
            <div className="text-gray-400 mb-3 text-xs uppercase tracking-wider font-bold">系统连接状态</div>
            {dbStatus.status === 'error' && <div className="text-rose-400 text-sm">❌ 失败: {dbStatus.message}</div>}
            {dbStatus.status === 'connected' && (
              <div>
                <div className="text-emerald-400 font-medium text-sm flex items-center gap-2 mb-2"><span>✅</span> Supabase 已连接</div>
                <div className="text-gray-300 text-sm mt-3 pt-3 border-t border-gray-700">当前产品数据: <span className="font-bold text-white ml-1">{products.length}</span> 条</div>
              </div>
            )}
          </div>
          <button className="w-full text-left p-3 rounded-xl bg-white/10 text-white font-medium mb-2 shadow-inner">🪑 产品与价格管理</button>
          <button onClick={() => { setIsAdminLoggedIn(false); setCurrentView('client-home'); setStep(1); }} className="mt-auto p-3 text-center border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-colors">退出管理并返回</button>
        </div>
        <div className="flex-1 p-8 flex gap-8 overflow-y-auto">
          <div className="flex-1 bg-white p-8 rounded-3xl shadow-sm border border-gray-100 h-fit">
            <h2 className="text-xl font-bold mb-6 text-gray-800">产品数据列表</h2>
            {products.length === 0 ? <div className="text-gray-400">目前没有任何产品，请在右侧添加。</div> : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-100">
                    <th className="p-4 text-sm font-medium text-gray-500">名称</th>
                    <th className="p-4 text-sm font-medium text-gray-500">分类</th>
                    <th className="p-4 text-sm font-medium text-gray-500">价格规则</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id} className="border-b border-gray-50">
                      <td className="p-4 font-medium text-gray-800">{p.product_name}</td>
                      <td className="p-4 text-gray-600">{p.category}</td>
                      <td className="p-4 font-bold text-gray-900">¥{p.price} <span className="text-sm text-gray-400 font-normal">/ {p.unit}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="w-80 bg-white p-8 rounded-3xl shadow-sm border border-gray-100 h-fit sticky top-8">
            <h2 className="text-xl font-bold mb-6 text-gray-800">添加新产品</h2>
            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div><label className="block text-sm text-gray-600 mb-1">产品名称</label><input required value={formData.product_name} onChange={e=>setFormData({...formData, product_name:e.target.value})} className="w-full border-2 border-gray-100 p-2 rounded-lg" /></div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">所属分类</label>
                <select required value={formData.category} onChange={handleCategoryChange} className="w-full border-2 border-gray-100 p-2 rounded-lg bg-white">
                  <option value="柜体">柜体 (第一步显示)</option><option value="门板">门板 (单选)</option><option value="五金">五金 (单选)</option><option value="升级配件">升级配件 (多选)</option>
                </select>
              </div>
              <div className="flex gap-2">
                <div className="flex-1"><label className="block text-sm text-gray-600 mb-1">单价 (元)</label><input required type="number" value={formData.price} onChange={e=>setFormData({...formData, price:e.target.value})} className="w-full border-2 border-gray-100 p-2 rounded-lg" /></div>
                <div className="w-24"><label className="block text-sm text-gray-600 mb-1">计价单位</label><input required value={formData.unit} onChange={e=>setFormData({...formData, unit:e.target.value})} className="w-full border-2 border-gray-100 p-2 rounded-lg text-center" /></div>
              </div>
              <button type="submit" disabled={isSavingProduct} className="w-full bg-black text-white p-3 rounded-lg font-medium mt-4">{isSavingProduct ? '保存中...' : '确 认 添 加'}</button>
            </form>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="relative">
      {currentView === 'client-home' && renderClientHome()}
      {currentView === 'admin-login' && renderAdminLogin()}
      {currentView === 'admin-products' && isAdminLoggedIn && renderAdminProducts()}
      
      {toast.show && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in print:hidden">
          <div className={`px-6 py-3 rounded-full shadow-xl font-medium text-sm flex items-center gap-2 ${toast.type === 'error' ? 'bg-rose-500' : 'bg-emerald-500'} text-white`}>
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}