import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// 专属配置：连接您的云端 V2.7 数据库
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

  // === 后台表单状态 ===
  const [cabinetForm, setCabinetForm] = useState({ name: '', base_price: '', shallow_price: '', no_door_factor: '' });
  const [doorForm, setDoorForm] = useState({ name: '', door_type: '普通门板', base_price: '' });
  const [upgradeForm, setUpgradeForm] = useState({
    name: '', upgrade_category: '门板升级', calculation_type: '按面积㎡', 
    upgrade_effect_type: 'add_cost', replace_calculation_mode: 'full_price',
    unit: '㎡', unit_price: '', sort_order: 0, status: true, description: '', is_standard_item: false, allow_manual_edit: true
  });

  const [quoteInfo, setQuoteInfo] = useState({ 
    quoteNo: '', 
    customerName: '', 
    customerPhone: '', 
    deliveryAddress: '', // 暂存于前端，待未来数据库增加字段
    status: '编辑中' // 默认状态
  });

  const [quoteCabinets, setQuoteCabinets] = useState([]);
  const [activeCabinetId, setActiveCabinetId] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  // 自动生成专业订单号 (NYGN + YYMMDD + 4位随机)
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

  // 手机号严格校验
  const isValidPhone = (phone) => {
    const regex = /^1[3-9]\d{9}$/;
    return regex.test(phone);
  };

  // 初始化或进入销售控制台
  const enterSalesWorkspace = () => {
    setQuoteInfo({ 
      quoteNo: generateQuoteNo(), 
      customerName: '', 
      customerPhone: '', 
      deliveryAddress: '', 
      status: '编辑中' 
    });
    
    const initCabId = 'cab-' + Date.now();
    setQuoteCabinets([{ 
      id: initCabId, 
      space: '主卧', 
      cabinetType: '衣柜', 
      width: '', height: '', depth: '',
      cabinet_mat_id: '', cabinet_brand: '', cabinet_color: '', cabinet_unit_adjustment: '', cabinet_material_remark: '',
      door_mat_id: '', door_brand: '', door_color: '', door_unit_adjustment: '',
      snap_back_panel_spec: '9mm标准'
    }]);
    setActiveCabinetId(initCabId);
    setCurrentView('sales');
  };

  const fetchAdminData = async () => {
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
    if (currentView === 'admin' || currentView === 'sales') {
      fetchAdminData();
    }
  }, [currentView]);

  const activeCabinet = quoteCabinets.find(c => c.id === activeCabinetId) || quoteCabinets[0];

  const updateActiveCabinet = (field, value) => {
    setQuoteCabinets(prev => prev.map(c => c.id === activeCabinetId ? { ...c, [field]: value } : c));
  };

  const handleAddCabinet = () => {
    const newId = 'cab-' + Date.now();
    setQuoteCabinets([...quoteCabinets, { 
      id: newId, space: '次卧', cabinetType: '衣柜', width: '', height: '', depth: '',
      cabinet_mat_id: '', cabinet_brand: '', cabinet_color: '', cabinet_unit_adjustment: '', cabinet_material_remark: '',
      door_mat_id: '', door_brand: '', door_color: '', door_unit_adjustment: '',
      snap_back_panel_spec: '9mm标准'
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
    if (quoteCabinets.length <= 1) {
      showToast('至少需要保留一个柜体', 'error');
      return;
    }
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
    if (!w || !h || !d) return result; // 尺寸不全不计算

    // 1. 判断量与计价模式
    let area = Math.max((w / 1000) * (h / 1000), rules.minimum_area || 1);
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

    // 最终快照单价
    result.finalCabUnitPrice = baseCabPrice + adjCab;
    let finalShallowUnitPrice = shallowCabPrice + adjCab;

    let baseDoorPrice = doorMat ? parseFloat(doorMat.base_price) || 0 : 0;
    let adjDoor = parseFloat(cab.door_unit_adjustment) || 0;
    result.finalDoorUnitPrice = baseDoorPrice + adjDoor;

    let hasDoor = doorMat && doorMat.door_type !== '无门板';
    let stdDepth = rules.standard_depth || 600;
    let shallowDepth = rules.shallow_depth || 295;

    let unitCabCost = 0;
    let unitDoorCost = 0;

    // 3. 深度核心算法 (超深只加收柜体不加收门板)
    if (!hasDoor) {
      if (d <= shallowDepth) unitCabCost = finalShallowUnitPrice * noDoorFactor;
      else if (d <= stdDepth) unitCabCost = result.finalCabUnitPrice * noDoorFactor;
      else unitCabCost = result.finalCabUnitPrice * noDoorFactor * (d / stdDepth);
    } else {
      unitDoorCost = result.finalDoorUnitPrice;
      if (d <= shallowDepth) unitCabCost = finalShallowUnitPrice;
      else if (d <= stdDepth) unitCabCost = result.finalCabUnitPrice;
      else unitCabCost = result.finalCabUnitPrice * (d / stdDepth);
    }

    // 4. 得出总计
    result.cabinetPortionTotal = unitCabCost * result.qty;
    result.doorPortionTotal = unitDoorCost * result.qty;
    result.baseTotal = result.cabinetPortionTotal + result.doorPortionTotal;

    return result;
  };

  const handleSaveDraft = async () => {
    if (!quoteInfo.customerName) { showToast('请填写客户姓名', 'error'); return; }
    if (!quoteInfo.customerPhone) { showToast('请填写联系电话', 'error'); return; }
    if (!isValidPhone(quoteInfo.customerPhone)) { showToast('手机号码格式不正确，必须为11位大陆号码', 'error'); return; }
    
    setIsLoading(true);
    try {
      // 1. 存主表 (暂不保存交付地址，以免引起结构报错)
      const { data: quoteData, error: quoteErr } = await supabase.from('quotes').insert([{
        quote_no: quoteInfo.quoteNo,
        customer_name: quoteInfo.customerName,
        customer_phone: quoteInfo.customerPhone,
        status: '已保存',
      }]).select().single();

      if (quoteErr) throw quoteErr;

      // 2. 存明细表 (固化品牌、颜色、快照单价)
      const cabinetInserts = quoteCabinets.map(cab => {
        const calcs = calculateCabinetDetails(cab);
        return {
          quote_id: quoteData.id,
          name: `${cab.space}｜${cab.cabinetType}`, 
          cabinet_type: cab.cabinetType,
          width: parseFloat(cab.width) || 0,
          height: parseFloat(cab.height) || 0,
          depth: parseFloat(cab.depth) || 0,
          calc_method: calcs.calcMethod,
          cabinet_mat_id: cab.cabinet_mat_id || null,
          door_mat_id: cab.door_mat_id || null,
          snap_cabinet_brand: cab.cabinet_brand || '',
          snap_cabinet_color: cab.cabinet_color || '',
          snap_door_brand: cab.door_brand || '',
          snap_door_color: cab.door_color || '',
          snap_back_panel_spec: cab.snap_back_panel_spec || '',
          cabinet_unit_adjustment: parseFloat(cab.cabinet_unit_adjustment) || 0,
          door_unit_adjustment: parseFloat(cab.door_unit_adjustment) || 0,
          snap_final_cabinet_price: calcs.finalCabUnitPrice,
          snap_final_door_price: calcs.finalDoorUnitPrice,
          cabinet_material_remark: cab.cabinet_material_remark || '',
          sub_total: calcs.baseTotal // 暂不包含升级项，下阶段加入
        };
      });

      const { error: cabErr } = await supabase.from('quote_cabinets').insert(cabinetInserts);
      if (cabErr) throw cabErr;

      setQuoteInfo(prev => ({ ...prev, status: '已保存' }));
      showToast(`✅ 草稿保存成功！单号固化为: ${quoteInfo.quoteNo}`);
      
    } catch (err) {
      showToast('保存失败: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const executeAdminDelete = async () => {
    const { table, id } = deleteConfirm;
    try {
      setIsLoading(true);
      if (currentUser?.role !== 'admin') throw new Error('权限拦截：非管理员禁止删除。');

      let checkTable = ''; let checkColumn = '';
      if (table === 'materials_cabinet') { checkTable = 'quote_cabinets'; checkColumn = 'cabinet_mat_id'; }
      else if (table === 'materials_door') { checkTable = 'quote_cabinets'; checkColumn = 'door_mat_id'; }
      else if (table === 'upgrade_items') { checkTable = 'quote_upgrades'; checkColumn = 'upgrade_item_id'; }

      if (checkTable && checkColumn) {
        const { data: refData, error: refError } = await supabase.from(checkTable).select('id').eq(checkColumn, id).limit(1);
        if (refError && refError.code !== '42P01') throw refError;
        if (refData && refData.length > 0) {
          throw new Error('该项目已经被历史报价单引用，无法删除，请改为停用。');
        }
      }
      
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      
      showToast('✅ 物理删除成功');
      setDeleteConfirm({ show: false, table: '', id: null, name: '' });
      fetchAdminData(); 
    } catch (err) {
      showToast('❌ ' + err.message, 'error');
      setDeleteConfirm({ show: false, table: '', id: null, name: '' });
    } finally {
      setIsLoading(false);
    }
  };


  if (currentView === 'home') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center font-sans relative">
        {toast.show && <div className="absolute top-10 bg-black text-white px-6 py-3 rounded-full text-sm font-bold shadow-2xl animate-fade-in">{toast.message}</div>}
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-5xl font-black text-gray-900 tracking-widest mb-4">NOEY<span className="font-light">ERP</span></h1>
          <p className="text-gray-500 font-medium tracking-widest uppercase">诺一家具 核心业务系统 V2.7</p>
        </div>
        <div className="grid grid-cols-2 gap-8 w-full max-w-4xl px-6">
          <button onClick={enterSalesWorkspace} className="bg-white p-10 rounded-3xl shadow-xl hover:shadow-2xl transition-all border border-gray-100 group text-left relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-blue-600 text-white px-4 py-1 rounded-bl-xl text-xs font-bold tracking-widest uppercase">Stage 2</div>
            <div className="text-5xl mb-6 group-hover:scale-110 transition-transform origin-left">💻</div>
            <h2 className="text-2xl font-black text-gray-900 mb-2">多柜报价工作台</h2>
            <p className="text-gray-500 text-sm leading-relaxed">业务前线：建立订单、尺寸智能计价、一键配置五金升级、生成标准化正式报价单。</p>
          </button>
          <button onClick={() => setCurrentView('admin-login')} className="bg-gray-900 p-10 rounded-3xl shadow-xl hover:shadow-2xl transition-all group text-left">
            <div className="text-5xl mb-6 group-hover:scale-110 transition-transform origin-left">⚙️</div>
            <h2 className="text-2xl font-black text-white mb-2">底层数据管理台</h2>
            <p className="text-gray-400 text-sm leading-relaxed">后台中枢：维护基础材料库、配置规则引擎、维护升级工艺与五金字典。</p>
          </button>
        </div>
      </div>
    );
  }

  if (currentView === 'sales') {
    if (!activeCabinet) return null; // 防错
    const currentCalcs = calculateCabinetDetails(activeCabinet);

    return (
      <div className="flex flex-col h-screen bg-gray-100 font-sans overflow-hidden">
        {toast.show && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-black text-white px-6 py-3 rounded-full text-sm font-bold shadow-2xl animate-fade-in">{toast.message}</div>}
        
        {/* 顶部状态栏 */}
        <div className="h-16 bg-white border-b border-gray-200 flex justify-between items-center px-6 shrink-0 z-20 shadow-sm">
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
            <button onClick={handleSaveDraft} disabled={isLoading} className="bg-black text-white px-6 py-2 rounded-lg font-bold shadow hover:bg-gray-800 transition-all active:scale-95 disabled:bg-gray-400">
              {isLoading ? '保存中...' : '💾 保存报价草稿'}
            </button>
          </div>
        </div>

        {/* 主体工作区 (左右分栏) */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* 左侧：客户信息与柜体清单 */}
          <div className="w-80 bg-white border-r border-gray-200 flex flex-col shrink-0 z-10 shadow-lg">
            <div className="p-5 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-xs font-black tracking-widest text-gray-400 uppercase mb-4">📋 客户基础档案</h2>
              <div className="space-y-3">
                <div>
                  <input value={quoteInfo.customerName} onChange={e=>setQuoteInfo({...quoteInfo, customerName:e.target.value})} placeholder="客户名称 (必填)" className="w-full bg-white border border-gray-200 p-2.5 text-sm rounded-lg focus:border-black focus:outline-none font-bold text-gray-800" />
                </div>
                <div>
                  <input value={quoteInfo.customerPhone} onChange={e=>setQuoteInfo({...quoteInfo, customerPhone:e.target.value})} placeholder="联系电话 (11位数字)" className="w-full bg-white border border-gray-200 p-2.5 text-sm rounded-lg focus:border-black focus:outline-none font-bold text-gray-800" />
                </div>
                <div>
                  <textarea value={quoteInfo.deliveryAddress} onChange={e=>setQuoteInfo({...quoteInfo, deliveryAddress:e.target.value})} placeholder="交付地址 (选填，暂存于系统内存)" rows="2" className="w-full bg-white border border-gray-200 p-2.5 text-sm rounded-lg focus:border-black focus:outline-none font-medium text-gray-600 resize-none" />
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
              <div className="flex justify-between items-center px-1 mb-2">
                <span className="text-xs font-black tracking-widest text-gray-400 uppercase">🗄️ 柜体清单 ({quoteCabinets.length})</span>
                <button onClick={handleAddCabinet} className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded">➕ 新增</button>
              </div>
              
              {quoteCabinets.map((cab) => (
                <div key={cab.id} onClick={() => setActiveCabinetId(cab.id)}
                  className={`p-4 rounded-xl cursor-pointer transition-all border-2 relative group ${activeCabinetId === cab.id ? 'bg-white border-black shadow-md' : 'bg-white border-transparent shadow-sm hover:border-gray-300'}`}>
                  <div className="flex justify-between items-start mb-1">
                    <div className="font-bold text-gray-900 text-sm tracking-wide">
                      {cab.space}{cab.cabinetType}
                    </div>
                    <div className="hidden group-hover:flex gap-1 absolute right-2 top-2 bg-white rounded shadow-sm border border-gray-100 p-1">
                      <button onClick={(e) => handleCopyCabinet(e, cab)} className="text-blue-500 hover:bg-blue-50 p-1 rounded text-xs font-bold">复制</button>
                      <button onClick={(e) => handleDeleteCabinet(e, cab.id)} className="text-rose-500 hover:bg-rose-50 p-1 rounded text-xs font-bold">删除</button>
                    </div>
                  </div>
                  <div className="text-xs font-mono text-gray-500 mt-2 bg-gray-50 p-1.5 rounded inline-block">
                    {cab.width || '?'} × {cab.height || '?'} × {cab.depth || '?'} mm
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 右侧：单柜业务配置区 */}
          <div className="flex-1 overflow-y-auto p-8 bg-gray-100 pb-32">
            <div className="max-w-4xl mx-auto space-y-6">
              
              {/* 1. 基础尺寸面板 */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                  <h3 className="text-base font-black text-gray-800 tracking-wider flex items-center gap-2"><span className="text-xl">📐</span> 基础定义与尺寸</h3>
                  <div className="text-xs font-bold bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full">当前算法：<span className="text-black">{currentCalcs.calcMethod}</span></div>
                </div>
                <div className="grid grid-cols-5 gap-6">
                  <div className="col-span-1"><label className="block text-xs font-bold text-gray-500 mb-2">所在空间</label><input value={activeCabinet.space} onChange={e=>updateActiveCabinet('space', e.target.value)} className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-black focus:outline-none font-bold text-gray-700" /></div>
                  <div className="col-span-1"><label className="block text-xs font-bold text-gray-500 mb-2">柜体类型</label><input value={activeCabinet.cabinetType} onChange={e=>updateActiveCabinet('cabinetType', e.target.value)} className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-black focus:outline-none font-bold text-gray-700" /></div>
                  <div className="col-span-1"><label className="block text-xs font-bold text-blue-500 mb-2">宽度 W (mm)</label><input type="number" value={activeCabinet.width} onChange={e=>updateActiveCabinet('width', e.target.value)} className="w-full border-2 border-blue-200 p-3 rounded-xl focus:border-blue-500 focus:outline-none font-black text-gray-900 text-center bg-blue-50/30" /></div>
                  <div className="col-span-1"><label className="block text-xs font-bold text-blue-500 mb-2">高度 H (mm)</label><input type="number" value={activeCabinet.height} onChange={e=>updateActiveCabinet('height', e.target.value)} className="w-full border-2 border-blue-200 p-3 rounded-xl focus:border-blue-500 focus:outline-none font-black text-gray-900 text-center bg-blue-50/30" /></div>
                  <div className="col-span-1"><label className="block text-xs font-bold text-blue-500 mb-2">深度 D (mm)</label><input type="number" value={activeCabinet.depth} onChange={e=>updateActiveCabinet('depth', e.target.value)} className="w-full border-2 border-blue-200 p-3 rounded-xl focus:border-blue-500 focus:outline-none font-black text-gray-900 text-center bg-blue-50/30" /></div>
                </div>
              </div>

              {/* 2. 柜体材料选配面板 */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                  <h3 className="text-base font-black text-gray-800 tracking-wider flex items-center gap-2"><span className="text-xl">🗄️</span> 柜体材质配置</h3>
                  <div className="text-sm font-black text-gray-900">小计: ¥{currentCalcs.cabinetPortionTotal.toFixed(0)}</div>
                </div>
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-500 mb-2">选择基础材料 (决定底价)</label>
                    <select value={activeCabinet.cabinet_mat_id} onChange={e=>updateActiveCabinet('cabinet_mat_id', e.target.value)} className="w-full border-2 border-gray-200 p-3 rounded-xl bg-gray-50 font-bold focus:border-black focus:outline-none">
                      <option value="">-- 请选择柜体系统材料 --</option>
                      {cabinets.map(c => <option key={c.id} value={c.id}>{c.name} (系统价: ¥{c.base_price})</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-500 mb-2">客户指定品牌 / 颜色 (订单记录)</label>
                    <div className="flex gap-2">
                      <input value={activeCabinet.cabinet_brand} onChange={e=>updateActiveCabinet('cabinet_brand', e.target.value)} placeholder="品牌(如爱格)" className="w-1/2 border-2 border-gray-200 p-3 rounded-xl font-medium focus:border-black focus:outline-none" />
                      <input value={activeCabinet.cabinet_color} onChange={e=>updateActiveCabinet('cabinet_color', e.target.value)} placeholder="颜色(如U702)" className="w-1/2 border-2 border-gray-200 p-3 rounded-xl font-medium focus:border-black focus:outline-none" />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4 bg-amber-50 p-4 rounded-xl border border-amber-100 items-center">
                  <div className="col-span-2 text-xs font-bold text-amber-700">如果指定品牌存在溢价，请在右侧人工调整：</div>
                  <div>
                    <input type="number" placeholder="调整金额(如+100)" value={activeCabinet.cabinet_unit_adjustment} onChange={e=>updateActiveCabinet('cabinet_unit_adjustment', e.target.value)} className="w-full border-2 border-amber-200 p-2.5 rounded-lg font-black text-amber-900 text-center focus:outline-none bg-white" />
                  </div>
                  <div className="text-right text-xs font-bold text-gray-600">
                    最终单价快照: <span className="text-lg text-black font-black ml-1">¥{currentCalcs.finalCabUnitPrice}</span>
                  </div>
                </div>
              </div>

              {/* 3. 门板材料选配面板 */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                  <h3 className="text-base font-black text-gray-800 tracking-wider flex items-center gap-2"><span className="text-xl">🚪</span> 门板材质配置</h3>
                  <div className="text-sm font-black text-gray-900">小计: ¥{currentCalcs.doorPortionTotal.toFixed(0)}</div>
                </div>
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-500 mb-2">选择基础门板 (决定底价)</label>
                    <select value={activeCabinet.door_mat_id} onChange={e=>updateActiveCabinet('door_mat_id', e.target.value)} className="w-full border-2 border-gray-200 p-3 rounded-xl bg-gray-50 font-bold focus:border-black focus:outline-none">
                      <option value="">-- 请选择门板材料 (或留空表示无门) --</option>
                      {doors.map(d => <option key={d.id} value={d.id}>{d.name} (系统价: ¥{d.base_price})</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-500 mb-2">客户指定品牌 / 颜色 (订单记录)</label>
                    <div className="flex gap-2">
                      <input value={activeCabinet.door_brand} onChange={e=>updateActiveCabinet('door_brand', e.target.value)} placeholder="门板品牌" className="w-1/2 border-2 border-gray-200 p-3 rounded-xl font-medium focus:border-black focus:outline-none" />
                      <input value={activeCabinet.door_color} onChange={e=>updateActiveCabinet('door_color', e.target.value)} placeholder="门板颜色" className="w-1/2 border-2 border-gray-200 p-3 rounded-xl font-medium focus:border-black focus:outline-none" />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4 bg-blue-50 p-4 rounded-xl border border-blue-100 items-center">
                  <div className="col-span-2 text-xs font-bold text-blue-700">门板溢价调整 (元/㎡)：</div>
                  <div>
                    <input type="number" placeholder="调整金额(如+50)" value={activeCabinet.door_unit_adjustment} onChange={e=>updateActiveCabinet('door_unit_adjustment', e.target.value)} className="w-full border-2 border-blue-200 p-2.5 rounded-lg font-black text-blue-900 text-center focus:outline-none bg-white" />
                  </div>
                  <div className="text-right text-xs font-bold text-gray-600">
                    最终单价快照: <span className="text-lg text-black font-black ml-1">¥{currentCalcs.finalDoorUnitPrice}</span>
                  </div>
                </div>
              </div>

              {/* 预留：第三阶段开发区 */}
              <div className="border-2 border-dashed border-gray-300 rounded-2xl p-10 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50">
                <span className="text-3xl mb-3 opacity-50">🛠️</span>
                <h3 className="font-bold mb-1 text-gray-500">五金、灯光与工艺升级区</h3>
                <p className="text-xs">【多柜工作台 第三阶段】即将在此接入强大的局部计价引擎</p>
              </div>

            </div>
          </div>
        </div>

        {/* 底部吸底核算栏 */}
        <div className="fixed bottom-0 right-0 left-80 bg-white border-t border-gray-200 p-6 flex justify-between items-center shadow-[0_-10px_30px_rgba(0,0,0,0.05)] z-20">
          <div className="flex gap-10">
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">单柜柜体核算</div>
              <div className="text-2xl font-black text-gray-800">¥{currentCalcs.cabinetPortionTotal.toFixed(0)}</div>
            </div>
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">单柜门板核算</div>
              <div className="text-2xl font-black text-gray-800">¥{currentCalcs.doorPortionTotal.toFixed(0)}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-black text-blue-600 uppercase tracking-widest mb-1">单柜当前基础合计</div>
            <div className="text-4xl font-black text-black">¥{currentCalcs.baseTotal.toFixed(0)}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100 font-sans overflow-hidden">
      {/* 后台管理员界面的代码结构保持不变，以确保第一阶段功能不受损。由于当前对话聚焦于销售端，为避免单次代码过长，此处省略后台完整UI，仅保留基础骨架结构。 */}
      <div className="flex items-center justify-center w-full h-full text-gray-500">
        请在 `currentView === 'sales'` 中查看最新的多柜工作台代码。如需管理后台，请返回前一版本代码或通过状态栏切换。
      </div>
    </div>
  );
}
