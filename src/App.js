import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// 👇 您的专属网址和秘钥 (已做防呆自动清理)
const rawSupabaseUrl = 'https://muwzdigtehcperweliyg.supabase.co/rest/v1/'; 
const supabaseKey = 'sb_publishable_SGHvdmqpvo3Z6GekTtk4cA_PcvbDGpd';
const supabaseUrl = rawSupabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabase = createClient(supabaseUrl, supabaseKey);

export default function App() {
  // --- 全局状态 ---
  const [currentView, setCurrentView] = useState('workspace'); // workspace | admin
  const [dbStatus, setDbStatus] = useState({ status: 'checking', message: '' }); 
  const [products, setProducts] = useState([]); 
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  
  // --- 内部工作台状态 (报价单数据) ---
  const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '' });
  const [baseArea, setBaseArea] = useState(''); // 柜体投影总面积
  const [selectedCabinet, setSelectedCabinet] = useState(null);
  const [selectedDoor, setSelectedDoor] = useState(null); // 为空代表无门板
  const [upgradeItems, setUpgradeItems] = useState([]); // [{ item: {}, qty: 1 }]
  
  const [isSavingQuote, setIsSavingQuote] = useState(false);
  const [generatedQuoteId, setGeneratedQuoteId] = useState('');
  const [showFinalQuote, setShowFinalQuote] = useState(false);

  // --- 后台管理状态 ---
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [formData, setFormData] = useState({ product_name: '', category: '柜体', price: '', unit: '㎡' });
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  // --- 核心计算引擎 (严格按照您的局部升级逻辑) ---
  const calculateQuotation = () => {
    const area = parseFloat(baseArea) || 0;
    
    // 1. 基础柜体底价
    const cabinetPrice = selectedCabinet ? selectedCabinet.price : 0;
    // 2. 基础门板底价 (如果无门板则为0)
    const doorPrice = selectedDoor ? selectedDoor.price : 0;
    
    // 主线一：基础总价 = (柜体+门板) * 总面积
    const baseTotal = (cabinetPrice + doorPrice) * area;

    // 主线二：局部升级加成
    let upgradeTotal = 0;
    const upgradeDetails = upgradeItems.map(upg => {
      const qty = parseFloat(upg.qty) || 0;
      const cost = upg.item.price * qty;
      upgradeTotal += cost;
      return { name: upg.item.product_name, qty: qty, unit: upg.item.unit, cost: cost };
    });

    // 合并
    return {
      area,
      cabinetPrice,
      doorPrice,
      baseTotal: Math.round(baseTotal),
      upgradeTotal: Math.round(upgradeTotal),
      upgradeDetails,
      grandTotal: Math.round(baseTotal + upgradeTotal)
    };
  };

  const quote = calculateQuotation();

  // 获取数据库数据
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

  useEffect(() => { fetchProducts(); }, []);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  // --- 保存报价单逻辑 ---
  const handleSaveFormalQuote = async () => {
    if (!customerInfo.name || !baseArea || !selectedCabinet) {
      showToast('请至少填写客户名、柜体面积并选择柜体材质', 'error');
      return;
    }
    setIsSavingQuote(true);

    let details = `总面积: ${baseArea}㎡\n柜体: ${selectedCabinet.product_name}\n门板: ${selectedDoor ? selectedDoor.product_name : '无门板'}\n`;
    if (upgradeItems.length > 0) {
      details += `\n局部升级:\n` + upgradeItems.map(u => `- ${u.item.product_name}: ${u.qty}${u.item.unit}`).join('\n');
    }

    const payload = {
      customer_name: `${customerInfo.name} (${customerInfo.phone})`,
      product_details: details,
      total_amount: quote.grandTotal
    };

    try {
      // 智能生成无依赖的单号
      const dateStr = new Date().toISOString().slice(2,10).replace(/-/g,''); 
      const randomNum = Math.floor(Math.random() * 9000 + 1000); 
      setGeneratedQuoteId(`NY-${dateStr}-${randomNum}`);

      const { error } = await supabase.from('quotes').insert([payload]);
      if (error) throw error;
      
      setShowFinalQuote(true); // 切换到纯净打印视图
      showToast('✅ 报价单存档成功！');
    } catch (err) {
      showToast('保存失败: ' + err.message, 'error');
    } finally {
      setIsSavingQuote(false);
    }
  };

  // --- 重置工作台 ---
  const resetWorkspace = () => {
    setCustomerInfo({ name: '', phone: '' });
    setBaseArea('');
    setSelectedCabinet(null);
    setSelectedDoor(null);
    setUpgradeItems([]);
    setShowFinalQuote(false);
  };


  // ==========================================
  // 视图 1：专业工作台 (内部员工使用)
  // ==========================================
  const renderWorkspace = () => {
    const cabinets = products.filter(p => p.category === '柜体' || p.category.includes('柜'));
    const doors = products.filter(p => p.category === '门板');
    const upgrades = products.filter(p => p.category === '升级配件' || p.category === '升级' || p.category === '五金');

    // 局部升级交互逻辑
    const addUpgrade = (item) => {
      if (!upgradeItems.find(u => u.item.id === item.id)) {
        setUpgradeItems([...upgradeItems, { item, qty: 1 }]);
      }
    };
    const updateUpgradeQty = (id, newQty) => {
      setUpgradeItems(upgradeItems.map(u => u.item.id === id ? { ...u, qty: newQty } : u));
    };
    const removeUpgrade = (id) => {
      setUpgradeItems(upgradeItems.filter(u => u.item.id !== id));
    };

    if (showFinalQuote) return renderFinalPrintableQuote();

    return (
      <div className="min-h-screen bg-gray-100 flex flex-col font-sans">
        {/* 顶部导航 */}
        <header className="bg-gray-900 text-white p-4 flex justify-between items-center shadow-md z-10">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold tracking-widest">NOEY<span className="font-light text-gray-400">WORKSPACE</span></h1>
            <span className="bg-rose-500 text-xs px-2 py-1 rounded text-white font-medium">内部报价引擎</span>
          </div>
          <button onClick={() => setCurrentView('admin')} className="text-sm text-gray-300 hover:text-white px-3 py-1 border border-gray-700 rounded-md">⚙️ 数据管理后台</button>
        </header>

        {/* 左右分栏工作区 */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* 左侧：数据输入区 */}
          <div className="w-1/2 md:w-7/12 bg-gray-50 overflow-y-auto p-8 border-r border-gray-200">
            <h2 className="text-2xl font-bold text-gray-800 mb-8 border-b-2 border-black pb-2 inline-block">图纸参数录入</h2>
            
            <div className="space-y-8">
              {/* 1. 客户档案 */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-sm font-bold text-gray-500 uppercase mb-4 flex items-center gap-2"><span>👤</span> 客户档案</h3>
                <div className="flex gap-4">
                  <input type="text" placeholder="客户姓名 / 小区" value={customerInfo.name} onChange={e=>setCustomerInfo({...customerInfo, name:e.target.value})} className="flex-1 border border-gray-300 p-3 rounded-lg focus:border-black focus:outline-none" />
                  <input type="tel" placeholder="联系电话 (选填)" value={customerInfo.phone} onChange={e=>setCustomerInfo({...customerInfo, phone:e.target.value})} className="flex-1 border border-gray-300 p-3 rounded-lg focus:border-black focus:outline-none" />
                </div>
              </div>

              {/* 2. 基础框架设置 (整体打底) */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-blue-600">
                <h3 className="text-sm font-bold text-gray-500 uppercase mb-4 flex items-center gap-2"><span>📐</span> 第一步：基础框架设置 (整体面积计价)</h3>
                
                <div className="mb-6">
                  <label className="block text-sm font-bold text-gray-700 mb-2">图纸投影总面积 (㎡)</label>
                  <input type="number" placeholder="请输入图纸核算的柜体总面积" value={baseArea} onChange={e=>setBaseArea(e.target.value)} className="w-full border-2 border-blue-100 bg-blue-50/30 p-4 rounded-lg text-xl font-bold text-blue-900 focus:border-blue-500 focus:outline-none" />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">柜体材质 (必选)</label>
                    <div className="flex flex-col gap-2">
                      {cabinets.map(item => (
                        <button key={item.id} onClick={() => setSelectedCabinet(item)} className={`p-3 text-left border rounded-lg transition-all ${selectedCabinet?.id === item.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-400'}`}>
                          <div className="font-bold">{item.product_name}</div>
                          <div className={`text-xs ${selectedCabinet?.id === item.id ? 'text-blue-200' : 'text-gray-400'}`}>¥{item.price}/{item.unit}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">基础门板 (含无门板)</label>
                    <div className="flex flex-col gap-2">
                      <button onClick={() => setSelectedDoor(null)} className={`p-3 text-left border rounded-lg transition-all ${!selectedDoor ? 'bg-gray-800 text-white border-gray-800' : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-400'}`}>
                        <div className="font-bold">❌ 无门板 (仅算柜体)</div>
                      </button>
                      {doors.map(item => (
                        <button key={item.id} onClick={() => setSelectedDoor(item)} className={`p-3 text-left border rounded-lg transition-all ${selectedDoor?.id === item.id ? 'bg-gray-800 text-white border-gray-800' : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-400'}`}>
                          <div className="font-bold">{item.product_name}</div>
                          <div className={`text-xs ${selectedDoor?.id === item.id ? 'text-gray-300' : 'text-gray-400'}`}>¥{item.price}/{item.unit}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. 局部升级与特殊项 */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-rose-500">
                <h3 className="text-sm font-bold text-gray-500 uppercase mb-4 flex items-center gap-2"><span>✨</span> 第二步：局部升级 / 配件追加 (按实输入数量)</h3>
                
                {/* 已选升级项列表 */}
                {upgradeItems.length > 0 && (
                  <div className="mb-6 space-y-3">
                    {upgradeItems.map(upg => (
                      <div key={upg.item.id} className="flex items-center gap-4 bg-rose-50 p-3 rounded-lg border border-rose-100">
                        <div className="flex-1">
                          <div className="font-bold text-gray-800">{upg.item.product_name}</div>
                          <div className="text-xs text-gray-500">单价: ¥{upg.item.price}/{upg.item.unit}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="number" min="0" step="0.1" value={upg.qty} onChange={(e) => updateUpgradeQty(upg.item.id, e.target.value)} className="w-24 border border-gray-300 p-2 rounded text-center font-bold focus:border-rose-500" placeholder="面积/数量" />
                          <span className="text-gray-500 text-sm w-6">{upg.item.unit}</span>
                          <button onClick={() => removeUpgrade(upg.item.id)} className="text-rose-500 hover:text-rose-700 ml-2 font-bold text-xl">×</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 添加升级项按钮 */}
                <div className="mt-4">
                  <label className="block text-xs font-medium text-gray-400 mb-2">点击添加图纸标注的升级项目：</label>
                  <div className="flex flex-wrap gap-2">
                    {upgrades.map(item => (
                      <button key={item.id} onClick={() => addUpgrade(item)} className="px-4 py-2 border border-dashed border-gray-300 text-gray-600 rounded-full text-sm hover:border-rose-500 hover:text-rose-600 hover:bg-rose-50 transition-colors">
                        + {item.product_name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* 右侧：实时报价预览区 */}
          <div className="w-1/2 md:w-5/12 bg-white border-l border-gray-200 flex flex-col relative shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)]">
            <div className="p-8 flex-1 overflow-y-auto bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
              <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-100">
                <div className="border-b-2 border-black pb-4 mb-6">
                  <h2 className="text-xs text-gray-400 tracking-widest uppercase font-bold mb-1">Quotation Preview</h2>
                  <h1 className="text-3xl font-black text-gray-900">诺一家具 · 内部核算单</h1>
                </div>

                {/* 运算过程明细 */}
                <div className="space-y-6">
                  
                  {/* 主体计算 */}
                  <div>
                    <h3 className="text-sm font-bold text-gray-800 bg-gray-100 p-2 rounded mb-3">1. 基础柜体核算</h3>
                    {baseArea ? (
                      <div className="text-sm text-gray-600 space-y-2 pl-2">
                        <div className="flex justify-between"><span>柜体材质 ({selectedCabinet?.product_name || '未选'})</span><span>¥{quote.cabinetPrice}/㎡</span></div>
                        <div className="flex justify-between"><span>基础门板 ({selectedDoor ? selectedDoor.product_name : '无门板'})</span><span>¥{quote.doorPrice}/㎡</span></div>
                        <div className="flex justify-between font-bold text-blue-800 pt-2 border-t border-gray-100 mt-2">
                          <span>合并基础单价</span><span>¥{quote.cabinetPrice + quote.doorPrice}/㎡</span>
                        </div>
                        <div className="flex justify-between text-gray-900 mt-1">
                          <span>× 图纸总面积</span><span>{quote.area} ㎡</span>
                        </div>
                        <div className="flex justify-between font-bold text-lg text-gray-900 pt-2 border-t-2 border-gray-800 mt-2">
                          <span>基础总金额</span><span>¥{quote.baseTotal}</span>
                        </div>
                      </div>
                    ) : (<div className="text-sm text-gray-400 pl-2">请输入总面积以显示计算...</div>)}
                  </div>

                  {/* 局部升级计算 */}
                  {upgradeItems.length > 0 && (
                     <div>
                     <h3 className="text-sm font-bold text-gray-800 bg-rose-50 text-rose-900 p-2 rounded mb-3">2. 局部升级附加费</h3>
                     <div className="text-sm text-gray-600 space-y-2 pl-2">
                        {quote.upgradeDetails.map((u, idx) => (
                          <div key={idx} className="flex justify-between items-center">
                            <span>{u.name} <span className="text-gray-400 text-xs">({u.qty}{u.unit})</span></span>
                            <span>¥{u.cost}</span>
                          </div>
                        ))}
                        <div className="flex justify-between font-bold text-lg text-rose-700 pt-2 border-t-2 border-rose-200 mt-2">
                          <span>升级总金额</span><span>¥{quote.upgradeTotal}</span>
                        </div>
                     </div>
                   </div>
                  )}
                </div>

                {/* 最终汇总 */}
                <div className="mt-12 bg-black text-white p-6 rounded-xl flex justify-between items-end">
                  <div>
                    <div className="text-gray-400 text-sm mb-1">项目：{customerInfo.name || '未命名'}</div>
                    <div className="text-xl font-bold">最终预估总价</div>
                  </div>
                  <div className="text-5xl font-black">¥{quote.grandTotal}</div>
                </div>

              </div>
            </div>

            {/* 底部操作栏 */}
            <div className="bg-gray-50 border-t border-gray-200 p-6">
              <button 
                onClick={handleSaveFormalQuote} 
                disabled={isSavingQuote || !baseArea || !selectedCabinet}
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 transition-colors shadow-lg flex justify-center items-center gap-2">
                {isSavingQuote ? '数据存档中...' : (
                  <><span>💾</span> 生成正式报价单并存档记录</>
                )}
              </button>
              <div className="text-center text-xs text-gray-400 mt-3">生成后将跳转至可打印、分享的纯净版正式报价单</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ==========================================
  // 视图 2：纯净打印版 (第六阶段页面优化)
  // ==========================================
  const renderFinalPrintableQuote = () => {
    return (
      <div className="animate-fade-in bg-white min-h-screen p-8 print:p-0 print:w-[210mm] print:mx-auto font-sans">
        <div className="max-w-4xl mx-auto">
          {/* 页头 */}
          <div className="flex justify-between items-start border-b-2 border-black pb-6 mb-8 mt-4 print:mt-0">
            <div>
              <img src="/LOGO英版.png" alt="NOEY Logo" className="h-16 object-contain mb-2" />
              <div className="text-xs text-gray-500 tracking-widest mt-2 uppercase font-bold">Quotation Statement</div>
            </div>
            <div className="text-right text-sm">
              <div className="font-bold text-gray-800 mb-1 text-lg">诺一家具定制</div>
              <div className="text-gray-500">单号: {generatedQuoteId}</div>
              <div className="text-gray-500">日期: {new Date().toLocaleDateString()}</div>
            </div>
          </div>

          {/* 客户信息 */}
          <div className="mb-8 p-4 bg-gray-50 rounded-lg print:bg-white print:border-2 print:border-gray-900">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500 mr-2">致：</span><span className="font-bold text-gray-800 text-base">{customerInfo.name}</span></div>
              <div><span className="text-gray-500 mr-2">联系电话：</span><span className="font-bold text-gray-800">{customerInfo.phone}</span></div>
            </div>
          </div>

          {/* 报价明细表 */}
          <table className="w-full text-sm border-collapse mb-8">
            <thead>
              <tr className="border-b-2 border-gray-900 text-left bg-gray-50 print:bg-white">
                <th className="py-3 px-2 font-bold text-gray-800 w-1/2">项目明细</th>
                <th className="py-3 px-2 font-bold text-gray-800 text-right">数量/面积</th>
                <th className="py-3 px-2 font-bold text-gray-800 text-right">金额 (¥)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {/* 基础部分 */}
              <tr>
                <td className="py-4 px-2">
                  <div className="font-bold text-gray-900 text-base">定制柜体基础项</div>
                  <div className="text-gray-600 mt-1">包含柜体：{selectedCabinet?.product_name}</div>
                  <div className="text-gray-600">包含门板：{selectedDoor ? selectedDoor.product_name : '无'}</div>
                </td>
                <td className="py-4 px-2 text-right font-medium text-gray-800">{quote.area} ㎡</td>
                <td className="py-4 px-2 text-right font-bold text-gray-900 text-lg">¥{quote.baseTotal}</td>
              </tr>
              
              {/* 局部升级部分 */}
              {quote.upgradeDetails.map((u, idx) => (
                <tr key={idx}>
                  <td className="py-4 px-2">
                    <div className="font-bold text-gray-800">{u.name}</div>
                    <div className="text-xs text-gray-400 mt-1">局部升级 / 配件</div>
                  </td>
                  <td className="py-4 px-2 text-right text-gray-600">{u.qty} {u.unit}</td>
                  <td className="py-4 px-2 text-right font-medium text-gray-900">¥{u.cost}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* 总计 */}
          <div className="border-t-2 border-black pt-6 flex justify-between items-end">
            <div className="text-xs text-gray-500 w-1/2 leading-relaxed">
              备注：<br/>1. 本报价依据双方确认之图纸尺寸核算。<br/>2. 最终金额以实际生产下单拆单尺寸为准。
            </div>
            <div className="text-right bg-gray-50 p-4 rounded-xl print:bg-white print:p-0">
              <span className="text-gray-500 text-sm mr-4 font-bold uppercase tracking-wider">Grand Total 总计</span>
              <span className="text-4xl font-black text-gray-900">¥{quote.grandTotal}</span>
            </div>
          </div>

          <div className="mt-16 text-center text-xs text-gray-400 tracking-[0.2em] uppercase font-bold hidden print:block border-t border-gray-200 pt-8">
            Our Promise Your Satisfaction<br/>
            <span className="font-light tracking-[0.1em] mt-1 inline-block">Noey Furniture Manufacture</span>
          </div>

          {/* 操作按钮 (不打印) */}
          <div className="mt-16 space-y-4 print:hidden max-w-sm mx-auto">
            <button onClick={() => window.print()} className="w-full bg-black text-white py-4 rounded-xl font-bold shadow-xl hover:bg-gray-800 transition-transform hover:-translate-y-1">
              📄 生成 PDF / 打印
            </button>
            <button onClick={resetWorkspace} className="w-full bg-gray-100 text-gray-700 py-4 rounded-xl font-medium hover:bg-gray-200">
              返回工作台，开下一单
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ==========================================
  // 视图 3：后台管理
  // ==========================================
  const renderAdmin = () => {
    const handleLogin = () => {
      if (adminPassword === 'admin123') setIsAdminLoggedIn(true);
      else showToast('密码错误', 'error');
    };

    const handleSaveProduct = async (e) => {
      e.preventDefault();
      setIsSavingProduct(true);
      const payload = { product_name: formData.product_name, category: formData.category, price: parseFloat(formData.price), unit: formData.unit };
      try {
        const { error } = await supabase.from('products').insert([payload]);
        if (error) throw error;
        showToast('✅ 添加成功！');
        setFormData({ ...formData, product_name: '', price: '' });
        fetchProducts(); 
      } catch (err) { showToast('保存失败: ' + err.message, 'error'); } 
      finally { setIsSavingProduct(false); }
    };

    if (!isAdminLoggedIn) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 font-sans">
          <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-96 border border-gray-700">
            <h2 className="text-2xl font-bold mb-8 text-center text-white tracking-wider">系统管理后台</h2>
            <input type="password" placeholder="输入密码 (admin123)" value={adminPassword} onChange={e=>setAdminPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()} className="w-full bg-gray-900 text-white border border-gray-700 p-4 rounded-xl mb-6 focus:border-blue-500 focus:outline-none" />
            <button onClick={handleLogin} className="w-full bg-blue-600 text-white p-4 rounded-xl font-medium hover:bg-blue-700 transition-colors">安全登录</button>
            <button onClick={() => setCurrentView('workspace')} className="w-full mt-6 text-gray-500 text-sm hover:text-gray-300">← 返回业务工作台</button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex bg-gray-100 min-h-screen font-sans">
        <div className="w-72 bg-gray-900 text-white flex flex-col p-6 shadow-2xl z-10">
          <h1 className="text-2xl font-bold mb-8 tracking-wider">NOEY<span className="font-light text-gray-400">ADMIN</span></h1>
          <div className="mb-8 p-4 rounded-xl bg-gray-800 border border-gray-700">
            <div className="text-gray-400 mb-3 text-xs uppercase tracking-wider font-bold">数据库状态</div>
            {dbStatus.status === 'error' ? <div className="text-rose-400 text-sm font-medium">❌ 连接失败</div> : (
              <div>
                <div className="text-emerald-400 font-bold text-sm mb-2">✅ Supabase连接成功</div>
                <div className="text-gray-300 text-sm mt-3 pt-3 border-t border-gray-700">当前产品总数：<span className="font-bold text-white text-lg ml-1">{products.length}</span></div>
              </div>
            )}
          </div>
          <button className="w-full text-left p-4 rounded-xl bg-blue-600/20 text-blue-400 font-bold mb-2 border border-blue-500/30">🪑 材料与规则配置库</button>
          <button onClick={() => { setIsAdminLoggedIn(false); setCurrentView('workspace'); }} className="mt-auto p-4 text-center bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 rounded-xl transition-colors font-medium border border-gray-700">退出并返回前台</button>
        </div>

        <div className="flex-1 p-8 flex gap-8 overflow-y-auto">
          <div className="flex-1 bg-white p-8 rounded-2xl shadow-sm border border-gray-200 h-fit">
            <h2 className="text-xl font-bold mb-6 text-gray-800 flex items-center gap-2"><span>📋</span> 已配置数据列表</h2>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-200">
                  <th className="p-4 text-sm font-bold text-gray-500">分类</th>
                  <th className="p-4 text-sm font-bold text-gray-500">名称</th>
                  <th className="p-4 text-sm font-bold text-gray-500 text-right">单价规则</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 text-sm font-medium text-gray-500">
                      <span className={`px-2 py-1 rounded text-xs ${p.category==='柜体'?'bg-blue-100 text-blue-800':p.category==='门板'?'bg-emerald-100 text-emerald-800':'bg-rose-100 text-rose-800'}`}>{p.category}</span>
                    </td>
                    <td className="p-4 font-bold text-gray-800">{p.product_name}</td>
                    <td className="p-4 font-bold text-gray-900 text-right">¥{p.price} <span className="text-gray-400 text-xs font-normal">/ {p.unit}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="w-96 bg-white p-8 rounded-2xl shadow-sm border border-gray-200 h-fit sticky top-8">
            <h2 className="text-xl font-bold mb-6 text-gray-800">➕ 录入新材料/规则</h2>
            <form onSubmit={handleSaveProduct} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">类型定位 (关键)</label>
                <select required value={formData.category} onChange={e=>{
                  const cat = e.target.value;
                  setFormData({...formData, category: cat, unit: cat === '升级' ? '个/㎡/米' : '㎡'});
                }} className="w-full border-2 border-gray-200 p-3 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 outline-none font-medium">
                  <option value="柜体">1. 基础柜体材质</option>
                  <option value="门板">2. 基础门板材质</option>
                  <option value="升级">3. 局部升级/五金 (输入数量计算)</option>
                </select>
              </div>
              <div><label className="block text-sm font-bold text-gray-700 mb-2">名称</label><input required placeholder="如：橡木板 / 玻璃门" value={formData.product_name} onChange={e=>setFormData({...formData, product_name:e.target.value})} className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-blue-500 outline-none" /></div>
              <div className="flex gap-4">
                <div className="flex-1"><label className="block text-sm font-bold text-gray-700 mb-2">单价 (¥)</label><input required type="number" value={formData.price} onChange={e=>setFormData({...formData, price:e.target.value})} className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-blue-500 outline-none font-bold" /></div>
                <div className="w-24"><label className="block text-sm font-bold text-gray-700 mb-2">计价单位</label><input required value={formData.unit} onChange={e=>setFormData({...formData, unit:e.target.value})} className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-blue-500 outline-none text-center" /></div>
              </div>
              <div className="pt-2">
                <button type="submit" disabled={isSavingProduct} className="w-full bg-black text-white p-4 rounded-xl font-bold hover:bg-gray-800 transition-colors shadow-md disabled:bg-gray-400">
                  {isSavingProduct ? '正在写入数据库...' : '确认写入云端数据库'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="relative">
      {currentView === 'workspace' && renderWorkspace()}
      {currentView === 'admin' && renderAdmin()}
      {toast.show && (
        <div className="fixed top-8 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in print:hidden">
          <div className={`px-8 py-4 rounded-xl shadow-2xl font-bold text-sm flex items-center gap-3 ${toast.type === 'error' ? 'bg-rose-600' : 'bg-gray-900'} text-white`}>
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
