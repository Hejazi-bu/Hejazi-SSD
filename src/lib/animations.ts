// src/lib/animations.ts
import { Variants } from 'framer-motion';

/**
 * أنيميشن لدخول وخروج الصفحات.
 */
export const pageTransitionVariants: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.25, 1, 0.5, 1] } },
  // --- ✅ تم تعديل هذا السطر ---
  // الآن الخروج يكمل الحركة للأعلى ليصبح عكس الدخول تماماً
  exit: { opacity: 0, y: -20, transition: { duration: 0.7, ease: [0.45, 0, 0.55, 1] } },
};

/**
 * أنيميشن للمربعات الحوارية (Modals)
 */
export const scaleInModalVariants: Variants = {
  initial: { scale: 0.8, opacity: 0 },
  animate: {
    scale: 1,
    opacity: 1,
    transition: { type: 'spring', stiffness: 250, damping: 25 }
  },
  exit: { 
    scale: 0.8, 
    opacity: 0, 
    transition: { duration: 0.2 } 
  }
};

/**
 * أنيميشن للحاويات لتنظيم ظهور العناصر الفرعية بشكل متتالي.
 */
export const staggeredContainerVariants: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.2,
    },
  },
  exit: {
    transition: {
      staggerChildren: 0.05,
      staggerDirection: -1,
    },
  }
};

/**
 * أنيميشن للعناصر الفردية داخل حاوية متتالية.
 */
export const staggeredItemVariants: Variants = {
  initial: { opacity: 0, y: 20, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: 'easeOut' } },
  exit: { opacity: 0, y: -20, scale: 0.98, transition: { duration: 0.3, ease: 'easeIn' } },
};

/**
 * أنيميشن للعناصر التفاعلية (مثل البطاقات والأزرار) عند مرور الماوس والضغط.
 */
export const interactiveItemVariants: Variants = {
  hover: {
    scale: 1.03,
    y: -4,
    transition: { type: 'spring', stiffness: 300, damping: 15 }
  },
  tap: {
    scale: 0.97,
    transition: { type: 'spring', stiffness: 400, damping: 20 }
  }
};

/**
 * أنيميشن للعناصر التي تظهر عند التمرير للأسفل (عندما تصبح مرئية).
 */
export const slideInFromBottomVariants: Variants = {
  initial: { opacity: 0, y: 50 },
  whileInView: { 
    opacity: 1, 
    y: 0, 
    transition: { duration: 0.6, ease: 'easeOut' } 
  },
};

/**
 * أنيميشن بسيط لظهور واختفاء العناصر بشكل تدريجي (Fade).
 */
export const fadeInVariants: Variants = {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.5 } },
    exit: { opacity: 0, transition: { duration: 0.5 } }
};

/**
 * أنيميشن للطبقات (Overlays) التي تنزلق من الأسفل.
 */
export const slideUpOverlayVariants = {
    initial: {
        y: "100%",
        opacity: 0
    },
    animate: {
        y: 0,
        opacity: 1
    },
    exit: {
        y: "100%",
        opacity: 0
    }
};

/**
 * أنيميشن اهتزاز بسيط للعناصر غير الصالحة (مثل حقول الإدخال).
 */
export const shakeVariants: Variants = {
    initial: { x: 0 },
    animate: {
        x: [-5, 5, -5, 5, 0],
        transition: {
            duration: 0.4,
            ease: "easeInOut",
            times: [0, 0.2, 0.4, 0.6, 1],
        },
    },
};

/**
 * أنيميشن انزلاق أفقي معتمد على اتجاه اللغة.
 */
export const directionalSlideVariants: Variants = {
  initial: (direction: 'ar' | 'en') => ({
    x: direction === 'ar' ? '100%' : '-100%',
    opacity: 0,
  }),
  animate: {
    x: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 150, damping: 26 },
  },
  exit: (direction: 'ar' | 'en') => ({
    x: direction === 'ar' ? '-100%' : '100%',
    opacity: 0,
    transition: { duration: 0.6, ease: 'easeIn' },
  }),
};