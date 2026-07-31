import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// 专属配置：自动清理 URL，确保连接无误
const rawSupabaseUrl = 'https://muwzdigtehcperweliyg.supabase.co/rest/v1/'; 
const supabaseKey = 'sb_publishable_SGHvdmqpvo3Z6GekTtk4cA_PcvbDGpd';
const supabaseUrl = rawSupabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabase = createClient(supabaseUrl, supabaseKey);

export default function App() {
  // --- 全局与登录状态 ---
  const [currentUser, setCurrentUser] = useState(null); 
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [currentView, setCurrentView] = useState('cabinet'); // cabinet | door | upgrade | rules
  const [isLoading, setIsLoading] = useState(false);

  // --- 业务数据状态 ---
  const [cabinets, setCabinets] = useState([]);
  const [doors, setDoors] = useState([]);
  const [upgrades, setUpgrades] = useState([]);
  const [rules, setRules] = useState({
    standard_depth: 600, shallow_depth: 295, height_threshold: 1000, minimum_area: 1, minimum_width: 1000
  });

  // --- 表单编辑状态 ---
  const [editId, setEditId] = useState(null); // 正在编辑的项ID
  const [cabinetForm, setCabinetForm] = useState({ name: '', base_price: '', shallow_price: '', no_door_factor: '' });
  const [doorForm, setDoorForm] = useState({ name: '', door_type: '普通门板', base_price: '' });
  const [upgradeForm, setUpgradeForm] = useState({
    name: '', unit: '㎡', unit_price: '', type: '门板局部', calculation_type: '按面积㎡', 
    upgrade_mode: 'add', replace_calculation_mode: 'full_price', 
    is_standard_item: false, allow_manual_edit: true
  });

  // --- 核心方法：提示与数据拉取 ---
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [resCab, resDoor, resUpg, resRule] = await Promise.all([
        supabase.from('materials_cabinet').select('*').order('name'),
        supabase.from('materials_door').select('*').order('name'),
        supabase.from('upgrade_items').select('*').order('name'),
        supabase.from('pricing_rules').select('*').limit(1)
      ]);
      if (resCab.data) setCabinets(resCab.data);
      if (resDoor.data) setDoors(resDoor.data);
      if (resUpg.data) setUpgrades(resUpg.data);
      
      // 处理全局规则 (如果为空，则初始化一条)
      if (resRule.data && resRule.data.length > 0) {
        setRules(resRule.data[0]);
      } else {
        const defaultRules = { standard_depth: 600, shallow_depth: 295, height_threshold: 1000, minimum_area: 1, minimum_width: 1000 };
        const { data: newRule } = await supabase.from('pricing_rules').insert([defaultRules]).select();
        if (newRule) setRules(newRule[0]);
      }
    } catch (error) {
      showToast('数据加载失败: ' + error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) fetchData(); // 只有登录后才拉取数据
  }, [currentUser]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // 智能初始化：检查是否没有任何员工，如果没有，自动帮老板创建一个 admin 账号
      const { data: empCheck } = await supabase.from('employees').select('id').limit(1);
      if (!empCheck || empCheck.length === 0) {
        if (loginForm.username === 'admin' && loginForm.password === 'admin123') {
          await supabase.from('employees').insert([{ username: 'admin', password: 'admin123', name: '系统管理员', role: 'admin' }]);
          showToast('✅ 初始管理员账号自动创建成功！');
        }
      }

      // 验证登录
      const { data, error } = await supabase.from('employees')
        .select('*')
        .eq('username', loginForm.username)
        .eq('password', loginForm.password)
        .single();

      if (error || !data) throw new Error('账号或密码错误');
      if (!data.status) throw new Error('账号已被停用，请联系管理员');

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
      const payload = { 
        name: cabinetForm.name, 
        base_price: parseFloat(cabinetForm.base_price), 
        shallow_price: parseFloat(cabinetForm.shallow_price), 
        no_door_factor: parseFloat(cabinetForm.no_door_factor) 
      };
      if (editId) {
        await supabase.from('materials_cabinet').update(payload).eq('id', editId);
        showToast('修改成功');
      } else {
        await supabase.from('materials_cabinet').insert([payload]);
        showToast('新增成功');
      }
      setCabinetForm({ name: '', base_price: '', shallow_price: '', no_door_factor: '' });
      setEditId(null);
      fetchData();
    } catch (err) { showToast('保存失败: ' + err.message, 'error'); }
  };

  const handleSaveDoor = async (e) => {
    e.preventDefault();
    try {
      const payload = { 
        name: doorForm.name, door_type: doorForm.door_type, base_price: parseFloat(doorForm.base_price) || 0 
      };
      if (editId) {
        await supabase.from('materials_door').update(payload).eq('id', editId);
        showToast('修改成功');
      } else {
        await supabase.from('materials_door').insert([payload]);
        showToast('新增成功');
      }
      setDoorForm({ name: '', door_type: '普通门板', base_price: '' });
      setEditId(null);
      fetchData();
    } catch (err) { showToast('保存失败: ' + err.message, 'error'); }
  };

  const handleSaveUpgrade = async (e) => {
    e.preventDefault();
    try {
      const payload = { 
        name: upgradeForm.name, unit: upgradeForm.unit, type: upgradeForm.type,
        unit_price: parseFloat(upgradeForm.unit_price) || 0, calculation_type: upgradeForm.calculation_type,
        upgrade_mode: upgradeForm.upgrade_mode, replace_calculation_mode: upgradeForm.upgrade_mode === 'replace' ? upgradeForm.replace_calculation_mode : null,
        is_standard_item: upgradeForm.is_standard_item, allow_manual_edit: upgradeForm.allow_manual_edit
      };
      if (editId) { await supabase.from('upgrade_items').update(payload).eq('id', editId); showToast('修改成功'); } 
      else { await supabase.from('upgrade_items').insert([payload]); showToast('新增成功'); }
      setUpgradeForm({ name: '', unit: '㎡', unit_price: '', type: '门板局部', calculation_type: '按面积㎡', upgrade_mode: 'add', replace_calculation_mode: 'full_price', is_standard_item: false, allow_manual_edit: true });
      setEditId(null);
      fetchData();
    } catch (err) { showToast('保存失败: ' + err.message, 'error'); }
  };

  const handleSaveRules = async (e) => {
    e.preventDefault();
    try {
      await supabase.from('pricing_rules').update(rules).eq('id', rules.id);
      showToast('全局规则更新成功！');
      fetchData();
    } catch (err) { showToast('更新失败: ' + err.message, 'error'); }
  };

  const handleDelete = async (table, id) => {
    if (!window.confirm('确定要删除此条数据吗？删除后不可恢复。')) return;
    try {
      await supabase.from(table).delete().eq('id', id);
      showToast('删除成功');
      fetchData();
    } catch (err) { showToast('删除失败: ' + err.message, 'error'); }
  };


  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center font-sans">
        <div className="bg-white p-10 rounded-2xl shadow-xl w-full max-w-md border border-gray-100">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black text-gray-900 tracking-wider">NOEY<span className="font-light">ERP</span></h1>
            <p className="text-sm text-gray-500 mt-2 font-medium">诺一家具 · 内部业务核算系统</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">员工账号</label>
              <input type="text" required placeholder="初始账号请输入 admin" value={loginForm.username} onChange={e=>setLoginForm({...loginForm, username: e.target.value})} className="w-full bg-gray-50 border border-gray-200 p-4 rounded-xl focus:bg-white focus:border-black focus:outline-none transition-all" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">登录密码</label>
              <input type="password" required placeholder="初始密码请输入 admin123" value={loginForm.password} onChange={e=>setLoginForm({...loginForm, password: e.target.value})} className="w-full bg-gray-50 border border-gray-200 p-4 rounded-xl focus:bg-white focus:border-black focus:outline-none transition-all" />
            </div>
            <button type="submit" disabled={isLoading} className="w-full bg-black text-white p-4 rounded-xl font-bold hover:bg-gray-800 transition-colors shadow-lg disabled:bg-gray-400">
              {isLoading ? '登录中...' : '安 全 登 录'}
            </button>
          </form>
          <div className="mt-6 text-center text-xs text-gray-400">V 2.0 Enterprise Edition</div>
        </div>
        {toast.show && (<div className="fixed top-6 left-1/2 -translate-x-1/2 bg-black text-white px-6 py-3 rounded-full shadow-2xl z-50">{toast.message}</div>)}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100 font-sans overflow-hidden">
      
      {/* 侧边导航栏 */}
      <div className="w-64 bg-gray-900 text-white flex flex-col shadow-2xl z-10">
        <div className="p-6 border-b border-gray-800">
          <h1 className="text-xl font-black tracking-widest">NOEY<span className="font-light text-gray-400">ADMIN</span></h1>
          <div className="text-xs text-gray-500 mt-2 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500"></span>{currentUser.name} ({currentUser.role})</div>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <div className="px-6 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">基础物料库</div>
          <button onClick={() => {setCurrentView('cabinet'); setEditId(null);}} className={`w-full text-left px-6 py-3 font-medium transition-colors ${currentView==='cabinet'?'bg-blue-600 text-white':'text-gray-400 hover:text-white hover:bg-gray-800'}`}>🗄️ 柜体材料管理</button>
          <button onClick={() => {setCurrentView('door'); setEditId(null);}} className={`w-full text-left px-6 py-3 font-medium transition-colors ${currentView==='door'?'bg-blue-600 text-white':'text-gray-400 hover:text-white hover:bg-gray-800'}`}>🚪 门板材料管理</button>
          <button onClick={() => {setCurrentView('upgrade'); setEditId(null);}} className={`w-full text-left px-6 py-3 font-medium transition-colors ${currentView==='upgrade'?'bg-blue-600 text-white':'text-gray-400 hover:text-white hover:bg-gray-800'}`}>✨ 升级与五金管理</button>
          
          <div className="px-6 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 mt-6">核心引擎规则</div>
          <button onClick={() => setCurrentView('rules')} className={`w-full text-left px-6 py-3 font-medium transition-colors ${currentView==='rules'?'bg-blue-600 text-white':'text-gray-400 hover:text-white hover:bg-gray-800'}`}>⚙️ 深度与全局规则</button>
        </div>
        <div className="p-4 border-t border-gray-800">
          <button onClick={() => setCurrentUser(null)} className="w-full bg-gray-800 text-gray-400 py-3 rounded-lg hover:bg-gray-700 hover:text-white transition-colors text-sm font-medium">退出登录</button>
        </div>
      </div>

      {/* 右侧主内容区 */}
      <div className="flex-1 overflow-y-auto p-8 relative">
        {isLoading && <div className="absolute top-4 right-8 bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-bold shadow animate-pulse">数据同步中...</div>}
        
        {/* --- 视图 1: 柜体管理 --- */}
        {currentView === 'cabinet' && (
          <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-800 border-b-2 border-black pb-2 inline-block">柜体材料管理</h2>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <h3 className="font-bold text-gray-800 mb-4">{editId ? '📝 编辑柜体材料' : '➕ 新增柜体材料'}</h3>
              <form onSubmit={handleSaveCabinet} className="grid grid-cols-4 gap-4 items-end">
                <div><label className="block text-sm text-gray-500 mb-1">材料名称</label><input required value={cabinetForm.name} onChange={e=>setCabinetForm({...cabinetForm, name:e.target.value})} className="w-full border-2 border-gray-200 p-2 rounded-lg" placeholder="如: 橡木板" /></div>
                <div><label className="block text-sm text-gray-500 mb-1">基准单价 (元/㎡)</label><input required type="number" value={cabinetForm.base_price} onChange={e=>setCabinetForm({...cabinetForm, base_price:e.target.value})} className="w-full border-2 border-gray-200 p-2 rounded-lg" /></div>
                <div><label className="block text-sm text-gray-500 mb-1">浅柜单价 (元/㎡)</label><input required type="number" value={cabinetForm.shallow_price} onChange={e=>setCabinetForm({...cabinetForm, shallow_price:e.target.value})} className="w-full border-2 border-gray-200 p-2 rounded-lg" /></div>
                <div><label className="block text-sm text-gray-500 mb-1">无门板补偿系数</label><div className="flex gap-2"><input required type="number" step="0.01" value={cabinetForm.no_door_factor} onChange={e=>setCabinetForm({...cabinetForm, no_door_factor:e.target.value})} className="w-full border-2 border-gray-200 p-2 rounded-lg" placeholder="如: 1.2" /><button type="submit" className="bg-black text-white px-6 rounded-lg font-bold hover:bg-gray-800">{editId ? '保存' : '添加'}</button></div></div>
              </form>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-200"><tr className="divide-x divide-gray-100"><th className="p-4">材料名称</th><th className="p-4">基准单价</th><th className="p-4">浅柜单价</th><th className="p-4">无门补偿系数</th><th className="p-4 text-center">操作</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {cabinets.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50"><td className="p-4 font-bold text-gray-800">{item.name}</td><td className="p-4">¥{item.base_price}</td><td className="p-4">¥{item.shallow_price}</td><td className="p-4 font-bold text-blue-600">× {item.no_door_factor}</td>
                      <td className="p-4 text-center space-x-4"><button onClick={() => {setEditId(item.id); setCabinetForm(item);}} className="text-blue-600 hover:underline">编辑</button><button onClick={() => handleDelete('materials_cabinet', item.id)} className="text-rose-500 hover:underline">删除</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- 视图 2: 门板管理 --- */}
        {currentView === 'door' && (
          <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-800 border-b-2 border-black pb-2 inline-block">门板材料管理</h2>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <h3 className="font-bold text-gray-800 mb-4">{editId ? '📝 编辑门板' : '➕ 新增门板'}</h3>
              <form onSubmit={handleSaveDoor} className="grid grid-cols-4 gap-4 items-end">
                <div><label className="block text-sm text-gray-500 mb-1">门板名称</label><input required value={doorForm.name} onChange={e=>setDoorForm({...doorForm, name:e.target.value})} className="w-full border-2 border-gray-200 p-2 rounded-lg" placeholder="如: PET" /></div>
                <div><label className="block text-sm text-gray-500 mb-1">门板类型</label><select value={doorForm.door_type} onChange={e=>setDoorForm({...doorForm, door_type:e.target.value})} className="w-full border-2 border-gray-200 p-2 rounded-lg bg-white"><option value="普通门板">普通门板</option><option value="特殊门板">特殊门板</option><option value="无门板">无门板(系统调用补偿)</option></select></div>
                <div><label className="block text-sm text-gray-500 mb-1">基准单价 (元/㎡)</label><input required type="number" disabled={doorForm.door_type === '无门板'} value={doorForm.door_type === '无门板' ? 0 : doorForm.base_price} onChange={e=>setDoorForm({...doorForm, base_price:e.target.value})} className="w-full border-2 border-gray-200 p-2 rounded-lg disabled:bg-gray-100" /></div>
                <div><button type="submit" className="w-full bg-black text-white p-2 rounded-lg font-bold hover:bg-gray-800 h-11">{editId ? '保存修改' : '确认添加'}</button></div>
              </form>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-200"><tr className="divide-x divide-gray-100"><th className="p-4">门板名称</th><th className="p-4">类型</th><th className="p-4">基准单价</th><th className="p-4 text-center">操作</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {doors.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50"><td className="p-4 font-bold text-gray-800">{item.name}</td><td className="p-4"><span className={`px-2 py-1 rounded text-xs ${item.door_type==='无门板'?'bg-rose-100 text-rose-800':'bg-emerald-100 text-emerald-800'}`}>{item.door_type}</span></td><td className="p-4">{item.door_type === '无门板' ? '-' : `¥${item.base_price}`}</td>
                      <td className="p-4 text-center space-x-4"><button onClick={() => {setEditId(item.id); setDoorForm(item);}} className="text-blue-600 hover:underline">编辑</button><button onClick={() => handleDelete('materials_door', item.id)} className="text-rose-500 hover:underline">删除</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- 视图 3: 升级与五金管理 --- */}
        {currentView === 'upgrade' && (
          <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
            <div className="flex justify-between items-end border-b-2 border-black pb-2">
              <h2 className="text-2xl font-bold text-gray-800">升级项目与五金库</h2>
              <span className="text-sm text-gray-500">支持 6 种智能计价模式与自动扣底价运算</span>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <h3 className="font-bold text-gray-800 mb-4">{editId ? '📝 编辑升级项' : '➕ 新增升级项'}</h3>
              <form onSubmit={handleSaveUpgrade} className="space-y-4">
                <div className="grid grid-cols-4 gap-4">
                  <div><label className="block text-xs text-gray-500 mb-1">项目名称</label><input required value={upgradeForm.name} onChange={e=>setUpgradeForm({...upgradeForm, name:e.target.value})} className="w-full border-2 border-gray-200 p-2 rounded-lg" placeholder="如: 玻璃门 / 抽屉" /></div>
                  <div><label className="block text-xs text-gray-500 mb-1">类别归属</label><select value={upgradeForm.type} onChange={e=>setUpgradeForm({...upgradeForm, type:e.target.value})} className="w-full border-2 border-gray-200 p-2 rounded-lg bg-white"><option>门板局部</option><option>五金系统</option><option>灯光照明</option><option>其它工艺</option></select></div>
                  <div><label className="block text-xs text-gray-500 mb-1">系统计价方式 (核心)</label><select value={upgradeForm.calculation_type} onChange={e=>setUpgradeForm({...upgradeForm, calculation_type:e.target.value})} className="w-full border-2 border-gray-200 p-2 rounded-lg bg-white font-bold text-blue-700"><option>按面积㎡</option><option>按延米</option><option>按个</option><option>按套</option><option>按柜宽自动算</option><option>人工直接输金额</option></select></div>
                  <div className="flex gap-2">
                    <div className="w-1/3"><label className="block text-xs text-gray-500 mb-1">单位</label><input value={upgradeForm.unit} onChange={e=>setUpgradeForm({...upgradeForm, unit:e.target.value})} className="w-full border-2 border-gray-200 p-2 rounded-lg text-center" /></div>
                    <div className="flex-1"><label className="block text-xs text-gray-500 mb-1">单价 (元)</label><input type="number" disabled={upgradeForm.calculation_type === '人工直接输金额'} value={upgradeForm.unit_price} onChange={e=>setUpgradeForm({...upgradeForm, unit_price:e.target.value})} className="w-full border-2 border-gray-200 p-2 rounded-lg disabled:bg-gray-100" /></div>
                  </div>
                </div>
                
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl grid grid-cols-3 gap-6 items-start">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">升级计算模式</label>
                    <select value={upgradeForm.upgrade_mode} onChange={e=>setUpgradeForm({...upgradeForm, upgrade_mode:e.target.value})} className="w-full border-2 border-gray-300 p-2 rounded-lg bg-white">
                      <option value="add">直接追加收费 (如：五金、灯带)</option>
                      <option value="replace">局部替换升级 (如：玻璃门替换木门)</option>
                    </select>
                  </div>
                  {upgradeForm.upgrade_mode === 'replace' && (
                    <div className="animate-fade-in">
                      <label className="block text-sm font-bold text-rose-600 mb-2">替换扣底逻辑 (供应链适配)</label>
                      <select value={upgradeForm.replace_calculation_mode} onChange={e=>setUpgradeForm({...upgradeForm, replace_calculation_mode:e.target.value})} className="w-full border-2 border-rose-200 bg-rose-50 p-2 rounded-lg">
                        <option value="full_price">本项为全价 (系统自动扣减原基础门板钱)</option>
                        <option value="difference_price">本项为补差价 (系统直接加差价，不扣原门板)</option>
                      </select>
                    </div>
                  )}
                  <div className="flex flex-col gap-3 pt-2">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"><input type="checkbox" checked={upgradeForm.is_standard_item} onChange={e=>setUpgradeForm({...upgradeForm, is_standard_item:e.target.checked})} className="w-4 h-4 accent-black" /> 设为开单默认标配项</label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"><input type="checkbox" checked={upgradeForm.allow_manual_edit} onChange={e=>setUpgradeForm({...upgradeForm, allow_manual_edit:e.target.checked})} className="w-4 h-4 accent-black" /> 允许销售开单时手工改数量</label>
                  </div>
                </div>
                <div className="flex justify-end pt-2"><button type="submit" className="bg-black text-white px-8 py-3 rounded-xl font-bold shadow hover:bg-gray-800">{editId ? '保存全部修改' : '确认写入项目库'}</button></div>
              </form>
            </div>
            
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-200"><tr className="divide-x divide-gray-100"><th className="p-4">项目与类别</th><th className="p-4">计价规则</th><th className="p-4">单价</th><th className="p-4">叠加模式</th><th className="p-4 text-center">操作</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {upgrades.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="p-4"><div className="font-bold text-gray-800 text-base">{item.name} {item.is_standard_item && <span className="ml-2 text-xs bg-black text-white px-1 rounded">标配</span>}</div><div className="text-xs text-gray-400 mt-1">{item.type}</div></td>
                      <td className="p-4 font-bold text-blue-700">{item.calculation_type}</td>
                      <td className="p-4 text-lg font-medium">{item.calculation_type === '人工直接输金额' ? '按实输' : `¥${item.unit_price}/${item.unit}`}</td>
                      <td className="p-4">
                        {item.upgrade_mode === 'add' ? <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded text-xs font-bold">直接追加</span> : 
                        <div className="text-rose-600 bg-rose-50 px-2 py-1 rounded text-xs font-bold">局部替换 ({item.replace_calculation_mode === 'full_price' ? '自动扣底价' : '纯补差价'})</div>}
                      </td>
                      <td className="p-4 text-center space-x-4"><button onClick={() => {setEditId(item.id); setUpgradeForm(item);}} className="text-blue-600 hover:underline">编辑</button><button onClick={() => handleDelete('upgrade_items', item.id)} className="text-rose-500 hover:underline">删除</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- 视图 4: 规则引擎参数 --- */}
        {currentView === 'rules' && (
          <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-800 border-b-2 border-black pb-2 inline-block">全局深度与计价规则引擎</h2>
            <form onSubmit={handleSaveRules} className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 space-y-8">
              
              <div className="border-l-4 border-blue-600 pl-4">
                <h3 className="font-bold text-gray-800 mb-4 text-lg">📏 深度规则 (毫米 mm)</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div><label className="block text-sm font-medium text-gray-600 mb-2">标准深度界限 (Standard)</label><input type="number" required value={rules.standard_depth} onChange={e=>setRules({...rules, standard_depth:e.target.value})} className="w-full border-2 border-gray-200 p-3 rounded-lg text-lg font-bold" />
                    <p className="text-xs text-gray-400 mt-2">超过此值，柜体价格将自动乘以 (实际深度÷标准深度)</p>
                  </div>
                  <div><label className="block text-sm font-medium text-gray-600 mb-2">浅柜判定界限 (Shallow)</label><input type="number" required value={rules.shallow_depth} onChange={e=>setRules({...rules, shallow_depth:e.target.value})} className="w-full border-2 border-gray-200 p-3 rounded-lg text-lg font-bold" />
                    <p className="text-xs text-gray-400 mt-2">小于或等于此值，将直接调用材质的“浅柜单价”</p>
                  </div>
                </div>
              </div>

              <div className="border-l-4 border-rose-500 pl-4 pt-4 border-t border-gray-100">
                <h3 className="font-bold text-gray-800 mb-4 text-lg">📐 面积与延米转换规则</h3>
                <div className="grid grid-cols-3 gap-6">
                  <div><label className="block text-sm font-medium text-gray-600 mb-2">延米计价高度阈值(mm)</label><input type="number" required value={rules.height_threshold} onChange={e=>setRules({...rules, height_threshold:e.target.value})} className="w-full border-2 border-gray-200 p-3 rounded-lg text-lg font-bold" />
                    <p className="text-xs text-gray-400 mt-2">高度 ≤ 此值时，系统自动切为按宽度的“延米计价”</p>
                  </div>
                  <div><label className="block text-sm font-medium text-gray-600 mb-2">最低计算面积 (㎡)</label><input type="number" step="0.1" required value={rules.minimum_area} onChange={e=>setRules({...rules, minimum_area:e.target.value})} className="w-full border-2 border-gray-200 p-3 rounded-lg text-lg font-bold" />
                    <p className="text-xs text-gray-400 mt-2">按面积算时，不足此值按此值算</p>
                  </div>
                  <div><label className="block text-sm font-medium text-gray-600 mb-2">最低计算宽度 (mm)</label><input type="number" required value={rules.minimum_width} onChange={e=>setRules({...rules, minimum_width:e.target.value})} className="w-full border-2 border-gray-200 p-3 rounded-lg text-lg font-bold" />
                    <p className="text-xs text-gray-400 mt-2">按延米算时，宽度不足此值按此算</p>
                  </div>
                </div>
              </div>

              <div className="pt-4"><button type="submit" className="w-full bg-black text-white p-4 rounded-xl font-bold shadow-lg hover:bg-gray-800 text-lg">保存全局引擎规则</button></div>
            </form>
          </div>
        )}

      </div>

      {/* 消息提示框 */}
      {toast.show && (
        <div className="fixed top-8 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in">
          <div className={`px-8 py-4 rounded-full shadow-2xl font-bold text-sm flex items-center gap-3 ${toast.type === 'error' ? 'bg-rose-600' : 'bg-black'} text-white`}>
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
