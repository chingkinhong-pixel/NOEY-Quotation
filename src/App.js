import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode'; // 确保在文件顶部引入

const rawSupabaseUrl = 'https://muwzdigtehcperweliyg.supabase.co/rest/v1/'; 
const supabaseKey = 'sb_publishable_SGHvdmqpvo3Z6GekTtk4cA_PcvbDGpd';
const supabaseUrl = rawSupabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabase = createClient(supabaseUrl, supabaseKey);

// ==========================================
// 【常量】：默认 NOEY 报价条款模板
// ==========================================
const DEFAULT_TERMS = `一、合同与确认
1.1 本报价单经甲乙双方确认后，与正式合同具有同等法律效力。
1.2 本报价所对应的设计方案、结构图纸及清单为本报价单的重要组成部分。
1.3 甲方须在确认设计方案及报价内容无误后签字确认，确认后双方不得单方面更改。
1.4 如需调整方案或产品内容，须经双方协商一致，并重新确认图纸及报价后方可执行。
1.5 因单方擅自更改设计或图纸所产生的延期或额外费用，由变更方承担。
1.6 如设计图纸由甲方提供，甲方须确保图纸准确无误，否则因图纸问题导致的一切后果由甲方承担。
1.7 本报价有效期为 7天，超期需重新确认价格。
二、产品与质量说明
2.1 所有产品均按确认图纸进行生产。
2.2 板材、铝型材、实木、台面等材料因天然或工艺原因，颜色及纹理存在轻微差异，属正常现象，不视为质量问题。
2.3 产品与样品之间存在合理色差及纹理差异，乙方保证整体效果相似即视为合格。
2.4 产品尺寸允许存在 ±2%误差范围，属行业合理标准，不视为质量问题。
2.5 效果图及展示图片仅供参考，最终以确认的结构图及清单为准。
三、安装与现场责任
3.1 安装前，甲方需提供完整的水、电、燃气等管线走位信息或明确标识。
3.2 如因甲方未提供或标识不清导致施工过程中产生损坏，相关责任由甲方承担。
3.3 安装现场需具备基本施工条件，否则产生的额外费用由甲方承担。
3.4 所有尺寸以现场最终复尺为准。
四、付款与交付
4.1 订单确认后，甲方需支付总金额的 50%作为定金。
4.2 出货前三天需支付 40%货款，否则乙方有权暂停发货。
4.3 安装完成并验收无误后，支付剩余尾款。
4.4 若订单金额低于 ¥5000，需全额付款后方可生产。
4.5 生产周期自确认最终图纸并支付定金后次日开始计算，周期为约 25个自然日（具体以实际工艺为准）。
五、价格与配置说明
5.1 本报价已包含标准五金配置（如普通铰链、普通三节轨、基础拉手、衣通等）。
5.2 非标五金或升级配置需另行计价。
5.3 厨房电器、水槽、拉篮等厨具不包含在本报价内，如需代购或安装需另行收费。
5.4 抽屉配置规则：每延米柜体默认包含1个普通抽屉（宽≤650mm），超出部分：¥120/个。
5.5 推拉门缓冲器：¥280/个（每扇门需根据开启方式配置）。
5.6 柜体计价规则：高度 <1m：按延米计价，高度 ≥1m：按平方米计价，最低计价单位：1㎡。
5.7 特殊异型结构、复杂工艺另行报价。
六、费用与售后说明
6.1 本报价为未含税价格，如需开票加收 6%税费。
6.2 本报价包含中山范围内配送及安装费用。
6.3 无电梯或特殊搬运环境产生的费用另行收取。
6.4 柜类产品质保 2年，五金件质保 1年。
6.5 提供终身有偿维护服务。`;

