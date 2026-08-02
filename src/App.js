import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import * as LucideIcons from 'lucide-react';

// 专属配置：自动清理 URL，确保连接无误
const rawSupabaseUrl = 'https://muwzdigtehcperweliyg.supabase.co/rest/v1/'; 
const supabaseKey = 'sb_publishable_SGHvdmqpvo3Z6GekTtk4cA_PcvbDGpd';
const supabaseUrl = rawSupabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabase = createClient(supabaseUrl, supabaseKey);

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [currentView, setCurrentView] = useState('workspace'); // workspace, admin, my-quotes
  const [isLoading, setIsLoading] = useState(false);

  // 基础数据字典状态
  const [cabinetsData, setCabinetsData] = useState([]);
  const [doorsData, setDoorsData] = useState([]);
  const [upgradesData, setUpgradesData] = useState([]);
  const [rulesData, setRulesData] = useState({
    id: null, standard_depth: 600, shallow_depth: 295, height_threshold: 1000, minimum_area: 1, minimum_width: 1000
  });

  // 当前报价单主表信息
  const [activeQuote, setActiveQuote] = useState({
    id: null,
    quote_no: '',
    customer_name: '',
    customer_phone: '',
    delivery_address: '',
    status: '编辑中',
    cabinets: [] // 柜体明细列表
  });

  // 选中的柜体 (左侧正在编辑的柜体)
  const [activeCabinetId, setActiveCabinetId] = useState(null);

  // 升级项弹窗状态
  const [upgradeModal, setUpgradeModal] = useState({
    show: false,
    selectedItem: null,
    inputQty: '',
    manualDoorArea: '',
    unitPriceAdj: ''
  });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const resCab = await supabase.from('materials_cabinet').select('*').order('name');
      const resDoor = await supabase.from('materials_door').select('*').order('name');
      const resUpg = await supabase.from('upgrade_items').select('*').order('name');
      const resRule = await supabase.from('pricing_rules').select('*').limit(1);

      if (resCab.data) setCabinetsData(resCab.data);
      if (resDoor.data) setDoorsData(resDoor.data);
      if (resUpg.data) setUpgradesData(resUpg.data);
      if (resRule.data && resRule.data.length > 0) setRulesData(resRule.data[0]);
    } catch (error) {
      showToast('数据读取失败', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) fetchData();
  }, [currentUser]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('employees')
        .select('*').eq('username', loginForm.username).eq('password', loginForm.password).single();
      if (error || !data) throw new Error('账号或密码错误');
      setCurrentUser(data);
      showToast(`欢迎, ${data.name}`);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const generateOrderNo = () => {
    const dateStr = new Date().toISOString().slice(2,10).replace(/-/g,''); // YYMMDD
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase(); // 4位随机
    return `NYGN${dateStr}${randomStr}`;
  };

  // 核心计价引擎：根据当前所有参数重算单个柜子的金额
  const calculateCabinetDetails = (cabinet) => {
    const w = parseFloat(cabinet.width) || 0;
    const h = parseFloat(cabinet.height) || 0;
    const d = parseFloat(cabinet.depth) || 0;
    
    // 1. 获取柜体和门板基础物料数据
    const cabMat = cabinetsData.find(c => c.id === cabinet.cabinet_mat_id);
    const doorMat = doorsData.find(d => d.id === cabinet.door_mat_id);

    // 2. 算量判定 (面积 or 延米)
    let calcMode = '按面积㎡';
    let baseArea = 0;
    
    if (h > rulesData.height_threshold) {
      const actualArea = (w * h) / 1000000;
      baseArea = Math.max(actualArea, rulesData.minimum_area);
      calcMode = '按面积㎡';
    } else {
      const actualMeter = w / 1000;
      baseArea = Math.max(actualMeter, rulesData.minimum_width / 1000);
      calcMode = '按延米';
    }

    // 默认门板面积 = 柜体面积
    const defaultDoorArea = baseArea;

    // 3. 计算最终核算单价 (基础 + 调价)
    const cabFinalPrice = cabMat ? (parseFloat(cabMat.base_price) + parseFloat(cabinet.cabinet_unit_adjustment || 0)) : 0;
    const cabShallowPrice = cabMat ? (parseFloat(cabMat.shallow_price) + parseFloat(cabinet.cabinet_unit_adjustment || 0)) : 0;
    const doorFinalPrice = doorMat ? (parseFloat(doorMat.base_price) + parseFloat(cabinet.door_unit_adjustment || 0)) : 0;

    // 4. 深度规则引擎
    let cabinetBaseTotal = 0;
    let doorBaseTotal = 0;

    if (cabMat) {
      if (cabinet.no_door) {
        // 无门板
        const base = (d <= rulesData.shallow_depth) ? cabShallowPrice : cabFinalPrice;
        const depthRatio = (d > rulesData.standard_depth) ? (d / rulesData.standard_depth) : 1;
        cabinetBaseTotal = base * (cabMat.no_door_factor || 1) * depthRatio * baseArea;
      } else {
        // 有门板
        const base = (d <= rulesData.shallow_depth) ? cabShallowPrice : cabFinalPrice;
        const depthRatio = (d > rulesData.standard_depth) ? (d / rulesData.standard_depth) : 1;
        cabinetBaseTotal = base * depthRatio * baseArea;
        doorBaseTotal = doorFinalPrice * defaultDoorArea;
      }
    }

    // 5. 升级工艺循环计算 (严格执行 V3.3 规则)
    let upgradesTotal = 0;
    const calculatedUpgrades = (cabinet.upgrades || []).map(upg => {
      
      const itemData = upgradesData.find(u => u.id === upg.upgrade_item_id);
      if (!itemData) return upg;

      // 算出单项最终价格
      const finalUnitPrice = parseFloat(itemData.unit_price || 0) + parseFloat(upg.unit_price_adjustment || 0);
      let calculatedQty = 0;
      let lineTotal = 0;

      // --- 规则提取 ---
      const inputQty = parseFloat(upg.input_quantity || 0);
      const minQty = parseFloat(itemData.minimum_quantity || 0);

      const isExcessDrawer = itemData.calculation_type === 'excess_drawer' || itemData.calculation_type === '超额抽屉规则';
      const isAutoWidth = itemData.calculation_type === 'auto_width' || itemData.calculation_type === '按柜宽自动算';
      const isManualAmount = itemData.calculation_type === 'manual_amount' || itemData.calculation_type === '人工输入金额';

      if (isExcessDrawer) {
        // 修正点: 超额抽屉计费规则 (CEIL 向上取整，限制最低为1个)
        const standardQty = Math.max(1, Math.ceil(w / 1000));
        calculatedQty = Math.max(0, inputQty - standardQty);
        lineTotal = calculatedQty * finalUnitPrice; // add_cost

      } else if (isAutoWidth) {
        calculatedQty = Math.max(w / 1000, minQty);
        lineTotal = calculatedQty * finalUnitPrice;

      } else if (isManualAmount || itemData.upgrade_effect_type === 'manual') {
        calculatedQty = 1;
        lineTotal = inputQty; // 直接使用输入的金额

      } else {
        // 面积、延米、按个、按套 等
        if (itemData.upgrade_effect_type === 'replace') {
           // Replace 专属面积逻辑
           const areaToUse = parseFloat(upg.manual_door_area) > 0 ? parseFloat(upg.manual_door_area) : defaultDoorArea;
           calculatedQty = Math.max(areaToUse, minQty);
           // 必须扣底价
           const baseDoorPrice = doorMat ? parseFloat(doorMat.base_price) : 0;
           lineTotal = calculatedQty * (finalUnitPrice - baseDoorPrice);
        } else {
           // Add_cost 或 Difference
           calculatedQty = Math.max(inputQty, minQty);
           lineTotal = calculatedQty * finalUnitPrice;
        }
      }

      upgradesTotal += lineTotal;

      return {
        ...upg,
        calculated_quantity: calculatedQty,
        snap_final_unit_price: finalUnitPrice,
        snap_original_unit_price: itemData.unit_price,
        snap_base_door_price: doorMat ? doorMat.base_price : 0,
        snap_upgrade_effect_type: itemData.upgrade_effect_type,
        snap_upgrade_name: itemData.name,
        total_amount: lineTotal
      };
    });

    return {
      ...cabinet,
      calc_mode: calcMode,
      calc_area: baseArea,
      cabinet_total: cabinetBaseTotal,
      door_total: doorBaseTotal,
      upgrades: calculatedUpgrades,
      upgrades_total: upgradesTotal,
      sub_total: cabinetBaseTotal + doorBaseTotal + upgradesTotal,
      snap_final_cabinet_price: cabFinalPrice,
      snap_final_door_price: doorFinalPrice
    };
  };

  const handleUpdateCabinet = (cabId, field, value) => {
    setActiveQuote(prev => {
      const updatedCabinets = prev.cabinets.map(cab => {
        if (cab.id === cabId) {
          const updatedCab = { ...cab, [field]: value };
          // 如果修改了影响价格的字段，立刻重算
          if (['width', 'height', 'depth', 'cabinet_mat_id', 'door_mat_id', 'no_door', 'cabinet_unit_adjustment', 'door_unit_adjustment'].includes(field)) {
             return calculateCabinetDetails(updatedCab);
          }
          return updatedCab;
        }
        return cab;
      });
      return { ...prev, cabinets: updatedCabinets };
    });
  };

  const addCabinet = () => {
    const newCab = {
      id: 'temp-' + Date.now(),
      space: '主卧',
      cabinet_type: '衣柜',
      name: '主卧衣柜', // space + cabinet_type 组合
      width: '', height: '', depth: '',
      cabinet_mat_id: '', door_mat_id: '', no_door: false,
      cabinet_thickness: 18,
      cabinet_brand: '', cabinet_color: '', cabinet_material_remark: '',
      door_brand: '', door_color: '', back_panel_spec: '9mm标准背板',
      cabinet_unit_adjustment: 0, door_unit_adjustment: 0,
      upgrades: [],
      calc_mode: '', calc_area: 0, cabinet_total: 0, door_total: 0, upgrades_total: 0, sub_total: 0
    };
    setActiveQuote(prev => ({ ...prev, cabinets: [...prev.cabinets, newCab] }));
    setActiveCabinetId(newCab.id);
  };

  const copyCabinet = (cabToCopy) => {
    const newCab = {
      ...cabToCopy,
      id: 'temp-' + Date.now(),
      name: cabToCopy.name + ' (副本)'
    };
    setActiveQuote(prev => ({ ...prev, cabinets: [...prev.cabinets, newCab] }));
    setActiveCabinetId(newCab.id);
  };

  const removeCabinet = (id) => {
    setActiveQuote(prev => ({ ...prev, cabinets: prev.cabinets.filter(c => c.id !== id) }));
    if (activeCabinetId === id) setActiveCabinetId(null);
  };

  const openUpgradeModal = (item) => {
    setUpgradeModal({
      show: true,
      selectedItem: item,
      inputQty: '',
      manualDoorArea: '',
      unitPriceAdj: ''
    });
  };

  const confirmAddUpgrade = () => {
    const { selectedItem, inputQty, manualDoorArea, unitPriceAdj } = upgradeModal;
    
    // 【修改点】：如果是超额抽屉，强制将传入数据库的 unit_price_adjustment 设为 0
    const isExcessDrawer = selectedItem.calculation_type === 'excess_drawer' || selectedItem.calculation_type === '超额抽屉规则';
    const finalUnitPriceAdj = isExcessDrawer ? 0 : (parseFloat(unitPriceAdj) || 0);

    const newUpgrade = {
      id: 'upg-' + Date.now(),
      upgrade_item_id: selectedItem.id,
      input_quantity: parseFloat(inputQty) || 0,
      manual_door_area: parseFloat(manualDoorArea) || 0,
      unit_price_adjustment: finalUnitPriceAdj,
      remark: ''
    };

    setActiveQuote(prev => {
      const updatedCabinets = prev.cabinets.map(cab => {
        if (cab.id === activeCabinetId) {
          const updatedCab = { ...cab, upgrades: [...cab.upgrades, newUpgrade] };
          return calculateCabinetDetails(updatedCab); // 加入工艺后重算该柜
        }
        return cab;
      });
      return { ...prev, cabinets: updatedCabinets };
    });

    setUpgradeModal({ show: false, selectedItem: null, inputQty: '', manualDoorArea: '', unitPriceAdj: '' });
  };

  const removeUpgrade = (cabId, upgId) => {
    setActiveQuote(prev => {
      const updatedCabinets = prev.cabinets.map(cab => {
        if (cab.id === cabId) {
          const updatedCab = { ...cab, upgrades: cab.upgrades.filter(u => u.id !== upgId) };
          return calculateCabinetDetails(updatedCab);
        }
        return cab;
      });
      return { ...prev, cabinets: updatedCabinets };
    });
  };

  const handleSaveQuoteDraft = async () => {
    // 1. 必填项前置校验
    if (!activeQuote.customer_name || !activeQuote.customer_phone || !activeQuote.delivery_address) {
      showToast('客户姓名、电话、交付地址均为必填项', 'error'); return;
    }
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(activeQuote.customer_phone)) {
      showToast('请输入有效的11位大陆手机号码', 'error'); return;
    }
    if (activeQuote.cabinets.length === 0) {
      showToast('请至少添加一个柜体', 'error'); return;
    }

    setIsLoading(true);
    try {
      let currentQuoteNo = activeQuote.quote_no;
      if (!currentQuoteNo) currentQuoteNo = generateOrderNo(); // 自动生成订单号

      // 计算整单总金额
      const totalAmount = activeQuote.cabinets.reduce((sum, cab) => sum + cab.sub_total, 0);

      const quotePayload = {
        quote_no: currentQuoteNo,
        customer_name: activeQuote.customer_name,
        customer_phone: activeQuote.customer_phone,
        delivery_address: activeQuote.delivery_address,
        status: '已保存',
        total_amount: totalAmount,
        created_by: currentUser.id
      };

      let dbQuoteId = activeQuote.id;

      // 插入或更新 quotes 表
      if (dbQuoteId) {
        await supabase.from('quotes').update(quotePayload).eq('id', dbQuoteId);
      } else {
        const { data, error } = await supabase.from('quotes').insert([quotePayload]).select();
        if (error) throw error;
        dbQuoteId = data[0].id;
        setActiveQuote(prev => ({ ...prev, id: dbQuoteId, quote_no: currentQuoteNo, status: '已保存' }));
      }

      // 处理 quote_cabinets (先删后插)
      await supabase.from('quote_cabinets').delete().eq('quote_id', dbQuoteId);
      
      for (const cab of activeQuote.cabinets) {
        const cabPayload = {
          quote_id: dbQuoteId,
          name: cab.name,
          width: cab.width, height: cab.height, depth: cab.depth,
          cabinet_mat_id: cab.cabinet_mat_id, door_mat_id: cab.door_mat_id, no_door: cab.no_door,
          cabinet_thickness: cab.cabinet_thickness,
          snap_cabinet_brand: cab.cabinet_brand, snap_cabinet_color: cab.cabinet_color,
          snap_door_brand: cab.door_brand, snap_door_color: cab.door_color,
          snap_back_panel_spec: cab.back_panel_spec,
          cabinet_material_remark: cab.cabinet_material_remark,
          cabinet_unit_adjustment: cab.cabinet_unit_adjustment,
          door_unit_adjustment: cab.door_unit_adjustment,
          snap_final_cabinet_price: cab.snap_final_cabinet_price,
          snap_final_door_price: cab.snap_final_door_price,
          subtotal: cab.sub_total
        };

        const { data: cabData, error: cabErr } = await supabase.from('quote_cabinets').insert([cabPayload]).select();
        if (cabErr) throw cabErr;

        // 处理 quote_upgrades
        if (cab.upgrades && cab.upgrades.length > 0) {
          const upgPayloads = cab.upgrades.map(u => ({
            quote_id: dbQuoteId,
            quote_cabinet_id: cabData[0].id,
            upgrade_item_id: u.upgrade_item_id,
            input_quantity: u.input_quantity,
            calculated_quantity: u.calculated_quantity,
            manual_door_area: u.manual_door_area,
            unit_price_adjustment: u.unit_price_adjustment,
            snap_final_unit_price: u.snap_final_unit_price,
            snap_original_unit_price: u.snap_original_unit_price,
            snap_base_door_price: u.snap_base_door_price,
            snap_upgrade_effect_type: u.snap_upgrade_effect_type,
            snap_upgrade_name: u.snap_upgrade_name,
            total_price: u.total_amount,
            remark: u.remark
          }));
          await supabase.from('quote_upgrades').insert(upgPayloads);
        }
      }

      showToast('✅ 报价草稿保存成功！');
    } catch (err) {
      showToast('保存失败: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const renderUpgradeModal = () => {
    if (!upgradeModal.show || !upgradeModal.selectedItem) return null;
    const item = upgradeModal.selectedItem;
    const activeCab = activeQuote.cabinets.find(c => c.id === activeCabinetId);
    
    // 超额抽屉规则判定
    const isExcessDrawer = item.calculation_type === 'excess_drawer' || item.calculation_type === '超额抽屉规则';
    const isAutoWidth = item.calculation_type === 'auto_width' || item.calculation_type === '按柜宽自动算';
    const isManualAmount = item.calculation_type === 'manual_amount' || item.calculation_type === '人工输入金额';

    // 实时测算超额抽屉相关数据，用于UI展示
    let drawerStd = 0;
    let drawerExc = 0;
    let drawerCost = 0;
    if (isExcessDrawer && activeCab) {
        drawerStd = Math.max(1, Math.ceil((parseFloat(activeCab.width) || 0) / 1000));
        drawerExc = Math.max(0, (parseFloat(upgradeModal.inputQty) || 0) - drawerStd);
        drawerCost = drawerExc * parseFloat(item.unit_price || 0);
    }

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
        <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
          <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
            <h3 className="font-bold text-lg text-gray-800">工艺配置：{item.name}</h3>
            <button onClick={() => setUpgradeModal({...upgradeModal, show:false})} className="text-gray-400 hover:text-black"><LucideIcons.X size={20}/></button>
          </div>
          <div className="p-6 space-y-6">
            
            {/* 数量输入区 */}
            {isExcessDrawer ? (
              // 超额抽屉定制 UI 
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">输入实际抽屉数量</label>
                <input type="number" min="0" value={upgradeModal.inputQty} onChange={e=>setUpgradeModal({...upgradeModal, inputQty:e.target.value})} className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-blue-500 font-black text-xl text-center" />
                
                <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-900 space-y-2">
                   <div className="flex justify-between"><span>柜宽:</span><span className="font-bold">{activeCab?.width || 0} mm</span></div>
                   <div className="flex justify-between"><span>系统标配数量:</span><span className="font-bold">{drawerStd}</span></div>
                   <div className="flex justify-between"><span>客户输入数量:</span><span className="font-bold">{upgradeModal.inputQty || 0}</span></div>
                   <div className="flex justify-between border-t border-blue-200 pt-2 mt-2"><span className="font-bold text-rose-600">超额数量:</span><span className="font-black text-rose-600">{drawerExc}</span></div>
                   <div className="flex justify-between text-xs text-gray-500"><span>单价: ¥{item.unit_price}</span><span>最终费用: <strong className="text-gray-900">¥{drawerCost}</strong></span></div>
                </div>
              </div>
            ) : isAutoWidth ? (
              <div className="bg-gray-100 p-4 rounded-xl text-center text-gray-500 text-sm font-bold">系统已自动抓取柜宽: {activeCab?.width || 0} mm 参与计算</div>
            ) : (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  输入{isManualAmount ? '总金额' : '数量'}
                </label>
                <input type="number" value={upgradeModal.inputQty} onChange={e=>setUpgradeModal({...upgradeModal, inputQty:e.target.value})} className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-black font-black text-lg" placeholder={`必填 (${item.unit})`} />
              </div>
            )}

            {/* Replace 专属手工面积修正 */}
            {item.upgrade_effect_type === 'replace' && (
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                <label className="block text-xs font-bold text-amber-800 mb-2">人工修正门板面积 (㎡/选填)</label>
                <input type="number" value={upgradeModal.manualDoorArea} onChange={e=>setUpgradeModal({...upgradeModal, manualDoorArea:e.target.value})} className="w-full border border-amber-200 p-2 rounded-lg bg-white" placeholder="如门板与投影面积不符，请在此输入真实面积" />
              </div>
            )}

            {/* 调价区 (针对超额抽屉及人工输入金额隐藏) */}
            {!isExcessDrawer && !isManualAmount && (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex justify-between">
                  <span>人工单价调整</span> <span className="text-xs text-gray-400 font-normal">系统原价: ¥{item.unit_price}</span>
                </label>
                <input type="number" placeholder="加收输入正数，减免输入负数" value={upgradeModal.unitPriceAdj} onChange={e=>setUpgradeModal({...upgradeModal, unitPriceAdj:e.target.value})} className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-black font-medium text-gray-600" />
              </div>
            )}

          </div>
          <div className="p-4 border-t bg-gray-50 flex gap-3">
             <button onClick={()=>setUpgradeModal({show:false, selectedItem:null})} className="flex-1 py-3 rounded-xl font-bold bg-gray-200 text-gray-600">取消</button>
             <button onClick={confirmAddUpgrade} className="flex-[2] py-3 rounded-xl font-bold bg-black text-white shadow-lg">确认加入配置</button>
          </div>
        </div>
      </div>
    );
  };

  const renderWorkspace = () => {
    const totalOrderAmount = activeQuote.cabinets.reduce((sum, cab) => sum + cab.sub_total, 0);

    return (
      <div className="flex h-screen bg-gray-100 overflow-hidden font-sans">
        
        {/* === 中间核心作业区 === */}
        <div className="flex-1 flex flex-col h-full bg-white z-10 shadow-xl overflow-y-auto relative border-r border-gray-200">
          
          {/* 顶部订单头信息 */}
          <div className="bg-gray-900 text-white p-6 sticky top-0 z-20 shadow-md">
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-xl font-black tracking-widest flex items-center gap-2"><LucideIcons.LayoutDashboard size={20}/> 报价工作台 V3.3</h1>
              <div className="flex items-center gap-4">
                <div className="text-sm font-mono bg-black/40 px-3 py-1 rounded-full text-emerald-400 border border-emerald-900/50">NO. {activeQuote.quote_no || '尚未生成'}</div>
                <div className="text-sm font-bold text-amber-400 border border-amber-400/30 px-2 py-1 rounded">{activeQuote.status}</div>
                {currentUser?.role === 'admin' && <button onClick={()=>setCurrentView('admin')} className="text-xs bg-white text-black px-3 py-1.5 rounded-md font-bold hover:bg-gray-200">后台管理</button>}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><label className="text-xs text-gray-400 mb-1 block uppercase">客户名称</label><input type="text" value={activeQuote.customer_name} onChange={e=>setActiveQuote({...activeQuote, customer_name:e.target.value})} className="w-full bg-gray-800 border-none p-2.5 rounded-lg text-sm text-white focus:ring-1 focus:ring-white outline-none" placeholder="必填"/></div>
              <div><label className="text-xs text-gray-400 mb-1 block uppercase">联系电话</label><input type="tel" maxLength="11" value={activeQuote.customer_phone} onChange={e=>setActiveQuote({...activeQuote, customer_phone:e.target.value})} className="w-full bg-gray-800 border-none p-2.5 rounded-lg text-sm text-white focus:ring-1 focus:ring-white outline-none" placeholder="11位大陆手机号"/></div>
              <div><label className="text-xs text-gray-400 mb-1 block uppercase">交付地址</label><input type="text" value={activeQuote.delivery_address} onChange={e=>setActiveQuote({...activeQuote, delivery_address:e.target.value})} className="w-full bg-gray-800 border-none p-2.5 rounded-lg text-sm text-white focus:ring-1 focus:ring-white outline-none" placeholder="安装送货地址"/></div>
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden">
             {/* 柜体列表侧边栏 */}
             <div className="w-64 bg-gray-50 border-r border-gray-200 p-4 flex flex-col gap-2 overflow-y-auto">
               <button onClick={addCabinet} className="w-full bg-white border-2 border-dashed border-gray-300 text-gray-600 p-3 rounded-xl font-bold hover:border-black hover:text-black transition-colors mb-4 flex items-center justify-center gap-2"><LucideIcons.Plus size={18}/> 新增柜体</button>
               {activeQuote.cabinets.map((cab, idx) => (
                 <div key={cab.id} className={`p-3 rounded-xl border cursor-pointer transition-all group relative ${activeCabinetId === cab.id ? 'bg-black text-white border-black shadow-lg' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'}`} onClick={()=>setActiveCabinetId(cab.id)}>
                    <div className="font-bold mb-1 flex items-center gap-2"><span className={`text-[10px] px-1.5 py-0.5 rounded ${activeCabinetId===cab.id?'bg-white/20':'bg-gray-100 text-gray-500'}`}>{idx+1}</span> {cab.name}</div>
                    <div className={`text-xs ${activeCabinetId===cab.id?'text-gray-300':'text-gray-400'}`}>{cab.width}W × {cab.height}H × {cab.depth}D</div>
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e)=>{e.stopPropagation(); copyCabinet(cab);}} className="p-1 bg-blue-500 text-white rounded hover:bg-blue-600" title="复制柜体"><LucideIcons.Copy size={12}/></button>
                      <button onClick={(e)=>{e.stopPropagation(); removeCabinet(cab.id);}} className="p-1 bg-rose-500 text-white rounded hover:bg-rose-600"><LucideIcons.Trash2 size={12}/></button>
                    </div>
                 </div>
               ))}
             </div>

             {/* 单柜编辑面板 */}
             <div className="flex-1 p-6 overflow-y-auto bg-gray-50/30">
               {activeCabinetId && (() => {
                 const cab = activeQuote.cabinets.find(c => c.id === activeCabinetId);
                 if (!cab) return null;
                 return (
                   <div className="max-w-3xl mx-auto space-y-6">
                      
                      {/* 卡片1：空间与尺寸 */}
                      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                        <h3 className="font-black text-gray-800 mb-4 flex items-center gap-2"><LucideIcons.Box size={20}/> 基础属性</h3>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                           <div><label className="text-xs font-bold text-gray-500 mb-1 block">所在空间</label><select value={cab.space} onChange={e=> {handleUpdateCabinet(cab.id, 'space', e.target.value); handleUpdateCabinet(cab.id, 'name', `${e.target.value}${cab.cabinet_type}`);}} className="w-full border-2 border-gray-100 p-2.5 rounded-lg focus:border-black bg-gray-50 focus:bg-white font-medium outline-none"><option>主卧</option><option>次卧</option><option>厨房</option><option>阳台</option><option>客厅</option><option>其他</option></select></div>
                           <div><label className="text-xs font-bold text-gray-500 mb-1 block">柜体类型</label><select value={cab.cabinet_type} onChange={e=> {handleUpdateCabinet(cab.id, 'cabinet_type', e.target.value); handleUpdateCabinet(cab.id, 'name', `${cab.space}${e.target.value}`);}} className="w-full border-2 border-gray-100 p-2.5 rounded-lg focus:border-black bg-gray-50 focus:bg-white font-medium outline-none"><option>衣柜</option><option>橱柜</option><option>电视柜</option><option>阳台柜</option><option>鞋柜</option></select></div>
                        </div>
                        <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl flex gap-3">
                           <div className="flex-1"><span className="text-[10px] text-blue-800 font-bold block mb-1">宽度 (W) mm</span><input type="number" value={cab.width} onChange={e=>handleUpdateCabinet(cab.id, 'width', e.target.value)} className="w-full border border-blue-200 p-2 rounded-lg font-black text-center"/></div>
                           <div className="flex-1"><span className="text-[10px] text-blue-800 font-bold block mb-1">高度 (H) mm</span><input type="number" value={cab.height} onChange={e=>handleUpdateCabinet(cab.id, 'height', e.target.value)} className="w-full border border-blue-200 p-2 rounded-lg font-black text-center"/></div>
                           <div className="flex-1"><span className="text-[10px] text-blue-800 font-bold block mb-1">深度 (D) mm</span><input type="number" value={cab.depth} onChange={e=>handleUpdateCabinet(cab.id, 'depth', e.target.value)} className="w-full border border-blue-200 p-2 rounded-lg font-black text-center"/></div>
                        </div>
                      </div>

                      {/* 卡片2：基础材质与溢价 */}
                      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
                        {/* 柜体选材 */}
                        <div className="border-b border-gray-100 pb-6">
                          <h3 className="font-black text-gray-800 mb-4 flex items-center gap-2"><LucideIcons.Layers size={20}/> 柜体配置</h3>
                          <div className="grid grid-cols-3 gap-3 mb-3">
                            <div className="col-span-2">
                              <label className="text-xs font-bold text-gray-500 mb-1 block">柜体系统材料</label>
                              <select value={cab.cabinet_mat_id} onChange={e=>handleUpdateCabinet(cab.id, 'cabinet_mat_id', e.target.value)} className="w-full border-2 border-gray-200 p-2.5 rounded-lg font-bold outline-none focus:border-black"><option value="">-- 请选择 --</option>{cabinetsData.map(c=><option key={c.id} value={c.id}>{c.name} (¥{c.base_price})</option>)}</select>
                            </div>
                            <div>
                              <label className="text-xs font-bold text-rose-500 mb-1 block">人工单价溢价(元/㎡)</label>
                              <input type="number" value={cab.cabinet_unit_adjustment} onChange={e=>handleUpdateCabinet(cab.id, 'cabinet_unit_adjustment', e.target.value)} className="w-full border-2 border-rose-200 bg-rose-50 p-2.5 rounded-lg font-bold outline-none text-rose-700"/>
                            </div>
                          </div>
                          <div className="grid grid-cols-4 gap-3">
                            <div><input type="text" placeholder="品牌(如:爱格)" value={cab.cabinet_brand} onChange={e=>handleUpdateCabinet(cab.id, 'cabinet_brand', e.target.value)} className="w-full border border-gray-200 p-2 rounded text-sm"/></div>
                            <div><input type="text" placeholder="颜色(如:U702)" value={cab.cabinet_color} onChange={e=>handleUpdateCabinet(cab.id, 'cabinet_color', e.target.value)} className="w-full border border-gray-200 p-2 rounded text-sm"/></div>
                            <div><input type="number" placeholder="厚度(如:18)" value={cab.cabinet_thickness} onChange={e=>handleUpdateCabinet(cab.id, 'cabinet_thickness', e.target.value)} className="w-full border border-gray-200 p-2 rounded text-sm"/></div>
                            <div><select value={cab.back_panel_spec} onChange={e=>handleUpdateCabinet(cab.id, 'back_panel_spec', e.target.value)} className="w-full border border-gray-200 p-2 rounded text-sm text-gray-600"><option>9mm标准背板</option><option>18mm厚背板</option></select></div>
                          </div>
                        </div>
                        
                        {/* 门板选材 */}
                        <div>
                          <div className="flex justify-between items-center mb-4">
                            <h3 className="font-black text-gray-800 flex items-center gap-2"><LucideIcons.DoorClosed size={20}/> 门板配置</h3>
                            <label className="flex items-center gap-2 text-sm font-bold text-gray-600 cursor-pointer"><input type="checkbox" checked={cab.no_door} onChange={e=>handleUpdateCabinet(cab.id, 'no_door', e.target.checked)} className="w-4 h-4 accent-black"/> 开放柜无门板</label>
                          </div>
                          {!cab.no_door && (
                            <>
                              <div className="grid grid-cols-3 gap-3 mb-3">
                                <div className="col-span-2">
                                  <label className="text-xs font-bold text-gray-500 mb-1 block">门板系统材料</label>
                                  <select value={cab.door_mat_id} onChange={e=>handleUpdateCabinet(cab.id, 'door_mat_id', e.target.value)} className="w-full border-2 border-gray-200 p-2.5 rounded-lg font-bold outline-none focus:border-black"><option value="">-- 请选择 --</option>{doorsData.map(d=><option key={d.id} value={d.id}>{d.name} (¥{d.base_price})</option>)}</select>
                                </div>
                                <div>
                                  <label className="text-xs font-bold text-rose-500 mb-1 block">人工单价溢价(元/㎡)</label>
                                  <input type="number" value={cab.door_unit_adjustment} onChange={e=>handleUpdateCabinet(cab.id, 'door_unit_adjustment', e.target.value)} className="w-full border-2 border-rose-200 bg-rose-50 p-2.5 rounded-lg font-bold outline-none text-rose-700"/>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div><input type="text" placeholder="门板指定品牌" value={cab.door_brand} onChange={e=>handleUpdateCabinet(cab.id, 'door_brand', e.target.value)} className="w-full border border-gray-200 p-2 rounded text-sm"/></div>
                                <div><input type="text" placeholder="门板指定颜色" value={cab.door_color} onChange={e=>handleUpdateCabinet(cab.id, 'door_color', e.target.value)} className="w-full border border-gray-200 p-2 rounded text-sm"/></div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* 卡片3：局部升级工艺 */}
                      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="font-black text-gray-800 flex items-center gap-2"><LucideIcons.Wrench size={20}/> 升级工艺与五金</h3>
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded font-bold">已挂载 {cab.upgrades.length} 项</span>
                        </div>
                        
                        {cab.upgrades.length > 0 && (
                          <div className="space-y-2 mb-4">
                            {cab.upgrades.map(u => (
                              <div key={u.id} className="flex justify-between items-center bg-gray-50 border border-gray-100 p-3 rounded-lg">
                                <div>
                                  <div className="font-bold text-sm text-gray-800">{u.snap_upgrade_name}</div>
                                  <div className="text-xs text-gray-500 mt-0.5">
                                    收费基数: {u.calculated_quantity} × (¥{u.snap_final_unit_price} {u.snap_upgrade_effect_type==='replace'?`-底价¥${u.snap_base_door_price}`:''})
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <span className="font-black text-gray-900 text-sm">¥{u.total_amount}</span>
                                  <button onClick={()=>removeUpgrade(cab.id, u.id)} className="text-gray-400 hover:text-rose-500"><LucideIcons.Trash2 size={16}/></button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 h-48 overflow-y-auto">
                          {['门板升级', '五金系统', '灯光系统', '木作工艺', '其他'].map(cat => {
                            const items = upgradesData.filter(u => u.upgrade_category === cat && u.status !== false);
                            if(items.length === 0) return null;
                            return (
                              <div key={cat} className="mb-3">
                                <div className="text-[10px] font-bold text-gray-400 mb-1">{cat}</div>
                                <div className="flex flex-wrap gap-2">
                                  {items.map(item => (
                                    <button key={item.id} onClick={()=>openUpgradeModal(item)} className="bg-white border border-gray-200 text-xs px-3 py-1.5 rounded shadow-sm hover:border-black font-medium text-gray-700">{item.name}</button>
                                  ))}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                   </div>
                 )
               })()}
               {!activeCabinetId && <div className="h-full flex flex-col items-center justify-center text-gray-400"><LucideIcons.MousePointerClick size={48} className="mb-4 opacity-30"/><p>请在左侧选择或新建一个柜体进行作业</p></div>}
             </div>
          </div>
        </div>

        {/* === 右侧核算区 === */}
        <div className="w-80 bg-white shadow-[-10px_0_30px_rgba(0,0,0,0.03)] z-20 flex flex-col border-l border-gray-200 relative">
          <div className="p-6 bg-gray-50 border-b border-gray-200 text-center">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">整单预计总计</h2>
            <div className="text-4xl font-black text-rose-600">¥{totalOrderAmount.toFixed(0)}</div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
             {activeQuote.cabinets.map((cab, idx) => (
                <div key={cab.id} className={`p-4 rounded-xl border ${activeCabinetId===cab.id ? 'border-black shadow-md bg-white' : 'border-gray-200 bg-gray-50/50'}`}>
                   <div className="flex justify-between items-center mb-2">
                     <span className="font-bold text-sm text-gray-900 truncate max-w-[140px]">{idx+1}. {cab.name}</span>
                     <span className="font-black text-gray-900">¥{cab.sub_total.toFixed(0)}</span>
                   </div>
                   <div className="text-xs space-y-1 text-gray-600">
                     <div className="flex justify-between"><span>柜体计价量:</span><span className="font-medium text-gray-900">{cab.calc_area.toFixed(2)} {cab.calc_mode==='按面积㎡'?'㎡':'m'}</span></div>
                     <div className="flex justify-between border-t border-gray-100 pt-1 mt-1"><span>柜体基础:</span><span>¥{cab.cabinet_total.toFixed(0)}</span></div>
                     <div className="flex justify-between"><span>门板基础:</span><span>¥{cab.door_total.toFixed(0)}</span></div>
                     <div className="flex justify-between"><span>局部升级({cab.upgrades.length}项):</span><span>¥{cab.upgrades_total.toFixed(0)}</span></div>
                   </div>
                </div>
             ))}
          </div>

          <div className="p-6 bg-white border-t border-gray-200">
             <button onClick={handleSaveQuoteDraft} disabled={isLoading || activeQuote.cabinets.length===0} className="w-full bg-black text-white py-4 rounded-xl font-bold text-lg hover:bg-gray-800 disabled:bg-gray-300 shadow-xl transition-all flex justify-center items-center gap-2">
               {isLoading ? <LucideIcons.Loader2 className="animate-spin"/> : <LucideIcons.Save size={20}/>} 
               {activeQuote.id ? '更新草稿' : '生成报价草稿'}
             </button>
          </div>
        </div>

        {renderUpgradeModal()}
      </div>
    );
  };

  const renderAdmin = () => {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
        <div className="bg-gray-900 text-white p-4 flex justify-between items-center shadow-md">
          <h1 className="text-lg font-black tracking-widest flex items-center gap-2"><LucideIcons.Settings size={20}/> NOEY ADMIN</h1>
          <button onClick={()=>setCurrentView('workspace')} className="text-sm bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg font-bold transition">返回工作台</button>
        </div>
        <div className="p-8">
           <h2 className="text-xl font-bold mb-6 text-gray-800 border-l-4 border-black pl-3">升级工艺配置 (字典展示)</h2>
           <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-100 text-gray-600 text-xs uppercase tracking-wider font-bold">
                  <tr>
                    <th className="p-4">工艺名称</th>
                    <th className="p-4">单位</th>
                    <th className="p-4">系统原价</th>
                    <th className="p-4 text-purple-800 bg-purple-50">保底数量 (Minimum Quantity)</th>
                    <th className="p-4 bg-blue-50 text-blue-800">价格影响逻辑 (Effect Type)</th>
                    <th className="p-4 bg-amber-50 text-amber-800">数量计算 (Calculation Type)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                   {upgradesData.map(u => {
                     // 增加异常数据校验预警
                     const isExcessDrawer = u.calculation_type === 'excess_drawer' || u.calculation_type === '超额抽屉规则';
                     const hasConfigWarning = isExcessDrawer && u.upgrade_effect_type !== 'add_cost';
                     
                     return (
                       <tr key={u.id} className="hover:bg-gray-50">
                         <td className="p-4 font-bold text-gray-900">{u.name}</td>
                         <td className="p-4 text-gray-500">{u.unit}</td>
                         <td className="p-4 font-black">¥{u.unit_price}</td>
                         <td className="p-4 font-medium text-purple-700 bg-purple-50/30">{u.minimum_quantity || 0}</td>
                         <td className="p-4 font-medium text-blue-700 bg-blue-50/30">
                           {u.upgrade_effect_type}
                           {hasConfigWarning && (
                             <div className="mt-1 text-[10px] bg-rose-100 text-rose-600 px-2 py-1 rounded border border-rose-200 font-bold block">
                               ⛔ 错误：超额抽屉必须使用 add_cost 价格影响逻辑
                             </div>
                           )}
                         </td>
                         <td className="p-4 font-medium text-amber-700 bg-amber-50/30">{u.calculation_type}</td>
                       </tr>
                     );
                   })}
                </tbody>
              </table>
           </div>
        </div>
      </div>
    );
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center font-sans">
        <div className="bg-white p-10 rounded-2xl shadow-2xl w-full max-w-md border border-gray-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-black"></div>
          <h1 className="text-3xl font-black text-center text-gray-900 tracking-wider mb-2 mt-4">NOEY<span className="font-light">SYSTEM</span></h1>
          <p className="text-center text-xs text-gray-500 mb-8 font-bold uppercase tracking-widest">多柜报价工作台 V3.3</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="text" required placeholder="账号 (admin)" value={loginForm.username} onChange={e=>setLoginForm({...loginForm, username: e.target.value})} className="w-full border-2 border-gray-100 p-4 rounded-xl focus:border-black font-medium outline-none" />
            <input type="password" required placeholder="密码 (admin123)" value={loginForm.password} onChange={e=>setLoginForm({...loginForm, password: e.target.value})} className="w-full border-2 border-gray-100 p-4 rounded-xl focus:border-black font-medium outline-none" />
            <button type="submit" disabled={isLoading} className="w-full bg-black text-white p-4 rounded-xl font-bold text-lg hover:bg-gray-800 shadow-xl transition-all mt-4">{isLoading ? '登录中...' : '进 入 工 作 台'}</button>
          </form>
        </div>
        {toast.show && (<div className="fixed top-6 bg-black text-white px-6 py-3 rounded-full shadow-2xl z-50 text-sm font-bold animate-fade-in">{toast.message}</div>)}
      </div>
    );
  }

  return (
    <>
      {currentView === 'workspace' && renderWorkspace()}
      {currentView === 'admin' && renderAdmin()}
      {toast.show && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
           <div className={`px-6 py-3 rounded-full shadow-2xl font-bold text-sm text-white ${toast.type==='error'?'bg-rose-600':'bg-emerald-600'}`}>{toast.message}</div>
        </div>
      )}
    </>
  );
}
