require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '15mb' }));
app.use(cookieParser());
const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'doudou_gongfang',

    waitForConnections: true,
    connectionLimit: 10,

    // 云端数据库启用 SSL，本地数据库保持原来的连接方式
    ...(process.env.DB_SSL === 'true'
        ? {
            ssl: {
                ca: fs.readFileSync(path.join(__dirname, 'ca.pem')),
                minVersion: 'TLSv1.2',
                rejectUnauthorized: true
            }
        }
        : {})
});
const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32) { console.error('请在 .env 设置至少32字符的 JWT_SECRET'); process.exit(1) }
const cookieName = 'doudou_session';
const production = process.env.NODE_ENV === 'production';
const cookieOptions = { httpOnly: true, secure: production, sameSite: 'lax', path: '/', maxAge: 7 * 24 * 3600 * 1000 };
// 本地及同源部署使用 SameSite=Lax。跨站 GitHub Pages 部署需要额外设计跨域会话与 CSRF 防护。
app.use((req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        const origin = req.get('origin');
        if (origin) { try { const u = new URL(origin); const host = req.get('host'); if (u.host !== host) return res.status(403).json({ success: false, message: '不允许跨站修改数据' }); } catch { return res.status(403).json({ success: false, message: 'Origin 不合法' }); } }
    } next()
});
app.use(express.static(path.join(__dirname, 'public')));
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 15, standardHeaders: 'draft-7', legacyHeaders: false, message: { success: false, message: '尝试次数过多，请稍后重试' } });
function validEmail(x) { return typeof x === 'string' && x.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x) }
function requireAuth(req, res, next) { try { const token = req.cookies[cookieName]; if (!token) return res.status(401).json({ success: false, message: '请先登录' }); const payload = jwt.verify(token, secret, { algorithms: ['HS256'] }); req.userId = Number(payload.sub); if (!Number.isSafeInteger(req.userId) || req.userId < 1) throw Error('invalid user'); next() } catch { return res.status(401).json({ success: false, message: '登录已失效，请重新登录' }) } }
function issueCookie(res, userId) { res.cookie(cookieName, jwt.sign({}, secret, { algorithm: 'HS256', subject: String(userId), expiresIn: '7d' }), cookieOptions) }
app.post('/api/auth/register', authLimiter, async (req, res) => {
    try {
        const { email, password } = req.body || {}; const e = typeof email === 'string' ? email.trim().toLowerCase() : '';
        if (!validEmail(e) || typeof password !== 'string' || password.length < 10 || password.length > 72) return res.status(400).json({ success: false, message: '请输入有效邮箱，密码长度为10至72字符' });
        const hash = await bcrypt.hash(password, 12);
        const [r] = await db.execute('INSERT INTO users(email,password_hash) VALUES(?,?)', [e, hash]); issueCookie(res, r.insertId); res.status(201).json({ success: true, user: { id: r.insertId, email: e } });
    } catch (err) { if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: '邮箱已注册' }); console.error(err); res.status(500).json({ success: false, message: '注册失败' }) }
});
app.post('/api/auth/login', authLimiter, async (req, res) => {
    try {
        const { email, password } = req.body || {}; const e = typeof email === 'string' ? email.trim().toLowerCase() : '';
        if (!validEmail(e) || typeof password !== 'string') return res.status(400).json({ success: false, message: '邮箱或密码错误' });
        const [rows] = await db.execute('SELECT id,email,password_hash FROM users WHERE email=? LIMIT 1', [e]);
        if (!rows.length || !await bcrypt.compare(password, rows[0].password_hash)) return res.status(401).json({ success: false, message: '邮箱或密码错误' });
        issueCookie(res, rows[0].id); res.json({ success: true, user: { id: rows[0].id, email: rows[0].email } });
    } catch (err) { console.error(err); res.status(500).json({ success: false, message: '登录失败' }) }
});
app.post('/api/auth/logout', (_req, res) => { res.clearCookie(cookieName, { ...cookieOptions, maxAge: undefined }); res.json({ success: true }) });
app.get('/api/auth/me', requireAuth, async (req, res) => { try { const [rows] = await db.execute('SELECT id,email FROM users WHERE id=?', [req.userId]); if (!rows.length) return res.status(401).json({ success: false, message: '用户不存在' }); res.json({ success: true, user: rows[0] }) } catch (e) { console.error(e); res.status(500).json({ success: false, message: '查询失败' }) } });
app.get('/api/health', async (_req, res) => { try { await db.query('SELECT 1'); res.json({ success: true, message: '数据库连接正常' }) } catch { res.status(500).json({ success: false, message: '数据库连接失败' }) } });
function mapRow(row) { let grid = row.grid_data; if (typeof grid === 'string') { try { grid = JSON.parse(grid) } catch { grid = [] } } let counts = row.counts; if (typeof counts === 'string') { try { counts = JSON.parse(counts) } catch { counts = [] } } return { ...row, grid_data: grid, counts: counts || [], total_beads: row.total_beads ?? 0 } };
function validId(raw) { const n = Number(raw); return Number.isSafeInteger(n) && n > 0 ? n : null }
function validatePattern(b) { return b && typeof b.name === 'string' && b.name.trim().length > 0 && b.name.length <= 200 && Number.isInteger(b.width) && Number.isInteger(b.height) && b.width >= 1 && b.height >= 1 && b.width <= 200 && b.height <= 200 && Array.isArray(b.grid_data) && b.grid_data.length === b.height && b.grid_data.every(row => Array.isArray(row) && row.length === b.width && row.every(v => v === null || (typeof v === 'string' && v.length <= 30))) && Array.isArray(b.counts || []) && (b.counts || []).length <= 221 && (!b.thumb || (typeof b.thumb === 'string' && b.thumb.length <= 3_000_000)) }
function fields(b) { return [b.name.trim(), b.width, b.height, Number(b.color_count) || 0, JSON.stringify(b.grid_data), b.thumb || '', Number(b.total_beads) || 0, Number(b.requested_colors) || 0, JSON.stringify(b.counts || [])] }
app.get('/api/patterns', requireAuth, async (req, res) => { try { const [rows] = await db.execute('SELECT id,name,width,height,color_count,total_beads,thumb,created_at FROM patterns WHERE user_id=? ORDER BY created_at DESC,id DESC LIMIT 500', [req.userId]); res.json({ success: true, data: rows }) } catch (e) { console.error(e); res.status(500).json({ success: false, message: '查询图纸失败' }) } });
app.get('/api/patterns/:id', requireAuth, async (req, res) => { const id = validId(req.params.id); if (!id) return res.status(400).json({ success: false, message: '图纸 ID 不合法' }); try { const [rows] = await db.execute('SELECT * FROM patterns WHERE id=? AND user_id=?', [id, req.userId]); if (!rows.length) return res.status(404).json({ success: false, message: '没有找到这张图纸' }); res.json({ success: true, data: mapRow(rows[0]) }) } catch (e) { console.error(e); res.status(500).json({ success: false, message: '读取图纸失败' }) } });
app.post('/api/patterns', requireAuth, async (req, res) => { const b = req.body; if (!validatePattern(b)) return res.status(400).json({ success: false, message: '图纸数据格式不正确' }); try { const [r] = await db.execute('INSERT INTO patterns (name,width,height,color_count,grid_data,thumb,total_beads,requested_colors,counts,user_id) VALUES (?,?,?,?,?,?,?,?,?,?)', [...fields(b), req.userId]); res.status(201).json({ success: true, id: r.insertId, message: '保存成功' }) } catch (e) { console.error(e); res.status(500).json({ success: false, message: '保存失败' }) } });
app.put('/api/patterns/:id', requireAuth, async (req, res) => { const id = validId(req.params.id), b = req.body; if (!id || !validatePattern(b)) return res.status(400).json({ success: false, message: '图纸数据格式不正确' }); try { const [r] = await db.execute('UPDATE patterns SET name=?,width=?,height=?,color_count=?,grid_data=?,thumb=?,total_beads=?,requested_colors=?,counts=? WHERE id=? AND user_id=?', [...fields(b), id, req.userId]); if (!r.affectedRows) return res.status(404).json({ success: false, message: '没有找到这张图纸' }); res.json({ success: true, message: '修改成功' }) } catch (e) { console.error(e); res.status(500).json({ success: false, message: '修改失败' }) } });
app.delete('/api/patterns/:id', requireAuth, async (req, res) => { const id = validId(req.params.id); if (!id) return res.status(400).json({ success: false, message: '图纸 ID 不合法' }); try { const [r] = await db.execute('DELETE FROM patterns WHERE id=? AND user_id=?', [id, req.userId]); if (!r.affectedRows) return res.status(404).json({ success: false, message: '没有找到这张图纸' }); res.json({ success: true, message: '删除成功' }) } catch (e) { console.error(e); res.status(500).json({ success: false, message: '删除失败' }) } });
const port = Number(process.env.PORT || 3000);
(async () => { try { await db.query('SELECT 1'); const server = app.listen(port, '0.0.0.0', () => console.log(`豆豆工坊 V4 已启动：http://localhost:${port}`)); server.on('error', e => { console.error('端口监听失败:', e.message); process.exit(1) }) } catch (e) { console.error('MySQL连接失败:', e.message); process.exit(1) } })();
