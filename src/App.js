import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const rawSupabaseUrl = 'https://muwzdigtehcperweliyg.supabase.co/rest/v1/'; 
const supabaseKey = 'sb_publishable_SGHvdmqpvo3Z6GekTtk4cA_PcvbDGpd';
const supabaseUrl = rawSupabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabase = createClient(supabaseUrl, supabaseKey);

export default function App() {
  // 1. 全局状态
  const [currentView, setCurrentView] = useState('home'); // home, admin-login, admin, sales, sales-history
  const [currentUser, setCurrentUser] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [isLoading, setIsLoading] = useState(false);
  
  // 2. 基础数据字典状态
  const [cabinets, setCabinets] = useState([]);
  const [doors, setDoors] = useState([]);
  const [upgrades, setUpgrades] = useState([]);
  const [rules, setRules] = useState({ 
    id: null, standard_depth: 600, shallow_depth: 295, height_threshold: 1000, minimum_area: 1, minimum_width: 1000,
    depth_overage_enabled: true, depth_calculation_mode: 'ratio'
  });
  // --- Phase 2 新增状态 ---
  const [historyList, setHistoryList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewData, setPreviewData] = useState(null); // 【新增】：存储预览所需的数据
  const [salesOrigin, setSalesOrigin] = useState('home');// 【V4.0 导航优化】：记录 Quote Studio 的来路来源，决定返回按钮去哪
  const [upgradeSearchQuery, setUpgradeSearchQuery] = useState('');// 【新增】：控制工艺弹窗内的独立搜索
  
  // 3. 后台管理台专属状态
  const [adminView, setAdminView] = useState('upgrade'); 
  const [adminUpgradeSearch, setAdminUpgradeSearch] = useState(''); // 【新增】：后台工艺管理专属搜索
  const [editId, setEditId] = useState(null); 
  const [adminLoginForm, setAdminLoginForm] = useState({ username: '', password: '' });
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, table: '', id: null, name: '' });
  const [cabinetForm, setCabinetForm] = useState({ name: '', base_price: '', shallow_price: '', no_door_factor: '' });
  const [doorForm, setDoorForm] = useState({ name: '', door_type: '双饰面', surface_finish: '', base_price: '' });
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

  // --- Phase 2 新增：获取历史报价列表 ---
  const fetchHistoryList = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setHistoryList(data || []);
    } catch (err) {
      showToast('历史列表加载失败', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentView === 'admin' || currentView === 'sales' || currentView === 'sales-history') {
      fetchDictionaries();
    }
    if (currentView === 'sales-history') {
      fetchHistoryList();
    }
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
      const payload = { name: doorForm.name, door_type: doorForm.door_type, surface_finish: doorForm.surface_finish, base_price: parseFloat(doorForm.base_price) || 0 };
      if (editId) { await supabase.from('materials_door').update(payload).eq('id', editId); showToast('修改成功'); } 
      else { await supabase.from('materials_door').insert([payload]); showToast('新增成功'); }
      setDoorForm({ name: '', door_type: '双饰面', surface_finish: '', base_price: '' }); setEditId(null); fetchDictionaries();
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
      cabinet_mat_id: '', snap_cabinet_brand: '', snap_cabinet_color: '', cabinet_thickness: '18', cabinet_material_remark: '', snap_back_panel_spec: '9mm标准', cabinet_unit_adjustment: '', door_material_remark: '',
      door_mat_id: '', snap_door_brand: '', snap_door_color: '', snap_door_surface_finish: '', door_unit_adjustment: '', door_material_remark: '', upgrades: []
    }]);
    setActiveCabinetId(initCabId);
    setSalesOrigin('home'); // 【导航优化】：标记从首页新建进入
    setCurrentView('sales');
  };

  // ==========================================
  // 【新增】：删除历史草稿
  // ==========================================
  const handleDeleteQuote = async (quoteId) => {
    if (!window.confirm("确定删除该报价草稿？删除后无法恢复")) return;
    setIsLoading(true);
    try {
      // 1. 先查出该订单的所有柜体ID
      const { data: cabs } = await supabase.from('quote_cabinets').select('id').eq('quote_id', quoteId);
      if (cabs && cabs.length > 0) {
        const cabIds = cabs.map(c => c.id);
        // 2. 根据柜体ID，删除底层工艺 (规避 quote_id 不存在的报错)
        await supabase.from('quote_upgrades').delete().in('cabinet_id', cabIds);
      }
      // 3. 删除柜体
      await supabase.from('quote_cabinets').delete().eq('quote_id', quoteId);
      // 4. 删除主单
      await supabase.from('quotes').delete().eq('id', quoteId);
      
      showToast('草稿已彻底删除');
      fetchHistoryList(); // 刷新列表
    } catch (err) {
      showToast('删除失败: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // 【新增】：拉取数据并进入只读预览模式
  // ==========================================
  const handlePreviewQuote = async (quote) => {
    setIsLoading(true);
    try {
      const { data: cabData, error: cabErr } = await supabase.from('quote_cabinets').select('*').eq('quote_id', quote.id);
      if (cabErr) throw cabErr;

      let upgData = [];
      if (cabData && cabData.length > 0) {
        const cabIds = cabData.map(c => c.id);
        const { data: uData, error: upgErr } = await supabase.from('quote_upgrades').select('*').in('cabinet_id', cabIds);
        if (upgErr) throw upgErr;
        upgData = uData || [];
      }

      setPreviewData({ quote, cabinets: cabData || [], upgrades: upgData });
      setCurrentView('quote-preview');
    } catch (err) {
      showToast('读取预览数据失败: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };
  
  // 【Phase 2 新增】：历史报价重组引擎 (读取并逆向还原为编辑状态)
  const handleLoadQuoteForEditing = async (quote) => {
    setIsLoading(true);
    try {
      // 1. 还原主单信息
      setQuoteInfo({
        quoteNo: quote.quote_no,
        customerName: quote.customer_name || '',
        customerPhone: quote.customer_phone || '',
        deliveryAddress: quote.delivery_address || '',
        status: quote.status || '编辑中'
      });

      // 2. 拉取柜体明细
      const { data: cabData, error: cabErr } = await supabase.from('quote_cabinets').select('*').eq('quote_id', quote.id);
      if (cabErr) throw cabErr;

      // 3. 拉取工艺明细 (修复：因 quote_upgrades 无 quote_id 字段，改用 cabinet_id 批量关联查询)
      let upgData = [];
      if (cabData && cabData.length > 0) {
        const cabinetIds = cabData.map(cab => cab.id);
        const { data: uData, error: upgErr } = await supabase.from('quote_upgrades').select('*').in('cabinet_id', cabinetIds);
        if (upgErr) throw upgErr;
        upgData = uData || [];
      }

      // 3. 逆向组装柜体数组
      if (cabData && cabData.length > 0) {
        const reconstructedCabinets = cabData.map(dbCab => {
          // --- Name 拆分容错处理 ---
          let space = '未知空间';
          let cabinetType = '未知柜体';
          if (dbCab.name) {
            if (dbCab.name.includes('｜')) {
              const parts = dbCab.name.split('｜');
              space = parts[0] || space;
              cabinetType = parts[1] || cabinetType;
            } else {
              space = dbCab.name; // 无法拆分则全塞进 space
            }
          }

          // --- 组装挂载在该柜体下的工艺 ---
          const cabUpgrades = upgData.filter(u => u.cabinet_id === dbCab.id).map(dbUpg => {
            // 在当前字典库里寻找匹配项以补全静态规则 (容错：若已被物理删除，则取空对象)
            const dictItem = upgrades.find(u => u.id === dbUpg.upgrade_item_id) || {};
            
            return {
              id: dbUpg.id, // 使用历史记录的主键作为唯一标识，而不是新生成
              item_id: dbUpg.upgrade_item_id,
              name: dbUpg.snap_upgrade_name || dictItem.name || '已失效未知工艺',
              category: dictItem.upgrade_category || '未知分类',
              unit: dictItem.unit || '项',
              // 强制优先使用当时的历史快照价格！
              snap_original_unit_price: dbUpg.snap_original_unit_price || 0,
              unit_price_adjustment: dbUpg.unit_price_adjustment || 0,
              
              // 关键计算规则：优先使用字典当前规则，若字典失效则启用默认安全降级
              calculation_type: dictItem.calculation_type || '按面积㎡',
              upgrade_effect_type: dbUpg.snap_upgrade_effect_type || 'add_cost',
              replace_calculation_mode: dictItem.replace_calculation_mode || null,
              
              input_quantity: dbUpg.input_quantity || 0,
              minimum_quantity: dictItem.minimum_quantity || 0,
              manual_door_area: dbUpg.manual_door_area || '',
              remark: dbUpg.remark || '',
              combo_type: dictItem.combo_type || 'single',
              
              // 属性快照恢复
              snap_material: dbUpg.snap_material || '',
              snap_style: dbUpg.snap_style || '',
              snap_specification: dbUpg.snap_specification || '',
              parent_record_id: dbUpg.parent_record_id || null
            };
          });

          // --- 组装单柜数据 ---
          return {
            id: dbCab.id, // 关键：沿用真实 DB ID，避免下次保存错乱
            space: space,
            cabinetType: cabinetType,
            width: dbCab.width || '',
            height: dbCab.height || '',
            depth: dbCab.depth || '',
            // 系统选材关联 ID (用于计算引擎匹配底价)
            cabinet_mat_id: dbCab.cabinet_mat_id || '',
            door_mat_id: dbCab.door_mat_id || '',
            
            // 人工选配与快照
            snap_cabinet_brand: dbCab.snap_cabinet_brand || '',
            snap_cabinet_color: dbCab.snap_cabinet_color || '',
            cabinet_thickness: dbCab.cabinet_thickness || '18',
            cabinet_material_remark: dbCab.cabinet_material_remark || '',
            snap_back_panel_spec: dbCab.snap_back_panel_spec || '9mm标准',
            cabinet_unit_adjustment: dbCab.cabinet_unit_adjustment || '',
            
            snap_door_brand: dbCab.snap_door_brand || '',
            snap_door_color: dbCab.snap_door_color || '',
            door_unit_adjustment: dbCab.door_unit_adjustment || '',
            // 【V4.0 新增】恢复备注快照
            cabinet_material_remark: dbCab.cabinet_material_remark || '',
            door_material_remark: dbCab.door_material_remark || '',
            snap_door_surface_finish: dbCab.snap_door_surface_finish || '',
            
            // 挂载上一步重组好的工艺数组
            upgrades: cabUpgrades
          };
        });
        
        setQuoteCabinets(reconstructedCabinets);
        setActiveCabinetId(reconstructedCabinets[0].id);
      } else {
        // 极端异常兜底：若该单据在数据库中没有任何柜体，强行塞一个空柜体防崩
        const fallbackId = 'cab-fallback-' + Date.now();
        setQuoteCabinets([{ 
          id: fallbackId, space: '主卧', cabinetType: '衣柜', width: '', height: '', depth: '',
          cabinet_mat_id: '', snap_cabinet_brand: '', snap_cabinet_color: '', cabinet_thickness: '18', cabinet_material_remark: '', snap_back_panel_spec: '9mm标准', cabinet_unit_adjustment: '', door_material_remark: '',
          door_mat_id: '', snap_door_brand: '', snap_door_color: '', door_unit_adjustment: '', door_material_remark: '', upgrades: []
        }]);
        setActiveCabinetId(fallbackId);
      }

      // 4. 数据完全重组后，切入编辑工作台
      setSalesOrigin('sales-history'); // 【导航优化】：标记从历史列表进入
      setCurrentView('sales');
      showToast('草稿已成功恢复！');
    } catch (err) {
      console.error("恢复草稿失败详情:", err);
      showToast('读取草稿失败: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };
  
  const activeCabinet = quoteCabinets.find(c => c.id === activeCabinetId) || quoteCabinets[0];
  const updateActiveCabinet = (field, value) => { setQuoteCabinets(prev => prev.map(c => c.id === activeCabinetId ? { ...c, [field]: value } : c)); };

  const handleAddCabinet = () => {
    const newId = 'cab-' + Date.now();
    setQuoteCabinets([...quoteCabinets, { 
      id: newId, space: '次卧', cabinetType: '衣柜', width: '', height: '', depth: '',
      cabinet_mat_id: '', snap_cabinet_brand: '', snap_cabinet_color: '', cabinet_thickness: '18', cabinet_material_remark: '', snap_back_panel_spec: '9mm标准', cabinet_unit_adjustment: '', door_material_remark: '',
      door_mat_id: '', snap_door_brand: '', snap_door_color: '', snap_door_surface_finish: '', door_unit_adjustment: '', door_material_remark: '', upgrades: []
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

   // 3. 深度逻辑算法 (V4.0 比例算法重构)
    let hasDoor = doorMat && doorMat.door_type !== '无门板';
    let stdDepth = rules.standard_depth || 600;
    let shallowDepth = rules.shallow_depth || 295;
    let unitCabCost = 0;
    let unitDoorCost = hasDoor ? result.finalDoorUnitPrice : 0;

    // 基础柜体费用(不再直接乘超深比例)
    if (!hasDoor) {
      if (d <= shallowDepth) unitCabCost = finalShallowUnitPrice * noDoorFactor;
      else unitCabCost = result.finalCabUnitPrice * noDoorFactor;
    } else {
      if (d <= shallowDepth) unitCabCost = finalShallowUnitPrice;
      else unitCabCost = result.finalCabUnitPrice;
    }

    let baseCabinetTotal = unitCabCost * result.qty;
    let excessDepthFee = 0;
    let depthRatio = 1;

    // 独立计算超深比例和费用
    if (rules.depth_overage_enabled !== false && d > stdDepth) {
      depthRatio = d / stdDepth;
      excessDepthFee = (baseCabinetTotal * depthRatio) - baseCabinetTotal;
    }

    // 最终合并
    result.baseCabinetCost = baseCabinetTotal; // 供 UI 单独展示基础费用
    result.excessDepthFee = excessDepthFee;    // 供 UI 单独展示超深附加费
    result.depthRatio = depthRatio;            // 供保存快照
    
    // 【核心闭环】：基础费用 + 超深费用 = 最终柜体部分费用 (参与后续 baseTotal 汇算)
    result.cabinetPortionTotal = baseCabinetTotal + excessDepthFee; 
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
        const sysCalc = w / 1000;
        // 【V4.0优化】：如果有明确的人工输入值，且不等于默认初始0，优先用人工，否则用系统算出值
        calcQty = (inputQty > 0) ? Math.max(inputQty, minQty) : sysCalc; 
        // 引擎不该改写 inputQty，保留原始值
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

    // 起算量硬拦截验证 (第一层防呆)
    const minQ = parseFloat(item.minimum_quantity) || 0;
    let finalInputQty = parseFloat(upgradeModal.inputQty) || 0;
    
    // 对于按柜宽自动算，如果用户没填，让它过（引擎会用系统计算）。如果填了，必须大于最小量
    if (item.calculation_type === '按柜宽自动算') {
      if (upgradeModal.inputQty !== '' && finalInputQty < minQ) {
         finalInputQty = minQ;
         showToast(`人工数值不得低于起算量 ${minQ}，已自动修正！`, 'error');
      }
    } else if (item.calculation_type !== '按柜宽自动算' && item.calculation_type !== '人工直接输金额') {
      if (!upgradeModal.inputQty) { showToast('请输入数量或金额', 'error'); return; }
      if (finalInputQty < minQ) {
         finalInputQty = minQ;
         showToast(`数量不得低于最低起算量 ${minQ}，已自动修正！`, 'error');
         return; // 强制要求用户看到提示后再次点击
      }
    }

    const parentId = 'upg-' + Date.now();
    
    // 生成一级工艺
    const newUpgrade = {
      id: parentId, item_id: item.id, name: item.name, category: item.upgrade_category,
      unit: item.unit, 
      snap_original_unit_price: item.unit_price, 
      unit_price_adjustment: parseFloat(upgradeModal.unit_price_adjustment) || 0,
      calculation_type: item.calculation_type,
      upgrade_effect_type: item.upgrade_effect_type, replace_calculation_mode: item.replace_calculation_mode,
      input_quantity: finalInputQty,
      minimum_quantity: item.minimum_quantity,
      manual_door_area: upgradeModal.manual_door_area,
      remark: upgradeModal.inputRemark || '', // 特殊说明
      combo_type: item.combo_type,
      parent_record_id: null
    };

    let itemsToAdd = [newUpgrade];

    // 【V4.0】处理二级工艺自动带出逻辑
    if (item.combo_children && Array.isArray(item.combo_children) && item.combo_children.length > 0) {
      item.combo_children.forEach((childId, index) => {
        const childItem = upgrades.find(u => u.id === childId);
        if (childItem && childItem.status) {
          // 二级工艺默认继承一级工艺的输入量，但其自身也有最小起算量限制
          const childMin = parseFloat(childItem.minimum_quantity) || 0;
          const childInput = Math.max(finalInputQty, childMin);
          
          itemsToAdd.push({
            id: parentId + '-child-' + index, item_id: childItem.id, name: childItem.name, category: childItem.upgrade_category,
            unit: childItem.unit, snap_original_unit_price: childItem.unit_price, unit_price_adjustment: 0,
            calculation_type: childItem.calculation_type, upgrade_effect_type: childItem.upgrade_effect_type, replace_calculation_mode: childItem.replace_calculation_mode,
            input_quantity: childInput, // 继承数量
            minimum_quantity: childItem.minimum_quantity,
            manual_door_area: '', remark: '附属二级工艺自动关联', // 标识来源
            combo_type: 'single',
            parent_record_id: parentId // 核心：绑定父子关系
          });
        }
      });
      showToast(`已添加工艺及自动关联的 ${itemsToAdd.length - 1} 项二级配件`);
    } else {
      showToast(`已添加工艺: ${item.name}`);
    }

    updateActiveCabinet('upgrades', [...(activeCabinet.upgrades || []), ...itemsToAdd]);
    setUpgradeModal({ ...upgradeModal, isOpen: false, selectedItem: null, inputQty: '', inputRemark: '', unit_price_adjustment: 0, manual_door_area: '' });
  };
const handleRemoveUpgrade = (upgId) => {
    updateActiveCabinet('upgrades', (activeCabinet.upgrades || []).filter(u => u.id !== upgId));
  };

  const handleSaveDraft = async () => {
    if (!quoteInfo.customerName) { showToast('请填写客户姓名', 'error'); return; }
    if (!isValidPhone(quoteInfo.customerPhone)) { showToast('手机号码格式不正确', 'error'); return; }
    setIsLoading(true);

    try {
      const grandTotal = quoteCabinets.reduce((sum, cab) => sum + calculateCabinetDetails(cab).baseTotal, 0);

      const quotePayload = {
        quote_no: quoteInfo.quoteNo, 
        customer_name: quoteInfo.customerName,
        customer_phone: quoteInfo.customerPhone, 
        delivery_address: quoteInfo.deliveryAddress,
        status: quoteInfo.status === '编辑中' ? '已保存草稿' : quoteInfo.status,
        total_amount: grandTotal,
        updated_at: new Date().toISOString() // 【新增】：每次保存刷新修改时间
      };

      let currentQuoteId = null;
      // 标记是否是第一次保存（如果是第一次，数据库里根本没有旧的柜体/工艺需要清理，从而避免空转引发报错）
      let isExisting = false; 

      const { data: existingQuote, error: checkErr } = await supabase
        .from('quotes')
        .select('id')
        .eq('quote_no', quoteInfo.quoteNo)
        .limit(1)
        .maybeSingle();

      if (checkErr) throw checkErr;

      if (existingQuote) {
        const { error: updateErr } = await supabase
          .from('quotes')
          .update(quotePayload)
          .eq('id', existingQuote.id);
        if (updateErr) throw updateErr;
        currentQuoteId = existingQuote.id;
        isExisting = true; // 确认是更新历史记录
      } else {
        const { data: newQuote, error: insertErr } = await supabase
          .from('quotes')
          .insert([quotePayload])
          .select('id')
          .single();
        if (insertErr) throw insertErr;
        currentQuoteId = newQuote.id;
      }

      if (!currentQuoteId) throw new Error("无法获取主单据 ID");

 // 【V4.0 修复】：彻底告别 quote_id 不存在的报错，改为通过 cabinet_id 级联清理
      if (isExisting) {
        // 先查出属于这个订单的旧柜体 IDs
        const { data: oldCabs } = await supabase.from('quote_cabinets').select('id').eq('quote_id', currentQuoteId);
        if (oldCabs && oldCabs.length > 0) {
          const oldCabIds = oldCabs.map(c => c.id);
          // 依靠 cabinet_id 清理旧工艺
          const { error: upgDelErr } = await supabase.from('quote_upgrades').delete().in('cabinet_id', oldCabIds);
          if (upgDelErr) console.warn("清理旧工艺时遇到警告:", upgDelErr);
        }
        // 最后清理旧柜体
        const { error: cabDelErr } = await supabase.from('quote_cabinets').delete().eq('quote_id', currentQuoteId);
        if (cabDelErr) console.warn("清理旧柜体时遇到警告:", cabDelErr);
      }

      for (const cab of quoteCabinets) {
        const calcs = calculateCabinetDetails(cab);
        // 【V4.0 新增】：安全抓取字典快照，用于高精度展示
        const cabDict = cabinets.find(m => m.id === cab.cabinet_mat_id);
        const doorDict = doors.find(m => m.id === cab.door_mat_id);
        const { data: insertedCab, error: cabErr2 } = await supabase.from('quote_cabinets').insert([{
          quote_id: currentQuoteId, name: `${cab.space}｜${cab.cabinetType}`, 
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
          cabinet_total_price: calcs.baseTotal,
          // 【V4.0快照补充】
          snap_cabinet_material_name: cabinets.find(m => m.id === cab.cabinet_mat_id)?.name || '',
          snap_door_material_name: doors.find(m => m.id === cab.door_mat_id)?.door_type || '',
          snap_door_surface_finish: cab.snap_door_surface_finish || '', // 直接取工作台人工确认后的值
          excess_depth_fee: calcs.excessDepthFee,
          snap_standard_depth: rules.standard_depth || 600,
          snap_depth_ratio: calcs.depthRatio,
          snap_base_cabinet_cost: calcs.baseCabinetCost,
          // 【V4.0 补充核心展示快照】：
          snap_cabinet_material_name: cabDict ? cabDict.name : '',
          snap_door_material_name: doorDict ? doorDict.name : '', // 修正：读取后台门板的具体名称
          snap_door_surface_finish: doorDict ? doorDict.surface_finish : ''
        }]).select().single();
        if (cabErr2) throw cabErr2;

        if (cab.upgrades && cab.upgrades.length > 0) {
          const upgradeInserts = cab.upgrades.map(u => {
            const calculatedMatch = calcs.calculatedUpgrades.find(cu => cu.id === u.id);
           return {
              cabinet_id: insertedCab.id, upgrade_item_id: u.item_id,
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
    } catch (err) { 
      console.error("保存失败详情:", err);
      showToast('保存失败: ' + (err.message || '未知数据库错误'), 'error'); 
    } finally { 
      setIsLoading(false); 
    }
  };

const renderUpgradeModal = () => {
    if (!upgradeModal.isOpen) return null;
    const activeUpgrades = upgrades.filter(u => u.status === true);
    const categories = ['门板升级', '五金系统', '灯光系统', '木作工艺', '其他'];
    
    // 【1. 替换过滤逻辑】：叠加搜索过滤，严格限制在当前 activeCategory 下
    const filteredItems = activeUpgrades.filter(u => {
      const isCategoryMatch = (u.upgrade_category || '其他') === upgradeModal.activeCategory;
      const isSearchMatch = u.name && u.name.toLowerCase().includes(upgradeSearchQuery.toLowerCase());
      return isCategoryMatch && isSearchMatch;
    });

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl w-full max-w-5xl h-[80vh] shadow-2xl flex flex-col overflow-hidden">
          <div className="flex justify-between items-center p-6 border-b border-gray-100">
            <h2 className="text-xl font-black text-gray-900">✨ 挑选升级与工艺系统</h2>
            {/* 【2. 关闭弹窗时清空搜索框】 */}
            <button onClick={() => { setUpgradeModal({...upgradeModal, isOpen: false}); setUpgradeSearchQuery(''); }} className="w-10 h-10 bg-gray-100 rounded-full font-bold text-gray-600">✕</button>
          </div>
          <div className="flex flex-1 overflow-hidden">
            <div className="w-48 bg-gray-50 border-r border-gray-100 flex flex-col p-4 gap-2">
              {categories.map(cat => (
                /* 【3. 切换分类时清空搜索框】 */
                <button key={cat} onClick={() => { setUpgradeModal({...upgradeModal, activeCategory: cat, selectedItem: null}); setUpgradeSearchQuery(''); }}
                  className={`text-left px-4 py-3 rounded-xl font-bold text-sm ${upgradeModal.activeCategory === cat ? 'bg-black text-white' : 'text-gray-500 hover:bg-white'}`}>
                  {cat}
                </button>
              ))}
            </div>
            
            <div className="flex-1 flex overflow-hidden">
              {/* 【4. 插入搜索框并包裹列表】 */}
              <div className="flex-1 flex flex-col border-r border-gray-100 bg-white">
                <div className="p-4 border-b border-gray-50">
                   <input type="text" placeholder={`在 "${upgradeModal.activeCategory}" 中搜索工艺...`} 
                          value={upgradeSearchQuery} onChange={e => setUpgradeSearchQuery(e.target.value)} 
                          className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl text-sm font-bold focus:bg-white outline-none focus:border-black transition-colors" />
                </div>
                <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-4 content-start">
                  
                  {filteredItems.map(item => (
                  <div key={item.id} onClick={() => setUpgradeModal({...upgradeModal, selectedItem: item, inputQty: '', inputRemark: ''})}
                    className={`p-4 border-2 rounded-2xl cursor-pointer ${upgradeModal.selectedItem?.id === item.id ? 'border-black bg-gray-50' : 'border-gray-100 hover:border-gray-300'}`}>
                    <div className="flex justify-between font-bold mb-2"><span>{item.name}</span><span className="text-xs border px-1 rounded">{item.calculation_type}</span></div>
                    <div className="text-sm font-black text-rose-600">¥{item.unit_price} <span className="text-xs text-gray-400">/ {item.unit}</span></div>
                  </div>
                ))}
              </div>
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
                              <div className="space-y-2">
                                <div className="bg-blue-50 text-blue-800 p-3 rounded-xl text-xs font-bold flex justify-between items-center">
                                  <span>🤖 系统按柜宽自动计算 (默认: {activeCabinet?.width/1000})</span>
                                </div>
                                <input type="number" placeholder={`留空则系统自动算; 若调整不得低于起算量 ${upgradeModal.selectedItem.minimum_quantity||0}`} value={upgradeModal.inputQty} onChange={e=>setUpgradeModal({...upgradeModal, inputQty:e.target.value})} className="w-full border-2 border-blue-200 p-3 rounded-xl font-black text-lg bg-white" />
                              </div>
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
            <button onClick={() => setCurrentView(salesOrigin)} className="text-sm text-gray-500 hover:text-black font-bold">
              ← 返回{salesOrigin === 'home' ? '首页' : '列表'}
            </button>
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
                <div className="flex justify-between items-end mb-4 border-b pb-4">
                  <h3 className="font-black">🗄️ 柜体选配</h3>
                  <div className="text-right text-xs font-bold text-gray-500 flex items-center gap-4">
                    <span>柜体基础: ¥{currentCalcs.baseCabinetCost?.toFixed(0) || 0}</span>
                    {currentCalcs.excessDepthFee > 0 && (
                      <span>深度调整: +¥{currentCalcs.excessDepthFee.toFixed(0)}</span>
                    )}
                    <span className="text-sm text-black bg-gray-100 px-3 py-1 rounded">小计: ¥{currentCalcs.cabinetPortionTotal.toFixed(0)}</span>
                  </div>
                </div>
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
                <div className="grid grid-cols-5 gap-4 mb-4">
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-gray-500">系统门板底价 (或敞开柜)</label>
                    <div className="mt-2">
                      <label className="text-xs font-bold text-gray-500">特殊门板及客户要求备注</label>
                      <input value={activeCabinet.door_material_remark || ''} onChange={e=>updateActiveCabinet('door_material_remark', e.target.value)} placeholder="如: 特殊颜色、非标纹理等补充说明" className="w-full border-2 border-dashed border-gray-300 p-2 rounded-lg font-medium text-sm mt-1 bg-gray-50" />
                    </div>
                    <select 
                      value={activeCabinet.door_mat_id} 
                      onChange={e => {
                        const val = e.target.value;
                        const doorDict = doors.find(d => d.id === val);
                        // 【核心】：切换门板时，自动带出后台的表面工艺作为默认值，但允许人工后续修改
                        setQuoteCabinets(prev => prev.map(c => c.id === activeCabinetId ? { ...c, door_mat_id: val, snap_door_surface_finish: doorDict ? (doorDict.surface_finish || '') : '' } : c));
                      }} 
                      className="w-full border-2 p-2 rounded-lg font-bold mt-1"
                    >
                      <option value="">-- 无门板敞开柜 --</option>
                      {doors.map(d => <option key={d.id} value={d.id}>{d.name} (¥{d.base_price})</option>)}
                    </select>
                  </div>
                  <div><label className="text-xs font-bold text-blue-600">表面工艺(可改)</label><input value={activeCabinet.snap_door_surface_finish} onChange={e=>updateActiveCabinet('snap_door_surface_finish', e.target.value)} placeholder="如:肤感膜" className="w-full border-2 border-blue-100 p-2 rounded-lg font-bold mt-1 bg-blue-50 focus:bg-white" /></div>
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
                      // 【V4.0 容错修复】：如果尺寸被清空导致引擎短路，给一个默认空对象兜底防崩溃
                      const calced = currentCalcs.calculatedUpgrades.find(u => u.id === upg.id) || {
                        calculatedQty: 0, finalAmount: 0, snap_base_door_price: 0
                      };
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

// ==========================================
  // 【V4.0 优化】：只读内部报价预览页 (高密度/空间分组聚合 UI)
  // ==========================================
  const renderQuotePreview = () => {
    if (!previewData) return null;
    const { quote, cabinets, upgrades } = previewData;

    // 【核心逻辑】：按空间名称分组
    const groupedCabinets = cabinets.reduce((groups, cab) => {
      let spaceName = '未分类空间';
      if (cab.name && cab.name.includes('｜')) {
        spaceName = cab.name.split('｜')[0].trim();
      }
      if (!groups[spaceName]) groups[spaceName] = [];
      groups[spaceName].push(cab);
      return groups;
    }, {});

    return (
      <div className="min-h-screen bg-gray-50 font-sans flex flex-col pb-20">
        <div className="bg-white h-16 border-b border-gray-200 flex items-center justify-between px-6 shadow-sm sticky top-0 z-10">
          <button onClick={() => setCurrentView('sales-history')} className="text-sm font-bold text-gray-500 hover:text-black transition-colors">← 返回历史列表</button>
          <div className="font-black text-xl">NOEY<span className="font-light">QUOTATION</span><span className="text-xs ml-2 bg-rose-100 text-rose-700 px-2 py-1 rounded">客户报价单</span></div>
          <div className="w-24"></div>
        </div>

        <div className="max-w-5xl mx-auto mt-8 w-full px-6 space-y-8">
          
          {/* 主单信息压缩展示 */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-black text-gray-900">{quote.customer_name || '未命名客户'}</h2>
              <div className="text-gray-500 font-bold mt-1 text-xs">📞 {quote.customer_phone || '未留电话'} | 📍 {quote.delivery_address || '未留地址'}</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-gray-400 font-bold text-sm">{quote.quote_no}</div>
              <div className="text-[10px] text-gray-400 mt-1 font-bold">报价日期: {new Date(quote.updated_at || quote.created_at).toLocaleDateString('zh-CN')}</div>
            </div>
          </div>

          {/* 按空间循环渲染 */}
          {Object.entries(groupedCabinets).map(([space, spaceCabinets]) => (
            <div key={space} className="mb-8">
              <h3 className="text-xl font-black text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-2 h-6 bg-black rounded-full inline-block"></span>{space}
                <span className="text-xs font-bold text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">{spaceCabinets.length} 组</span>
              </h3>
              
              <div className="space-y-4">
                {spaceCabinets.map(cab => {
                  const cabUpgrades = upgrades.filter(u => u.cabinet_id === cab.id);
                  const excessDepthFee = Number(cab.excess_depth_fee || 0);
                  const cabUnitPrice = Number(cab.snap_final_cabinet_price || 0);
                  const doorUnitPrice = Number(cab.snap_final_door_price || 0);
                  
                  // 【V4.0规则】：无门板判断
                  const hasNoDoor = !cab.door_mat_id || doorUnitPrice === 0 || (cab.snap_door_brand || '').includes('无门板');
                  
                  // 数量面积推导逻辑
                  const w = parseFloat(cab.width) || 0;
                  const h = parseFloat(cab.height) || 0;
                  const isArea = h > (rules.height_threshold || 1000);
                  const displayQty = isArea ? Math.max((w * h) / 1000000, rules.minimum_area || 1) : Math.max(w / 1000, (rules.minimum_width || 1000) / 1000);
                  const unitLabel = isArea ? '㎡' : 'm';

                  // 商业总价与综合单价安全闭环计算
                  const upgradesTotal = cabUpgrades.reduce((sum, upg) => sum + Number(upg.snap_upgrade_price || 0), 0);
                  const openCabinetSalesPrice = cab.snap_base_cabinet_cost ? Number(cab.snap_base_cabinet_cost) : Math.max(0, Number(cab.cabinet_total_price || 0) - excessDepthFee - upgradesTotal);
                  const comprehensiveTotalAmount = hasNoDoor ? openCabinetSalesPrice : ((cabUnitPrice + doorUnitPrice) * displayQty);
                  const comprehensiveUnitPrice = displayQty > 0 ? (comprehensiveTotalAmount / displayQty) : 0;

                  // 【历史兼容Fallback取值逻辑】
                  const dispCabType = cab.snap_cabinet_material_name || cab.cabinet_material_remark || '系统柜体';
                  const dispDoorType = cab.snap_door_material_name || (cab.snap_door_brand && !cab.snap_door_brand.includes('系统') ? cab.snap_door_brand : '定制门板');

                  return (
                    <div key={cab.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:border-gray-300 transition-colors">
                      {/* 头部信息条：极高密度 */}
                      <div className="bg-gray-50 border-b border-gray-100 px-5 py-3 flex justify-between items-center">
                        <div className="font-black text-gray-800 text-base">{cab.name.split('｜')[1] || cab.name}</div>
                        <div className="text-xs font-mono text-gray-500 font-bold">W {cab.width} × H {cab.height} × D {cab.depth}</div>
                      </div>

                      <div className="p-5 flex flex-col md:flex-row gap-6">
                        {/* 左侧：材料参数区 (紧凑排布) */}
                        <div className="flex-1 space-y-4">
                          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs">
                            <div className="col-span-2 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b pb-1 mb-1">柜体配置</div>
                            <div className="flex justify-between"><span className="text-gray-400">材料类型</span><span className="font-bold text-gray-800">{dispCabType}</span></div>
                            <div className="flex justify-between"><span className="text-gray-400">指定品牌</span><span className="font-bold text-gray-800">{cab.snap_cabinet_brand || '-'}</span></div>
                            <div className="flex justify-between"><span className="text-gray-400">柜体颜色</span><span className="font-bold text-gray-800">{cab.snap_cabinet_color || '-'}</span></div>
                            <div className="flex justify-between"><span className="text-gray-400">规格参数</span><span className="font-bold text-gray-800">{cab.cabinet_thickness || 18}mm / {cab.snap_back_panel_spec || '-'}</span></div>
                            {cab.cabinet_material_remark && <div className="mt-2 pt-2 border-t border-dashed border-gray-200 text-gray-500 bg-gray-50 p-2 rounded"><span className="font-bold">柜体备注:</span> {cab.cabinet_material_remark}</div>}

                            <div className="col-span-2 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b pb-1 mt-2 mb-1">门板配置</div>
                            {hasNoDoor ? (
                               <div className="col-span-2 text-center text-gray-400 font-bold py-1 bg-gray-50 rounded">开放式柜体 (无门板)</div>
                            ) : (
                              <>
                                <div className="flex justify-between"><span className="text-gray-400">材料类型</span><span className="font-bold text-gray-800">{dispDoorType}</span></div>
                                <div className="flex justify-between"><span className="text-gray-400">指定品牌</span><span className="font-bold text-gray-800">{cab.snap_door_brand || '-'}</span></div>
                                <div className="flex justify-between"><span className="text-gray-400">门板颜色</span><span className="font-bold text-gray-800">{cab.snap_door_color || '-'}</span></div>
                                <div className="flex justify-between"><span className="text-gray-400">表面工艺</span><span className="font-bold text-gray-800">{cab.snap_door_surface_finish || '-'}</span></div>
                                {cab.door_material_remark && <div className="mt-2 pt-2 border-t border-dashed border-gray-200 text-gray-500 bg-gray-50 p-2 rounded"><span className="font-bold">门板备注:</span> {cab.door_material_remark}</div>}
                              </>
                            )}
                          </div>
                          
                          {/* 超深提示融入材料区下方 */}
                          {excessDepthFee > 0 && (
                            <div className="bg-amber-50 rounded border border-amber-100 px-3 py-1.5 flex justify-between items-center text-xs">
                              <span className="font-bold text-amber-700">超出标准深度 ({cab.depth}mm)</span>
                              <span className="font-black text-amber-600">+ ¥{excessDepthFee.toFixed(2)}</span>
                            </div>
                          )}
                        </div>

                        {/* 右侧：金额核算区 (醒目紧凑) */}
                        <div className="w-full md:w-56 bg-gray-50 rounded-xl p-4 flex flex-col justify-center border border-gray-100 shrink-0">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-gray-500">综合单价</span>
                            <span className="font-black text-gray-800">¥{comprehensiveUnitPrice.toFixed(2)}<span className="text-[10px] text-gray-400 font-normal"> /{unitLabel}</span></span>
                          </div>
                          <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200">
                            <span className="text-xs font-bold text-gray-500">计价数量</span>
                            <span className="font-black text-gray-800">{displayQty.toFixed(2)}<span className="text-[10px] text-gray-400 font-normal"> {unitLabel}</span></span>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-bold text-gray-400 mb-1">柜体含门金额</div>
                            <div className="text-2xl font-black text-blue-600">¥{comprehensiveTotalAmount.toFixed(2)}</div>
                          </div>
                        </div>
                      </div>

                      {/* 底部：工艺升级列表区 (支持父子层级与备注) */}
                      {cabUpgrades.length > 0 && (
                        <div className="mt-6 pt-4 border-t border-dashed border-gray-200 px-5 pb-5">
                          <div className="text-[10px] font-black text-gray-400 mb-4 uppercase tracking-widest">局部工艺与五金升级明细</div>
                          <div className="bg-gray-50/50 rounded-xl overflow-hidden border border-gray-100">
                            <table className="w-full text-left text-sm">
                              <thead className="bg-gray-100/50 text-xs text-gray-500 border-b border-gray-100">
                                <tr>
                                  <th className="py-3 px-4 font-bold">工艺名称</th>
                                  <th className="py-3 px-4 font-bold text-center">计价数量</th>
                                  <th className="py-3 px-4 font-bold text-right">单价</th>
                                  <th className="py-3 px-4 font-bold text-right">小计</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                {cabUpgrades.map(upg => {
                                  // 视觉缩进判断 (是否为二级子工艺)
                                  const isChild = !!upg.parent_record_id;
                                  return (
                                    <tr key={upg.id} className={isChild ? "bg-gray-50/30" : ""}>
                                      <td className={`py-3 px-4 text-gray-800 flex flex-col ${isChild ? "pl-8 border-l-2 border-gray-200" : ""}`}>
                                        <span className="font-bold">{isChild ? '↳ ' : ''}{upg.snap_upgrade_name}</span>
                                        {upg.remark && <span className="text-[10px] text-gray-500 mt-0.5 max-w-[200px] truncate" title={upg.remark}>说明: {upg.remark}</span>}
                                      </td>
                                      <td className="py-3 px-4 text-gray-600 text-center text-xs">
                                        {upg.quantity} <span className="text-[10px] text-gray-400">{upg.unit || ''}</span>
                                      </td>
                                      <td className="py-3 px-4 text-gray-500 text-right text-xs">¥{Number(upg.snap_final_unit_price || upg.snap_unit_price || 0).toFixed(2)}</td>
                                      <td className="py-3 px-4 font-black text-gray-800 text-right">¥{Number(upg.snap_upgrade_price || 0).toFixed(2)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* 全案总计 */}
          <div className="bg-black text-white p-6 rounded-2xl flex justify-between items-center shadow-xl mt-8 mb-12">
            <span className="font-bold text-lg text-gray-300 tracking-widest uppercase">Total Amount</span>
            <span className="text-4xl font-black tracking-tighter">¥{Number(quote.total_amount || 0).toFixed(2)}</span>
          </div>
        </div>
      </div>
    );
  };
// ==========================================
  // 【Phase 2 新增】：渲染历史报价列表界面 (卡片式布局)
  // 插入位置：在 renderAdmin() 之前
  // ==========================================
  const renderSalesHistory = () => {
    // 搜索过滤逻辑
    const filteredHistory = historyList.filter(q => {
      if (!searchQuery) return true;
      const lowerQuery = searchQuery.toLowerCase();
      return (
        (q.customer_name && q.customer_name.toLowerCase().includes(lowerQuery)) ||
        (q.customer_phone && q.customer_phone.includes(lowerQuery)) ||
        (q.quote_no && q.quote_no.toLowerCase().includes(lowerQuery))
      );
    });

    return (
      <div className="min-h-screen bg-gray-50 font-sans flex flex-col pb-20">
        {/* 顶部导航 */}
        <div className="bg-white h-16 border-b border-gray-200 flex items-center justify-between px-6 shadow-sm shrink-0">
          <button onClick={() => setCurrentView('home')} className="text-sm font-bold text-gray-500 hover:text-black transition-colors">← 返回首页</button>
          <div className="font-black text-xl">NOEY<span className="font-light">QUOTATION</span><span className="text-xs ml-2 bg-gray-100 px-2 py-1 rounded text-gray-500">Quote Archive</span></div>
          <div className="w-16"></div>
        </div>

        {/* 搜索与控制区 */}
        <div className="max-w-6xl w-full mx-auto mt-8 px-6">
          <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 mb-8 flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1 w-full flex items-center gap-3 bg-gray-50 px-5 py-3 rounded-2xl border border-transparent focus-within:border-black transition-colors">
              <span className="text-xl">🔍</span>
              <input 
                type="text" 
                placeholder="输入客户姓名 / 手机号 / 报价单号搜索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent w-full font-bold outline-none text-gray-700 placeholder-gray-400"
              />
            </div>
          </div>

          {/* 卡片列表区 */}
          {filteredHistory.length === 0 ? (
            <div className="text-center py-20 text-gray-400 font-bold border-2 border-dashed border-gray-200 rounded-3xl">
              {isLoading ? '加载中...' : '没有找到匹配的报价记录'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredHistory.map(quote => (
                <div key={quote.id} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between group">
                  <div>
                    {/* 卡片头部 */}
                    <div className="flex justify-between items-start mb-4 border-b border-gray-50 pb-4">
                      <div>
                        <div className="text-xs text-gray-400 font-mono mb-1">{quote.quote_no}</div>
                        <div className="font-black text-lg text-gray-900">
                          {quote.customer_name || '未填姓名'} 
                          <span className="text-sm text-gray-500 font-bold ml-2">{quote.customer_phone || ''}</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-full shrink-0">
                        {quote.status}
                      </span>
                    </div>
                    
                    {/* 基础信息 */}
                    <div className="space-y-2 mb-6">
                      <div className="text-sm flex items-start gap-2">
                        <span className="text-gray-300 shrink-0">📍</span>
                        <span className="text-gray-500 font-medium line-clamp-2 leading-tight">{quote.delivery_address || '未填写地址'}</span>
                      </div>
                     <div className="text-sm flex items-center gap-2">
                       <span className="text-gray-300 shrink-0">🕒</span>
                       <span className="text-gray-400 font-mono text-[10px]">
                        修改: {new Date(quote.updated_at || quote.created_at).toLocaleString('zh-CN', { hour12: false })}
                       </span>
                    </div>
                    </div>
                  </div>

                  {/* 价格与操作区 */}
                  <div>
                    <div className="flex justify-between items-end mb-5">
                      <div className="text-xs font-bold text-gray-400">金额总计</div>
                      <div className="text-2xl font-black text-rose-600">¥{quote.total_amount ? parseFloat(quote.total_amount).toFixed(0) : '0'}</div>
                    </div>
                    
              <div className="flex gap-2">
  <button 
    onClick={() => handleLoadQuoteForEditing(quote)}
    className="flex-1 bg-black text-white py-2.5 rounded-xl font-bold text-xs hover:bg-gray-800 transition-colors"
  >
    ✏️ 编辑
  </button>
  <button 
    onClick={() => handlePreviewQuote(quote)}
    className="flex-1 bg-white text-gray-700 py-2.5 rounded-xl font-bold text-xs border-2 border-gray-100 hover:border-gray-300 hover:bg-gray-50 transition-colors"
  >
    👀 查看
  </button>
  <button 
    onClick={() => handleDeleteQuote(quote.id)}
    className="px-3 bg-rose-50 text-rose-600 py-2.5 rounded-xl font-bold text-xs border border-rose-100 hover:bg-rose-100 transition-colors"
  >
    🗑️
  </button>
</div>
                  </div>
                </div>
              ))}
            </div>
          )}
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
          <div className="p-6 border-b border-gray-800"><h1 className="text-2xl font-black">NOEY<span className="font-light text-gray-400"> System Hub</span></h1></div>
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
                  <div className="col-span-2"><label className="text-xs font-bold text-gray-500">分类</label><select value={upgradeForm.upgrade_category} onChange={e=>setUpgradeForm({...upgradeForm, upgrade_category:e.target.value})} className="w-full border-2 p-2 rounded-lg mt-1 font-bold"><option>门板升级</option><option>五金系统</option><option>灯光系统</option><option>木作工艺</option><option>其他</option></select></div>
                </div>
                <div className="grid grid-cols-4 gap-4 mb-4 bg-gray-50 p-4 rounded-lg">
                  <div><label className="text-xs font-bold text-blue-700">提取图纸计价法</label><select value={upgradeForm.calculation_type} onChange={e=>setUpgradeForm({...upgradeForm, calculation_type:e.target.value})} className="w-full border-2 border-blue-200 p-2 rounded-lg font-bold text-blue-900 mt-1"><option>按面积㎡</option><option>按延米</option><option>按个</option><option>按套</option><option>按扇</option><option>按组</option><option>按柜宽自动算</option><option>超额抽屉规则</option><option>人工直接输金额</option></select></div>
                  <div><label className="text-xs font-bold text-gray-500">计价单位</label><input required placeholder="如: ㎡/个/套/m" value={upgradeForm.unit} onChange={e=>setUpgradeForm({...upgradeForm, unit:e.target.value})} className="w-full border-2 p-2 rounded-lg font-bold mt-1" /></div>
                  <div><label className="text-xs font-bold text-gray-500">系统原价 (元)</label><input type="number" required value={upgradeForm.unit_price} onChange={e=>setUpgradeForm({...upgradeForm, unit_price:e.target.value})} className="w-full border-2 p-2 rounded-lg font-black mt-1" /></div>
                  <div>
                    <label className="text-xs font-bold text-amber-700">价格影响逻辑引擎</label>
                    <select value={upgradeForm.upgrade_effect_type} onChange={e=>setUpgradeForm({...upgradeForm, upgrade_effect_type:e.target.value})} className="w-full border-2 border-amber-200 p-2 rounded-lg font-bold text-amber-900 mt-1">
                      <option value="add_cost">追加费用</option><option value="replace">替换(需处理底价)</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-gray-500">二级工艺关联管理</label>
                    <select multiple value={upgradeForm.combo_children || []} onChange={e => {
                        const selected = Array.from(e.target.selectedOptions, option => option.value);
                        setUpgradeForm({...upgradeForm, combo_children: selected, combo_type: selected.length > 0 ? 'bundle' : 'single'});
                      }} 
                      className="w-full border-2 p-2 rounded-lg font-bold mt-1 h-24 text-sm"
                    >
                      {/* 列出所有其他工艺供多选 */}
                      {upgrades.filter(u => u.id !== upgradeForm.id).map(u => (
                        <option key={u.id} value={u.id}>{u.name} (¥{u.unit_price})</option>
                      ))}
                    </select>
                    <div className="text-[10px] text-gray-400 mt-1">按住 Ctrl/Cmd 多选。开单时将自动关联计价。</div>
                  </div>
                  <div><label className="text-xs font-bold text-gray-500">特殊工艺备注提示</label><input value={upgradeForm.description || ''} onChange={e=>setUpgradeForm({...upgradeForm, description:e.target.value})} className="w-full border-2 p-2 rounded-lg font-bold mt-1" /></div>
                  <div><label className="text-xs font-bold text-rose-600">限制：最低起算量</label><input type="number" step="0.01" value={upgradeForm.minimum_quantity} onChange={e=>setUpgradeForm({...upgradeForm, minimum_quantity:e.target.value})} className="w-full border-2 border-rose-200 p-2 rounded-lg font-black text-rose-700 mt-1 bg-rose-50" /></div>
                </div>
                <div className="flex justify-end gap-4 items-center pt-2 border-t border-gray-100">
                  {editId && (
                    <button type="button" onClick={() => {
                        setEditId(null);
                        setUpgradeForm({ name: '', upgrade_category: '门板升级', calculation_type: '按面积㎡', upgrade_effect_type: 'add_cost', replace_calculation_mode: 'full_price', unit: '㎡', unit_price: '', sort_order: 0, status: true, description: '', combo_type: 'single', minimum_quantity: 0, combo_children: [] });
                      }} className="bg-gray-100 text-gray-600 px-6 py-2 rounded-lg font-bold hover:bg-gray-200">
                      取消并返回新增
                    </button>
                  )}
                  <button type="submit" className="bg-black text-white px-8 py-2 rounded-lg font-bold shadow-lg hover:shadow-xl">{editId ? '保存当前修改' : '确认新增工艺'}</button>
                </div>
              </form>
              {/* 【新增】：工艺列表顶部搜索框 */}
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mt-6 mb-6">
                <div className="flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100 focus-within:border-black transition-colors">
                  <span className="text-lg">🔍</span>
                  <input 
                    type="text" 
                    placeholder="搜索工艺名称或分类 (如: 抽屉 / 门板)..." 
                    value={adminUpgradeSearch} 
                    onChange={e => setAdminUpgradeSearch(e.target.value)} 
                    className="w-full bg-transparent outline-none font-bold text-gray-700 placeholder-gray-400" 
                  />
                </div>
              </div>

              {/* 【新增】：动态分类区块渲染逻辑 */}
              {(() => {
                // 1. 根据搜索框过滤全局数据
                const searchLower = adminUpgradeSearch.toLowerCase();
                const filteredAdminUpgrades = upgrades.filter(u => {
                  if (!searchLower) return true;
                  const matchName = u.name?.toLowerCase().includes(searchLower);
                  const matchCat = u.upgrade_category?.toLowerCase().includes(searchLower);
                  return matchName || matchCat;
                });

                // 2. 动态提取存在的分类，并保持优雅的默认排序
                const predefinedOrder = ['门板升级', '五金系统', '灯光系统', '木作工艺', '其他'];
                const dynamicCats = Array.from(new Set(filteredAdminUpgrades.map(u => u.upgrade_category || '其他')));
                const displayCategories = predefinedOrder.filter(c => dynamicCats.includes(c)).concat(dynamicCats.filter(c => !predefinedOrder.includes(c)));

                // 3. 循环渲染分类区块
                return displayCategories.map(cat => {
                  const catItems = filteredAdminUpgrades.filter(u => (u.upgrade_category || '其他') === cat);
                  if (catItems.length === 0) return null; // 隐藏无数据的分类

                  return (
                    <div key={cat} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
                      <div className="bg-gray-50 border-b border-gray-200 p-4 flex justify-between items-center">
                        <h3 className="font-black text-gray-800 text-lg">{cat} <span className="text-gray-400 text-sm font-bold ml-2">({catItems.length}项)</span></h3>
                      </div>
                      <table className="w-full text-left text-sm">
                      <thead className="bg-white text-xs text-gray-400 border-b">
                          <tr>
                            <th className="p-4 font-bold w-16">序号</th>
                            <th className="p-4 font-bold w-1/3">名称</th>
                            <th className="p-4 font-bold">单价</th>
                            <th className="p-4 font-bold">逻辑</th>
                            <th className="p-4 font-bold">操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {catItems.map((u, index) => (
                            <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                              <td className="p-4 font-mono text-gray-400 font-bold">{String(index + 1).padStart(2, '0')}</td>
                              <td className="p-4 font-black text-gray-800">{u.name}</td>
                              <td className="p-4 font-black text-rose-600">¥{u.unit_price}</td>
                              <td className="p-4"><span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-bold">{u.upgrade_effect_type}</span></td>
                              <td className="p-4 flex gap-4 font-bold">
                                <button onClick={() => {setEditId(u.id); setUpgradeForm(u);}} className="text-blue-600 hover:text-blue-800">编辑</button>
                                <button onClick={() => handleToggleUpgradeStatus(u)} className={u.status ? 'text-amber-500 hover:text-amber-700' : 'text-emerald-500 hover:text-emerald-700'}>{u.status ? '停用' : '启用'}</button>
                                <button onClick={() => triggerDelete('upgrade_items', u.id, u.name)} className="text-rose-600 hover:text-rose-800">删除</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                });
              })()}
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
                <table className="w-full text-left text-sm font-bold"><thead className="bg-gray-50 text-xs text-gray-500 border-b">
                    <tr><th className="p-3 w-16">序号</th><th className="p-3">材料名称</th><th className="p-3">基准价</th><th className="p-3">浅柜价</th><th className="p-3">操作</th></tr>
                  </thead>
                  <tbody>
                    {cabinets.map((c, index) => (
                      <tr key={c.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-mono text-gray-400">{String(index + 1).padStart(2, '0')}</td>
                        <td className="p-3 text-gray-800">{c.name}</td><td className="p-3 text-rose-600">¥{c.base_price}</td><td className="p-3">¥{c.shallow_price}</td>
                        <td className="p-3"><button onClick={() => {setEditId(c.id); setCabinetForm(c);}} className="text-blue-600 mr-4">编辑</button><button onClick={() => triggerDelete('materials_cabinet', c.id, c.name)} className="text-rose-600">删除</button></td>
                      </tr>
                    ))}
                  </tbody>                
                </table>
              </div>
            </div>
          )}
                {/* Door Admin View */}
          {adminView === 'door' && (
            <div className="max-w-4xl space-y-6">
              <h2 className="text-2xl font-black">门板基础材料</h2>
                <form onSubmit={handleSaveDoor} className="bg-white p-6 rounded-xl shadow-sm flex gap-4 items-end">
                <div className="flex-1"><label className="text-xs font-bold text-gray-500">门板库名称</label><input required value={doorForm.name} onChange={e=>setDoorForm({...doorForm, name:e.target.value})} className="w-full border-2 p-2 rounded-lg font-bold" /></div>
                <div>
                  <label className="text-xs font-bold text-gray-500">门板分类</label>
                  <select value={doorForm.door_type} onChange={e=>setDoorForm({...doorForm, door_type:e.target.value})} className="w-full border-2 p-2 rounded-lg font-bold">
                    <option>双饰面</option><option>吸塑</option><option>PET</option><option>烤漆</option><option>实木</option><option>玻璃框</option><option>铝蜂窝</option>
                  </select>
                </div>
                <div className="flex-1"><label className="text-xs font-bold text-gray-500">系统默认表面工艺</label><input value={doorForm.surface_finish || ''} onChange={e=>setDoorForm({...doorForm, surface_finish:e.target.value})} placeholder="例如: 亮光/肤感" className="w-full border-2 p-2 rounded-lg font-bold" /></div>
                <div><label className="text-xs font-bold text-gray-500">基准价</label><input type="number" required value={doorForm.base_price} onChange={e=>setDoorForm({...doorForm, base_price:e.target.value})} className="w-full border-2 p-2 rounded-lg font-black w-24" /></div>
                <button type="submit" className="bg-black text-white px-6 py-2 rounded-lg font-bold h-[42px]">{editId ? '保存' : '新增'}</button>
              </form>
              <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <table className="w-full text-left text-sm font-bold">
                  <thead className="bg-gray-50 text-xs text-gray-500 border-b">
                    <tr><th className="p-3 w-16">序号</th><th className="p-3">材料名称</th><th className="p-3">门板分类</th><th className="p-3">默认表面工艺</th><th className="p-3">价格</th><th className="p-3">操作</th></tr>
                  </thead>
                  <tbody>
                    {doors.map((d, index) => (
                      <tr key={d.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-mono text-gray-400">{String(index + 1).padStart(2, '0')}</td>
                        <td className="p-3 text-gray-800">{d.name}</td><td className="p-3 text-gray-500">{d.door_type}</td><td className="p-3 text-gray-500">{d.surface_finish || '-'}</td>
                        <td className="p-3 text-rose-600">¥{d.base_price}</td>
                        <td className="p-3"><button onClick={() => {setEditId(d.id); setDoorForm(d);}} className="text-blue-600 mr-4">编辑</button><button onClick={() => triggerDelete('materials_door', d.id, d.name)} className="text-rose-600">删除</button></td>
                      </tr>
                    ))}
                  </tbody>
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
                <div className="flex items-center gap-2 mt-4 p-4 bg-gray-50 rounded-lg border">
                   <input type="checkbox" checked={rules.depth_overage_enabled} onChange={e=>setRules({...rules, depth_overage_enabled:e.target.checked})} className="w-5 h-5 accent-black" />
                   <label className="text-sm font-bold text-gray-800">启用超深自动加价逻辑 (按深度比例计算)</label>
                 </div>
                 <div>
                   <label className="block text-sm text-gray-500 mb-1 mt-4">超深计算模式 (未来预留)</label>
                   <select disabled value={rules.depth_calculation_mode} className="w-full border-2 p-2 rounded-lg bg-gray-100 text-gray-400 font-bold">
                     <option value="ratio">按深度比例计算 (Ratio)</option>
                   </select>
                 </div>
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
        <h2 className="text-2xl font-black mb-8 text-center">NOEY<span className="font-light"> System Hub</span></h2>
        <input type="text" placeholder="账号 (admin)" value={adminLoginForm.username} onChange={e=>setAdminLoginForm({...adminLoginForm, username:e.target.value})} className="w-full border-2 p-3 rounded-xl mb-4 font-bold" />
        <input type="password" placeholder="密码 (admin123)" value={adminLoginForm.password} onChange={e=>setAdminLoginForm({...adminLoginForm, password:e.target.value})} className="w-full border-2 p-3 rounded-xl mb-6 font-bold" />
        <button onClick={handleAdminLogin} className="w-full bg-black text-white p-3 rounded-xl font-bold">登录控制台</button>
        <button onClick={() => setCurrentView('home')} className="w-full mt-4 text-sm font-bold text-gray-400 hover:text-black">← 返回</button>
      </div>
    </div>
  );

  if (currentView === 'quote-preview') return renderQuotePreview();
  if (currentView === 'sales-history') return renderSalesHistory();
  if (currentView === 'sales') return renderSalesWorkspace();
  if (currentView === 'admin-login') return renderAdminLogin();
  if (currentView === 'admin') return renderAdmin();

// ==========================================
  // 【V4.0 品牌升级】：系统主页 (Logo + Footer)
  // ==========================================
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-between font-sans pt-24">
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-6xl px-6">
        <div className="text-center mb-16 flex flex-col items-center">
          {/* 使用官方 Logo，限制最大高度避免突兀 */}
          <img src="/LOGO英版.png" alt="NOEY Furniture" className="h-16 md:h-20 object-contain mb-6" />
          <p className="text-gray-400 font-bold uppercase tracking-[0.2em] text-xs">Custom Furniture Quotation System</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
          <button onClick={enterSalesWorkspace} className="bg-white p-10 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] hover:shadow-xl border border-gray-100 hover:border-gray-300 text-left group transition-all duration-300 rounded-xl">
            <div className="text-2xl mb-6 opacity-70 group-hover:opacity-100 transition-opacity">💻</div>
            <h2 className="text-lg font-black text-gray-900 mb-2 tracking-wide">Quote Studio</h2>
            <p className="text-gray-500 font-medium text-xs leading-relaxed">建立订单、配置方案、选择材料工艺，实时生成精准报价。</p>
          </button>

          <button onClick={() => setCurrentView('sales-history')} className="bg-white p-10 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] hover:shadow-xl border border-gray-100 hover:border-gray-300 text-left group transition-all duration-300 rounded-xl">
            <div className="text-2xl mb-6 opacity-70 group-hover:opacity-100 transition-opacity">📂</div>
            <h2 className="text-lg font-black text-gray-900 mb-2 tracking-wide">Quote Archive</h2>
            <p className="text-gray-500 font-medium text-xs leading-relaxed">管理历史报价档案，支持编辑或预览正式客户报价单。</p>
          </button>
    
          <button onClick={() => setCurrentView('admin-login')} className="bg-white p-10 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] hover:shadow-xl border border-gray-100 hover:border-gray-300 text-left group transition-all duration-300 rounded-xl">
            <div className="text-2xl mb-6 opacity-70 group-hover:opacity-100 transition-opacity">⚙️</div>
            <h2 className="text-lg font-black text-gray-900 mb-2 tracking-wide">System Hub</h2>
            <p className="text-gray-500 font-medium text-xs leading-relaxed">管理后台：维护材料字典、配置参数规则及基础业务数据。</p>
          </button>
        </div>
      </div>

      {/* 极简商务 Footer */}
      <div className="w-full text-center py-8 mt-12 border-t border-gray-200 bg-gray-50">
        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em] mb-1">NOEY Custom Furniture System</div>
        <div className="text-[10px] font-medium text-gray-400">Designed for NOEY Furniture © 2026. All Rights Reserved.</div>
      </div>

      {toast.show && <div className="fixed top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-8 py-3 text-sm font-bold shadow-2xl z-50 rounded animate-fade-in-down">{toast.message}</div>}
    </div>
  );
}