// ==========================================
// 【组件】：统一规范的条款渲染引擎 (支持 PDF 与移动端)
// ==========================================
const RenderTermsBlock = ({ content }) => {
  if (!content) return null;
  return (
    <div className="px-6 md:px-16 print:px-8 py-8 print:py-4 bg-white border-t border-gray-200 page-break-inside-avoid">
      <div className="flex justify-center items-center mb-6 print:mb-3">
         <div className="h-px bg-gray-200 w-12 md:w-24"></div>
         <h3 className="mx-4 text-sm font-black text-gray-800 tracking-widest uppercase">报价条款 Terms & Conditions</h3>
         <div className="h-px bg-gray-200 w-12 md:w-24"></div>
      </div>
      <div className="text-[12px] print:text-[10px] text-gray-600 leading-relaxed print:leading-normal max-w-4xl mx-auto space-y-1.5">
        {content.split('\n').map((line, idx) => {
          const text = line.trim();
          if (!text) return null;
          // 智能识别大标题并加粗放大
          const isTitle = /^[一二三四五六七八九十]、/.test(text);
          return (
            <div key={idx} className={`${isTitle ? 'font-black text-gray-900 text-[13px] print:text-[11px] mt-5 print:mt-2 mb-2' : 'pl-2 md:pl-4'}`}>
              {text}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ==========================================
// 【组件】：纯原生手写签字 Canvas (引入防作弊、轨迹长度与时间校验)
// ==========================================
const NativeSignaturePad = ({ onSave, onClear }) => {
  const canvasRef = React.useRef(null);
  const [isDrawing, setIsDrawing] = React.useState(false);
  const [pointsCount, setPointsCount] = React.useState(0);
  const [firstStrokeTime, setFirstStrokeTime] = React.useState(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = 260; // 强制物理高度适配 css
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000000';
  }, []);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    setIsDrawing(true);
    if (!firstStrokeTime) setFirstStrokeTime(Date.now()); // 记录起笔时间
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setPointsCount(prev => prev + 1); // 记录轨迹点
  };

  const draw = (e) => {
    e.preventDefault();
    if (!isDrawing) return;
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setPointsCount(prev => prev + 2); // 绘制中加倍累加轨迹
  };

  const endDrawing = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current; 
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setPointsCount(0); // 清空防作弊数据
    setFirstStrokeTime(null);
    if (onClear) onClear();
  };

  // 【核心】：三层防作弊校验引擎
  const handleConfirm = () => {
    // 1. 空白或过少笔画校验
    if (pointsCount < 50) {
      alert('⚠️ 签名笔画过于简单，请使用正楷完整签署姓名！');
      return;
    }
    // 2. 签署时间校验
    const drawTime = (Date.now() - firstStrokeTime) / 1000;
    if (drawTime < 1.5) {
      alert('⚠️ 签名过程过快，请认真签署确认单。');
      return;
    }
    
    // 校验通过，提取 Base64
    onSave(canvasRef.current.toDataURL('image/png'));
  };

  const isSubmitDisabled = pointsCount < 50; // 实时禁用状态控制

  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full text-xs font-bold text-rose-600 mb-3 flex items-center justify-center bg-rose-50 py-2 rounded-lg border border-rose-100 shadow-sm">
        ✍️ 请使用手指完整签署姓名，签名后不可修改
      </div>
      <canvas 
        ref={canvasRef} 
        className="w-full h-[260px] border-[3px] border-gray-300 rounded-xl bg-gray-100 touch-none cursor-crosshair mb-4 shadow-inner"
        onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={endDrawing} onMouseOut={endDrawing} 
        onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={endDrawing} 
      />
      <div className="flex gap-4 w-full">
        <button onClick={clearCanvas} className="w-1/3 py-4 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300 transition-colors">
          清除重写
        </button>
        <button 
          onClick={handleConfirm} 
          disabled={isSubmitDisabled} 
          className={`flex-1 py-4 font-bold rounded-xl shadow-lg text-lg transition-all ${
            isSubmitDisabled 
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-70' 
              : 'bg-black text-white hover:bg-gray-800'
          }`}
        >
          ✅ 确认并提交签字
        </button>
      </div>
    </div>
  );
};

export default function App() {
  // ==========================================
  // 【核心修复1】：在首次 Render 前同步提取 Hash 路由（彻底消除首页闪现）
  // ==========================================
  const currentHash = typeof window !== 'undefined' ? window.location.hash : '';
  const isDirectQuoteView = currentHash.startsWith('#/quote/');
  const directQuoteId = isDirectQuoteView ? currentHash.replace('#/quote/', '') : null;

  // 将 currentView 初始值根据路由同步设定：如果是扫码进入，初始即为 'quote-view'，绝对不给 'home' 渲染的机会
  const [currentView, setCurrentView] = useState(directQuoteId ? 'quote-view' : 'home');
  // 1. 全局状态
  const [currentUser, setCurrentUser] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true); // 【核心修复】：增加路由解析初始化锁
  
  // 2. 基础数据字典状态
  const [cabinets, setCabinets] = useState([]);
  const [doors, setDoors] = useState([]);
  const [upgrades, setUpgrades] = useState([]);
  const [subUpgrades, setSubUpgrades] = useState([]); // 【V4.08 新增】二级工艺专属状态
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
  const [shareModal, setShareModal] = useState({ isOpen: false, url: '' }); // 【新增】分享弹窗状态
  
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
  // 【V4.08 新增】二级工艺表单状态与专属方法
  const [editSubId, setEditSubId] = useState(null); // 【新增】二级工艺的编辑状态
  const [subUpgradeForm, setSubUpgradeForm] = useState({
    name: '', calculation_type: '按数量', unit: '', unit_price: '', minimum_quantity: 0, description: ''
  });

  const handleSaveSubUpgrade = async (e) => {
    e.preventDefault();
    if (!editId) return; 
    try {
      const payload = {
        parent_upgrade_id: editId, name: subUpgradeForm.name, calculation_type: subUpgradeForm.calculation_type,
        unit: subUpgradeForm.unit, unit_price: parseFloat(subUpgradeForm.unit_price) || 0,
        upgrade_effect_type: 'add_cost', 
        minimum_quantity: parseFloat(subUpgradeForm.minimum_quantity) || 0, description: subUpgradeForm.description
      };
      
      if (editSubId) {
        await supabase.from('upgrade_sub_items').update(payload).eq('id', editSubId);
        showToast('✅ 二级工艺修改成功');
      } else {
        await supabase.from('upgrade_sub_items').insert([payload]);
        showToast('✅ 新增二级工艺成功');
      }
      
      setSubUpgradeForm({ name: '', calculation_type: '按数量', unit: '', unit_price: '', minimum_quantity: 0, description: '' });
      setEditSubId(null);
      fetchDictionaries();
    } catch (err) { showToast('保存二级工艺失败', 'error'); }
  };
  
  const handleDeleteSubUpgrade = async (id) => {
    if (!window.confirm('确定删除该附属工艺吗？')) return;
    try {
      await supabase.from('upgrade_sub_items').delete().eq('id', id);
      showToast('删除成功');
      fetchDictionaries();
    } catch (err) { showToast('删除失败', 'error'); }
  };

  // 4. 销售工作台专属状态
  const [quoteInfo, setQuoteInfo] = useState({ 
    quoteNo: '', customerName: '', customerPhone: '', deliveryAddress: '', status: '编辑中', terms_content: '',
    discountFinalPrice: '' // 【新增】工作台最终结算价缓存
  });
  const [quoteCabinets, setQuoteCabinets] = useState([]);
  const [activeCabinetId, setActiveCabinetId] = useState(null);
  const [upgradeModal, setUpgradeModal] = useState({
    isOpen: false, activeCategory: '门板升级', selectedItem: null, inputQty: '', inputRemark: '',
    unit_price_adjustment: 0, manual_door_area: '', subInputs: {} // 【新增】保存二级工艺的独立输入数量
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
    const [resCab, resDoor, resUpg, resRule, resSubUpg] = await Promise.all([
        supabase.from('materials_cabinet').select('*').order('name'),
        supabase.from('materials_door').select('*').order('name'),
        supabase.from('upgrade_items').select('*').order('sort_order').order('name'),
        supabase.from('pricing_rules').select('*').limit(1),
        supabase.from('upgrade_sub_items').select('*').order('created_at') // 拉取二级工艺
      ]);
      if (resCab.data) setCabinets(resCab.data);
      if (resDoor.data) setDoors(resDoor.data);
      if (resUpg.data) setUpgrades(resUpg.data);
      if (resRule.data && resRule.data.length > 0) setRules(resRule.data[0]);
      if (resSubUpg.data) setSubUpgrades(resSubUpg.data);
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

// ==========================================
  // 【修复】：原生路由拦截引擎 (兼容旧版二维码 + Hash路由防闪屏)
  // ==========================================
  useEffect(() => {
    const path = window.location.pathname;
    const hash = window.location.hash;

    // 1. 【新增】：向下兼容旧版二维码 (/quote/xxxx)
    if (path.startsWith('/quote/')) {
      const oldQuoteId = path.replace('/quote/', '').replace(/\/$/, '');
      if (oldQuoteId) {
        // 强制跳转为 hash 路由（不保留历史记录），利用 location.origin 确保根路径准确
        window.location.replace(`${window.location.origin}/#/quote/${oldQuoteId}`);
        return; // 直接 return，不解除 isInitializing 锁，等待浏览器完成 URL 替换与刷新
      }
    }

    // 2. 【保留】：处理标准新版二维码 (#/quote/xxxx)
    if (hash.startsWith('#/quote/')) {
      const quoteId = hash.replace('#/quote/', '');
      if (quoteId) {
        // 🔥 关键：先切页面状态
        setCurrentView('quote-view'); 
        
        // 再加载数据
        handleLoadClientView(quoteId);
      }
    }

    // 解析完毕，解除渲染锁
    setIsInitializing(false);
  }, []);
  
  const handleLoadClientView = async (quoteId) => {
    setIsLoading(true);
    try {
      // 脱离后台验证，直接根据 ID 获取快照数据
      const { data: quoteData, error: quoteErr } = await supabase.from('quotes').select('*').eq('id', quoteId).single();
      if (quoteErr || !quoteData) throw new Error('报价单不存在');

      const { data: cabData, error: cabErr } = await supabase.from('quote_cabinets').select('*').eq('quote_id', quoteData.id);
      if (cabErr) throw cabErr;

      let upgData = [];
      if (cabData && cabData.length > 0) {
        const { data: uData, error: upgErr } = await supabase.from('quote_upgrades').select('*').in('cabinet_id', cabData.map(c => c.id));
        if (upgErr) throw upgErr;
        upgData = uData || [];
      }

      setPreviewData({ quote: quoteData, cabinets: cabData || [], upgrades: upgData });
      setCurrentView('quote-view'); // 切换至客户独立视图
    } catch (err) {
      showToast('获取客户报价单失败，链接可能无效', 'error');
      setCurrentView('home');
    } finally {
      setIsLoading(false);
    }
  };

  // 【修复】：客户签字持久化保存
  const handleConfirmSignature = async (base64Image) => {
    setIsLoading(true);
    try {
      const now = new Date().toISOString();
      await supabase.from('quotes').update({ 
        customer_signature: base64Image, is_signed: true, signed_at: now, status: '已确认签字',
        terms_locked: true // 【新增】：签字同时锁定条款
      }).eq('id', previewData.quote.id);
      
      setPreviewData(prev => ({ 
        ...prev, 
        quote: { ...prev.quote, customer_signature: base64Image, is_signed: true, signed_at: now, status: '已确认签字' } 
      }));
      showToast('✅ 报价单已成功签署并永久固化！', 'success');
    } catch (err) {
      showToast('签字提交失败，请重试', 'error');
    } finally { setIsLoading(false); }
  };

  // 【新增】：监听弹窗打开并绘制二维码
  useEffect(() => {
    if (shareModal.isOpen && shareModal.url) {
      const canvas = document.getElementById('share-qr-canvas');
      if (canvas) QRCode.toCanvas(canvas, shareModal.url, { width: 200, margin: 1 });
    }
  }, [shareModal.isOpen, shareModal.url]);
  
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
    setQuoteInfo({ 
      quoteNo: generateQuoteNo(), customerName: '', customerPhone: '', deliveryAddress: '', status: '编辑中',
      terms_content: rules.terms_template || DEFAULT_TERMS, discountFinalPrice: '' // 重置折扣价
    });
    const initCabId = 'cab-' + Date.now();
    setQuoteCabinets([{ 
      id: initCabId, space: '主卧', cabinetType: '衣柜', width: '', height: '', depth: '',
      cabinet_mat_id: '', snap_cabinet_brand: '', snap_cabinet_color: '', cabinet_thickness: '18', cabinet_material_remark: '', snap_back_panel_spec: '9mm标准', cabinet_unit_adjustment: '', door_material_remark: '',
      door_mat_id: '', snap_door_brand: '', snap_door_color: '', snap_door_surface_finish: '', door_unit_adjustment: '', door_material_remark: '', upgrades: []
    }]);
    setActiveCabinetId(initCabId);
    setSalesOrigin('home'); 
    setCurrentView('sales');
  };
  
  // 【修复】：删除防呆拦截 (强提示)
  const handleDeleteQuote = async (quoteId) => {
    const quote = historyList.find(q => q.id === quoteId);
    const warningMsg = quote?.is_signed 
      ? "⚠️ 此报价已被客户确认（含签字与最终结算价）！\n确定要强行删除吗？删除后无法恢复！" 
      : "确定删除该报价草稿？删除后无法恢复";
    
    if (!window.confirm(warningMsg)) return;
    setIsLoading(true);
    try {
      const { data: cabs } = await supabase.from('quote_cabinets').select('id').eq('quote_id', quoteId);
      if (cabs && cabs.length > 0) {
        const cabIds = cabs.map(c => c.id);
        await supabase.from('quote_upgrades').delete().in('cabinet_id', cabIds);
      }
      await supabase.from('quote_cabinets').delete().eq('quote_id', quoteId);
      await supabase.from('quotes').delete().eq('id', quoteId);
      showToast('记录已彻底删除');
      fetchHistoryList();
    } catch (err) { showToast('删除失败: ' + err.message, 'error'); } finally { setIsLoading(false); }
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

// ==========================================
  // 【V4.03 新增】：直连本地的高精度 PDF 生成引擎 (防截断修复)
  // ==========================================
  const generatePDF = (element, filename) => {
    // 【核心修复】：临时强行锁死元素的桌面级宽度，防止 html2canvas 截取时被当前窗口尺寸截断
    const originalWidth = element.style.width;
    const originalMaxWidth = element.style.maxWidth;
    element.style.width = '1024px';
    element.style.maxWidth = '1024px';

    const opt = {
      margin:       [15, 0, 15, 0], // 上下留白 15mm，左右0 (因为内容区自带 px-16 的内边距)
      filename:     filename,
      image:        { type: 'jpeg', quality: 1 },
      html2canvas:  { scale: 2, useCORS: true, scrollY: 0 }, 
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    window.html2pdf().set(opt).from(element).save().then(() => {
      // 渲染完毕后，瞬间恢复原有响应式样式
      element.style.width = originalWidth;
      element.style.maxWidth = originalMaxWidth;
      setIsLoading(false);
      showToast('✅ PDF 报价单已成功下载到本地！');
    }).catch(err => {
      element.style.width = originalWidth;
      element.style.maxWidth = originalMaxWidth;
      setIsLoading(false);
      showToast('PDF生成失败，请尝试使用旁边的【打印】功能', 'error');
    });
  };
  
// ==========================================
  // 【V4.06 最终修复】：直连本地的高精度 PDF 生成引擎 (A4 原生像素渲染法)
  // ==========================================
  const handleDownloadPDF = () => {
    setIsLoading(true);
    showToast('正在为您渲染并下载 PDF 文件，请稍候...', 'success');
    
    const element = document.getElementById('quote-document-container');
    const filename = `NOEY_Quotation_${previewData?.quote?.quote_no || 'Document'}.pdf`;

    const generatePDF = () => {
      // 1. 记录它原本在屏幕上的大尺寸
      const originalMaxWidth = element.style.maxWidth;
      const originalWidth = element.style.width;

      // 2. 🚨 核心真理修复：把网页强行缩小到 A4 纸的标准物理像素宽度 (800px)！
      // 这样截出来的画布 1:1 完美契合 A4，再也不需要引擎去费力计算缩放和偏移了。
      element.style.maxWidth = '800px';
      element.style.width = '800px';

      // 3. 极简参数，去掉了所有乱七八糟的坐标干扰
      const opt = {
        margin:       [10, 0, 10, 0], // 上下留白 10mm
        filename:     filename,
        image:        { type: 'jpeg', quality: 1 },
        html2canvas:  { scale: 2, useCORS: true }, 
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' } 
      };
      
      window.html2pdf().set(opt).from(element).save().then(() => {
        // 瞬间恢复成原来的大尺寸，客户毫无察觉
        element.style.maxWidth = originalMaxWidth;
        element.style.width = originalWidth;
        setIsLoading(false);
        showToast('✅ PDF 报价单已成功下载！');
      }).catch(err => {
        element.style.maxWidth = originalMaxWidth;
        element.style.width = originalWidth;
        setIsLoading(false);
        showToast('PDF生成失败', 'error');
      });
    };

    if (!window.html2pdf) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.onload = generatePDF;
      document.body.appendChild(script);
    } else {
      generatePDF();
    }
  };
  
    // 【修复】：历史报价重组引擎 (增加防篡改拦截与折扣价)
  const handleLoadQuoteForEditing = async (quote) => {
    // ⚠️ 防篡改拦截：强提示包含结算价
    if (quote.is_signed || quote.terms_locked) {
      if (!window.confirm("⚠️ 此报价已被客户确认（含最终结算价），是否继续编辑？\n继续编辑将清除客户签名并解除锁定。")) return;
      await supabase.from('quotes').update({ is_signed: false, customer_signature: null, signed_at: null, terms_locked: false, status: '已保存草稿' }).eq('id', quote.id);
      quote.is_signed = false;
      quote.customer_signature = null;
      quote.terms_locked = false;
      quote.status = '已保存草稿';
    }
    
    setIsLoading(true);
    try {
      // 1. 还原主单信息 (加入 discountFinalPrice 映射)
      setQuoteInfo({
        quoteNo: quote.quote_no, customerName: quote.customer_name || '',
        customerPhone: quote.customer_phone || '', deliveryAddress: quote.delivery_address || '', status: quote.status || '编辑中',
        terms_content: quote.terms_content || rules.terms_template || DEFAULT_TERMS,
        discountFinalPrice: quote.discount_final_price || '' // 【回显】：历史成交价
      });

      const { data: cabData, error: cabErr } = await supabase.from('quote_cabinets').select('*').eq('quote_id', quote.id);
      if (cabErr) throw cabErr;

      let upgData = [];
      if (cabData && cabData.length > 0) {
        const cabinetIds = cabData.map(cab => cab.id);
        const { data: uData, error: upgErr } = await supabase.from('quote_upgrades').select('*').in('cabinet_id', cabinetIds);
        if (upgErr) throw upgErr;
        upgData = uData || [];
      }

      if (cabData && cabData.length > 0) {
        const reconstructedCabinets = cabData.map(dbCab => {
          let space = '未知空间'; let cabinetType = '未知柜体';
          if (dbCab.name) {
            if (dbCab.name.includes('｜')) {
              const parts = dbCab.name.split('｜');
              space = parts[0] || space; cabinetType = parts[1] || cabinetType;
            } else space = dbCab.name;
          }

          const cabUpgrades = upgData.filter(u => u.cabinet_id === dbCab.id).map(dbUpg => {
            const dictItem = upgrades.find(u => u.id === dbUpg.upgrade_item_id) || {};
            return {
              id: dbUpg.id, item_id: dbUpg.upgrade_item_id,
              name: dbUpg.snap_upgrade_name || dictItem.name || '已失效未知工艺',
              category: dictItem.upgrade_category || '未知分类', unit: dictItem.unit || '项',
              snap_original_unit_price: dbUpg.snap_original_unit_price || 0, unit_price_adjustment: dbUpg.unit_price_adjustment || 0,
              calculation_type: dictItem.calculation_type || '按面积㎡', upgrade_effect_type: dbUpg.snap_upgrade_effect_type || 'add_cost',
              replace_calculation_mode: dictItem.replace_calculation_mode || null,
              input_quantity: dbUpg.input_quantity || 0, minimum_quantity: dictItem.minimum_quantity || 0,
              manual_door_area: dbUpg.manual_door_area || '', remark: dbUpg.remark || '', combo_type: dictItem.combo_type || 'single',
              snap_material: dbUpg.snap_material || '', snap_style: dbUpg.snap_style || '', snap_specification: dbUpg.snap_specification || '',
              parent_record_id: dbUpg.parent_record_id || null
            };
          });

          return {
            id: dbCab.id, space: space, cabinetType: cabinetType,
            width: dbCab.width || '', height: dbCab.height || '', depth: dbCab.depth || '',
            cabinet_mat_id: dbCab.cabinet_mat_id || '', door_mat_id: dbCab.door_mat_id || '',
            snap_cabinet_brand: dbCab.snap_cabinet_brand || '', snap_cabinet_color: dbCab.snap_cabinet_color || '',
            cabinet_thickness: dbCab.cabinet_thickness || '18', cabinet_material_remark: dbCab.cabinet_material_remark || '',
            snap_back_panel_spec: dbCab.snap_back_panel_spec || '9mm标准', cabinet_unit_adjustment: dbCab.cabinet_unit_adjustment || '',
            snap_door_brand: dbCab.snap_door_brand || '', snap_door_color: dbCab.snap_door_color || '',
            door_unit_adjustment: dbCab.door_unit_adjustment || '', door_material_remark: dbCab.door_material_remark || '',
            snap_door_surface_finish: dbCab.snap_door_surface_finish || '', upgrades: cabUpgrades
          };
        });
        setQuoteCabinets(reconstructedCabinets);
        setActiveCabinetId(reconstructedCabinets[0].id);
      } else {
        const fallbackId = 'cab-fallback-' + Date.now();
        setQuoteCabinets([{ 
          id: fallbackId, space: '主卧', cabinetType: '衣柜', width: '', height: '', depth: '',
          cabinet_mat_id: '', snap_cabinet_brand: '', snap_cabinet_color: '', cabinet_thickness: '18', cabinet_material_remark: '', snap_back_panel_spec: '9mm标准', cabinet_unit_adjustment: '', door_material_remark: '',
          door_mat_id: '', snap_door_brand: '', snap_door_color: '', door_unit_adjustment: '', door_material_remark: '', upgrades: []
        }]);
        setActiveCabinetId(fallbackId);
      }
      setSalesOrigin('sales-history');
      setCurrentView('sales');
      showToast('草稿已成功恢复！');
    } catch (err) {
      showToast('读取草稿失败: ' + err.message, 'error');
    } finally { setIsLoading(false); }
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

    // 【第一重防呆】：一级工艺起算量硬拦截
    const minQ = parseFloat(item.minimum_quantity) || 0;
    let finalInputQty = parseFloat(upgradeModal.inputQty) || 0;
    
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
    
    // 生成一级工艺记录
    const newUpgrade = {
      id: parentId, item_id: item.id, name: item.name, category: item.upgrade_category, unit: item.unit, 
      snap_original_unit_price: item.unit_price, unit_price_adjustment: parseFloat(upgradeModal.unit_price_adjustment) || 0,
      calculation_type: item.calculation_type, upgrade_effect_type: item.upgrade_effect_type, replace_calculation_mode: item.replace_calculation_mode,
      input_quantity: finalInputQty, minimum_quantity: item.minimum_quantity,
      manual_door_area: upgradeModal.manual_door_area, remark: upgradeModal.inputRemark || '', combo_type: 'single',
      parent_record_id: null
    };

    let itemsToAdd = [newUpgrade];

    // 【V4.08 真实关系映射】：从全局 subUpgrades 中筛出属于该工艺的二级工艺，直接带出
    const relatedSubs = subUpgrades.filter(sub => sub.parent_upgrade_id === item.id);
    let childCorrectionMsg = '';

    if (relatedSubs.length > 0) {
      relatedSubs.forEach((childItem, index) => {
        // ⚠️ 核心修复：移除了所有的 ?. 语法，保证编译 100% 通过
        let childInput = parseFloat(upgradeModal.subInputs && upgradeModal.subInputs[childItem.id]) || 0;
        const childMin = parseFloat(childItem.minimum_quantity) || 0;
        
        // 自动纠正：低于后台设置的起算量，强行拉回
        if (childInput < childMin) {
            childInput = childMin; 
            childCorrectionMsg = `部分附属工艺低于自身起算量，已自动纠正`;
        }
        
        itemsToAdd.push({
          id: parentId + '-child-' + index, item_id: childItem.id, name: childItem.name, category: item.upgrade_category, 
          unit: childItem.unit, snap_original_unit_price: childItem.unit_price, unit_price_adjustment: 0,
          calculation_type: childItem.calculation_type, upgrade_effect_type: childItem.upgrade_effect_type, replace_calculation_mode: null,
          input_quantity: childInput, minimum_quantity: childItem.minimum_quantity,
          manual_door_area: '', remark: childItem.description || '', // 继承二级工艺后台填的说明
          combo_type: 'single',
          parent_record_id: parentId // 绝对隔离：绑定父子关系快照
        });
      });
      showToast(`已添加工艺。${childCorrectionMsg}`);
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
        quote_no: quoteInfo.quoteNo, customer_name: quoteInfo.customerName,
        customer_phone: quoteInfo.customerPhone, delivery_address: quoteInfo.deliveryAddress,
        status: quoteInfo.status === '编辑中' ? '已保存草稿' : quoteInfo.status,
        total_amount: grandTotal, updated_at: new Date().toISOString(),
        terms_content: quoteInfo.terms_content, terms_version: 'v1.0',
        discount_final_price: parseFloat(quoteInfo.discountFinalPrice) || null // 【新增】保存最终人工结算价
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
          door_material_remark: cab.door_material_remark || '', // 核心修复：确保门板备注存入数据库
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
              quantity: calculatedMatch.calculatedQty, unit: u.unit || '', remark: u.remark || '',
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
            <button onClick={() => { setUpgradeModal({...upgradeModal, isOpen: false}); setUpgradeSearchQuery(''); }} className="w-10 h-10 bg-gray-100 rounded-full font-bold text-gray-600">✕</button>
          </div>
          <div className="flex flex-1 overflow-hidden">
            <div className="w-48 bg-gray-50 border-r border-gray-100 flex flex-col p-4 gap-2">
              {categories.map(cat => (
                <button key={cat} onClick={() => { setUpgradeModal({...upgradeModal, activeCategory: cat, selectedItem: null}); setUpgradeSearchQuery(''); }}
                  className={`text-left px-4 py-3 rounded-xl font-bold text-sm ${upgradeModal.activeCategory === cat ? 'bg-black text-white' : 'text-gray-500 hover:bg-white'}`}>
                  {cat}
                </button>
              ))}
            </div>
            
            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 flex flex-col border-r border-gray-100 bg-white">
                <div className="p-4 border-b border-gray-50">
                   <input type="text" placeholder={`在 "${upgradeModal.activeCategory}" 中搜索工艺...`} 
                          value={upgradeSearchQuery} onChange={e => setUpgradeSearchQuery(e.target.value)} 
                          className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl text-sm font-bold focus:bg-white outline-none focus:border-black transition-colors" />
                </div>
                <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-4 content-start">
                  {filteredItems.map(item => (
                  <div key={item.id} onClick={() => {
                      const relSubs = subUpgrades.filter(s => s.parent_upgrade_id === item.id);
                      const initialSubInputs = {};
                      // 选中时，读取每个二级工艺自己的最低起算量作为默认值
                      relSubs.forEach(s => initialSubInputs[s.id] = s.minimum_quantity > 0 ? s.minimum_quantity : 1);
                      setUpgradeModal({...upgradeModal, selectedItem: item, inputQty: '', inputRemark: '', subInputs: initialSubInputs});
                  }}
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
                   
                   {/* 这里是修复关键点：完全闭合内部函数块 */}
                   {(() => {
                      const isExcessDrawer = upgradeModal.selectedItem.calculation_type === 'excess_drawer' || upgradeModal.selectedItem.calculation_type === '超额抽屉规则';
                      return (
                        <div className="space-y-5 flex-1 overflow-y-auto pr-2">
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

                          {/* 【二级工艺独立输入框：安全闭合版】 */}
                          {(() => {
                            const relSubs = subUpgrades.filter(s => s.parent_upgrade_id === upgradeModal.selectedItem.id);
                            if (relSubs.length === 0) return null;
                            return (
                                <div className="mt-4 p-4 bg-blue-50/50 rounded-xl border border-blue-100 space-y-3">
                                    <div className="text-xs font-black text-blue-900 uppercase tracking-widest mb-2 border-b border-blue-200 pb-2">专属附属工艺 (独立计量)</div>
                                    {relSubs.map(sub => (
                                        <div key={sub.id} className="flex justify-between items-center gap-4">
                                            <div className="flex-1">
                                                <div className="text-sm font-bold text-gray-800">{sub.name}</div>
                                                <div className="text-[10px] text-gray-500">单价: ¥{sub.unit_price}/{sub.unit} | 最低起算: <span className="font-bold text-blue-600">{sub.minimum_quantity || '无'}</span></div>
                                            </div>
                                            <div className="w-24 shrink-0">
                                                <label className="block text-[10px] font-bold text-blue-600 mb-1">数量设定</label>
                                                <input type="number" step="0.01" 
                                                       value={(upgradeModal.subInputs && upgradeModal.subInputs[sub.id]) || ''} 
                                                       onChange={e => setUpgradeModal({...upgradeModal, subInputs: {...(upgradeModal.subInputs || {}), [sub.id]: e.target.value}})} 
                                                       className="w-full border-2 border-blue-200 p-2 rounded-lg font-black text-sm text-center bg-white shadow-inner" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                          })()}

                        </div>
                      );
                    })()}
                    
                    <button onClick={handleConfirmAddUpgrade} className="w-full bg-black text-white py-4 rounded-xl font-black mt-4 shrink-0">确认加入核算</button>
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
                  <div className="col-span-2"><label className="text-xs font-bold text-gray-500">选材备注</label><input placeholder="特殊说明、非标要求等" value={activeCabinet.cabinet_material_remark || ''} onChange={e=>updateActiveCabinet('cabinet_material_remark', e.target.value)} className="w-full border-2 p-2 rounded-lg font-bold mt-1 bg-gray-50 focus:bg-white transition-colors" /></div>
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
                
                {/* 第一排：基础属性 (5列网格，底价占2列) */}
                <div className="grid grid-cols-5 gap-4 mb-4">
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-gray-500">系统门板底价 (或敞开柜)</label>
                    <select 
                      value={activeCabinet.door_mat_id} 
                      onChange={e => {
                        const val = e.target.value;
                        const doorDict = doors.find(d => d.id === val);
                        setQuoteCabinets(prev => prev.map(c => c.id === activeCabinetId ? { ...c, door_mat_id: val, snap_door_surface_finish: doorDict ? (doorDict.surface_finish || '') : '' } : c));
                      }} 
                      className="w-full border-2 p-2 rounded-lg font-bold mt-1"
                    >
                      <option value="">-- 无门板敞开柜 --</option>
                      {doors.map(d => <option key={d.id} value={d.id}>{d.name} (¥{d.base_price})</option>)}
                    </select>
                  </div>
                  <div><label className="text-xs font-bold text-blue-600">表面工艺(可改)</label><input value={activeCabinet.snap_door_surface_finish || ''} onChange={e=>updateActiveCabinet('snap_door_surface_finish', e.target.value)} placeholder="如:肤感膜" className="w-full border-2 border-blue-100 p-2 rounded-lg font-bold mt-1 bg-blue-50 focus:bg-white" /></div>
                  <div><label className="text-xs font-bold text-gray-500">指定品牌</label><input value={activeCabinet.snap_door_brand || ''} onChange={e=>updateActiveCabinet('snap_door_brand', e.target.value)} className="w-full border-2 p-2 rounded-lg font-bold mt-1" /></div>
                  <div><label className="text-xs font-bold text-gray-500">指定颜色</label><input value={activeCabinet.snap_door_color || ''} onChange={e=>updateActiveCabinet('snap_door_color', e.target.value)} className="w-full border-2 p-2 rounded-lg font-bold mt-1" /></div>
                </div>

                {/* 第二排：选材备注 (单列占满) */}
                <div className="mb-4">
                  <label className="text-xs font-bold text-gray-500">选材备注</label>
                  <input value={activeCabinet.door_material_remark || ''} onChange={e=>updateActiveCabinet('door_material_remark', e.target.value)} placeholder="特殊说明、非标要求等" className="w-full border-2 p-2 rounded-lg font-bold mt-1 bg-gray-50 focus:bg-white transition-colors" />
                </div>

                {/* 第三排：人工调价 */}
                <div className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border">
                  <div className="text-sm font-black text-gray-900">人工调价 (元/㎡)</div>
                  <div className="flex items-center gap-4">
                    <input type="number" placeholder="+0" value={activeCabinet.door_unit_adjustment || ''} onChange={e=>updateActiveCabinet('door_unit_adjustment', e.target.value)} className="w-24 border-2 p-2 rounded-lg font-black text-center" />
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

       {/* 底部悬浮算账条 (支持最终结算磋商价) */}
        <div className="fixed bottom-0 right-0 left-80 bg-white border-t p-4 flex justify-between items-center shadow-[0_-10px_20px_rgba(0,0,0,0.02)] z-20">
          <div className="flex gap-6 pl-4 font-bold text-sm">
            <div><div className="text-[10px] text-gray-400">柜体</div>¥{currentCalcs.cabinetPortionTotal.toFixed(0)}</div>
            <div><div className="text-[10px] text-gray-400">门板</div>¥{currentCalcs.doorPortionTotal.toFixed(0)}</div>
            <div><div className="text-[10px] text-gray-400">工艺</div><span className="text-rose-600">¥{currentCalcs.upgradePortionTotal.toFixed(0)}</span></div>
          </div>
          <div className="flex gap-6 items-center pr-4">
            <div className="text-right">
              <div className="text-xs text-gray-500">当前单柜合计</div>
              <div className="text-xl font-black text-gray-800">¥{currentCalcs.baseTotal.toFixed(0)}</div>
            </div>
            <div className="h-10 w-px bg-gray-200"></div>
            <div className="text-right">
              <div className="text-xs text-gray-500">系统全案总计</div>
              <div className={`text-2xl font-black transition-colors ${quoteInfo.discountFinalPrice ? 'text-gray-400 line-through' : 'text-black'}`}>
                ¥{grandTotal.toFixed(0)}
              </div>
            </div>
            <div className="h-10 w-px bg-gray-200"></div>
            <div className="text-right flex flex-col items-end">
              <div className="text-[10px] font-black text-rose-600 tracking-widest uppercase mb-1">Discount / 最终结算价</div>
              <div className="flex items-center gap-1">
                <span className="text-lg font-black text-rose-600">¥</span>
                <input type="number" placeholder="默认系统总价" value={quoteInfo.discountFinalPrice} onChange={e=>setQuoteInfo({...quoteInfo, discountFinalPrice:e.target.value})} className="w-32 border-2 border-rose-200 bg-rose-50 px-3 py-1 rounded-lg font-black text-2xl text-rose-600 outline-none focus:border-rose-400 focus:bg-white text-right shadow-inner transition-colors" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

// ==========================================
  // 【重构】：独立客户端扫码页 (全字段展示 + 签名锁定)
  // ==========================================
  const renderClientView = () => {
    if (!previewData) return null;
    const { quote, cabinets, upgrades } = previewData;

    return (
      <div className="min-h-screen bg-gray-50 font-sans flex flex-col pb-28 selection:bg-black selection:text-white">
        {/* 顶部 Header */}
        <div className="bg-white py-6 shadow-sm flex flex-col items-center sticky top-0 z-10 border-b border-gray-200">
          <img src="/LOGO英版.png" alt="NOEY" className="h-8 mb-2 object-contain" />
          <div className="text-xs font-black text-gray-900 tracking-widest uppercase">Quotation Review</div>
        </div>

        {/* 基础信息 */}
        <div className="p-4 mt-2">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-3 text-sm">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-1"><span className="text-gray-500 font-bold">订单编号</span><span className="font-mono font-black text-base">{quote.quote_no}</span></div>
            <div className="flex justify-between"><span className="text-gray-500 font-bold">客户名称</span><span className="font-black text-gray-900">{quote.customer_name || '-'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500 font-bold">出单日期</span><span className="font-bold text-gray-800">{new Date(quote.updated_at || quote.created_at).toLocaleDateString('zh-CN')}</span></div>
            <div className="flex justify-between items-start"><span className="text-gray-500 font-bold whitespace-nowrap">交付地址</span><span className="font-bold text-gray-800 text-right">{quote.delivery_address || '-'}</span></div>
          </div>
        </div>

        {/* 方案明细 - 全量级数据映射 */}
        <div className="px-4 mt-2">
          <h2 className="text-sm font-black text-gray-900 tracking-widest uppercase mb-4 pl-3 border-l-4 border-black">定制方案明细</h2>
          <div className="space-y-6">
            {cabinets.map((cab, idx) => {
              const cabUpgs = upgrades.filter(u => u.cabinet_id === cab.id);
              
              // ==========================================
              // 【新增】：同步系统预览的计价与快照兜底逻辑
              // ==========================================
              const w = parseFloat(cab.width) || 0;
              const h = parseFloat(cab.height) || 0;
              const isArea = h > (rules?.height_threshold || 1000);
              
              // 优先级1：快照面积兜底  优先级2：系统规则推导
              const fallbackQty = Number(cab.snap_calc_area || cab.quantity || 0);
              const displayQty = fallbackQty > 0 ? fallbackQty : (isArea ? Math.max((w * h) / 1000000, rules?.minimum_area || 1) : Math.max(w / 1000, (rules?.minimum_width || 1000) / 1000));
              const unitLabel = isArea ? '㎡' : 'm';

              const cabUnitPrice = Number(cab.snap_final_cabinet_price || 0);
              const doorUnitPrice = Number(cab.snap_final_door_price || 0);
              const hasNoDoor = !cab.door_mat_id || doorUnitPrice === 0 || (cab.snap_door_brand || '').includes('无门板');

              // 严格读取已有金额进行逆推，绝不重新计算核心费用
              const excessDepthFee = Number(cab.excess_depth_fee || 0);
              const upgradesTotal = cabUpgs.reduce((sum, upg) => sum + Number(upg.snap_upgrade_price || 0), 0);
              const openCabinetSalesPrice = cab.snap_base_cabinet_cost ? Number(cab.snap_base_cabinet_cost) : Math.max(0, Number(cab.cabinet_total_price || 0) - excessDepthFee - upgradesTotal);
              
              const comprehensiveTotalAmount = hasNoDoor ? openCabinetSalesPrice : ((cabUnitPrice + doorUnitPrice) * displayQty);
              let comprehensiveUnitPrice = displayQty > 0 ? (comprehensiveTotalAmount / displayQty) : 0;

              // 终极单价兜底 (防止开放式柜体单价显示异常)
              if (comprehensiveUnitPrice === 0 && Number(cab.cabinet_total_price) > 0 && displayQty > 0) {
                 comprehensiveUnitPrice = Number(cab.cabinet_total_price) / displayQty;
              }
              // ==========================================

              return (
                <div key={cab.id} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200">
          
                  {/* 柜体表头 */}
                  <div className="bg-gray-900 text-white p-4 flex justify-between items-center">
                    <div className="font-black text-sm">{idx + 1}. {cab.name}</div>
                    <div className="text-xs font-mono text-gray-300">W{cab.width}×H{cab.height}×D{cab.depth}</div>
                  </div>

                  <div className="p-4 space-y-4">
                    {/* 柜体与门板全字段 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* 柜体配置 */}
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-xs">
                         <div className="font-black text-gray-800 border-b border-gray-200 pb-2 mb-3">🗄️ 柜体配置</div>
                         <div className="space-y-2">
                           <div className="flex justify-between"><span className="text-gray-500">材料类型</span><span className="font-bold text-gray-900">{cab.snap_cabinet_material_name || '-'}</span></div>
                           <div className="flex justify-between"><span className="text-gray-500">指定品牌</span><span className="font-bold text-gray-900">{cab.snap_cabinet_brand || '-'}</span></div>
                           <div className="flex justify-between"><span className="text-gray-500">颜色款式</span><span className="font-bold text-gray-900">{cab.snap_cabinet_color || '-'}</span></div>
                           {cab.cabinet_material_remark && <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between items-start"><span className="text-gray-500">备注</span><span className="font-bold text-rose-600 text-right">{cab.cabinet_material_remark}</span></div>}
                         </div>
                      </div>

                      {/* 门板配置 */}
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-xs">
                         <div className="font-black text-gray-800 border-b border-gray-200 pb-2 mb-3">🚪 门板配置</div>
                         <div className="space-y-2">
                           <div className="flex justify-between"><span className="text-gray-500">材料类型</span><span className="font-bold text-gray-900">{cab.snap_door_material_name || '-'}</span></div>
                           <div className="flex justify-between"><span className="text-gray-500">指定品牌</span><span className="font-bold text-gray-900">{cab.snap_door_brand || '-'}</span></div>
                           <div className="flex justify-between"><span className="text-gray-500">颜色款式</span><span className="font-bold text-gray-900">{cab.snap_door_color || '-'}</span></div>
                           <div className="flex justify-between"><span className="text-gray-500">表面工艺</span><span className="font-bold text-gray-900">{cab.snap_door_surface_finish || '-'}</span></div>
                           {cab.door_material_remark && <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between items-start"><span className="text-gray-500">备注</span><span className="font-bold text-rose-600 text-right">{cab.door_material_remark}</span></div>}
                         </div>
                      </div>
                    </div>

                    {/* 工艺配置 (严谨缩进与全量展示) */}
                    {cabUpgs.length > 0 && (
                      <div>
                        <div className="font-black text-gray-900 text-xs mb-2">✨ 升级工艺与五金</div>
                        <div className="border border-gray-200 rounded-xl overflow-hidden text-xs">
                           {cabUpgs.map((upg, i) => {
                             const isChild = !!upg.parent_record_id;
                             return (
                               <div key={upg.id} className={`p-3 flex flex-wrap justify-between items-center border-b border-gray-100 last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} ${isChild ? 'pl-8 border-l-4 border-l-gray-300' : ''}`}>
                                 <div className="w-full mb-2">
                                    <span className={isChild ? "font-bold text-gray-700" : "font-black text-gray-900"}>{isChild ? '↳ ' : ''}{upg.snap_upgrade_name}</span>
                                    {upg.remark && <div className="text-[10px] text-gray-500 mt-1">备注: {upg.remark}</div>}
                                 </div>
                                 <div className="flex justify-between w-full text-gray-600 font-mono">
                                   <span>{upg.quantity} {upg.unit}</span>
                                   <span>¥{Number(upg.snap_final_unit_price || upg.snap_unit_price || 0).toFixed(2)}</span>
                                   <span className="font-black text-rose-600">¥{Number(upg.snap_upgrade_price || 0).toFixed(2)}</span>
                                 </div>
                               </div>
                             );
                           })}
                        </div>
                      </div>
                    )}
                    
                   {/* 【修复】：移动端计价信息模块 (双列紧凑布局) */}
                    <div className="pt-4 mt-3 border-t border-gray-100">
                      <div className="flex justify-between items-center mb-3 px-1">
                        <span className="text-[11px] text-gray-500 font-medium">计价{isArea ? '面积' : '长度'}：{displayQty.toFixed(2)} {unitLabel}</span>
                        <span className="text-[11px] text-gray-800 font-medium">{hasNoDoor ? '单价' : '综合单价'}：¥{comprehensiveUnitPrice.toFixed(2)} /{unitLabel}</span>
                      </div>
                      
                      <div className="flex justify-between items-end bg-gray-50 -mx-4 px-4 py-3 border-t border-gray-100">
                        <span className="text-xs font-bold text-gray-500">单组小计 Subtotal</span>
                        <span className="text-xl font-black text-gray-900">¥ {Number(cab.cabinet_total_price).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 【新增】：手机端报价条款展示 */}
        <div className="mt-4 bg-white">
          <RenderTermsBlock content={quote.terms_content || DEFAULT_TERMS} />
        </div>

        {/* 签字确认区 (只读锁定 / 书写画板) */}
        <div className="p-6 mt-10 bg-white border-t-[4px] border-black page-break-inside-avoid">
          <h3 className="text-sm font-black text-black tracking-[0.2em] uppercase mb-6 text-center">客户签字 Signature</h3>
          {quote.is_signed && quote.customer_signature ? (
             <div className="w-full flex flex-col items-center border-2 border-gray-100 p-6 rounded-2xl bg-gray-50">
               <img src={quote.customer_signature} alt="Client Signature" className="h-32 object-contain border-b border-gray-300 px-4 pb-4 w-full" />
               <div className="mt-4 text-xs font-bold text-gray-500">✅ 本报价单已由客户确认无误</div>
               <div className="mt-1 text-xs font-mono text-gray-400">确认时间: {new Date(quote.signed_at).toLocaleString('zh-CN')}</div>
             </div>
          ) : (
             <NativeSignaturePad onSave={handleConfirmSignature} />
          )}
        </div>

        {/* 底部悬浮总价 (支持移动端折扣UI) */}
        <div className="fixed bottom-0 left-0 right-0 bg-black text-white px-6 py-4 flex justify-between items-center z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.2)] pb-safe border-t border-gray-900">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">
              {quote.discount_final_price ? 'DISCOUNT / 最终成交价' : 'TOTAL AMOUNT / 全案总计'}
            </span>
            {quote.discount_final_price && (
               <span className="text-[10px] text-gray-500 line-through mt-0.5 font-mono">Orig: ¥{Number(quote.total_amount || 0).toFixed(2)}</span>
            )}
          </div>
          <div className="text-3xl font-black text-white">
             <span className="text-lg mr-1 font-bold">¥</span>
             {Number(quote.discount_final_price || quote.total_amount || 0).toFixed(2)}
          </div>
        </div>
      </div>
    );
  };
// ==========================================
  // 【V4.07 最终优化】：商务级客户报价展示单 (极致高密度打印排版)
  // ==========================================
  const renderQuotePreview = () => {
    if (!previewData) return null;
    const { quote, cabinets, upgrades } = previewData;

    const groupedCabinets = cabinets.reduce((groups, cab) => {
      let spaceName = '未分类空间';
      if (cab.name && cab.name.includes('｜')) spaceName = cab.name.split('｜')[0].trim();
      if (!groups[spaceName]) groups[spaceName] = [];
      groups[spaceName].push(cab);
      return groups;
    }, {});

    return (
      <div className="min-h-screen bg-gray-100 font-sans flex flex-col items-center py-10 pb-20">

        {/* 专属客户分享二维码弹窗 (高定视觉版) */}
        {shareModal.isOpen && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6 backdrop-blur-sm print:hidden">
            <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center relative">
              <button onClick={() => setShareModal({ isOpen: false, url: '' })} className="absolute top-4 right-4 text-gray-400 hover:text-black font-black text-xl">✕</button>
              
              <div className="text-xl font-black text-gray-900 mb-2 tracking-widest">报价确认单</div>
              <img src="/LOGO英版.png" alt="NOEY" className="h-8 mb-6 object-contain" />
              
              <div className="p-3 border-2 border-gray-100 rounded-2xl mb-5 bg-white shadow-sm">
                <canvas id="share-qr-canvas" className="w-[200px] h-[200px]"></canvas>
              </div>
              
              <div className="text-center w-full mb-6 bg-gray-50 p-4 rounded-xl">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Order No.</div>
                <div className="font-mono font-black text-gray-900 text-base">{previewData?.quote?.quote_no}</div>
                <div className="text-xs font-bold text-gray-500 mt-2">日期：{new Date().toLocaleDateString('zh-CN')}</div>
              </div>
              
              <button onClick={() => { navigator.clipboard.writeText(shareModal.url); showToast('链接已复制'); }} className="w-full bg-black text-white py-4 rounded-xl font-bold hover:bg-gray-800 shadow-md">
                🔗 复制分享链接
              </button>
            </div>
          </div>
        )}
        
        {/* 顶部操作条 (包含新增的直接下载 PDF 按钮) */}
        <div className="w-full max-w-5xl px-4 md:px-0 mb-6 flex justify-between items-center print:hidden">
          <button onClick={() => setCurrentView('sales-history')} className="text-sm font-bold text-gray-500 hover:text-black transition-colors flex items-center gap-2">
            <span>←</span> 返回列表
          </button>
          <div className="flex gap-4">
           {/* 替换分享按钮的 onClick 内容 */}
            <button onClick={() => {
              // 【修复】：强制使用哈希路径，彻底避免服务器 404 拦截
              const url = `${window.location.origin}/#/quote/${previewData.quote.id}`;
              setShareModal({ isOpen: true, url });
            }} className="bg-black text-white px-5 py-2 rounded text-sm font-bold hover:bg-gray-800 shadow-lg flex items-center gap-2">
              ✨ 客户分享
            </button>
            <button onClick={() => window.print()} className="bg-white border border-gray-200 px-4 py-2 rounded text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm flex items-center gap-2">
              🖨️ 打印格式
            </button>
            <button onClick={handleDownloadPDF} disabled={isLoading} className="bg-black text-white px-5 py-2 rounded text-sm font-bold hover:bg-gray-800 transition-colors shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
              📥 {isLoading ? '生成中...' : '下载 PDF'}
            </button>
          </div>
        </div>

        {/* 核心文档容器 (移除 overflow-hidden 防止被切) */}
        <div id="quote-document-container" className="bg-white w-full max-w-5xl shadow-2xl print:shadow-none print:w-full pb-10 print:pb-0">
          
          {/* 顶级 Header 阵列 (完美锁定左右对齐，匹配高度) */}
          <div className="px-10 md:px-16 pt-16 pb-12 print:px-8 print:pt-6 print:pb-4 flex flex-col md:flex-row print:flex-row justify-between items-start border-b-[3px] border-black">
            {/* 左侧 Logo (强制限制最大宽度，防止被原始图片比例撑爆) */}
            <div className="w-full md:w-1/2 print:w-1/2 mb-8 md:mb-0 print:mb-0 flex items-start">
              <img src="/LOGO英版.png" alt="NOEY" className="h-32 md:h-48 print:h-auto print:w-full print:max-w-[200px] object-contain object-left-top" />
            </div>
            
            {/* 右侧 标题与严格对齐的网格数据 (收紧间距) */}
            <div className="w-full md:w-1/2 print:w-1/2 flex flex-col items-start md:items-end print:items-end">
              <h1 className="text-3xl print:text-2xl font-black text-black tracking-widest uppercase mb-6 print:mb-3">Quotation</h1>
                <table className="text-[13px] print:text-[11px] text-black border-collapse">
                <tbody>
                  <tr>
                    <td className="text-gray-500 font-medium pr-6 print:pr-4 pb-1.5 print:pb-0.5 whitespace-nowrap">
                      <div className="flex justify-between w-[92px] print:w-[78px]"><span>单号</span><span>CODE:</span></div>
                    </td>
                    <td className="font-bold text-right pb-1.5 print:pb-0.5">{quote.quote_no}</td>
                  </tr>
                  <tr>
                    <td className="text-gray-500 font-medium pr-6 print:pr-4 pb-1.5 print:pb-0.5 whitespace-nowrap">
                      <div className="flex justify-between w-[92px] print:w-[78px]"><span>日期</span><span>DATE:</span></div>
                    </td>
                    <td className="font-bold text-right pb-1.5 print:pb-0.5">{new Date(quote.updated_at || quote.created_at).toLocaleDateString('zh-CN')}</td>
                  </tr>
                  <tr>
                    <td className="text-gray-500 font-medium pr-6 print:pr-4 pb-1.5 print:pb-0.5 whitespace-nowrap">
                      <div className="flex justify-between w-[92px] print:w-[78px]"><span>客户</span><span>CUST:</span></div>
                    </td>
                    <td className="font-bold text-right pb-1.5 print:pb-0.5">{quote.customer_name || '未指定'}</td>
                  </tr>
                  <tr>
                    <td className="text-gray-500 font-medium pr-6 print:pr-4 pb-1.5 print:pb-0.5 whitespace-nowrap">
                      <div className="flex justify-between w-[92px] print:w-[78px]"><span>电话</span><span>TELE:</span></div>
                    </td>
                    <td className="font-bold text-right pb-1.5 print:pb-0.5">{quote.customer_phone || '未指定'}</td>
                  </tr>
                  <tr>
                    <td className="text-gray-500 font-medium pr-6 print:pr-4 pb-1.5 print:pb-0.5 whitespace-nowrap">
                      <div className="flex justify-between w-[92px] print:w-[78px]"><span>地址</span><span>ADDR:</span></div>
                    </td>
                    <td className="font-bold text-right pb-1.5 print:pb-0.5">{quote.delivery_address || '未指定'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 柜体清单主循环区域 (极限压缩垂直空间) */}
          <div className="px-10 md:px-16 py-12 print:px-8 print:py-4">
            {Object.entries(groupedCabinets).map(([space, spaceCabinets]) => (
              <div key={space} className="mb-14 print:mb-6 page-break-inside-avoid">
                {/* 空间大标题 */}
                <div className="flex justify-between items-end border-b-2 border-gray-900 pb-2 mb-8 print:mb-3">
                  <h3 className="text-xl print:text-base font-black text-black tracking-[0.1em] uppercase">{space}</h3>
                  <span className="text-[11px] print:text-[9px] text-gray-500 font-bold uppercase tracking-widest">/ {spaceCabinets.length} UNIT(S)</span>
                </div>
                
                {/* 极限压缩 space-y */}
                <div className="space-y-12 print:space-y-4">
                  {spaceCabinets.map(cab => {
                    const cabUpgrades = upgrades.filter(u => u.cabinet_id === cab.id);
                    const excessDepthFee = Number(cab.excess_depth_fee || 0);
                    const cabUnitPrice = Number(cab.snap_final_cabinet_price || 0);
                    const doorUnitPrice = Number(cab.snap_final_door_price || 0);
                    
                    const hasNoDoor = !cab.door_mat_id || doorUnitPrice === 0 || (cab.snap_door_brand || '').includes('无门板');
                    
                    const w = parseFloat(cab.width) || 0;
                    const h = parseFloat(cab.height) || 0;
                    const isArea = h > (rules.height_threshold || 1000);
                    const displayQty = isArea ? Math.max((w * h) / 1000000, rules.minimum_area || 1) : Math.max(w / 1000, (rules.minimum_width || 1000) / 1000);
                    const unitLabel = isArea ? '㎡' : 'm';

                    const upgradesTotal = cabUpgrades.reduce((sum, upg) => sum + Number(upg.snap_upgrade_price || 0), 0);
                    const openCabinetSalesPrice = cab.snap_base_cabinet_cost ? Number(cab.snap_base_cabinet_cost) : Math.max(0, Number(cab.cabinet_total_price || 0) - excessDepthFee - upgradesTotal);
                    const comprehensiveTotalAmount = hasNoDoor ? openCabinetSalesPrice : ((cabUnitPrice + doorUnitPrice) * displayQty);
                    const comprehensiveUnitPrice = displayQty > 0 ? (comprehensiveTotalAmount / displayQty) : 0;

                    const dispCabType = cab.snap_cabinet_material_name || cab.cabinet_material_remark || '系统柜体';
                    const dispDoorType = cab.snap_door_material_name || (cab.snap_door_brand && !cab.snap_door_brand.includes('系统') ? cab.snap_door_brand : '定制门板');

                    return (
                      <div key={cab.id} className="page-break-inside-avoid border border-gray-300 print:border-gray-400 bg-white">
                        {/* 柜体 Item 头部 (压缩 padding) */}
                        <div className="bg-gray-100 px-6 py-3 print:px-3 print:py-1.5 flex justify-between items-baseline border-b border-gray-300">
                          <h4 className="font-black text-gray-900 text-base print:text-[13px]">{cab.name.split('｜')[1] || cab.name}</h4>
                          <span className="text-[11px] print:text-[9px] text-gray-600 font-bold tracking-widest font-mono">
                            W {cab.width} × H {cab.height} × D {cab.depth} mm
                          </span>
                        </div>

                        <div className="p-6 print:p-3">
                          {/* 配置明细表 (强制双列，极限压缩 gap) */}
                          <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-x-12 print:gap-x-6 gap-y-8 print:gap-y-2 text-[13px] print:text-[11px] text-black">
                            {/* 柜体列 */}
                            <div>
                              <div className="font-black text-gray-900 mb-3 print:mb-1 border-b border-gray-300 pb-1.5 print:pb-0.5 uppercase tracking-widest text-[11px] print:text-[10px]">柜体配置 CABINET</div>
                              {/* 压缩明细行距 */}
                              <div className="space-y-2 print:space-y-0.5 text-gray-800">
                                <div className="grid grid-cols-[100px_1fr] print:grid-cols-[70px_1fr]"><span className="text-gray-500 font-medium">材料类型</span><span className="font-bold">{dispCabType}</span></div>
                                <div className="grid grid-cols-[100px_1fr] print:grid-cols-[70px_1fr]"><span className="text-gray-500 font-medium">指定品牌</span><span className="font-bold">{cab.snap_cabinet_brand || '-'}</span></div>
                                <div className="grid grid-cols-[100px_1fr] print:grid-cols-[70px_1fr]"><span className="text-gray-500 font-medium">颜色款式</span><span className="font-bold">{cab.snap_cabinet_color || '-'}</span></div>
                                <div className="grid grid-cols-[100px_1fr] print:grid-cols-[70px_1fr]"><span className="text-gray-500 font-medium">规格参数</span><span className="font-bold">{cab.cabinet_thickness || 18}mm / {cab.snap_back_panel_spec || '-'}</span></div>
                              </div>
                              {cab.cabinet_material_remark && (
                                <div className="mt-4 print:mt-1.5 pt-3 print:pt-1 border-t border-gray-100">
                                  <div className="text-gray-500 font-medium mb-1 print:mb-0">选材备注：</div>
                                  <div className="font-medium text-gray-900 leading-relaxed">{cab.cabinet_material_remark}</div>
                                </div>
                              )}
                            </div>

                            {/* 门板列 */}
                            {hasNoDoor ? (
                              <div>
                                <div className="font-black text-gray-900 mb-3 print:mb-1 border-b border-gray-300 pb-1.5 print:pb-0.5 uppercase tracking-widest text-[11px] print:text-[10px]">门板配置 DOOR</div>
                                <div className="text-gray-500 italic py-2 print:py-0">开放式柜体 (无门板)</div>
                              </div>
                            ) : (
                              <div>
                                <div className="font-black text-gray-900 mb-3 print:mb-1 border-b border-gray-300 pb-1.5 print:pb-0.5 uppercase tracking-widest text-[11px] print:text-[10px]">门板配置 DOOR</div>
                                <div className="space-y-2 print:space-y-0.5 text-gray-800">
                                  <div className="grid grid-cols-[100px_1fr] print:grid-cols-[70px_1fr]"><span className="text-gray-500 font-medium">材料类型</span><span className="font-bold">{dispDoorType}</span></div>
                                  <div className="grid grid-cols-[100px_1fr] print:grid-cols-[70px_1fr]"><span className="text-gray-500 font-medium">指定品牌</span><span className="font-bold">{cab.snap_door_brand || '-'}</span></div>
                                  <div className="grid grid-cols-[100px_1fr] print:grid-cols-[70px_1fr]"><span className="text-gray-500 font-medium">颜色款式</span><span className="font-bold">{cab.snap_door_color || '-'}</span></div>
                                  <div className="grid grid-cols-[100px_1fr] print:grid-cols-[70px_1fr]"><span className="text-gray-500 font-medium">表面工艺</span><span className="font-bold">{cab.snap_door_surface_finish || '未记录'}</span></div>
                                </div>
                                {cab.door_material_remark && (
                                  <div className="mt-4 print:mt-1.5 pt-3 print:pt-1 border-t border-gray-100">
                                    <div className="text-gray-500 font-medium mb-1 print:mb-0">选材备注：</div>
                                    <div className="font-medium text-gray-900 leading-relaxed">{cab.door_material_remark}</div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* 超深及特殊费用 */}
                          {excessDepthFee > 0 && (
                            <div className="mt-6 print:mt-2.5 border-l-2 border-black pl-4 print:pl-3 py-1 text-[13px] print:text-[11px] flex justify-between">
                              <span className="text-gray-600 font-medium">超出标准深度附加费 (实深 {cab.depth}mm)</span>
                              <span className="font-black text-gray-900">+ ¥{excessDepthFee.toFixed(2)}</span>
                            </div>
                          )}

                          {/* 基础单价与尺寸合计 */}
                          <div className="mt-6 print:mt-2.5 border border-black p-4 print:p-2 flex flex-col md:flex-row print:flex-row justify-between items-center text-[13px] print:text-[11px]">
                            <div className="flex gap-8 text-black w-full md:w-auto print:w-auto mb-4 md:mb-0 print:mb-0">
                               <div>
                                 <div className="text-gray-500 font-medium mb-1 print:mb-0">{hasNoDoor ? '开放式单价' : '综合单价'}</div>
                                 <div className="font-bold">¥{comprehensiveUnitPrice.toFixed(2)}<span className="text-[10px] print:text-[8px] font-normal text-gray-500"> /{unitLabel}</span></div>
                               </div>
                               <div className="w-px bg-gray-300"></div>
                               <div>
                                 <div className="text-gray-500 font-medium mb-1 print:mb-0">{isArea ? '计价面积' : '计价长度'}</div>
                                 <div className="font-bold">{displayQty.toFixed(2)}<span className="text-[10px] print:text-[8px] font-normal text-gray-500"> {unitLabel}</span></div>
                               </div>
                            </div>
                            <div className="text-right w-full md:w-auto print:w-auto">
                              <div className="text-gray-500 font-medium text-xs print:text-[10px] mb-1 print:mb-0">柜体部分金额</div>
                              <div className="font-black text-lg print:text-base text-black">¥{comprehensiveTotalAmount.toFixed(2)}</div>
                            </div>
                          </div>

                          {/* 附属工艺与五金清单 */}
                          {cabUpgrades.length > 0 && (
                            <div className="mt-8 print:mt-2.5 border-t-2 border-black pt-4 print:pt-1.5">
                              <div className="text-[11px] print:text-[10px] font-black text-black mb-4 print:mb-1.5 uppercase tracking-widest">附加工艺与五金 UPGRADES</div>
                              <table className="w-full text-left text-[13px] print:text-[11px] text-black">
                                <thead className="border-b border-gray-300">
                                  <tr>
                                    <th className="py-2 print:py-0.5 font-medium text-gray-500">工艺说明</th>
                                    <th className="py-2 print:py-0.5 font-medium text-gray-500 text-center">计价数量</th>
                                    <th className="py-2 print:py-0.5 font-medium text-gray-500 text-right">单价</th>
                                    <th className="py-2 print:py-0.5 font-medium text-gray-500 text-right">小计金额</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {cabUpgrades.map(upg => {
                                    const isChild = !!upg.parent_record_id;
                                    return (
                                      <tr key={upg.id} className={isChild ? "text-gray-600" : "text-black"}>
                                        <td className={`py-3 print:py-1 flex flex-col ${isChild ? "pl-6 border-l border-gray-300 ml-2" : ""}`}>
                                          <span className={isChild ? "font-medium" : "font-bold text-gray-900"}>{isChild ? '— ' : ''}{upg.snap_upgrade_name}</span>
                                          {upg.remark && (
                                            <div className="text-[11px] print:text-[9px] text-gray-500 mt-1 print:mt-0.5 leading-relaxed pr-2">
                                              <span className="font-bold text-gray-600">备注:</span> {upg.remark}
                                            </div>
                                          )}
                                        </td>
                                        <td className="py-3 print:py-1 text-center whitespace-nowrap">
                                          <span className="font-bold">{upg.quantity}</span>
                                          <span className="ml-1 text-gray-500">{upg.unit || ''}</span>
                                        </td>
                                        <td className="py-3 print:py-1 text-right">¥{Number(upg.snap_final_unit_price || upg.snap_unit_price || 0).toFixed(2)}</td>
                                        <td className="py-3 print:py-1 font-bold text-right">¥{Number(upg.snap_upgrade_price || 0).toFixed(2)}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}

                          {/* 单柜汇总底线 */}
                          <div className="mt-8 print:mt-2 pt-4 print:pt-1.5 border-t border-black flex justify-between items-end">
                            <span className="text-[11px] print:text-[10px] font-black text-black uppercase tracking-widest">Subtotal</span> 
                            <span className="text-2xl print:text-lg font-black text-black tracking-tight">¥{Number(cab.cabinet_total_price || 0).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

         {/* 全案总计 Footer (屏显黑白反转，支持折扣划线降级，打印白底) */}
          <div className="bg-black text-white px-10 md:px-16 py-10 print:px-8 print:py-6 flex flex-col md:flex-row print:flex-row justify-between items-center print:border-t-[4px] print:border-black print:bg-white print:text-black">
            <div className="mb-4 md:mb-0 print:mb-0 text-center md:text-left print:text-left">
              <span className="font-bold text-sm print:text-[11px] tracking-widest uppercase block text-gray-300 print:text-gray-500">
                {quote.discount_final_price ? 'Discount / 最终结算价' : 'Total Amount / 全案总计'}
              </span>
            </div>
            <div className="flex flex-col items-center md:items-end print:items-end text-right">
               {quote.discount_final_price ? (
                 <>
                   <div className="text-gray-400 print:text-gray-400 font-bold text-lg print:text-[11px] line-through decoration-gray-500 decoration-2 mb-1">
                     Original: ¥{Number(quote.total_amount || 0).toFixed(2)}
                   </div>
                   <div className="text-5xl print:text-3xl font-black tracking-tighter text-white print:text-black flex items-baseline gap-3">
                     <span className="text-lg print:text-[10px] font-bold text-gray-300 print:text-gray-500 tracking-widest uppercase">Final</span>
                     ¥{Number(quote.discount_final_price).toFixed(2)}
                   </div>
                 </>
               ) : (
                 <span className="text-5xl print:text-3xl font-black tracking-tighter">¥{Number(quote.total_amount || 0).toFixed(2)}</span>
               )}
            </div>
          </div>

          {/* 【新增】：统一报价条款模块 */}
          <RenderTermsBlock content={quote.terms_content || DEFAULT_TERMS} />

          {/* 渲染进 PDF 和后台预览的签名锁定区 */}
          {quote.is_signed && quote.customer_signature && (
            <div className="px-10 md:px-16 print:px-8 py-10 print:py-6 bg-white w-full border-t border-gray-200 page-break-inside-avoid">
              <h3 className="text-sm font-black text-black tracking-widest uppercase mb-6 print:mb-2">客户签字 SIGNATURE</h3>
              <div className="flex flex-col items-start">
                <img src={quote.customer_signature} alt="Client Signature" className="h-28 md:h-32 print:h-20 object-contain border-b border-gray-300 pb-2 mb-3" />
                <div className="text-xs font-bold text-gray-500">
                  ✅ 客户已于 {new Date(quote.signed_at).toLocaleString('zh-CN')} 确认此报价方案
                </div>
              </div>
            </div>
          )}
        </div> 

        {/* 底部版权信息 (仅在屏幕显示，打印及导出PDF时自动隐藏) */}
        <div className="mt-12 text-center text-[10px] text-gray-400 uppercase tracking-widest font-bold print:hidden">
          <div className="mb-1 text-gray-500">NOEY Custom Furniture System</div>
          <div>Designed for NOEY Furniture © 2026. All Rights Reserved.</div>
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
                <div className="grid grid-cols-2 gap-4 mb-4">
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

              {/* 【V4.08 独立二级工艺面板】：支持新增与编辑 */}
              {editId && (
                <div className="mt-8 bg-blue-50/50 p-6 rounded-2xl border-2 border-blue-100">
                  <div className="flex items-center justify-between mb-4 border-b border-blue-200 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🔗</span>
                      <h3 className="text-lg font-black text-blue-900">[{upgradeForm.name}] 专属附属计价项目</h3>
                    </div>
                    {editSubId && (
                       <button onClick={() => { setEditSubId(null); setSubUpgradeForm({ name: '', calculation_type: '按数量', unit: '', unit_price: '', minimum_quantity: 0, description: '' }); }} className="text-xs font-bold text-gray-500 hover:text-black">取消当前修改</button>
                    )}
                  </div>
                  
                  {/* 编辑/新增表单 */}
                  <form onSubmit={handleSaveSubUpgrade} className="flex flex-wrap items-start gap-3 mb-6 bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
                    <div className="flex-1 min-w-[200px]">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">附属工艺名称</label>
                      <input required value={subUpgradeForm.name} onChange={e=>setSubUpgradeForm({...subUpgradeForm, name:e.target.value})} placeholder="如: 玻璃门拉手" className="w-full border-2 border-gray-200 p-2 rounded-lg font-bold text-sm mt-1 focus:border-blue-400" />
                    </div>
                    <div className="w-24">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">单价 (元)</label>
                      <input required type="number" step="0.01" value={subUpgradeForm.unit_price} onChange={e=>setSubUpgradeForm({...subUpgradeForm, unit_price:e.target.value})} className="w-full border-2 border-gray-200 p-2 rounded-lg font-black text-rose-600 text-sm mt-1" />
                    </div>
                    <div className="w-24">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">计价单位</label>
                      <input required value={subUpgradeForm.unit} onChange={e=>setSubUpgradeForm({...subUpgradeForm, unit:e.target.value})} placeholder="如: 个" className="w-full border-2 border-gray-200 p-2 rounded-lg font-bold text-sm mt-1" />
                    </div>
                    <div className="w-24">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">起算量</label>
                      <input type="number" step="0.01" value={subUpgradeForm.minimum_quantity} onChange={e=>setSubUpgradeForm({...subUpgradeForm, minimum_quantity:e.target.value})} className="w-full border-2 border-blue-200 bg-blue-50 p-2 rounded-lg font-black text-blue-800 text-sm mt-1" />
                    </div>
                    <div className="w-full">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">特殊说明 (可选)</label>
                      <input value={subUpgradeForm.description || ''} onChange={e=>setSubUpgradeForm({...subUpgradeForm, description:e.target.value})} placeholder="工艺备注提示" className="w-full border-2 border-gray-100 p-2 rounded-lg font-medium text-sm mt-1" />
                    </div>
                    <div className="w-full flex justify-end mt-2">
                       <button type="submit" className="bg-blue-600 text-white px-8 py-2 rounded-lg font-bold text-sm hover:bg-blue-700 shadow-md">{editSubId ? '保存二级工艺修改' : '+ 确认添加二级工艺'}</button>
                    </div>
                  </form>

                  {/* 专属子工艺列表 */}
                  <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50 text-xs text-gray-500 border-b border-gray-100">
                        <tr><th className="p-3">附属项目名称</th><th className="p-3">单价</th><th className="p-3 text-center">起算量</th><th className="p-3 text-right">操作</th></tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {subUpgrades.filter(sub => sub.parent_upgrade_id === editId).length === 0 ? (
                          <tr><td colSpan="4" className="p-6 text-center text-gray-400 font-bold text-xs">尚无专属附属工艺</td></tr>
                        ) : (
                          subUpgrades.filter(sub => sub.parent_upgrade_id === editId).map(sub => (
                            <tr key={sub.id} className="hover:bg-gray-50/50">
                              <td className="p-3 font-bold text-gray-800">
                                ↳ {sub.name}
                                {sub.description && <div className="text-[10px] text-gray-400 font-normal mt-0.5">{sub.description}</div>}
                              </td>
                              <td className="p-3 font-black text-rose-600">¥{sub.unit_price} / {sub.unit}</td>
                              <td className="p-3 text-center font-bold text-blue-600">{sub.minimum_quantity > 0 ? sub.minimum_quantity : '-'}</td>
                              <td className="p-3 text-right">
                                <button onClick={() => { setEditSubId(sub.id); setSubUpgradeForm(sub); }} className="text-blue-500 hover:text-blue-700 font-bold text-xs px-2 py-1 mr-2">编辑</button>
                                <button onClick={() => handleDeleteSubUpgrade(sub.id)} className="text-rose-500 hover:text-rose-700 font-bold text-xs bg-rose-50 px-2 py-1 rounded">删除</button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

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
               <form onSubmit={handleSaveRules} className="bg-white p-8 rounded-xl shadow-sm border space-y-6 font-bold">
                 
                 {/* 深度规则区 */}
                 <div className="space-y-4">
                   <h3 className="text-sm uppercase tracking-widest text-gray-400 border-b pb-2">深度规则参数</h3>
                   <div><label className="block text-sm text-gray-500 mb-1">标准深度阈值 (mm)</label><input type="number" value={rules.standard_depth} onChange={e=>setRules({...rules, standard_depth:e.target.value})} className="w-full border-2 p-2 rounded-lg" /></div>
                   <div><label className="block text-sm text-gray-500 mb-1">浅柜判定界限 (mm)</label><input type="number" value={rules.shallow_depth} onChange={e=>setRules({...rules, shallow_depth:e.target.value})} className="w-full border-2 p-2 rounded-lg" /></div>
                 </div>

                 {/* 计价尺寸阈值区 */}
                 <div className="space-y-4 mt-6">
                   <h3 className="text-sm uppercase tracking-widest text-gray-400 border-b pb-2">面积与起算量阈值</h3>
                   <div><label className="block text-sm text-gray-500 mb-1">高度分水岭：投影面积与延米的判定界限 (mm)</label><input type="number" value={rules.height_threshold} onChange={e=>setRules({...rules, height_threshold:e.target.value})} className="w-full border-2 p-2 rounded-lg" /></div>
                   
                   <div className="grid grid-cols-2 gap-4">
                     <div>
                       <label className="block text-sm text-gray-500 mb-1">全局最低起算面积 (㎡)</label>
                       <input type="number" step="0.01" value={rules.minimum_area} onChange={e=>setRules({...rules, minimum_area:parseFloat(e.target.value) || 0})} className="w-full border-2 border-blue-200 bg-blue-50 p-2 rounded-lg" />
                       <div className="text-xs text-gray-400 mt-1 font-normal">若实际计算 &lt; 此值，则按此值计价。</div>
                     </div>
                     <div>
                       <label className="block text-sm text-gray-500 mb-1">全局最低起算延米宽 (mm)</label>
                       <input type="number" value={rules.minimum_width} onChange={e=>setRules({...rules, minimum_width:parseFloat(e.target.value) || 0})} className="w-full border-2 border-blue-200 bg-blue-50 p-2 rounded-lg" />
                       <div className="text-xs text-gray-400 mt-1 font-normal">若实际计算 &lt; 此宽，则按此宽计算延米。</div>
                     </div>
                   </div>
                 </div>

                 {/* 特殊加价逻辑区 */}
                 <div className="space-y-4 mt-6">
                   <h3 className="text-sm uppercase tracking-widest text-gray-400 border-b pb-2">特殊加价逻辑</h3>
                   <div className="flex items-center gap-2 p-4 bg-gray-50 rounded-lg border">
                     <input type="checkbox" checked={rules.depth_overage_enabled} onChange={e=>setRules({...rules, depth_overage_enabled:e.target.checked})} className="w-5 h-5 accent-black" />
                     <label className="text-sm font-bold text-gray-800">启用超深自动加价逻辑 (按深度比例计算)</label>
                   </div>
                   <div>
                     <label className="block text-sm text-gray-500 mb-1">超深计算模式 (未来预留)</label>
                     <select disabled value={rules.depth_calculation_mode} className="w-full border-2 p-2 rounded-lg bg-gray-100 text-gray-400 font-bold">
                       <option value="ratio">按深度比例计算 (Ratio)</option>
                     </select>
                   </div>
                 </div>

                {/* 报价条款配置区 */}
                 <div className="space-y-4 mt-6">
                   <h3 className="text-sm uppercase tracking-widest text-gray-400 border-b pb-2">报价条款与合同模板</h3>
                   <div>
                     <label className="block text-sm text-gray-500 mb-1">通用报价条款说明 (修改后将自动应用于新生成的报价单)</label>
                     <textarea 
                       rows="12" 
                       value={rules.terms_template || ''} 
                       onChange={e=>setRules({...rules, terms_template:e.target.value})} 
                       className="w-full border-2 p-3 rounded-lg text-xs leading-relaxed bg-gray-50 focus:bg-white" 
                       placeholder="如果不填，系统将使用硬编码的默认标准条款..." 
                     />
                   </div>
                 </div>

                 <button type="submit" className="w-full bg-black text-white p-3 rounded-lg font-black mt-8 text-lg shadow-lg hover:shadow-xl transition-shadow">保存并更新全局规则</button>
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

// ==========================================
  // 【核心修复】：渲染前置硬拦截 (等待路由与状态解析完毕)
  // ==========================================
  if (isInitializing) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-400 font-sans">
        <div className="w-8 h-8 border-4 border-gray-300 border-t-black rounded-full animate-spin mb-4"></div>
        <div className="text-xs font-bold tracking-widest uppercase">Loading...</div>
      </div>
    );
  }

  // 以下是原有的路由分发代码，保持不动
  if (currentView === 'quote-preview') return renderQuotePreview();
  if (currentView === 'quote-view') return renderClientView();
  if (currentView === 'sales-history') return renderSalesHistory();
  if (currentView === 'sales') return renderSalesWorkspace();
  if (currentView === 'admin-login') return renderAdminLogin();
  if (currentView === 'admin') return renderAdmin();

// ==========================================
  // 【V4.01 视觉优化】：恢复居中高级商务风主页 (极简底部 Logo 印章)
  // ==========================================
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center font-sans">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-black text-gray-900 tracking-widest mb-4">NOEY<span className="font-light">QUOTATION</span></h1>
          <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">诺一家具 · 核心报价引擎 V2.0-A</p>
        </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl w-full px-6">
          <button onClick={enterSalesWorkspace} className="bg-white p-10 rounded-3xl shadow-xl hover:shadow-2xl border-2 border-transparent hover:border-black text-left group transition-all">
            <div className="text-5xl mb-6 group-hover:scale-110 transition-transform origin-left">💻</div>
            <h2 className="text-2xl font-black text-gray-900 mb-2">Quote Studio</h2>
            <p className="text-gray-500 font-medium text-sm">业务前线：建立订单、配置柜体方案、选择材料工艺，并实时生成精准报价</p>
          </button>

          <button onClick={() => setCurrentView('sales-history')} className="bg-white p-10 rounded-3xl shadow-xl hover:shadow-2xl border-2 border-transparent hover:border-blue-500 text-left group transition-all">
            <div className="text-5xl mb-6 grayscale group-hover:scale-110 transition-transform origin-left">📂</div>
            <h2 className="text-2xl font-black text-gray-900 mb-2">Quote Archive</h2>
            <p className="text-gray-500 font-medium text-sm">管理历史报价，支持编辑或预览，生成客户报价</p>
          </button>
    
          <button onClick={() => setCurrentView('admin-login')} className="bg-white p-10 rounded-3xl shadow-xl hover:shadow-2xl border-2 border-transparent hover:border-gray-300 text-left group transition-all">
            <div className="text-5xl mb-6 grayscale group-hover:scale-110 transition-transform origin-left">⚙️</div>
            <h2 className="text-2xl font-black text-gray-800 mb-2">System Hub</h2>
            <p className="text-gray-500 font-medium text-sm">系统管理：维护材料库、配置规则及基础业务数据</p>
          </button>
        </div>

        {/* 极简印章式品牌 Footer */}
        <div className="w-full text-center pb-12 pt-8 flex flex-col items-center justify-center">
        
        {/* 圆形 Logo 容器 */}
        <div className="w-12 h-12 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center p-2.5 mb-5">
           <img src="/LOGO英版.png" alt="NOEY" className="w-full h-full object-contain opacity-90" />
        </div>
        
        {/* 品牌名称 */}
        <div className="text-[11px] font-black text-gray-800 uppercase tracking-[0.25em] mb-2">
          NOEY FURNITURE MANUFACTURE
        </div>
        
        {/* 品牌理念 */}
        <div className="text-[9px] font-medium text-gray-400 uppercase tracking-[0.2em] mb-6">
          OUR PROMISE YOUR SATISFACTION
        </div>
        
        {/* 分割线 */}
        <div className="w-8 border-b border-gray-300 mb-6"></div>
        
        {/* 版权 */}
        <div className="text-[9px] font-medium text-gray-400 tracking-wider">
          © 2026 NOEY. All Rights Reserved.
        </div>

      </div>

      {toast.show && <div className="fixed top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-8 py-3 text-sm font-bold shadow-2xl z-50 rounded animate-fade-in-down">{toast.message}</div>}
    </div>
  );
}

// ==========================================
// 【组件】：脱离主系统的独立客户端直连渲染器（Zero-Flash）
// ==========================================
const QuoteClientStandalone = ({ quoteId, supabase, rules, NativeSignaturePad, DEFAULT_TERMS }) => {
  const [previewData, setPreviewData] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState('');

  React.useEffect(() => {
    let isMounted = true;
    const loadQuoteData = async () => {
      try {
        const { data: quoteData, error: quoteErr } = await supabase.from('quotes').select('*').eq('id', quoteId).single();
        if (quoteErr || !quoteData) throw new Error('报价单不存在或已被物理删除');

        const { data: cabData, error: cabErr } = await supabase.from('quote_cabinets').select('*').eq('quote_id', quoteData.id);
        if (cabErr) throw cabErr;

        let upgData = [];
        if (cabData && cabData.length > 0) {
          const { data: uData, error: upgErr } = await supabase.from('quote_upgrades').select('*').in('cabinet_id', cabData.map(c => c.id));
          if (upgErr) throw upgErr;
          upgData = uData || [];
        }

        if (isMounted) {
          setPreviewData({ quote: quoteData, cabinets: cabData || [], upgrades: upgData });
        }
      } catch (err) {
        if (isMounted) setErrorMsg(err.message || '获取报价信息失败');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadQuoteData();
    return () => { isMounted = false; };
  }, [quoteId, supabase]);

  const handleConfirmSignature = async (base64Image) => {
    setIsLoading(true);
    try {
      const now = new Date().toISOString();
      await supabase.from('quotes').update({
        customer_signature: base64Image,
        is_signed: true,
        signed_at: now,
        terms_locked: true,
        status: '已确认签字'
      }).eq('id', previewData.quote.id);

      setPreviewData(prev => ({
        ...prev,
        quote: { ...prev.quote, customer_signature: base64Image, is_signed: true, signed_at: now, terms_locked: true, status: '已确认签字' }
      }));
    } catch (err) {
      alert('签字提交失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 font-sans">
        <div className="w-10 h-10 border-4 border-black border-t-transparent rounded-full animate-spin mb-4"></div>
        <div className="text-xs font-bold text-gray-500 tracking-widest uppercase">NOEY QUOTATION · 载入中...</div>
      </div>
    );
  }

  if (errorMsg || !previewData) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 font-sans">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full text-center border border-gray-200">
          <div className="text-4xl mb-4">⚠️</div>
          <div className="text-lg font-black text-gray-900 mb-2">链接失效</div>
          <div className="text-xs font-bold text-gray-500">{errorMsg || '无法调取当前报价数据'}</div>
        </div>
      </div>
    );
  }

  const { quote, cabinets, upgrades } = previewData;

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col pb-28 selection:bg-black selection:text-white">
      {/* 顶部 Header */}
      <div className="bg-white py-6 shadow-sm flex flex-col items-center sticky top-0 z-10 border-b border-gray-200">
        <img src="/LOGO英版.png" alt="NOEY" className="h-8 mb-2 object-contain" />
        <div className="text-xs font-black text-gray-900 tracking-widest uppercase">Quotation Review</div>
      </div>

      {/* 基础信息 */}
      <div className="p-4 mt-2">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-3 text-sm">
          <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-1">
            <span className="text-gray-500 font-bold">订单编号</span>
            <span className="font-mono font-black text-base">{quote.quote_no}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 font-bold">客户名称</span>
            <span className="font-black text-gray-900">{quote.customer_name || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 font-bold">出单日期</span>
            <span className="font-bold text-gray-800">{new Date(quote.updated_at || quote.created_at).toLocaleDateString('zh-CN')}</span>
          </div>
          <div className="flex justify-between items-start">
            <span className="text-gray-500 font-bold whitespace-nowrap">交付地址</span>
            <span className="font-bold text-gray-800 text-right">{quote.delivery_address || '-'}</span>
          </div>
        </div>
      </div>

      {/* 明细方案 */}
      <div className="px-4 mt-2">
        <h2 className="text-sm font-black text-gray-900 tracking-widest uppercase mb-4 pl-3 border-l-4 border-black">定制方案明细</h2>
        <div className="space-y-6">
          {cabinets.map((cab, idx) => {
            const cabUpgs = upgrades.filter(u => u.cabinet_id === cab.id);
            const w = parseFloat(cab.width) || 0;
            const h = parseFloat(cab.height) || 0;
            const isArea = h > (rules?.height_threshold || 1000);
            
            const fallbackQty = Number(cab.snap_calc_area || cab.quantity || 0);
            const displayQty = fallbackQty > 0 ? fallbackQty : (isArea ? Math.max((w * h) / 1000000, rules?.minimum_area || 1) : Math.max(w / 1000, (rules?.minimum_width || 1000) / 1000));
            const unitLabel = isArea ? '㎡' : 'm';

            const cabUnitPrice = Number(cab.snap_final_cabinet_price || 0);
            const doorUnitPrice = Number(cab.snap_final_door_price || 0);
            const hasNoDoor = !cab.door_mat_id || doorUnitPrice === 0 || (cab.snap_door_brand || '').includes('无门板');

            const excessDepthFee = Number(cab.excess_depth_fee || 0);
            const upgradesTotal = cabUpgs.reduce((sum, upg) => sum + Number(upg.snap_upgrade_price || 0), 0);
            const openCabinetSalesPrice = cab.snap_base_cabinet_cost ? Number(cab.snap_base_cabinet_cost) : Math.max(0, Number(cab.cabinet_total_price || 0) - excessDepthFee - upgradesTotal);
            
            const comprehensiveTotalAmount = hasNoDoor ? openCabinetSalesPrice : ((cabUnitPrice + doorUnitPrice) * displayQty);
            let comprehensiveUnitPrice = displayQty > 0 ? (comprehensiveTotalAmount / displayQty) : 0;

            if (comprehensiveUnitPrice === 0 && Number(cab.cabinet_total_price) > 0 && displayQty > 0) {
               comprehensiveUnitPrice = Number(cab.cabinet_total_price) / displayQty;
            }

            return (
              <div key={cab.id} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200">
                <div className="bg-gray-900 text-white p-4 flex justify-between items-center">
                  <div className="font-black text-sm">{idx + 1}. {cab.name}</div>
                  <div className="text-xs font-mono text-gray-300">W{cab.width}×H{cab.height}×D{cab.depth}</div>
                </div>

                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-xs">
                       <div className="font-black text-gray-800 border-b border-gray-200 pb-2 mb-3">🗄️ 柜体配置</div>
                       <div className="space-y-2">
                         <div className="flex justify-between"><span className="text-gray-500">材料类型</span><span className="font-bold text-gray-900">{cab.snap_cabinet_material_name || '-'}</span></div>
                         <div className="flex justify-between"><span className="text-gray-500">指定品牌</span><span className="font-bold text-gray-900">{cab.snap_cabinet_brand || '-'}</span></div>
                         <div className="flex justify-between"><span className="text-gray-500">颜色款式</span><span className="font-bold text-gray-900">{cab.snap_cabinet_color || '-'}</span></div>
                         {cab.cabinet_material_remark && <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between items-start"><span className="text-gray-500">备注</span><span className="font-bold text-rose-600 text-right">{cab.cabinet_material_remark}</span></div>}
                       </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-xs">
                       <div className="font-black text-gray-800 border-b border-gray-200 pb-2 mb-3">🚪 门板配置</div>
                       <div className="space-y-2">
                         <div className="flex justify-between"><span className="text-gray-500">材料类型</span><span className="font-bold text-gray-900">{cab.snap_door_material_name || '-'}</span></div>
                         <div className="flex justify-between"><span className="text-gray-500">指定品牌</span><span className="font-bold text-gray-900">{cab.snap_door_brand || '-'}</span></div>
                         <div className="flex justify-between"><span className="text-gray-500">颜色款式</span><span className="font-bold text-gray-900">{cab.snap_door_color || '-'}</span></div>
                         <div className="flex justify-between"><span className="text-gray-500">表面工艺</span><span className="font-bold text-gray-900">{cab.snap_door_surface_finish || '-'}</span></div>
                         {cab.door_material_remark && <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between items-start"><span className="text-gray-500">备注</span><span className="font-bold text-rose-600 text-right">{cab.door_material_remark}</span></div>}
                       </div>
                    </div>
                  </div>

                  {cabUpgs.length > 0 && (
                    <div>
                      <div className="font-black text-gray-900 text-xs mb-2">✨ 升级工艺与五金</div>
                      <div className="border border-gray-200 rounded-xl overflow-hidden text-xs">
                         {cabUpgs.map((upg, i) => {
                           const isChild = !!upg.parent_record_id;
                           return (
                             <div key={upg.id} className={`p-3 flex flex-wrap justify-between items-center border-b border-gray-100 last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} ${isChild ? 'pl-8 border-l-4 border-l-gray-300' : ''}`}>
                               <div className="w-full mb-2">
                                  <span className={isChild ? "font-bold text-gray-700" : "font-black text-gray-900"}>{isChild ? '↳ ' : ''}{upg.snap_upgrade_name}</span>
                                  {upg.remark && <div className="text-[10px] text-gray-500 mt-1">备注: {upg.remark}</div>}
                               </div>
                               <div className="flex justify-between w-full text-gray-600 font-mono">
                                 <span>{upg.quantity} {upg.unit}</span>
                                 <span>¥{Number(upg.snap_final_unit_price || upg.snap_unit_price || 0).toFixed(2)}</span>
                                 <span className="font-black text-rose-600">¥{Number(upg.snap_upgrade_price || 0).toFixed(2)}</span>
                               </div>
                             </div>
                           );
                         })}
                      </div>
                    </div>
                  )}

                  <div className="pt-4 mt-3 border-t border-gray-100">
                    <div className="flex justify-between items-center mb-3 px-1">
                      <span className="text-[11px] text-gray-500 font-medium">计价{isArea ? '面积' : '长度'}：{displayQty.toFixed(2)} {unitLabel}</span>
                      <span className="text-[11px] text-gray-800 font-medium">{hasNoDoor ? '单价' : '综合单价'}：¥{comprehensiveUnitPrice.toFixed(2)} /{unitLabel}</span>
                    </div>
                    
                    <div className="flex justify-between items-end bg-gray-50 -mx-4 px-4 py-3 border-t border-gray-100">
                      <span className="text-xs font-bold text-gray-500">单组小计 Subtotal</span>
                      <span className="text-xl font-black text-gray-900">¥ {Number(cab.cabinet_total_price).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 条款模块 */}
      <div className="mt-4 bg-white">
        <div className="px-6 md:px-16 print:px-8 py-8 print:py-4 bg-white border-t border-gray-200 page-break-inside-avoid">
          <div className="flex justify-center items-center mb-6">
             <div className="h-px bg-gray-200 w-12"></div>
             <h3 className="mx-4 text-sm font-black text-gray-800 tracking-widest uppercase">报价条款 Terms & Conditions</h3>
             <div className="h-px bg-gray-200 w-12"></div>
          </div>
          <div className="text-[12px] text-gray-600 leading-relaxed max-w-4xl mx-auto space-y-1.5">
            {(quote.terms_content || DEFAULT_TERMS).split('\n').map((line, idx) => {
              const text = line.trim();
              if (!text) return null;
              const isTitle = /^[一二三四五六七八九十]、/.test(text);
              return (
                <div key={idx} className={`${isTitle ? 'font-black text-gray-900 text-[13px] mt-5 mb-2' : 'pl-2'}`}>
                  {text}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 签字确认区 */}
      <div className="p-6 mt-10 bg-white border-t-[4px] border-black page-break-inside-avoid">
        <h3 className="text-sm font-black text-black tracking-[0.2em] uppercase mb-6 text-center">客户签字 Signature</h3>
        {quote.is_signed && quote.customer_signature ? (
           <div className="w-full flex flex-col items-center border-2 border-gray-100 p-6 rounded-2xl bg-gray-50">
             <img src={quote.customer_signature} alt="Client Signature" className="h-32 object-contain border-b border-gray-300 px-4 pb-4 w-full" />
             <div className="mt-4 text-xs font-bold text-gray-500">✅ 本报价单已由客户确认无误</div>
             <div className="mt-1 text-xs font-mono text-gray-400">确认时间: {new Date(quote.signed_at).toLocaleString('zh-CN')}</div>
           </div>
        ) : (
           <NativeSignaturePad onSave={handleConfirmSignature} />
        )}
      </div>

      {/* 底部悬浮总价 */}
      <div className="fixed bottom-0 left-0 right-0 bg-black text-white px-6 py-4 flex justify-between items-center z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.2)] pb-safe border-t border-gray-900">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">
            {quote.discount_final_price ? 'DISCOUNT / 最终成交价' : 'TOTAL AMOUNT / 全案总计'}
          </span>
          {quote.discount_final_price && (
             <span className="text-[10px] text-gray-500 line-through mt-0.5 font-mono">Orig: ¥{Number(quote.total_amount || 0).toFixed(2)}</span>
          )}
        </div>
        <div className="text-3xl font-black text-white">
           <span className="text-lg mr-1 font-bold">¥</span>
           {Number(quote.discount_final_price || quote.total_amount || 0).toFixed(2)}
        </div>
      </div>
    </div>
  );
};
