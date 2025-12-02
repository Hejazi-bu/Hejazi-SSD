#!/bin/bash

# 🔥 سكريبت تشغيل Firebase Emulators
# يقوم بتشغيل الـ Emulators مع إعدادات محسّنة للاختبار

echo "🔥 Starting Firebase Emulators..."
echo ""

# التحقق من وجود firebase-tools
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found!"
    echo "Install it with: npm install -g firebase-tools"
    exit 1
fi

# التحقق من وجود المشروع
if [ ! -f "firebase.json" ]; then
    echo "❌ firebase.json not found!"
    echo "Make sure you're in the project root directory"
    exit 1
fi

# بناء Functions أولاً
echo "📦 Building Cloud Functions..."
cd functions
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi
cd ..

echo "✅ Functions built successfully"
echo ""

# تشغيل Emulators
echo "🚀 Starting Emulators..."
echo "   - Functions: http://localhost:5001"
echo "   - Firestore: http://localhost:8080"
echo "   - Auth: http://localhost:9099"
echo "   - UI: http://localhost:4000"
echo ""
echo "📝 Press Ctrl+C to stop"
echo ""

firebase emulators:start
