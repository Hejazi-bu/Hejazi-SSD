const { Client } = require('pg');

exports.handleLogin = async (req, res) => {
  // إعدادات CORS للسماح بالوصول من تطبيقك الأمامي
  res.set('Access-Control-Allow-Origin', '*'); // يمكنك تغيير * إلى عنوان URL لتطبيقك
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  // التأكد من وجود البيانات في الطلب
  if (!req.body || !req.body.email || !req.body.password) {
    return res.status(400).send('Email and password are required.');
  }

  // ⚠️ ملاحظة أمنية هامة:
  // هذه الطريقة غير آمنة في بيئة إنتاج.
  // كلمات المرور يجب أن تكون مشفرة (مثل bcrypt) في قاعدة البيانات
  // ويجب التحقق منها هنا بشكل آمن. هذا الكود هو للمحاكاة فقط.
  const { email, password } = req.body;

  // استخدام متغيرات البيئة لبيانات الاتصال
  // سيتم تعيينها لاحقًا في جوجل كلاود
  const client = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
  });

  try {
    await client.connect();
    const query = 'SELECT id, email, password FROM users WHERE email = $1';
    const result = await client.query(query, [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'User not found.' });
    }

    const user = result.rows[0];

    if (user.password === password) { // التحقق من كلمة المرور (غير آمن)
      return res.status(200).json({ success: true, user_id: user.id });
    } else {
      return res.status(401).json({ success: false, error: 'Invalid password.' });
    }

  } catch (err) {
    console.error('Database query error:', err.stack);
    return res.status(500).json({ success: false, error: 'Database error.' });
  } finally {
    await client.end();
  }
};