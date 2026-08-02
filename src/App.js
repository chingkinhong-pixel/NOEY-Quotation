import React, { useState, useEffect } from 'react';
import * as LucideIcons from 'lucide-react';

// --- MOCK DATA ---
// 模拟后台数据，以便在没有 Supabase 的环境中展示 UI 和测试逻辑
const MOCK_CABINETS = [
  { id: 'cab-1', name: '大亚多层板18mm', base_price: 600, shallow_price: 450, no_door_factor: 1.2 },
  { id: 'cab-2', name: '万华禾香板18mm', base_price: 700, shallow_price: 500, no_door_factor: 1.15 }
];

const MOCK_DOORS = [
  { id: 'door-1', name: 'PET高光板', base_price: 500, door_type: '普通门板' },
  { id: 'door-2', name: '爱格肤感门', base_price: 900, door_type: '特殊门板' }
];

const MOCK_UPGRADES = [
  { id: 'upg-1', name: '普通三节轨抽屉', upgrade_category: '五金系统', calculation_type: '超额抽屉规则', upgrade_effect_type: 'add_cost', unit: '个', unit_price: 120, status: true, description: '标配外超额收费' },
  { id: 'upg-2', name: '玻璃门(含铝框)', upgrade_category: '门板升级', calculation_type: '按面积㎡', upgrade_effect_type: 'replace', unit: '㎡', unit_price: 800, status: true, replace_calculation_mode: 'full_price' },
  { id: 'upg-3', name: '隐藏式灯带', upgrade_category: '灯光系统', calculation_type: '按柜宽自动算', upgrade_effect_type: 'add_cost', unit: '米', unit_price: 80, status: true },
  { id: 'upg-4', name: '18mm厚背板', upgrade_category: '木作工艺', calculation_type: '按面积㎡', upgrade_effect_type: 'difference', unit: '㎡', unit_price: 60, status: true }
];

const MOCK_RULES = {
  id: 'rule-1', standard_depth: 600, shallow_depth: 295, height_threshold: 1000, minimum_area: 1, minimum_width: 1000
};

