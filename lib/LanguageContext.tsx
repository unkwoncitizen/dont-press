'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

export type Language = 'en' | 'ar'

export interface Translations {
  [key: string]: {
    en: string
    ar: string
  }
}

export const translations: Translations = {
  // Brand & General
  brand_name: { en: "DON'T PRESS", ar: "لا تضغط" },
  press_verb: { en: "PRESS", ar: "اضغط" },
  dont_press_hero_1: { en: "DON'T", ar: "لا" },
  dont_press_hero_2: { en: "PRESS", ar: "تضغط" },
  tagline: { en: "One press. One challenge. One good deed.", ar: "ضغطة واحدة. تحدٍّ واحد. عمل خير واحد." },
  tagline_sub: { en: "A social network where one small action can start a chain of good.", ar: "شبكة اجتماعية حيث يمكن لعمل بسيط أن يبدأ سلسلة من الخير." },
  pressed_today: { en: "18,421 people pressed today", ar: "18,421 شخص ضغطوا اليوم" },
  after_press_note: { en: "What happens after the press is up to you.", ar: "ما يحدث بعد الضغط يعود إليك." },
  you_know_you_want: { en: "You know you want to...", ar: "أنت تعلم أنك تريد التجربة..." },
  start_first_challenge: { en: "Start your first challenge", ar: "ابدأ تحديك الأول" },
  start_a_chain: { en: "Start a chain", ar: "ابدأ سلسلة" },
  be_the_first: { en: "Be the first", ar: "كن أول المبادرين" },
  loading: { en: "Loading...", ar: "جاري التحميل..." },

  // Navigation
  nav_home: { en: "Home", ar: "الرئيسية" },
  nav_discover: { en: "Discover", ar: "اكتشف" },
  nav_chains: { en: "Chains", ar: "السلاسل" },
  nav_profile: { en: "Profile", ar: "الملف الشخصي" },
  nav_signin: { en: "Sign In", ar: "تسجيل الدخول" },
  nav_signup: { en: "Sign Up", ar: "إنشاء حساب" },
  nav_signout: { en: "Sign Out", ar: "تسجيل الخروج" },

  // How it works
  how_it_works: { en: "How it works", ar: "كيف يعمل" },
  step1_title: { en: "Press", ar: "اضغط" },
  step1_desc: { en: "Press the button and choose your challenge category", ar: "اضغط على الزر واختر فئة التحدي الخاص بك" },
  step2_title: { en: "Discover", ar: "اكتشف" },
  step2_desc: { en: "Get a random safe challenge to complete", ar: "احصل على تحدٍّ إيجابي وآمن لإنجازه" },
  step3_title: { en: "Do", ar: "أنفذ" },
  step3_desc: { en: "Complete your challenge in the real world", ar: "أنجز التحدي في العالم الحقيقي" },
  step4_title: { en: "Share", ar: "شارك" },
  step4_desc: { en: "Tell your story and inspire others", ar: "شارك قصتك وألهم الآخرين" },
  step5_title: { en: "Pass", ar: "مرر" },
  step5_desc: { en: "Pass it on and start a chain of kindness", ar: "مررها للغير وابدأ سلسلة من العطاء" },

  // Categories
  choose_path: { en: "Choose your path", ar: "اختر مجالك" },
  cat_good_deed: { en: "Good Deed", ar: "عمل خير" },
  cat_good_deed_desc: { en: "Small acts of kindness", ar: "مبادرات طيبة صغيرة" },
  cat_help_someone: { en: "Help Someone", ar: "مساعدة شخص" },
  cat_help_someone_desc: { en: "Practical support", ar: "دعم ومساعدة عملية" },
  cat_community: { en: "Community", ar: "المجتمع" },
  cat_community_desc: { en: "Build together", ar: "نبني ونعمر معاً" },
  cat_give: { en: "Give", ar: "العطاء" },
  cat_give_desc: { en: "Share what you have", ar: "شارك بما تجود به" },
  cat_creative: { en: "Creative", ar: "إبداع" },
  cat_creative_desc: { en: "Make something kind", ar: "اصنع شيئاً جميلاً" },
  cat_fun: { en: "Fun", ar: "مرح" },
  cat_fun_desc: { en: "Bring joy", ar: "انشر البهجة والابتسامة" },
  cat_learn_share: { en: "Learn & Share", ar: "تعلم وشارك" },
  cat_learn_share_desc: { en: "Share knowledge", ar: "انشر العلم والمعرفة" },
  cat_random: { en: "Random", ar: "عشوائي" },
  cat_random_desc: { en: "Surprise me", ar: "فاجئني بتحدٍّ" },

  // Auth
  auth_welcome: { en: "Welcome Back", ar: "مرحباً بعودتك" },
  auth_create: { en: "Create Account", ar: "إنشاء حساب جديد" },
  auth_email: { en: "Email", ar: "البريد الإلكتروني" },
  auth_password: { en: "Password", ar: "كلمة المرور" },
  auth_or_continue: { en: "or continue with", ar: "أو المتابعة عبر" },
  auth_have_account: { en: "Already have an account?", ar: "هل لديك حساب بالفعل؟" },
  auth_no_account: { en: "Don't have an account?", ar: "ليس لديك حساب؟" },
  auth_age_notice: { en: "By continuing, you confirm that you are 18 years or older.", ar: "بالمتابعة، فإنك تؤكد أن عمرك 18 عاماً أو أكثر." },
  auth_check_email: { en: "Check your email for the confirmation link!", ar: "يرجى التحقق من بريدك الإلكتروني لتأكيد الحساب!" },

  // Feed / StoryCard
  people_who_pressed: { en: "People who pressed", ar: "أشخاص ضغطوا على الزر" },
  no_stories_feed: { en: "The world is waiting for its first good deed.", ar: "العالم بانتظار أول قصة عمل خير هنا." },
  inspire: { en: "Inspire", ar: "ألهمني" },
  pass_it_on: { en: "Pass it on", ar: "مررها للغير" },
  add_comment_placeholder: { en: "Add a comment...", ar: "أضف تعليقاً..." },
  post_comment: { en: "Post", ar: "نشر" },
  anonymous: { en: "Anonymous", ar: "مجهول" },
  user: { en: "User", ar: "مستخدم" },
  challenge_label: { en: "Challenge", ar: "التحدي" },
  chain_label: { en: "Chain", ar: "سلسلة" },

  // Press flow
  you_pressed_it: { en: "You pressed it.", ar: "لقد ضغطت على الزر." },
  no_going_back: { en: "There is no going back.", ar: "لا مجال للتراجع الآن." },
  choose_challenge_title: { en: "Choose your challenge.", ar: "اختر فئة التحدي الخاص بك." },
  you_chose: { en: "YOU CHOSE", ar: "اخترت فئة" },
  your_challenge: { en: "YOUR CHALLENGE", ar: "تحديك هو" },
  accept: { en: "ACCEPT", ar: "قبول التحدي" },
  pass: { en: "PASS", ar: "تمرير التحدي" },
  pass_note: { en: "Not for you? That's okay. Pass it on to someone else.", ar: "غير مناسب لك؟ لا مشكلة، يمكنك تمريره لشخص آخر." },
  requires_other_person: { en: "Requires another person", ar: "يتطلب مشاركة شخص آخر" },
  requires_money: { en: "May require money", ar: "قد يتطلب بعض المال" },

  // Complete page
  you_did_it: { en: "You did it!", ar: "رائع، لقد أنجزت التحدي!" },
  now_tell_story: { en: "Now tell your story", ar: "والآن شاركنا قصتك" },
  share_experience: { en: "Share your experience", ar: "شارك تجربتك الملهمة" },
  what_happened: { en: "What happened? *", ar: "ماذا حدث معك؟ *" },
  story_placeholder: { en: "Tell your story... What did you do? How did it go? What happened afterward?", ar: "أخبرنا بالقصة... ماذا فعلت؟ وكيف كان شعورك وماذا حدث بعد ذلك؟" },
  story_hint: { en: "Share the details that made this moment special", ar: "شارك التفاصيل التي جعلت هذه اللحظة مميزة" },
  add_photo: { en: "Add a photo (optional)", ar: "إضافة صورة (اختياري)" },
  camera: { en: "Camera", ar: "الكاميرا" },
  upload: { en: "Upload", ar: "رفع صورة" },
  remove: { en: "Remove", ar: "إزالة" },
  photo_safety_tip: { en: "💡 Remember: Never photograph people without their permission", ar: "💡 تذكر: لا تقم بتصوير الأشخاص دون موافقتهم الصريحة" },
  post_anonymously: { en: "Post anonymously (your name won't be shown)", ar: "النشر بشكل مجهول (لن يظهر اسمك)" },
  publish_story: { en: "Publish Your Story", ar: "انشر قصتك الآن" },
  publishing: { en: "Publishing...", ar: "جاري النشر..." },
  story_inspires_note: { en: "Your story will inspire others to do good", ar: "قصتك ستلهم الآخرين لفعل الخير" },

  // Discover page
  discover_title: { en: "Discover", ar: "اكتشف" },
  discover_subtitle: { en: "Stories that inspire action", ar: "قصص تحفز على العطاء والمبادرة" },
  tab_most_inspiring: { en: "❤️ Most Inspiring", ar: "❤️ الأكثر إلهاماً" },
  tab_recent_stories: { en: "✨ Recent Stories", ar: "✨ أحدث القصص" },
  tab_active_chains: { en: "🔥 Active Chains", ar: "🔥 السلاسل النشطة" },
  no_stories_found: { en: "No stories found yet.", ar: "لم يتم العثور على قصص بعد." },

  // Profile page
  default_bio: { en: "Try to leave people better than you found them.", ar: "اترك أثراً طيباً في كل مكان تحل به." },
  stat_good_deeds: { en: "Good Deeds", ar: "أعمال الخير" },
  stat_challenges: { en: "Challenges", ar: "التحديات" },
  stat_chains: { en: "Chains", ar: "السلاسل" },
  stat_inspired: { en: "Inspired", ar: "أشخاص أُلهموا" },
  your_stories: { en: "Your Stories", ar: "قصصك ومشاركاتك" },
  no_stories_profile: { en: "You haven't shared any stories yet.", ar: "لم تقم بمشاركة أي قصة بعد." },

  // Chains page
  your_chains: { en: "Your Chains", ar: "سلاسلك" },
  chains_subtitle: { en: "Every good deed can start a chain reaction", ar: "كل عمل خير يمكن أن يطلق سلسلة تفاعلية من الإحسان" },
  first_chain_start: { en: "Your first chain could start here.", ar: "سلسلتك الأولى يمكن أن تبدأ من هنا." },
  chain_number: { en: "Chain #", ar: "سلسلة رقم #" },
  position_number: { en: "Position #", ar: "الترتيب رقم #" },
  people_in_chain: { en: "people in chain", ar: "أشخاص في السلسلة" },
  your_contribution: { en: "YOUR CONTRIBUTION", ar: "مساهمتك في السلسلة" },
  keep_it_going: { en: "Keep it going!", ar: "واصل نشر الخير!" },

  // Footer
  footer_tagline: { en: "Do something good. Tell the story. Pass it on.", ar: "افعل الخير. شارك القصة. مررها لغيرك." },
  footer_copy: { en: "© 2026 Don't Press. A social network for kindness.", ar: "© 2026 لا تضغط. شبكة اجتماعية لنشر الإحسان." },
}

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  toggleLanguage: () => void
  t: (key: string) => string
  dir: 'ltr' | 'rtl'
  isArabic: boolean
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (key: string) => key,
  dir: 'ltr',
  isArabic: false,
})

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en')

  useEffect(() => {
    const saved = localStorage.getItem('dont_press_lang') as Language
    if (saved === 'en' || saved === 'ar') {
      setLanguageState(saved)
      document.documentElement.setAttribute('dir', saved === 'ar' ? 'rtl' : 'ltr')
      document.documentElement.setAttribute('lang', saved)
    }
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem('dont_press_lang', lang)
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr')
    document.documentElement.setAttribute('lang', lang)
  }

  const toggleLanguage = () => {
    const next = language === 'en' ? 'ar' : 'en'
    setLanguage(next)
  }

  const t = (key: string): string => {
    if (translations[key] && translations[key][language]) {
      return translations[key][language]
    }
    return key
  }

  const dir = language === 'ar' ? 'rtl' : 'ltr'
  const isArabic = language === 'ar'

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        toggleLanguage,
        t,
        dir,
        isArabic,
      }}
    >
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}

export function LanguageToggle({ className = '' }: { className?: string }) {
  const { language, toggleLanguage } = useLanguage()

  return (
    <button
      onClick={toggleLanguage}
      type="button"
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-warm-white/10 hover:bg-warm-white/20 text-warm-white border border-warm-white/10 transition-all hover:scale-105 active:scale-95 select-none ${className}`}
      title={language === 'en' ? 'التبديل إلى العربية' : 'Switch to English'}
    >
      <span>🌐</span>
      <span>{language === 'en' ? 'العربية' : 'English'}</span>
    </button>
  )
}
