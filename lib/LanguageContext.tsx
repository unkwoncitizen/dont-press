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
  tagline_sub: { en: "A social network where one small action can start a chain of good.", ar: "شبكة اجتماعية يبدأ فيها العمل الصغير الواحد سلسلةً من الخير." },
  pressed_today: { en: "18,421 people pressed today", ar: "18,421 شخص ضغطوا اليوم" },
  after_press_note: { en: "What happens after the press is up to you.", ar: "ما يحدث بعد الضغط يعود إليك." },
  you_know_you_want: { en: "You know you want to...", ar: "أنت تعرف أنك تريد..." },
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
  auth_check_email_hint: { en: "Open the link we sent to", ar: "افتح الرابط الذي أرسلناه إلى" },
  auth_back_to_signin: { en: "Already confirmed? Sign in", ar: "تم التأكيد بالفعل؟ سجّل الدخول" },
  auth_rate_limited: { en: "Too many attempts. Please wait a few minutes and try again.", ar: "عدد المحاولات كبير جداً. يرجى الانتظار بضع دقائق ثم المحاولة مرة أخرى." },
  auth_already_registered: { en: "This email is already registered. Try signing in instead.", ar: "هذا البريد الإلكتروني مسجل بالفعل. جرّب تسجيل الدخول بدلاً من ذلك." },
  auth_bad_credentials: { en: "Incorrect email or password.", ar: "البريد الإلكتروني أو كلمة المرور غير صحيحة." },
  auth_bad_redirect: { en: "This sign-in link is no longer valid. Please request a new one.", ar: "رابط تسجيل الدخول هذا لم يعد صالحاً. يرجى طلب رابط جديد." },
  auth_generic_error: { en: "Something went wrong. Please try again.", ar: "حدث خطأ ما. يرجى المحاولة مرة أخرى." },

  // Password reset
  auth_forgot_link: { en: "Forgot your password?", ar: "هل نسيت كلمة المرور؟" },
  auth_forgot_title: { en: "Reset Password", ar: "إعادة تعيين كلمة المرور" },
  auth_forgot_hint: { en: "Enter your email and we'll send you a link to choose a new password.", ar: "أدخل بريدك الإلكتروني وسنرسل لك رابطاً لاختيار كلمة مرور جديدة." },
  auth_send_reset: { en: "Send Reset Link", ar: "إرسال رابط الاستعادة" },
  auth_reset_sent: { en: "Reset link sent!", ar: "تم إرسال رابط الاستعادة!" },
  auth_new_password_title: { en: "Choose a New Password", ar: "اختر كلمة مرور جديدة" },
  auth_new_password_hint: { en: "Pick something you haven't used before. Minimum 6 characters.", ar: "اختر كلمة لم تستخدمها من قبل. 6 أحرف كحد أدنى." },
  auth_new_password: { en: "New Password", ar: "كلمة المرور الجديدة" },
  auth_confirm_password: { en: "Confirm New Password", ar: "تأكيد كلمة المرور الجديدة" },
  auth_save_password: { en: "Save New Password", ar: "حفظ كلمة المرور الجديدة" },
  auth_password_saved: { en: "Password updated.", ar: "تم تحديث كلمة المرور." },
  auth_redirecting: { en: "Taking you to the app...", ar: "جاري الانتقال إلى التطبيق..." },
  auth_passwords_mismatch: { en: "Passwords do not match.", ar: "كلمتا المرور غير متطابقتين." },
  auth_password_too_short: { en: "Password must be at least 6 characters.", ar: "يجب أن تكون كلمة المرور 6 أحرف على الأقل." },
  auth_reset_link_invalid: { en: "This reset link is invalid or has expired. Please request a new one.", ar: "رابط الاستعادة غير صالح أو منتهي الصلاحية. يرجى طلب رابط جديد." },
  auth_request_new_link: { en: "Request a New Link", ar: "طلب رابط جديد" },

  // Feed / StoryCard
  people_who_pressed: { en: "People who pressed", ar: "أشخاص ضغطوا على الزر" },
  no_stories_feed: { en: "The world is waiting for its first good deed.", ar: "العالم بانتظار أول عمل خير." },
  inspire: { en: "Inspire", ar: "أُلهم" },
  pass_it_on: { en: "Pass it on", ar: "مررها للغير" },
  add_comment_placeholder: { en: "Add a comment (press Enter)...", ar: "أضف تعليقاً (اضغط إدخال)..." },
  post_comment: { en: "Post", ar: "أضف التعليق" },
  posting_comment: { en: "...", ar: "..." },
  anonymous: { en: "Anonymous", ar: "مجهول" },
  user: { en: "User", ar: "مستخدم" },
  challenge_label: { en: "Challenge", ar: "التحدي" },
  chain_label: { en: "Chain", ar: "سلسلة" },
  link_copied: { en: "Link copied! 📋", ar: "تم نسخ الرابط! 📋" },
  pass_on_copied: { en: "Chain link copied! Share it 🔥", ar: "تم نسخ رابط التحدي! شاركه 🔥" },
  sign_in_to_comment: { en: "Please sign in to comment", ar: "يرجى تسجيل الدخول للتعليق" },

  // Press flow
  you_pressed_it: { en: "You pressed it.", ar: "لقد ضغطت على الزر." },
  no_going_back: { en: "There is no going back.", ar: "لا مجال للتراجع الآن." },
  choose_challenge_title: { en: "Choose your challenge.", ar: "اختر فئة التحدي." },
  you_chose: { en: "YOU CHOSE", ar: "اخترت" },
  your_challenge: { en: "YOUR CHALLENGE", ar: "تحديك" },
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
  filter_all: { en: "All", ar: "الكل" },
  no_stories_in_category: { en: "No stories in {cat} yet.", ar: "لا توجد قصص في {cat} بعد." },
  choose_path_cta: { en: "Start here", ar: "ابدأ من هنا" },

  // Profile page
  // The Arabic here previously said "leave a good impression wherever you go",
  // which is a different idea from leaving people better than you found them.
  default_bio: { en: "Try to leave people better than you found them.", ar: "حاول أن تترك الناس أفضل مما وجدتهم." },
  stat_good_deeds: { en: "Good Deeds", ar: "أعمال الخير" },
  stat_challenges: { en: "Challenges", ar: "التحديات" },
  stat_chains: { en: "Chains", ar: "السلاسل" },
  stat_inspired: { en: "Inspired", ar: "أُلهموا" },
  your_stories: { en: "Your Stories", ar: "قصصك ومشاركاتك" },
  no_stories_profile: { en: "You haven't shared any stories yet.", ar: "لم تقم بمشاركة أي قصة بعد." },

  // Other user profile page
  their_stories: { en: "Their Stories", ar: "قصصهم" },
  no_stories_other: { en: "They haven't shared any stories yet.", ar: "لم يشاركوا أي قصة بعد." },
  profile_not_found: { en: "Profile not found.", ar: "لم يتم العثور على الحساب." },
  my_profile: { en: "My Profile", ar: "حسابي" },
  back_to_feed: { en: "Back to Feed", ar: "العودة للقائمة" },
  edit_profile: { en: "Edit Profile", ar: "تعديل الحساب" },

  // "سلاسلك" literally reads as "your chains" (as in restraints), so this
  // frames them as chains of goodness instead.
  your_chains: { en: "Your Chains", ar: "سلاسل الخير" },
  chains_subtitle: { en: "Every good deed can start a chain reaction", ar: "كل عمل خير يمكن أن يطلق سلسلة تفاعلية من الإحسان" },
  first_chain_start: { en: "Your first chain could start here.", ar: "سلسلتك الأولى يمكن أن تبدأ من هنا." },
  chain_number: { en: "Chain #", ar: "سلسلة رقم #" },
  position_number: { en: "Position #", ar: "الترتيب رقم #" },
  people_in_chain: { en: "people in chain", ar: "أشخاص في السلسلة" },
  your_contribution: { en: "YOUR CONTRIBUTION", ar: "مساهمتك في السلسلة" },
  keep_it_going: { en: "Keep it going!", ar: "واصل نشر الخير!" },

  // Collaborative goal chains
  chains_title: { en: "Chains", ar: "السلاسل" },
  chains_subtitle_goal: { en: "One good deed, many people. Add what you did, then pass it on.", ar: "عمل خير واحد، والكثيرون غيرك. أضف ما أنجزته ثم مرّر السلسلة." },
  tab_discover_chains: { en: "Discover", ar: "استكشف" },
  tab_my_chains: { en: "My Chains", ar: "سلائلي" },
  chains_i_created: { en: "Chains I started", ar: "السلاسل التي بدأتها" },
  chains_i_joined: { en: "Chains I contributed to", ar: "السلاسل التي شاركت فيها" },
  no_created_chains: { en: "You haven't started a chain yet.", ar: "لم تبدأ أي سلسلة بعد." },
  no_joined_chains: { en: "You haven't contributed to a chain yet.", ar: "لم تساهم في أي سلسلة بعد." },
  no_active_chains: { en: "No active Chains yet.", ar: "لا توجد سلاسل نشطة بعد." },
  be_first_link: { en: "Start a good deed and be the first link.", ar: "ابدأ عملاً خيراً وكن أول حلقة في السلسلة." },
  start_a_chain_hint: { en: "Set a measurable goal, do your part, and let the community finish it.", ar: "حدد هدفاً قابلاً للقياس، وقم بجزءك، ودع المجتمع يكمل الباقي." },
  chain_created: { en: "Your chain is live!", ar: "سلسلتك منشورة الآن!" },

  chain_title_label: { en: "Chain title", ar: "عنوان السلسلة" },
  chain_title_placeholder: { en: "Feed 100 cats", ar: "أطعم 100 قطة" },
  chain_description_label: { en: "What is this chain about?", ar: "عمّ تتحدث هذه السلسلة؟" },
  chain_description_placeholder: { en: "Explain the good deed and how people can help.", ar: "اشرح العمل الخيّر وكيف يمكن للناس المساعدة." },
  chain_category_label: { en: "Category", ar: "الفئة" },
  chain_goal_label: { en: "Goal", ar: "الهدف" },
  chain_unit_label: { en: "Unit", ar: "وحدة القياس" },
  chain_unit_placeholder: { en: "cats", ar: "قطط" },
  chain_initial_label: { en: "How much did you accomplish?", ar: "كم أنجزت أنت؟" },
  chain_private_label: { en: "Keep this chain private (only you can see and add to it)", ar: "اجعل هذه السلسلة خاصة (أنت فقط يمكنك رؤيتها والإضافة إليها)" },
  create_chain: { en: "Create Chain", ar: "أنشئ السلسلة" },

  chain_private: { en: "Private", ar: "خاصة" },
  chain_active_badge: { en: "ACTIVE", ar: "نشطة" },
  chain_completed_badge: { en: "COMPLETED", ar: "مكتملة" },
  chain_completed_title: { en: "CHAIN COMPLETED", ar: "اكتملت السلسلة" },
  chain_goal_reached: { en: "Goal reached!", ar: "تم بلوغ الهدف!" },
  chain_remaining: { en: "remaining", ar: "متبقية" },
  started_by: { en: "Started by", ar: "بدأها" },
  view_chain: { en: "View Chain", ar: "عرض السلسلة" },
  continue_the_chain: { en: "CONTINUE THE CHAIN", ar: "أكمل السلسلة" },
  start_similar_chain: { en: "Start a similar chain", ar: "ابدأ سلسلة مشابهة" },
  chain_progress_label: { en: "Current progress", ar: "التقدم الحالي" },
  how_much_did_you_do: { en: "How much did you accomplish?", ar: "كم أنجزت؟" },
  chain_amount_label: { en: "Amount", ar: "الكمية" },
  chain_message_label: { en: "Add a short note", ar: "أضف ملاحظة قصيرة" },
  chain_message_placeholder: { en: "Tell people what you did.", ar: "أخبر الآخرين بما فعلت." },
  add_proof: { en: "Add a photo", ar: "أضف صورة" },
  optional: { en: "optional", ar: "اختياري" },
  cancel: { en: "Cancel", ar: "إلغاء" },
  confirm_contribution: { en: "Confirm", ar: "تأكيد" },
  adding_preview: { en: "You are adding {n} {unit} to this chain.", ar: "أنت تضيف {n} {unit} إلى هذه السلسلة." },
  chain_history: { en: "Chain history", ar: "تاريخ السلسلة" },
  chain_no_contributions: { en: "No contributions yet.", ar: "لا توجد مساهمات بعد." },
  chain_not_found: { en: "Chain not found.", ar: "لم يتم العثور على السلسلة." },
  chain_private_notice: { en: "This chain is private.", ar: "هذه السلسلة خاصة." },
  chain_completion_message: { en: "{n} {unit} were accomplished by the community.", ar: "أنجز المجتمع {n} {unit}." },
  chain_contributors_count: { en: "{n} people contributed", ar: "شارك {n} أشخاص" },

  pass_the_chain: { en: "PASS THE CHAIN", ar: "مرّر السلسلة" },
  pass_the_chain_hint: { en: "You did your part. Now it's someone else's turn — invite them to continue.", ar: "قمت بجزءك. الآن دور شخص آخر — ادعُه ليكمل السلسلة." },
  share_invite: { en: "Share invite", ar: "شارك الدعوة" },
  copy_chain_link: { en: "Copy link", ar: "انسخ الرابط" },
  chain_passed_toast: { en: "The chain has been passed on.", ar: "تم تمرير السلسلة." },
  chain_invite_copied: { en: "Invite copied — send it to someone!", ar: "تم نسخ الدعوة — أرسلها لشخص ما!" },
  contribution_added: { en: "Your contribution was added to the chain.", ar: "تمت إضافة مساهمتك إلى السلسلة." },
  chain_completed_toast: { en: "🎉 This chain has been completed!", ar: "🎉 اكتملت هذه السلسلة!" },

  chain_err_title: { en: "Give your chain a title of at least 3 characters.", ar: "اكتب عنواناً للسلسلة من 3 أحرف على الأقل." },
  chain_err_category: { en: "Choose a category.", ar: "اختر فئة." },
  chain_err_goal: { en: "Set a goal greater than zero.", ar: "حدد هدفاً أكبر من صفر." },
  chain_err_unit: { en: "Add a unit of measurement, like cats or trees.", ar: "أضف وحدة قياس مثل القطط أو الأشجار." },
  chain_err_initial: { en: "Enter how much you accomplished to start the chain.", ar: "أدخل ما أنجزته لبدء السلسلة." },
  chain_err_over: { en: "Your contribution cannot be more than the goal.", ar: "لا يمكن أن تكون مساهمتك أكبر من الهدف." },
  chain_err_amount: { en: "Enter an amount greater than zero.", ar: "أدخل كمية أكبر من صفر." },
  chain_err_too_much: { en: "That is more than the {n} {unit} remaining.", ar: "هذا أكثر من الـ {n} {unit} المتبقية." },

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