const MOCK_USER = { id: 'admin-1', username: 'admin', name: '超级管理员', role: 'admin' };
// --- END MOCK DATA ---

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [currentView, setCurrentView] = useState('workspace'); // workspace, admin
  const [isLoading, setIsLoading] = useState(false);

  // 基础数据字典状态 (使用 Mock 数据初始化)
  const [cabinetsData, setCabinetsData] = useState(MOCK_CABINETS);
  const [doorsData, setDoorsData] = useState(MOCK_DOORS);
  const [upgradesData, setUpgradesData] = useState(MOCK_UPGRADES);
  const [rulesData, setRulesData] = useState(MOCK_RULES);

  // 报价单主表信息
  const [activeQuote, setActiveQuote] = useState({
    id: null, quote_no: '', customer_name: '', customer_phone: '', delivery_address: '', status: '编辑中', cabinets: []
  });
  const [activeCabinetId, setActiveCabinetId] = useState(null);

  // 升级项弹窗状态
  const [upgradeModal, setUpgradeModal] = useState({
    show: false, selectedItem: null, inputQty: '', manualDoorArea: '', unitPriceAdj: ''
  });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      if (loginForm.username === 'admin' && loginForm.password === 'admin123') {
        setCurrentUser(MOCK_USER);
        showToast(`欢迎, ${MOCK_USER.name}`);
      } else {
        showToast('账号或密码错误 (使用 admin/admin123)', 'error');
      }
      setIsLoading(false);
    }, 500);
  };

  const generateOrderNo = () => {
    const dateStr = new Date().toISOString().slice(2,10).replace(/-/g,'');
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `NYGN${dateStr}${randomStr}`;
  };

  // 核心计价引擎
  const calculateCabinetDetails = (cabinet) => {
    const w = parseFloat(cabinet.width) || 0;
    const h = parseFloat(cabinet.height) || 0;
    const d = parseFloat(cabinet.depth) || 0;
    
    const cabMat = cabinetsData.find(c => c.id === cabinet.cabinet_mat_id);
    const doorMat = doorsData.find(d => d.id === cabinet.door_mat_id);

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

    const defaultDoorArea = baseArea;

    const cabFinalPrice = cabMat ? (parseFloat(cabMat.base_price) + parseFloat(cabinet.cabinet_unit_adjustment || 0)) : 0;
    const cabShallowPrice = cabMat ? (parseFloat(cabMat.shallow_price) + parseFloat(cabinet.cabinet_unit_adjustment || 0)) : 0;
    const doorFinalPrice = doorMat ? (parseFloat(doorMat.base_price) + parseFloat(cabinet.door_unit_adjustment || 0)) : 0;

    let cabinetBaseTotal = 0;
    let doorBaseTotal = 0;

    if (cabMat) {
      if (cabinet.no_door) {
        const base = (d <= rulesData.shallow_depth) ? cabShallowPrice : cabFinalPrice;
        const depthRatio = (d > rulesData.standard_depth) ? (d / rulesData.standard_depth) : 1;
        cabinetBaseTotal = base * (cabMat.no_door_factor || 1) * depthRatio * baseArea;
      } else {
        const base = (d <= rulesData.shallow_depth) ? cabShallowPrice : cabFinalPrice;
        const depthRatio = (d > rulesData.standard_depth) ? (d / rulesData.standard_depth) : 1;
        cabinetBaseTotal = base * depthRatio * baseArea;
        doorBaseTotal = doorFinalPrice * defaultDoorArea;
      }
    }

    let upgradesTotal = 0;
    const calculatedUpgrades = (cabinet.upgrades || []).map(upg => {
      const itemData = upgradesData.find(u => u.id === upg.upgrade_item_id);
      if (!itemData) return upg;

      const finalUnitPrice = parseFloat(itemData.unit_price || 0) + parseFloat(upg.unit_price_adjustment || 0);
      let calculatedQty = 0;
      let lineTotal = 0;
      const inputQty = parseFloat(upg.input_quantity || 0);
      const minQty = parseFloat(itemData.minimum_quantity || 0);

      // --- 修正点：超额抽屉逻辑 ---
      if (itemData.calculation_type === '超额抽屉规则') {
        const standardQty = Math.max(1, Math.ceil(w / 1000));
        calculatedQty = Math.max(0, inputQty - standardQty);
        lineTotal = calculatedQty * finalUnitPrice;
      } else if (itemData.calculation_type === '按柜宽自动算') {
        calculatedQty = Math.max(w / 1000, minQty);
        lineTotal = calculatedQty * finalUnitPrice;
      } else if (itemData.calculation_type === '人工输入金额' || itemData.upgrade_effect_type === 'manual') {
        calculatedQty = 1;
        lineTotal = inputQty;
      } else {
        if (itemData.upgrade_effect_type === 'replace') {
           const areaToUse = parseFloat(upg.manual_door_area) > 0 ? parseFloat(upg.manual_door_area) : defaultDoorArea;
           calculatedQty = Math.max(areaToUse, minQty);
           const baseDoorPrice = doorMat ? parseFloat(doorMat.base_price) : 0;
           lineTotal = calculatedQty * (finalUnitPrice - baseDoorPrice);
        } else {
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
      calc_mode: calcMode, calc_area: baseArea,
      cabinet_total: cabinetBaseTotal, door_total: doorBaseTotal, upgrades_total: upgradesTotal,
      sub_total: cabinetBaseTotal + doorBaseTotal + upgradesTotal,
      snap_final_cabinet_price: cabFinalPrice, snap_final_door_price: doorFinalPrice
    };
  };

  const handleUpdateCabinet = (cabId, field, value) => {
    setActiveQuote(prev => {
      const updatedCabinets = prev.cabinets.map(cab => {
        if (cab.id === cabId) {
          const updatedCab = { ...cab, [field]: value };
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
      id: 'temp-' + Date.now(), space: '主卧', cabinet_type: '衣柜', name: '主卧衣柜',
      width: '', height: '', depth: '', cabinet_mat_id: '', door_mat_id: '', no_door: false, cabinet_thickness: 18,
      cabinet_brand: '', cabinet_color: '', cabinet_material_remark: '', door_brand: '', door_color: '', back_panel_spec: '9mm标准背板',
      cabinet_unit_adjustment: 0, door_unit_adjustment: 0, upgrades: [],
      calc_mode: '', calc_area: 0, cabinet_total: 0, door_total: 0, upgrades_total: 0, sub_total: 0
    };
    setActiveQuote(prev => ({ ...prev, cabinets: [...prev.cabinets, newCab] }));
    setActiveCabinetId(newCab.id);
  };

  const removeCabinet = (id) => {
    setActiveQuote(prev => ({ ...prev, cabinets: prev.cabinets.filter(c => c.id !== id) }));
    if (activeCabinetId === id) setActiveCabinetId(null);
  };

  const openUpgradeModal = (item) => {
    setUpgradeModal({ show: true, selectedItem: item, inputQty: '', manualDoorArea: '', unitPriceAdj: '' });
  };

  const confirmAddUpgrade = () => {
    const { selectedItem, inputQty, manualDoorArea, unitPriceAdj } = upgradeModal;
    const newUpgrade = {
      id: 'upg-' + Date.now(), upgrade_item_id: selectedItem.id,
      input_quantity: parseFloat(inputQty) || 0, manual_door_area: parseFloat(manualDoorArea) || 0,
      unit_price_adjustment: parseFloat(unitPriceAdj) || 0, remark: ''
    };
    setActiveQuote(prev => {
      const updatedCabinets = prev.cabinets.map(cab => {
        if (cab.id === activeCabinetId) {
          const updatedCab = { ...cab, upgrades: [...cab.upgrades, newUpgrade] };
          return calculateCabinetDetails(updatedCab);
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

  const renderUpgradeModal = () => {
    if (!upgradeModal.show || !upgradeModal.selectedItem) return null;
    const item = upgradeModal.selectedItem;
    const activeCab = activeQuote.cabinets.find(c => c.id === activeCabinetId);
    
    let drawerStd = 0; let drawerExc = 0; let drawerCost = 0;
    if (item.calculation_type === '超额抽屉规则' && activeCab) {
        drawerStd = Math.max(1, Math.ceil((parseFloat(activeCab.width) || 0) / 1000));
        drawerExc = Math.max(0, (parseFloat(upgradeModal.inputQty) || 0) - drawerStd);
        drawerCost = drawerExc * parseFloat(item.unit_price || 0);
    }

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
          <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
            <h3 className="font-bold text-lg text-gray-800">工艺配置：{item.name}</h3>
            <button onClick={() => setUpgradeModal({...upgradeModal, show:false})} className="text-gray-400 hover:text-black"><LucideIcons.X size={20}/></button>
          </div>
          <div className="p-6 space-y-6">
            
            {item.calculation_type === '超额抽屉规则' ? (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">请输入实际需求抽屉数量 (个)</label>
                <input type="number" min="0" value={upgradeModal.inputQty} onChange={e=>setUpgradeModal({...upgradeModal, inputQty:e.target.value})} className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-blue-500 font-black text-xl text-center" />
                <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-900 space-y-2">
                   <div className="flex justify-between"><span>柜体宽度:</span><span className="font-bold">{activeCab?.width || 0} mm</span></div>
                   <div className="flex justify-between"><span>系统标配赠送:</span><span className="font-bold">{drawerStd} 个</span></div>
                   <div className="flex justify-between"><span>客户实际需求:</span><span className="font-bold">{upgradeModal.inputQty || 0} 个</span></div>
                   <div className="flex justify-between border-t border-blue-200 pt-2 mt-2"><span className="font-bold text-rose-600">超额计费数量:</span><span className="font-black text-rose-600">{drawerExc} 个</span></div>
                   <div className="flex justify-between text-xs text-gray-500"><span>单价: ¥{item.unit_price}/个</span><span>最终追加费用: <strong>¥{drawerCost}</strong></span></div>
                </div>
              </div>
            ) : item.calculation_type === '按柜宽自动算' ? (
              <div className="bg-gray-100 p-4 rounded-xl text-center text-gray-500 text-sm font-bold">系统已自动抓取柜宽: {activeCab?.width || 0} mm 参与计算</div>
            ) : (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">输入{item.calculation_type === '人工输入金额' ? '总金额' : '数量'}</label>
                <input type="number" value={upgradeModal.inputQty} onChange={e=>setUpgradeModal({...upgradeModal, inputQty:e.target.value})} className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-black font-black text-lg" placeholder={`必填 (${item.unit})`} />
              </div>
            )}

            {item.upgrade_effect_type === 'replace' && (
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                <label className="block text-xs font-bold text-amber-800 mb-2">人工修正门板面积 (㎡/选填)</label>
                <input type="number" value={upgradeModal.manualDoorArea} onChange={e=>setUpgradeModal({...upgradeModal, manualDoorArea:e.target.value})} className="w-full border border-amber-200 p-2 rounded-lg bg-white" placeholder="如门板与投影面积不符请填写" />
              </div>
            )}

            {item.calculation_type !== '超额抽屉规则' && item.calculation_type !== '人工输入金额' && (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex justify-between">
                  <span>人工单价调整</span> <span className="text-xs text-gray-400 font-normal">系统原价: ¥{item.unit_price}</span>
                </label>
                <input type="number" placeholder="加收正数，减免负数" value={upgradeModal.unitPriceAdj} onChange={e=>setUpgradeModal({...upgradeModal, unitPriceAdj:e.target.value})} className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-black font-medium text-gray-600" />
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
        <div className="flex-1 flex flex-col h-full bg-white z-10 shadow-xl overflow-y-auto relative border-r border-gray-200">
          
          <div className="bg-gray-900 text-white p-6 sticky top-0 z-20 shadow-md">
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-xl font-black tracking-widest flex items-center gap-2"><LucideIcons.LayoutDashboard size={20}/> 报价工作台 V3.3 (Mock)</h1>
              <div className="flex items-center gap-4">
                <div className="text-sm font-bold text-amber-400 border border-amber-400/30 px-2 py-1 rounded">{activeQuote.status}</div>
                <button onClick={()=>setCurrentView('admin')} className="text-xs bg-white text-black px-3 py-1.5 rounded-md font-bold hover:bg-gray-200">后台管理</button>
              </div>
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden">
             <div className="w-64 bg-gray-50 border-r border-gray-200 p-4 flex flex-col gap-2 overflow-y-auto">
               <button onClick={addCabinet} className="w-full bg-white border-2 border-dashed border-gray-300 text-gray-600 p-3 rounded-xl font-bold hover:border-black hover:text-black mb-4 flex items-center justify-center gap-2"><LucideIcons.Plus size={18}/> 新增柜体</button>
               {activeQuote.cabinets.map((cab, idx) => (
                 <div key={cab.id} className={`p-3 rounded-xl border cursor-pointer transition-all group relative ${activeCabinetId === cab.id ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'}`} onClick={()=>setActiveCabinetId(cab.id)}>
                    <div className="font-bold mb-1"><span className={`text-[10px] px-1.5 py-0.5 rounded ${activeCabinetId===cab.id?'bg-white/20':'bg-gray-100'}`}>{idx+1}</span> {cab.name}</div>
                    <div className={`text-xs ${activeCabinetId===cab.id?'text-gray-300':'text-gray-400'}`}>{cab.width}W × {cab.height}H × {cab.depth}D</div>
                 </div>
               ))}
             </div>

             <div className="flex-1 p-6 overflow-y-auto bg-gray-50/30">
               {activeCabinetId && (() => {
                 const cab = activeQuote.cabinets.find(c => c.id === activeCabinetId);
                 if (!cab) return null;
                 return (
                   <div className="max-w-3xl mx-auto space-y-6">
                      
                      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                        <h3 className="font-black text-gray-800 mb-4 flex items-center gap-2"><LucideIcons.Box size={20}/> 基础属性</h3>
                        <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl flex gap-3">
                           <div className="flex-1"><span className="text-[10px] text-blue-800 font-bold block mb-1">宽度(W)</span><input type="number" value={cab.width} onChange={e=>handleUpdateCabinet(cab.id, 'width', e.target.value)} className="w-full border border-blue-200 p-2 rounded-lg text-center"/></div>
                           <div className="flex-1"><span className="text-[10px] text-blue-800 font-bold block mb-1">高度(H)</span><input type="number" value={cab.height} onChange={e=>handleUpdateCabinet(cab.id, 'height', e.target.value)} className="w-full border border-blue-200 p-2 rounded-lg text-center"/></div>
                           <div className="flex-1"><span className="text-[10px] text-blue-800 font-bold block mb-1">深度(D)</span><input type="number" value={cab.depth} onChange={e=>handleUpdateCabinet(cab.id, 'depth', e.target.value)} className="w-full border border-blue-200 p-2 rounded-lg text-center"/></div>
                        </div>
                      </div>

                      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                        <h3 className="font-black text-gray-800 mb-4 flex items-center gap-2"><LucideIcons.Layers size={20}/> 选材配置</h3>
                        <div className="grid grid-cols-2 gap-4">
                           <div><label className="text-xs font-bold text-gray-500 mb-1 block">柜体材料</label><select value={cab.cabinet_mat_id} onChange={e=>handleUpdateCabinet(cab.id, 'cabinet_mat_id', e.target.value)} className="w-full border-2 border-gray-200 p-2 rounded-lg font-bold"><option value="">-- 请选择 --</option>{cabinetsData.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                           <div><label className="text-xs font-bold text-gray-500 mb-1 block">门板材料</label><select value={cab.door_mat_id} onChange={e=>handleUpdateCabinet(cab.id, 'door_mat_id', e.target.value)} className="w-full border-2 border-gray-200 p-2 rounded-lg font-bold"><option value="">-- 请选择 --</option>{doorsData.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                        </div>
                      </div>

                      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="font-black text-gray-800 flex items-center gap-2"><LucideIcons.Wrench size={20}/> 升级工艺</h3>
                        </div>
                        {cab.upgrades.length > 0 && (
                          <div className="space-y-2 mb-4">
                            {cab.upgrades.map(u => (
                              <div key={u.id} className="flex justify-between items-center bg-gray-50 border border-gray-100 p-3 rounded-lg">
                                <div>
                                  <div className="font-bold text-sm text-gray-800">{u.snap_upgrade_name}</div>
                                  <div className="text-xs text-gray-500">数量: {u.calculated_quantity} (总价: ¥{u.total_amount})</div>
                                </div>
                                <button onClick={()=>removeUpgrade(cab.id, u.id)} className="text-gray-400 hover:text-rose-500"><LucideIcons.Trash2 size={16}/></button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                           {upgradesData.map(item => (
                             <button key={item.id} onClick={()=>openUpgradeModal(item)} className="bg-white border border-gray-200 text-xs px-3 py-1.5 rounded shadow-sm hover:border-black font-medium">{item.name}</button>
                           ))}
                        </div>
                      </div>
                   </div>
                 )
               })()}
             </div>
          </div>
        </div>

        <div className="w-80 bg-white shadow-[-10px_0_30px_rgba(0,0,0,0.03)] z-20 flex flex-col border-l border-gray-200">
          <div className="p-6 bg-gray-50 border-b border-gray-200 text-center">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">整单预计总计</h2>
            <div className="text-4xl font-black text-rose-600">¥{totalOrderAmount.toFixed(0)}</div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
             {activeQuote.cabinets.map((cab, idx) => (
                <div key={cab.id} className="p-4 rounded-xl border border-gray-200 bg-gray-50/50">
                   <div className="flex justify-between items-center mb-2">
                     <span className="font-bold text-sm text-gray-900">{cab.name}</span>
                     <span className="font-black text-gray-900">¥{cab.sub_total.toFixed(0)}</span>
                   </div>
                </div>
             ))}
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
          <h1 className="text-lg font-black tracking-widest flex items-center gap-2"><LucideIcons.Settings size={20}/> NOEY ADMIN (Mock)</h1>
          <button onClick={()=>setCurrentView('workspace')} className="text-sm bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg font-bold transition">返回工作台</button>
        </div>
        <div className="p-8">
           <h2 className="text-xl font-bold mb-6 text-gray-800">工艺配置列表</h2>
           <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-100 text-gray-600 text-xs uppercase font-bold">
                  <tr><th className="p-4">名称</th><th className="p-4 bg-blue-50 text-blue-800">影响逻辑(Effect)</th><th className="p-4 bg-amber-50 text-amber-800">计算方式(Calc)</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                   {upgradesData.map(u => (
                     <tr key={u.id} className="hover:bg-gray-50">
                       <td className="p-4 font-bold text-gray-900">{u.name}</td>
                       <td className="p-4 font-medium text-blue-700 bg-blue-50/30">{u.upgrade_effect_type}</td>
                       <td className="p-4 font-medium text-amber-700 bg-amber-50/30">{u.calculation_type}</td>
                     </tr>
                   ))}
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
        <div className="bg-white p-10 rounded-2xl shadow-2xl w-full max-w-md border border-gray-100">
          <h1 className="text-3xl font-black text-center text-gray-900 tracking-wider mb-2">NOEY<span className="font-light">SYSTEM</span></h1>
          <p className="text-center text-xs text-gray-500 mb-8 font-bold">Mock 预览版</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="text" placeholder="admin" value={loginForm.username} onChange={e=>setLoginForm({...loginForm, username: e.target.value})} className="w-full border-2 border-gray-100 p-4 rounded-xl focus:border-black font-medium" />
            <input type="password" placeholder="admin123" value={loginForm.password} onChange={e=>setLoginForm({...loginForm, password: e.target.value})} className="w-full border-2 border-gray-100 p-4 rounded-xl focus:border-black font-medium" />
            <button type="submit" disabled={isLoading} className="w-full bg-black text-white p-4 rounded-xl font-bold hover:bg-gray-800 shadow-xl">{isLoading ? '登录中...' : '登录'}</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <>
      {currentView === 'workspace' && renderWorkspace()}
      {currentView === 'admin' && renderAdmin()}
      {toast.show && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50">
           <div className={`px-6 py-3 rounded-full shadow-2xl font-bold text-sm text-white ${toast.type==='error'?'bg-rose-600':'bg-emerald-600'}`}>{toast.message}</div>
        </div>
      )}
    </>
  );
}
