import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const rawSupabaseUrl = 'https://muwzdigtehcperweliyg.supabase.co/rest/v1/'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11d3pkaWd0ZWhjcGVyd2VsaXlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzODY1NjAsImV4cCI6MjEwMDk2MjU2MH0.mFbz8x2I11dfv1BL26Zv-O7vbH8JMd8FmKc2H52PRsw';
const supabaseUrl = rawSupabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabase = createClient(supabaseUrl, supabaseKey);

export default function App() {
  // 1. 全局状态
  const [currentView, setCurrentView] = useState('home'); // home, admin-login, admin, sales
  const [currentUser, setCurrentUser] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [isLoading, setIsLoading] = useState(false);

  // 2. 基础数据字典状态
  const [cabinets, setCabinets] = useState([]);
  const [doors, setDoors] = useState([]);
  const [upgrades, setUpgrades] = useState([]);
  const [rules, setRules] = useState({ 
    id: null, standard_depth: 600, shallow_depth: 295, height_threshold: 1000, minimum_area: 1, minimum_width: 1000 
  });

  // 3. 后台管理台专属状态
  const [adminView, setAdminView] = useState('upgrade'); 
  const [editId, setEditId] = useState(null); 
  const [adminLoginForm, setAdminLoginForm] = useState({ username: '', password: '' });
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, table: '', id: null, name: '' });
  const [cabinetForm, setCabinetForm] = useState({ name: '', base_price: '', shallow_price: '', no_door_factor: '' });
  const [doorForm, setDoorForm] = useState({ name: '', door_type: '普通门板', base_price: '' });
  const [upgradeForm, setUpgradeForm] = useState({
    name: '', upgrade_category: '门板升级', calculation_type: '按面积㎡', 
    upgrade_effect_type: 'add_cost', replace_calculation_mode: 'full_price',
    unit: '㎡', unit_price: '', sort_order: 0, status: true,
    description: '', image_url: '', is_standard_item: false, allow_manual_edit: true,
    combo_type: 'single', upgrade_material: '', upgrade_style: '', upgrade_specification: '',
    minimum_quantity: 0, combo_children: []
  });

  // 4. 销售工作台专属状态
  const [quoteInfo, setQuoteInfo] = useState({ 
    quoteNo: '', customerName: '', customerPhone: '', deliveryAddress: '', status: '编辑中' 
  });
  const [quoteCabinets, setQuoteCabinets] = useState([]);
  const [activeCabinetId, setActiveCabinetId] = useState(null);
  const [upgradeModal, setUpgradeModal] = useState({
    isOpen: false, activeCategory: '门板升级', selectedItem: null, inputQty: '', inputRemark: '',
    unit_price_adjustment: 0, manual_door_area: ''
  });

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

  const handleAdminLogin = async (e) => {
    e.preventDefault(); setIsLoading(true);
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

  const triggerDelete = (table, id, name) => {
    if (currentUser?.role !== 'admin') {
      showToast('权限不足：仅超级管理员可执行物理删除', 'error'); return;
    }
    setDeleteConfirm({ show: true, table, id, name });
  };

  const executeDelete = async () => {
    const { table, id } = deleteConfirm;
    try {
      setIsLoading(true);
      let checkTable = ''; let checkColumn = '';
      if (table === 'materials_cabinet') { checkTable = 'quote_cabinets'; checkColumn = 'cabinet_mat_id'; }
      else if (table === 'materials_door') { checkTable = 'quote_cabinets'; checkColumn = 'door_mat_id'; }
      else if (table === 'upgrade_items') { checkTable = 'quote_upgrades'; checkColumn = 'upgrade_item_id'; }

      if (checkTable && checkColumn) {
        const { data: refData, error: refError } = await supabase.from(checkTable).select('id').eq(checkColumn, id).limit(1);
        if (refError && refError.code !== '42P01') throw refError;
        if (refData && refData.length > 0) {
          throw new Error('此数据已被历史报价冻结关联，禁止物理删除！请使用“停用”功能。');
        }
      }
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      showToast('✅ 物理删除成功');
      setDeleteConfirm({ show: false, table: '', id: null, name: '' });
      fetchDictionaries(); 
    } catch (err) {
      showToast('删除中止: ' + err.message, 'error');
      setDeleteConfirm({ show: false, table: '', id: null, name: '' });
    } finally { setIsLoading(false); }
  };

  const handleSaveCabinet = async (e) => {
    e.preventDefault();
    try {
      const payload = { name: cabinetForm.name, base_price: parseFloat(cabinetForm.base_price), shallow_price: parseFloat(cabinetForm.shallow_price), no_door_factor: parseFloat(cabinetForm.no_door_factor) };
      if (editId) { await supabase.from('materials_cabinet').update(payload).eq('id', editId); showToast('修改成功'); } 
      else { await supabase.from('materials_cabinet').insert([payload]); showToast('新增成功'); }
      setCabinetForm({ name: '', base_price: '', shallow_price: '', no_door_factor: '' }); setEditId(null); fetchDictionaries();
    } catch (err) { showToast('保存失败', 'error'); }
  };

  const handleSaveDoor = async (e) => {
    e.preventDefault();
    try {
      const payload = { name: doorForm.name, door_type: doorForm.door_type, base_price: parseFloat(doorForm.base_price) || 0 };
      if (editId) { await supabase.from('materials_door').update(payload).eq('id', editId); showToast('修改成功'); } 
      else { await supabase.from('materials_door').insert([payload]); showToast('新增成功'); }
      setDoorForm({ name: '', door_type: '普通门板', base_price: '' }); setEditId(null); fetchDictionaries();
    } catch (err) { showToast('保存失败', 'error'); }
  };

  const handleSaveUpgrade = async (e) => {
    e.preventDefault();
    try {
      const payload = { 
        name: upgradeForm.name, upgrade_category: upgradeForm.upgrade_category, 
        calculation_type: upgradeForm.calculation_type, upgrade_effect_type: upgradeForm.upgrade_effect_type,
        replace_calculation_mode: upgradeForm.upgrade_effect_type === 'replace' ? upgradeForm.replace_calculation_mode : null,
        unit: upgradeForm.unit, unit_price: parseFloat(upgradeForm.unit_price) || 0, 
        sort_order: parseInt(upgradeForm.sort_order) || 0, status: upgradeForm.status,
        description: upgradeForm.description, is_standard_item: upgradeForm.is_standard_item, 
        allow_manual_edit: upgradeForm.allow_manual_edit,
        combo_type: upgradeForm.combo_type, upgrade_material: upgradeForm.upgrade_material,
        upgrade_style: upgradeForm.upgrade_style, upgrade_specification: upgradeForm.upgrade_specification,
        minimum_quantity: parseFloat(upgradeForm.minimum_quantity) || 0, combo_children: upgradeForm.combo_children
      };
      if (editId) { await supabase.from('upgrade_items').update(payload).eq('id', editId); showToast('修改成功'); } 
      else { await supabase.from('upgrade_items').insert([payload]); showToast('新增成功'); }
      setUpgradeForm({ name: '', upgrade_category: '门板升级', calculation_type: '按面积㎡', upgrade_effect_type: 'add_cost', replace_calculation_mode: 'full_price', unit: '㎡', unit_price: '', sort_order: 0, status: true, description: '', image_url: '', is_standard_item: false, allow_manual_edit: true, combo_type: 'single', upgrade_material: '', upgrade_style: '', upgrade_specification: '', minimum_quantity: 0, combo_children: [] });
      setEditId(null); fetchDictionaries();
    } catch (err) { showToast('保存失败', 'error'); }
  };

  const handleSaveRules = async (e) => {
    e.preventDefault();
    try {
      if (rules.id) { await supabase.from('pricing_rules').update(rules).eq('id', rules.id); showToast('规则更新成功！'); fetchDictionaries(); }
    } catch (err) { showToast('保存失败', 'error'); }
  };

  const handleToggleUpgradeStatus = async (item) => {
    try {
      await supabase.from('upgrade_items').update({ status: !item.status }).eq('id', item.id);
      showToast(item.status ? '已停用' : '已重新上架'); fetchDictionaries();
    } catch (err) { showToast('操作失败', 'error'); }
  };

  const enterSalesWorkspace = () => {
    setQuoteInfo({ quoteNo: generateQuoteNo(), customerName: '', customerPhone: '', deliveryAddress: '', status: '编辑中' });
    const initCabId = 'cab-' + Date.now();
    setQuoteCabinets([{ 
      id: initCabId, space: '主卧', cabinetType: '衣柜', width: '', height: '', depth: '',
      cabinet_mat_id: '', snap_cabinet_brand: '', snap_cabinet_color: '', cabinet_thickness: '18', cabinet_material_remark: '', snap_back_panel_spec: '9mm标准', cabinet_unit_adjustment: '',
      door_mat_id: '', snap_door_brand: '', snap_door_color: '', door_unit_adjustment: '', upgrades: []
    }]);
    setActiveCabinetId(initCabId);
    setCurrentView('sales');
  };

  const activeCabinet = quoteCabinets.find(c => c.id === activeCabinetId) || quoteCabinets[0];
  const updateActiveCabinet = (field, value) => { setQuoteCabinets(prev => prev.map(c => c.id === activeCabinetId ? { ...c, [field]: value } : c)); };

  const handleAddCabinet = () => {
    const newId = 'cab-' + Date.now();
    setQuoteCabinets([...quoteCabinets, { 
      id: newId, space: '次卧', cabinetType: '衣柜', width: '', height: '', depth: '',
      cabinet_mat_id: '', snap_cabinet_brand: '', snap_cabinet_color: '', cabinet_thickness: '18', cabinet_material_remark: '', snap_back_panel_spec: '9mm标准', cabinet_unit_adjustment: '',
      door_mat_id: '', snap_door_brand: '', snap_door_color: '', door_unit_adjustment: '', upgrades: []
    }]);
    setActiveCabinetId(newId);
  };

  const handleCopyCabinet = (e, cab) => {
    e.stopPropagation();
    const newId = 'cab-' + Date.now() + Math.floor(Math.random()*1000);
    const newCab = { ...cab, id: newId, space: cab.space + ' (副本)', upgrades: [...(cab.upgrades || [])] };
    setQuoteCabinets([...quoteCabinets, newCab]);
    setActiveCabinetId(newId);
    showToast('柜体已复制');
  };

  const handleDeleteCabinet = (e, id) => {
    e.stopPropagation();
    if (quoteCabinets.length <= 1) { showToast('至少需要保留一个柜体', 'error'); return; }
    const newList = quoteCabinets.filter(c => c.id !== id);
    setQuoteCabinets(newList);
    if (activeCabinetId === id) setActiveCabinetId(newList[0].id);
  };

  // ==========================================
  // 【核心引擎代码：未做任何修改】
  // ==========================================
  const calculateCabinetDetails = (cab) => {
    let result = {
      qty: 0, calcMethod: '未计算', cabinetPortionTotal: 0, doorPortionTotal: 0, 
      upgradePortionTotal: 0, baseTotal: 0, finalCabUnitPrice: 0, finalDoorUnitPrice: 0, calculatedUpgrades: []
    };
    let w = parseFloat(cab.width) || 0;
    let h = parseFloat(cab.height) || 0;
    let d = parseFloat(cab.depth) || 0;
    if (!w || !h || !d) return result; 

    // 1. 计算规则判定
    let area = Math.max((w * h) / 1000000, rules.minimum_area || 1);
    let meter = Math.max(w / 1000, (rules.minimum_width || 1000) / 1000);
    let isArea = h > (rules.height_threshold || 1000);
    result.qty = isArea ? area : meter;
    result.calcMethod = isArea ? `投影面积 (${result.qty.toFixed(2)}㎡)` : `延米 (${result.qty.toFixed(2)}m)`;

    // 2. 基础单价与人工调价
    let cabMat = cabinets.find(m => m.id === cab.cabinet_mat_id);
    let doorMat = doors.find(m => m.id === cab.door_mat_id);
    let systemBaseDoorPrice = doorMat ? parseFloat(doorMat.base_price) || 0 : 0; 
    let baseCabPrice = cabMat ? parseFloat(cabMat.base_price) || 0 : 0;
    let shallowCabPrice = cabMat ? parseFloat(cabMat.shallow_price) || 0 : 0;
    let noDoorFactor = cabMat ? parseFloat(cabMat.no_door_factor) || 1 : 1;
    
    result.finalCabUnitPrice = baseCabPrice + (parseFloat(cab.cabinet_unit_adjustment) || 0);
    let finalShallowUnitPrice = shallowCabPrice + (parseFloat(cab.cabinet_unit_adjustment) || 0);
    result.finalDoorUnitPrice = systemBaseDoorPrice + (parseFloat(cab.door_unit_adjustment) || 0);

    // 3. 深度逻辑算法
    let hasDoor = doorMat && doorMat.door_type !== '无门板';
    let stdDepth = rules.standard_depth || 600;
    let shallowDepth = rules.shallow_depth || 295;
    let unitCabCost = 0;
    let unitDoorCost = hasDoor ? result.finalDoorUnitPrice : 0;

    if (!hasDoor) {
      if (d <= shallowDepth) unitCabCost = finalShallowUnitPrice * noDoorFactor;
      else if (d <= stdDepth) unitCabCost = result.finalCabUnitPrice * noDoorFactor;
      else unitCabCost = (result.finalCabUnitPrice * noDoorFactor) * (d / stdDepth);
    } else {
      if (d <= shallowDepth) unitCabCost = finalShallowUnitPrice;
      else if (d <= stdDepth) unitCabCost = result.finalCabUnitPrice;
      else unitCabCost = result.finalCabUnitPrice * (d / stdDepth);
    }

    result.cabinetPortionTotal = unitCabCost * result.qty;
    result.doorPortionTotal = unitDoorCost * result.qty;

    // 4. 升级工艺引擎
    let upgradesTotal = 0;
    result.calculatedUpgrades = (cab.upgrades || []).map(upg => {
      let inputQty = parseFloat(upg.input_quantity) || 0;
      let calcQty = inputQty;
      
      let snapOriginalPrice = parseFloat(upg.snap_original_unit_price) || 0;
      let priceAdj = parseFloat(upg.unit_price_adjustment) || 0;
      let snapFinalPrice = snapOriginalPrice + priceAdj;
      let minQty = parseFloat(upg.minimum_quantity) || 0;
      
      if (upg.calculation_type === '按柜宽自动算') {
        calcQty = w / 1000; 
        inputQty = calcQty;
      } else if (upg.calculation_type === '超额抽屉规则' || upg.calculation_type === 'excess_drawer') {
        let standard = Math.max(1, Math.round(w / 1000));
        calcQty = Math.max(0, inputQty - standard);
      } else if (upg.upgrade_effect_type === 'replace') {
        let baseArea = (upg.manual_door_area !== '' && upg.manual_door_area !== null && !isNaN(parseFloat(upg.manual_door_area))) 
          ? parseFloat(upg.manual_door_area) 
          : (w * h / 1000000);
        calcQty = Math.max(baseArea, minQty);
      } else if (upg.calculation_type !== '人工直接输金额') {
        calcQty = Math.max(inputQty, minQty);
      }

      let finalAmount = 0;
      
      if (upg.calculation_type === '人工直接输金额' || upg.upgrade_effect_type === 'manual') {
        finalAmount = inputQty; // Amount is directly inputted
        calcQty = 1;
      } else if (upg.upgrade_effect_type === 'replace' && upg.replace_calculation_mode === 'full_price') {
        // V3.3 修正：(升级终价 - 原底价) * 计算后的数量
        finalAmount = calcQty * (snapFinalPrice - systemBaseDoorPrice);
      } else {
        finalAmount = calcQty * snapFinalPrice;
      }
      
      upgradesTotal += finalAmount;
      return { 
        ...upg, 
        calculatedQty: calcQty, 
        finalAmount, 
        snap_base_door_price: systemBaseDoorPrice,
        snap_final_unit_price: snapFinalPrice
      };
    });

    result.upgradePortionTotal = upgradesTotal;
    result.baseTotal = result.cabinetPortionTotal + result.doorPortionTotal + result.upgradePortionTotal;
    return result;
  };
  // ==========================================
  // 【核心引擎代码结束】
  // ==========================================


  const handleConfirmAddUpgrade = () => {
    const item = upgradeModal.selectedItem;
    if (!item) return;
    if (item.calculation_type !== '按柜宽自动算' && !upgradeModal.inputQty) {
      showToast('请输入数量或金额', 'error'); return;
    }
    const newUpgrade = {
      id: 'upg-' + Date.now(), item_id: item.id, name: item.name, category: item.upgrade_category,
      unit: item.unit, 
      snap_original_unit_price: item.unit_price, 
      unit_price_adjustment: parseFloat(upgradeModal.unit_price_adjustment) || 0,
      calculation_type: item.calculation_type,
      upgrade_effect_type: item.upgrade_effect_type, replace_calculation_mode: item.replace_calculation_mode,
      input_quantity: parseFloat(upgradeModal.inputQty) || 0,
      minimum_quantity: item.minimum_quantity,
      manual_door_area: upgradeModal.manual_door_area,
      remark: upgradeModal.inputRemark || '',
      combo_type: item.combo_type,
      snap_material: item.upgrade_material, snap_style: item.upgrade_style, snap_specification: item.upgrade_specification,
      parent_record_id: null
    };
    updateActiveCabinet('upgrades', [...(activeCabinet.upgrades || []), newUpgrade]);
    setUpgradeModal({ ...upgradeModal, isOpen: false, selectedItem: null, inputQty: '', inputRemark: '', unit_price_adjustment: 0, manual_door_area: '' });
    showToast(`已添加工艺: ${item.name}`);
  };

  const handleRemoveUpgrade = (upgId) => {
    updateActiveCabinet('upgrades', (activeCabinet.upgrades || []).filter(u => u.id !== upgId));
  };

  // ==========================================
  // V4.0 Phase 1: 保存逻辑增强 (已更新)
  // ==========================================
  const handleSaveDraft = async () => {
    if (!quoteInfo.customerName) { showToast('请填写客户姓名', 'error'); return; }
    if (!isValidPhone(quoteInfo.customerPhone)) { showToast('手机号码格式不正确', 'error'); return; }
    setIsLoading(true);
    try {
      // 1. 【新增逻辑】利用核心计算引擎计算整单全案总价 grandTotal
      const grandTotal = quoteCabinets.reduce((sum, cab) => sum + calculateCabinetDetails(cab).baseTotal, 0);

      // 2. 保存主表 quotes 并下入 total_amount
      const { data: quoteData, error: quoteErr } = await supabase.from('quotes').upsert([{
        quote_no: quoteInfo.quoteNo, customer_name: quoteInfo.customerName,
        customer_phone: quoteInfo.customerPhone, delivery_address: quoteInfo.deliveryAddress,
        status: quoteInfo.status === '编辑中' ? '已保存草稿' : quoteInfo.status,
        total_amount: grandTotal // 【新增】保存整单总价落库
      }], { onConflict: 'quote_no' }).select().single();
      if (quoteErr) throw quoteErr;

      // 3. 清理旧柜体和工艺明细
      await supabase.from('quote_cabinets').delete().eq('quote_id', quoteData.id);
      await supabase.from('quote_upgrades').delete().eq('quote_id', quoteData.id);

      // 4. 循环保存最新柜体和工艺
      for (const cab of quoteCabinets) {
        // 利用引擎获得当前柜子的各项最终计算结果
        const calcs = calculateCabinetDetails(cab);
        
        // 保存柜体明细
        const { data: insertedCab, error: cabErr2 } = await supabase.from('quote_cabinets').insert([{
          quote_id: quoteData.id, name: `${cab.space}｜${cab.cabinetType}`, 
          width: parseFloat(cab.width) || 0, height: parseFloat(cab.height) || 0, depth: parseFloat(cab.depth) || 0,
          cabinet_mat_id: cab.cabinet_mat_id || null, door_mat_id: cab.door_mat_id || null,
          cabinet_thickness: parseFloat(cab.cabinet_thickness) || null,
          snap_cabinet_brand: cab.snap_cabinet_brand || '', snap_cabinet_color: cab.snap_cabinet_color || '',
          snap_door_brand: cab.snap_door_brand || '', snap_door_color: cab.snap_door_color || '',
          snap_back_panel_spec: cab.snap_back_panel_spec || '',
          cabinet_unit_adjustment: parseFloat(cab.cabinet_unit_adjustment) || 0,
          door_unit_adjustment: parseFloat(cab.door_unit_adjustment) || 0,
          snap_final_cabinet_price: calcs.finalCabUnitPrice, snap_final_door_price: calcs.finalDoorUnitPrice,
          cabinet_material_remark: cab.cabinet_material_remark || '',
          cabinet_total_price: calcs.baseTotal // 【新增】保存该单个柜子的核算总计
        }]).select().single();
        if (cabErr2) throw cabErr2;

        // 保存升级工艺 (逻辑不变，依然高度一致依赖 calcs 提供精准快照)
        if (cab.upgrades && cab.upgrades.length > 0) {
          const upgradeInserts = cab.upgrades.map(u => {
            const calculatedMatch = calcs.calculatedUpgrades.find(cu => cu.id === u.id);
            return {
              quote_id: quoteData.id, cabinet_id: insertedCab.id, upgrade_item_id: u.item_id,
              quantity: calculatedMatch.calculatedQty, remark: u.remark || '',
              snap_unit_price: calculatedMatch.snap_final_unit_price, snap_upgrade_effect_type: u.upgrade_effect_type,
              snap_upgrade_name: u.name, snap_base_door_price: calculatedMatch.snap_base_door_price,
              snap_upgrade_price: calculatedMatch.finalAmount,
              snap_original_unit_price: u.snap_original_unit_price,
              unit_price_adjustment: u.unit_price_adjustment,
              snap_final_unit_price: calculatedMatch.snap_final_unit_price,
              input_quantity: u.input_quantity,
              calculated_quantity: calculatedMatch.calculatedQty,
              manual_door_area: u.manual_door_area ? parseFloat(u.manual_door_area) : null,
              parent_record_id: u.parent_record_id,
              snap_material: u.snap_material,
              snap_style: u.snap_style,
              snap_specification: u.snap_specification
            };
          });
          const { error: upgErr } = await supabase.from('quote_upgrades').insert(upgradeInserts);
          if (upgErr) throw upgErr;
        }
      }
      setQuoteInfo(prev => ({ ...prev, status: '已保存草稿' }));
      showToast(`报价草稿保存成功！`);
    } catch (err) { showToast('保存失败: ' + err.message, 'error'); } finally { setIsLoading(false); }
  };

  const renderUpgradeModal = () => {
    if (!upgradeModal.isOpen) return null;
    const activeUpgrades = upgrades.filter(u => u.status === true);
    const categories = ['门板升级', '五金系统', '灯光系统', '木作工艺', '其他'];
    const filteredItems = activeUpgrades.filter(u => (u.upgrade_category || '其他') === upgradeModal.activeCategory);

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl w-full max-w-5xl h-[80vh] shadow-2xl flex flex-col overflow-hidden">
          <div className="flex justify-between items-center p-6 border-b border-gray-100">
            <h2 className="text-xl font-black text-gray-900">✨ 挑选升级与工艺系统</h2>
            <button onClick={() => setUpgradeModal({...upgradeModal, isOpen: false})} className="w-10 h-10 bg-gray-100 rounded-full font-bold text-gray-600">✕</button>
          </div>
          <div className="flex flex-1 overflow-hidden">
            <div className="w-48 bg-gray-50 border-r border-gray-100 flex flex-col p-4 gap-2">
              {categories.map(cat => (
                <button key={cat} onClick={() => setUpgradeModal({...upgradeModal, activeCategory: cat, selectedItem: null})}
                  className={`text-left px-4 py-3 rounded-xl font-bold text-sm ${upgradeModal.activeCategory === cat ? 'bg-black text-white' : 'text-gray-500 hover:bg-white'}`}>
                  {cat}
                </button>
              ))}
            </div>
            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 gap-4 h-max border-r border-gray-100">
                {filteredItems.map(item => (
                  <div key={item.id} onClick={() => setUpgradeModal({...upgradeModal, selectedItem: item, inputQty: '', inputRemark: ''})}
                    className={`p-4 border-2 rounded-2xl cursor-pointer ${upgradeModal.selectedItem?.id === item.id ? 'border-black bg-gray-50' : 'border-gray-100 hover:border-gray-300'}`}>
                    <div className="flex justify-between font-bold mb-2"><span>{item.name}</span><span className="text-xs border px-1 rounded">{item.calculation_type}</span></div>
                    <div className="text-sm font-black text-rose-600">¥{item.unit_price} <span className="text-xs text-gray-400">/ {item.unit}</span></div>
                  </div>
                ))}
              </div>
              <div className="w-80 bg-gray-50/50 p-6 flex flex-col">
                {upgradeModal.selectedItem ? (
                  <div className="flex flex-col h-full">
                    <div className="mb-6"><div className="text-xl font-black">{upgradeModal.selectedItem.name}</div></div>
                   {(() => {
                      const isExcessDrawer = upgradeModal.selectedItem.calculation_type === 'excess_drawer' || upgradeModal.selectedItem.calculation_type === '超额抽屉规则';
                      return (
                        <div className="space-y-5 flex-1">
                          <div>
                            <label className="block text-xs font-bold text-gray-600 mb-2">
                              {upgradeModal.selectedItem.calculation_type === '人工直接输金额' ? '输入总金额 (元)' : 
                               isExcessDrawer ? '输入实际抽屉数量' : 
                               `输入原始数量 (${upgradeModal.selectedItem.unit})`}
                            </label>
                            {upgradeModal.selectedItem.calculation_type === '按柜宽自动算' ? (
                              <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm font-bold">🤖 根据柜宽自动运算</div>
                            ) : (
                              <>
                                <input type="number" value={upgradeModal.inputQty} onChange={e=>setUpgradeModal({...upgradeModal, inputQty:e.target.value})} className="w-full border-2 border-gray-200 p-4 rounded-xl font-black text-xl" />
                               {isExcessDrawer && (() => {
                                  const w = parseFloat(activeCabinet?.width) || 0;
                                  const standard = Math.max(1, Math.round(w / 1000));
                                  const input = parseFloat(upgradeModal.inputQty) || 0;
                                  const excess = Math.max(0, input - standard);
                                  const cost = excess * parseFloat(upgradeModal.selectedItem.unit_price || 0);
                                  return (
                                    <div className="mt-4 bg-rose-50/50 p-4 rounded-xl border border-rose-100 space-y-2 text-sm">
                                      <div className="flex justify-between"><span className="text-gray-500 font-bold">当前柜宽:</span><span className="font-bold">{w} mm</span></div>
                                      <div className="flex justify-between"><span className="text-gray-500 font-bold">系统标配数量:</span><span className="font-bold">{standard} 个</span></div>
                                      <div className="flex justify-between"><span className="text-gray-500 font-bold">客户实际数量:</span><span className="font-bold">{input} 个</span></div>
                                      <div className="flex justify-between"><span className="text-gray-500 font-bold">超额计费数量:</span><span className="font-black text-rose-600">{excess} 个</span></div>
                                      <div className="flex justify-between border-t border-rose-200 pt-2 mt-2"><span className="font-bold text-gray-800">预计超额费用:</span><span className="font-black text-rose-600">¥{cost.toFixed(0)}</span></div>
                                    </div>
                                  );
                                })()}
                              </>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            {!isExcessDrawer && (
                              <div>
                                <label className="block text-xs font-bold text-gray-600 mb-2">人工单价调整 (元)</label>
                                <input type="number" placeholder="+0" value={upgradeModal.unit_price_adjustment} onChange={e=>setUpgradeModal({...upgradeModal, unit_price_adjustment:e.target.value})} className="w-full border-2 border-gray-200 p-3 rounded-xl font-bold" />
                              </div>
                            )}
                            {upgradeModal.selectedItem.upgrade_effect_type === 'replace' && (
                              <div>
                                <label className="block text-xs font-bold text-rose-600 mb-2">人工门板面积 (㎡，选填)</label>
                                <input type="number" placeholder="默认用系统柜体投影" value={upgradeModal.manual_door_area} onChange={e=>setUpgradeModal({...upgradeModal, manual_door_area:e.target.value})} className="w-full border-2 border-rose-200 p-3 rounded-xl font-bold bg-rose-50" />
                              </div>
                            )}
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-600 mb-2">特殊说明</label>
                            <textarea value={upgradeModal.inputRemark} onChange={e=>setUpgradeModal({...upgradeModal, inputRemark:e.target.value})} className="w-full border-2 border-gray-200 p-3 rounded-xl text-sm resize-none" rows="3" />
                          </div>
                        </div>
                      );
                    })()}
                    <button onClick={handleConfirmAddUpgrade} className="w-full bg-black text-white py-4 rounded-xl font-black mt-4">确认加入核算</button>
                  </div>
                ) : <div className="m-auto text-gray-400 font-bold">请在左侧选择工艺</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSalesWorkspace = () => {
    if (!activeCabinet) return null;
    const currentCalcs = calculateCabinetDetails(activeCabinet);
    const grandTotal = quoteCabinets.reduce((sum, cab) => sum + calculateCabinetDetails(cab).baseTotal, 0);

    return (
      <div className="flex flex-col h-screen bg-gray-50 font-sans overflow-hidden">
        {renderUpgradeModal()}
        <div className="h-16 bg-white border-b border-gray-200 flex justify-between items-center px-6 shrink-0 shadow-sm z-20">
          <div className="flex items-center gap-6">
            <div className="font-black text-xl">NOEY<span className="font-light">QUOTATION</span></div>
            <div className="text-sm font-mono bg-gray-100 px-4 py-1 rounded-full font-bold">单号: {quoteInfo.quoteNo}</div>
            <div className="text-xs font-bold bg-amber-100 text-amber-700 px-3 py-1 rounded-full">● {quoteInfo.status}</div>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setCurrentView('home')} className="text-sm text-gray-500 hover:text-black font-bold">← 返回</button>
            <button onClick={handleSaveDraft} disabled={isLoading} className="bg-black text-white px-6 py-2 rounded-lg font-bold">💾 保存报价草稿</button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* 左侧柜体列表 */}
          <div className="w-80 bg-white border-r border-gray-200 flex flex-col shrink-0 z-10 shadow-lg">
            <div className="p-4 border-b border-gray-100 bg-gray-50">
              <input value={quoteInfo.customerName} onChange={e=>setQuoteInfo({...quoteInfo, customerName:e.target.value})} placeholder="客户名称" className="w-full border border-gray-200 p-2 mb-2 rounded font-bold" />
              <input value={quoteInfo.customerPhone} onChange={e=>setQuoteInfo({...quoteInfo, customerPhone:e.target.value})} placeholder="联系电话" className="w-full border border-gray-200 p-2 mb-2 rounded font-bold" />
              <textarea value={quoteInfo.deliveryAddress} onChange={e=>setQuoteInfo({...quoteInfo, deliveryAddress:e.target.value})} placeholder="交付地址" className="w-full border border-gray-200 p-2 rounded text-sm resize-none" rows="2" />
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-black text-gray-400">🗄️ 空间柜体</span>
                <button onClick={handleAddCabinet} className="text-xs font-bold text-blue-600">➕ 新增</button>
              </div>
              <div className="space-y-3">
                {quoteCabinets.map(cab => (
                  <div key={cab.id} onClick={() => setActiveCabinetId(cab.id)} className={`p-4 rounded-xl cursor-pointer border-2 relative group ${activeCabinetId === cab.id ? 'bg-white border-black shadow-md' : 'bg-white border-transparent'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-bold text-sm">{cab.space}{cab.cabinetType}</div>
                      <div className="hidden group-hover:flex gap-1 absolute right-2 top-2 bg-white rounded p-1 shadow">
                        <button onClick={(e) => handleCopyCabinet(e, cab)} className="text-blue-600 text-[10px] px-1 font-bold">复制</button>
                        <button onClick={(e) => handleDeleteCabinet(e, cab.id)} className="text-rose-600 text-[10px] px-1 font-bold">删除</button>
                      </div>
                    </div>
                    <div className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded inline-block">{cab.width||0} × {cab.height||0} × {cab.depth||0}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 右侧编辑区 */}
          <div className="flex-1 overflow-y-auto p-8 bg-gray-100 pb-40">
            <div className="max-w-4xl mx-auto space-y-6">
              {/* 尺寸基础 */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-4 border-b pb-4"><h3 className="font-black text-gray-800">📐 基础尺寸</h3><div className="text-xs font-bold bg-gray-100 px-3 py-1 rounded-full">算法: {currentCalcs.calcMethod}</div></div>
                <div className="grid grid-cols-5 gap-4">
                  <div><label className="text-xs font-bold text-gray-500">空间</label><input value={activeCabinet.space} onChange={e=>updateActiveCabinet('space', e.target.value)} className="w-full border-2 p-2 rounded-lg font-bold mt-1 bg-gray-50 focus:bg-white" /></div>
                  <div><label className="text-xs font-bold text-gray-500">类型</label><input value={activeCabinet.cabinetType} onChange={e=>updateActiveCabinet('cabinetType', e.target.value)} className="w-full border-2 p-2 rounded-lg font-bold mt-1 bg-gray-50 focus:bg-white" /></div>
                  <div><label className="text-xs font-bold text-blue-600">宽 W(mm)</label><input type="number" value={activeCabinet.width} onChange={e=>updateActiveCabinet('width', e.target.value)} className="w-full border-2 border-blue-200 p-2 rounded-lg font-black mt-1" /></div>
                  <div><label className="text-xs font-bold text-blue-600">高 H(mm)</label><input type="number" value={activeCabinet.height} onChange={e=>updateActiveCabinet('height', e.target.value)} className="w-full border-2 border-blue-200 p-2 rounded-lg font-black mt-1" /></div>
                  <div><label className="text-xs font-bold text-blue-600">深 D(mm)</label><input type="number" value={activeCabinet.depth} onChange={e=>updateActiveCabinet('depth', e.target.value)} className="w-full border-2 border-blue-200 p-2 rounded-lg font-black mt-1" /></div>
                </div>
              </div>

              {/* 柜体选配 */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-4 border-b pb-4"><h3 className="font-black">🗄️ 柜体选配</h3><div className="font-bold text-gray-500">柜体核算: <span className="text-black ml-1">¥{currentCalcs.cabinetPortionTotal.toFixed(0)}</span></div></div>
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-gray-500">系统材料底价</label>
                    <select value={activeCabinet.cabinet_mat_id} onChange={e=>updateActiveCabinet('cabinet_mat_id', e.target.value)} className="w-full border-2 p-2 rounded-lg font-bold mt-1">
                      <option value="">-- 选择系统材料 --</option>
                      {cabinets.map(c => <option key={c.id} value={c.id}>{c.name} (¥{c.base_price})</option>)}
                    </select>
                  </div>
                  <div><label className="text-xs font-bold text-gray-500">指定品牌</label><input value={activeCabinet.snap_cabinet_brand} onChange={e=>updateActiveCabinet('snap_cabinet_brand', e.target.value)} className="w-full border-2 p-2 rounded-lg font-bold mt-1" /></div>
                  <div><label className="text-xs font-bold text-gray-500">指定颜色</label><input value={activeCabinet.snap_cabinet_color} onChange={e=>updateActiveCabinet('snap_cabinet_color', e.target.value)} className="w-full border-2 p-2 rounded-lg font-bold mt-1" /></div>
                </div>
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div><label className="text-xs font-bold text-gray-500">板材厚度(mm)</label><input type="number" value={activeCabinet.cabinet_thickness} onChange={e=>updateActiveCabinet('cabinet_thickness', e.target.value)} className="w-full border-2 p-2 rounded-lg font-bold mt-1" /></div>
                  <div><label className="text-xs font-bold text-gray-500">基础背板</label><select value={activeCabinet.snap_back_panel_spec} onChange={e=>updateActiveCabinet('snap_back_panel_spec', e.target.value)} className="w-full border-2 p-2 rounded-lg font-bold mt-1"><option>9mm标准</option><option>18mm需升级</option></select></div>
                  <div className="col-span-2"><label className="text-xs font-bold text-gray-500">综合选材备注</label><input value={activeCabinet.cabinet_material_remark} onChange={e=>updateActiveCabinet('cabinet_material_remark', e.target.value)} className="w-full border-2 p-2 rounded-lg font-bold mt-1" /></div>
                </div>
                <div className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border">
                  <div className="text-sm font-black text-gray-900">人工调价 (元/㎡)</div>
                  <div className="flex items-center gap-4">
                    <input type="number" placeholder="+0" value={activeCabinet.cabinet_unit_adjustment} onChange={e=>updateActiveCabinet('cabinet_unit_adjustment', e.target.value)} className="w-24 border-2 p-2 rounded-lg font-black text-center" />
                    <div className="text-right border-l pl-4"><div className="text-xs font-bold text-gray-500">最终单价快照</div><div className="text-xl font-black">¥{currentCalcs.finalCabUnitPrice}</div></div>
                  </div>
                </div>
              </div>

              {/* 门板选配 */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-4 border-b pb-4"><h3 className="font-black">🚪 门板选配</h3><div className="font-bold text-gray-500">门板核算: <span className="text-black ml-1">¥{currentCalcs.doorPortionTotal.toFixed(0)}</span></div></div>
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-gray-500">系统门板底价 (或敞开柜)</label>
                    <select value={activeCabinet.door_mat_id} onChange={e=>updateActiveCabinet('door_mat_id', e.target.value)} className="w-full border-2 p-2 rounded-lg font-bold mt-1">
                      <option value="">-- 无门板敞开柜 --</option>
                      {doors.map(d => <option key={d.id} value={d.id}>{d.name} (¥{d.base_price})</option>)}
                    </select>
                  </div>
                  <div><label className="text-xs font-bold text-gray-500">指定品牌</label><input value={activeCabinet.snap_door_brand} onChange={e=>updateActiveCabinet('snap_door_brand', e.target.value)} className="w-full border-2 p-2 rounded-lg font-bold mt-1" /></div>
                  <div><label className="text-xs font-bold text-gray-500">指定颜色</label><input value={activeCabinet.snap_door_color} onChange={e=>updateActiveCabinet('snap_door_color', e.target.value)} className="w-full border-2 p-2 rounded-lg font-bold mt-1" /></div>
                </div>
                <div className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border">
                  <div className="text-sm font-black text-gray-900">人工调价 (元/㎡)</div>
                  <div className="flex items-center gap-4">
                    <input type="number" placeholder="+0" value={activeCabinet.door_unit_adjustment} onChange={e=>updateActiveCabinet('door_unit_adjustment', e.target.value)} className="w-24 border-2 p-2 rounded-lg font-black text-center" />
                    <div className="text-right border-l pl-4"><div className="text-xs font-bold text-gray-500">最终单价快照</div><div className="text-xl font-black">¥{currentCalcs.finalDoorUnitPrice}</div></div>
                  </div>
                </div>
              </div>

              {/* 升级工艺引擎 */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-black/10">
                <div className="flex justify-between items-center mb-4 border-b pb-4">
                  <h3 className="font-black text-gray-900">✨ 局部升级与工艺</h3>
                  <button onClick={() => setUpgradeModal({...upgradeModal, isOpen: true})} className="bg-black text-white px-4 py-1.5 rounded-full text-sm font-bold shadow">+ 添加工艺</button>
                </div>
                {(!activeCabinet.upgrades || activeCabinet.upgrades.length === 0) ? (
                   <div className="py-8 text-center text-gray-400 font-bold border-2 border-dashed rounded-xl">尚未添加工艺</div>
                ) : (
                  <div className="space-y-3">
                    {activeCabinet.upgrades.map(upg => {
                      const calced = currentCalcs.calculatedUpgrades.find(u => u.id === upg.id);
                      return (
                        <div key={upg.id} className="bg-gray-50 border p-3 rounded-xl flex justify-between items-center">
                          <div>
                            <div className="font-bold text-sm flex items-center gap-2">{upg.name} <span className="text-[10px] bg-white border px-1 rounded">{upg.category}</span></div>
                            <div className="text-xs text-gray-500 mt-1">
                              原始价: ¥{upg.snap_original_unit_price} 
                              {upg.unit_price_adjustment !== 0 && <span className="text-rose-500 ml-1">(调: {upg.unit_price_adjustment > 0 ? '+' : ''}{upg.unit_price_adjustment})</span>}
                              <span className="mx-2">|</span>
                              计价量: {calced.calculatedQty} {upg.unit} 
                              {upg.input_quantity !== calced.calculatedQty && upg.calculation_type !== '人工直接输金额' && <span className="text-amber-500 ml-1">(输入: {upg.input_quantity})</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              {upg.upgrade_effect_type === 'replace' && upg.replace_calculation_mode === 'full_price' && <div className="text-[10px] text-rose-500">自动扣底 (¥{calced.snap_base_door_price})</div>}
                              <div className="text-lg font-black">¥{calced.finalAmount.toFixed(0)}</div>
                            </div>
                            <button onClick={() => handleRemoveUpgrade(upg.id)} className="text-gray-400 hover:text-rose-600 font-bold px-2">✕</button>
                          </div>
                        </div>
                      )
                    })}
                    <div className="text-right pt-2 mt-2 border-t font-black text-rose-600">工艺小计 ¥{currentCalcs.upgradePortionTotal.toFixed(0)}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 底部悬浮算账条 */}
        <div className="fixed bottom-0 right-0 left-80 bg-white border-t p-4 flex justify-between items-center shadow-[0_-10px_20px_rgba(0,0,0,0.02)] z-20">
          <div className="flex gap-6 pl-4 font-bold text-sm">
            <div><div className="text-[10px] text-gray-400">柜体</div>¥{currentCalcs.cabinetPortionTotal.toFixed(0)}</div>
            <div><div className="text-[10px] text-gray-400">门板</div>¥{currentCalcs.doorPortionTotal.toFixed(0)}</div>
            <div><div className="text-[10px] text-gray-400">工艺</div><span className="text-rose-600">¥{currentCalcs.upgradePortionTotal.toFixed(0)}</span></div>
          </div>
          <div className="flex gap-8 items-center pr-4">
            <div className="text-right"><div className="text-xs text-gray-500">当前单柜合计</div><div className="text-2xl font-black">¥{currentCalcs.baseTotal.toFixed(0)}</div></div>
            <div className="h-10 w-px bg-gray-200"></div>
            <div className="text-right"><div className="text-xs text-gray-500">整单全案总计</div><div className="text-3xl font-black text-black">¥{grandTotal.toFixed(0)}</div></div>
          </div>
        </div>
      </div>
    );
  };

  const renderAdmin = () => {
    return (
      <div className="flex h-screen bg-gray-100 font-sans overflow-hidden">
        {deleteConfirm.show && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
            <div className="bg-white p-6 rounded-xl max-w-sm shadow-xl border">
              <h3 className="text-lg font-black mb-2 text-rose-600">⚠️ 危险操作</h3>
              <p className="text-sm font-bold text-gray-600 mb-4">确定物理删除 [{deleteConfirm.name}] 吗？</p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setDeleteConfirm({show:false, table:'', id:null, name:''})} className="px-4 py-2 bg-gray-100 font-bold rounded-lg">取消</button>
                <button onClick={executeDelete} className="px-4 py-2 bg-rose-600 text-white font-bold rounded-lg">执行删除</button>
              </div>
            </div>
          </div>
        )}
        <div className="w-64 bg-gray-900 text-white flex flex-col z-20">
          <div className="p-6 border-b border-gray-800"><h1 className="text-2xl font-black">NOEY<span className="font-light text-gray-400">ERP</span></h1></div>
          <div className="flex-1 py-4">
            <button onClick={() => setAdminView('upgrade')} className={`w-full text-left px-6 py-3 font-bold border-l-4 ${adminView==='upgrade'?'border-amber-500 bg-gray-800':'border-transparent text-gray-400 hover:text-white'}`}>✨ V2.7 升级工艺</button>
            <button onClick={() => setAdminView('cabinet')} className={`w-full text-left px-6 py-3 font-bold border-l-4 ${adminView==='cabinet'?'border-blue-500 bg-gray-800':'border-transparent text-gray-400 hover:text-white'}`}>🗄️ 柜体基础库</button>
            <button onClick={() => setAdminView('door')} className={`w-full text-left px-6 py-3 font-bold border-l-4 ${adminView==='door'?'border-indigo-500 bg-gray-800':'border-transparent text-gray-400 hover:text-white'}`}>🚪 门板基础库</button>
            <button onClick={() => setAdminView('rules')} className={`w-full text-left px-6 py-3 font-bold border-l-4 ${adminView==='rules'?'border-rose-500 bg-gray-800':'border-transparent text-gray-400 hover:text-white'}`}>⚙️ 计价参数规则</button>
          </div>
          <div className="p-4 border-t border-gray-800"><button onClick={() => {setCurrentUser(null); setCurrentView('home');}} className="w-full bg-gray-800 py-2 rounded font-bold text-sm text-gray-400 hover:text-white hover:bg-rose-600">退出返回</button></div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 relative">
          {adminView === 'upgrade' && (
            <div className="max-w-5xl space-y-6">
              <h2 className="text-2xl font-black">升级工艺管理</h2>
              <form onSubmit={handleSaveUpgrade} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div className="col-span-2"><label className="text-xs font-bold text-gray-500">工艺名称</label><input required value={upgradeForm.name} onChange={e=>setUpgradeForm({...upgradeForm, name:e.target.value})} className="w-full border-2 p-2 rounded-lg font-bold mt-1" /></div>
                  <div><label className="text-xs font-bold text-gray-500">分类</label><select value={upgradeForm.upgrade_category} onChange={e=>setUpgradeForm({...upgradeForm, upgrade_category:e.target.value})} className="w-full border-2 p-2 rounded-lg mt-1 font-bold"><option>门板升级</option><option>五金系统</option><option>灯光系统</option><option>木作工艺</option><option>其他</option></select></div>
                  <div><label className="text-xs font-bold text-gray-500">排序权值</label><input type="number" required value={upgradeForm.sort_order} onChange={e=>setUpgradeForm({...upgradeForm, sort_order:e.target.value})} className="w-full border-2 p-2 rounded-lg font-bold mt-1" /></div>
                </div>
                <div className="grid grid-cols-4 gap-4 mb-4 bg-gray-50 p-4 rounded-lg">
                  <div><label className="text-xs font-bold text-blue-700">提取图纸计价法</label><select value={upgradeForm.calculation_type} onChange={e=>setUpgradeForm({...upgradeForm, calculation_type:e.target.value})} className="w-full border-2 border-blue-200 p-2 rounded-lg font-bold text-blue-900 mt-1"><option>按面积㎡</option><option>按延米</option><option>按个</option><option>按套</option><option>按柜宽自动算</option><option>超额抽屉规则</option><option>人工直接输金额</option></select></div>
                  <div><label className="text-xs font-bold text-gray-500">计价单位</label><input required value={upgradeForm.unit} onChange={e=>setUpgradeForm({...upgradeForm, unit:e.target.value})} className="w-full border-2 p-2 rounded-lg font-bold mt-1" /></div>
                  <div><label className="text-xs font-bold text-gray-500">系统原价 (元)</label><input type="number" required value={upgradeForm.unit_price} onChange={e=>setUpgradeForm({...upgradeForm, unit_price:e.target.value})} className="w-full border-2 p-2 rounded-lg font-black mt-1" /></div>
                  <div>
                    <label className="text-xs font-bold text-amber-700">价格影响逻辑引擎</label>
                    <select value={upgradeForm.upgrade_effect_type} onChange={e=>setUpgradeForm({...upgradeForm, upgrade_effect_type:e.target.value})} className="w-full border-2 border-amber-200 p-2 rounded-lg font-bold text-amber-900 mt-1">
                      <option value="add_cost">追加费用</option><option value="replace">替换(需处理底价)</option><option value="difference">差价直补</option><option value="manual">人工调整</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-4 mb-4">
                  <div><label className="text-xs font-bold text-gray-500">组合类型</label><select value={upgradeForm.combo_type} onChange={e=>setUpgradeForm({...upgradeForm, combo_type:e.target.value})} className="w-full border-2 p-2 rounded-lg mt-1 font-bold"><option value="single">普通单项</option><option value="bundle">母子组合</option></select></div>
                  <div><label className="text-xs font-bold text-gray-500">最低起算量</label><input type="number" value={upgradeForm.minimum_quantity} onChange={e=>setUpgradeForm({...upgradeForm, minimum_quantity:e.target.value})} className="w-full border-2 p-2 rounded-lg font-bold mt-1" /></div>
                  <div><label className="text-xs font-bold text-gray-500">材质属性</label><input value={upgradeForm.upgrade_material} onChange={e=>setUpgradeForm({...upgradeForm, upgrade_material:e.target.value})} className="w-full border-2 p-2 rounded-lg font-bold mt-1" /></div>
                  <div><label className="text-xs font-bold text-gray-500">款式属性</label><input value={upgradeForm.upgrade_style} onChange={e=>setUpgradeForm({...upgradeForm, upgrade_style:e.target.value})} className="w-full border-2 p-2 rounded-lg font-bold mt-1" /></div>
                  <div><label className="text-xs font-bold text-gray-500">规格属性</label><input value={upgradeForm.upgrade_specification} onChange={e=>setUpgradeForm({...upgradeForm, upgrade_specification:e.target.value})} className="w-full border-2 p-2 rounded-lg font-bold mt-1" /></div>
                </div>
                <div className="flex justify-between items-center"><button type="submit" className="bg-black text-white px-8 py-2 rounded-lg font-bold">{editId ? '保存修改' : '确认新增'}</button></div>
              </form>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left text-sm"><thead className="bg-gray-50 text-xs text-gray-500 border-b"><tr><th className="p-3">名称</th><th className="p-3">分类</th><th className="p-3">单价</th><th className="p-3">逻辑</th><th className="p-3">操作</th></tr></thead>
                  <tbody>
                    {upgrades.map(u => (
                      <tr key={u.id} className="border-b font-bold"><td className="p-3">{u.name}</td><td className="p-3">{u.upgrade_category}</td><td className="p-3">¥{u.unit_price}</td><td className="p-3 text-xs">{u.upgrade_effect_type}</td>
                        <td className="p-3 flex gap-2">
                          <button onClick={() => {setEditId(u.id); setUpgradeForm(u);}} className="text-blue-600">编辑</button>
                          <button onClick={() => handleToggleUpgradeStatus(u)} className={u.status ? 'text-amber-500' : 'text-emerald-500'}>{u.status ? '停用' : '启用'}</button>
                          <button onClick={() => triggerDelete('upgrade_items', u.id, u.name)} className="text-rose-600">物理删除</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {/* Cabinet Admin View */}
          {adminView === 'cabinet' && (
            <div className="max-w-4xl space-y-6">
              <h2 className="text-2xl font-black">柜体基础材料</h2>
              <form onSubmit={handleSaveCabinet} className="bg-white p-6 rounded-xl shadow-sm flex gap-4 items-end">
                <div className="flex-1"><label className="text-xs font-bold text-gray-500">材料名</label><input required value={cabinetForm.name} onChange={e=>setCabinetForm({...cabinetForm, name:e.target.value})} className="w-full border-2 p-2 rounded-lg font-bold" /></div>
                <div><label className="text-xs font-bold text-gray-500">基准价</label><input type="number" required value={cabinetForm.base_price} onChange={e=>setCabinetForm({...cabinetForm, base_price:e.target.value})} className="w-full border-2 p-2 rounded-lg font-black w-24" /></div>
                <div><label className="text-xs font-bold text-gray-500">浅柜价</label><input type="number" required value={cabinetForm.shallow_price} onChange={e=>setCabinetForm({...cabinetForm, shallow_price:e.target.value})} className="w-full border-2 p-2 rounded-lg font-bold w-24" /></div>
                <div><label className="text-xs font-bold text-gray-500">无门系数</label><input type="number" step="0.01" required value={cabinetForm.no_door_factor} onChange={e=>setCabinetForm({...cabinetForm, no_door_factor:e.target.value})} className="w-full border-2 p-2 rounded-lg font-bold w-24" /></div>
                <button type="submit" className="bg-black text-white px-6 py-2 rounded-lg font-bold h-[42px]">{editId ? '保存' : '新增'}</button>
              </form>
              <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <table className="w-full text-left text-sm font-bold"><thead className="bg-gray-50 text-xs text-gray-500 border-b"><tr><th className="p-3">名称</th><th className="p-3">基准价</th><th className="p-3">浅柜价</th><th className="p-3">操作</th></tr></thead>
                  <tbody>{cabinets.map(c => <tr key={c.id} className="border-b"><td className="p-3">{c.name}</td><td className="p-3">¥{c.base_price}</td><td className="p-3">¥{c.shallow_price}</td><td className="p-3"><button onClick={() => {setEditId(c.id); setCabinetForm(c);}} className="text-blue-600 mr-4">编辑</button><button onClick={() => triggerDelete('materials_cabinet', c.id, c.name)} className="text-rose-600">删除</button></td></tr>)}</tbody>
                </table>
              </div>
            </div>
          )}
          {/* Door Admin View */}
          {adminView === 'door' && (
            <div className="max-w-3xl space-y-6">
              <h2 className="text-2xl font-black">门板基础材料</h2>
              <form onSubmit={handleSaveDoor} className="bg-white p-6 rounded-xl shadow-sm flex gap-4 items-end">
                <div className="flex-1"><label className="text-xs font-bold text-gray-500">门板名</label><input required value={doorForm.name} onChange={e=>setDoorForm({...doorForm, name:e.target.value})} className="w-full border-2 p-2 rounded-lg font-bold" /></div>
                <div><label className="text-xs font-bold text-gray-500">类型</label><select value={doorForm.door_type} onChange={e=>setDoorForm({...doorForm, door_type:e.target.value})} className="w-full border-2 p-2 rounded-lg font-bold"><option>普通门板</option><option>无门板</option></select></div>
                <div><label className="text-xs font-bold text-gray-500">基准价</label><input type="number" required disabled={doorForm.door_type==='无门板'} value={doorForm.base_price} onChange={e=>setDoorForm({...doorForm, base_price:e.target.value})} className="w-full border-2 p-2 rounded-lg font-black w-24" /></div>
                <button type="submit" className="bg-black text-white px-6 py-2 rounded-lg font-bold h-[42px]">{editId ? '保存' : '新增'}</button>
              </form>
              <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <table className="w-full text-left text-sm font-bold"><thead className="bg-gray-50 text-xs text-gray-500 border-b"><tr><th className="p-3">名称</th><th className="p-3">类型</th><th className="p-3">价格</th><th className="p-3">操作</th></tr></thead>
                  <tbody>{doors.map(d => <tr key={d.id} className="border-b"><td className="p-3">{d.name}</td><td className="p-3">{d.door_type}</td><td className="p-3">¥{d.base_price}</td><td className="p-3"><button onClick={() => {setEditId(d.id); setDoorForm(d);}} className="text-blue-600 mr-4">编辑</button><button onClick={() => triggerDelete('materials_door', d.id, d.name)} className="text-rose-600">删除</button></td></tr>)}</tbody>
                </table>
              </div>
            </div>
          )}
          {/* Rules Admin View */}
          {adminView === 'rules' && (
             <div className="max-w-2xl space-y-6">
               <h2 className="text-2xl font-black">计价参数规则</h2>
               <form onSubmit={handleSaveRules} className="bg-white p-8 rounded-xl shadow-sm border space-y-4 font-bold">
                 <div><label className="block text-sm text-gray-500 mb-1">标准深度阈值 (mm)</label><input type="number" value={rules.standard_depth} onChange={e=>setRules({...rules, standard_depth:e.target.value})} className="w-full border-2 p-2 rounded-lg" /></div>
                 <div><label className="block text-sm text-gray-500 mb-1">浅柜判定界限 (mm)</label><input type="number" value={rules.shallow_depth} onChange={e=>setRules({...rules, shallow_depth:e.target.value})} className="w-full border-2 p-2 rounded-lg" /></div>
                 <div><label className="block text-sm text-gray-500 mb-1">面积/延米计价高度分水岭 (mm)</label><input type="number" value={rules.height_threshold} onChange={e=>setRules({...rules, height_threshold:e.target.value})} className="w-full border-2 p-2 rounded-lg" /></div>
                 <button type="submit" className="w-full bg-black text-white p-3 rounded-lg font-black mt-4">更新全局规则</button>
               </form>
             </div>
          )}
        </div>
      </div>
    );
  };

  const renderAdminLogin = () => (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 font-sans">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-96 border">
        <h2 className="text-2xl font-black mb-8 text-center">NOEY<span className="font-light">ERP</span></h2>
        <input type="text" placeholder="账号 (admin)" value={adminLoginForm.username} onChange={e=>setAdminLoginForm({...adminLoginForm, username:e.target.value})} className="w-full border-2 p-3 rounded-xl mb-4 font-bold" />
        <input type="password" placeholder="密码 (admin123)" value={adminLoginForm.password} onChange={e=>setAdminLoginForm({...adminLoginForm, password:e.target.value})} className="w-full border-2 p-3 rounded-xl mb-6 font-bold" />
        <button onClick={handleAdminLogin} className="w-full bg-black text-white p-3 rounded-xl font-bold">登录控制台</button>
        <button onClick={() => setCurrentView('home')} className="w-full mt-4 text-sm font-bold text-gray-400 hover:text-black">← 返回</button>
      </div>
    </div>
  );

  if (currentView === 'sales') return renderSalesWorkspace();
  if (currentView === 'admin-login') return renderAdminLogin();
  if (currentView === 'admin') return renderAdmin();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center font-sans">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-black text-gray-900 tracking-widest mb-4">NOEY<span className="font-light">QUOTATION</span></h1>
          <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">诺一家具 · 核心报价引擎 V2.0-A</p>
        </div>
        <div className="grid grid-cols-2 gap-8 max-w-4xl w-full px-6">
          <button onClick={enterSalesWorkspace} className="bg-white p-10 rounded-3xl shadow-xl hover:shadow-2xl border-2 border-transparent hover:border-black text-left group transition-all">
            <div className="text-5xl mb-6 group-hover:scale-110 transition-transform origin-left">💻</div>
            <h2 className="text-2xl font-black text-gray-900 mb-2">多柜报价工作台</h2>
            <p className="text-gray-500 font-medium text-sm">业务前线：建立订单、自动深度计算、智能选配</p>
          </button>
          <button onClick={() => setCurrentView('admin-login')} className="bg-white p-10 rounded-3xl shadow-xl hover:shadow-2xl border-2 border-transparent hover:border-gray-300 text-left group transition-all">
            <div className="text-5xl mb-6 grayscale group-hover:scale-110 transition-transform origin-left">⚙️</div>
            <h2 className="text-2xl font-black text-gray-800 mb-2">底层数据管理台</h2>
            <p className="text-gray-500 font-medium text-sm">后台中枢：维护材料库、配置规则引擎、管控工艺</p>
          </button>
        </div>
        {toast.show && <div className="fixed top-8 left-1/2 -translate-x-1/2 bg-black text-white px-8 py-3 rounded-full text-sm font-bold shadow-2xl z-50">{toast.message}</div>}
    </div>
  );
}
