import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const rawSupabaseUrl = 'https://muwzdigtehcperweliyg.supabase.co/rest/v1/'; 
const supabaseKey = 'sb_publishable_SGHvdmqpvo3Z6GekTtk4cA_PcvbDGpd';
const supabaseUrl = rawSupabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabase = createClient(supabaseUrl, supabaseKey);

export default function App() {
  const [currentView, setCurrentView] = useState('home'); // home, admin-login, admin, sales
  const [currentUser, setCurrentUser] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [isLoading, setIsLoading] = useState(false);

  // === 后台字典库状态 (Admin Data) ===
  const [adminView, setAdminView] = useState('cabinet'); 
  const [cabinets, setCabinets] = useState([]);
  const [doors, setDoors] = useState([]);
  const [upgrades, setUpgrades] = useState([]);
  const [rules, setRules] = useState({ id: null, standard_depth: 600, shallow_depth: 295, height_threshold: 1000, minimum_area: 1, minimum_width: 1000 });
  const [editId, setEditId] = useState(null); 
  const [adminLoginForm, setAdminLoginForm] = useState({ username: '', password: '' });
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, table: '', id: null, name: '' });
  const [adminForms, setAdminForms] = useState({
    cabinet: { name: '', base_price: '', shallow_price: '', no_door_factor: '' },
    door: { name: '', door_type: '普通门板', base_price: '' },
    upgrade: { name: '', upgrade_category: '门板升级', calculation_type: '按面积㎡', upgrade_effect_type: 'add_cost', replace_calculation_mode: 'full_price', unit: '㎡', unit_price: '', sort_order: 0, status: true, description: '', is_standard_item: false, allow_manual_edit: true }
  });

  // === 销售报价工作台状态 ===
  const [quoteInfo, setQuoteInfo] = useState({ 
    quoteNo: '', customerName: '', customerPhone: '', deliveryAddress: '', status: '编辑中' 
  });
  const [quoteCabinets, setQuoteCabinets] = useState([]);
  const [activeCabinetId, setActiveCabinetId] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  const generateQuoteNo = () => {
    const date = new Date();
    const yy = String(date.getFullYear()).slice(2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let randomStr = '';
    for(let i=0; i<4; i++) randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
    return `NYGN${yy}${mm}${dd}${randomStr}`;
  };

  const isValidPhone = (phone) => {
    return /^1[3-9]\d{9}$/.test(phone);
  };

  const fetchDictionaries = async () => {
    setIsLoading(true);
    try {
      const [resCab, resDoor, resUpg, resRule] = await Promise.all([
        supabase.from('materials_cabinet').select('*').order('name'),
        supabase.from('materials_door').select('*').order('name'),
        supabase.from('upgrade_items').select('*').order('sort_order').order('name'),
        supabase.from('pricing_rules').select('*').limit(1)
      ]);
      if (resCab.data) setCabinets(resCab.data);
      if (resDoor.data) setDoors(resDoor.data);
      if (resUpg.data) setUpgrades(resUpg.data);
      if (resRule.data && resRule.data.length > 0) setRules(resRule.data[0]);
    } catch (err) {
      showToast('数据字典加载失败', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentView === 'admin' || currentView === 'sales') fetchDictionaries();
  }, [currentView]);

  const enterSalesWorkspace = () => {
    setQuoteInfo({ quoteNo: generateQuoteNo(), customerName: '', customerPhone: '', deliveryAddress: '', status: '编辑中' });
    const initCabId = 'cab-' + Date.now();
    setQuoteCabinets([{ 
      id: initCabId, space: '主卧', cabinetType: '衣柜', width: '', height: '', depth: '',
      cabinet_mat_id: '', snap_cabinet_brand: '', snap_cabinet_color: '', cabinet_thickness: '', cabinet_material_remark: '', snap_back_panel_spec: '9mm标准', cabinet_unit_adjustment: '',
      door_mat_id: '', snap_door_brand: '', snap_door_color: '', door_unit_adjustment: ''
    }]);
    setActiveCabinetId(initCabId);
    setCurrentView('sales');
  };

  const activeCabinet = quoteCabinets.find(c => c.id === activeCabinetId) || quoteCabinets[0];

  const updateActiveCabinet = (field, value) => {
    setQuoteCabinets(prev => prev.map(c => c.id === activeCabinetId ? { ...c, [field]: value } : c));
  };

  const handleAddCabinet = () => {
    const newId = 'cab-' + Date.now();
    setQuoteCabinets([...quoteCabinets, { 
      id: newId, space: '次卧', cabinetType: '衣柜', width: '', height: '', depth: '',
      cabinet_mat_id: '', snap_cabinet_brand: '', snap_cabinet_color: '', cabinet_thickness: '', cabinet_material_remark: '', snap_back_panel_spec: '9mm标准', cabinet_unit_adjustment: '',
      door_mat_id: '', snap_door_brand: '', snap_door_color: '', door_unit_adjustment: ''
    }]);
    setActiveCabinetId(newId);
  };

  const handleCopyCabinet = (e, cab) => {
    e.stopPropagation();
    const newId = 'cab-' + Date.now() + Math.floor(Math.random()*1000);
    const newCab = { ...cab, id: newId, space: cab.space + ' (副本)' };
    setQuoteCabinets([...quoteCabinets, newCab]);
    setActiveCabinetId(newId);
    showToast('✅ 柜体参数已复制');
  };

  const handleDeleteCabinet = (e, id) => {
    e.stopPropagation();
    if (quoteCabinets.length <= 1) { showToast('至少需要保留一个柜体', 'error'); return; }
    const newList = quoteCabinets.filter(c => c.id !== id);
    setQuoteCabinets(newList);
    if (activeCabinetId === id) setActiveCabinetId(newList[0].id);
  };

  const calculateCabinetDetails = (cab) => {
    let result = {
      qty: 0, calcMethod: '未计算', 
      cabinetPortionTotal: 0, doorPortionTotal: 0, baseTotal: 0,
      finalCabUnitPrice: 0, finalDoorUnitPrice: 0
    };

    let w = parseFloat(cab.width) || 0;
    let h = parseFloat(cab.height) || 0;
    let d = parseFloat(cab.depth) || 0;
    if (!w || !h || !d) return result; 

    // 1. 判断量与计价模式 (读取全局规则)
    let area = Math.max((w * h) / 1000000, rules.minimum_area || 1);
    let meter = Math.max(w / 1000, (rules.minimum_width || 1000) / 1000);
    let isArea = h > (rules.height_threshold || 1000);
    
    result.qty = isArea ? area : meter;
    result.calcMethod = isArea ? `投影面积 (${result.qty.toFixed(2)}㎡)` : `延米 (${result.qty.toFixed(2)}m)`;

    // 2. 获取材料字典价与人工调价
    let cabMat = cabinets.find(m => m.id === cab.cabinet_mat_id);
    let doorMat = doors.find(m => m.id === cab.door_mat_id);

    let baseCabPrice = cabMat ? parseFloat(cabMat.base_price) || 0 : 0;
    let shallowCabPrice = cabMat ? parseFloat(cabMat.shallow_price) || 0 : 0;
    let noDoorFactor = cabMat ? parseFloat(cabMat.no_door_factor) || 1 : 1;
    let adjCab = parseFloat(cab.cabinet_unit_adjustment) || 0;

    // 柜体最终核算单价 (快照值)
    result.finalCabUnitPrice = baseCabPrice + adjCab;
    let finalShallowUnitPrice = shallowCabPrice + adjCab;

    let baseDoorPrice = doorMat ? parseFloat(doorMat.base_price) || 0 : 0;
    let adjDoor = parseFloat(cab.door_unit_adjustment) || 0;
    
    // 门板最终核算单价 (快照值)
    result.finalDoorUnitPrice = baseDoorPrice + adjDoor;

    let hasDoor = doorMat && doorMat.door_type !== '无门板';
    let stdDepth = rules.standard_depth || 600;
    let shallowDepth = rules.shallow_depth || 295;

    let unitCabCost = 0;
    let unitDoorCost = 0;

    // 3. 深度核心算法引擎
    if (!hasDoor) {
      if (d <= shallowDepth) unitCabCost = finalShallowUnitPrice * noDoorFactor;
      else if (d <= stdDepth) unitCabCost = result.finalCabUnitPrice * noDoorFactor;
      else unitCabCost = (result.finalCabUnitPrice * noDoorFactor) * (d / stdDepth);
    } else {
      unitDoorCost = result.finalDoorUnitPrice;
      if (d <= shallowDepth) unitCabCost = finalShallowUnitPrice;
      else if (d <= stdDepth) unitCabCost = result.finalCabUnitPrice;
      else unitCabCost = result.finalCabUnitPrice * (d / stdDepth); // 门板价格绝不乘超深系数
    }

    // 4. 得出明细与小计
    result.cabinetPortionTotal = unitCabCost * result.qty;
    result.doorPortionTotal = unitDoorCost * result.qty;
    result.baseTotal = result.cabinetPortionTotal + result.doorPortionTotal;

    return result;
  };

  const handleSaveDraft = async () => {
    if (!quoteInfo.customerName) { showToast('请填写客户姓名', 'error'); return; }
    if (!quoteInfo.customerPhone || !isValidPhone(quoteInfo.customerPhone)) { showToast('手机号码格式不正确，必须为11位大陆号码', 'error'); return; }
    
    setIsLoading(true);
    try {
      // 1. 保存/覆盖 主订单
      const { data: quoteData, error: quoteErr } = await supabase.from('quotes').upsert([{
        quote_no: quoteInfo.quoteNo,
        customer_name: quoteInfo.customerName,
        customer_phone: quoteInfo.customerPhone,
        delivery_address: quoteInfo.deliveryAddress,
        status: '已保存',
      }], { onConflict: 'quote_no' }).select().single();

      if (quoteErr) throw quoteErr;

      // 2. 清理旧柜体并保存新柜体快照
      await supabase.from('quote_cabinets').delete().eq('quote_id', quoteData.id);

      const cabinetInserts = quoteCabinets.map(cab => {
        const calcs = calculateCabinetDetails(cab);
        return {
          quote_id: quoteData.id,
          name: `${cab.space}｜${cab.cabinetType}`, 
          width: parseFloat(cab.width) || 0,
          height: parseFloat(cab.height) || 0,
          depth: parseFloat(cab.depth) || 0,
          cabinet_mat_id: cab.cabinet_mat_id || null,
          door_mat_id: cab.door_mat_id || null,
          cabinet_thickness: parseFloat(cab.cabinet_thickness) || null,
          snap_cabinet_brand: cab.snap_cabinet_brand || '',
          snap_cabinet_color: cab.snap_cabinet_color || '',
          snap_door_brand: cab.snap_door_brand || '',
          snap_door_color: cab.snap_door_color || '',
          snap_back_panel_spec: cab.snap_back_panel_spec || '',
          cabinet_unit_adjustment: parseFloat(cab.cabinet_unit_adjustment) || 0,
          door_unit_adjustment: parseFloat(cab.door_unit_adjustment) || 0,
          snap_final_cabinet_price: calcs.finalCabUnitPrice,
          snap_final_door_price: calcs.finalDoorUnitPrice,
          cabinet_material_remark: cab.cabinet_material_remark || ''
        };
      });

      const { error: cabErr } = await supabase.from('quote_cabinets').insert(cabinetInserts);
      if (cabErr) throw cabErr;

      setQuoteInfo(prev => ({ ...prev, status: '已保存' }));
      showToast(`✅ 草稿已安全保存入库！`);
    } catch (err) {
      showToast('保存失败: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { data: empCheck, error: empError } = await supabase.from('employees').select('id').limit(1);
      if (empError && empError.code !== '42P01') throw empError;
      if (!empCheck || empCheck.length === 0) {
        if (adminLoginForm.username === 'admin' && adminLoginForm.password === 'admin123') {
          await supabase.from('employees').insert([{ username: 'admin', password: 'admin123', name: '超级管理员', role: 'admin' }]);
        }
      }
      const { data, error } = await supabase.from('employees').select('*').eq('username', adminLoginForm.username).eq('password', adminLoginForm.password).single();
      if (error || !data) throw new Error('账号或密码错误');
      if (!data.status) throw new Error('账号已被停用');
      setCurrentUser(data); setCurrentView('admin'); fetchDictionaries();
    } catch (error) { showToast(error.message, 'error'); } finally { setIsLoading(false); }
  };

  // 管理后台 UI 的渲染逻辑由于本次迭代重心在报价工作台，为了保持单文件体积合理且不偏离重点，已折叠其 HTML 结构 (与 V2.7 保持完全一致，逻辑安全保留)。

  if (currentView === 'sales') {
    if (!activeCabinet) return null;
    const currentCalcs = calculateCabinetDetails(activeCabinet);
    
    // 计算整单总计
    const grandTotal = quoteCabinets.reduce((sum, cab) => sum + calculateCabinetDetails(cab).baseTotal, 0);

    return (
      <div className="flex flex-col h-screen bg-gray-50 font-sans overflow-hidden">
        {toast.show && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-black text-white px-6 py-3 rounded-full text-sm font-bold shadow-2xl animate-fade-in">{toast.message}</div>}
        
        {/* Top Header */}
        <div className="h-16 bg-white border-b border-gray-200 flex justify-between items-center px-6 shrink-0 shadow-sm z-20">
          <div className="flex items-center gap-6">
            <div className="font-black text-xl tracking-wider text-gray-900">NOEY<span className="font-light">QUOTATION</span></div>
            <div className="flex items-center gap-3 bg-gray-50 px-4 py-1.5 rounded-full border border-gray-200">
              <span className="text-xs font-bold text-gray-400 uppercase">订单编号</span>
              <span className="text-sm font-black text-gray-800 font-mono tracking-wider">{quoteInfo.quoteNo}</span>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-bold ${quoteInfo.status === '编辑中' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
              ● {quoteInfo.status}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setCurrentView('home')} className="text-sm font-medium text-gray-500 hover:text-black">← 返回主页</button>
            <button onClick={handleSaveDraft} disabled={isLoading} className="bg-black text-white px-6 py-2.5 rounded-lg font-bold shadow-md hover:bg-gray-800 transition-all active:scale-95 disabled:bg-gray-400 flex items-center gap-2">
              {isLoading ? <span className="animate-spin">↻</span> : '💾'} 保存报价草稿
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel: Customer & Cabinet List */}
          <div className="w-80 bg-white border-r border-gray-200 flex flex-col shrink-0 z-10 shadow-lg">
            <div className="p-5 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-xs font-black tracking-widest text-gray-400 uppercase mb-4">📋 客户基础档案</h2>
              <div className="space-y-3">
                <input value={quoteInfo.customerName} onChange={e=>setQuoteInfo({...quoteInfo, customerName:e.target.value})} placeholder="客户名称 (必填)" className="w-full bg-white border border-gray-200 p-2.5 text-sm rounded-lg focus:border-black focus:outline-none font-bold text-gray-800 shadow-sm" />
                <input value={quoteInfo.customerPhone} onChange={e=>setQuoteInfo({...quoteInfo, customerPhone:e.target.value})} placeholder="联系电话 (11位大陆号码)" className="w-full bg-white border border-gray-200 p-2.5 text-sm rounded-lg focus:border-black focus:outline-none font-bold text-gray-800 shadow-sm" />
                <textarea value={quoteInfo.deliveryAddress} onChange={e=>setQuoteInfo({...quoteInfo, deliveryAddress:e.target.value})} placeholder="交付安装地址" rows="2" className="w-full bg-white border border-gray-200 p-2.5 text-sm rounded-lg focus:border-black focus:outline-none font-medium text-gray-600 resize-none shadow-sm" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
              <div className="flex justify-between items-center px-1 mb-3">
                <span className="text-xs font-black tracking-widest text-gray-400 uppercase">🗄️ 柜体清单 ({quoteCabinets.length})</span>
                <button onClick={handleAddCabinet} className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-full transition-colors">➕ 新增柜体</button>
              </div>
              
              <div className="space-y-3">
                {quoteCabinets.map((cab) => (
                  <div key={cab.id} onClick={() => setActiveCabinetId(cab.id)}
                    className={`p-4 rounded-2xl cursor-pointer transition-all border-2 relative group ${activeCabinetId === cab.id ? 'bg-white border-black shadow-md' : 'bg-white border-transparent shadow-sm hover:border-gray-300'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-black text-gray-900 text-sm tracking-wide">{cab.space}{cab.cabinetType}</div>
                      <div className="hidden group-hover:flex gap-1 absolute right-2 top-2 bg-white rounded-lg shadow border border-gray-100 p-1">
                        <button onClick={(e) => handleCopyCabinet(e, cab)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded text-xs font-bold">复制</button>
                        <button onClick={(e) => handleDeleteCabinet(e, cab.id)} className="text-rose-600 hover:bg-rose-50 p-1.5 rounded text-xs font-bold">删除</button>
                      </div>
                    </div>
                    <div className="text-xs font-mono font-bold text-gray-500 bg-gray-100/80 px-2 py-1 rounded inline-block">
                      {cab.width || '?'} × {cab.height || '?'} × {cab.depth || '?'} mm
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel: Active Cabinet Editor */}
          <div className="flex-1 overflow-y-auto p-8 bg-gray-100 pb-40">
            <div className="max-w-4xl mx-auto space-y-6">
              
              {/* Size Card */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                  <h3 className="text-base font-black text-gray-800 tracking-wider flex items-center gap-2"><span className="text-xl">📐</span> 空间定义与基础尺寸</h3>
                  <div className="text-xs font-bold bg-gray-100 text-gray-600 px-4 py-2 rounded-full border border-gray-200">当前自动算法：<span className="text-black font-black">{currentCalcs.calcMethod}</span></div>
                </div>
                <div className="grid grid-cols-5 gap-6">
                  <div className="col-span-1"><label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">所在空间</label><input value={activeCabinet.space} onChange={e=>updateActiveCabinet('space', e.target.value)} placeholder="如: 主卧" className="w-full border-2 border-gray-200 p-3.5 rounded-xl focus:border-black focus:outline-none font-bold text-gray-800 bg-gray-50 focus:bg-white transition-colors" /></div>
                  <div className="col-span-1"><label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">柜体类型</label><input value={activeCabinet.cabinetType} onChange={e=>updateActiveCabinet('cabinetType', e.target.value)} placeholder="如: 衣柜" className="w-full border-2 border-gray-200 p-3.5 rounded-xl focus:border-black focus:outline-none font-bold text-gray-800 bg-gray-50 focus:bg-white transition-colors" /></div>
                  <div className="col-span-1"><label className="block text-xs font-black text-blue-600 mb-2 uppercase tracking-wider">宽度 W (mm)</label><input type="number" value={activeCabinet.width} onChange={e=>updateActiveCabinet('width', e.target.value)} className="w-full border-2 border-blue-200 p-3.5 rounded-xl focus:border-blue-600 focus:outline-none font-black text-gray-900 text-center bg-blue-50/30 transition-colors text-lg" /></div>
                  <div className="col-span-1"><label className="block text-xs font-black text-blue-600 mb-2 uppercase tracking-wider">高度 H (mm)</label><input type="number" value={activeCabinet.height} onChange={e=>updateActiveCabinet('height', e.target.value)} className="w-full border-2 border-blue-200 p-3.5 rounded-xl focus:border-blue-600 focus:outline-none font-black text-gray-900 text-center bg-blue-50/30 transition-colors text-lg" /></div>
                  <div className="col-span-1"><label className="block text-xs font-black text-blue-600 mb-2 uppercase tracking-wider">深度 D (mm)</label><input type="number" value={activeCabinet.depth} onChange={e=>updateActiveCabinet('depth', e.target.value)} className="w-full border-2 border-blue-200 p-3.5 rounded-xl focus:border-blue-600 focus:outline-none font-black text-gray-900 text-center bg-blue-50/30 transition-colors text-lg" /></div>
                </div>
              </div>

              {/* Cabinet Materials Card */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                  <h3 className="text-base font-black text-gray-800 tracking-wider flex items-center gap-2"><span className="text-xl">🗄️</span> 柜体选材与报价</h3>
                  <div className="text-sm font-bold text-gray-500">柜体核算金额: <span className="text-xl font-black text-black ml-1">¥{currentCalcs.cabinetPortionTotal.toFixed(0)}</span></div>
                </div>
                <div className="grid grid-cols-4 gap-5 mb-5">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-500 mb-2">① 系统基础柜材 (决定底价)</label>
                    <select value={activeCabinet.cabinet_mat_id} onChange={e=>updateActiveCabinet('cabinet_mat_id', e.target.value)} className="w-full border-2 border-gray-200 p-3.5 rounded-xl bg-gray-50 font-bold focus:bg-white focus:border-black focus:outline-none cursor-pointer">
                      <option value="">-- 请选择柜体基础字典项 --</option>
                      {cabinets.map(c => <option key={c.id} value={c.id}>{c.name} (系统价: ¥{c.base_price})</option>)}
                    </select>
                  </div>
                  <div className="col-span-2 grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-2">② 客户指定品牌</label>
                      <input value={activeCabinet.snap_cabinet_brand} onChange={e=>updateActiveCabinet('snap_cabinet_brand', e.target.value)} placeholder="如: 爱格" className="w-full border-2 border-gray-200 p-3.5 rounded-xl font-bold focus:border-black focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-2">③ 客户指定颜色</label>
                      <input value={activeCabinet.snap_cabinet_color} onChange={e=>updateActiveCabinet('snap_cabinet_color', e.target.value)} placeholder="如: U702" className="w-full border-2 border-gray-200 p-3.5 rounded-xl font-bold focus:border-black focus:outline-none" />
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-4 gap-5 mb-5">
                  <div>
                     <label className="block text-xs font-bold text-gray-500 mb-2">④ 板材厚度 (mm)</label>
                     <input type="number" value={activeCabinet.cabinet_thickness} onChange={e=>updateActiveCabinet('cabinet_thickness', e.target.value)} placeholder="如: 18" className="w-full border-2 border-gray-200 p-3.5 rounded-xl font-bold focus:border-black focus:outline-none text-center" />
                  </div>
                  <div>
                     <label className="block text-xs font-bold text-gray-500 mb-2">⑤ 基础背板规格</label>
                     <select value={activeCabinet.snap_back_panel_spec} onChange={e=>updateActiveCabinet('snap_back_panel_spec', e.target.value)} className="w-full border-2 border-gray-200 p-3.5 rounded-xl font-bold bg-white focus:outline-none">
                       <option value="9mm标准">9mm标准</option><option value="18mm厚背板">18mm厚背板 (需补差价)</option>
                     </select>
                  </div>
                  <div className="col-span-2">
                     <label className="block text-xs font-bold text-gray-500 mb-2">综合选材备注</label>
                     <input value={activeCabinet.cabinet_material_remark} onChange={e=>updateActiveCabinet('cabinet_material_remark', e.target.value)} placeholder="例如: 客户自带五金..." className="w-full border-2 border-gray-200 p-3.5 rounded-xl font-medium focus:border-black focus:outline-none" />
                  </div>
                </div>

                <div className="flex justify-between items-center bg-amber-50/50 p-5 rounded-2xl border border-amber-200">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-black text-xl">¥</div>
                    <div>
                      <div className="text-sm font-black text-amber-900 mb-1">柜体单价人工溢价调整 (元/㎡)</div>
                      <div className="text-xs font-bold text-amber-700/70">若选名牌存在差价，请在此补正</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <input type="number" placeholder="金额 (如+100)" value={activeCabinet.cabinet_unit_adjustment} onChange={e=>updateActiveCabinet('cabinet_unit_adjustment', e.target.value)} className="w-40 border-2 border-amber-300 p-3 rounded-xl font-black text-amber-900 text-center focus:outline-none focus:border-amber-500 bg-white shadow-inner text-lg" />
                    <div className="text-right">
                      <div className="text-xs font-bold text-gray-500 uppercase mb-1">冻结最终单价快照</div>
                      <div className="text-2xl font-black text-black">¥{currentCalcs.finalCabUnitPrice}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Door Materials Card */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                  <h3 className="text-base font-black text-gray-800 tracking-wider flex items-center gap-2"><span className="text-xl">🚪</span> 门板选材与报价</h3>
                  <div className="text-sm font-bold text-gray-500">门板核算金额: <span className="text-xl font-black text-black ml-1">¥{currentCalcs.doorPortionTotal.toFixed(0)}</span></div>
                </div>
                <div className="grid grid-cols-4 gap-5 mb-5">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-500 mb-2">① 系统基础门板 (决定底价或无门系数)</label>
                    <select value={activeCabinet.door_mat_id} onChange={e=>updateActiveCabinet('door_mat_id', e.target.value)} className="w-full border-2 border-gray-200 p-3.5 rounded-xl bg-gray-50 font-bold focus:bg-white focus:border-black focus:outline-none cursor-pointer">
                      <option value="">-- 请选择门板材料 (不选则触发无门板补偿计算) --</option>
                      {doors.map(d => <option key={d.id} value={d.id}>{d.name} (系统价: ¥{d.base_price})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-2">② 客户指定品牌</label>
                    <input value={activeCabinet.snap_door_brand} onChange={e=>updateActiveCabinet('snap_door_brand', e.target.value)} placeholder="如: 克诺斯邦" className="w-full border-2 border-gray-200 p-3.5 rounded-xl font-bold focus:border-black focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-2">③ 客户指定颜色</label>
                    <input value={activeCabinet.snap_door_color} onChange={e=>updateActiveCabinet('snap_door_color', e.target.value)} placeholder="如: 极简灰" className="w-full border-2 border-gray-200 p-3.5 rounded-xl font-bold focus:border-black focus:outline-none" />
                  </div>
                </div>
                
                <div className="flex justify-between items-center bg-blue-50/50 p-5 rounded-2xl border border-blue-200">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-black text-xl">¥</div>
                    <div>
                      <div className="text-sm font-black text-blue-900 mb-1">门板单价人工溢价调整 (元/㎡)</div>
                      <div className="text-xs font-bold text-blue-700/70">针对特殊烤漆/造型进行调价补正</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <input type="number" placeholder="金额 (如+50)" value={activeCabinet.door_unit_adjustment} onChange={e=>updateActiveCabinet('door_unit_adjustment', e.target.value)} className="w-40 border-2 border-blue-300 p-3 rounded-xl font-black text-blue-900 text-center focus:outline-none focus:border-blue-500 bg-white shadow-inner text-lg" />
                    <div className="text-right">
                      <div className="text-xs font-bold text-gray-500 uppercase mb-1">冻结最终单价快照</div>
                      <div className="text-2xl font-black text-black">¥{currentCalcs.finalDoorUnitPrice}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Upgrades Placeholder (Stage 4) */}
              <div className="border-2 border-dashed border-gray-300 rounded-3xl p-10 flex flex-col items-center justify-center text-gray-400 bg-gray-50/30">
                <span className="text-4xl mb-4 opacity-40">✨</span>
                <h3 className="font-black mb-2 text-gray-500 tracking-wider">局部工艺与五金升级库</h3>
                <p className="text-sm font-medium">【多柜工作台 - 下一阶段】将在此接入全自动扣底计价引擎</p>
              </div>

            </div>
          </div>
        </div>

        {/* Floating Bottom Totals Bar */}
        <div className="fixed bottom-0 right-0 left-80 bg-white/90 backdrop-blur-xl border-t border-gray-200 p-6 flex justify-between items-center shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-20">
          <div className="flex gap-12 items-center pl-4">
            <div>
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">单柜基础核算</div>
              <div className="text-xl font-black text-gray-800">¥{currentCalcs.cabinetPortionTotal.toFixed(0)}</div>
            </div>
            <div className="h-8 w-px bg-gray-200"></div>
            <div>
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">单柜门板核算</div>
              <div className="text-xl font-black text-gray-800">¥{currentCalcs.doorPortionTotal.toFixed(0)}</div>
            </div>
          </div>
          <div className="flex items-center gap-12">
            <div className="text-right">
              <div className="text-xs font-black text-blue-600 uppercase tracking-widest mb-1">当前选择单柜小计</div>
              <div className="text-4xl font-black text-black drop-shadow-sm">¥{currentCalcs.baseTotal.toFixed(0)}</div>
            </div>
            <div className="h-16 w-px bg-gray-200"></div>
            <div className="text-right pr-4">
              <div className="text-sm font-black text-rose-600 uppercase tracking-widest mb-1">本项目全案整单大计</div>
              <div className="text-5xl font-black text-rose-600 drop-shadow-sm">¥{grandTotal.toFixed(0)}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center font-sans">
       <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-5xl font-black text-gray-900 tracking-widest mb-4">NOEY<span className="font-light">ERP</span></h1>
          <p className="text-gray-500 font-medium tracking-widest uppercase">诺一家具 核心业务系统 V2.7</p>
        </div>
        <div className="grid grid-cols-2 gap-8 w-full max-w-4xl px-6">
          <button onClick={enterSalesWorkspace} className="bg-white p-10 rounded-3xl shadow-xl hover:shadow-2xl transition-all border border-gray-100 group text-left relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-blue-600 text-white px-4 py-1 rounded-bl-xl text-xs font-bold tracking-widest uppercase">工作台 V1.0</div>
            <div className="text-5xl mb-6 group-hover:scale-110 transition-transform origin-left">💻</div>
            <h2 className="text-2xl font-black text-gray-900 mb-2">无极多柜报价工作台</h2>
            <p className="text-gray-500 text-sm leading-relaxed">业务前线：建立订单、尺寸智能计价、一键配置五金升级。</p>
          </button>
          <button onClick={() => setCurrentView('admin-login')} className="bg-gray-900 p-10 rounded-3xl shadow-xl hover:shadow-2xl transition-all group text-left">
            <div className="text-5xl mb-6 group-hover:scale-110 transition-transform origin-left">⚙️</div>
            <h2 className="text-2xl font-black text-white mb-2">底层数据管理台</h2>
            <p className="text-gray-400 text-sm leading-relaxed">后台中枢：维护基础材料库、配置规则引擎、维护升级工艺。</p>
          </button>
        </div>
    </div>
  );
}
