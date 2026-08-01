import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// 专属配置：自动清理 URL，确保连接无误
const rawSupabaseUrl = 'https://muwzdigtehcperweliyg.supabase.co/rest/v1/'; 
const supabaseKey = 'sb_publishable_SGHvdmqpvo3Z6GekTtk4cA_PcvbDGpd';
const supabaseUrl = rawSupabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabase = createClient(supabaseUrl, supabaseKey);

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [currentView, setCurrentView] = useState('upgrade'); // 默认进升级项目库方便测试
  const [isLoading, setIsLoading] = useState(false);

  const [cabinets, setCabinets] = useState([]);
  const [doors, setDoors] = useState([]);
  const [upgrades, setUpgrades] = useState([]);
  const [rules, setRules] = useState({
    id: null, standard_depth: 600, shallow_depth: 295, height_threshold: 1000, minimum_area: 1, minimum_width: 1000
  });

  const [editId, setEditId] = useState(null); 
  const [cabinetForm, setCabinetForm] = useState({ name: '', base_price: '', shallow_price: '', no_door_factor: '' });
  const [doorForm, setDoorForm] = useState({ name: '', door_type: '普通门板', base_price: '' });
  
  // V2.3 升级项目表单结构
  const [upgradeForm, setUpgradeForm] = useState({
    name: '', upgrade_category: '门板升级', calculation_type: '按面积㎡', 
    upgrade_effect_type: 'add_cost', replace_calculation_mode: 'full_price',
    unit: '㎡', unit_price: '', sort_order: 0, status: true,
    description: '', image_url: '', is_standard_item: false, allow_manual_edit: true
  });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // DEBUG: 增加错误拦截和日志，确保查询出错能被捕获
      const resCab = await supabase.from('materials_cabinet').select('*').order('name');
      if (resCab.error) throw resCab.error;
      
      const resDoor = await supabase.from('materials_door').select('*').order('name');
      if (resDoor.error) throw resDoor.error;
      
      // 修复致命错误：移除了 created_at 排序，因为表中没有这个字段，会导致查询静默失败
      const resUpg = await supabase.from('upgrade_items').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true });
      if (resUpg.error) throw resUpg.error;
      console.log('📦 [DEBUG] Fetch Upgrades Result:', resUpg.data); // 业务排查日志

      const resRule = await supabase.from('pricing_rules').select('*').limit(1);
      if (resRule.error) throw resRule.error;

      if (resCab.data) setCabinets(resCab.data);
      if (resDoor.data) setDoors(resDoor.data);
      if (resUpg.data) setUpgrades(resUpg.data);
      
      // 规则表处理
      if (resRule.data && resRule.data.length > 0) {
        setRules(resRule.data[0]);
      } else {
        const defaultRules = { standard_depth: 600, shallow_depth: 295, height_threshold: 1000, minimum_area: 1, minimum_width: 1000 };
        const newRule = await supabase.from('pricing_rules').insert([defaultRules]).select();
        if (newRule.data) setRules(newRule.data[0]);
      }
    } catch (error) {
      console.error("Fetch Data Error:", error);
      showToast('数据同步异常: ' + (error.message || JSON.stringify(error)), 'error');
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
      const { data: empCheck, error: empError } = await supabase.from('employees').select('id').limit(1);
      if (empError) throw empError;

      if (!empCheck || empCheck.length === 0) {
        if (loginForm.username === 'admin' && loginForm.password === 'admin123') {
          await supabase.from('employees').insert([{ username: 'admin', password: 'admin123', name: '超级系统管理员', role: 'admin' }]);
          showToast('✅ 初始管理员账号已自动创建！');
        }
      }

      const { data, error } = await supabase.from('employees')
        .select('*').eq('username', loginForm.username).eq('password', loginForm.password).single();

      if (error || !data) throw new Error('账号或密码错误');
      if (!data.status) throw new Error('账号已被停用');

      setCurrentUser(data);
      showToast(`欢迎回来, ${data.name}`);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveCabinet = async (e) => {
    e.preventDefault();
    try {
      const payload = { name: cabinetForm.name, base_price: parseFloat(cabinetForm.base_price), shallow_price: parseFloat(cabinetForm.shallow_price), no_door_factor: parseFloat(cabinetForm.no_door_factor) };
      if (editId) { 
        const { error } = await supabase.from('materials_cabinet').update(payload).eq('id', editId); 
        if (error) throw error;
        showToast('修改成功'); 
      } else { 
        const { error } = await supabase.from('materials_cabinet').insert([payload]); 
        if (error) throw error;
        showToast('新增成功'); 
      }
      setCabinetForm({ name: '', base_price: '', shallow_price: '', no_door_factor: '' }); setEditId(null); fetchData();
    } catch (err) { showToast('保存失败: ' + err.message, 'error'); }
  };

  const handleSaveDoor = async (e) => {
    e.preventDefault();
    try {
      const payload = { name: doorForm.name, door_type: doorForm.door_type, base_price: parseFloat(doorForm.base_price) || 0 };
      if (editId) { 
        const { error } = await supabase.from('materials_door').update(payload).eq('id', editId); 
        if (error) throw error;
        showToast('修改成功'); 
      } else { 
        const { error } = await supabase.from('materials_door').insert([payload]); 
        if (error) throw error;
        showToast('新增成功'); 
      }
      setDoorForm({ name: '', door_type: '普通门板', base_price: '' }); setEditId(null); fetchData();
    } catch (err) { showToast('保存失败: ' + err.message, 'error'); }
  };

  const handleSaveUpgrade = async (e) => {
    e.preventDefault();
    try {
      const payload = { 
        name: upgradeForm.name, 
        upgrade_category: upgradeForm.upgrade_category, 
        calculation_type: upgradeForm.calculation_type,
        upgrade_effect_type: upgradeForm.upgrade_effect_type,
        replace_calculation_mode: upgradeForm.upgrade_effect_type === 'replace' ? upgradeForm.replace_calculation_mode : null,
        unit: upgradeForm.unit, 
        unit_price: parseFloat(upgradeForm.unit_price) || 0, 
        sort_order: parseInt(upgradeForm.sort_order) || 0,
        status: upgradeForm.status,
        description: upgradeForm.description,
        is_standard_item: upgradeForm.is_standard_item, 
        allow_manual_edit: upgradeForm.allow_manual_edit,
        image_url: upgradeForm.image_url || ''
      };

      if (editId) { 
        const { data, error } = await supabase.from('upgrade_items').update(payload).eq('id', editId).select(); 
        console.log('📤 [DEBUG] Update Result:', data, error);
        if (error) throw error;
        showToast('修改成功'); 
      } else { 
        // 使用 .select() 可以让 Supabase 把新增后的完整数据返回给我们在 data 里
        const { data, error } = await supabase.from('upgrade_items').insert([payload]).select(); 
        console.log('📤 [DEBUG] Insert Result:', data, error);
        if (error) throw error;
        showToast('新增成功'); 
      }
      
      // 清空表单，并主动拉取最新列表
      setUpgradeForm({ name: '', upgrade_category: '门板升级', calculation_type: '按面积㎡', upgrade_effect_type: 'add_cost', replace_calculation_mode: 'full_price', unit: '㎡', unit_price: '', sort_order: 0, status: true, description: '', image_url: '', is_standard_item: false, allow_manual_edit: true });
      setEditId(null); 
      fetchData();
    } catch (err) { 
      console.error("Save Upgrade Error:", err);
      showToast('保存失败: ' + (err.message || JSON.stringify(err)), 'error'); 
    }
  };

  const handleSaveRules = async (e) => {
    e.preventDefault();
    try {
      if (!rules.id) return;
      const { error } = await supabase.from('pricing_rules').update(rules).eq('id', rules.id);
      if (error) throw error;
      showToast('全局引擎规则更新成功！'); 
      fetchData();
    } catch (err) { showToast('更新失败: ' + err.message, 'error'); }
  };

  // 严格要求：彻底下架物理删除，改为停用切换
  const handleToggleUpgradeStatus = async (item) => {
    try {
      const { error } = await supabase.from('upgrade_items').update({ status: !item.status }).eq('id', item.id);
      if (error) throw error;
      showToast(item.status ? '✅ 已停用该项目 (保留历史记录)' : '✅ 已重新启用该项目');
      fetchData();
    } catch (err) { showToast('操作失败: ' + err.message, 'error'); }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center font-sans">
        <div className="bg-white p-10 rounded-2xl shadow-2xl w-full max-w-md border border-gray-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-black"></div>
          <div className="text-center mb-10 mt-4">
            <h1 className="text-3xl font-black text-gray-900 tracking-wider">NOEY<span className="font-light">ERP</span></h1>
            <p className="text-sm text-gray-500 mt-2 font-medium tracking-widest uppercase">内部数据工作台 V2.3</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">账号</label>
              <input type="text" required placeholder="初始管理员填 admin" value={loginForm.username} onChange={e=>setLoginForm({...loginForm, username: e.target.value})} className="w-full bg-gray-50 border-2 border-gray-100 p-4 rounded-xl focus:bg-white focus:border-black focus:outline-none transition-all font-medium" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">密码</label>
              <input type="password" required placeholder="初始密码填 admin123" value={loginForm.password} onChange={e=>setLoginForm({...loginForm, password: e.target.value})} className="w-full bg-gray-50 border-2 border-gray-100 p-4 rounded-xl focus:bg-white focus:border-black focus:outline-none transition-all font-medium" />
            </div>
            <button type="submit" disabled={isLoading} className="w-full bg-black text-white p-4 rounded-xl font-bold hover:bg-gray-800 transition-colors shadow-lg disabled:bg-gray-400 mt-4">
              {isLoading ? '系统核验中...' : '安 全 登 录'}
            </button>
          </form>
        </div>
        {toast.show && (<div className="fixed top-6 left-1/2 -translate-x-1/2 bg-black text-white px-6 py-3 rounded-full shadow-2xl z-50 text-sm font-bold">{toast.message}</div>)}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100 font-sans overflow-hidden">
      
      {/* 左侧导航栏 */}
      <div className="w-64 bg-gray-900 text-white flex flex-col shadow-2xl z-20">
        <div className="p-6 border-b border-gray-800">
          <h1 className="text-2xl font-black tracking-widest">NOEY<span className="font-light text-gray-400">ERP</span></h1>
          <div className="text-xs text-gray-500 mt-2 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>{currentUser.name} ({currentUser.role})</div>
        </div>
        <div className="flex-1 overflow-y-auto py-6">
          <div className="px-6 text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">物料字典配置</div>
          <button onClick={() => {setCurrentView('upgrade'); setEditId(null);}} className={`w-full text-left px-6 py-4 font-medium transition-colors border-l-4 ${currentView==='upgrade'?'border-amber-500 bg-gray-800 text-white':'border-transparent text-gray-400 hover:text-white hover:bg-gray-800/50'}`}>✨ V2.3 升级工艺库</button>
          <button onClick={() => {setCurrentView('cabinet'); setEditId(null);}} className={`w-full text-left px-6 py-4 font-medium transition-colors border-l-4 ${currentView==='cabinet'?'border-blue-500 bg-gray-800 text-white':'border-transparent text-gray-400 hover:text-white hover:bg-gray-800/50'}`}>🗄️ 柜体材料库</button>
          <button onClick={() => {setCurrentView('door'); setEditId(null);}} className={`w-full text-left px-6 py-4 font-medium transition-colors border-l-4 ${currentView==='door'?'border-indigo-500 bg-gray-800 text-white':'border-transparent text-gray-400 hover:text-white hover:bg-gray-800/50'}`}>🚪 基础门板库</button>
          
          <div className="px-6 text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 mt-8">引擎算法配置</div>
          <button onClick={() => setCurrentView('rules')} className={`w-full text-left px-6 py-4 font-medium transition-colors border-l-4 ${currentView==='rules'?'border-rose-500 bg-gray-800 text-white':'border-transparent text-gray-400 hover:text-white hover:bg-gray-800/50'}`}>⚙️ 深度与全局规则</button>
        </div>
        <div className="p-4 border-t border-gray-800 bg-black/20">
          <button onClick={() => setCurrentUser(null)} className="w-full bg-gray-800 text-gray-400 py-3 rounded-lg hover:bg-rose-600 hover:text-white transition-colors text-sm font-bold tracking-wider">退出登录</button>
        </div>
      </div>

      {/* 右侧工作区 */}
      <div className="flex-1 overflow-y-auto p-10 relative">
        {isLoading && <div className="absolute top-6 right-10 bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-xs font-bold shadow animate-pulse z-50 flex items-center gap-2"><span className="animate-spin text-lg">↻</span> 通讯中...</div>}
        
        {/* === 视图 1: V2.3 升级与工艺库 (核心排查点) === */}
        {currentView === 'upgrade' && (
          <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
            <div className="flex justify-between items-end mb-2">
              <h2 className="text-2xl font-black text-gray-800 tracking-wider">V2.3 升级与工艺库</h2>
              <span className="text-xs font-bold bg-amber-100 text-amber-800 px-3 py-1 rounded-full uppercase tracking-widest">高级配置引擎</span>
            </div>
            
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
              <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2 text-lg border-b border-gray-100 pb-4">{editId ? <span className="text-blue-600">📝 编辑项目: {upgradeForm.name}</span> : '➕ 录入新工艺/升级项目'}</h3>
              
              <form onSubmit={handleSaveUpgrade} className="space-y-6">
                <div className="grid grid-cols-4 gap-6">
                  <div className="col-span-2"><label className="block text-xs font-bold text-gray-500 mb-2">项目名称 (必填)</label><input required value={upgradeForm.name} onChange={e=>setUpgradeForm({...upgradeForm, name:e.target.value})} className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-black focus:outline-none text-base font-bold" placeholder="如: 斜边免拉手 / 玻璃门" /></div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-2">一级分类 (展示归属)</label>
                    <select value={upgradeForm.upgrade_category} onChange={e=>setUpgradeForm({...upgradeForm, upgrade_category:e.target.value})} className="w-full border-2 border-gray-200 p-3 rounded-xl bg-gray-50 focus:bg-white focus:border-black focus:outline-none font-medium">
                      <option>门板升级</option><option>五金系统</option><option>灯光系统</option><option>木作工艺</option><option>结构调整</option><option>其他</option>
                    </select>
                  </div>
                  <div><label className="block text-xs font-bold text-gray-500 mb-2">显示排序 (数字越小越前)</label><input type="number" required value={upgradeForm.sort_order} onChange={e=>setUpgradeForm({...upgradeForm, sort_order:e.target.value})} className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-black focus:outline-none text-center" /></div>
                </div>
                
                <div className="grid grid-cols-4 gap-6 items-end p-6 bg-blue-50/50 rounded-2xl border border-blue-100">
                  <div>
                    <label className="block text-xs font-bold text-blue-800 mb-2">计价方式 (抓取图纸数量)</label>
                    <select value={upgradeForm.calculation_type} onChange={e=>setUpgradeForm({...upgradeForm, calculation_type:e.target.value})} className="w-full border-2 border-blue-200 p-3 rounded-xl bg-white font-bold text-blue-900 focus:border-blue-500 focus:outline-none shadow-sm">
                      <option>按面积㎡</option><option>按延米</option><option>按个</option><option>按套</option><option>按柜宽自动算</option><option>人工直接输金额</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-1/3"><label className="block text-xs font-bold text-gray-500 mb-2">单位</label><input required value={upgradeForm.unit} onChange={e=>setUpgradeForm({...upgradeForm, unit:e.target.value})} className="w-full border-2 border-gray-200 p-3 rounded-xl text-center focus:border-black focus:outline-none" /></div>
                    <div className="flex-1"><label className="block text-xs font-bold text-gray-500 mb-2">单价 (元)</label><input type="number" required disabled={upgradeForm.calculation_type === '人工直接输金额'} value={upgradeForm.unit_price} onChange={e=>setUpgradeForm({...upgradeForm, unit_price:e.target.value})} className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-black focus:outline-none font-bold text-gray-900 disabled:bg-gray-100" /></div>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-amber-600 mb-2">价格影响逻辑 (引擎核心)</label>
                    <div className="flex gap-2">
                      <select value={upgradeForm.upgrade_effect_type} onChange={e=>setUpgradeForm({...upgradeForm, upgrade_effect_type:e.target.value})} className="flex-1 border-2 border-amber-200 p-3 rounded-xl bg-white font-bold text-amber-900 focus:border-amber-500 focus:outline-none shadow-sm">
                        <option value="add_cost">直接追加费用 (如:抽屉,灯带)</option>
                        <option value="replace">局部替换升级 (如:PET换玻璃门)</option>
                        <option value="modify_base_price">修改基础价格 (特种工艺)</option>
                        <option value="manual">人工调整 (异型打磨)</option>
                      </select>
                      {upgradeForm.upgrade_effect_type === 'replace' && (
                        <select value={upgradeForm.replace_calculation_mode} onChange={e=>setUpgradeForm({...upgradeForm, replace_calculation_mode:e.target.value})} className="flex-1 border-2 border-rose-200 bg-rose-50 p-3 rounded-xl text-rose-700 font-bold focus:outline-none text-xs">
                          <option value="full_price">填全价 (系统自动扣基础底价)</option>
                          <option value="difference_price">填差价 (系统纯加差价不扣底)</option>
                        </select>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-6">
                  <div className="col-span-2"><label className="block text-xs font-bold text-gray-500 mb-2">后台管理备注说明</label><input value={upgradeForm.description} onChange={e=>setUpgradeForm({...upgradeForm, description:e.target.value})} className="w-full border-2 border-gray-100 bg-gray-50 p-3 rounded-xl focus:bg-white focus:border-gray-300 focus:outline-none text-sm text-gray-600" placeholder="例如：此项需要人工核对图纸尺寸..." /></div>
                  <div className="flex flex-col gap-4 justify-center pt-6 px-4 bg-gray-50 rounded-xl border border-gray-100">
                    <label className="flex items-center gap-3 text-sm font-bold text-gray-700 cursor-pointer"><input type="checkbox" checked={upgradeForm.is_standard_item} onChange={e=>setUpgradeForm({...upgradeForm, is_standard_item:e.target.checked})} className="w-5 h-5 accent-black rounded" /> 设为开单默认标配项</label>
                    <label className="flex items-center gap-3 text-sm font-bold text-gray-700 cursor-pointer"><input type="checkbox" checked={upgradeForm.allow_manual_edit} onChange={e=>setUpgradeForm({...upgradeForm, allow_manual_edit:e.target.checked})} className="w-5 h-5 accent-black rounded" /> 允许销售在开单时修改数量</label>
                  </div>
                </div>
                
                <div className="flex justify-between items-center pt-4 border-t border-gray-100 mt-6">
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-500 cursor-pointer"><input type="checkbox" checked={upgradeForm.status} onChange={e=>setUpgradeForm({...upgradeForm, status:e.target.checked})} className="w-5 h-5 accent-emerald-500 rounded" /> {upgradeForm.status ? <span className="text-emerald-600">此项目处于启用状态</span> : <span className="text-rose-500">此项目将被设为停用隐藏</span>}</label>
                  <div className="flex gap-4">
                    {editId && <button type="button" onClick={() => {setEditId(null); setUpgradeForm({ name: '', upgrade_category: '门板升级', calculation_type: '按面积㎡', upgrade_effect_type: 'add_cost', replace_calculation_mode: 'full_price', unit: '㎡', unit_price: '', sort_order: 0, status: true, description: '', image_url: '', is_standard_item: false, allow_manual_edit: true });}} className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors">取消</button>}
                    <button type="submit" className="bg-black text-white px-10 py-3 rounded-xl font-bold shadow-lg hover:bg-gray-800 transition-transform active:scale-95 text-lg">{editId ? '保存全部修改' : '确认写入工艺库'}</button>
                  </div>
                </div>
              </form>
            </div>
            
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-200 text-xs uppercase tracking-wider">
                  <tr className="divide-x divide-gray-100">
                    <th className="p-4 w-16 text-center">排序</th>
                    <th className="p-4">项目名称</th>
                    <th className="p-4">一级分类</th>
                    <th className="p-4">计价方式</th>
                    <th className="p-4">单价</th>
                    <th className="p-4">价格影响逻辑</th>
                    <th className="p-4 text-center">状态</th>
                    <th className="p-4 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {upgrades.map(item => (
                    <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${!item.status ? 'bg-gray-100/50 opacity-60' : ''}`}>
                      <td className="p-4 text-center font-medium text-gray-400">{item.sort_order}</td>
                      <td className="p-4">
                        <div className="font-bold text-gray-900 text-base flex items-center gap-2">{item.name} {item.is_standard_item && <span className="text-[10px] bg-black text-white px-1.5 py-0.5 rounded uppercase">标配</span>}</div>
                        <div className="text-xs text-gray-400 mt-1 truncate max-w-[200px]">{item.description || '无备注'}</div>
                      </td>
                      <td className="p-4 font-bold text-gray-600">{item.upgrade_category}</td>
                      <td className="p-4 font-bold text-blue-700">{item.calculation_type}</td>
                      <td className="p-4 font-medium">{item.calculation_type === '人工直接输金额' ? '按实输' : `¥${item.unit_price} / ${item.unit}`}</td>
                      <td className="p-4">
                        {item.upgrade_effect_type === 'add_cost' && <span className="text-emerald-700 bg-emerald-50 px-2 py-1.5 rounded text-xs font-bold border border-emerald-100">追加费用</span>}
                        {item.upgrade_effect_type === 'replace' && <div className="text-rose-700 bg-rose-50 px-2 py-1.5 rounded text-xs font-bold border border-rose-100">替换升级 <span className="font-normal opacity-70">({item.replace_calculation_mode === 'full_price' ? '扣底价' : '纯补差'})</span></div>}
                        {item.upgrade_effect_type === 'modify_base_price' && <span className="text-purple-700 bg-purple-50 px-2 py-1.5 rounded text-xs font-bold border border-purple-100">修基础价</span>}
                        {item.upgrade_effect_type === 'manual' && <span className="text-gray-700 bg-gray-100 px-2 py-1.5 rounded text-xs font-bold border border-gray-200">人工调整</span>}
                      </td>
                      <td className="p-4 text-center">{item.status ? <span className="text-emerald-600 font-bold">启用</span> : <span className="text-rose-500 font-bold">停用</span>}</td>
                      <td className="p-4 text-center space-x-3">
                        <button onClick={() => {setEditId(item.id); setUpgradeForm(item);}} className="text-blue-600 font-bold hover:underline">编辑</button>
                        <button onClick={() => handleToggleUpgradeStatus(item)} className={`font-bold hover:underline ${item.status ? 'text-rose-500' : 'text-emerald-600'}`}>{item.status ? '停用' : '启用'}</button>
                      </td>
                    </tr>
                  ))}
                  {upgrades.length === 0 && <tr><td colSpan="8" className="p-8 text-center text-gray-400 font-medium">工艺库尚无数据，请在上方录入您的专属配置</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* === 视图 2: 柜体管理 === */}
        {currentView === 'cabinet' && (
          <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
            <h2 className="text-2xl font-black text-gray-800 tracking-wider">柜体材料库</h2>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">{editId ? <span className="text-blue-600">📝 编辑柜体</span> : '➕ 新增柜体'}</h3>
              <form onSubmit={handleSaveCabinet} className="grid grid-cols-5 gap-4 items-end">
                <div className="col-span-2"><label className="block text-xs font-bold text-gray-500 mb-2">材料名称</label><input required value={cabinetForm.name} onChange={e=>setCabinetForm({...cabinetForm, name:e.target.value})} className="w-full border-2 border-gray-200 p-2 rounded-lg focus:border-black focus:outline-none" /></div>
                <div><label className="block text-xs font-bold text-gray-500 mb-2">标准单价 (元/㎡)</label><input required type="number" value={cabinetForm.base_price} onChange={e=>setCabinetForm({...cabinetForm, base_price:e.target.value})} className="w-full border-2 border-gray-200 p-2 rounded-lg focus:border-black focus:outline-none font-bold text-gray-800" /></div>
                <div><label className="block text-xs font-bold text-gray-500 mb-2">浅柜单价 (元/㎡)</label><input required type="number" value={cabinetForm.shallow_price} onChange={e=>setCabinetForm({...cabinetForm, shallow_price:e.target.value})} className="w-full border-2 border-gray-200 p-2 rounded-lg focus:border-black focus:outline-none font-bold text-blue-600" /></div>
                <div><label className="block text-xs font-bold text-gray-500 mb-2">无门板补偿系数</label><div className="flex gap-2"><input required type="number" step="0.01" value={cabinetForm.no_door_factor} onChange={e=>setCabinetForm({...cabinetForm, no_door_factor:e.target.value})} className="w-full border-2 border-gray-200 p-2 rounded-lg focus:border-black focus:outline-none" /><button type="submit" className="bg-black text-white px-6 rounded-lg font-bold hover:bg-gray-800 whitespace-nowrap shadow">{editId ? '保存' : '添加'}</button></div></div>
              </form>
            </div>
            {/* 列表略化显示 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-200 text-xs uppercase tracking-wider"><tr><th className="p-4">材料名称</th><th className="p-4">标准单价</th><th className="p-4">浅柜单价</th><th className="p-4">无门补偿系数</th><th className="p-4 text-center">操作</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {cabinets.map(item => (<tr key={item.id} className="hover:bg-gray-50 transition-colors"><td className="p-4 font-bold">{item.name}</td><td className="p-4">¥{item.base_price}</td><td className="p-4">¥{item.shallow_price}</td><td className="p-4 text-rose-600">× {item.no_door_factor}</td><td className="p-4 text-center"><button onClick={() => {setEditId(item.id); setCabinetForm(item);}} className="text-blue-600 font-bold hover:underline">编辑</button></td></tr>))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* === 视图 3: 门板管理 === */}
        {currentView === 'door' && (
          <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
            <h2 className="text-2xl font-black text-gray-800 tracking-wider">基础门板库</h2>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">{editId ? <span className="text-blue-600">📝 编辑门板</span> : '➕ 新增门板'}</h3>
              <form onSubmit={handleSaveDoor} className="grid grid-cols-4 gap-4 items-end">
                <div><label className="block text-xs font-bold text-gray-500 mb-2">门板名称</label><input required value={doorForm.name} onChange={e=>setDoorForm({...doorForm, name:e.target.value})} className="w-full border-2 border-gray-200 p-2 rounded-lg" /></div>
                <div><label className="block text-xs font-bold text-gray-500 mb-2">门板类型</label><select value={doorForm.door_type} onChange={e=>setDoorForm({...doorForm, door_type:e.target.value})} className="w-full border-2 border-gray-200 p-2 rounded-lg bg-white"><option>普通门板</option><option>特殊门板</option><option>无门板</option></select></div>
                <div><label className="block text-xs font-bold text-gray-500 mb-2">基础单价</label><input required type="number" disabled={doorForm.door_type==='无门板'} value={doorForm.door_type==='无门板'?0:doorForm.base_price} onChange={e=>setDoorForm({...doorForm, base_price:e.target.value})} className="w-full border-2 border-gray-200 p-2 rounded-lg" /></div>
                <div><button type="submit" className="w-full bg-black text-white p-2 rounded-lg font-bold shadow">{editId ? '保存' : '添加'}</button></div>
              </form>
            </div>
            {/* 列表略化显示 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-200 text-xs uppercase tracking-wider"><tr><th className="p-4">门板名称</th><th className="p-4">类型</th><th className="p-4">单价</th><th className="p-4 text-center">操作</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {doors.map(item => (<tr key={item.id} className="hover:bg-gray-50 transition-colors"><td className="p-4 font-bold">{item.name}</td><td className="p-4">{item.door_type}</td><td className="p-4">{item.door_type==='无门板'?'-':`¥${item.base_price}`}</td><td className="p-4 text-center"><button onClick={() => {setEditId(item.id); setDoorForm(item);}} className="text-blue-600 font-bold hover:underline">编辑</button></td></tr>))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* === 视图 4: 规则引擎参数 === */}
        {currentView === 'rules' && (
          <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
            <h2 className="text-2xl font-black text-gray-800 tracking-wider">全局计价引擎规则</h2>
            <form onSubmit={handleSaveRules} className="bg-white p-10 rounded-2xl shadow-sm border border-gray-200 space-y-10 relative overflow-hidden">
              <div className="border-l-4 border-blue-500 pl-6">
                <h3 className="font-bold text-gray-900 mb-6 text-lg tracking-wide">📏 深度计价触发规则 (mm)</h3>
                <div className="grid grid-cols-2 gap-8">
                  <div className="bg-gray-50 p-6 rounded-xl border border-gray-100"><label className="block text-sm font-bold text-gray-700 mb-3">标准深度 (超深系数基数)</label><input type="number" required value={rules.standard_depth} onChange={e=>setRules({...rules, standard_depth:e.target.value})} className="w-full border-2 border-gray-200 p-4 rounded-xl text-xl font-black focus:border-black focus:outline-none" /></div>
                  <div className="bg-gray-50 p-6 rounded-xl border border-gray-100"><label className="block text-sm font-bold text-gray-700 mb-3">浅柜判定界限</label><input type="number" required value={rules.shallow_depth} onChange={e=>setRules({...rules, shallow_depth:e.target.value})} className="w-full border-2 border-gray-200 p-4 rounded-xl text-xl font-black focus:border-black focus:outline-none" /></div>
                </div>
              </div>
              <div className="border-l-4 border-amber-500 pl-6 pt-6 border-t border-gray-100">
                <h3 className="font-bold text-gray-900 mb-6 text-lg tracking-wide">📐 计价模式与最低消费</h3>
                <div className="grid grid-cols-3 gap-6">
                  <div className="bg-gray-50 p-5 rounded-xl border border-gray-100"><label className="block text-sm font-bold text-gray-700 mb-3">高度分水岭 (mm)</label><input type="number" required value={rules.height_threshold} onChange={e=>setRules({...rules, height_threshold:e.target.value})} className="w-full border-2 border-gray-200 p-3 rounded-xl text-lg font-black focus:border-black focus:outline-none" /><p className="text-xs text-gray-500 mt-2">决定按面积还是延米算</p></div>
                  <div className="bg-gray-50 p-5 rounded-xl border border-gray-100"><label className="block text-sm font-bold text-gray-700 mb-3">最低计算面积 (㎡)</label><input type="number" step="0.1" required value={rules.minimum_area} onChange={e=>setRules({...rules, minimum_area:e.target.value})} className="w-full border-2 border-gray-200 p-3 rounded-xl text-lg font-black focus:border-black focus:outline-none" /></div>
                  <div className="bg-gray-50 p-5 rounded-xl border border-gray-100"><label className="block text-sm font-bold text-gray-700 mb-3">最低计算宽度 (mm)</label><input type="number" required value={rules.minimum_width} onChange={e=>setRules({...rules, minimum_width:e.target.value})} className="w-full border-2 border-gray-200 p-3 rounded-xl text-lg font-black focus:border-black focus:outline-none" /></div>
                </div>
              </div>
              <div className="pt-8 border-t border-gray-100"><button type="submit" className="w-full bg-black text-white p-5 rounded-2xl font-black shadow-xl hover:bg-gray-800 transition-all active:scale-[0.99] text-lg tracking-widest">保存规则</button></div>
            </form>
          </div>
        )}

      </div>
      {toast.show && (
        <div className="fixed top-8 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in">
          <div className={`px-8 py-4 rounded-full shadow-2xl font-bold text-sm flex items-center gap-3 ${toast.type === 'error' ? 'bg-rose-600' : 'bg-black'} text-white`}>{toast.message}</div>
        </div>
      )}
    </div>
  );
}
```

### 🔬 全新测试方法：

为了让您亲眼看到排查结果，请配合浏览器“开发者工具”测试：
1. 打开网页，按下键盘上的 **`F12`** 键，选择 **Console (控制台)** 标签页。
2. 登录进系统，进入“✨ V2.3 升级工艺库”。
3. 按照您的原样填写一个项目（如：玻璃门），点击“确认写入”。
4. **注意看您的浏览器控制台 (Console)**：
   * 会打印出 `📤 [DEBUG] Insert Result:`，如果没报错，代表数据库成功存入了！
   * 紧接着会打印出 `📦 [DEBUG] Fetch Upgrades Result:`，这就代表系统重新拉取了刚存入的列表！
5. 再看页面下方，刚刚因为报错被吞掉的“玻璃门”一定闪亮登场了！
